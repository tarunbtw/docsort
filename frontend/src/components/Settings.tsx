import React, { useState } from 'react';
import { Database, Tags, Shield, X, Plus, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export default function Settings() {
  const [categories, setCategories] = useState([
    'Financials',
    'Legal',
    'HR & Policies',
    'Vendor Contracts',
    'Security',
    'Memos',
  ]);
  const [newCat, setNewCat] = useState('');
  const [strictness, setStrictness] = useState([7]);

  const handleSave = (setting: string) => {
    toast.success(`${setting} settings saved successfully.`);
  };

  const addCategory = () => {
    if (newCat.trim() && !categories.includes(newCat.trim())) {
      setCategories([...categories, newCat.trim()]);
      setNewCat('');
    }
  };

  const removeCategory = (cat: string) => {
    setCategories(categories.filter((c) => c !== cat));
  };

  const handleReset = () => {
    toast.error('System defaults restored. Custom configurations wiped.');
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
          System Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure taxonomy, LLM extraction rules, and storage preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classification & Rules */}
        <div className="space-y-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              Classification & Rules
            </h2>
          </div>

          {/* Category Taxonomy Card */}
          <Card>
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Tags size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Category Taxonomy</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage {categories.length} active regulatory classification categories
                  </p>
                </div>
              </div>

              <Dialog>
                <DialogTrigger render={<Button variant="outline" size="sm" />}>
                  Edit Taxonomy
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Categories</DialogTitle>
                    <DialogDescription>
                      Add or remove category labels used for Stage 2 closed-set classification.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 rounded-lg bg-muted/40 border border-border">
                      {categories.map((cat) => (
                        <Badge
                          key={cat}
                          variant="secondary"
                          className="gap-1 pr-1 text-xs"
                        >
                          <span>{cat}</span>
                          <button
                            onClick={() => removeCategory(cat)}
                            className="text-muted-foreground hover:text-foreground rounded-full p-0.5"
                          >
                            <X size={12} />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. Procurement, Tenders..."
                        value={newCat}
                        onChange={(e) => setNewCat(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                        className="text-xs"
                      />
                      <Button variant="outline" size="sm" onClick={addCategory} className="px-3">
                        <Plus size={16} />
                      </Button>
                    </div>
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
                          onClick={() => handleSave('Taxonomy')}
                        />
                      }
                    >
                      Save Changes
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          {/* Compliance Ruleset Card */}
          <Card>
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Compliance Ruleset</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Thresholds and automated decision triggers
                  </p>
                </div>
              </div>

              <Dialog>
                <DialogTrigger render={<Button variant="outline" size="sm" />}>
                  Configure
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Configure Ruleset</DialogTitle>
                    <DialogDescription>
                      Adjust AI confidence cutoffs and automatic risk segregation flags.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-5 py-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="auto-approve" className="text-xs font-medium cursor-pointer">
                            Auto-approve verified documents
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Skip manual review if verbatim check passes 100%
                          </p>
                        </div>
                        <Switch id="auto-approve" defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="strict-vendor" className="text-xs font-medium cursor-pointer">
                            Strict vendor reference checks
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Flag any document missing explicit OM identifiers
                          </p>
                        </div>
                        <Switch id="strict-vendor" />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Relevance Triage Confidence</Label>
                        <span className="font-mono text-xs font-bold text-foreground">
                          {strictness[0]}0%
                        </span>
                      </div>
                      <Slider
                        value={strictness}
                        onValueChange={setStrictness}
                        max={10}
                        step={1}
                        className="py-2"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Higher confidence reduces false positives while increasing manual queue size.
                      </p>
                    </div>
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
                          onClick={() => handleSave('Compliance Rules')}
                        />
                      }
                    >
                      Save Configuration
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* System Preferences */}
        <div className="space-y-4">
          <div className="border-b border-border pb-2">
            <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
              System Preferences
            </h2>
          </div>

          <Card>
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="size-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Storage &amp; OCR Engine</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Storage persistence provider and PDF extraction engine
                  </p>
                </div>
              </div>

              <Dialog>
                <DialogTrigger render={<Button variant="outline" size="sm" />}>
                  Manage
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Storage &amp; OCR Preferences</DialogTitle>
                    <DialogDescription>
                      Configure cloud blob storage and text extraction engines.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Storage Provider</Label>
                      <Select defaultValue="local">
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="local">Local Filesystem Storage</SelectItem>
                          <SelectItem value="s3">Amazon Web Services S3</SelectItem>
                          <SelectItem value="gcs">Google Cloud Storage</SelectItem>
                          <SelectItem value="azure">Azure Blob Storage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Text Extraction Pipeline</Label>
                      <Select defaultValue="pdfplumber">
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select engine" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pdfplumber">pdfplumber (Local Deterministic)</SelectItem>
                          <SelectItem value="pypdf">pypdf (Fast Stream)</SelectItem>
                          <SelectItem value="tesseract">Tesseract OCR (Scanned Image)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div>
                        <Label htmlFor="retain-files" className="text-xs font-medium cursor-pointer">
                          Retain Raw PDF Streams
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Archive immutable originals for legal audit
                        </p>
                      </div>
                      <Switch id="retain-files" defaultChecked />
                    </div>
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
                          onClick={() => handleSave('Storage')}
                        />
                      }
                    >
                      Update Preferences
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-4 pt-4">
        <div className="border-b border-border pb-2">
          <h2 className="text-sm font-semibold text-destructive uppercase tracking-wider">
            Danger Zone
          </h2>
        </div>

        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-11 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Reset System Defaults</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanently wipe custom taxonomy configurations and revert to defaults.
                </p>
              </div>
            </div>

            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  />
                }
              >
                Reset Defaults
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-destructive flex items-center gap-2">
                    <AlertTriangle size={18} />
                    <span>Confirm Factory Reset</span>
                  </DialogTitle>
                  <DialogDescription>
                    This action will reset all category taxonomies, compliance strictness thresholds, and custom preferences back to factory defaults.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                  <DialogClose render={<Button variant="outline" size="sm" />}>
                    Cancel
                  </DialogClose>
                  <DialogClose
                    render={
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleReset}
                      />
                    }
                  >
                    Confirm System Reset
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
