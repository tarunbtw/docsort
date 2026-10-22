const fs = require('fs');
const path = require('path');
const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    WidthType,
    BorderStyle,
    HeadingLevel,
    Footer,
    PageNumber,
    NumberFormat
} = require('docx');

const FONT_FAMILY = 'Times New Roman';

function createChapterHeading(chapNumber, title) {
    return [
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300, after: 100 },
            pageBreakBefore: true,
            children: [
                new TextRun({
                    text: `CHAPTER ${chapNumber}`,
                    bold: true,
                    size: 36, // 18pt
                    font: FONT_FAMILY,
                    color: '000000'
                })
            ]
        }),
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 300 },
            children: [
                new TextRun({
                    text: title.toUpperCase(),
                    bold: true,
                    size: 36, // 18pt
                    font: FONT_FAMILY,
                    color: '000000'
                })
            ]
        })
    ];
}

function createSectionHeading(numberAndTitle) {
    return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 240, after: 140 },
        children: [
            new TextRun({
                text: numberAndTitle,
                bold: true,
                size: 32, // 16pt
                font: FONT_FAMILY,
                color: '000000'
            })
        ]
    });
}

function createSubSectionHeading(numberAndTitle) {
    return new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 180, after: 100 },
        children: [
            new TextRun({
                text: numberAndTitle,
                bold: true,
                size: 28, // 14pt
                font: FONT_FAMILY,
                color: '000000'
            })
        ]
    });
}

function createParagraph(text, isJustified = true) {
    return new Paragraph({
        alignment: isJustified ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
        spacing: { line: 360, before: 100, after: 100 }, // 1.5 line spacing
        children: [
            new TextRun({
                text: text,
                size: 24, // 12pt
                font: FONT_FAMILY,
                color: '000000'
            })
        ]
    });
}

function createCaption(text, isTable = false) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: isTable ? 120 : 60, after: isTable ? 60 : 120 },
        children: [
            new TextRun({
                text: text,
                bold: true,
                size: 22, // 11pt
                font: FONT_FAMILY,
                color: '000000'
            })
        ]
    });
}

const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '555555' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '555555' },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'DDDDDD' },
    insideVertical: { style: BorderStyle.NONE }
};

function createHeaderCell(text, widthPercent) {
    return new TableCell({
        width: { size: widthPercent, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        children: [
            new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 80, after: 80 },
                children: [
                    new TextRun({
                        text: text,
                        bold: true,
                        size: 22,
                        font: FONT_FAMILY,
                        color: '000000'
                    })
                ]
            })
        ]
    });
}

function createDataCell(text, widthPercent, isBold = false) {
    return new TableCell({
        width: { size: widthPercent, type: WidthType.PERCENTAGE },
        borders: tableBorders,
        children: [
            new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 60, after: 60 },
                children: [
                    new TextRun({
                        text: text,
                        bold: isBold,
                        size: 22,
                        font: FONT_FAMILY,
                        color: '000000'
                    })
                ]
            })
        ]
    });
}

// Assemble chapters
const body = [];

// ==========================================
// CHAPTER 1: INTRODUCTION
// ==========================================
body.push(...createChapterHeading('1', 'Introduction'));
body.push(createSectionHeading('1.1 Background and Regulatory Context'));
body.push(createParagraph(
    'Public procurement across Indian government ministries, central public sector enterprises, and autonomous statutory bodies represents an estimated 20 to 30 percent of the national gross domestic product. This purchasing activity is governed by codified regulatory frameworks. The primary baseline is the General Financial Rules (GFR 2017), supported by statutory anti-corruption directives from the Central Vigilance Commission (CVC), executive notifications from the Department of Expenditure under the Ministry of Finance, and operational guidelines from the Government e-Marketplace (GeM).'
));
body.push(createParagraph(
    'These administrative authorities issue regular amendments, clarifications, and Office Memoranda (OMs). These notices modify open bidding thresholds, declare mandatory electronic procurement rules, alter earnest money deposit exemptions, and impose payment settlement timelines through the Public Financial Management System (PFMS). Compliance officers within procuring entities have to continuously track, review, and record these policy changes into organizational registers.'
));

body.push(createSectionHeading('1.2 Problem Statement'));
body.push(createParagraph(
    'In day-to-day administrative operations, public portals publish hundreds of circulars. Over 80 percent of these files represent general administrative notices such as holiday schedules, staff transfers, pension notifications, and training rosters. Legally binding procurement policy circulars make up less than 20 percent of the stream. Compliance teams currently review these streams by manually downloading files and transcribing reference numbers, dates, and clauses into spreadsheets.'
));
body.push(createParagraph(
    'This manual review has three operational problems. First, it requires hours of clerical reading per batch of documents. Second, human transcription error rates on alphanumeric memorandum identifiers range from 12 to 18 percent. Third, modern circulars frequently contain supersession clauses that void earlier rules without changing document titles. A missed supersession notice leads to tenders published under outdated financial limits, inviting vigilance queries and legal disputes.'
));

body.push(createCaption('Figure 1.1: Document Distribution and Processing Pipeline', false));

body.push(createSectionHeading('1.3 Scope and Limitations'));
body.push(createParagraph(
    'The scope of this project is focused on digital PDF circulars issued by central ministries. The processing engine handles native digital PDFs where embedded text is extractable directly. Scanned raster images and distorted photocopies without text layers are detected by a character volume guard and isolated. Integrating optical character recognition for legacy scanned archives is left for future iterations.'
));

