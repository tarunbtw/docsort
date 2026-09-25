package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                 string
	DatabaseURL          string
	SupabaseURL          string
	SupabaseKey          string
	SupabaseBucket       string
	PythonEngineURL      string
	StorageDir           string
}

func Load() *Config {
	// Try loading .env from current directory or parent directory
	if err := godotenv.Load(); err != nil {
		if err := godotenv.Load("../.env"); err != nil {
			log.Println("No .env file found; using environment variables and defaults")
		}
	}

	cfg := &Config{
		Port:            getEnv("PORT", "8080"),
		DatabaseURL:     getEnv("DATABASE_URL", ""),
		SupabaseURL:     getEnv("SUPABASE_URL", ""),
		SupabaseKey:     getEnv("SUPABASE_KEY", ""),
		SupabaseBucket:  getEnv("SUPABASE_BUCKET", "documents"),
		PythonEngineURL: getEnv("PYTHON_ENGINE_URL", "http://127.0.0.1:8000"),
		StorageDir:      getEnv("STORAGE_DIR", "./storage/uploads"),
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
