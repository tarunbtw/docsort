package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"docsort-backend/internal/database"
	"docsort-backend/internal/engine"
	"docsort-backend/internal/storage"
)

type Handler struct {
	db      *database.DB
	storage *storage.Storage
	engine  *engine.Client
}

func NewHandler(db *database.DB, store *storage.Storage, eng *engine.Client) *Handler {
	return &Handler{
		db:      db,
		storage: store,
		engine:  eng,
	}
}

// complianceStatuses is the closed set of compliance outcomes.
var complianceStatuses = map[string]bool{
	"Verified":        true,
	"Needs Review":    true,
	"Superseded":      true,
	"Not Procurement": true,
}

// audit records one action against a document. Reporting depends on this, so it
// is called on every meaningful transition.
func (h *Handler) audit(documentID, action, actor, detail string) {
	entry := &database.AuditEntry{
		ID:         uuid.New().String(),
		DocumentID: documentID,
		Action:     action,
		Actor:      actor,
		Detail:     detail,
	}
	if err := h.db.CreateAudit(entry); err != nil {
		log.Printf("Failed to write audit entry for %s: %v", documentID, err)
	}
}

// newDocID returns a fresh document identifier.
func newDocID() string { return uuid.New().String() }

// classifyOutcome maps a pipeline result onto a document status, a compliance
// status and a compliance score. Non-procurement documents are segregated, not
// reported as policy contradictions.
func classifyOutcome(result *engine.ProcessResult) (status, compliance string, score int, message string) {
	switch result.Status {
	case "not_relevant":
		return "not_relevant", "Not Procurement", 0, "Segregated: not a procurement document"
	case "uncertain":
		return "uncertain", "Needs Review", 60, "Segregation confidence too low; routed for review"
	case "error":
		return "error", "Needs Review", 0, humaniseError(result.Error)
	}

	if result.ExtractionStatus == "llm_unavailable" {
		return "processed", "Needs Review", 60, "Metadata extraction unavailable (no working LLM provider)"
	}

	score = 100 - 12*len(result.VerificationFlags)
	if score < 40 {
		score = 40
	}
	compliance = "Verified"
	if score < 80 {
		compliance = "Needs Review"
	}
	return "processed", compliance, score, ""
}

func humaniseError(msg string) string {
	lower := strings.ToLower(msg)
	if strings.Contains(lower, "scanned") || strings.Contains(lower, "image-based") {
		return "Scanned document - OCR pending"
	}
	if strings.TrimSpace(msg) == "" {
		return "Processing failed"
	}
	return msg
}

func auditActionFor(status string) string {
	switch status {
	case "not_relevant":
		return "Segregated as non-procurement"
	case "uncertain":
		return "Routed for review"
	case "error":
		return "Processing failed"
	default:
		return "Processed"
	}
}

