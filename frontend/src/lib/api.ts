export type ComplianceStatus = 'Verified' | 'Needs Review' | 'Superseded' | 'Not Procurement';

export type DocumentStatus = 'pending' | 'processing' | 'processed' | 'not_relevant' | 'uncertain' | 'error';

export interface DocumentMetadata {
  documentId: string;
  title: string;
  date?: string;
  issuingAuthority?: string;
  omNumber?: string;
  docType?: string;
  categories: string[];
  supersedes?: string | null;
  supersededDocuments?: string[];
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
  status: DocumentStatus;
  relevanceConfidence: number;
  compliance: ComplianceStatus;
  complianceScore: number;
  errorMessage?: string;
  uploadedAt: string;
  processedAt?: string;
  extractionStatus?: string;
  llmProvider?: string;
  llmModel?: string;
  supersededBy?: string;
  supersededAt?: string;
  metadata?: DocumentMetadata;
}

export interface DocumentListItem {
  id: string;
  docNumber: string;
  title: string;
  category: string;
  department: string;
  docType?: string;
  complianceScore: number;
  uploadDate: string;
  compliance: ComplianceStatus;
  fileUrl: string;
  status: string;
  supersededBy?: string;
}

export interface KPICard {
  title: string;
  value: string;
  label: string;
  highlight: boolean;
}

export interface DashboardStats {
  kpis: KPICard[];
  totalDocs: number;
  compliant: number;
  needsReview: number;
  superseded: number;
  notProcurement: number;
  processing: number;
  recentDocs: DocumentListItem[];
}

export interface CountItem {
  name: string;
  count: number;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface ReportSummary {
  total: number;
  byCompliance: CountItem[];
  byDocType: CountItem[];
  byCategory: CountItem[];
  topAuthorities: CountItem[];
  uploadsPerDay: DayCount[];
}

export interface AuditEntry {
  id: string;
  documentId: string;
  action: string;
  actor: string;
  detail: string;
  createdAt: string;
}

export interface DepartmentSummary {
  name: string;
  documentCount: number;
  latestDoc: string;
  latestDocId: string;
  flagged: number;
}

export interface DocumentQuery {
  search?: string;
  category?: string;
  status?: string;
  compliance?: string;
  docType?: string;
  page?: number;
  pageSize?: number;
}

export interface DocumentPage {
  documents: DocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url} -> ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchDocuments(params: DocumentQuery = {}): Promise<DocumentPage> {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.category) query.append('category', params.category);
  if (params.status) query.append('status', params.status);
  if (params.compliance) query.append('compliance', params.compliance);
  if (params.docType) query.append('docType', params.docType);
  if (params.page) query.append('page', String(params.page));
  if (params.pageSize) query.append('pageSize', String(params.pageSize));

  const data = await getJSON<DocumentPage>(`/api/documents?${query.toString()}`);
  return {
    documents: data.documents ?? [],
    total: data.total ?? 0,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 0,
  };
}

export function fetchDocument(id: string): Promise<DocumentRecord> {
  return getJSON<DocumentRecord>(`/api/documents/${id}`);
}

export async function uploadDocument(file: File): Promise<DocumentRecord> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Upload failed');
  }
  return res.json();
}

export async function deleteDocument(id: string): Promise<boolean> {
  const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Failed to delete document: ${res.statusText}`);
  }
  return true;
}

export function fetchDashboardStats(): Promise<DashboardStats> {
  return getJSON<DashboardStats>('/api/stats/dashboard');
}

export function fetchReportSummary(): Promise<ReportSummary> {
  return getJSON<ReportSummary>('/api/reports/summary');
}

export async function fetchAudit(documentId?: string, limit = 20): Promise<AuditEntry[]> {
  const query = new URLSearchParams();
  if (documentId) query.append('documentId', documentId);
  if (limit) query.append('limit', String(limit));
  const data = await getJSON<{ entries: AuditEntry[] }>(`/api/audit?${query.toString()}`);
  return data.entries ?? [];
}

export async function fetchDepartments(): Promise<DepartmentSummary[]> {
  const data = await getJSON<{ departments: DepartmentSummary[] }>('/api/departments');
  return data.departments ?? [];
}

export async function reviewDocument(
  id: string,
  action: 'acknowledge' | 'override',
  options: { status?: ComplianceStatus; note?: string; actor?: string } = {},
): Promise<DocumentRecord> {
  const res = await fetch(`/api/documents/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...options }),
  });
  if (!res.ok) {
    throw new Error((await res.text()) || 'Review action failed');
  }
  return res.json();
}

export const exportCsvUrl = '/api/reports/export';
