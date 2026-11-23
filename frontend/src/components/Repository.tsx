import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  UploadCloud,
  Bookmark,
  FileText,
  MoreVertical,
  RefreshCw,
  Eye,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  fetchDocument,
  DocumentListItem,
  DocumentRecord,
} from '../lib/api';
import DocumentModal from './DocumentModal';
import { getComplianceBadge } from './Dashboard';

// Shadcn imports
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const PAGE_SIZE = 10;

const COMPLIANCE_OPTIONS = [
  { label: 'All Compliance', value: '' },
  { label: 'Verified', value: 'Verified' },
  { label: 'Needs Review', value: 'Needs Review' },
  { label: 'Superseded', value: 'Superseded' },
  { label: 'Not Procurement', value: 'Not Procurement' },
];

const DOC_TYPE_OPTIONS = [
  { label: 'All Types', value: '' },
  { label: 'Office Memorandum', value: 'Office Memorandum' },
  { label: 'Circular', value: 'Circular' },
  { label: 'Notification', value: 'Notification' },
  { label: 'Order', value: 'Order' },
  { label: 'Policy', value: 'Policy' },
  { label: 'Guidelines', value: 'Guidelines' },
  { label: 'Manual', value: 'Manual' },
  { label: 'Report', value: 'Report' },
  { label: 'Other', value: 'Other' },
];

export default function Repository() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [compliance, setCompliance] = useState('');
  const [docType, setDocType] = useState('');

  const [bookmarked, setBookmarked] = useState<string[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Debounce search input
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDocuments({
        search: searchQuery || undefined,
        compliance: compliance || undefined,
        docType: docType || undefined,
        page,
        pageSize: PAGE_SIZE,
      });
      setDocuments(data.documents);
      setTotal(data.total);
    } catch (err) {
      setError((err as Error).message);
      setDocuments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, compliance, docType, page]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF documents are supported by DocSort.');
      return;
    }
    try {
      setIsUploading(true);
      toast.info(`Processing ${file.name} through the DocSort pipeline...`);
      const created = await uploadDocument(file);
      toast.success(`Processed ${file.name} (${created.compliance})`);
      await loadDocuments();
      setSelectedDoc(created);
      setIsModalOpen(true);
    } catch (err) {
      toast.error(`Processing error: ${(err as Error).message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  };

  const handlePreview = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const doc = await fetchDocument(id);
      setSelectedDoc(doc);
      setIsModalOpen(true);
    } catch (err) {
      toast.error(`Could not load document: ${(err as Error).message}`);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDocument(id);
      toast.success('Document deleted');
      await loadDocuments();
    } catch (err) {
      toast.error('Delete failed: ' + (err as Error).message);
    }
  };

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookmarked((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(searchQuery || compliance || docType);

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="text-muted-foreground hover:text-foreground">
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Repository</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
              Document Repository
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Search, filter, and inspect verified regulatory documents and metadata.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDocuments}
            className="rounded-lg shadow-xs"
          >
            <RefreshCw className="size-3.5 mr-1.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf"
        className="hidden"
      />

      {/* Upload Dropzone */}
      <Card
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed cursor-pointer transition-all ${
          isDragging
            ? 'border-primary bg-primary/5 scale-[0.99]'
            : 'border-border/80 hover:border-primary/50 bg-muted/20 hover:bg-muted/30'
        }`}
      >
        <CardContent className="p-8 lg:p-12 flex flex-col items-center justify-center text-center">
          <div className="size-14 rounded-2xl bg-muted border border-border flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
            {isUploading ? (
              <Spinner className="size-6 text-foreground" />
            ) : (
              <UploadCloud className="size-6 text-foreground" />
            )}
          </div>
          <p className="text-base font-semibold text-foreground mb-1">
            {isUploading
              ? 'Executing DocSort Triaging Pipeline...'
              : 'Click or drag and drop a regulatory PDF'}
          </p>
          <p className="text-xs text-muted-foreground max-w-md">
            Stage 1 linear filter &rarr; Stage 2 instruction-tuned schema extraction &rarr; Stage 3 verbatim verification.
          </p>
        </CardContent>
      </Card>

      {/* Filter and Table Card */}
      <Card>
        <div className="p-4 lg:p-6 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">All Documents</h2>
            <Badge variant="secondary" className="font-mono text-xs">
              {total}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Compliance filter select */}
            <select
              value={compliance}
              onChange={(e) => {
                setCompliance(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {COMPLIANCE_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Document type filter select */}
            <select
              value={docType}
              onChange={(e) => {
                setDocType(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {DOC_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search title, Ref ID, authority..."
                className="pl-9 h-9 w-64 text-xs bg-background"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="p-6 text-sm text-destructive bg-destructive/5 border-b border-border">
            Could not reach backend service: {error}
          </div>
        )}

        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Ref ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Authority</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc, i) => (
                <TableRow
                  key={doc.id}
                  onClick={() => handlePreview(doc.id)}
                  className="cursor-pointer group"
                >
                  <TableCell className="font-mono text-xs text-muted-foreground group-hover:text-foreground font-medium">
                    {doc.docNumber}
                  </TableCell>
                  <TableCell className="font-medium text-foreground max-w-sm truncate">
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{doc.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {doc.docType || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                    {doc.department || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px] font-normal py-0">
                      {doc.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono font-medium">
                    <span
                      className={
                        doc.complianceScore >= 80
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : doc.complianceScore >= 50
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-destructive'
                      }
                    >
                      {doc.complianceScore}%
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {doc.uploadDate}
                  </TableCell>
                  <TableCell>{getComplianceBadge(doc.compliance)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => toggleBookmark(doc.id, e)}
                        className={`size-7 text-muted-foreground hover:text-foreground ${
                          bookmarked.includes(doc.id) ? 'text-primary' : ''
                        }`}
                        title="Bookmark"
                      >
                        <Bookmark
                          size={14}
                          fill={bookmarked.includes(doc.id) ? 'currentColor' : 'none'}
                        />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                            />
                          }
                        >
                          <MoreVertical size={14} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-36">
                          <DropdownMenuItem
                            onClick={(e) => handlePreview(doc.id, e)}
                            className="cursor-pointer"
                          >
                            <Eye className="size-3.5 mr-2" />
                            <span>Preview</span>
                          </DropdownMenuItem>
                          {doc.fileUrl && (
                            <DropdownMenuItem
                              onClick={() => window.open(doc.fileUrl, '_blank')}
                              className="cursor-pointer"
                            >
                              <ExternalLink className="size-3.5 mr-2" />
                              <span>Open Tab</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => handleDelete(doc.id, e)}
                            className="cursor-pointer"
                          >
                            <Trash2 className="size-3.5 mr-2" />
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Spinner className="size-4" />
                      <span>Loading documents…</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!loading && documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-28 text-center text-muted-foreground">
                    {hasFilters ? 'No documents match these filters.' : 'No documents uploaded yet.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.max(1, p - 1));
                    }}
                    className={page <= 1 ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <PaginationItem key={p}>
                    <PaginationLink
                      href="#"
                      isActive={p === page}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(p);
                      }}
                      className="cursor-pointer"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setPage((p) => Math.min(totalPages, p + 1));
                    }}
                    className={page >= totalPages ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>

      <DocumentModal
        isOpen={isModalOpen}
        document={selectedDoc}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
