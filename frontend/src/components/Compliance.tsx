import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { fetchDocuments, fetchDocument, reviewDocument, ComplianceStatus } from '../lib/api';

interface FlaggedDoc {
  id: string;
  docNumber: string;
  title: string;
  category: string;
  department: string;
  compliance: ComplianceStatus;
  complianceScore: number;
  uploadDate: string;
  status: string;
  docType?: string;
  extractionStatus?: string;
  supersededBy?: string;
  verificationFlags: string[];
  summary?: string;
}

const OVERRIDE_OPTIONS: ComplianceStatus[] = ['Verified', 'Needs Review', 'Superseded', 'Not Procurement'];

function explain(doc: FlaggedDoc): string {
  if (doc.compliance === 'Not Procurement') {
    return 'Segregated by the relevance pre-filter: this document does not concern contract or procurement regulation.';
  }
  if (doc.compliance === 'Superseded') {
    return `Voided by a newer document (${doc.supersededBy ? doc.supersededBy.slice(0, 8) : 'unknown reference'}).`;
  }
  if (doc.extractionStatus && doc.extractionStatus !== 'ok') {
    return `Metadata extraction did not complete (${doc.extractionStatus}); no fields could be verified against the source.`;
  }
  if (doc.verificationFlags.length > 0) {
    return `Extracted values could not be found verbatim in the source: ${doc.verificationFlags.join(', ')}.`;
  }
  if (doc.status === 'uncertain') {
    return 'The relevance pre-filter confidence was too low to segregate this document confidently.';
  }
  return 'Flagged for manual review.';
}

