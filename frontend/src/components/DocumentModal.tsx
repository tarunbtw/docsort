import React from 'react';
import { X, ExternalLink, ShieldCheck, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DocumentRecord } from '../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface DocumentModalProps {
  document: DocumentRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentModal({ document, isOpen, onClose }: DocumentModalProps) {
  if (!isOpen || !document) return null;

  const meta = document.metadata;
  const flags = meta?.verificationFlags || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          className="bg-[#141414] border border-[#262626] rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626] bg-[#0f0f0f]">
            <div className="flex items-center gap-3">
              <FileText className="text-white shrink-0" size={20} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#a3a3a3]">{document.docNumber}</span>
                  <Badge
                    variant="outline"
                    className={
                      document.compliance === 'Compliant'
                        ? 'bg-white text-black border-transparent'
                        : document.compliance === 'Needs Review'
                        ? 'bg-[#262626] text-[#a3a3a3] border-[#525252]'
                        : 'bg-[#0a0a0a] text-white border-[#525252]'
                    }
                  >
                    {document.compliance}
                  </Badge>
                  {document.status === 'not_relevant' && (
                    <Badge variant="outline" className="bg-amber-950/40 text-amber-300 border-amber-800">
                      Non-Procurement (Filtered)
                    </Badge>
                  )}
                </div>
                <h2 className="text-base font-medium text-white truncate max-w-xl">
                  {meta?.title || document.fileName}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href={document.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#a3a3a3] hover:text-white px-3 py-1.5 rounded-full border border-[#262626] bg-[#141414] transition-colors"
              >
                <ExternalLink size={14} /> Open Raw PDF
              </a>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-[#a3a3a3] hover:text-white hover:bg-[#262626] rounded-full"
              >
                <X size={18} />
              </Button>
            </div>
          </div>

          {/* Split Body */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            {/* Left: PDF Viewer */}
            <div className="lg:col-span-7 bg-[#0a0a0a] p-4 flex flex-col h-full border-r border-[#262626]">
              <div className="text-xs text-[#525252] mb-2 flex items-center justify-between">
                <span>Integrated PDF Viewer</span>
                <span>Original Source Stream</span>
              </div>
              <div className="flex-1 w-full h-full rounded-xl overflow-hidden border border-[#262626] bg-[#1a1a1a]">
                <iframe
                  src={document.fileUrl}
                  title={document.fileName}
                  className="w-full h-full rounded-xl"
                />
              </div>
            </div>

            {/* Right: Extracted Metadata & Verification Audit */}
            <div className="lg:col-span-5 p-6 overflow-y-auto flex flex-col gap-6 bg-[#141414]">
              {/* Compliance & Confidence Summary */}
              <div className="bg-[#0f0f0f] p-4 rounded-xl border border-[#262626]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-[#a3a3a3]">Compliance Score</span>
                  <span className="text-sm font-semibold text-white">{document.complianceScore}%</span>
                </div>
                <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-white h-full rounded-full transition-all duration-500"
                    style={{ width: `${document.complianceScore}%` }}
                  />
                </div>
                {document.relevanceConfidence > 0 && (
                  <div className="mt-3 text-[11px] text-[#525252] flex justify-between">
                    <span>Stage 1 Classifier Confidence</span>
                    <span className="text-[#a3a3a3]">{(document.relevanceConfidence * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>

              {/* Verified Metadata Fields */}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[#525252] block mb-1">
                    Official Reference Number
                  </label>
                  <p className="text-sm font-mono text-white bg-[#0a0a0a] p-2.5 rounded-lg border border-[#262626]">
                    {meta?.omNumber || 'Not specified in header'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-[#525252] block mb-1">
                      Issue Date
                    </label>
                    <p className="text-sm text-white bg-[#0a0a0a] p-2.5 rounded-lg border border-[#262626]">
                      {meta?.date || 'Undated'}
                    </p>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-[#525252] block mb-1">
                      Issuing Authority
                    </label>
                    <p className="text-sm text-white bg-[#0a0a0a] p-2.5 rounded-lg border border-[#262626] truncate" title={meta?.issuingAuthority}>
                      {meta?.issuingAuthority || 'Government Body'}
                    </p>
                  </div>
                </div>

                {meta?.categories && meta.categories.length > 0 && (
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-[#525252] block mb-1.5">
                      Classified Taxonomy
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {meta.categories.map((cat, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-[#262626] text-[#e5e5e5] px-2.5 py-1 rounded-md border border-[#333]"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {meta?.supersedes && (
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-[#525252] block mb-1">
                      Supersedes Reference
                    </label>
                    <p className="text-xs text-[#a3a3a3] bg-[#0a0a0a] p-2.5 rounded-lg border border-[#262626]">
                      {meta.supersedes}
                    </p>
                  </div>
                )}

                {meta?.summary && (
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-[#525252] block mb-1">
                      Executive Regulatory Summary
                    </label>
                    <p className="text-xs leading-relaxed text-[#d4d4d4] bg-[#0a0a0a] p-3 rounded-lg border border-[#262626]">
                      {meta.summary}
                    </p>
                  </div>
                )}
              </div>

              {/* Stage 3 Verbatim Verification Audit Panel */}
              <div className="mt-auto pt-4 border-t border-[#262626]">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={16} className="text-white" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Stage 3 Audit Trail
                  </span>
                </div>

                {flags.length === 0 ? (
                  <div className="flex items-start gap-2.5 bg-emerald-950/20 border border-emerald-800/40 p-3 rounded-xl text-xs text-emerald-300">
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                    <span>All extracted factual parameters verified verbatim against normalized document source.</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 bg-amber-950/20 border border-amber-800/40 p-3 rounded-xl text-xs text-amber-200">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="shrink-0 text-amber-400" />
                      <span className="font-medium">Verification Warnings ({flags.length}):</span>
                    </div>
                    <ul className="list-disc list-inside text-[11px] text-amber-300/80 space-y-0.5 ml-1">
                      {flags.map((f, i) => (
                        <li key={i}>
                          Field <span className="font-mono text-white bg-black/40 px-1 rounded">{f}</span> could not be verified verbatim in source text.
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