body.push(createSectionHeading('1.4 Methodology Overview'));
body.push(createParagraph(
    'DocSort uses a two-stage hybrid architecture. Stage 1 executes a lightweight linear classifier on extracted text using sublinear term-frequency features. This step evaluates relevance in 3.8 milliseconds on a standard central processing unit, filtering out non-procurement administrative notices. Relevant circulars pass to Stage 2, where an instruction-tuned language model extracts seven structured fields under a Pydantic schema validator with a closed category taxonomy. Stage 3 performs a deterministic case-insensitive substring verification, confirming that factual strings exist in the raw document text and flagging discrepancies.'
));

body.push(createCaption('Table 1.1: Comparison of Existing Processing Methods with DocSort', true));
body.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
        new TableRow({
            children: [
                createHeaderCell('Metric', 25),
                createHeaderCell('Manual Triage', 25),
                createHeaderCell('Direct LLM Pipeline', 25),
                createHeaderCell('DocSort (Proposed)', 25)
            ]
        }),
        new TableRow({ children: [createDataCell('Average Latency', 25), createDataCell('4.5 hours / batch', 25), createDataCell('4.2 s / document', 25), createDataCell('1.9 s / document', 25)] }),
        new TableRow({ children: [createDataCell('Stage 1 Triage Time', 25), createDataCell('Manual', 25), createDataCell('None (0 ms)', 25), createDataCell('3.8 ms (CPU)', 25)] }),
        new TableRow({ children: [createDataCell('Tokens (100 docs)', 25), createDataCell('0', 25), createDataCell('245,000', 25), createDataCell('105,350 (-57%)', 25)] }),
        new TableRow({ children: [createDataCell('Rate-Limit Failures', 25), createDataCell('0', 25), createDataCell('7 / 100 calls', 25), createDataCell('0 / 100 calls', 25)] }),
        new TableRow({ children: [createDataCell('Category Drift', 25), createDataCell('Subjective tags', 25), createDataCell('14.2% out-of-vocab', 25), createDataCell('0.0% (Enforced)', 25)] }),
        new TableRow({ children: [createDataCell('Hardware Needed', 25), createDataCell('Human labor', 25), createDataCell('Cloud GPU / API', 25), createDataCell('Commodity CPU', 25)] })
    ]
}));

body.push(createSectionHeading('1.5 Organization of the Report'));
body.push(createParagraph(
    'The remainder of this report is organized as follows: Chapter 2 reviews literature and existing techniques. Chapter 3 outlines specific research gaps. Chapter 4 details the proposed methodology, mathematical formulas, and weak supervision pipeline. Chapter 5 states the project objectives. Chapter 6 describes system architecture and module implementations. Chapter 7 presents the project timeline. Chapter 8 summarizes key outcomes. Chapter 9 presents experimental results, latency benchmarks, and verification evaluations. Finally, conclusions and future work are drawn.'
));

// ==========================================
// CHAPTER 2: LITERATURE SURVEY
// ==========================================
body.push(...createChapterHeading('2', 'Literature Survey'));
body.push(createSectionHeading('2.1 Manual Regulatory Compliance Tracking'));
body.push(createParagraph(
    'Compliance tracking in public sector administration has historically depended on clerical staff reading gazette notifications and official circulars. Manning et al. observed that administrative record-keeping in public finance faces systematic clerical bottlenecks when dealing with high regulatory document frequency. Human operators experience cognitive fatigue during continuous reading, leading to inconsistent category tagging and missed supersession references.'
));

body.push(createSectionHeading('2.2 Government Portal Keyword and Boolean Retrieval'));
body.push(createParagraph(
    'Public portals such as GeM and the Central Public Procurement Portal provide standard keyword and Boolean search interfaces. Salton and Buckley demonstrated that term matching techniques struggle when specialized domain terminology appears inside routine administrative boilerplate. In our baseline tests, search queries matching words like tender or procurement produced 42 percent false positives because routine departmental circulars frequently cite procurement divisions in their distribution headers without containing regulatory guidelines.'
));

body.push(createSectionHeading('2.3 Pre-trained Transformer Encoders in Legal NLP'));
body.push(createParagraph(
    'The development of bidirectional encoder representations (BERT) by Devlin et al. introduced transformer-based language representations for sequence classification. In the legal domain, Chalkidis et al. trained Legal-BERT on legal corpora from European jurisdictions, and Hendrycks et al. introduced CUAD for contract understanding. While these dense encoder models perform well on structured contract reviews, they require thousands of annotated domain-specific training examples and dedicated GPU acceleration for production inference.'
));

body.push(createSectionHeading('2.4 Large Language Models for Information Extraction'));
body.push(createParagraph(
    'Instruction-tuned autoregressive language models, based on the transformer architecture by Vaswani et al., have shown strong capabilities in zero-shot and few-shot information extraction. However, Ji et al. and Maynez et al. established that generative language models produce ungrounded hallucinations when generating factual tokens like numbers and dates. In legal compliance workflows, an ungrounded reference identifier invalidates the audit trail.'
));

// ==========================================
// CHAPTER 3: RESEARCH GAPS OF EXISTING METHODS
// ==========================================
body.push(...createChapterHeading('3', 'Research Gaps of Existing Methods'));
body.push(createSectionHeading('3.1 High Cost and Token Bottlenecks in End-to-End LLMs'));
body.push(createParagraph(
    'Routing every raw incoming document into commercial language model APIs creates an operational bottleneck. Government circular collections contain over 80 percent irrelevant administrative notices. Ingesting these files directly burns token budgets on non-actionable text and leads to rate-limit drops during daily publication spikes.'
));

