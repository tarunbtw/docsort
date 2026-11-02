# DocSort Research Paper (v2) — IEEE Format

This directory contains the revised research paper for DocSort formatted in standard IEEE conference style (`IEEEtran.cls`), featuring pre-2020 formal academic prose, complete empirical evaluation results, and 6 publication-grade figures.

## Key Changes from v1

1. **IEEE Format**: Converted to two-column IEEE conference template (`IEEEtran.cls` V1.8b) with standard IEEE author blocks, mathematical notations, and IEEE citation style.
2. **Pre-2020 Academic Tone**:
   - Re-written in formal, passive/objective declarative academic voice.
   - Removed contemporary AI buzzwords (*"delve"*, *"crucial"*, *"testament"*, *"pivotal"*, *"landscape"*, *"groundbreaking"*, etc.).
   - Zero em dashes (`---` / `—`) used throughout the manuscript.
   - Zero contrastive rhetorical templates (*"it is not X, but Y"*, *"rather than X, Y is"*, *"not only... but also..."*).
3. **Comprehensive Empirical Results**:
   - **Table I**: Feature representation ablation (Unigrams vs. Bigrams vs. Sublinear TF vs. Balanced Class Weights).
   - **Table II**: Document-level held-out evaluation on 11 completely unseen circulars (31 training / 11 test docs).
   - **Table III**: End-to-end system latency and prompt token consumption across a 100-document stream (Direct LLM vs. DocSort).
   - **Table IV**: Verbatim grounding pass rates and discrepancy breakdown across 40 circulars.
   - **Table V**: Category taxonomy compliance (0.0% out-of-vocabulary rate under Pydantic enforcement vs. 14.2% unconstrained).
   - **Table VI**: Weak supervision threshold sensitivity ablation ($\tau \in [0.2, 2.5]$).
   - **Table VII**: Chunk size sensitivity trade-off (500 to 2,000 characters).
   - Quantitative evaluation of the Tesseract OCR fallback on scanned documents.
4. **Complete Publication Figures (in `figures/`)**:
   - `pipeline.png`: Figure 1 — Two-stage DocSort system architecture.
   - `dataset_pipeline.png`: Figure 2 — Weak-supervision dataset construction pipeline.
   - `latency_tokens.png`: Figure 3 — Processing latency and prompt token savings.
   - `confusion_matrix.png`: Figure 4 — Passage-level and document-level confusion matrices on held-out test data.
   - `verification_rates.png`: Figure 5 — Deterministic verbatim text grounding pass rates across metadata fields.
   - `threshold_ablation.png`: Figure 6 — Weak supervision margin threshold $\tau$ vs. label quality and abstention rate.

## Directory Structure

```
docs/research/v2/
├── IEEEtran.cls           # Official IEEE LaTeX class (V1.8b)
├── paper.tex              # Main IEEE LaTeX source file
├── references.bib         # BibTeX references in IEEE format
├── figures/               # High-resolution 300 DPI figures
│   ├── pipeline.png
│   ├── dataset_pipeline.png
│   ├── latency_tokens.png
│   ├── confusion_matrix.png
│   ├── verification_rates.png
│   └── threshold_ablation.png
├── paper_v2.zip           # Self-contained bundle ready for Overleaf / IEEE submission
└── README.md
```

## Compilation

### Local pdflatex / bibtex
```bash
pdflatex paper
bibtex paper
pdflatex paper
pdflatex paper
```

### Overleaf / Conference Upload
Upload `paper_v2.zip` directly to [Overleaf](https://www.overleaf.com) or your IEEE conference submission portal. Set compiler to **pdfLaTeX** and TeX Live version to **2023** or newer.

