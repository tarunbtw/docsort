import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, UploadCloud, Bookmark, Paperclip, MoreVertical, RefreshCw } from 'lucide-react';
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

// Shadcn imports
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
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

const COMPLIANCE_OPTIONS = ['', 'Verified', 'Needs Review', 'Superseded', 'Not Procurement'];
const DOC_TYPE_OPTIONS = [
  '',
  'Office Memorandum',
  'Circular',
  'Notification',
  'Order',
  'Policy',
  'Guidelines',
  'Manual',
  'Report',
  'Other',
];

function complianceBadgeClass(compliance: string) {
  if (compliance === 'Verified') return 'bg-white text-black border-transparent hover:bg-gray-200';
  if (compliance === 'Needs Review') return 'bg-[#262626] text-[#a3a3a3] border-[#525252] hover:bg-[#262626]';
  return 'bg-[#0a0a0a] text-white border-[#525252] hover:bg-[#0a0a0a]';
}

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

  // Debounce the search box so we are not issuing a request per keystroke.
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
    <>
      <header className="flex flex-col gap-4 mb-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/" className="text-[#a3a3a3] hover:text-white">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-[#525252]" />
            <BreadcrumbItem>
              <BreadcrumbPage className="text-white">Repository</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-light text-[#f5f5f5]">Repository</h1>
          <Button
            variant="outline"
            onClick={loadDocuments}
            className="bg-[#141414] text-[#f5f5f5] border-[#262626] hover:bg-[#262626] hover:text-white rounded-full text-xs"
          >
            <RefreshCw className="mr-2 size-3.5" /> Refresh
          </Button>
        </div>
      </header>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf" className="hidden" />

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-[1.5rem] p-12 flex flex-col items-center justify-center mb-8 transition-all cursor-pointer group ${
          isDragging ? 'border-white bg-[#1a1a1a]' : 'bg-[#141414] border-[#262626] hover:border-[#525252]'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="bg-[#262626] p-4 rounded-full mb-4 group-hover:bg-[#525252] transition-colors">
          {isUploading ? <Spinner className="text-[#f5f5f5] size-8" /> : <UploadCloud size={32} className="text-[#f5f5f5]" />}
        </div>
        <p className="text-[#f5f5f5] font-medium mb-2 text-lg">
          {isUploading ? 'Running the DocSort pipeline...' : 'Click or drag and drop to upload a regulatory PDF'}
        </p>
        <p className="text-sm text-[#525252]">
          Stage 1 segregation + Stage 2 extraction + Stage 3 deterministic verification
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <h3 className="text-lg text-[#f5f5f5] font-medium">
            All Documents <span className="text-sm text-[#525252] font-normal">({total})</span>
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={compliance}
              onChange={(e) => { setCompliance(e.target.value); setPage(1); }}
              className="bg-[#0a0a0a] text-sm text-[#f5f5f5] rounded-lg px-3 py-2 border border-[#262626] focus:outline-none"
            >
              {COMPLIANCE_OPTIONS.map((opt) => (
                <option key={opt || 'all'} value={opt}>{opt || 'All compliance'}</option>
              ))}
            </select>
            <select
              value={docType}
              onChange={(e) => { setDocType(e.target.value); setPage(1); }}
              className="bg-[#0a0a0a] text-sm text-[#f5f5f5] rounded-lg px-3 py-2 border border-[#262626] focus:outline-none"
            >
              {DOC_TYPE_OPTIONS.map((opt) => (
                <option key={opt || 'all'} value={opt}>{opt || 'All types'}</option>
              ))}
            </select>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#525252] group-focus-within:text-[#a3a3a3] transition-colors" size={14} />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search title, OM number, authority..."
                className="bg-[#0a0a0a] text-sm text-[#f5f5f5] placeholder-[#525252] rounded-lg pl-9 pr-4 py-2 w-72 focus:outline-none focus:ring-1 focus:ring-[#525252] transition-all border border-[#262626]"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-6 text-[#a3a3a3] mb-4">
            Could not reach the backend: {error}
          </div>
        )}

        {!error && (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left text-sm">
              <thead className="text-[#525252] border-b border-[#262626]">
                <tr>
                  <th className="pb-4 font-medium pl-2">Ref ID</th>
                  <th className="pb-4 font-medium">Title</th>
                  <th className="pb-4 font-medium">Type</th>
                  <th className="pb-4 font-medium">Authority</th>
                  <th className="pb-4 font-medium">Category</th>
                  <th className="pb-4 font-medium">Score</th>
                  <th className="pb-4 font-medium">Uploaded</th>
                  <th className="pb-4 font-medium">Compliance</th>
                  <th className="pb-4 font-medium text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, i) => (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.03 + i * 0.02 }}
                    key={doc.id}
                    onClick={() => handlePreview(doc.id)}
                    className="border-b border-[#262626] last:border-0 hover:bg-[#0a0a0a] transition-colors group cursor-pointer"
                  >
                    <td className="py-4 pl-2 text-[#a3a3a3] group-hover:text-[#f5f5f5] transition-colors font-mono text-xs">{doc.docNumber}</td>
                    <td className="py-4 text-[#f5f5f5] font-medium pr-4">
                      <div className="flex items-center gap-2">
                        <Paperclip size={14} className="text-[#525252] shrink-0" />
                        <span className="truncate max-w-sm">{doc.title}</span>
                      </div>
                    </td>
                    <td className="py-4 text-[#a3a3a3] pr-4 whitespace-nowrap">{doc.docType || '—'}</td>
                    <td className="py-4 text-[#a3a3a3] pr-4">{doc.department || '—'}</td>
                    <td className="py-4 text-[#a3a3a3] pr-4">
                      <span className="bg-[#262626] px-2 py-0.5 rounded text-xs">{doc.category}</span>
                    </td>
                    <td className="py-4 text-[#a3a3a3]">{doc.complianceScore}%</td>
                    <td className="py-4 text-[#525252] pr-4 whitespace-nowrap">{doc.uploadDate}</td>
                    <td className="py-4">
                      <Badge variant="outline" className={`font-medium ${complianceBadgeClass(doc.compliance)}`}>
                        {doc.compliance}
                      </Badge>
                    </td>
                    <td className="py-4 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" onClick={(e) => toggleBookmark(doc.id, e)} className="h-8 w-8 text-[#a3a3a3] hover:text-white hover:bg-[#262626]">
                          <Bookmark size={16} fill={bookmarked.includes(doc.id) ? 'currentColor' : 'none'} />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 text-[#a3a3a3] hover:text-white hover:bg-[#262626]" />}>
                            <MoreVertical size={16} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-[#141414] border-[#262626] text-[#a3a3a3]">
                            <DropdownMenuItem className="hover:bg-[#262626] hover:text-white cursor-pointer" onClick={(e) => handlePreview(doc.id, e)}>
                              Preview
                            </DropdownMenuItem>
                            {doc.fileUrl && (
                              <DropdownMenuItem className="hover:bg-[#262626] hover:text-white cursor-pointer" onClick={() => window.open(doc.fileUrl, '_blank')}>
                                Open in Tab
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-[#262626]" />
                            <DropdownMenuItem className="text-red-500 hover:bg-red-950/30 hover:text-red-400 cursor-pointer" onClick={(e) => handleDelete(doc.id, e)}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>

            {loading && <p className="text-[#525252] text-sm py-8 text-center">Loading documents…</p>}

            {!loading && documents.length === 0 && (
              <p className="text-[#525252] text-sm py-8 text-center">
                {hasFilters ? 'No documents match these filters.' : 'No documents uploaded yet.'}
              </p>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
                  className={`text-[#a3a3a3] hover:text-white hover:bg-[#262626] ${page <= 1 ? 'pointer-events-none opacity-40' : ''}`}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink
                    href="#"
                    isActive={p === page}
                    onClick={(e) => { e.preventDefault(); setPage(p); }}
                    className={p === page ? 'bg-white text-black hover:bg-gray-200' : 'text-[#a3a3a3] hover:text-white hover:bg-[#262626]'}
                  >
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
                  className={`text-[#a3a3a3] hover:text-white hover:bg-[#262626] ${page >= totalPages ? 'pointer-events-none opacity-40' : ''}`}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </motion.div>

      <DocumentModal isOpen={isModalOpen} document={selectedDoc} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
