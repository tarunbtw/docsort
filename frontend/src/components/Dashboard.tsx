import React, { useState, useEffect } from 'react';
import { Search, List, Layers, Clock, AlertTriangle, FileCheck, MoreVertical } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { mockDocuments, chartData, radarData } from '../data';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tab } from '../App';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';

import { fetchDashboardStats, fetchDocument, DocumentListItem, DocumentRecord } from '../lib/api';
import DocumentModal from './DocumentModal';

const defaultKPIs = [
  { icon: List, title: 'Total Docs', value: '2.3k', label: 'All uploaded', trend: '+10.5%', highlight: false },
  { icon: FileCheck, title: 'Compliant', value: '823', label: 'Auto-approved', trend: '+35.9%', highlight: true },
  { icon: Clock, title: 'Pending Review', value: '1.2k', label: 'Awaiting checks', trend: '+20.5%', highlight: false },
  { icon: AlertTriangle, title: 'Contradictions', value: '200', label: 'Flagged policies', trend: '-10.2%', highlight: false },
  { icon: Layers, title: 'Processing', value: '102', label: 'Under AI review', trend: '+15.2%', highlight: false },
];

export default function Dashboard({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const [kpiCards, setKpiCards] = useState(defaultKPIs);
  const [recentDocs, setRecentDocs] = useState<DocumentListItem[]>(mockDocuments.slice(0, 4));
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await fetchDashboardStats();
        if (stats && stats.kpis && stats.kpis.length > 0) {
          const icons = [List, FileCheck, Clock, AlertTriangle, Layers];
          const mapped = stats.kpis.map((kpi, idx) => ({
            ...kpi,
            icon: icons[idx % icons.length],
          }));
          setKpiCards(mapped);
        }
        if (stats && stats.recentDocs && stats.recentDocs.length > 0) {
          setRecentDocs(stats.recentDocs);
        }
      } catch (err) {
        // Fall back to default mock data silently
        console.warn('Dashboard stats fallback to mock data:', err);
      }
    }
    loadStats();
  }, []);

  const handlePreview = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const doc = await fetchDocument(id);
      setSelectedDoc(doc);
      setIsModalOpen(true);
    } catch {
      const mock = recentDocs.find(d => d.id === id) || mockDocuments[0];
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
          summary: 'Official memorandum regarding procurement standards and public bidding conditions.',
          verificationFlags: [],
        },
      });
      setIsModalOpen(true);
    }
  };

  return (
    <>
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-light text-[#f5f5f5]">Dashboard</h1>
        <div className="flex items-center gap-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#525252] group-focus-within:text-[#a3a3a3] transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Search documents..." 
              className="bg-[#141414] text-sm text-[#f5f5f5] placeholder-[#525252] rounded-full pl-10 pr-4 py-2.5 w-64 focus:outline-none focus:ring-1 focus:ring-[#525252] transition-all border border-[#262626]"
            />
          </div>
          <div className="flex items-center gap-3">
            <img 
              src="https://api.dicebear.com/7.x/notionists/svg?seed=Haris&backgroundColor=11212D" 
              alt="User profile" 
              className="w-9 h-9 rounded-full bg-[#141414] border border-[#262626]"
            />
            <span className="text-sm text-[#a3a3a3] font-medium">Compliance Officer</span>
          </div>
        </div>
      </header>

      {/* KPI Cards (Matches Reference Image 5-Card Layout) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6 mb-6">
        {kpiCards.map((kpi, index) => {
          const Icon = kpi.icon;
          return (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
              key={index}
              className={`p-6 rounded-[1.5rem] flex flex-col items-center justify-center text-center transition-all ${
                kpi.highlight 
                  ? 'bg-white text-black border border-white' 
                  : 'bg-[#141414] text-[#f5f5f5] border border-[#262626]'
              }`}
            >
              <Icon size={20} className={`mb-3 ${kpi.highlight ? 'text-black' : 'text-[#a3a3a3]'}`} />
              <span className="text-3xl font-semibold tracking-tight mb-1">{kpi.value}</span>
              <span className={`text-xs font-medium mb-3 ${kpi.highlight ? 'text-gray-600' : 'text-[#525252]'}`}>{kpi.title}</span>
              <div className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                kpi.highlight ? 'text-white bg-black' :
                kpi.trend.startsWith('+') ? 'text-[#a3a3a3] bg-[#262626]' 
                : kpi.trend.startsWith('-') ? 'text-[#f5f5f5] bg-[#525252]'
                : 'text-black bg-white'
              }`}>
                {kpi.trend}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Middle Section: Bar Chart & Radar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        
        {/* Document Overview Chart */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2 bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-[#f5f5f5] font-medium text-lg">Document Overview</h3>
            <Select defaultValue="15days">
              <SelectTrigger className="w-[120px] bg-[#0a0a0a] text-xs text-[#a3a3a3] border-[#262626] rounded-full h-8">
                <SelectValue placeholder="Select Range" />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-[#262626] text-[#a3a3a3]">
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="15days">Last 15 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex gap-6 mb-6">
            <div className="flex items-center gap-2 text-sm text-[#a3a3a3]">
              <span className="w-3 h-3 rounded-sm bg-[#a3a3a3] block"></span> 13.7k <span className="text-[#525252]">New Uploads</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[#a3a3a3]">
              <span className="w-3 h-3 rounded-sm bg-[#525252] block"></span> 23.8k <span className="text-[#525252]">Under Review</span>
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barGap={2}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 12 }} />
                <Tooltip 
                  cursor={{fill: '#262626', opacity: 0.4}}
                  contentStyle={{ backgroundColor: '#141414', border: '1px solid #262626', borderRadius: '8px', color: '#f5f5f5' }}
                  itemStyle={{ color: '#f5f5f5' }}
                />
                <Bar dataKey="new" fill="#a3a3a3" radius={[4, 4, 0, 0]} barSize={12} />
                <Bar dataKey="review" fill="#525252" radius={[4, 4, 0, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Status Radar Chart */}
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-1 bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[#f5f5f5] font-medium text-lg">Today's Status</h3>
            <Select defaultValue="today">
              <SelectTrigger className="w-[100px] bg-[#0a0a0a] text-xs text-[#a3a3a3] border-[#262626] rounded-full h-8">
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-[#262626] text-[#a3a3a3]">
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="h-[250px] w-full -ml-4">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#262626" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
                <Radar name="Approved" dataKey="A" stroke="#f5f5f5" fill="#f5f5f5" fillOpacity={0.6} />
                <Radar name="Review" dataKey="B" stroke="#525252" fill="#525252" fillOpacity={0.6} />
                <Tooltip contentStyle={{ backgroundColor: '#141414', border: '1px solid #262626', borderRadius: '8px' }} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2 text-xs text-[#f5f5f5]">
              <span className="w-2 h-2 rounded-full bg-[#f5f5f5] block"></span> 87 Approved
            </div>
            <div className="flex items-center gap-2 text-xs text-[#a3a3a3]">
              <span className="w-2 h-2 rounded-full bg-[#525252] block"></span> 30 Under Review
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom Section: Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg text-[#f5f5f5] font-medium">Document Management</h3>
          <Button variant="outline" onClick={() => setActiveTab('repository')} className="bg-[#0a0a0a] border-[#262626] text-[#a3a3a3] rounded-full hover:bg-[#262626] hover:text-[#f5f5f5] transition-colors">
            See all
          </Button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-[#525252] border-b border-[#262626]">
              <tr>
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
              {recentDocs.map((doc) => (
                <tr 
                  key={doc.id} 
                  onClick={() => handlePreview(doc.id)}
                  className="border-b border-[#262626] last:border-0 hover:bg-[#0a0a0a] transition-colors group cursor-pointer"
                >
                  <td className="py-4 text-[#a3a3a3] group-hover:text-[#f5f5f5] transition-colors font-mono text-xs">{doc.docNumber}</td>
                  <td className="py-4 text-[#f5f5f5] font-medium pr-4">{doc.title}</td>
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
                          <DropdownMenuItem className="text-red-500 hover:bg-red-950/30 hover:text-red-400 cursor-pointer" onClick={() => toast.error('To delete, please use Repository tab')}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
