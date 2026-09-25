package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
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

	docID := uuid.New().String()
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
		ComplianceScore:     70,
		UploadedAt:          time.Now(),
	}

	if err := h.db.CreateDocument(doc); err != nil {
		_ = h.storage.DeleteFile(localPath)
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 2. Dispatch processing to Python ML Engine
	log.Printf("Invoking Python ML pipeline for document %s (%s)...", docID, header.Filename)
	result, err := h.engine.ProcessDocument(localPath)
	if err != nil {
		log.Printf("Engine execution error: %v", err)
		_ = h.db.UpdateDocumentStatus(docID, "error", 0, "Needs Review", 0, err.Error())
		doc.Status = "error"
		doc.ErrorMessage = err.Error()
		respondJSON(w, http.StatusOK, doc)
		return
	}

	// 3. Handle pipeline classification and extraction outcome
	if result.Status == "not_relevant" {
		log.Printf("Document %s rejected by Stage 1 linear pre-filter (confidence: %.3f)", docID, result.Confidence)
		_ = h.db.UpdateDocumentStatus(docID, "not_relevant", result.Confidence, "Contradiction", 25, "Document classified as non-procurement notice")
		doc.Status = "not_relevant"
		doc.RelevanceConfidence = result.Confidence
		doc.ComplianceStatus = "Contradiction"
		doc.ComplianceScore = 25
		respondJSON(w, http.StatusOK, doc)
		return
	}

	if result.Status == "error" {
		log.Printf("Document %s pipeline error: %s", docID, result.Error)
		_ = h.db.UpdateDocumentStatus(docID, "error", 0, "Needs Review", 40, result.Error)
		doc.Status = "error"
		doc.ErrorMessage = result.Error
		respondJSON(w, http.StatusOK, doc)
		return
	}

	// 4. Calculate compliance score & status based on verification flags
	score := 100
	flagsCount := len(result.VerificationFlags)
	if flagsCount > 0 {
		score -= flagsCount * 12
	}
	if score < 40 {
		score = 40
	}

	compStatus := "Compliant"
	if score < 80 {
		compStatus = "Needs Review"
	}
	if score < 50 {
		compStatus = "Contradiction"
	}

	// Stage 2 did not run, so no metadata was extracted: the document cannot be
	// reported as compliant even though no verification flags were raised.
	if result.ExtractionStatus == "llm_unavailable" {
		log.Printf("Document %s: metadata extraction unavailable, marking for review", docID)
		compStatus = "Needs Review"
		if score > 60 {
			score = 60
		}
	}

	meta := &database.DocumentMetadata{
		DocumentID:        docID,
		Title:             result.Title,
		IssueDate:         result.Date,
		IssuingAuthority:  result.IssuingAuthority,
		OMNumber:          result.OMNumber,
		Categories:        result.Categories,
		Supersedes:        result.Supersedes,
		Summary:           result.Summary,
		VerificationFlags: result.VerificationFlags,
	}

	_ = h.db.UpdateDocumentStatus(docID, "processed", result.RelevanceConfidence, compStatus, score, "")
	_ = h.db.SaveMetadata(meta)

	fullDoc, err := h.db.GetDocument(docID)
	if err != nil {
		respondJSON(w, http.StatusOK, doc)
		return
	}

	respondJSON(w, http.StatusOK, fullDoc)
}

func (h *Handler) ListDocuments(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	category := r.URL.Query().Get("category")
	status := r.URL.Query().Get("status")

	items, err := h.db.ListDocuments(search, category, status)
	if err != nil {
		http.Error(w, "Failed to list documents: "+err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"documents": items,
		"total":     len(items),
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
