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

// rebind rewrites '?' placeholders as $1..$n for Postgres, leaving SQLite alone.
func (db *DB) rebind(query string) string {
	if db.driver != "pgx" {
		return query
	}
	var b strings.Builder
	n := 0
	for _, r := range query {
		if r == '?' {
			n++
			fmt.Fprintf(&b, "$%d", n)
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// ensureColumn adds a column if it is missing. SQLite has no
// "ADD COLUMN IF NOT EXISTS", so the duplicate-column error is tolerated.
func (db *DB) ensureColumn(table, column, decl string) error {
	_, err := db.conn.Exec(fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, decl))
	if err != nil {
		msg := strings.ToLower(err.Error())
		if strings.Contains(msg, "duplicate column") || strings.Contains(msg, "already exists") {
			return nil
		}
		return fmt.Errorf("adding column %s.%s: %w", table, column, err)
	}
	return nil
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
		compliance_status TEXT DEFAULT 'Verified',
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

	CREATE TABLE IF NOT EXISTS document_audit (
		id TEXT PRIMARY KEY,
		document_id TEXT NOT NULL,
		action TEXT NOT NULL,
		actor TEXT,
		detail TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`

	if _, err := db.conn.Exec(schema); err != nil {
		return err
	}

	// Progressive columns for databases created before these fields existed.
	columns := []struct{ table, column, decl string }{
		{"documents", "extraction_status", "TEXT DEFAULT ''"},
		{"documents", "llm_provider", "TEXT DEFAULT ''"},
		{"documents", "llm_model", "TEXT DEFAULT ''"},
		{"documents", "superseded_by", "TEXT DEFAULT ''"},
		{"documents", "superseded_at", "TEXT DEFAULT ''"},
		{"document_metadata", "doc_type", "TEXT DEFAULT ''"},
		{"document_metadata", "superseded_documents", "TEXT DEFAULT '[]'"},
	}
	for _, c := range columns {
		if err := db.ensureColumn(c.table, c.column, c.decl); err != nil {
			return err
		}
	}

	return nil
}

func (db *DB) CreateDocument(doc *Document) error {
	query := db.rebind(`
	INSERT INTO documents (
		id, doc_number, file_name, file_path, file_url, file_size, mime_type,
		status, relevance_confidence, compliance_status, compliance_score,
		error_message, uploaded_at, processed_at,
		extraction_status, llm_provider, llm_model, superseded_by, superseded_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)

	_, err := db.conn.Exec(
		query,
		doc.ID, doc.DocNumber, doc.FileName, doc.FilePath, doc.FileURL, doc.FileSize, doc.MimeType,
		doc.Status, doc.RelevanceConfidence, doc.ComplianceStatus, doc.ComplianceScore,
		doc.ErrorMessage, doc.UploadedAt, doc.ProcessedAt,
		doc.ExtractionStatus, doc.LLMProvider, doc.LLMModel, doc.SupersededBy, doc.SupersededAt,
	)
	return err
}

// StatusUpdate carries everything a processing outcome can change on a document.
type StatusUpdate struct {
	Status           string
	Confidence       float64
	ComplianceStatus string
	ComplianceScore  int
	ErrorMessage     string
	ExtractionStatus string
	LLMProvider      string
	LLMModel         string
}

func (db *DB) UpdateDocumentStatus(id string, u StatusUpdate) error {
	now := time.Now()
	query := db.rebind(`
	UPDATE documents
	SET status = ?, relevance_confidence = ?, compliance_status = ?, compliance_score = ?,
	    error_message = ?, extraction_status = ?, llm_provider = ?, llm_model = ?, processed_at = ?
	WHERE id = ?
	`)

	_, err := db.conn.Exec(
		query,
		u.Status, u.Confidence, u.ComplianceStatus, u.ComplianceScore,
		u.ErrorMessage, u.ExtractionStatus, u.LLMProvider, u.LLMModel, now, id,
	)
	return err
}

// MarkSuperseded records that an earlier document has been voided by a newer one.
func (db *DB) MarkSuperseded(id, supersededBy string) error {
	query := db.rebind(`
	UPDATE documents
	SET superseded_by = ?, superseded_at = ?, compliance_status = 'Superseded'
	WHERE id = ?
	`)
	_, err := db.conn.Exec(query, supersededBy, time.Now().Format(time.RFC3339), id)
	return err
}

func (db *DB) SaveMetadata(meta *DocumentMetadata) error {
	catBytes, _ := json.Marshal(meta.Categories)
	flagsBytes, _ := json.Marshal(meta.VerificationFlags)
	supersededBytes, _ := json.Marshal(meta.SupersededDocuments)

	query := db.rebind(`
	INSERT INTO document_metadata (
		document_id, title, issue_date, issuing_authority, om_number,
		categories, supersedes, summary, verification_flags, raw_text,
		doc_type, superseded_documents
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(document_id) DO UPDATE SET
		title=excluded.title,
		issue_date=excluded.issue_date,
		issuing_authority=excluded.issuing_authority,
		om_number=excluded.om_number,
		categories=excluded.categories,
		supersedes=excluded.supersedes,
		summary=excluded.summary,
		verification_flags=excluded.verification_flags,
		raw_text=excluded.raw_text,
		doc_type=excluded.doc_type,
		superseded_documents=excluded.superseded_documents
	`)

	_, err := db.conn.Exec(
		query,
		meta.DocumentID, meta.Title, meta.IssueDate, meta.IssuingAuthority, meta.OMNumber,
		string(catBytes), meta.Supersedes, meta.Summary, string(flagsBytes), meta.RawText,
		meta.DocType, string(supersededBytes),
	)
	return err
}

func (db *DB) GetDocument(id string) (*DocumentWithMetadata, error) {
	query := db.rebind(`
	SELECT
		d.id, d.doc_number, d.file_name, d.file_path, d.file_url, d.file_size, d.mime_type,
		d.status, d.relevance_confidence, d.compliance_status, d.compliance_score, d.error_message,
		d.uploaded_at, d.processed_at,
		d.extraction_status, d.llm_provider, d.llm_model, d.superseded_by, d.superseded_at,
		m.title, m.issue_date, m.issuing_authority, m.om_number, m.categories, m.supersedes, m.summary,
		m.verification_flags, m.raw_text, m.doc_type, m.superseded_documents
	FROM documents d
	LEFT JOIN document_metadata m ON d.id = m.document_id
	WHERE d.id = ?
	`)

	row := db.conn.QueryRow(query, id)

	var doc DocumentWithMetadata
	var meta DocumentMetadata
	var categoriesStr, flagsStr, supersededStr sql.NullString
	var title, issueDate, authority, omNum, supersedes, summary, rawText, docType sql.NullString
	var errMsg, extractionStatus, llmProvider, llmModel, supersededBy, supersededAt sql.NullString
	var processedAt sql.NullTime

	err := row.Scan(
		&doc.ID, &doc.DocNumber, &doc.FileName, &doc.FilePath, &doc.FileURL, &doc.FileSize, &doc.MimeType,
		&doc.Status, &doc.RelevanceConfidence, &doc.ComplianceStatus, &doc.ComplianceScore, &errMsg,
		&doc.UploadedAt, &processedAt,
		&extractionStatus, &llmProvider, &llmModel, &supersededBy, &supersededAt,
		&title, &issueDate, &authority, &omNum, &categoriesStr, &supersedes, &summary,
		&flagsStr, &rawText, &docType, &supersededStr,
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
	doc.ExtractionStatus = extractionStatus.String
	doc.LLMProvider = llmProvider.String
	doc.LLMModel = llmModel.String
	doc.SupersededBy = supersededBy.String
	doc.SupersededAt = supersededAt.String

	if title.Valid {
		meta.DocumentID = doc.ID
		meta.Title = title.String
		meta.IssueDate = issueDate.String
		meta.IssuingAuthority = authority.String
		meta.OMNumber = omNum.String
		meta.DocType = docType.String
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
		if supersededStr.Valid {
			_ = json.Unmarshal([]byte(supersededStr.String), &meta.SupersededDocuments)
		}
		doc.Metadata = &meta
	}

	return &doc, nil
}

// DocumentFilter describes the supported list query parameters.
type DocumentFilter struct {
	Search     string
	Category   string
	Status     string
	Compliance string
	DocType    string
	Limit      int
	Offset     int
}

// ListDocuments returns documents matching the filter plus the unpaged total.
func (db *DB) ListDocuments(f DocumentFilter) ([]DocumentListItem, int, error) {
	where := []string{"1=1"}
	args := []any{}

	if term := strings.TrimSpace(strings.ToLower(f.Search)); term != "" {
		like := "%" + term + "%"
		where = append(where, `(
			LOWER(COALESCE(m.title, '')) LIKE ? OR
			LOWER(d.file_name) LIKE ? OR
			LOWER(COALESCE(m.om_number, '')) LIKE ? OR
			LOWER(COALESCE(m.issuing_authority, '')) LIKE ?
		)`)
		args = append(args, like, like, like, like)
	}
	if f.Category != "" {
		where = append(where, `COALESCE(m.categories, '[]') LIKE ?`)
		args = append(args, `%"`+f.Category+`"%`)
	}
	if f.Status != "" {
		where = append(where, `d.status = ?`)
		args = append(args, f.Status)
	}
	if f.Compliance != "" {
		where = append(where, `d.compliance_status = ?`)
		args = append(args, f.Compliance)
	}
	if f.DocType != "" {
		where = append(where, `COALESCE(m.doc_type, '') = ?`)
		args = append(args, f.DocType)
	}

	clause := strings.Join(where, " AND ")

	countQuery := db.rebind(`
	SELECT COUNT(*)
	FROM documents d
	LEFT JOIN document_metadata m ON d.id = m.document_id
	WHERE ` + clause)
	var total int
	if err := db.conn.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query := `
	SELECT
		d.id, d.doc_number, COALESCE(m.title, d.file_name) as title,
		COALESCE(m.categories, '[]') as categories,
		COALESCE(m.issuing_authority, '') as department,
		COALESCE(m.doc_type, '') as doc_type,
		d.compliance_score, d.uploaded_at, d.compliance_status, d.file_url, d.status,
		COALESCE(d.superseded_by, '') as superseded_by
	FROM documents d
	LEFT JOIN document_metadata m ON d.id = m.document_id
	WHERE ` + clause + `
	ORDER BY d.uploaded_at DESC`

	if f.Limit > 0 {
		query += " LIMIT ? OFFSET ?"
		args = append(args, f.Limit, f.Offset)
	}

	rows, err := db.conn.Query(db.rebind(query), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var items []DocumentListItem
	for rows.Next() {
		var item DocumentListItem
		var categoriesStr string
		var uploadedAt time.Time
		if err := rows.Scan(
			&item.ID, &item.DocNumber, &item.Title, &categoriesStr,
			&item.Department, &item.DocType, &item.ComplianceScore, &uploadedAt,
			&item.Compliance, &item.FileURL, &item.Status, &item.SupersededBy,
		); err != nil {
			return nil, 0, err
		}

		var cats []string
		_ = json.Unmarshal([]byte(categoriesStr), &cats)
		if len(cats) > 0 {
			item.Category = cats[0]
		} else {
			item.Category = "General Notice"
		}

		item.UploadDate = formatRelativeTime(uploadedAt)
		items = append(items, item)
	}

	return items, total, nil
}

// DeleteDocument removes a document together with its dependent rows.
//
// The metadata and audit rows are deleted explicitly in the same transaction:
// SQLite opens with foreign-key enforcement off, so the declared
// ON DELETE CASCADE never fires and would leave orphans behind.
func (db *DB) DeleteDocument(id string) (string, error) {
	row := db.conn.QueryRow(db.rebind("SELECT file_path FROM documents WHERE id = ?"), id)
	var filePath string
	_ = row.Scan(&filePath)

	tx, err := db.conn.Begin()
	if err != nil {
		return filePath, err
	}
	defer tx.Rollback()

	for _, stmt := range []string{
		"DELETE FROM document_audit WHERE document_id = ?",
		"DELETE FROM document_metadata WHERE document_id = ?",
		"DELETE FROM documents WHERE id = ?",
	} {
		if _, err := tx.Exec(db.rebind(stmt), id); err != nil {
			return filePath, err
		}
	}

	return filePath, tx.Commit()
}

// DeleteMetadata drops a document's extracted metadata, used when reprocessing
// changes an outcome to one that carries no metadata.
func (db *DB) DeleteMetadata(id string) error {
	_, err := db.conn.Exec(db.rebind("DELETE FROM document_metadata WHERE document_id = ?"), id)
	return err
}

// AuditEntry is one recorded action on a document.
type AuditEntry struct {
	ID         string    `json:"id"`
	DocumentID string    `json:"documentId"`
	Action     string    `json:"action"`
	Actor      string    `json:"actor"`
	Detail     string    `json:"detail"`
	CreatedAt  time.Time `json:"createdAt"`
}

func (db *DB) CreateAudit(entry *AuditEntry) error {
	query := db.rebind(`
	INSERT INTO document_audit (id, document_id, action, actor, detail, created_at)
	VALUES (?, ?, ?, ?, ?, ?)
	`)
	_, err := db.conn.Exec(
		query, entry.ID, entry.DocumentID, entry.Action, entry.Actor, entry.Detail, time.Now(),
	)
	return err
}

func (db *DB) ListAudit(documentID string, limit int) ([]AuditEntry, error) {
	query := `
	SELECT id, document_id, action, COALESCE(actor, ''), COALESCE(detail, ''), created_at
	FROM document_audit`
	args := []any{}

	if documentID != "" {
		query += " WHERE document_id = ?"
		args = append(args, documentID)
	}
	query += " ORDER BY created_at DESC"
	if limit > 0 {
		query += " LIMIT ?"
		args = append(args, limit)
	}

	rows, err := db.conn.Query(db.rebind(query), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []AuditEntry
	for rows.Next() {
		var e AuditEntry
		if err := rows.Scan(&e.ID, &e.DocumentID, &e.Action, &e.Actor, &e.Detail, &e.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, nil
}

// ReportRow is the flattened per-document data the reporting layer aggregates.
type ReportRow struct {
	UploadedAt       time.Time
	ComplianceStatus string
	DocType          string
	IssuingAuthority string
	Categories       []string
	Status           string
}

// ReportRows returns one row per document for aggregation in Go, keeping the SQL
// portable across SQLite and Postgres.
func (db *DB) ReportRows() ([]ReportRow, error) {
	query := `
	SELECT d.uploaded_at, d.compliance_status, COALESCE(m.doc_type, ''),
	       COALESCE(m.issuing_authority, ''), COALESCE(m.categories, '[]'), d.status
	FROM documents d
	LEFT JOIN document_metadata m ON d.id = m.document_id
	ORDER BY d.uploaded_at DESC`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ReportRow
	for rows.Next() {
		var r ReportRow
		var categoriesStr string
		if err := rows.Scan(
			&r.UploadedAt, &r.ComplianceStatus, &r.DocType, &r.IssuingAuthority, &categoriesStr, &r.Status,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(categoriesStr), &r.Categories)
		out = append(out, r)
	}
	return out, nil
}

// ExportRow is the full flattened record written to the CSV export.
type ExportRow struct {
	DocNumber           string
	FileName            string
	Title               string
	DocType             string
	IssueDate           string
	IssuingAuthority    string
	OMNumber            string
	Categories          []string
	Compliance          string
	ComplianceScore     int
	Status              string
	ExtractionStatus    string
	VerificationFlags   []string
	RelevanceConfidence float64
	UploadedAt          time.Time
}

func (db *DB) ExportRows() ([]ExportRow, error) {
	query := `
	SELECT d.doc_number, d.file_name, COALESCE(m.title, ''), COALESCE(m.doc_type, ''),
	       COALESCE(m.issue_date, ''), COALESCE(m.issuing_authority, ''), COALESCE(m.om_number, ''),
	       COALESCE(m.categories, '[]'), d.compliance_status, d.compliance_score, d.status,
	       COALESCE(d.extraction_status, ''), COALESCE(m.verification_flags, '[]'),
	       d.relevance_confidence, d.uploaded_at
	FROM documents d
	LEFT JOIN document_metadata m ON d.id = m.document_id
	ORDER BY d.uploaded_at DESC`

	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ExportRow
	for rows.Next() {
		var r ExportRow
		var categoriesStr, flagsStr string
		if err := rows.Scan(
			&r.DocNumber, &r.FileName, &r.Title, &r.DocType, &r.IssueDate, &r.IssuingAuthority,
			&r.OMNumber, &categoriesStr, &r.Compliance, &r.ComplianceScore, &r.Status,
			&r.ExtractionStatus, &flagsStr, &r.RelevanceConfidence, &r.UploadedAt,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(categoriesStr), &r.Categories)
		_ = json.Unmarshal([]byte(flagsStr), &r.VerificationFlags)
		out = append(out, r)
	}
	return out, nil
}

// SupersessionCandidate is a prior document that a new document may supersede.
type SupersessionCandidate struct {
	ID        string
	DocNumber string
	OMNumber  string
	FileName  string
}

func (db *DB) SupersessionCandidates(excludeID string) ([]SupersessionCandidate, error) {
	query := `
	SELECT d.id, d.doc_number, COALESCE(m.om_number, ''), d.file_name
	FROM documents d
	LEFT JOIN document_metadata m ON d.id = m.document_id
	WHERE d.id != ?`
	rows, err := db.conn.Query(db.rebind(query), excludeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SupersessionCandidate
	for rows.Next() {
		var c SupersessionCandidate
		if err := rows.Scan(&c.ID, &c.DocNumber, &c.OMNumber, &c.FileName); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, nil
}

// AuthorityCount is an issuing authority with its document count.
type AuthorityCount struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// DepartmentSummary powers the Team screen from real extracted authorities.
type DepartmentSummary struct {
	Name          string `json:"name"`
	DocumentCount int    `json:"documentCount"`
	LatestDoc     string `json:"latestDoc"`
	LatestDocID   string `json:"latestDocId"`
	Flagged       int    `json:"flagged"`
}

func (db *DB) Departments() ([]DepartmentSummary, error) {
	query := `
	SELECT d.id, COALESCE(m.issuing_authority, ''), COALESCE(m.title, d.file_name),
	       d.compliance_status
	FROM documents d
	LEFT JOIN document_metadata m ON d.id = m.document_id
	ORDER BY d.uploaded_at DESC`
	rows, err := db.conn.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	index := map[string]int{}
	var out []DepartmentSummary
	for rows.Next() {
		var id, authority, title, compliance string
		if err := rows.Scan(&id, &authority, &title, &compliance); err != nil {
			return nil, err
		}
		if strings.TrimSpace(authority) == "" {
			authority = "Unattributed"
		}
		if i, ok := index[authority]; ok {
			out[i].DocumentCount++
			if compliance != "Verified" {
				out[i].Flagged++
			}
			continue
		}
		index[authority] = len(out)
		flagged := 0
		if compliance != "Verified" {
			flagged = 1
		}
		out = append(out, DepartmentSummary{
			Name:          authority,
			DocumentCount: 1,
			LatestDoc:     title,
			LatestDocID:   id,
			Flagged:       flagged,
		})
	}
	return out, nil
}

func (db *DB) GetDashboardStats() (*DashboardStats, error) {
	stats := &DashboardStats{KPIs: []KPICard{}}

	row := db.conn.QueryRow(`
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN compliance_status = 'Verified' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN compliance_status = 'Needs Review' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN compliance_status = 'Superseded' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN compliance_status = 'Not Procurement' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0)
		FROM documents
	`)
	_ = row.Scan(
		&stats.TotalDocs, &stats.Compliant, &stats.NeedsReview,
		&stats.Superseded, &stats.NotProcurement, &stats.Processing,
	)

	stats.KPIs = []KPICard{
		{Title: "Total Docs", Value: fmt.Sprintf("%d", stats.TotalDocs), Label: "All uploaded"},
		{Title: "Verified", Value: fmt.Sprintf("%d", stats.Compliant), Label: "Grounded extraction", Highlight: true},
		{Title: "Needs Review", Value: fmt.Sprintf("%d", stats.NeedsReview), Label: "Awaiting checks"},
		{Title: "Superseded", Value: fmt.Sprintf("%d", stats.Superseded), Label: "Voided by newer order"},
		{Title: "Not Procurement", Value: fmt.Sprintf("%d", stats.NotProcurement), Label: "Segregated out"},
	}

	recent, _, err := db.ListDocuments(DocumentFilter{Limit: 6})
	if err == nil {
		stats.RecentDocs = recent
	}

	return stats, nil
}

func formatRelativeTime(t time.Time) string {
	diff := time.Since(t)
	if diff < time.Minute {
		return "Just now"
	}
	if diff < time.Hour {
		return fmt.Sprintf("%d min ago", int(diff.Minutes()))
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
