import React from 'react';
import { motion } from 'motion/react';
import { Download, FileText, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const trendData = [
  { name: 'Week 1', compliant: 400, flagged: 24 },
  { name: 'Week 2', compliant: 300, flagged: 13 },
  { name: 'Week 3', compliant: 550, flagged: 45 },
  { name: 'Week 4', compliant: 450, flagged: 20 },
];

const statusData = [
  { name: 'Compliant', value: 68 },
  { name: 'Needs Review', value: 24 },
  { name: 'Critical', value: 8 },
];

const categoryData = [
  { name: 'Finance', value: 120 },
  { name: 'Legal', value: 95 },
  { name: 'HR', value: 60 },
  { name: 'Vendor', value: 80 },
  { name: 'Security', value: 45 },
];

const PIE_COLORS = ['#f5f5f5', '#525252', '#262626'];

const auditTrail = [
  { id: '1', action: 'Document Uploaded', user: 'Haris (Admin)', time: '10 mins ago', status: 'success' },
  { id: '2', action: 'Compliance Override', user: 'Jane Doe', time: '1 hour ago', status: 'warning' },
  { id: '3', action: 'Risk Acknowledged', user: 'System', time: '3 hours ago', status: 'info' },
  { id: '4', action: 'Export Generated', user: 'Haris (Admin)', time: '1 day ago', status: 'success' },
];

export default function Reports() {
  const handleExport = () => {
    toast.success('Generating export...', {
      description: 'Your report will be ready to download shortly.'
    });
    setTimeout(() => {
      toast.success('Export complete. Downloading report.csv');
    }, 2000);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-light text-[#f5f5f5]">Reports & Analytics</h1>
          <p className="text-[#a3a3a3] mt-2">Generate and export compliance audit trails and dashboards.</p>
        </div>
        <Button className="bg-white text-black hover:bg-gray-200 rounded-full" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Trend Line Chart */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
          <h3 className="text-lg text-[#f5f5f5] font-medium mb-6">Compliance Trend (30 Days)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', color: '#f5f5f5' }}
                />
                <Line type="monotone" dataKey="compliant" stroke="#f5f5f5" strokeWidth={2} dot={{ fill: '#f5f5f5', strokeWidth: 2 }} />
                <Line type="monotone" dataKey="flagged" stroke="#525252" strokeWidth={2} dot={{ fill: '#525252', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Status Breakdown Pie Chart */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
          <h3 className="text-lg text-[#f5f5f5] font-medium mb-6">Compliance Status Breakdown</h3>
          <div className="h-[300px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', color: '#f5f5f5' }}
                  itemStyle={{ color: '#f5f5f5' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <span className="block text-2xl font-light text-[#f5f5f5]">100%</span>
              <span className="block text-xs text-[#a3a3a3]">Total Docs</span>
            </div>
          </div>
        </motion.div>

        {/* Category Bar Chart */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626]">
          <h3 className="text-lg text-[#f5f5f5] font-medium mb-6">Documents by Category</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#525252', fontSize: 12 }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#a3a3a3', fontSize: 12 }} width={80} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #262626', borderRadius: '8px', color: '#f5f5f5' }}
                  cursor={{ fill: '#262626' }}
                />
                <Bar dataKey="value" fill="#f5f5f5" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Audit Trail Log */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626] flex flex-col">
          <h3 className="text-lg text-[#f5f5f5] font-medium mb-6">Recent Audit Trail</h3>
          <div className="flex-1 overflow-y-auto space-y-4">
            {auditTrail.map((log) => (
              <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl bg-[#0a0a0a] border border-[#262626] hover:border-[#525252] transition-colors">
                <div className={`p-2 rounded-full ${
                  log.status === 'success' ? 'bg-[#141414] text-white border border-[#262626]' :
                  log.status === 'warning' ? 'bg-[#262626] text-[#a3a3a3] border border-[#525252]' :
                  'bg-[#141414] text-[#a3a3a3] border border-[#262626]'
                }`}>
                  {log.status === 'success' && <CheckCircle size={16} />}
                  {log.status === 'warning' && <AlertTriangle size={16} />}
                  {log.status === 'info' && <Clock size={16} />}
                </div>
                <div className="flex-1">
                  <p className="text-[#f5f5f5] font-medium text-sm">{log.action}</p>
                  <p className="text-[#525252] text-xs mt-1">by {log.user}</p>
                </div>
                <Badge variant="outline" className="text-[#a3a3a3] border-[#262626]">{log.time}</Badge>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-4 bg-[#0a0a0a] border-[#262626] text-[#a3a3a3] hover:text-white hover:bg-[#262626]">
            View Full Audit Log
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}
