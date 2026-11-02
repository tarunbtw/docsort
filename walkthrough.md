# DocSort: Technical Architecture, Model Training, & Pipeline Walkthrough

This document outlines the complete internal mechanics of DocSort: how the system is structured, how the classification model was trained, the exact lifecycle an uploaded document follows, and the role of every file in the execution pipeline.

---

## 1. System Overview and High-Level Flow

DocSort is a decoupled, three-tier document processing system designed to classify Indian government regulatory circulars and extract verifiable compliance metadata:

```
[ React 18 Frontend ]  (:3000)
       │  (PDF Upload / View Dashboard)
       ▼
[ Go Backend Service ]  (:8080)
       │  - Saves PDF to disk storage
       │  - Creates initial DB record
       │  - Calls Python engine via HTTP POST /process
       ▼
[ Python ML/NLP Engine ] (:8000)
       │
       ├── Step 1: Text Extraction & OCR Guard (pdfplumber / Tesseract)
       ├── Step 2: Linear Triage Pre-Filter (Sublinear TF-IDF + Logistic Regression)
       │           └── If not procurement -> Short-circuit (Zero LLM calls)
       ├── Step 3: Structured Metadata Extraction (LLM with Pydantic Schema)
       └── Step 4: Deterministic Verbatim Verification (Substring Grounding)
       │
       ▼
[ Return JSON to Go Backend ]
       │  - Calculate Compliance Score (100 - 12 * flags)
       │  - Link Supersessions in Database (SQLite)
       │  - Record Audit Log
       ▼
[ Update UI via REST Polling ]
```

---

## 2. How the Model Is Trained

DocSort uses a **classical Machine Learning classifier (Sublinear TF-IDF + Logistic Regression)** as a high-speed pre-filter to separate procurement policies from general administrative noise before invoking any LLM.

### Step 1: Document Collection
* **Procurement Documents (`y = 1`)**: 18 policy manuals and circulars from the Department of Expenditure (`doe.gov.in`), including General Financial Rules (GFR 2017), Manual for Procurement of Goods, Manual for Works, and GeM payment guidelines.
* **Non-Procurement Documents (`y = 0`)**: 32 administrative circulars from the University Grants Commission (`ugc.gov.in`) and the Department of Personnel and Training (`dopt.gov.in`), including holiday schedules, employee transfers, pay commission circulars, and academic notices.

### Step 2: Paragraph-Aware Chunking (`engine/src/engine/chunking.py`)
Government PDFs range from 2 to 250+ pages. Scoring a 200-page document as a single string causes signal dilution, and training whole documents produces too few data points.
* The function `chunk_text()` splits documents on paragraph breaks (`\n\n`).
* Chunks are bounded at `CHUNK_SIZE_CHARS = 1500` characters. Passages under `MIN_CHUNK_CHARS = 200` characters are discarded.
* Chunks per PDF are capped (e.g. maximum 20 evenly spread passages per manual) so that a 300-page manual does not dominate the dataset.

### Step 3: Weak Supervision & Rule-Based Labeling (`engine/src/engine/label_rules.py`)
To avoid manual labeling costs or non-deterministic LLM labeling, an offline ensemble of deterministic labeling functions assigns training labels:
1. **Procurement Lexicon Voting**: Matches terms with positive weights:
   * *Weight 1.0*: `tender`, `bidding`, `procuring entity`, `gem`, `bid security`, `earnest money`, `gfr`, `rate contract`, `e-procurement`.
   * *Weight 0.5–0.8*: `emd`, `cvc`, `liquidated damages`, `vendor`, `purchase order`.
2. **Administrative Negative Lexicon Voting**: Matches terms associated with general office operations:
   * `holiday`, `seniority`, `leave`, `pension`, `roster`, `pay commission`, `admissions`.
3. **Regular Expressions**: Matches monetary thresholds (INR lakhs/crores) and GFR statutory rule citations.
4. **Source Domain Priors**: Uses publishing portal origin as an initial prior.
5. **Margin Thresholding**:
   $$\text{Margin} = \text{Score}_{\text{procurement}} - \text{Score}_{\text{admin}}$$
   If $|\text{Margin}| < 1.0$, the function **abstains** rather than assigning a noisy label.

Dataset generation is managed by `engine/build_dataset.py`, producing `engine/data/labeled_docs.csv`.

### Step 4: Feature Representation (Sublinear TF-IDF)
In `engine/train_classifier.py`, text passages are vectorized using `sklearn.feature_extraction.text.TfidfVectorizer`:
* **Unigrams and Bigrams (`ngram_range=(1, 2)`)**: Captures compound domain phrases like `bid security`, `earnest money`, and `threshold limit`.
* **Sublinear Term Frequency (`sublinear_tf=True`)**:
  $$\text{tf}_{\text{sub}}(t, d) = 1 + \ln(\text{tf}(t, d)) \quad \text{for } \text{tf} > 0$$
  This logarithmic dampening prevents repetitive administrative headers or addresses from dominating feature weights.
