export interface DocumentMetadata {
  documentId: string;
  title: string;
  date?: string;
  issuingAuthority?: string;
  omNumber?: string;
  categories: string[];
  supersedes?: string | null;
  summary: string;
  verificationFlags: string[];
  rawText?: string;
}

export interface DocumentRecord {
  id: string;
  docNumber: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  status: 'pending' | 'processing' | 'processed' | 'not_relevant' | 'error';
  relevanceConfidence: number;
  compliance: 'Compliant' | 'Needs Review' | 'Contradiction';
  complianceScore: number;
  errorMessage?: string;
  uploadedAt: string;
  processedAt?: string;
  metadata?: DocumentMetadata;
}

export interface DocumentListItem {
  id: string;
  docNumber: string;
  title: string;
  category: string;
  department: string;
  complianceScore: number;
  uploadDate: string;
  validity: 'Active' | 'Outdated' | 'Needs Review';
  compliance: 'Compliant' | 'Needs Review' | 'Contradiction';
  fileUrl: string;
  status: string;
}

export interface KPICard {
  title: string;
  value: string;
  label: string;
  trend: string;
  highlight: boolean;
}

export interface DashboardStats {
  kpis: KPICard[];
  totalDocs: number;
  compliant: number;
  needsReview: number;
  contradicted: number;
  processing: number;
  recentDocs: DocumentListItem[];
}

export async function fetchDocuments(params?: { search?: string; category?: string; status?: string }): Promise<DocumentListItem[]> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.category) query.append('category', params.category);
  if (params?.status) query.append('status', params.status);

  const res = await fetch(`/api/documents?${query.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to load documents: ${res.statusText}`);
  }
  const data = await res.json();
  return data.documents || [];
}

export async function fetchDocument(id: string): Promise<DocumentRecord> {
  const res = await fetch(`/api/documents/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch document: ${res.statusText}`);
  }
  return res.json();
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/documents/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Upload failed');
  }

  return res.json();
}

export async function deleteDocument(id: string): Promise<boolean> {
  const res = await fetch(`/api/documents/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(`Failed to delete document: ${res.statusText}`);
  }
  return true;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch('/api/stats/dashboard');
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard stats: ${res.statusText}`);
  }
  return res.json();
}