// normaliseRef reduces a reference string to lowercase alphanumerics so that
// "F.1/11/2021-PPD" and "F 1 11 2021 PPD" compare equal.
func normaliseRef(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// linkSupersessions marks older documents that this one explicitly voids.
//
// Links are only created from references that passed verbatim verification:
// auto-voiding a live policy on the strength of an ungrounded identifier would
// defeat the point of the verification layer.
func (h *Handler) linkSupersessions(docID, docNumber string, result *engine.ProcessResult) {
	for _, flag := range result.VerificationFlags {
		if flag == "superseded_documents" || flag == "supersedes" {
			log.Printf(
				"Document %s: supersession reference failed verification, not linking: %v",
				docNumber, append(result.SupersededDocuments, deref(result.Supersedes)),
			)
			return
		}
	}

	refs := append([]string{}, result.SupersededDocuments...)
	if result.Supersedes != nil && strings.TrimSpace(*result.Supersedes) != "" {
		refs = append(refs, *result.Supersedes)
	}
	if len(refs) == 0 {
		return
	}

	haystack := normaliseRef(strings.Join(refs, " "))
	if len(haystack) < 5 {
		return
	}

	candidates, err := h.db.SupersessionCandidates(docID)
	if err != nil {
		log.Printf("Supersession lookup failed: %v", err)
		return
	}

	for _, candidate := range candidates {
		key := normaliseRef(candidate.OMNumber)
		if len(key) < 5 || !strings.Contains(haystack, key) {
			continue
		}
		if err := h.db.MarkSuperseded(candidate.ID, docID); err != nil {
			log.Printf("Failed to mark %s superseded: %v", candidate.DocNumber, err)
			continue
		}
		log.Printf("Document %s supersedes %s (%s)", docNumber, candidate.DocNumber, candidate.OMNumber)
		h.audit(candidate.ID, "Superseded", "system", "Superseded by "+docNumber)
		h.audit(docID, "Supersedes", "system", "Supersedes "+candidate.DocNumber)
	}
}

// applyResult persists everything a pipeline outcome changes: the document's
// status, compliance verdict, score and extraction provenance, plus its
// extracted metadata and any supersession links. Shared by upload and
// reprocessing so both paths stay in lockstep.
func (h *Handler) applyResult(id, docNumber string, result *engine.ProcessResult) {
	status, compliance, score, message := classifyOutcome(result)

	confidence := result.RelevanceConfidence
	if result.Status == "not_relevant" || result.Status == "uncertain" {
		confidence = result.Confidence
	}

	if err := h.db.UpdateDocumentStatus(id, database.StatusUpdate{
		Status:           status,
		Confidence:       confidence,
		ComplianceStatus: compliance,
		ComplianceScore:  score,
		ErrorMessage:     message,
		ExtractionStatus: result.ExtractionStatus,
		LLMProvider:      result.ExtractionProvider,
		LLMModel:         result.ExtractionModel,
	}); err != nil {
		log.Printf("Failed to update status for %s: %v", id, err)
	}

	if result.Status == "processed" {
		meta := &database.DocumentMetadata{
			DocumentID:          id,
			Title:               result.Title,
			IssueDate:           result.Date,
			IssuingAuthority:    result.IssuingAuthority,
			OMNumber:            result.OMNumber,
			DocType:             result.DocType,
			Categories:          result.Categories,
			Supersedes:          result.Supersedes,
			SupersededDocuments: result.SupersededDocuments,
			Summary:             result.Summary,
			VerificationFlags:   result.VerificationFlags,
		}
		if err := h.db.SaveMetadata(meta); err != nil {
			log.Printf("Failed to save metadata for %s: %v", id, err)
		}
		h.linkSupersessions(id, docNumber, result)
	} else if err := h.db.DeleteMetadata(id); err != nil {
		log.Printf("Failed to clear stale metadata for %s: %v", id, err)
	}

	if message != "" {
		log.Printf("Document %s: %s", id, message)
	}
	h.audit(id, auditActionFor(status), "system", message)
}

// ReprocessDocument re-runs the pipeline for a stored document and replaces its
// outcome in place, preserving its identifier and number. Used after the engine's
// model or provider configuration changes, and to repair documents processed
// before a fix.
func (h *Handler) ReprocessDocument(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	doc, err := h.db.GetDocument(id)
	if err != nil {
		http.Error(w, "Document not found", http.StatusNotFound)
		return
	}

	filePath, err := h.storage.GetLocalPath(doc.FilePath)
	if err != nil {
		http.Error(w, "File not found on disk", http.StatusNotFound)
		return
	}

	log.Printf("Reprocessing document %s (%s)...", doc.DocNumber, doc.FileName)
	result, err := h.engine.ProcessDocument(filePath)
	if err != nil {
		http.Error(w, "Engine execution failed: "+err.Error(), http.StatusBadGateway)
		return
	}

	h.applyResult(id, doc.DocNumber, result)

	updated, err := h.db.GetDocument(id)
	if err != nil {
		respondJSON(w, http.StatusOK, doc)
		return
	}
	respondJSON(w, http.StatusOK, updated)
}

func (h *Handler) UploadDocument(w http.ResponseWriter, r *http.Request) {
	// 32 MB max upload buffer
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "Failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Missing file parameter: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	docID := newDocID()
	docNum := fmt.Sprintf("#DOC-%d", 10000+rand.Intn(90000))

	// 1. Save file to storage (local disk + optional Supabase Storage mirror)
	localPath, fileURL, size, err := h.storage.SaveFile(docID, header.Filename, file)
	if err != nil {
		http.Error(w, "Storage error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	doc := &database.Document{
		ID:                  docID,
		DocNumber:           docNum,
		FileName:            header.Filename,
		FilePath:            localPath,
		FileURL:             fileURL,
		FileSize:            size,
		MimeType:            "application/pdf",
		Status:              "processing",
		RelevanceConfidence: 0.0,
		ComplianceStatus:    "Needs Review",
		ComplianceScore:     0,
		UploadedAt:          time.Now(),
		ExtractionStatus:    "pending",
	}

	if err := h.db.CreateDocument(doc); err != nil {
		_ = h.storage.DeleteFile(localPath)
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	h.audit(docID, "Uploaded", "system", header.Filename)

	// 2. Dispatch processing to the Python ML engine
	log.Printf("Invoking Python ML pipeline for document %s (%s)...", docID, header.Filename)
	result, err := h.engine.ProcessDocument(localPath)
	if err != nil {
		log.Printf("Engine execution error: %v", err)
		_ = h.db.UpdateDocumentStatus(docID, database.StatusUpdate{
			Status: "error", ComplianceStatus: "Needs Review", ComplianceScore: 0,
			ErrorMessage: err.Error(), ExtractionStatus: "error",
		})
		h.audit(docID, "Processing failed", "system", err.Error())
		doc.Status = "error"
		doc.ErrorMessage = err.Error()
		respondJSON(w, http.StatusOK, doc)
		return
	}

	// 3. Map the outcome onto status + compliance and persist it
	h.applyResult(docID, docNum, result)

	fullDoc, err := h.db.GetDocument(docID)
	if err != nil {
		respondJSON(w, http.StatusOK, doc)
		return
	}
	respondJSON(w, http.StatusOK, fullDoc)
}

func (h *Handler) ListDocuments(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	pageSize, _ := strconv.Atoi(q.Get("pageSize"))

	filter := database.DocumentFilter{
		Search:     q.Get("search"),
		Category:   q.Get("category"),
		Status:     q.Get("status"),
		Compliance: q.Get("compliance"),
		DocType:    q.Get("docType"),
	}
	if pageSize > 0 {
		if page <= 0 {
			page = 1
		}
		filter.Limit = pageSize
		filter.Offset = (page - 1) * pageSize
	}

	items, total, err := h.db.ListDocuments(filter)
	if err != nil {
		http.Error(w, "Failed to list documents: "+err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"documents": items,
		"total":     total,
		"page":      page,
		"pageSize":  pageSize,
	})
}

func (h *Handler) GetDocument(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	doc, err := h.db.GetDocument(id)
	if err != nil {
		http.Error(w, "Document not found: "+err.Error(), http.StatusNotFound)
		return
	}

	respondJSON(w, http.StatusOK, doc)
}

func (h *Handler) StreamPDF(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	doc, err := h.db.GetDocument(id)
	if err != nil {
		http.Error(w, "Document not found", http.StatusNotFound)
		return
	}

	filePath, err := h.storage.GetLocalPath(doc.FilePath)
	if err != nil {
		http.Error(w, "File not found on disk", http.StatusNotFound)
		return
	}

	file, err := os.Open(filePath)
	if err != nil {
		http.Error(w, "Failed to open file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer file.Close()

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", doc.FileName))
	_, _ = io.Copy(w, file)
}

func (h *Handler) DeleteDocument(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	filePath, err := h.db.DeleteDocument(id)
	if err != nil {
		http.Error(w, "Failed to delete document: "+err.Error(), http.StatusInternalServerError)
		return
	}

	_ = h.storage.DeleteFile(filePath)
	respondJSON(w, http.StatusOK, map[string]bool{"success": true})
}

// ReviewRequest is the body of a human review action.
type ReviewRequest struct {
	Action string `json:"action"` // acknowledge | override
	Status string `json:"status"` // required for override
	Note   string `json:"note"`
	Actor  string `json:"actor"`
}

// ReviewDocument records a human compliance decision and audits it.
func (h *Handler) ReviewDocument(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	doc, err := h.db.GetDocument(id)
	if err != nil {
		http.Error(w, "Document not found", http.StatusNotFound)
		return
	}

	var req ReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(req.Actor) == "" {
		req.Actor = "compliance-officer"
	}

	target := doc.ComplianceStatus
	action := "Acknowledged"
	switch req.Action {
	case "acknowledge":
		target = "Verified"
	case "override":
		if !complianceStatuses[req.Status] {
			http.Error(w, "Invalid status: "+req.Status, http.StatusBadRequest)
			return
		}
		target = req.Status
		action = "Status overridden"
	default:
		http.Error(w, "Invalid action: "+req.Action, http.StatusBadRequest)
		return
	}

	score := doc.ComplianceScore
	switch target {
	case "Verified":
		score = 100
	case "Not Procurement":
		score = 0
	}

	if err := h.db.UpdateDocumentStatus(id, database.StatusUpdate{
		Status:           doc.Status,
		Confidence:       doc.RelevanceConfidence,
		ComplianceStatus: target,
		ComplianceScore:  score,
		ErrorMessage:     doc.ErrorMessage,
		ExtractionStatus: doc.ExtractionStatus,
		LLMProvider:      doc.LLMProvider,
		LLMModel:         doc.LLMModel,
	}); err != nil {
		http.Error(w, "Failed to update document: "+err.Error(), http.StatusInternalServerError)
		return
	}

	detail := fmt.Sprintf("%s -> %s", doc.ComplianceStatus, target)
	if strings.TrimSpace(req.Note) != "" {
		detail += " (" + req.Note + ")"
	}
	h.audit(id, action, req.Actor, detail)

	updated, err := h.db.GetDocument(id)
	if err != nil {
		respondJSON(w, http.StatusOK, doc)
		return
	}
	respondJSON(w, http.StatusOK, updated)
}

// CountItem is a name/count pair used across the report payloads.
type CountItem struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

// DayCount is one bucket of the uploads-per-day series.
type DayCount struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// ReportSummary is the aggregate payload behind the Reports screen.
type ReportSummary struct {
	Total          int         `json:"total"`
	ByCompliance   []CountItem `json:"byCompliance"`
	ByDocType      []CountItem `json:"byDocType"`
	ByCategory     []CountItem `json:"byCategory"`
	TopAuthorities []CountItem `json:"topAuthorities"`
	UploadsPerDay  []DayCount  `json:"uploadsPerDay"`
}

func topCounts(counts map[string]int, limit int) []CountItem {
	items := make([]CountItem, 0, len(counts))
	for name, count := range counts {
		items = append(items, CountItem{Name: name, Count: count})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Count != items[j].Count {
			return items[i].Count > items[j].Count
		}
		return items[i].Name < items[j].Name
	})
	if limit > 0 && len(items) > limit {
		items = items[:limit]
	}
	return items
}

func (h *Handler) GetReportSummary(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.ReportRows()
	if err != nil {
		http.Error(w, "Failed to build report: "+err.Error(), http.StatusInternalServerError)
		return
	}

	byCompliance := map[string]int{}
	byDocType := map[string]int{}
	byCategory := map[string]int{}
	byAuthority := map[string]int{}
	perDay := map[string]int{}

	for _, row := range rows {
		status := row.ComplianceStatus
		if status == "" {
			status = "Needs Review"
		}
		byCompliance[status]++
		if row.DocType != "" {
			byDocType[row.DocType]++
		}
		for _, c := range row.Categories {
			byCategory[c]++
		}
		if strings.TrimSpace(row.IssuingAuthority) != "" {
			byAuthority[row.IssuingAuthority]++
		}
		perDay[row.UploadedAt.Format("2006-01-02")]++
	}

	days := make([]DayCount, 0, 14)
	for i := 13; i >= 0; i-- {
		date := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		days = append(days, DayCount{Date: date, Count: perDay[date]})
	}

	respondJSON(w, http.StatusOK, ReportSummary{
		Total:          len(rows),
		ByCompliance:   topCounts(byCompliance, 0),
		ByDocType:      topCounts(byDocType, 0),
		ByCategory:     topCounts(byCategory, 10),
		TopAuthorities: topCounts(byAuthority, 8),
		UploadsPerDay:  days,
	})
}

// ExportCSV streams the full document register as a real CSV download.
func (h *Handler) ExportCSV(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.ExportRows()
	if err != nil {
		http.Error(w, "Failed to build export: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(
		"attachment; filename=\"docsort-register-%s.csv\"", time.Now().Format("20060102-150405"),
	))

	writer := csv.NewWriter(w)
	defer writer.Flush()

	_ = writer.Write([]string{
		"doc_number", "file_name", "title", "doc_type", "issue_date", "issuing_authority",
		"om_number", "categories", "compliance", "compliance_score", "status",
		"extraction_status", "verification_flags", "relevance_confidence", "uploaded_at",
	})

	for _, row := range rows {
		_ = writer.Write([]string{
			row.DocNumber,
			row.FileName,
			row.Title,
			row.DocType,
			row.IssueDate,
			row.IssuingAuthority,
			row.OMNumber,
			strings.Join(row.Categories, "|"),
			row.Compliance,
			strconv.Itoa(row.ComplianceScore),
			row.Status,
			row.ExtractionStatus,
			strings.Join(row.VerificationFlags, "|"),
			fmt.Sprintf("%.3f", row.RelevanceConfidence),
			row.UploadedAt.Format(time.RFC3339),
		})
	}
}

func (h *Handler) ListAudit(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	entries, err := h.db.ListAudit(r.URL.Query().Get("documentId"), limit)
	if err != nil {
		http.Error(w, "Failed to load audit log: "+err.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"entries": entries, "total": len(entries)})
}

func (h *Handler) GetDepartments(w http.ResponseWriter, r *http.Request) {
	departments, err := h.db.Departments()
	if err != nil {
		http.Error(w, "Failed to load departments: "+err.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{"departments": departments})
}

func (h *Handler) GetDashboardStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.db.GetDashboardStats()
	if err != nil {
		http.Error(w, "Failed to load dashboard stats: "+err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, stats)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
