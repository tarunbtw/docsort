import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { getComplianceBadge } from './Dashboard';

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

const OVERRIDE_OPTIONS: ComplianceStatus[] = [
  'Verified',
  'Needs Review',
  'Superseded',
  'Not Procurement',
];

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
            Compliance Review Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Documents segregated by linear triage, superseded by revisions, or flagged during verbatim verification.
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs w-fit">
          {docs.length} pending review
        </Badge>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5 text-destructive">
          <CardContent className="p-4 text-sm flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Could not reach backend service: {error}</span>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading compliance queue…
        </div>
      )}

      <div className="grid gap-4">
        <AnimatePresence>
          {docs.map((doc, i) => (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ delay: i * 0.04 }}
              key={doc.id}
            >
              <Card className="hover:border-foreground/20 transition-all shadow-xs">
                <CardContent className="p-5 flex flex-col md:flex-row items-start gap-4">
                  {/* Status Indicator Icon */}
                  <div
                    className={`p-3 rounded-xl shrink-0 border ${
                      doc.compliance === 'Needs Review'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : doc.compliance === 'Not Procurement'
                        ? 'bg-destructive/10 text-destructive border-destructive/30'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    <ShieldAlert size={22} />
                  </div>

                  <div className="flex-1 w-full min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          {doc.docNumber}
                        </span>
                        {getComplianceBadge(doc.compliance)}
                        {doc.status === 'uncertain' && (
                          <Badge variant="secondary" className="text-[10px]">
                            Low confidence
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Uploaded: {doc.uploadDate}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-foreground mb-2">
                      {doc.title}
                    </h3>

                    {/* Metadata attributes */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span>Authority: <strong className="text-foreground font-medium">{doc.department || '—'}</strong></span>
                      <span>&bull;</span>
                      <span>Category: <strong className="text-foreground font-medium">{doc.category}</strong></span>
                      {doc.docType && (
                        <>
                          <span>&bull;</span>
                          <span>Type: <strong className="text-foreground font-medium">{doc.docType}</strong></span>
                        </>
                      )}
                      <span>&bull;</span>
                      <span>Compliance Score: <strong className="text-foreground font-medium font-mono">{doc.complianceScore}%</strong></span>
                    </div>

                    {/* Review Reason Callout */}
                    <div className="bg-muted/40 border border-border rounded-xl p-3.5 mb-4">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground">Trigger Reason: </span>
                        {explain(doc)}
                      </p>
                    </div>

                    {/* Action Dialogs */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Acknowledge Dialog */}
                      <Dialog>
                        <DialogTrigger
                          render={
                            <Button
                              variant="default"
                              size="sm"
                              disabled={busyId === doc.id}
                              className="gap-1.5"
                            />
                          }
                        >
                          <CheckCircle className="size-4" />
                          <span>Acknowledge Risk</span>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Acknowledge Compliance Warning</DialogTitle>
                            <DialogDescription>
                              Records that an authorized reviewer manually validated this document. It will be marked <strong className="text-foreground">Verified</strong> and an entry logged in the audit trail.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter className="gap-2 sm:gap-0">
                            <DialogClose render={<Button variant="outline" size="sm" />}>
                              Cancel
                            </DialogClose>
                            <DialogClose
                              render={
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleAction(doc, 'acknowledge')}
                                />
                              }
                            >
                              Confirm Verification
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {/* Override Status Dialog */}
                      <Dialog>
                        <DialogTrigger
                          render={
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busyId === doc.id}
                              className="gap-1.5"
                            />
                          }
                        >
                          <XCircle className="size-4" />
                          <span>Override Status</span>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Manual Status Override</DialogTitle>
                            <DialogDescription>
                              Select the explicit status to designate for document <strong className="font-mono text-foreground">{doc.docNumber}</strong>.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-2">
                            <label className="text-xs font-medium text-muted-foreground block mb-2">
                              Target Compliance State
                            </label>
                            <select
                              value={overrideStatus}
                              onChange={(e) => setOverrideStatus(e.target.value as ComplianceStatus)}
                              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              {OVERRIDE_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          </div>
                          <DialogFooter className="gap-2 sm:gap-0">
                            <DialogClose render={<Button variant="outline" size="sm" />}>
                              Cancel
                            </DialogClose>
                            <DialogClose
                              render={
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleAction(doc, 'override')}
                                />
                              }
                            >
                              Apply Override
                            </DialogClose>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && !error && docs.length === 0 && (
          <Card className="text-center py-12">
            <CardContent className="flex flex-col items-center justify-center">
              <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
                <CheckCircle size={24} />
              </div>
              <h3 className="text-base font-semibold text-foreground">Queue is Clear</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                No segregated, superseded, or unverified documents are pending compliance review.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