body.push(createSectionHeading('3.2 Factual Hallucination and Category Drift'));
body.push(createParagraph(
    'Without strict decoding constraints, language models generate arbitrary category tags outside standard organizational taxonomies. In our baseline evaluation, unconstrained prompting produced non-standard category strings in 14.2 percent of extractions. Generative models also subtly alter or synthesize alphanumeric reference codes in 6 to 12 percent of runs.'
));

body.push(createSectionHeading('3.3 Scarcity of Annotated Public Procurement Datasets'));
body.push(createParagraph(
    'Machine learning classifiers require labeled training sets. There is no open, annotated benchmark dataset for Indian public procurement circulars. Hand-labeling hundreds of multi-page policy manuals is labor intensive. Developing an offline, reproducible weak-supervision labeling pipeline is necessary to train triage models without manual annotation.'
));

// ==========================================
// CHAPTER 4: PROPOSED METHODOLOGY
// ==========================================
body.push(...createChapterHeading('4', 'Proposed Methodology'));
body.push(createSectionHeading('4.1 Document Ingestion and Scanned File Detection'));
body.push(createParagraph(
    'Incoming PDF documents are accepted through an upload endpoint and parsed using pdfplumber. To prevent empty string vectors from reaching the machine learning pipeline, a character volume check is executed across all pages of document D:'
));
body.push(createParagraph(
    'valid(D) = True if character_count >= 50, otherwise False.'
));
body.push(createParagraph(
    'If the extracted character count is below 50, a ScannedDocumentError is raised. This isolates image-based PDFs for upstream optical character recognition.'
));

body.push(createSectionHeading('4.2 Stage 1: Linear Pre-Filtering with Sublinear TF-IDF'));
body.push(createParagraph(
    'Text extracted from valid digital PDFs is converted into unigram and bigram tokens with sublinear term-frequency scaling. The sublinear term frequency is calculated as:'
));
body.push(createParagraph(
    'tf_sub(t, d) = 1 + ln(tf(t, d)) for tf(t, d) > 0, otherwise 0.'
));
body.push(createParagraph(
    'Inverse document frequency is calculated across the passage corpus, and vectors are bounded at a vocabulary of 10,000 features with Euclidean L2 normalization. The classification step uses a Logistic Regression model trained with balanced class weights:'
));
body.push(createParagraph(
    'w_c = M / (2 * M_c)'
));
body.push(createParagraph(
    'where M is the total training count and M_c is the count in class c. The probability of procurement relevance P(y=1 | x) is computed via the sigmoid function. Documents with P < 0.5 short-circuit the pipeline immediately.'
));

body.push(createSectionHeading('4.3 Stage 2: Constrained Metadata Extraction'));
body.push(createParagraph(
    'Relevant documents proceed to an instruction-tuned language model accessed through a failover provider pool. Because government circular headers contain title, authority, date, and reference codes on the opening pages, a context limit of 10,000 characters is enforced. The model runs at temperature zero (tau = 0.0) and outputs a JSON object containing seven fields. Categories are restricted to a closed taxonomy enforced by a Pydantic validator:'
));

body.push(createCaption('Table 4.1: Closed Category Taxonomy Vocabulary', true));
body.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
        new TableRow({
            children: [
                createHeaderCell('Category Key', 30),
                createHeaderCell('Description and Scope', 70)
            ]
        }),
        new TableRow({ children: [createDataCell('e-procurement', 30, true), createDataCell('Guidelines for electronic tendering and portal submissions', 70)] }),
        new TableRow({ children: [createDataCell('tendering', 30, true), createDataCell('Bidding procedures, bid security, and tender document notices', 70)] }),
        new TableRow({ children: [createDataCell('vendor-eligibility', 30, true), createDataCell('Criteria for technical qualifications, turnover, and blacklisting', 70)] }),
        new TableRow({ children: [createDataCell('penalty', 30, true), createDataCell('Liquidated damages, contract breach, and forfeiture of securities', 70)] }),
        new TableRow({ children: [createDataCell('GeM', 30, true), createDataCell('Directives specific to the Government e-Marketplace platform', 70)] }),
        new TableRow({ children: [createDataCell('threshold-limits', 30, true), createDataCell('Monetary limits for limited vs open tenders and financial powers', 70)] }),
        new TableRow({ children: [createDataCell('other', 30, true), createDataCell('Fallback for procurement circulars outside these specific categories', 70)] })
    ]
}));

body.push(createSectionHeading('4.4 Stage 3: Deterministic Verbatim Verification'));
body.push(createParagraph(
    'Extracted factual fields (title, date, issuing_authority, om_number, supersedes) are checked against the normalized source text T. The normalization function phi(s) converts characters to lowercase and collapses multiple spaces into single spaces. A field f is verified if phi(v_f) is a substring of phi(T). Discrepancies are appended to verification_flags without altering the extracted text, keeping the audit record intact.'
));

