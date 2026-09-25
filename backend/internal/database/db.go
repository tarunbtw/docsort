package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"
)

type DB struct {
	conn   *sql.DB
	driver string
}

func Connect(dbURL string) (*DB, error) {
	var conn *sql.DB
	var err error
	var driver string

	if dbURL != "" && (strings.HasPrefix(dbURL, "postgres://") || strings.HasPrefix(dbURL, "postgresql://")) {
		log.Println("Connecting to Supabase PostgreSQL...")
		driver = "pgx"
		conn, err = sql.Open("pgx", dbURL)
	} else {
		driver = "sqlite"
		dbPath := "./storage/docsort.db"
		if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
			return nil, fmt.Errorf("failed to create storage dir: %w", err)
		}
		log.Printf("Using persistent local SQLite database at %s...", dbPath)
		conn, err = sql.Open("sqlite", dbPath)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := conn.Ping(); err != nil {
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	db := &DB{conn: conn, driver: driver}
	if err := db.migrate(); err != nil {
		return nil, fmt.Errorf("schema migration failed: %w", err)
	}

	return db, nil
}

func (db *DB) Close() error {
	return db.conn.Close()
}

func (db *DB) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS documents (
		id TEXT PRIMARY KEY,
		doc_number TEXT UNIQUE NOT NULL,
		file_name TEXT NOT NULL,
		file_path TEXT NOT NULL,
		file_url TEXT NOT NULL,
		file_size INTEGER NOT NULL,
		mime_type TEXT DEFAULT 'application/pdf',
		status TEXT NOT NULL,
		relevance_confidence REAL DEFAULT 0.0,
		compliance_status TEXT DEFAULT 'Compliant',
		compliance_score INTEGER DEFAULT 100,
		error_message TEXT,
		uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		processed_at DATETIME
	);

	CREATE TABLE IF NOT EXISTS document_metadata (
		document_id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		issue_date TEXT,
		issuing_authority TEXT,
		om_number TEXT,
		categories TEXT DEFAULT '[]',
		supersedes TEXT,
		summary TEXT,
		verification_flags TEXT DEFAULT '[]',
		raw_text TEXT,
		FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS departments (
		id TEXT PRIMARY KEY,
		name TEXT UNIQUE NOT NULL,
		head TEXT,
		doc_count INTEGER DEFAULT 0
	);
	`

	_, err := db.conn.Exec(schema)
	return err
}

func (db *DB) CreateDocument(doc *Document) error {
	query := `
	INSERT INTO documents (
		id, doc_number, file_name, file_path, file_url, file_size, mime_type,
		status, relevance_confidence, compliance_status, compliance_score,
		error_message, uploaded_at, processed_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	if db.driver == "pgx" {
		query = `
		INSERT INTO documents (
			id, doc_number, file_name, file_path, file_url, file_size, mime_type,
			status, relevance_confidence, compliance_status, compliance_score,
			error_message, uploaded_at, processed_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		`
	}

	_, err := db.conn.Exec(
		query,
		doc.ID, doc.DocNumber, doc.FileName, doc.FilePath, doc.FileURL, doc.FileSize, doc.MimeType,
		doc.Status, doc.RelevanceConfidence, doc.ComplianceStatus, doc.ComplianceScore,
		doc.ErrorMessage, doc.UploadedAt, doc.ProcessedAt,
	)
	return err
}

func (db *DB) UpdateDocumentStatus(id string, status string, confidence float64, complianceStatus string, complianceScore int, errMsg string) error {
	now := time.Now()
	query := `
	UPDATE documents 
	SET status = ?, relevance_confidence = ?, compliance_status = ?, compliance_score = ?, error_message = ?, processed_at = ?
	WHERE id = ?
	`
	if db.driver == "pgx" {
		query = `
		UPDATE documents 
		SET status = $1, relevance_confidence = $2, compliance_status = $3, compliance_score = $4, error_message = $5, processed_at = $6
		WHERE id = $7
		`
	}

	_, err := db.conn.Exec(query, status, confidence, complianceStatus, complianceScore, errMsg, now, id)
	return err
}

func (db *DB) SaveMetadata(meta *DocumentMetadata) error {
	catBytes, _ := json.Marshal(meta.Categories)
	flagsBytes, _ := json.Marshal(meta.VerificationFlags)

	query := `
	INSERT INTO document_metadata (
		document_id, title, issue_date, issuing_authority, om_number,
		categories, supersedes, summary, verification_flags, raw_text
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(document_id) DO UPDATE SET
		title=excluded.title,
		issue_date=excluded.issue_date,
		issuing_authority=excluded.issuing_authority,
		om_number=excluded.om_number,
		categories=excluded.categories,
		supersedes=excluded.supersedes,
		summary=excluded.summary,
		verification_flags=excluded.verification_flags,
		raw_text=excluded.raw_text
	`
	if db.driver == "pgx" {
		query = `
		INSERT INTO document_metadata (
			document_id, title, issue_date, issuing_authority, om_number,
			categories, supersedes, summary, verification_flags, raw_text
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT(document_id) DO UPDATE SET
			title=EXCLUDED.title,
			issue_date=EXCLUDED.issue_date,
			issuing_authority=EXCLUDED.issuing_authority,
			om_number=EXCLUDED.om_number,
			categories=EXCLUDED.categories,
			supersedes=EXCLUDED.supersedes,
			summary=EXCLUDED.summary,
			verification_flags=EXCLUDED.verification_flags,
			raw_text=EXCLUDED.raw_text
		`
	}

	_, err := db.conn.Exec(
		query,
		meta.DocumentID, meta.Title, meta.IssueDate, meta.IssuingAuthority, meta.OMNumber,
		string(catBytes), meta.Supersedes, meta.Summary, string(flagsBytes), meta.RawText,
	)
	return err
}

func (db *DB) GetDocument(id string) (*DocumentWithMetadata, error) {
	query := `
	SELECT 
		d.id, d.doc_number, d.file_name, d.file_path, d.file_url, d.file_size, d.mime_type,
		d.status, d.relevance_confidence, d.compliance_status, d.compliance_score, d.error_message,
		d.uploaded_at, d.processed_at,
		m.title, m.issue_date, m.issuing_authority, m.om_number, m.categories, m.supersedes, m.summary, m.verification_flags, m.raw_text
	FROM documents d
	LEFT JOIN document_metadata m ON d.id = m.document_id
	WHERE d.id = ?
	`
	if db.driver == "pgx" {
		query = strings.Replace(query, "?", "$1", 1)
	}

	row := db.conn.QueryRow(query, id)

	var doc DocumentWithMetadata
	var meta DocumentMetadata
	var categoriesStr, flagsStr sql.NullString
	var title, issueDate, authority, omNum, supersedes, summary, rawText sql.NullString
	var errMsg sql.NullString
	var processedAt sql.NullTime

	err := row.Scan(
		&doc.ID, &doc.DocNumber, &doc.FileName, &doc.FilePath, &doc.FileURL, &doc.FileSize, &doc.MimeType,
		&doc.Status, &doc.RelevanceConfidence, &doc.ComplianceStatus, &doc.ComplianceScore, &errMsg,
		&doc.UploadedAt, &processedAt,
		&title, &issueDate, &authority, &omNum, &categoriesStr, &supersedes, &summary, &flagsStr, &rawText,
	)
	if err != nil {
		return nil, err
	}

	if errMsg.Valid {
		doc.ErrorMessage = errMsg.String
	}
	if processedAt.Valid {
		doc.ProcessedAt = &processedAt.Time
	}

	if title.Valid {
		meta.DocumentID = doc.ID
		meta.Title = title.String
		meta.IssueDate = issueDate.String
		meta.IssuingAuthority = authority.String
		meta.OMNumber = omNum.String
		if supersedes.Valid {
			meta.Supersedes = &supersedes.String
		}
		meta.Summary = summary.String
		meta.RawText = rawText.String

		if categoriesStr.Valid {
			_ = json.Unmarshal([]byte(categoriesStr.String), &meta.Categories)
		}
		if flagsStr.Valid {
			_ = json.Unmarshal([]byte(flagsStr.String), &meta.VerificationFlags)
		}
		doc.Metadata = &meta
	}

	return &doc, nil
}

func (db *DB) ListDocuments(search, category, status string) ([]DocumentListItem, error) {
	query := `
	SELECT 
		d.id, d.doc_number, COALESCE(m.title, d.file_name) as title,
		COALESCE(m.categories, '[]') as categories,
		COALESCE(m.issuing_authority, 'Procurement') as department,
		d.compliance_score, d.uploaded_at, d.compliance_status, d.file_url, d.status
	FROM documents d
	LEFT JOIN document_metadata m ON d.id = m.document_id
	ORDER BY d.uploaded_at DESC
	`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []DocumentListItem
	for rows.Next() {
		var item DocumentListItem
		var categoriesStr string
		var uploadedAt time.Time
		if err := rows.Scan(
			&item.ID, &item.DocNumber, &item.Title, &categoriesStr,
			&item.Department, &item.ComplianceScore, &uploadedAt,
			&item.Compliance, &item.FileURL, &item.Status,
		); err != nil {
			return nil, err
		}

		var cats []string
		_ = json.Unmarshal([]byte(categoriesStr), &cats)
		if len(cats) > 0 {
			item.Category = cats[0]
		} else {
			item.Category = "General Notice"
		}

		item.UploadDate = formatRelativeTime(uploadedAt)
		item.Validity = "Active"
		if item.ComplianceScore < 50 {
			item.Validity = "Needs Review"
		}

		items = append(items, item)
	}

	return items, nil
}

func (db *DB) DeleteDocument(id string) (string, error) {
	var filePath string
	querySelect := "SELECT file_path FROM documents WHERE id = ?"
	queryDelete := "DELETE FROM documents WHERE id = ?"
	if db.driver == "pgx" {
		querySelect = "SELECT file_path FROM documents WHERE id = $1"
		queryDelete = "DELETE FROM documents WHERE id = $1"
	}

	row := db.conn.QueryRow(querySelect, id)
	_ = row.Scan(&filePath)

	_, err := db.conn.Exec(queryDelete, id)
	return filePath, err
}

func (db *DB) GetDashboardStats() (*DashboardStats, error) {
	stats := &DashboardStats{
		KPIs: []KPICard{},
	}

	row := db.conn.QueryRow(`
		SELECT 
			COUNT(*),
			COALESCE(SUM(CASE WHEN compliance_status = 'Compliant' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN compliance_status = 'Needs Review' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN compliance_status = 'Contradiction' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0)
		FROM documents
	`)
	_ = row.Scan(&stats.TotalDocs, &stats.Compliant, &stats.NeedsReview, &stats.Contradicted, &stats.Processing)

	stats.KPIs = []KPICard{
		{Title: "Total Docs", Value: fmt.Sprintf("%d", stats.TotalDocs), Label: "All uploaded", Trend: "+10.5%", Highlight: false},
		{Title: "Compliant", Value: fmt.Sprintf("%d", stats.Compliant), Label: "Auto-approved", Trend: "+35.9%", Highlight: true},
		{Title: "Pending Review", Value: fmt.Sprintf("%d", stats.NeedsReview), Label: "Awaiting checks", Trend: "+20.5%", Highlight: false},
		{Title: "Contradictions", Value: fmt.Sprintf("%d", stats.Contradicted), Label: "Flagged policies", Trend: "-10.2%", Highlight: false},
		{Title: "Processing", Value: fmt.Sprintf("%d", stats.Processing), Label: "Under AI review", Trend: "+15.2%", Highlight: false},
	}

	recent, err := db.ListDocuments("", "", "")
	if err == nil {
		if len(recent) > 6 {
			stats.RecentDocs = recent[:6]
		} else {
			stats.RecentDocs = recent
		}
	}

	return stats, nil
}

func formatRelativeTime(t time.Time) string {
	diff := time.Since(t)
	if diff < time.Minute {
		return "Just now"
	}
	if diff < time.Hour {
		mins := int(diff.Minutes())
		return fmt.Sprintf("%d min ago", mins)
	}
	if diff < 24*time.Hour {
		hrs := int(diff.Hours())
		if hrs == 1 {
			return "1 hr ago"
		}
		return fmt.Sprintf("%d hrs ago", hrs)
	}
	if diff < 48*time.Hour {
		return "Yesterday"
	}
	return t.Format("02 Jan 2006")
}
