import React, { useState, useEffect } from 'react';
import {
  Search,
  List,
  Layers,
  Clock,
  AlertTriangle,
  FileCheck,
  MoreVertical,
  ExternalLink,
  Eye,
  Trash2,
  ArrowUpRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts';
import { motion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

import { Tab } from '../App';
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

export function getComplianceBadge(compliance: string) {
  switch (compliance) {
    case 'Verified':
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium"
        >
          Verified
        </Badge>
      );
    case 'Needs Review':
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-medium"
        >
          Needs Review
        </Badge>
      );
    case 'Superseded':
      return (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border font-medium"
        >
          Superseded
        </Badge>
      );
    case 'Not Procurement':
      return (
        <Badge
          variant="outline"
          className="bg-destructive/10 text-destructive border-destructive/30 font-medium"
        >
          Not Procurement
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="font-medium">
          {compliance}
        </Badge>
      );
  }
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

  const uploadsPerDay = (summary?.uploadsPerDay ?? []).map((d) => ({
    name: d.date.slice(5),
    uploads: d.count,
  }));
  const byDocType = (summary?.byDocType ?? []).map((d) => ({ subject: d.name, count: d.count }));
  const complianceTotals = summary?.byCompliance ?? [];

  return (
    <div className="space-y-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time regulatory document triage and compliance overview.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('repository')}
            className="rounded-lg shadow-xs"
          >
            <Search className="size-4 mr-1.5 text-muted-foreground" />
            <span>Search documents</span>
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30 bg-destructive/5 text-destructive">
          <CardContent className="p-4 text-sm flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Could not reach backend service: {error}</span>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
        {kpiCards.map((kpi, index) => {
          const Icon = KPI_ICONS[index % KPI_ICONS.length];
          const isHighlighted = kpi.highlight;
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              key={kpi.title}
            >
              <Card
                className={`h-full border transition-all ${
                  isHighlighted
                    ? 'border-primary/40 bg-accent/40 shadow-xs ring-1 ring-primary/20'
                    : 'hover:border-foreground/20'
                }`}
              >
                <CardContent className="p-5 flex flex-col justify-between h-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted-foreground line-clamp-1">
                      {kpi.title}
                    </span>
                    <div
                      className={`p-1.5 rounded-md ${
                        isHighlighted
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon size={14} />
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground mb-1">
                      {kpi.value}
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-[10px] font-mono font-medium py-0 px-1.5"
                    >
                      {kpi.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload trend bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Uploads Activity</CardTitle>
                <CardDescription>Daily document intake across the last 14 days</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {summary?.total ?? 0} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[260px] w-full">
              {uploadsPerDay.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No uploads recorded yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={uploadsPerDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11 }}
                      dy={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'currentColor', opacity: 0.05 }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                              <span className="text-muted-foreground">Date: </span>
                              <span className="font-medium text-popover-foreground">
                                {payload[0].payload.name}
                              </span>
                              <br />
                              <span className="text-muted-foreground">Uploads: </span>
                              <span className="font-bold text-popover-foreground">
                                {payload[0].value}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="uploads"
                      className="fill-primary"
                      radius={[6, 6, 0, 0]}
                      barSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents by Type radar / breakdown */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Distribution by Type</CardTitle>
            <CardDescription>Classified regulatory document taxonomy</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 flex-1 flex flex-col justify-between">
            <div className="h-[210px] w-full">
              {byDocType.length < 3 ? (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  {byDocType.length === 0 ? (
                    <span>No document types extracted yet.</span>
                  ) : (
                    byDocType.map((t) => (
                      <div key={t.subject} className="flex justify-between w-full max-w-xs px-2 py-1 bg-muted/40 rounded-md">
                        <span className="font-medium text-foreground">{t.subject}</span>
                        <span className="font-mono text-muted-foreground">{t.count}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="72%" data={byDocType}>
                    <PolarGrid stroke="currentColor" opacity={0.15} />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 10 }}
                    />
                    <Radar
                      name="Documents"
                      dataKey="count"
                      stroke="var(--color-primary)"
                      fill="var(--color-primary)"
                      fillOpacity={0.25}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border border-border bg-popover px-3 py-1.5 text-xs shadow-md">
                              <span className="font-medium text-popover-foreground">
                                {payload[0].payload.subject}: {payload[0].value}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Compliance totals summary pills */}
            <div className="flex flex-wrap gap-1.5 justify-center pt-3 border-t border-border">
              {complianceTotals.map((c) => (
                <Badge
                  key={c.name}
                  variant="outline"
                  className="text-[11px] font-normal py-0.5 px-2 bg-muted/30"
                >
                  <span className="text-muted-foreground mr-1">{c.name}:</span>
                  <span className="font-semibold text-foreground">{c.count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Documents Table Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base font-semibold">Recent Documents</CardTitle>
            <CardDescription>Latest parsed regulatory circulars and policy orders</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('repository')}
            className="text-xs"
          >
            <span>See all documents</span>
            <ArrowUpRight className="size-3.5 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Ref ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Issuing Authority</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px] text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDocs.map((doc) => (
                <TableRow
                  key={doc.id}
                  onClick={() => handlePreview(doc.id)}
                  className="cursor-pointer group"
                >
                  <TableCell className="font-mono text-xs text-muted-foreground group-hover:text-foreground font-medium">
                    {doc.docNumber}
                  </TableCell>
                  <TableCell className="font-medium text-foreground max-w-sm truncate">
                    {doc.title}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {doc.docType || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                    {doc.department || '—'}
                  </TableCell>
                  <TableCell className="text-xs font-mono font-medium">
                    <span
                      className={
                        doc.complianceScore >= 80
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : doc.complianceScore >= 50
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-destructive'
                      }
                    >
                      {doc.complianceScore}%
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {doc.uploadDate}
                  </TableCell>
                  <TableCell>{getComplianceBadge(doc.compliance)}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground"
                          />
                        }
                      >
                        <MoreVertical size={14} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-36">
                        <DropdownMenuItem
                          onClick={(e) => handlePreview(doc.id, e)}
                          className="cursor-pointer"
                        >
                          <Eye className="size-3.5 mr-2" />
                          <span>Preview</span>
                        </DropdownMenuItem>
                        {doc.fileUrl && (
                          <DropdownMenuItem
                            onClick={() => window.open(doc.fileUrl, '_blank')}
                            className="cursor-pointer"
                          >
                            <ExternalLink className="size-3.5 mr-2" />
                            <span>Open Tab</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => toast.error('To delete, please use the Repository tab')}
                          className="cursor-pointer"
                        >
                          <Trash2 className="size-3.5 mr-2" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {recentDocs.length === 0 && !error && (
                <TableRow>
                  <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                    No documents uploaded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <DocumentModal
        isOpen={isModalOpen}
        document={selectedDoc}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
