package engine

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"time"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

type ProcessResult struct {
	Status              string   `json:"status"`                      // processed, not_relevant, error
	ExtractionStatus    string   `json:"extraction_status,omitempty"` // ok, llm_unavailable
	Error               string   `json:"error,omitempty"`
	RelevanceConfidence float64  `json:"relevance_confidence,omitempty"`
	Confidence          float64  `json:"confidence,omitempty"`
	Title               string   `json:"title,omitempty"`
	Date                string   `json:"date,omitempty"`
	IssuingAuthority    string   `json:"issuing_authority,omitempty"`
	OMNumber            string   `json:"om_number,omitempty"`
	Categories          []string `json:"categories,omitempty"`
	Supersedes          *string  `json:"supersedes,omitempty"`
	Summary             string   `json:"summary,omitempty"`
	VerificationFlags   []string `json:"verification_flags,omitempty"`
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second, // Allow sufficient time for LLM structured extraction
		},
	}
}

func (c *Client) HealthCheck() error {
	resp, err := c.httpClient.Get(fmt.Sprintf("%s/health", c.baseURL))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("engine returned health status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) ProcessDocument(filePath string) (*ProcessResult, error) {
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		absPath = filePath
	}

	payload := map[string]string{
		"file_path": absPath,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/process", c.baseURL)
	req, err := http.NewRequest("POST", url, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to call Python ML engine at %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Python ML engine returned status %d", resp.StatusCode)
	}

	var result ProcessResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode ML engine response: %w", err)
	}

	return &result, nil
}
