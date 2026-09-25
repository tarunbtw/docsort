# DocSort Research Paper

This directory contains the LaTeX source and bibliography for the DocSort research paper, formatted in the NeurIPS format (the style used by *Attention Is All You Need*).

## Files

- `paper.tex`: Main LaTeX source file.
- `neurips_2017.sty`: NeurIPS 2017 conference style package.
- `references.bib`: BibTeX bibliography file.
- `images.md`: Exact generation prompts for Excalidraw / Eraser-style diagrams.
- `figures/`: Destination folder for generated figures (`pipeline.png`, `dataset_pipeline.png`).

## Compilation

To compile locally using `pdflatex` and `bibtex`:

```bash
pdflatex paper
bibtex paper
pdflatex paper
pdflatex paper
```

Or using `latexmk`:

```bash
latexmk -pdf paper.tex
```

## Overleaf

Upload the contents of `docs/` (`paper.tex`, `neurips_2017.sty`, and `references.bib`) directly to an Overleaf project and select the `pdfLaTeX` compiler.