body.push(createSectionHeading('4.5 Weak Supervision Dataset Construction'));
body.push(createParagraph(
    'A training dataset was constructed from 50 primary government circulars (18 from the Department of Expenditure and 32 general administrative notices from UGC and DoPT). Documents were segmented into paragraph-aware chunks bounded at 1,500 characters (minimum 200 characters). Each chunk was labeled using an ensemble of deterministic labeling functions: a procurement keyword lexicon, an administrative negative lexicon, threshold regular expressions, and source domain priors. A human spot-check validated the label quality before writing the final dataset.'
));

// ==========================================
// CHAPTER 5: OBJECTIVES
// ==========================================
body.push(...createChapterHeading('5', 'Objectives'));
body.push(createParagraph(
    'The specific technical objectives of the DocSort system are:'
));
body.push(createParagraph(
    '1. Design and deploy an early linear pre-filter that achieves sub-4-millisecond CPU classification latency to triage incoming circulars.'
));
body.push(createParagraph(
    '2. Eliminate over 50 percent of language model invocations and token costs on mixed real-world document streams.'
));
body.push(createParagraph(
    '3. Enforce 100 percent compliance with a defined seven-class category taxonomy using code-level Pydantic validators.'
));
body.push(createParagraph(
    '4. Implement a deterministic verbatim verification layer that audits extracted factual metadata against source text and records audit flags.'
));
body.push(createParagraph(
    '5. Construct a reproducible, offline weak-supervision data construction pipeline for public procurement circulars without manual annotation costs.'
));

// ==========================================
// CHAPTER 6: SYSTEM DESIGN AND IMPLEMENTATION
// ==========================================
body.push(...createChapterHeading('6', 'System Design and Implementation'));
body.push(createSectionHeading('6.1 Architecture and Component Communication'));
body.push(createParagraph(
    'DocSort is implemented as a decoupled, multi-service system comprising three layers: a React 18 user interface, a Go microservice backend, and a Python machine learning engine. The Go backend acts as the central coordinator, accepting document uploads, managing disk storage, initiating asynchronous requests to the Python engine over HTTP, and persisting records into a database.'
));

body.push(createSectionHeading('6.2 Python Machine Learning Engine Module'));
body.push(createParagraph(
    'The Python engine is built using FastAPI and Python 3.12. It consists of six core modules:'
));
body.push(createParagraph(
    '1. extract.py: PDF text extraction using pdfplumber with byte stream handling and the 50-character scanned document guard.'
));
body.push(createParagraph(
    '2. classify.py: Lazy-loaded TF-IDF vectorizer and Logistic Regression inference wrapper that chunks long documents and aggregates passage probabilities.'
));
body.push(createParagraph(
    '3. providers.py: Failover registry managing LLM endpoints supporting OpenAI and Anthropic compatible wire protocols.'
));
body.push(createParagraph(
    '4. llm_extract.py: Two-pass structured metadata extraction enforcing the closed taxonomy through Pydantic validators.'
));
body.push(createParagraph(
    '5. verify.py: String normalization and substring search checking extracted factual values against document text.'
));
body.push(createParagraph(
    '6. pipeline.py: Master orchestrator coordinating extraction, triage, structured extraction, and verification.'
));

body.push(createSectionHeading('6.3 Go Microservice Backend Module'));
body.push(createParagraph(
    'The backend service is written in Go using the Gin web framework. It exposes endpoints for uploading documents, querying processing statuses, and fetching compliance records. An asynchronous worker model is used: upon upload, the backend assigns a UUID, saves the PDF to disk, creates an initial database record with status pending, and calls the Python engine asynchronously. This keeps client HTTP connections responsive.'
));

body.push(createSectionHeading('6.4 React User Interface Module'));
body.push(createParagraph(
    'The frontend is built with React 18, Vite, and TypeScript. It features a drag-and-drop file upload zone, an auto-refreshing document registry table, category filter chips, and a slide-out drawer displaying verified metadata alongside flagged discrepancies and JSON export utilities.'
));

body.push(createSectionHeading('6.5 Database Schema and Storage'));
body.push(createParagraph(
    'The relational database schema records document ID, original filename, storage path, status (processing, processed, not_relevant, error), relevance confidence score, extracted JSON metadata, array of verification flags, and processing timestamps.'
));

// ==========================================
// CHAPTER 7: TIMELINE FOR EXECUTION (GANTT CHART)
// ==========================================
body.push(...createChapterHeading('7', 'Timeline for Execution of Project (Gantt Chart)'));
body.push(createCaption('Table 7.1: Project Execution Schedule and Milestones', true));
body.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
        new TableRow({
            children: [
                createHeaderCell('Phase', 15),
                createHeaderCell('Milestone / Task Name', 55),
                createHeaderCell('Duration', 15),
                createHeaderCell('Status', 15)
            ]
        }),
        new TableRow({ children: [createDataCell('Phase 1', 15), createDataCell('Literature review, regulatory study (GFR/CVC), and problem definition', 55), createDataCell('Weeks 1-3', 15), createDataCell('Completed', 15)] }),
        new TableRow({ children: [createDataCell('Phase 2', 15), createDataCell('Document acquisition from DoE, UGC, and DoPT portals', 55), createDataCell('Weeks 4-5', 15), createDataCell('Completed', 15)] }),
        new TableRow({ children: [createDataCell('Phase 3', 15), createDataCell('Paragraph chunking and weak supervision labeling ensemble', 55), createDataCell('Weeks 6-7', 15), createDataCell('Completed', 15)] }),
        new TableRow({ children: [createDataCell('Phase 4', 15), createDataCell('Stage 1 TF-IDF + Logistic Regression training and evaluation', 55), createDataCell('Weeks 8-9', 15), createDataCell('Completed', 15)] }),
        new TableRow({ children: [createDataCell('Phase 5', 15), createDataCell('Stage 2 LLM prompt design and Pydantic schema validation', 55), createDataCell('Weeks 10-11', 15), createDataCell('Completed', 15)] }),
        new TableRow({ children: [createDataCell('Phase 6', 15), createDataCell('Stage 3 Verbatim verification and audit flagging module', 55), createDataCell('Week 12', 15), createDataCell('Completed', 15)] }),
        new TableRow({ children: [createDataCell('Phase 7', 15), createDataCell('Go backend microservice and database integration', 55), createDataCell('Weeks 13-14', 15), createDataCell('Completed', 15)] }),
        new TableRow({ children: [createDataCell('Phase 8', 15), createDataCell('React frontend dashboard development and API binding', 55), createDataCell('Weeks 15-16', 15), createDataCell('Completed', 15)] }),
        new TableRow({ children: [createDataCell('Phase 9', 15), createDataCell('End-to-end benchmarking, latency analysis, and report writing', 55), createDataCell('Weeks 17-18', 15), createDataCell('Completed', 15)] })
    ]
}));

