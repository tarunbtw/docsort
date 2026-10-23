# DocSort Research Paper (v1)

This directory contains the camera-ready / conference submission package for the DocSort research paper, formatted in standard NeurIPS style.

## Directory Structure

```
docs/research/v1/
├── paper.tex              # Main LaTeX source
├── references.bib         # BibTeX references
├── neurips_2017.sty       # NeurIPS conference style file
├── nips_2017.sty          # Compatibility style file
├── figures/               # Pipeline and workflow diagrams
│   ├── pipeline.png       # Figure 1: Two-stage DocSort pipeline
│   └── dataset_pipeline.png # Figure 2: Weak supervision data construction
├── paper_v1.zip           # Self-contained bundle ready for Overleaf / CMT upload
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

### latexmk
```bash
latexmk -pdf paper.tex
```

### Overleaf / Conference Portals
1. Upload `paper_v1.zip` directly to [Overleaf](https://www.overleaf.com) or your conference portal (e.g. OpenReview / CMT).
2. Set compiler to `pdfLaTeX` and TeX Live version to 2023 or newer.
