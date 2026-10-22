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

function createTitle(text) {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 300 },
        children: [
            new TextRun({
                text: text,
                bold: true,
                size: 36, // 18pt
                font: FONT_FAMILY,
                color: '000000'
            })
        ]
    });
}

function createParagraph(text, isJustified = true) {
    return new Paragraph({
        alignment: isJustified ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
        spacing: { line: 360, before: 120, after: 120 }, // 1.5 line spacing
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

function createPageBreak() {
    return new Paragraph({
        pageBreakBefore: true,
        children: []
    });
}

const tableBorders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '888888' },
    left: { style: BorderStyle.NONE },
    right: { style: BorderStyle.NONE },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
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

// 1. ABSTRACT
const abstractParagraphs = [
    createTitle('ABSTRACT'),
    createParagraph(
        'Public procurement in government ministries and public sector enterprises follows statutory rules including the General Financial Rules, Central Vigilance Commission guidelines, and periodic Department of Expenditure notifications. Compliance officers have to continuously monitor public portals to update internal policy registers. Manual tracking across portal circulars is slow and introduces transcription errors on critical reference numbers and effective dates. Passing incoming files directly to large language model APIs is expensive and leads to rate limit failures when processing large document batches. Generative models also occasionally fabricate official memorandum identifiers.'
    ),
    createParagraph(
        'This project presents DocSort, a two-stage document processing engine designed for regulatory document classification and verifiable metadata extraction. In the first stage, a linear classifier based on sublinear term frequency features filters non-procurement administrative circulars in 3.8 milliseconds on standard CPU hardware. In the second stage, relevant documents proceed to an instruction-tuned language model under strict schema constraints and a fixed category vocabulary. A deterministic verification layer confirms that all extracted factual values appear verbatim in the source text, flagging discrepancies for human review without silent modification.'
    ),
    createParagraph(
        'To train the classifier without costly manual annotation, a dataset was constructed from official portals using paragraph-level chunking and weak supervision. Experimental results on real Indian regulatory circulars indicate that early linear filtering eliminates 57% of language model calls, cutting mean document processing latency from 4.2 seconds to 1.9 seconds while preventing API quota exhaustion. The verification check identifies factual discrepancies in approximately 6% of extractions, preserving audit reliability.'
    )
];

// 2. TABLE OF CONTENTS
const tocRows = [
    new TableRow({
        children: [
            createHeaderCell('CHAPTER NO.', 20),
            createHeaderCell('TITLE', 65),
            createHeaderCell('PAGE NO.', 15)
        ]
    }),
    new TableRow({ children: [createDataCell('', 20), createDataCell('ABSTRACT', 65, true), createDataCell('v', 15)] }),
    new TableRow({ children: [createDataCell('', 20), createDataCell('TABLE OF CONTENTS', 65, true), createDataCell('vi', 15)] }),
    new TableRow({ children: [createDataCell('', 20), createDataCell('LIST OF FIGURES', 65, true), createDataCell('viii', 15)] }),
    new TableRow({ children: [createDataCell('', 20), createDataCell('LIST OF TABLES', 65, true), createDataCell('ix', 15)] }),
    new TableRow({ children: [createDataCell('', 20), createDataCell('LIST OF ABBREVIATIONS', 65, true), createDataCell('x', 15)] }),
    new TableRow({ children: [createDataCell('1', 20, true), createDataCell('INTRODUCTION', 65, true), createDataCell('1', 15)] }),
    new TableRow({ children: [createDataCell('1.1', 20), createDataCell('Background and Regulatory Environment', 65), createDataCell('1', 15)] }),
    new TableRow({ children: [createDataCell('1.2', 20), createDataCell('Problem Statement', 65), createDataCell('2', 15)] }),
    new TableRow({ children: [createDataCell('1.3', 20), createDataCell('Scope and Limitations', 65), createDataCell('3', 15)] }),
    new TableRow({ children: [createDataCell('1.4', 20), createDataCell('Methodology Overview', 65), createDataCell('4', 15)] }),
    new TableRow({ children: [createDataCell('1.5', 20), createDataCell('Organization of the Report', 65), createDataCell('5', 15)] }),
    new TableRow({ children: [createDataCell('2', 20, true), createDataCell('LITERATURE SURVEY', 65, true), createDataCell('6', 15)] }),
    new TableRow({ children: [createDataCell('2.1', 20), createDataCell('Manual Regulatory Compliance Tracking', 65), createDataCell('6', 15)] }),
    new TableRow({ children: [createDataCell('2.2', 20), createDataCell('Portal Keyword and Boolean Search', 65), createDataCell('7', 15)] }),
    new TableRow({ children: [createDataCell('2.3', 20), createDataCell('Pre-trained Transformer Encoders in Legal NLP', 65), createDataCell('8', 15)] }),
    new TableRow({ children: [createDataCell('2.4', 20), createDataCell('Large Language Models for Information Extraction', 65), createDataCell('9', 15)] }),
    new TableRow({ children: [createDataCell('3', 20, true), createDataCell('RESEARCH GAPS OF EXISTING METHODS', 65, true), createDataCell('11', 15)] }),
    new TableRow({ children: [createDataCell('3.1', 20), createDataCell('High Cost and Token Bottlenecks in End-to-End LLMs', 65), createDataCell('11', 15)] }),
    new TableRow({ children: [createDataCell('3.2', 20), createDataCell('Factual Hallucination and Category Drift', 65), createDataCell('12', 15)] }),
    new TableRow({ children: [createDataCell('3.3', 20), createDataCell('Scarcity of Annotated Public Procurement Datasets', 65), createDataCell('13', 15)] }),
    new TableRow({ children: [createDataCell('4', 20, true), createDataCell('PROPOSED METHODOLOGY', 65, true), createDataCell('14', 15)] }),
    new TableRow({ children: [createDataCell('4.1', 20), createDataCell('Document Ingestion and Scanned File Detection', 65), createDataCell('14', 15)] }),
    new TableRow({ children: [createDataCell('4.2', 20), createDataCell('Stage 1: Linear Pre-Filtering with Sublinear TF-IDF', 65), createDataCell('15', 15)] }),
    new TableRow({ children: [createDataCell('4.3', 20), createDataCell('Stage 2: Constrained Metadata Extraction', 65), createDataCell('17', 15)] }),
    new TableRow({ children: [createDataCell('4.4', 20), createDataCell('Stage 3: Deterministic Verbatim Verification', 65), createDataCell('19', 15)] }),
    new TableRow({ children: [createDataCell('4.5', 20), createDataCell('Weak Supervision Dataset Construction', 65), createDataCell('20', 15)] }),
    new TableRow({ children: [createDataCell('5', 20, true), createDataCell('OBJECTIVES', 65, true), createDataCell('23', 15)] }),
    new TableRow({ children: [createDataCell('6', 20, true), createDataCell('SYSTEM DESIGN AND IMPLEMENTATION', 65, true), createDataCell('24', 15)] }),
    new TableRow({ children: [createDataCell('6.1', 20), createDataCell('Architecture and Component Communication', 65), createDataCell('24', 15)] }),
    new TableRow({ children: [createDataCell('6.2', 20), createDataCell('Python Machine Learning Engine Module', 65), createDataCell('26', 15)] }),
    new TableRow({ children: [createDataCell('6.3', 20), createDataCell('Go Microservice Backend Module', 65), createDataCell('28', 15)] }),
    new TableRow({ children: [createDataCell('6.4', 20), createDataCell('React User Interface Module', 65), createDataCell('29', 15)] }),
    new TableRow({ children: [createDataCell('6.5', 20), createDataCell('Database Schema and Storage', 65), createDataCell('30', 15)] }),
    new TableRow({ children: [createDataCell('7', 20, true), createDataCell('TIMELINE FOR EXECUTION OF PROJECT (GANTT CHART)', 65, true), createDataCell('32', 15)] }),
    new TableRow({ children: [createDataCell('8', 20, true), createDataCell('OUTCOMES', 65, true), createDataCell('34', 15)] }),
    new TableRow({ children: [createDataCell('9', 20, true), createDataCell('RESULTS AND DISCUSSIONS', 65, true), createDataCell('35', 15)] }),
    new TableRow({ children: [createDataCell('9.1', 20), createDataCell('Stage 1 Relevance Classification Evaluation', 65), createDataCell('35', 15)] }),
    new TableRow({ children: [createDataCell('9.2', 20), createDataCell('System Latency and Token Resource Savings', 65), createDataCell('37', 15)] }),
    new TableRow({ children: [createDataCell('9.3', 20), createDataCell('Verbatim Verification Audit Analysis', 65), createDataCell('38', 15)] }),
    new TableRow({ children: [createDataCell('9.4', 20), createDataCell('Taxonomy Compliance Evaluation', 65), createDataCell('39', 15)] }),
    new TableRow({ children: [createDataCell('', 20), createDataCell('CONCLUSION AND FUTURE WORK', 65, true), createDataCell('41', 15)] }),
    new TableRow({ children: [createDataCell('', 20), createDataCell('REFERENCES', 65, true), createDataCell('43', 15)] }),
    new TableRow({ children: [createDataCell('', 20), createDataCell('APPENDIX-A: PSEUDOCODE', 65, true), createDataCell('45', 15)] }),
    new TableRow({ children: [createDataCell('', 20), createDataCell('APPENDIX-B: SYSTEM SCREENSHOTS', 65, true), createDataCell('47', 15)] }),
    new TableRow({ children: [createDataCell('', 20), createDataCell('APPENDIX-C: ENCLOSURES (SDG MAPPING)', 65, true), createDataCell('50', 15)] })
];

const tocTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tocRows
});

