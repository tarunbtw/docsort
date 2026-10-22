package database

import "time"

type Document struct {
	ID                  string     `json:"id"`
	DocNumber           string     `json:"docNumber"`
	FileName            string     `json:"fileName"`
	FilePath            string     `json:"filePath"`
	FileURL             string     `json:"fileUrl"`
	FileSize            int64      `json:"fileSize"`
	MimeType            string     `json:"mimeType"`
	Status              string     `json:"status"` // processing, processed, not_relevant, uncertain, error
	RelevanceConfidence float64    `json:"relevanceConfidence"`
	ComplianceStatus    string     `json:"compliance"` // Verified, Needs Review, Superseded, Not Procurement
	ComplianceScore     int        `json:"complianceScore"`
	ErrorMessage        string     `json:"errorMessage,omitempty"`
	UploadedAt          time.Time  `json:"uploadedAt"`
	ProcessedAt         *time.Time `json:"processedAt,omitempty"`

	// Processing provenance.
	ExtractionStatus string `json:"extractionStatus,omitempty"` // ok, llm_unavailable, skipped, ""
	LLMProvider      string `json:"llmProvider,omitempty"`
	LLMModel         string `json:"llmModel,omitempty"`

	// Cross-document supersession link (set when a newer document voids this one).
	SupersededBy string `json:"supersededBy,omitempty"`
	SupersededAt string `json:"supersededAt,omitempty"`
}

type DocumentMetadata struct {
	DocumentID          string   `json:"documentId"`
	Title               string   `json:"title"`
	IssueDate           string   `json:"date"`
	IssuingAuthority    string   `json:"issuingAuthority"`
	OMNumber            string   `json:"omNumber"`
	DocType             string   `json:"docType"`
	Categories          []string `json:"categories"`
	Supersedes          *string  `json:"supersedes,omitempty"`
	SupersededDocuments []string `json:"supersededDocuments"`
	Summary             string   `json:"summary"`
	VerificationFlags   []string `json:"verificationFlags"`
	RawText             string   `json:"rawText,omitempty"`
}

type DocumentWithMetadata struct {
	Document
	Metadata *DocumentMetadata `json:"metadata,omitempty"`
}

type DocumentListItem struct {
	ID              string `json:"id"`
	DocNumber       string `json:"docNumber"`
	Title           string `json:"title"`
	Category        string `json:"category"`
	Department      string `json:"department"`
	DocType         string `json:"docType"`
	ComplianceScore int    `json:"complianceScore"`
	UploadDate      string `json:"uploadDate"`
	Validity        string `json:"validity"`
	Compliance      string `json:"compliance"`
	FileURL         string `json:"fileUrl"`
	Status          string `json:"status"`
	SupersededBy    string `json:"supersededBy,omitempty"`
}

type KPICard struct {
	Title     string `json:"title"`
	Value     string `json:"value"`
	Label     string `json:"label"`
	Highlight bool   `json:"highlight"`
}

type DashboardStats struct {
	KPIs           []KPICard          `json:"kpis"`
	TotalDocs      int                `json:"totalDocs"`
	Compliant      int                `json:"compliant"`
	NeedsReview    int                `json:"needsReview"`
	Superseded     int                `json:"superseded"`
	NotProcurement int                `json:"notProcurement"`
	Processing     int                `json:"processing"`
	RecentDocs     []DocumentListItem `json:"recentDocs"`
}
