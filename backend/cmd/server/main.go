package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"docsort-backend/internal/config"
	"docsort-backend/internal/database"
	"docsort-backend/internal/engine"
	"docsort-backend/internal/handlers"
	"docsort-backend/internal/storage"
)

func main() {
	cfg := config.Load()

	// 1. Initialize Database (Supabase PostgreSQL or local SQLite)
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Database initialization failed: %v", err)
	}
	defer db.Close()

	// 2. Initialize Storage (Local Disk + optional Supabase Storage mirror)
	store, err := storage.New(cfg.StorageDir, cfg.SupabaseURL, cfg.SupabaseKey, cfg.SupabaseBucket)
	if err != nil {
		log.Fatalf("Storage initialization failed: %v", err)
	}

	// 3. Initialize Python ML Engine HTTP Client
	mlEngine := engine.NewClient(cfg.PythonEngineURL)

	// 4. Initialize Handlers
	h := handlers.NewHandler(db, store, mlEngine)

	// 5. Setup Router & Middleware
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Configure CORS for frontend access
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173", "*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link", "Content-Disposition"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// 6. Register Routes
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","service":"docsort-go-backend"}`)
	})

	r.Route("/api", func(api chi.Router) {
		api.Post("/documents/upload", h.UploadDocument)
		api.Get("/documents", h.ListDocuments)
		api.Get("/documents/{id}", h.GetDocument)
		api.Get("/documents/{id}/pdf", h.StreamPDF)
		api.Delete("/documents/{id}", h.DeleteDocument)
		api.Get("/stats/dashboard", h.GetDashboardStats)
	})

	addr := ":" + cfg.Port
	log.Printf("DocSort Go backend listening on %s (ML Engine: %s)...", addr, cfg.PythonEngineURL)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server exited with error: %v", err)
	}
}
