-- ====================================================================
-- DocSort: Supabase PostgreSQL Schema
-- Run this in your Supabase Project -> SQL Editor -> Run
-- ====================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Documents Table: Stores ingestion lifecycle, physical file URLs, and top-level scores
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doc_number VARCHAR(50) UNIQUE NOT NULL,             -- e.g. #DOC-10245
    file_name TEXT NOT NULL,                            -- original filename
    file_path TEXT NOT NULL,                            -- storage object path
    file_url TEXT NOT NULL,                             -- public or signed URL for browser iframe
    file_size BIGINT NOT NULL,                          -- bytes
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    status VARCHAR(50) NOT NULL,                        -- 'pending', 'processing', 'processed', 'not_relevant', 'error'
    relevance_confidence REAL DEFAULT 0.0,             -- Stage 1 linear classifier confidence (0.0 to 1.0)
    compliance_status VARCHAR(50) DEFAULT 'Compliant',  -- 'Compliant', 'Needs Review', 'Contradiction'
    compliance_score INT DEFAULT 100,                   -- 0 to 100
    error_message TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- 2. Document Metadata Table: Verified structured fields from Stage 2 & Stage 3
CREATE TABLE IF NOT EXISTS document_metadata (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    issue_date VARCHAR(100),
    issuing_authority TEXT,
    om_number VARCHAR(100),
    categories JSONB DEFAULT '[]'::jsonb,               -- e.g. ["tendering", "e-procurement"]
    supersedes TEXT,
    summary TEXT,
    verification_flags JSONB DEFAULT '[]'::jsonb,       -- e.g. ["om_number"]
    raw_text TEXT
);

-- 3. Departments Table: Organizational units for filtering
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) UNIQUE NOT NULL,
    head VARCHAR(150),
    doc_count INT DEFAULT 0
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_compliance ON documents(compliance_status);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_at ON documents(uploaded_at DESC);

-- ====================================================================
-- STORAGE INSTRUCTIONS:
-- In Supabase Dashboard -> Storage -> Create New Bucket:
-- 1. Bucket Name: "documents"
-- 2. Toggle "Public Bucket" to ON (so browser iframes can view PDFs)
-- ====================================================================