* **Vocabulary Bound**: Top 10,000 features (`max_features=10_000`).
* **$L_2$ Normalization**: Feature vectors are normalized onto the unit sphere.

### Step 5: Classifier Training & Class Balancing
The classification step uses `sklearn.linear_model.LogisticRegression`:
* Minimizes $L_2$-regularized cross-entropy loss.
* Uses balanced class weights:
  $$w_c = \frac{M}{2 \cdot M_c}$$
  This penalizes false negatives on procurement documents more heavily, raising test recall to 0.96.
* The fitted pipeline is serialized using `joblib` into `engine/models/tfidf_lr.pkl`.

---

## 3. Document Lifecycle: Stages a Document Goes Through on Upload

When a user drops a PDF into DocSort, the document advances through six discrete stages:

```
[ Upload PDF ]
     │
     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 0: Ingestion & Storage (Go Backend)                              │
│ - POST /api/documents/upload                                           │
│ - Save file to backend/storage/uploads/<docID>.pdf                     │
│ - Insert DB row with status="processing"                               │
│ - Dispatch HTTP POST to Python Engine http://127.0.0.1:8000/process    │
└────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 1: Text Extraction & OCR Guard (Python Engine)                   │
│ - extract_text() reads digital text via pdfplumber                     │
│ - If text length < 50 characters:                                      │
│     * Runs Tesseract OCR fallback via pypdfium2                        │
│     * If OCR fails or is unavailable: raises ScannedDocumentError      │
└────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 2: Classical Relevance Triage (Python Engine)                    │
│ - chunk_text() divides text into 1,500-char passages                   │
│ - predict_document() runs tfidf_lr.pkl across all chunks               │
│ - Aggregates p_max and frac_relevant (fraction of chunks with P >= 0.5)│
│                                                                        │
│ Branch A: Not Relevant (p_max < 0.4 and frac < 0.1)                    │
│           ──► Returns status="not_relevant". Pipeline HALTS.           │
│ Branch B: Uncertain (Ambiguous scores)                                 │
│           ──► Returns status="uncertain". Routed to human review.      │
│ Branch C: Relevant (p_max >= 0.8 or frac >= 0.3)                       │
│           ──► Proceeds to Stage 3.                                     │
└────────────────────────────────────────────────────────────────────────┘
     │ (Relevant Documents Only)
     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 3: Constrained LLM Extraction (Python Engine)                    │
│ - Header Pass: First 10,000 characters sent to LLM                     │
│   Extracts: title, date, issuing_authority, om_number, doc_type,       │
│             categories, summary                                        │
│ - Coverage Pass: 8 evenly sampled chunks from document body            │
│   Extracts: superseded_documents references and effective dates        │
│ - Constraints: Temperature = 0.0, Pydantic schema validation           │
│   Allowed categories: e-procurement, tendering, vendor-eligibility,    │
│   penalty, GeM, threshold-limits, other                                │
└────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 4: Verbatim Source Verification (Python Engine)                  │
│ - verify_fields() checks extracted values against original PDF text    │
│ - General fields: whitespace-collapsed lowercase substring match       │
│ - Reference numbers (OM number, supersedes): marker-stripped canonical │
│   comparison (strips "No.", "F.", "Ref" to avoid formatting mismatches)│
│ - Discrepancies appended to verification_flags list                    │
│ - Returns combined JSON payload to Go Backend                          │
└────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 5: Outcome Classification & Supersession Linking (Go Backend)   │
│ - Compute Compliance Score: Score = 100 - (12 * len(flags)), min 40    │
│ - Status mapping:                                                      │
│     * not_relevant -> ComplianceStatus="Not Procurement", Score=0      │
│     * score >= 80 -> ComplianceStatus="Verified"                       │
│     * score < 80 -> ComplianceStatus="Needs Review"                    │
│ - linkSupersessions():                                                 │
│     * Validates supersession reference passed verbatim verification    │
│     * Finds older documents in DB matching the voided reference        │
│     * Marks older document as is_superseded=true, points to new docID  │
│ - Persists metadata and audit log in SQLite database                   │
└────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Stage 6: Dashboard Presentation (React Frontend)                       │
│ - Live table reflects updated status badge                             │
│ - Document Drawer displays metadata side-by-side with audit flags      │
│ - Highlighted orange badges alert user to unverified fields            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. File-by-File Pipeline Directory Reference

The following index lists every active file in the DocSort pipeline and its exact functional responsibility:

### Frontend Layer (`frontend/`)

| File Path | Description |
|---|---|
| `frontend/src/components/Dashboard.tsx` | Main application view. Displays summary statistics (total circulars, verified rate, non-procurement count), file upload dropzone, and recent document streams. |
| `frontend/src/components/Repository.tsx` | Searchable, paginated registry table for all documents with status badges, category filters, and re-processing triggers. |
| `frontend/src/components/DocumentModal.tsx` | Slide-out inspection drawer. Renders extracted metadata, raw PDF viewer, compliance score, and verbatim verification audit flags. |
| `frontend/src/lib/api.ts` | Type definitions and HTTP client wrapping Go backend REST endpoints (`/api/documents`, `/api/documents/upload`, `/api/stats/dashboard`). |

---

### Backend Layer (`backend/`)

| File Path | Description |
|---|---|
| `backend/cmd/server/main.go` | Entry point for the Go service. Initializes disk storage directories, connects to the SQLite database, registers HTTP routes, and listens on port 8080. |
| `backend/internal/handlers/handlers.go` | HTTP request handlers: multipart upload handling (`UploadDocument`), document reprocessing (`ReprocessDocument`), compliance scoring (`classifyOutcome`), and automated supersession graph linking (`linkSupersessions`). |
| `backend/internal/engine/client.go` | Go HTTP client that dispatches JSON payloads to the Python ML engine (`http://127.0.0.1:8000/process`) and parses results. |
| `backend/internal/database/db.go` | Database access layer. Manages SQLite schema migrations, status updates, metadata persistence, supersession relations, and audit logging. |
| `backend/internal/database/models.go` | Go struct definitions for documents, metadata, audit records, and status update payloads. |