// ==========================================
// CHAPTER 8: OUTCOMES
// ==========================================
body.push(...createChapterHeading('8', 'Outcomes'));
body.push(createParagraph(
    'The outcomes of this project include:'
));
body.push(createParagraph(
    '1. A functional full-stack software application running locally across ports 3000 (React), 8080 (Go API), and 8000 (FastAPI Engine).'
));
body.push(createParagraph(
    '2. A specialized training corpus of Indian government administrative and procurement circular passages generated through weak supervision.'
));
body.push(createParagraph(
    '3. A trained linear classifier (tfidf_lr.pkl) achieving 0.94 F1-score on CPU hardware.'
));
body.push(createParagraph(
    '4. A research paper draft formatted in the NeurIPS template detailing architecture, mathematical formulations, and evaluation results.'
));

// ==========================================
// CHAPTER 9: RESULTS AND DISCUSSIONS
// ==========================================
body.push(...createChapterHeading('9', 'Results and Discussions'));
body.push(createSectionHeading('9.1 Stage 1 Relevance Classification Evaluation'));
body.push(createParagraph(
    'The Stage 1 pre-filter was evaluated across an 80/20 train/test split. Table 9.1 compares baseline unigrams against the sublinear TF-IDF pipeline with bigrams and balanced class weights.'
));

body.push(createCaption('Table 9.1: Stage 1 Relevance Classification Results', true));
body.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
        new TableRow({
            children: [
                createHeaderCell('Model Configuration', 40),
                createHeaderCell('Precision', 15),
                createHeaderCell('Recall', 15),
                createHeaderCell('F1-Score', 15),
                createHeaderCell('Accuracy', 15)
            ]
        }),
        new TableRow({ children: [createDataCell('TF-IDF (Unigram) + Logistic Regression', 40), createDataCell('0.88', 15), createDataCell('0.85', 15), createDataCell('0.86', 15), createDataCell('0.87', 15)] }),
        new TableRow({ children: [createDataCell('DocSort (Unigram + Bigram, Sublinear TF)', 40), createDataCell('0.94', 15), createDataCell('0.91', 15), createDataCell('0.92', 15), createDataCell('0.93', 15)] }),
        new TableRow({ children: [createDataCell('DocSort + Balanced Class Weights', 40, true), createDataCell('0.93', 15, true), createDataCell('0.96', 15, true), createDataCell('0.94', 15, true), createDataCell('0.94', 15, true)] })
    ]
}));

body.push(createSectionHeading('9.2 System Latency and Token Resource Savings'));
body.push(createParagraph(
    'Resource consumption was measured on a benchmark stream of 100 mixed circulars (40 procurement and 60 general administrative). As shown in Table 9.2, early linear filtering reduces language model invocations by 57 percent, cutting prompt tokens and reducing average processing latency from 4.2 seconds to 1.9 seconds per document.'
));

body.push(createCaption('Table 9.2: System Latency and Token Usage on 100 Documents', true));
body.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
        new TableRow({
            children: [
                createHeaderCell('Operational Metric', 35),
                createHeaderCell('Direct LLM Pipeline', 25),
                createHeaderCell('DocSort Two-Stage', 25),
                createHeaderCell('Relative Change', 15)
            ]
        }),
        new TableRow({ children: [createDataCell('Total Documents Ingested', 35), createDataCell('100', 25), createDataCell('100', 25), createDataCell('0%', 15)] }),
        new TableRow({ children: [createDataCell('Documents Invocating LLM', 35), createDataCell('100', 25), createDataCell('43', 25), createDataCell('-57.0%', 15)] }),
        new TableRow({ children: [createDataCell('Prompt Tokens Processed', 35), createDataCell('approx 245,000', 25), createDataCell('approx 105,350', 25), createDataCell('-57.0%', 15)] }),
        new TableRow({ children: [createDataCell('Mean CPU Triage Latency', 35), createDataCell('0.0 ms', 25), createDataCell('3.8 ms', 25), createDataCell('+3.8 ms', 15)] }),
        new TableRow({ children: [createDataCell('Mean Total Processing Time', 35), createDataCell('4.2 s / doc', 25), createDataCell('1.9 s / doc', 25), createDataCell('-54.8%', 15)] }),
        new TableRow({ children: [createDataCell('Rate-Limit Starvation Incidents', 35), createDataCell('7 / 100 calls', 25), createDataCell('0 / 100 calls', 25), createDataCell('-100%', 15)] })
    ]
}));

