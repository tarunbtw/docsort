import React from 'react';
import { X, ExternalLink, ShieldCheck, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DocumentRecord } from '../lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getComplianceBadge } from './Dashboard';

interface DocumentModalProps {
  document: DocumentRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function DocumentModal({ document, isOpen, onClose }: DocumentModalProps) {
  if (!isOpen || !document) return null;

  const meta = document.metadata;
  const flags = meta?.verificationFlags || [];
  const extractionRan = !document.extractionStatus || document.extractionStatus === 'ok';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/80 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="bg-card text-card-foreground border border-border rounded-2xl w-full max-w-6xl h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-muted-foreground font-semibold">
                    {document.docNumber}
                  </span>
                  {getComplianceBadge(document.compliance)}
                  {document.status === 'uncertain' && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px]">
                      Low-confidence classification
                    </Badge>
                  )}
                  {document.supersededBy && (
                    <Badge variant="outline" className="bg-muted text-muted-foreground text-[11px]">
                      Superseded by {document.supersededBy.slice(0, 8)}
                    </Badge>
                  )}
                </div>
                <h2 className="text-sm sm:text-base font-semibold text-foreground truncate max-w-xl">
                  {meta?.title || document.fileName}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {document.fileUrl && (
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-flex"
                >
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <ExternalLink size={13} />
                    <span>Raw PDF</span>
                  </Button>
                </a>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Close dialog"
              >
                <X size={16} />
              </Button>
            </div>
          </div>

          {/* Split Body */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
            {/* Left: PDF Viewer */}
            <div className="lg:col-span-7 bg-muted/15 p-4 flex flex-col h-full border-r border-border">
              <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between font-medium">
                <span>Embedded Source PDF</span>
                <span className="font-mono text-[10px]">{document.fileName}</span>
              </div>
              <div className="flex-1 w-full h-full rounded-xl overflow-hidden border border-border bg-muted/30">
                <iframe
                  src={document.fileUrl}
                  title={document.fileName}
                  className="w-full h-full rounded-xl"
                />
              </div>
            </div>

            {/* Right: Extracted Metadata & Verification Audit */}
            <div className="lg:col-span-5 p-6 overflow-y-auto flex flex-col gap-5 bg-card">
              {/* Compliance & Confidence Score Card */}
              <Card className="border-border bg-muted/20 shadow-none">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Compliance Rating
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {document.complianceScore}%
                    </span>
                  </div>
                  <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        document.complianceScore >= 80
                          ? 'bg-emerald-500'
                          : document.complianceScore >= 50
                          ? 'bg-amber-500'
                          : 'bg-destructive'
                      }`}
                      style={{ width: `${document.complianceScore}%` }}
                    />
                  </div>
                  {document.relevanceConfidence > 0 && (
                    <div className="mt-3 text-[11px] text-muted-foreground flex justify-between">
                      <span>Stage 1 Classifier Confidence</span>
                      <span className="font-mono font-semibold text-foreground">
                        {(document.relevanceConfidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Verified Metadata Fields */}
              <div className="space-y-3.5">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                    Official Reference Identifier
                  </label>
                  <p className="text-xs font-mono text-foreground bg-muted/30 p-2.5 rounded-lg border border-border">
                    {meta?.omNumber || 'Not specified in header'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                      Issue Date
                    </label>
                    <p className="text-xs text-foreground bg-muted/30 p-2.5 rounded-lg border border-border">
                      {meta?.date || (extractionRan ? 'Not found' : 'Not extracted')}
                    </p>
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                      Issuing Authority
                    </label>
                    <p
                      className="text-xs text-foreground bg-muted/30 p-2.5 rounded-lg border border-border truncate"
                      title={meta?.issuingAuthority}
                    >
                      {meta?.issuingAuthority || (extractionRan ? 'Not found' : 'Not extracted')}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                    Document Classification
                  </label>
                  <p className="text-xs text-foreground bg-muted/30 p-2.5 rounded-lg border border-border">
                    {meta?.docType || (extractionRan ? 'Other' : 'Not extracted')}
                  </p>
                </div>

                {meta?.categories && meta.categories.length > 0 && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Classified Categories
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {meta.categories.map((cat, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs font-medium">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {meta?.supersedes && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                      Supersedes Reference
                    </label>
                    <p className="text-xs text-foreground bg-muted/30 p-2.5 rounded-lg border border-border font-mono">
                      {meta.supersedes}
                    </p>
                  </div>
                )}

                {meta?.supersededDocuments && meta.supersededDocuments.length > 0 && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                      Superseded Documents ({meta.supersededDocuments.length})
                    </label>
                    <ul className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border space-y-1">
                      {meta.supersededDocuments.map((ref, i) => (
                        <li key={i} className="font-mono text-foreground">{ref}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {document.llmProvider && (
                  <div className="text-[11px] text-muted-foreground flex justify-between py-1 border-t border-border">
                    <span>Extraction engine:</span>
                    <span className="font-mono font-medium text-foreground">
                      {document.llmProvider}{document.llmModel ? ` / ${document.llmModel}` : ''}
                    </span>
                  </div>
                )}

                {meta?.summary && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                      Executive Regulatory Summary
                    </label>
                    <p className="text-xs leading-relaxed text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border">
                      {meta.summary}
                    </p>
                  </div>
                )}
              </div>

              {/* Stage 3 Verbatim Verification Audit Panel */}
              <div className="mt-auto pt-4 border-t border-border">
                <div className="flex items-center gap-2 mb-2.5">
                  <ShieldCheck size={16} className="text-foreground" />
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Stage 3 Audit Trail
                  </span>
                </div>

                {!extractionRan ? (
                  <div className="flex items-start gap-2.5 bg-muted/40 border border-border p-3 rounded-xl text-xs text-muted-foreground">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>
                      Verification was skipped: metadata extraction did not run
                      {` (${document.extractionStatus})`}. No extracted values exist to check
                      against the source document.
                    </span>
                  </div>
                ) : flags.length === 0 ? (
                  <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                    <span>
                      All extracted factual parameters verified verbatim against normalized document source.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-700 dark:text-amber-300">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
                      <span className="font-semibold">
                        Verification Warnings ({flags.length}):
                      </span>
                    </div>
                    <ul className="list-disc list-inside text-[11px] opacity-90 space-y-1 ml-1">
                      {flags.map((f, i) => (
                        <li key={i}>
                          Field{' '}
                          <span className="font-mono font-medium px-1 py-0.5 bg-background rounded border border-border">
                            {f}
                          </span>{' '}
                          could not be verified verbatim in source text.
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