export default function Compliance() {
  const [docs, setDocs] = useState<FlaggedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<ComplianceStatus>('Verified');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchDocuments({ pageSize: 200 });
      const flagged = page.documents.filter((d) => d.compliance !== 'Verified');
      const detailed = await Promise.all(
        flagged.map(async (d) => {
          try {
            const full = await fetchDocument(d.id);
            return {
              ...d,
              extractionStatus: full.extractionStatus,
              supersededBy: full.supersededBy,
              verificationFlags: full.metadata?.verificationFlags ?? [],
              summary: full.metadata?.summary,
            } as FlaggedDoc;
          } catch {
            return { ...d, verificationFlags: [] } as FlaggedDoc;
          }
        }),
      );
      setDocs(detailed);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAction = async (doc: FlaggedDoc, action: 'acknowledge' | 'override') => {
    setBusyId(doc.id);
    try {
      await reviewDocument(doc.id, action, {
        status: action === 'override' ? overrideStatus : undefined,
        note: action === 'override' ? `Overridden to ${overrideStatus}` : 'Risk acknowledged',
      });
      toast.success(
        action === 'acknowledge'
          ? `${doc.docNumber} acknowledged and marked verified`
          : `${doc.docNumber} overridden to ${overrideStatus}`,
      );
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      toast.error(`Action failed: ${(err as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-light text-[#f5f5f5]">Compliance Review</h1>
        <p className="text-[#a3a3a3] mt-2">
          Documents that were segregated, superseded, or whose extracted fields could not be verified.
        </p>
      </header>

      {error && (
        <div className="bg-[#141414] border border-[#262626] rounded-[1.5rem] p-6 text-[#a3a3a3] mb-4">
          Could not reach the backend: {error}
        </div>
      )}
      {loading && <p className="text-[#a3a3a3]">Loading queue…</p>}

      <div className="grid gap-4">
        <AnimatePresence>
          {docs.map((doc, i) => (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.05 }}
              key={doc.id}
              className="bg-[#141414] p-6 rounded-[1.5rem] flex flex-col md:flex-row items-start gap-4 border border-[#262626] hover:border-[#525252] transition-colors"
            >
              <div className={`p-3 rounded-full shrink-0 border ${
                doc.compliance === 'Needs Review'
                  ? 'bg-[#525252] text-[#141414] border-[#a3a3a3]'
                  : 'bg-[#141414] text-[#f5f5f5] border-[#525252]'
              }`}>
                <AlertTriangle size={24} />
              </div>

              <div className="flex-1 w-full">
                <h3 className="text-lg font-medium text-[#f5f5f5] mb-1">
                  {doc.title} <span className="text-sm text-[#525252] ml-2 font-normal">{doc.docNumber}</span>
                </h3>

                <div className="flex flex-wrap gap-4 mb-4 mt-2">
                  <p className="text-sm text-[#a3a3a3]">Status: <span className="text-[#f5f5f5]">{doc.compliance}</span></p>
                  <p className="text-sm text-[#a3a3a3]">Category: {doc.category}</p>
                  <p className="text-sm text-[#a3a3a3]">Authority: {doc.department || '—'}</p>
                  {doc.docType && <p className="text-sm text-[#a3a3a3]">Type: {doc.docType}</p>}
                  <p className="text-sm text-[#a3a3a3]">Score: {doc.complianceScore}%</p>
                  <p className="text-sm text-[#a3a3a3]">Uploaded: {doc.uploadDate}</p>
                </div>

                <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 mb-4">
                  <p className="text-sm text-[#a3a3a3] leading-relaxed">
                    <strong className="text-[#f5f5f5]">Review reason:</strong> {explain(doc)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Dialog>
                    <DialogTrigger render={<Button className="bg-white text-black hover:bg-gray-200" disabled={busyId === doc.id} />}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Acknowledge
                    </DialogTrigger>
                    <DialogContent className="bg-[#141414] border-[#262626] text-[#f5f5f5]">
                      <DialogHeader>
                        <DialogTitle>Acknowledge</DialogTitle>
                        <DialogDescription className="text-[#a3a3a3]">
                          Records that a reviewer inspected this document. It will be marked <strong>Verified</strong> and the action written to the audit log.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose render={<Button variant="outline" className="border-[#525252] text-[#a3a3a3] hover:bg-[#262626]" />}>Cancel</DialogClose>
                        <DialogClose render={<Button className="bg-white text-black hover:bg-gray-200" onClick={() => handleAction(doc, 'acknowledge')} />}>Confirm</DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog>
                    <DialogTrigger render={<Button variant="outline" className="bg-[#262626] text-[#f5f5f5] border-[#525252] hover:bg-[#525252] hover:text-white" disabled={busyId === doc.id} />}>
                      <XCircle className="mr-2 h-4 w-4" /> Override Status
                    </DialogTrigger>
                    <DialogContent className="bg-[#141414] border-[#262626] text-[#f5f5f5]">
                      <DialogHeader>
                        <DialogTitle>Override Status</DialogTitle>
                        <DialogDescription className="text-[#a3a3a3]">
                          Sets the compliance status directly. The change is persisted and audited.
                        </DialogDescription>
                      </DialogHeader>
                      <select
                        value={overrideStatus}
                        onChange={(e) => setOverrideStatus(e.target.value as ComplianceStatus)}
                        className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2 text-sm text-[#f5f5f5]"
                      >
                        {OVERRIDE_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <DialogFooter>
                        <DialogClose render={<Button variant="outline" className="border-[#525252] text-[#a3a3a3] hover:bg-[#262626]" />}>Cancel</DialogClose>
                        <DialogClose render={<Button className="bg-white text-black hover:bg-gray-200" onClick={() => handleAction(doc, 'override')} />}>Confirm Override</DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && !error && docs.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 bg-[#141414] rounded-[1.5rem] border border-[#262626]">
            <CheckCircle size={48} className="text-[#525252] mx-auto mb-4" />
            <h3 className="text-[#f5f5f5] font-medium text-lg">Nothing to review</h3>
            <p className="text-[#a3a3a3]">No segregated, superseded or unverified documents are waiting.</p>
          </motion.div>
        )}
      </div>
    </>
  );
}