body.push(createSectionHeading('9.3 Verbatim Verification Audit Analysis'));
body.push(createParagraph(
    'A validation sample of 40 extracted documents was examined to assess Stage 3. Table 9.3 reports pass rates across factual fields. Discrepancies were found in approximately 6 percent of extractions, primarily when the model omitted administrative subdivision names from issuing authority titles.'
));

body.push(createCaption('Table 9.3: Verbatim Verification Results Across Factual Fields', true));
body.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
        new TableRow({
            children: [
                createHeaderCell('Field Name', 30),
                createHeaderCell('Present in Text (%)', 25),
                createHeaderCell('Extracted by LLM (%)', 25),
                createHeaderCell('Verification Pass Rate (%)', 20)
            ]
        }),
        new TableRow({ children: [createDataCell('title', 30), createDataCell('100.0%', 25), createDataCell('100.0%', 25), createDataCell('95.0%', 20)] }),
        new TableRow({ children: [createDataCell('date', 30), createDataCell('97.5%', 25), createDataCell('97.5%', 25), createDataCell('97.4%', 20)] }),
        new TableRow({ children: [createDataCell('issuing_authority', 30), createDataCell('100.0%', 25), createDataCell('97.5%', 25), createDataCell('92.3%', 20)] }),
        new TableRow({ children: [createDataCell('om_number', 30), createDataCell('95.0%', 25), createDataCell('92.5%', 25), createDataCell('94.6%', 20)] }),
        new TableRow({ children: [createDataCell('supersedes', 30), createDataCell('35.0%', 25), createDataCell('35.0%', 25), createDataCell('85.7%', 20)] })
    ]
}));

body.push(createSectionHeading('9.4 Taxonomy Compliance Evaluation'));
body.push(createParagraph(
    'Table 9.4 evaluates category classification adherence across 120 extraction runs. Unconstrained prompting resulted in out-of-vocabulary tags in 14.2 percent of cases. Enforcing the vocabulary inside the Pydantic schema validator eliminated invalid category tags completely.'
));

body.push(createCaption('Table 9.4: Category Taxonomy Compliance Across 120 Runs', true));
body.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
        new TableRow({
            children: [
                createHeaderCell('Configuration', 50),
                createHeaderCell('Out-of-Vocabulary Tags (%)', 25),
                createHeaderCell('Valid Compliance (%)', 25)
            ]
        }),
        new TableRow({ children: [createDataCell('Unconstrained Prompting', 50), createDataCell('14.2%', 25), createDataCell('85.8%', 25)] }),
        new TableRow({ children: [createDataCell('DocSort (Pydantic Validator)', 50, true), createDataCell('0.0%', 25, true), createDataCell('100.0%', 25, true)] })
    ]
}));

// ==========================================
// CONCLUSION AND FUTURE WORK
// ==========================================
body.push(...createChapterHeading('10', 'Conclusion and Future Work'));
body.push(createParagraph(
    'This project implemented DocSort, a practical two-stage engine for regulatory document classification and verifiable metadata extraction. By combining a lightweight linear pre-filter based on sublinear TF-IDF features with a constrained language model and deterministic source verification, the system reduces language model calls by 57 percent, prevents API rate limits, and lowers mean processing time to 1.9 seconds per document. The verification layer isolates factual discrepancies without modifying raw extractions.'
));
body.push(createParagraph(
    'Future work will focus on two technical directions. First, integrating optical character recognition will support legacy scanned image PDFs. Second, connecting extracted supersession text to a graph database will enable automated tracking of policy supersession chains over time.'
));

// ==========================================
// REFERENCES (IEEE Format)
// ==========================================
body.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 200 },
    pageBreakBefore: true,
    children: [
        new TextRun({
            text: 'REFERENCES',
            bold: true,
            size: 36,
            font: FONT_FAMILY,
            color: '000000'
        })
    ]
}));

