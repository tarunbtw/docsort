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
	Status              string     `json:"status"` // pending, processing, processed, not_relevant, error
	RelevanceConfidence float64    `json:"relevanceConfidence"`
	ComplianceStatus    string     `json:"compliance"` // Compliant, Needs Review, Contradiction
	ComplianceScore     int        `json:"complianceScore"`
	ErrorMessage        string     `json:"errorMessage,omitempty"`
	UploadedAt          time.Time  `json:"uploadedAt"`
	ProcessedAt         *time.Time `json:"processedAt,omitempty"`
}

type DocumentMetadata struct {
	DocumentID        string   `json:"documentId"`
	Title             string   `json:"title"`
	IssueDate         string   `json:"date"`
	IssuingAuthority  string   `json:"issuingAuthority"`
	OMNumber          string   `json:"omNumber"`
	Categories        []string `json:"categories"`
	Supersedes        *string  `json:"supersedes,omitempty"`
	Summary           string   `json:"summary"`
	VerificationFlags []string `json:"verificationFlags"`
	RawText           string   `json:"rawText,omitempty"`
}

type DocumentWithMetadata struct {
	Document
	Metadata *DocumentMetadata `json:"metadata,omitempty"`
}

type DocumentListItem struct {
	ID               string    `json:"id"`
	DocNumber        string    `json:"docNumber"`
	Title            string    `json:"title"`
	Category         string    `json:"category"`
	Department       string    `json:"department"`
	ComplianceScore  int       `json:"complianceScore"`
	UploadDate       string    `json:"uploadDate"`
	Validity         string    `json:"validity"`
	Compliance       string    `json:"compliance"`
	FileURL          string    `json:"fileUrl"`
	Status           string    `json:"status"`
}

type KPICard struct {
	Title     string `json:"title"`
	Value     string `json:"value"`
	Label     string `json:"label"`
	Trend     string `json:"trend"`
	Highlight bool   `json:"highlight"`
}

type DashboardStats struct {
	KPIs         []KPICard        `json:"kpis"`
	TotalDocs    int              `json:"totalDocs"`
	Compliant    int              `json:"compliant"`
	NeedsReview  int              `json:"needsReview"`
	Contradicted int              `json:"contradicted"`
	Processing   int              `json:"processing"`
	RecentDocs   []DocumentListItem `json:"recentDocs"`
}