// 3. LIST OF FIGURES
const figureRows = [
    new TableRow({
        children: [
            createHeaderCell('SL. NO.', 15),
            createHeaderCell('FIGURE NAME', 25),
            createHeaderCell('CAPTION', 45),
            createHeaderCell('PAGE NO.', 15)
        ]
    }),
    new TableRow({ children: [createDataCell('1', 15), createDataCell('Figure 1.1', 25), createDataCell('Indian Public Procurement Document Distribution', 45), createDataCell('2', 15)] }),
    new TableRow({ children: [createDataCell('2', 15), createDataCell('Figure 4.1', 25), createDataCell('DocSort System Architecture Pipeline', 45), createDataCell('15', 15)] }),
    new TableRow({ children: [createDataCell('3', 15), createDataCell('Figure 4.2', 25), createDataCell('Weak Supervision and Chunking Workflow', 45), createDataCell('21', 15)] }),
    new TableRow({ children: [createDataCell('4', 15), createDataCell('Figure 6.1', 25), createDataCell('Full-Stack Multi-Service Architecture', 45), createDataCell('25', 15)] }),
    new TableRow({ children: [createDataCell('5', 15), createDataCell('Figure 6.2', 25), createDataCell('FastAPI Engine Request Handling Pipeline', 45), createDataCell('27', 15)] }),
    new TableRow({ children: [createDataCell('6', 15), createDataCell('Figure 9.1', 25), createDataCell('Processing Latency Comparison Across 100 Documents', 45), createDataCell('38', 15)] }),
    new TableRow({ children: [createDataCell('7', 15), createDataCell('Figure 9.2', 25), createDataCell('Field-wise Verification Pass Rate Distribution', 45), createDataCell('40', 15)] })
];

const figureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: figureRows
});

// 4. LIST OF TABLES
const tableRows = [
    new TableRow({
        children: [
            createHeaderCell('SL. NO.', 15),
            createHeaderCell('TABLE NAME', 25),
            createHeaderCell('CAPTION', 45),
            createHeaderCell('PAGE NO.', 15)
        ]
    }),
    new TableRow({ children: [createDataCell('1', 15), createDataCell('Table 1.1', 25), createDataCell('Comparison of Existing Methods with DocSort', 45), createDataCell('3', 15)] }),
    new TableRow({ children: [createDataCell('2', 15), createDataCell('Table 4.1', 25), createDataCell('Closed Category Taxonomy Vocabulary', 45), createDataCell('18', 15)] }),
    new TableRow({ children: [createDataCell('3', 15), createDataCell('Table 5.1', 25), createDataCell('Target Quantitative Performance Metrics', 45), createDataCell('23', 15)] }),
    new TableRow({ children: [createDataCell('4', 15), createDataCell('Table 7.1', 25), createDataCell('Project Execution Timeline and Work Phases', 45), createDataCell('33', 15)] }),
    new TableRow({ children: [createDataCell('5', 15), createDataCell('Table 9.1', 25), createDataCell('Stage 1 Relevance Classification Results', 45), createDataCell('36', 15)] }),
    new TableRow({ children: [createDataCell('6', 15), createDataCell('Table 9.2', 25), createDataCell('System Latency and Token Usage on 100 Documents', 45), createDataCell('37', 15)] }),
    new TableRow({ children: [createDataCell('7', 15), createDataCell('Table 9.3', 25), createDataCell('Verbatim Verification Results Across Factual Fields', 45), createDataCell('39', 15)] }),
    new TableRow({ children: [createDataCell('8', 15), createDataCell('Table 9.4', 25), createDataCell('Category Taxonomy Adherence Comparison', 45), createDataCell('40', 15)] })
];

const tableTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows
});