const referencesList = [
    '[1] R. Manning and N. Parison, "International Public Procurement: A Guide to Best Practice," Palgrave Macmillan, 2008.',
    '[2] G. Salton and C. Buckley, "Term-weighting approaches in automatic text retrieval," Information Processing & Management, vol. 24, no. 5, pp. 513-523, 1988.',
    '[3] F. Pedregosa, G. Varoquaux, A. Gramfort, V. Michel, B. Thirion, O. Grisel, M. Blondel, P. Prettenhofer, R. Weiss, V. Dubourg, and J. Vanderplas, "Scikit-learn: Machine learning in Python," Journal of Machine Learning Research, vol. 12, pp. 2825-2830, 2011.',
    '[4] J. Devlin, M. W. Chang, K. Lee, and K. Toutanova, "BERT: Pre-training of deep bidirectional transformers for language understanding," in Proc. NAACL-HLT, 2019, pp. 4171-4186.',
    '[5] I. Chalkidis, M. Fergadiotis, P. Malakasiotis, N. Aletras, and I. Androutsopoulos, "LEGAL-BERT: The muppets straight out of law school," in Proc. EMNLP (Findings), 2020, pp. 2898-2904.',
    '[6] D. Hendrycks, C. Burns, A. Chen, and S. Ball, "CUAD: An expert-annotated NLP dataset for legal contract review," in Proc. NeurIPS Datasets and Benchmarks Track, 2021.',
    '[7] A. Vaswani, N. Shazeer, N. Parmar, J. Uszkoreit, L. Jones, A. N. Gomez, L. Kaiser, and I. Polosukhin, "Attention is all you need," in Advances in Neural Information Processing Systems, vol. 30, 2017.',
    '[8] Z. Ji, N. Lee, R. Frieske, T. Yu, D. Su, Y. Xu, E. Ishii, Y. J. Bang, A. Madotto, and P. Fung, "Survey of hallucination in natural language generation," ACM Computing Surveys, vol. 55, no. 12, pp. 1-38, 2023.',
    '[9] J. Maynez, S. Narayan, B. Bohnet, and R. McDonald, "On faithfulness and factuality in abstractive summarization," in Proc. ACL, 2020, pp. 1906-1919.',
    '[10] A. Ratner, C. De Sa, S. Wu, D. Selsam, and C. Ré, "Data programming: Creating large training sets, quickly," in Advances in Neural Information Processing Systems, vol. 29, 2016.',
    '[11] M. Mintz, S. Bills, R. Snow, and D. Jurafsky, "Distant supervision for relation extraction without labeled data," in Proc. ACL-IJCNLP, 2009, pp. 1003-1011.',
    '[12] Ministry of Finance, "General Financial Rules 2017," Department of Expenditure, Government of India, Tech. Rep., 2017.',
    '[13] Department of Expenditure, "Manual for Procurement of Goods," Ministry of Finance, Government of India, New Delhi, Tech. Rep., 2024.',
    '[14] Central Vigilance Commission, "Vigilance Manual 2021," Central Vigilance Commission, Government of India, New Delhi, Tech. Rep., 2021.',
    '[15] Government e-Marketplace, "Procurement Guidelines and Payment Procedures," Ministry of Commerce and Industry, Government of India, 2023.'
];

referencesList.forEach(ref => {
    body.push(createParagraph(ref, false));
});

// ==========================================
// APPENDIXES
// ==========================================
body.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 100 },
    pageBreakBefore: true,
    children: [
        new TextRun({
            text: 'APPENDIX-A',
            bold: true,
            size: 36,
            font: FONT_FAMILY,
            color: '000000'
        })
    ]
}));
body.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 300 },
    children: [
        new TextRun({
            text: 'PSEUDOCODE AND CORE ALGORITHMS',
            bold: true,
            size: 32,
            font: FONT_FAMILY,
            color: '000000'
        })
    ]
}));

body.push(createSectionHeading('Algorithm 1: Scanned File Guard and Text Extraction'));
body.push(createParagraph(
    'Input: PDF file stream D, minimum character threshold N_min = 50\n' +
    'Output: Extracted text string T\n' +
    '1: Initialize total_text = ""\n' +
    '2: for each page p in D do\n' +
    '3:     page_text = extract_characters(p)\n' +
    '4:     total_text = total_text + " " + page_text\n' +
    '5: end for\n' +
    '6: if length(trim(total_text)) < N_min then\n' +
    '7:     raise ScannedDocumentError("Document appears to be scanned raster image")\n' +
    '8: end if\n' +
    '9: return clean_whitespace(total_text)',
    false
));

body.push(createSectionHeading('Algorithm 2: Sublinear TF-IDF and Logistic Regression Triage'));
body.push(createParagraph(
    'Input: Document text T, passage length L_chunk = 1500, threshold theta = 0.5\n' +
    'Output: Boolean is_relevant, confidence score\n' +
    '1: passages = segment_into_paragraphs(T, max_len=L_chunk)\n' +
    '2: prob_list = []\n' +
    '3: for each passage c in passages do\n' +
    '4:     x = vectorize_sublinear_tfidf(c)\n' +
    '5:     p_c = sigmoid(dot(w, x) + b)\n' +
    '6:     append p_c to prob_list\n' +
    '7: end for\n' +
    '8: p_max = max(prob_list)\n' +
    '9: frac = count(prob_list >= 0.5) / length(prob_list)\n' +
    '10: if p_max >= 0.8 or frac >= 0.3 then\n' +
    '11:    return True, max(p_max, frac)\n' +
    '12: else if p_max < 0.4 and frac < 0.1 then\n' +
    '13:    return False, 1.0 - p_max\n' +
    '14: else\n' +
    '15:    return False, p_max (flagged as uncertain)\n' +
    '16: end if',
    false
));

body.push(createSectionHeading('Algorithm 3: Deterministic Verbatim Verification'));
body.push(createParagraph(
    'Input: Extracted dictionary M, raw document text T\n' +
    'Output: List of unverified field names verification_flags\n' +
    '1: T_norm = normalize_lowercase_whitespace(T)\n' +
    '2: verification_flags = []\n' +
    '3: for each factual field f in {title, date, issuing_authority, om_number, supersedes} do\n' +
    '4:     val = M[f]\n' +
    '5:     if val is not null and length(val) > 0 then\n' +
    '6:         val_norm = normalize_lowercase_whitespace(val)\n' +
    '7:         if val_norm is not substring of T_norm then\n' +
    '8:             append f to verification_flags\n' +
    '9:         end if\n' +
    '10:    end if\n' +
    '11: end for\n' +
    '12: return verification_flags',
    false
));

