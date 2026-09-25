import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { mockDocuments } from '../data';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

// Shadcn imports
import { Button } from '@/components/ui/button';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
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

export default function Compliance() {
  const [docs, setDocs] = useState(mockDocuments.filter(d => d.compliance !== 'Compliant'));
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleAction = (id: string, actionType: string) => {
    setActiveAction(id);
    setTimeout(() => {
      setDocs(docs.filter(d => d.id !== id));
      toast.success(`Document ${actionType === 'ack' ? 'risk acknowledged' : 'status overridden to Compliant'}`);
      setActiveAction(null);
    }, 1000);
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-light text-[#f5f5f5]">Compliance Review</h1>
        <p className="text-[#a3a3a3] mt-2">Review automatically flagged documents for contradictions and outdated rules.</p>
      </header>

      <div className="grid gap-4">
        <AnimatePresence>
        {docs.map((doc, i) => (
          <motion.div 
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.1 }}
            key={doc.id} 
            className="bg-[#141414] p-6 rounded-[1.5rem] flex flex-col md:flex-row items-start gap-4 border border-[#262626] hover:border-[#525252] transition-colors"
          >
            <div className={`p-3 rounded-full shrink-0 border ${
              doc.compliance === 'Needs Review' ? 'bg-[#525252] text-[#141414] border-[#a3a3a3]' : 'bg-[#141414] text-[#f5f5f5] border-[#525252]'
            }`}>
              <AlertTriangle size={24} />
            </div>
            <div className="flex-1 w-full">
              <HoverCard>
                <HoverCardTrigger render={<h3 className="text-lg font-medium text-[#f5f5f5] mb-1 cursor-pointer w-fit border-b border-dashed border-[#525252]" />}>
                  {doc.title} <span className="text-sm text-[#525252] ml-2 font-normal">{doc.docNumber}</span>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 bg-[#0a0a0a] border-[#262626] text-[#a3a3a3]">
                  <div className="flex justify-between space-x-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white">Document Meta</h4>
                      <p className="text-sm">Uploaded on: {doc.uploadDate}</p>
                      <p className="text-sm">Compliance Score: {doc.complianceScore}%</p>
                      <p className="text-sm">Ref ID: {doc.docNumber}</p>
                    </div>
                  </div>
                </HoverCardContent>
              </HoverCard>
              <div className="flex gap-4 mb-4">
                <p className="text-sm text-[#a3a3a3]">Category: {doc.category}</p>
                <p className="text-sm text-[#a3a3a3]">Department: {doc.department}</p>
              </div>
              
              <div className="bg-[#0a0a0a] border border-[#262626] rounded-xl p-4 mb-4">
                <p className="text-sm text-[#a3a3a3] leading-relaxed">
                  <strong className="text-[#f5f5f5]">AI Analysis Flag:</strong> {
                    doc.compliance === 'Contradiction' 
                      ? 'This document contains clauses that directly contradict Section 4.2 of standard vendor terms regarding hardware warranties.' 
                      : 'This document references outdated bidding thresholds from 2023 and may be superseded.'
                  }
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Dialog>
                  <DialogTrigger render={<Button className="bg-white text-black hover:bg-gray-200" disabled={activeAction === doc.id} />}>
                    <CheckCircle className="mr-2 h-4 w-4" /> Acknowledge Risk
                  </DialogTrigger>
                  <DialogContent className="bg-[#141414] border-[#262626] text-[#f5f5f5]">
                    <DialogHeader>
                      <DialogTitle>Acknowledge Risk</DialogTitle>
                      <DialogDescription className="text-[#a3a3a3]">
                        Are you sure you want to acknowledge this risk? The document will remain flagged but marked as reviewed.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" className="border-red-900/50 text-red-500 hover:bg-red-950/30 hover:text-red-400" />}>Cancel</DialogClose>
                      <DialogClose render={<Button className="bg-white text-black hover:bg-gray-200" onClick={() => handleAction(doc.id, 'ack')} />}>Confirm</DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger render={<Button variant="outline" className="bg-[#262626] text-[#f5f5f5] border-[#525252] hover:bg-[#525252] hover:text-white" disabled={activeAction === doc.id} />}>
                    <XCircle className="mr-2 h-4 w-4" /> Override Status
                  </DialogTrigger>
                  <DialogContent className="bg-[#141414] border-[#262626] text-[#f5f5f5]">
                    <DialogHeader>
                      <DialogTitle>Override Status</DialogTitle>
                      <DialogDescription className="text-[#a3a3a3]">
                        This will force the document status to Compliant and ignore the AI flags. Are you sure?
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose render={<Button variant="outline" className="border-red-900/50 text-red-500 hover:bg-red-950/30 hover:text-red-400" />}>Cancel</DialogClose>
                      <DialogClose render={<Button className="bg-white text-black hover:bg-gray-200" onClick={() => handleAction(doc.id, 'override')} />}>Confirm Override</DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </motion.div>
        ))}
        </AnimatePresence>
        {docs.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 bg-[#141414] rounded-[1.5rem] border border-[#262626]">
            <CheckCircle size={48} className="text-[#525252] mx-auto mb-4" />
            <h3 className="text-[#f5f5f5] font-medium text-lg">All caught up!</h3>
            <p className="text-[#a3a3a3]">There are no flagged documents requiring manual review.</p>
          </motion.div>
        )}
      </div>
    </>
  );
}
