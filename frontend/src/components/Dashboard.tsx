import React, { useState, useEffect } from 'react';
import { Search, List, Layers, Clock, AlertTriangle, FileCheck, MoreVertical } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tab } from '../App';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

import {
  fetchDashboardStats,
  fetchReportSummary,
  fetchDocument,
  DocumentListItem,
  DocumentRecord,
  KPICard,
  ReportSummary,
} from '../lib/api';
import DocumentModal from './DocumentModal';

const KPI_ICONS = [List, FileCheck, Clock, AlertTriangle, Layers];

function complianceBadgeClass(compliance: string) {
  if (compliance === 'Verified') return 'bg-white text-black border-transparent hover:bg-gray-200';
  if (compliance === 'Needs Review') return 'bg-[#262626] text-[#a3a3a3] border-[#525252] hover:bg-[#262626]';
  return 'bg-[#0a0a0a] text-white border-[#525252] hover:bg-[#0a0a0a]';
}

export default function Dashboard({ setActiveTab }: { setActiveTab: (tab: Tab) => void }) {
  const [kpiCards, setKpiCards] = useState<KPICard[]>([]);
  const [recentDocs, setRecentDocs] = useState<DocumentListItem[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        const [stats, report] = await Promise.all([fetchDashboardStats(), fetchReportSummary()]);
        setKpiCards(stats.kpis ?? []);
        setRecentDocs(stats.recentDocs ?? []);
        setSummary(report);
      } catch (err) {
        setError((err as Error).message);
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
    } catch (err) {
      toast.error(`Could not load document: ${(err as Error).message}`);
    }
  };

  const uploadsPerDay = (summary?.uploadsPerDay ?? []).map((d) => ({ name: d.date.slice(5), uploads: d.count }));
  const byDocType = (summary?.byDocType ?? []).map((d) => ({ subject: d.name, count: d.count }));
  const complianceTotals = summary?.byCompliance ?? [];

  return (
    <>
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-light text-[#f5f5f5]">Dashboard</h1>
        <div className="flex items-center gap-6">
          <Button
            variant="outline"
            onClick={() => setActiveTab('repository')}
            className="bg-[#141414] text-[#a3a3a3] border-[#262626] rounded-full hover:bg-[#262626] hover:text-white"
          >
            <Search className="mr-2 size-4" /> Search documents
          </Button>
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

      {error && (
        <div className="bg-[#141414] border border-[#262626] rounded-[1.5rem] p-6 text-[#a3a3a3] mb-6">
          Could not reach the backend: {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 lg:gap-6 mb-6">
        {kpiCards.map((kpi, index) => {
          const Icon = KPI_ICONS[index % KPI_ICONS.length];
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              key={kpi.title}
              className={`p-6 rounded-[1.5rem] flex flex-col items-center justify-center text-center transition-all ${
                kpi.highlight ? 'bg-white text-black border border-white' : 'bg-[#141414] text-[#f5f5f5] border border-[#262626]'
              }`}
            >
              <Icon size={20} className={`mb-3 ${kpi.highlight ? 'text-black' : 'text-[#a3a3a3]'}`} />
              <span className="text-3xl font-semibold tracking-tight mb-1">{kpi.value}</span>
              <span className={`text-xs font-medium mb-3 ${kpi.highlight ? 'text-gray-600' : 'text-[#525252]'}`}>{kpi.title}</span>
              <div className={`text-[10px] font-semibold px-2 py-1 rounded-full ${
                kpi.highlight ? 'text-white bg-black' : 'text-[#a3a3a3] bg-[#262626]'
              }`}>
                {kpi.label}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2 bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-[#f5f5f5] font-medium text-lg">Uploads (Last 14 Days)</h3>
            <span className="text-xs text-[#525252]">{summary?.total ?? 0} documents total</span>
          </div>

          <div className="h-[250px] w-full">
            {uploadsPerDay.length === 0 ? (
              <p className="text-[#525252] text-sm pt-24 text-center">No uploads recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={uploadsPerDay} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: '#262626', opacity: 0.4 }}
                    contentStyle={{ backgroundColor: '#141414', border: '1px solid #262626', borderRadius: '8px', color: '#f5f5f5' }}
                    itemStyle={{ color: '#f5f5f5' }}
                  />
                  <Bar dataKey="uploads" fill="#a3a3a3" radius={[4, 4, 0, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-1 bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[#f5f5f5] font-medium text-lg">Documents by Type</h3>
          </div>

          <div className="h-[250px] w-full -ml-4">
            {byDocType.length < 3 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-[#a3a3a3]">
                {byDocType.length === 0 ? (
                  <span className="text-[#525252]">No document types extracted yet.</span>
                ) : (
                  byDocType.map((t) => (
                    <span key={t.subject}>{t.subject}: <span className="text-[#f5f5f5]">{t.count}</span></span>
                  ))
                )}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={byDocType}>
                  <PolarGrid stroke="#262626" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#a3a3a3', fontSize: 11 }} />
                  <Radar name="Documents" dataKey="count" stroke="#f5f5f5" fill="#f5f5f5" fillOpacity={0.6} />
                  <Tooltip contentStyle={{ backgroundColor: '#141414', border: '1px solid #262626', borderRadius: '8px' }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-4 mt-2">
            {complianceTotals.map((c) => (
              <span key={c.name} className="text-xs text-[#a3a3a3]">
                {c.name}: <span className="text-[#f5f5f5]">{c.count}</span>
              </span>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg text-[#f5f5f5] font-medium">Recent Documents</h3>
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
                <th className="pb-4 font-medium">Type</th>
                <th className="pb-4 font-medium">Authority</th>
                <th className="pb-4 font-medium">Score</th>
                <th className="pb-4 font-medium">Uploaded</th>
                <th className="pb-4 font-medium">Compliance</th>
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
                  <td className="py-4 text-[#a3a3a3] pr-4 whitespace-nowrap">{doc.docType || '—'}</td>
                  <td className="py-4 text-[#a3a3a3] pr-4">{doc.department || '—'}</td>
                  <td className="py-4 text-[#a3a3a3]">{doc.complianceScore}%</td>
                  <td className="py-4 text-[#525252] pr-4 whitespace-nowrap">{doc.uploadDate}</td>
                  <td className="py-4">
                    <Badge variant="outline" className={`font-medium ${complianceBadgeClass(doc.compliance)}`}>
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
                          <DropdownMenuItem className="text-red-500 hover:bg-red-950/30 hover:text-red-400 cursor-pointer" onClick={() => toast.error('To delete, please use the Repository tab')}>
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

          {recentDocs.length === 0 && !error && (
            <p className="text-[#525252] text-sm py-8 text-center">No documents uploaded yet.</p>
          )}
        </div>
      </motion.div>

      <DocumentModal isOpen={isModalOpen} document={selectedDoc} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