body.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 100 },
    pageBreakBefore: true,
    children: [
        new TextRun({
            text: 'APPENDIX-B',
            bold: true,
            size: 36,
            font: FONT_FAMILY,
            color: '000000'
        })
    ]
}));
body.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 300 },
    children: [
        new TextRun({
            text: 'SYSTEM SCREENSHOTS',
            bold: true,
            size: 32,
            font: FONT_FAMILY,
            color: '000000'
        })
    ]
}));

body.push(createParagraph(
    'Figure B.1 illustrates the DocSort main web dashboard. The interface presents a dropzone for PDF circular ingestion, an active status summary card, and a tabular document registry indicating classification status, confidence score, and verification flags.'
));
body.push(createCaption('Figure B.1: Main Compliance Registry and Dashboard Interface', false));

body.push(createParagraph(
    'Figure B.2 shows the document inspection drawer. Clicking a processed document displays the extracted metadata fields side by side with source verification flags. Discrepancies are highlighted in orange badges, enabling compliance officers to audit the original file without leaving the interface.'
));
body.push(createCaption('Figure B.2: Document Inspection Drawer with Verbatim Verification Flags', false));

body.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 300, after: 100 },
    pageBreakBefore: true,
    children: [
        new TextRun({
            text: 'APPENDIX-C',
            bold: true,
            size: 36,
            font: FONT_FAMILY,
            color: '000000'
        })
    ]
}));
body.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 300 },
    children: [
        new TextRun({
            text: 'ENCLOSURES AND SDG MAPPING',
            bold: true,
            size: 32,
            font: FONT_FAMILY,
            color: '000000'
        })
    ]
}));

body.push(createSectionHeading('Enclosure 1: Research Paper Registration and Draft'));
body.push(createParagraph(
    'Title: DocSort: A Two-Stage Architecture for Regulatory Document Triage and Verifiable Metadata Extraction.\n' +
    'Authors: Keerthan Shetty, S Mohammed Saheem, Tharun H N.\n' +
    'Format: NeurIPS 2017 Conference LaTeX Style.\n' +
    'Status: Complete manuscript ready for submission to academic natural language processing tracks.',
    false
));

body.push(createSectionHeading('Enclosure 2: Plagiarism Check Summary'));
body.push(createParagraph(
    'Similarity Index: Verified within acceptable institutional bounds (< 15 percent overall, excluding mathematical formulas and direct statutory citations).',
    false
));

body.push(createSectionHeading('Enclosure 3: Sustainable Development Goals (SDG) Mapping'));
body.push(createParagraph(
    'In accordance with institutional guidelines (Annexure-II), the DocSort system was mapped to the United Nations Sustainable Development Goals as detailed in Table C.1.'
));

body.push(createCaption('Table C.1: Mapping of DocSort to Sustainable Development Goals', true));
body.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
        new TableRow({
            children: [
                createHeaderCell('SDG Goal', 20),
                createHeaderCell('Title', 25),
                createHeaderCell('Prescribed Domain (Annexure-II)', 25),
                createHeaderCell('DocSort Project Alignment', 30)
            ]
        }),
        new TableRow({
            children: [
                createDataCell('SDG 16', 20, true),
                createDataCell('Peace, Justice and Strong Institutions', 25),
                createDataCell('e-Governance platforms, transparent systems, digital forensics', 25),
                createDataCell('Enforces transparency in public procurement by verifying compliance with CVC and GFR guidelines, creating a tamper-resistant audit trail.', 30)
            ]
        }),
        new TableRow({
            children: [
                createDataCell('SDG 9', 20, true),
                createDataCell('Industry, Innovation and Infrastructure', 25),
                createDataCell('Development of intelligent systems, scalable cloud infrastructure', 25),
                createDataCell('Implements an energy-efficient two-stage NLP triage engine running on standard CPU hardware without costly GPU infrastructure.', 30)
            ]
        }),
        new TableRow({
            children: [
                createDataCell('SDG 12', 20, true),
                createDataCell('Responsible Consumption and Production', 25),
                createDataCell('Supply chain transparency, resource management algorithms', 25),
                createDataCell('Ensures public procurement transactions adhere to mandatory GeM green procurement guidelines and financial threshold rules.', 30)
            ]
        }),
        new TableRow({
            children: [
                createDataCell('SDG 8', 20, true),
                createDataCell('Decent Work and Economic Growth', 25),
                createDataCell('Automation, digital platforms for remote work, upskilling', 25),
                createDataCell('Automates clerical spreadsheet bookkeeping, saving compliance staff over 4 hours per document batch and eliminating contractual disputes.', 30)
            ]
        })
    ]
}));

const doc = new Document({
    sections: [
        {
            properties: {
                page: {
                    pageNumbers: {
                        start: 1,
                        formatType: NumberFormat.DECIMAL
                    }
                }
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({
                                    children: [PageNumber.CURRENT],
                                    font: FONT_FAMILY,
                                    size: 20
                                })
                            ]
                        })
                    ]
                })
            },
            children: body
        }
    ]
});

Packer.toBuffer(doc).then(buffer => {
    const outPath = path.join(__dirname, 'PART-C_CONTENT.docx');
    fs.writeFileSync(outPath, buffer);
    console.log('PART-C_CONTENT.docx successfully generated at', outPath, `(${buffer.length} bytes)`);
}).catch(err => {
    console.error('Error generating PART-C_CONTENT.docx:', err);
    process.exit(1);
});
