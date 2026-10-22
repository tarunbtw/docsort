import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Download, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchReportSummary, fetchAudit, exportCsvUrl, ReportSummary, AuditEntry } from '../lib/api';

const PIE_COLORS = ['#f5f5f5', '#a3a3a3', '#525252', '#262626'];

const chartTooltip = {
  backgroundColor: '#0a0a0a',
  border: '1px solid #262626',
  borderRadius: '8px',
  color: '#f5f5f5',
};

function iconFor(action: string) {
  const lower = action.toLowerCase();
  if (lower.includes('failed') || lower.includes('review') || lower.includes('superseded')) {
    return <AlertTriangle size={16} />;
  }
  if (lower.includes('uploaded')) return <Clock size={16} />;
  return <CheckCircle size={16} />;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function Reports() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchReportSummary(), fetchAudit(undefined, 20)])
      .then(([s, a]) => {
        setSummary(s);
        setAudit(a);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const trendData = (summary?.uploadsPerDay ?? []).map((d) => ({ name: d.date.slice(5), uploads: d.count }));
  const statusData = (summary?.byCompliance ?? []).filter((s) => s.count > 0);
  const categoryData = summary?.byCategory ?? [];
  const total = summary?.total ?? 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-light text-[#f5f5f5]">Reports &amp; Analytics</h1>
          <p className="text-[#a3a3a3] mt-2">Compliance breakdown and the audit trail behind it.</p>
        </div>
        <a href={exportCsvUrl} download>
          <Button className="bg-white text-black hover:bg-gray-200 rounded-full">
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </a>
      </header>

      {error && (
        <div className="bg-[#141414] border border-[#262626] rounded-[1.5rem] p-6 text-[#a3a3a3]">
          Could not reach the backend: {error}
        </div>
      )}
      {loading && <p className="text-[#a3a3a3]">Loading report…</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
          <h3 className="text-lg text-[#f5f5f5] font-medium mb-6">Uploads (Last 14 Days)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltip} />
                <Line type="monotone" dataKey="uploads" stroke="#f5f5f5" strokeWidth={2} dot={{ fill: '#f5f5f5', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
          <h3 className="text-lg text-[#f5f5f5] font-medium mb-6">Compliance Status Breakdown</h3>
          <div className="h-[300px] w-full relative">
            {statusData.length === 0 ? (
              <p className="text-[#525252] text-sm pt-24 text-center">No documents processed yet.</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="count" stroke="none">
                      {statusData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={chartTooltip} itemStyle={{ color: '#f5f5f5' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <span className="block text-2xl font-light text-[#f5f5f5]">{total}</span>
                  <span className="block text-xs text-[#a3a3a3]">Total Docs</span>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-4">
            {statusData.map((s, i) => (
              <span key={s.name} className="text-xs text-[#a3a3a3] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                {s.name}: {s.count}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
          <h3 className="text-lg text-[#f5f5f5] font-medium mb-6">Documents by Category</h3>
          <div className="h-[300px] w-full">
            {categoryData.length === 0 ? (
              <p className="text-[#525252] text-sm pt-24 text-center">No categories extracted yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 12 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3', fontSize: 12 }} width={110} />
                  <Tooltip contentStyle={chartTooltip} cursor={{ fill: '#262626' }} />
                  <Bar dataKey="count" fill="#f5f5f5" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626] flex flex-col">
          <h3 className="text-lg text-[#f5f5f5] font-medium mb-6">Recent Audit Trail</h3>
          <div className="flex-1 overflow-y-auto space-y-4 max-h-[300px]">
            {audit.length === 0 ? (
              <p className="text-[#525252] text-sm">No audit entries recorded yet.</p>
            ) : (
              audit.map((log) => (
                <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl bg-[#0a0a0a] border border-[#262626]">
                  <div className="p-2 rounded-full bg-[#141414] text-[#a3a3a3] border border-[#262626]">
                    {iconFor(log.action)}
                  </div>
                  <div className="flex-1">
                    <p className="text-[#f5f5f5] font-medium text-sm">{log.action}</p>
                    <p className="text-[#525252] text-xs mt-1">
                      {log.actor}
                      {log.detail ? ` — ${log.detail}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[#a3a3a3] border-[#262626] whitespace-nowrap">
                    {formatWhen(log.createdAt)}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
