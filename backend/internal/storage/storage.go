package storage

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

type Storage struct {
	baseDir        string
	supabaseURL    string
	supabaseKey    string
	supabaseBucket string
}

func New(baseDir, supabaseURL, supabaseKey, supabaseBucket string) (*Storage, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create storage dir: %w", err)
	}

	return &Storage{
		baseDir:        baseDir,
		supabaseURL:    supabaseURL,
		supabaseKey:    supabaseKey,
		supabaseBucket: supabaseBucket,
	}, nil
}

// SaveFile saves the uploaded reader content to local disk and optionally mirrors to Supabase Storage.
func (s *Storage) SaveFile(id string, filename string, r io.Reader) (string, string, int64, error) {
	ext := filepath.Ext(filename)
	if ext == "" {
		ext = ".pdf"
	}

	localFileName := fmt.Sprintf("%s%s", id, ext)
	localFilePath := filepath.Join(s.baseDir, localFileName)

	outFile, err := os.Create(localFilePath)
	if err != nil {
		return "", "", 0, fmt.Errorf("failed to create local file: %w", err)
	}
	defer outFile.Close()

	size, err := io.Copy(outFile, r)
	if err != nil {
		return "", "", 0, fmt.Errorf("failed to write local file: %w", err)
	}

	// Default accessible URL points to Go backend PDF streaming endpoint
	fileURL := fmt.Sprintf("/api/documents/%s/pdf", id)

	// If Supabase Storage credentials exist, upload to Supabase bucket
	if s.supabaseURL != "" && s.supabaseKey != "" {
		cloudURL, err := s.uploadToSupabase(localFilePath, localFileName)
		if err != nil {
			log.Printf("Warning: Supabase storage upload failed, falling back to local URL: %v", err)
		} else {
			fileURL = cloudURL
			log.Printf("File uploaded to Supabase Storage: %s", cloudURL)
		}
	}

	return localFilePath, fileURL, size, nil
}

func (s *Storage) GetLocalPath(filePath string) (string, error) {
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return "", fmt.Errorf("file not found: %s", filePath)
	}
	return filePath, nil
}

func (s *Storage) DeleteFile(filePath string) error {
	if filePath != "" {
		_ = os.Remove(filePath)
	}
	return nil
}

func (s *Storage) uploadToSupabase(localPath string, destinationName string) (string, error) {
	fileData, err := os.ReadFile(localPath)
	if err != nil {
		return "", err
	}

	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.supabaseURL, s.supabaseBucket, destinationName)
	req, err := http.NewRequest("POST", uploadURL, bytes.NewReader(fileData))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+s.supabaseKey)
	req.Header.Set("apikey", s.supabaseKey)
	req.Header.Set("Content-Type", "application/pdf")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("supabase upload returned status %d: %s", resp.StatusCode, string(respBody))
	}

	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", s.supabaseURL, s.supabaseBucket, destinationName)
	return publicURL, nil
}