---

### Machine Learning & Processing Engine Layer (`engine/`)

| File Path | Description |
|---|---|
| `engine/src/engine/api.py` | FastAPI application exposing `/health`, `/process` (by file path), and `/process/upload` (direct multipart file upload). |
| `engine/src/engine/pipeline.py` | Master orchestrator function `process_document()`. Sequences text extraction, triage pre-filtering, structured extraction, and verification. |
| `engine/src/engine/extract.py` | PDF ingestion module. Uses `pdfplumber` to extract digital text and checks character length against `_MIN_TEXT_LENGTH = 50`. Falls back to OCR when needed. |
| `engine/src/engine/ocr.py` | Tesseract OCR integration using `pypdfium2` and `pytesseract` to recover text from scanned image-based PDFs. |
| `engine/src/engine/chunking.py` | Paragraph-aware chunker (`chunk_text()`) and stratified sampler (`sample_evenly()`). Enforces consistent 1,500-character chunk boundaries across training and inference. |
| `engine/src/engine/classify.py` | Stage 1 linear classifier runtime wrapper. Chunks incoming documents, runs `tfidf_lr.pkl` inference on each passage, aggregates probabilities, and enforces threshold logic. |
| `engine/src/engine/providers.py` | Dynamic LLM provider registry. Parses `LLM_PROVIDERS` configuration to support failover across Groq, Gemini, Anthropic, or OpenAI-compatible endpoints. |
| `engine/src/engine/llm_extract.py` | Stage 2 extraction module. Performs a 10,000-character header pass and an 8-chunk coverage pass. Validates outputs against a 7-class closed category taxonomy using Pydantic. |
| `engine/src/engine/verify.py` | Stage 3 verbatim verification engine. Checks factual strings against source text using whitespace-collapsed and canonical reference comparison. Appends discrepancy field names to `verification_flags`. |

---

### Dataset Construction & Training Scripts (`engine/`)

| File Path | Description |
|---|---|
| `engine/download_samples.py` | Batch downloader script that fetches sample public procurement and administrative circulars from DoE, UGC, and DoPT portals. |
| `engine/src/engine/label_rules.py` | Weak supervision labeling rules. Implements weighted procurement lexicons, administrative negative lexicons, regexes, and margin abstention thresholds. |
| `engine/build_dataset.py` | Processes downloaded sample PDFs, chunks them, executes rule-based labeling, and generates `labeled_docs_auto.csv`. |
| `engine/train_classifier.py` | Model training script. Loads labeled CSV data, computes unigram/bigram sublinear TF-IDF features, fits regularized Logistic Regression with balanced class weights, and saves `models/tfidf_lr.pkl`. |
| `engine/evaluate_classifier.py` | Rigorous evaluation script. Tests the trained model across passage-level and held-out document-level splits, outputting classification reports and confusion matrices. |

---

## 5. Summary Table: Processing Steps

| Step | Action | Executing File | Time / Cost |
|---|---|---|---|
| **0** | Upload PDF & allocate UUID | `backend/internal/handlers/handlers.go` | ~5 ms |
| **1** | Extract digital text (with 50-char OCR guard) | `engine/src/engine/extract.py` | ~80 ms |
| **2** | Classify relevance via Sublinear TF-IDF + LR | `engine/src/engine/classify.py` | **3.8 ms (CPU)** |
| -- | *If non-procurement: HALT* | `engine/src/engine/pipeline.py` | **0 tokens ($0.00)** |
| **3** | Extract metadata via instruction-tuned LLM | `engine/src/engine/llm_extract.py` | ~1.5 - 2.0 s |
| **4** | Check factual fields verbatim against text | `engine/src/engine/verify.py` | ~1 ms |
| **5** | Calculate score, link supersessions, save DB | `backend/internal/handlers/handlers.go` | ~10 ms |
| **6** | Display record & audit badges in UI | `frontend/src/components/Repository.tsx` | Instant |
