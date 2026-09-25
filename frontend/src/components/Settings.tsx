import React, { useState } from 'react';
import { Database, Tags, Shield, X, Plus, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
  const [categories, setCategories] = useState(['Financials', 'Legal', 'HR & Policies', 'Vendor Contracts', 'Security', 'Memos']);
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
    setCategories(categories.filter(c => c !== cat));
  };

  const handleReset = () => {
    toast.error('System defaults restored. Custom configurations wiped.');
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-12">
       <header className="mb-8">
        <h1 className="text-3xl font-light text-[#f5f5f5]">Settings</h1>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <h2 className="text-lg font-medium text-[#a3a3a3] border-b border-[#262626] pb-2">Classification & Rules</h2>
          
          <div className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626] flex items-center justify-between hover:border-[#525252] transition-colors">
            <div className="flex items-center gap-4">
              <div className="bg-[#262626] p-3 rounded-lg text-[#f5f5f5]">
                <Tags size={24} />
              </div>
              <div>
                <h3 className="text-[#f5f5f5] font-medium">Category Taxonomy</h3>
                <p className="text-sm text-[#525252]">Manage {categories.length} active document categories</p>
              </div>
            </div>
            
            <Dialog>
              <DialogTrigger render={<Button variant="outline" className="text-[#f5f5f5] bg-[#262626] border-[#525252] hover:bg-[#525252] hover:text-white transition-colors" />}>Edit</DialogTrigger>
              <DialogContent className="bg-[#141414] border-[#262626] text-[#f5f5f5] max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Categories</DialogTitle>
                  <DialogDescription className="text-[#a3a3a3]">
                    Add or remove category tags for document classification.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {categories.map((cat) => (
                      <Badge key={cat} variant="secondary" className="bg-[#262626] text-[#f5f5f5] hover:bg-[#525252] pr-1.5 py-1">
                        {cat}
                        <button onClick={() => removeCategory(cat)} className="ml-1 text-[#a3a3a3] hover:text-white rounded-full p-0.5 transition-colors">
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="e.g. Finance, Legal..." 
                      className="bg-[#0a0a0a] border-[#262626] text-white focus-visible:ring-[#525252] flex-1" 
                      value={newCat}
                      onChange={(e) => setNewCat(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                    />
                    <Button variant="outline" onClick={addCategory} className="bg-[#262626] border-[#525252] hover:bg-[#525252] hover:text-white px-3">
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" className="border-red-900/50 text-red-500 hover:bg-red-950/30 hover:text-red-400" />}>Cancel</DialogClose>
                  <DialogClose render={<Button className="bg-white text-black hover:bg-gray-200" onClick={() => handleSave('Taxonomy')} />}>Save changes</DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626] flex items-center justify-between hover:border-[#525252] transition-colors">
            <div className="flex items-center gap-4">
              <div className="bg-[#262626] p-3 rounded-lg text-[#f5f5f5]">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-[#f5f5f5] font-medium">Compliance Ruleset</h3>
                <p className="text-sm text-[#525252]">Base rules for AI cross-checking</p>
              </div>
            </div>
            
            <Dialog>
              <DialogTrigger render={<Button variant="outline" className="text-[#f5f5f5] bg-[#262626] border-[#525252] hover:bg-[#525252] hover:text-white transition-colors" />}>Configure</DialogTrigger>
              <DialogContent className="bg-[#141414] border-[#262626] text-[#f5f5f5] max-w-md">
                <DialogHeader>
                  <DialogTitle>Configure Ruleset</DialogTitle>
                  <DialogDescription className="text-[#a3a3a3]">
                    Adjust the strictness of AI cross-checking and active rules.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-approve" className="text-[#f5f5f5] cursor-pointer">Auto-approve low risk docs</Label>
                      <Switch id="auto-approve" defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="strict-vendor" className="text-[#f5f5f5] cursor-pointer">Enforce strict vendor terms</Label>
                      <Switch id="strict-vendor" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-[#f5f5f5]">AI Confidence Threshold</Label>
                      <span className="text-sm text-[#a3a3a3]">{strictness[0]}0%</span>
                    </div>
                    <Slider
                      value={strictness}
                      onValueChange={setStrictness}
                      max={10}
                      step={1}
                      className="py-2"
                    />
                    <p className="text-xs text-[#525252]">Higher confidence requires more manual reviews.</p>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" className="border-red-900/50 text-red-500 hover:bg-red-950/30 hover:text-red-400" />}>Cancel</DialogClose>
                  <DialogClose render={<Button className="bg-white text-black hover:bg-gray-200" onClick={() => handleSave('Compliance Rules')} />}>Save configurations</DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-lg font-medium text-[#a3a3a3] border-b border-[#262626] pb-2">System Preferences</h2>
          
          <div className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626] flex items-center justify-between hover:border-[#525252] transition-colors">
            <div className="flex items-center gap-4">
              <div className="bg-[#262626] p-3 rounded-lg text-[#f5f5f5]">
                <Database size={24} />
              </div>
              <div>
                <h3 className="text-[#f5f5f5] font-medium">Storage & OCR</h3>
                <p className="text-sm text-[#525252]">Manage scanned PDF extraction settings</p>
              </div>
            </div>
            
            <Dialog>
              <DialogTrigger render={<Button variant="outline" className="text-[#f5f5f5] bg-[#262626] border-[#525252] hover:bg-[#525252] hover:text-white transition-colors" />}>Manage</DialogTrigger>
              <DialogContent className="bg-[#141414] border-[#262626] text-[#f5f5f5]">
                <DialogHeader>
                  <DialogTitle>Storage & OCR Management</DialogTitle>
                  <DialogDescription className="text-[#a3a3a3]">
                    Change storage providers or OCR extraction engines.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  <div className="grid gap-2">
                    <Label className="text-[#f5f5f5]">Storage Provider</Label>
                    <Select defaultValue="s3">
                      <SelectTrigger className="bg-[#0a0a0a] border-[#262626] text-white">
                        <SelectValue placeholder="Select a provider" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#141414] border-[#262626] text-white">
                        <SelectItem value="s3">AWS S3 (Standard)</SelectItem>
                        <SelectItem value="gcs">Google Cloud Storage</SelectItem>
                        <SelectItem value="azure">Azure Blob Storage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid gap-2">
                    <Label className="text-[#f5f5f5]">OCR Extraction Engine</Label>
                    <Select defaultValue="textract">
                      <SelectTrigger className="bg-[#0a0a0a] border-[#262626] text-white">
                        <SelectValue placeholder="Select an engine" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#141414] border-[#262626] text-white">
                        <SelectItem value="textract">AWS Textract</SelectItem>
                        <SelectItem value="vision">Google Cloud Vision</SelectItem>
                        <SelectItem value="tesseract">Tesseract (Local)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between mt-2 border-t border-[#262626] pt-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="retain-files" className="text-[#f5f5f5] cursor-pointer">Retain Original Files</Label>
                      <p className="text-xs text-[#525252]">Keep untransformed PDFs in cold storage.</p>
                    </div>
                    <Switch id="retain-files" defaultChecked />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" className="border-red-900/50 text-red-500 hover:bg-red-950/30 hover:text-red-400" />}>Cancel</DialogClose>
                  <DialogClose render={<Button className="bg-white text-black hover:bg-gray-200" onClick={() => handleSave('Storage')} />}>Update Preferences</DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <h2 className="text-lg font-medium text-red-500 border-b border-[#262626] pb-2">Danger Zone</h2>
        
        <div className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626] flex items-center justify-between hover:border-red-900/50 transition-colors">
          <div className="flex items-center gap-4">
            <div className="bg-red-950/30 p-3 rounded-lg text-red-500">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-[#f5f5f5] font-medium">Reset System Defaults</h3>
              <p className="text-sm text-[#525252]">Permanently wipe custom configurations and revert to factory settings.</p>
            </div>
          </div>
          
          <Dialog>
            <DialogTrigger render={<Button variant="outline" className="text-red-500 bg-[#262626] border-red-900/50 hover:bg-red-950/30 hover:text-red-400 transition-colors" />}>Reset Defaults</DialogTrigger>
            <DialogContent className="bg-[#141414] border-red-900/50 text-[#f5f5f5] max-w-md">
              <DialogHeader>
                <DialogTitle className="text-red-500 flex items-center gap-2">
                  <AlertTriangle size={20} />
                  Confirm System Reset
                </DialogTitle>
                <DialogDescription className="text-[#a3a3a3]">
                  This action cannot be undone. This will permanently delete your custom categories, reset compliance rules, and revert storage preferences to factory defaults.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-sm text-[#f5f5f5]">Are you absolutely sure you want to proceed?</p>
              </div>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" className="border-[#262626] text-white hover:bg-[#262626]" />}>Cancel</DialogClose>
                <DialogClose render={<Button className="bg-red-500 text-white hover:bg-red-600 border-0" onClick={handleReset} />}>Yes, Reset System</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </motion.div>
  );
}