// 5. ABBREVIATIONS
const abbrRows = [
    new TableRow({
        children: [
            createHeaderCell('ABBREVIATION', 35),
            createHeaderCell('FULL FORM', 65)
        ]
    }),
    new TableRow({ children: [createDataCell('API', 35, true), createDataCell('Application Programming Interface', 65)] }),
    new TableRow({ children: [createDataCell('CPSE', 35, true), createDataCell('Central Public Sector Enterprise', 65)] }),
    new TableRow({ children: [createDataCell('CPU', 35, true), createDataCell('Central Processing Unit', 65)] }),
    new TableRow({ children: [createDataCell('CVC', 35, true), createDataCell('Central Vigilance Commission', 65)] }),
    new TableRow({ children: [createDataCell('DoE', 35, true), createDataCell('Department of Expenditure', 65)] }),
    new TableRow({ children: [createDataCell('DoPT', 35, true), createDataCell('Department of Personnel and Training', 65)] }),
    new TableRow({ children: [createDataCell('EMD', 35, true), createDataCell('Earnest Money Deposit', 65)] }),
    new TableRow({ children: [createDataCell('GeM', 35, true), createDataCell('Government e-Marketplace', 65)] }),
    new TableRow({ children: [createDataCell('GFR', 35, true), createDataCell('General Financial Rules', 65)] }),
    new TableRow({ children: [createDataCell('GPU', 35, true), createDataCell('Graphics Processing Unit', 65)] }),
    new TableRow({ children: [createDataCell('IDF', 35, true), createDataCell('Inverse Document Frequency', 65)] }),
    new TableRow({ children: [createDataCell('JSON', 35, true), createDataCell('JavaScript Object Notation', 65)] }),
    new TableRow({ children: [createDataCell('LF', 35, true), createDataCell('Labeling Function', 65)] }),
    new TableRow({ children: [createDataCell('LLM', 35, true), createDataCell('Large Language Model', 65)] }),
    new TableRow({ children: [createDataCell('LR', 35, true), createDataCell('Logistic Regression', 65)] }),
    new TableRow({ children: [createDataCell('MSME', 35, true), createDataCell('Micro, Small and Medium Enterprises', 65)] }),
    new TableRow({ children: [createDataCell('NER', 35, true), createDataCell('Named Entity Recognition', 65)] }),
    new TableRow({ children: [createDataCell('NLP', 35, true), createDataCell('Natural Language Processing', 65)] }),
    new TableRow({ children: [createDataCell('OCR', 35, true), createDataCell('Optical Character Recognition', 65)] }),
    new TableRow({ children: [createDataCell('OM', 35, true), createDataCell('Office Memorandum', 65)] }),
    new TableRow({ children: [createDataCell('PDF', 35, true), createDataCell('Portable Document Format', 65)] }),
    new TableRow({ children: [createDataCell('PFMS', 35, true), createDataCell('Public Financial Management System', 65)] }),
    new TableRow({ children: [createDataCell('PPD', 35, true), createDataCell('Procurement Policy Division', 65)] }),
    new TableRow({ children: [createDataCell('PSU', 35, true), createDataCell('Public Sector Undertaking', 65)] }),
    new TableRow({ children: [createDataCell('REST', 35, true), createDataCell('Representational State Transfer', 65)] }),
    new TableRow({ children: [createDataCell('SDG', 35, true), createDataCell('Sustainable Development Goal', 65)] }),
    new TableRow({ children: [createDataCell('TF', 35, true), createDataCell('Term Frequency', 65)] }),
    new TableRow({ children: [createDataCell('TF-IDF', 35, true), createDataCell('Term Frequency-Inverse Document Frequency', 65)] }),
    new TableRow({ children: [createDataCell('TPM', 35, true), createDataCell('Tokens Per Minute', 65)] }),
    new TableRow({ children: [createDataCell('UGC', 35, true), createDataCell('University Grants Commission', 65)] }),
    new TableRow({ children: [createDataCell('UI', 35, true), createDataCell('User Interface', 65)] })
];

const abbrTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: abbrRows
});

const doc = new Document({
    sections: [
        {
            properties: {
                page: {
                    pageNumbers: {
                        start: 5,
                        formatType: NumberFormat.LOWER_ROMAN
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
            children: [
                ...abstractParagraphs,
                createPageBreak(),
                createTitle('TABLE OF CONTENTS'),
                tocTable,
                createPageBreak(),
                createTitle('LIST OF FIGURES'),
                figureTable,
                createPageBreak(),
                createTitle('LIST OF TABLES'),
                tableTable,
                createPageBreak(),
                createTitle('LIST OF ABBREVIATIONS'),
                abbrTable
            ]
        }
    ]
});

Packer.toBuffer(doc).then(buffer => {
    const outPath = path.join(__dirname, 'PART-B.docx');
    fs.writeFileSync(outPath, buffer);
    console.log('PART-B.docx successfully generated at', outPath, `(${buffer.length} bytes)`);
}).catch(err => {
    console.error('Error generating PART-B.docx:', err);
    process.exit(1);
});
