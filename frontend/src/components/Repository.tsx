import React, { useState, useEffect, useRef } from 'react';
import { Search, UploadCloud, Filter, Bookmark, Paperclip, MoreVertical, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

import { 
  fetchDocuments, 
  uploadDocument, 
  deleteDocument, 
  fetchDocument, 
  DocumentListItem, 
  DocumentRecord 
} from '../lib/api';
import { mockDocuments } from '../data';
import DocumentModal from './DocumentModal';

// Shadcn imports
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
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
  PaginationEllipsis,
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
} from "@/components/ui/dropdown-menu";

export default function Repository() {
  const [documents, setDocuments] = useState<DocumentListItem[]>(mockDocuments);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [bookmarked, setBookmarked] = useState<string[]>([]);
  
  // Modal state
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await fetchDocuments({ search: searchQuery });
      if (data && data.length > 0) {
        setDocuments(data);
      } else {
        setDocuments(mockDocuments);
      }
    } catch (err) {
      console.warn('Backend not reachable, displaying mock data:', err);
      setDocuments(mockDocuments);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [searchQuery]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF documents are supported by DocSort.');
      return;
    }

    try {
      setIsUploading(true);
      toast.info(`Processing ${file.name} through DocSort pipeline...`);
      const created = await uploadDocument(file);
      toast.success(`Successfully processed ${file.name}`);
      await loadDocuments();

      // Automatically open the preview modal for the processed document
      setSelectedDoc(created);
      setIsModalOpen(true);
    } catch (err: any) {
      toast.error(`Processing error: ${err.message || 'Failed to upload document'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePreview = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const doc = await fetchDocument(id);
      setSelectedDoc(doc);
      setIsModalOpen(true);
    } catch {
      // Fallback: mock doc view
      const mock = documents.find(d => d.id === id);
      if (mock) {
        setSelectedDoc({
          id: mock.id,
          docNumber: mock.docNumber,
          fileName: mock.title + '.pdf',
          filePath: '',
          fileUrl: mock.fileUrl || '/sample.pdf',
          fileSize: 1024 * 350,
          mimeType: 'application/pdf',
          status: 'processed',
          relevanceConfidence: 0.98,
          compliance: mock.compliance,
          complianceScore: mock.complianceScore,
          uploadedAt: mock.uploadDate,
          metadata: {
            documentId: mock.id,
            title: mock.title,
            date: '15 Jan 2026',
            issuingAuthority: mock.department,
            omNumber: mock.docNumber,
            categories: [mock.category],
            summary: 'Regulatory compliance circular regarding procurement procedures and threshold limits.',
            verificationFlags: [],
          }
        });
        setIsModalOpen(true);
      }
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDocument(id);
      toast.success('Document deleted');
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message);
    }
  };

  const toggleBookmark = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (bookmarked.includes(id)) {
      setBookmarked(bookmarked.filter(b => b !== id));
      toast('Bookmark removed');
    } else {
      setBookmarked([...bookmarked, id]);
      toast('Document bookmarked');
    }
  };

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
          <div className="flex items-center gap-4">
            <DatePicker />
            <Button 
              variant="outline" 
              onClick={loadDocuments}
              className="bg-[#141414] text-[#f5f5f5] border-[#262626] hover:bg-[#262626] hover:text-white rounded-full text-xs"
            >
              <RefreshCw className="mr-2 size-3.5" /> Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf"
        className="hidden"
      />
      
      {/* Upload Dropzone */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[#141414] border-2 border-[#262626] border-dashed rounded-[1.5rem] p-12 flex flex-col items-center justify-center mb-8 hover:border-[#525252] hover:bg-[#141414]/80 transition-all cursor-pointer group"
        onClick={() => fileInputRef.current?.click()}
      >
         <div className="bg-[#262626] p-4 rounded-full mb-4 group-hover:bg-[#525252] transition-colors">
            {isUploading ? <Spinner className="text-[#f5f5f5] size-8" /> : <UploadCloud size={32} className="text-[#f5f5f5]" />}
         </div>
         <p className="text-[#f5f5f5] font-medium mb-2 text-lg">
           {isUploading ? 'Executing DocSort Two-Stage Pipeline...' : 'Click or drag and drop to upload regulatory PDF'}
         </p>
         <p className="text-sm text-[#525252]">
           Stage 1 Linear Pre-Filter + Stage 2 LLM Extraction + Stage 3 Deterministic Verification
         </p>
      </motion.div>

      {/* Document Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg text-[#f5f5f5] font-medium">All Documents</h3>
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#525252] group-focus-within:text-[#a3a3a3] transition-colors" size={14} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, tag..." 
              className="bg-[#0a0a0a] text-sm text-[#f5f5f5] placeholder-[#525252] rounded-lg pl-9 pr-4 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-[#525252] transition-all border border-[#262626]"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-left text-sm">
            <thead className="text-[#525252] border-b border-[#262626]">
              <tr>
                <th className="pb-4 font-medium pl-2 w-10">
                  <Checkbox className="border-[#525252] data-[state=checked]:bg-white data-[state=checked]:text-black" />
                </th>
                <th className="pb-4 font-medium">Ref ID</th>
                <th className="pb-4 font-medium">Title</th>
                <th className="pb-4 font-medium">Department</th>
                <th className="pb-4 font-medium">Category</th>
                <th className="pb-4 font-medium">Score</th>
                <th className="pb-4 font-medium">Upload Date</th>
                <th className="pb-4 font-medium">Status</th>
                <th className="pb-4 font-medium text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, i) => (
                <motion.tr 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 + (i * 0.03) }}
                  key={doc.id} 
                  onClick={() => handlePreview(doc.id)}
                  className="border-b border-[#262626] last:border-0 hover:bg-[#0a0a0a] transition-colors group cursor-pointer"
                >
                  <td className="py-4 pl-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox className="border-[#525252] data-[state=checked]:bg-white data-[state=checked]:text-black" />
                  </td>
                  <td className="py-4 text-[#a3a3a3] group-hover:text-[#f5f5f5] transition-colors font-mono text-xs">{doc.docNumber}</td>
                  <td className="py-4 text-[#f5f5f5] font-medium pr-4">
                    <div className="flex items-center gap-2">
                      <Paperclip size={14} className="text-[#525252] shrink-0" />
                      <span className="truncate max-w-sm">{doc.title}</span>
                    </div>
                  </td>
                  <td className="py-4 text-[#a3a3a3] pr-4">{doc.department}</td>
                  <td className="py-4 text-[#a3a3a3] pr-4">
                    <span className="bg-[#262626] px-2 py-0.5 rounded text-xs">{doc.category}</span>
                  </td>
                  <td className="py-4 text-[#a3a3a3]">{doc.complianceScore}%</td>
                  <td className="py-4 text-[#525252] pr-4 whitespace-nowrap">{doc.uploadDate}</td>
                  <td className="py-4">
                    <Badge variant="outline" className={`font-medium ${
                      doc.compliance === 'Compliant' 
                        ? 'bg-white text-black border-transparent hover:bg-gray-200' 
                        : doc.compliance === 'Needs Review'
                          ? 'bg-[#262626] text-[#a3a3a3] border-[#525252] hover:bg-[#262626]'
                          : 'bg-[#0a0a0a] text-white border-[#525252] hover:bg-[#0a0a0a]'
                    }`}>
                      {doc.compliance}
                    </Badge>
                  </td>
                  <td className="py-4 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={(e) => toggleBookmark(doc.id, e)} className="h-8 w-8 text-[#a3a3a3] hover:text-white hover:bg-[#262626]">
                        <Bookmark size={16} fill={bookmarked.includes(doc.id) ? "currentColor" : "none"} />
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
        </div>

        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" className="text-[#a3a3a3] hover:text-white hover:bg-[#262626]" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive className="bg-white text-black hover:bg-gray-200">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" className="text-[#a3a3a3] hover:text-white hover:bg-[#262626]">2</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis className="text-[#525252]" />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" className="text-[#a3a3a3] hover:text-white hover:bg-[#262626]" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </motion.div>

      {/* Document Preview Modal */}
      <DocumentModal
        isOpen={isModalOpen}
        document={selectedDoc}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
