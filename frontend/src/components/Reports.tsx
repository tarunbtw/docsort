import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Download, CheckCircle, AlertTriangle, Clock, Activity, FileSpreadsheet } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { fetchReportSummary, fetchAudit, exportCsvUrl, ReportSummary, AuditEntry } from '../lib/api';

const PIE_COLORS = [
  'var(--color-primary)',
  'var(--color-muted-foreground)',
  'var(--color-secondary-foreground)',
  'var(--color-ring)',
];

function iconFor(action: string) {
  const lower = action.toLowerCase();
  if (lower.includes('failed') || lower.includes('review') || lower.includes('superseded')) {
    return <AlertTriangle size={14} className="text-amber-500" />;
  }
  if (lower.includes('uploaded')) return <Clock size={14} className="text-primary" />;
  return <CheckCircle size={14} className="text-emerald-500" />;
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

  const trendData = (summary?.uploadsPerDay ?? []).map((d) => ({
    name: d.date.slice(5),
    uploads: d.count,
  }));
  const statusData = (summary?.byCompliance ?? []).filter((s) => s.count > 0);
  const categoryData = summary?.byCategory ?? [];
  const total = summary?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
            Reports &amp; Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            System-wide compliance breakdown and immutable audit ledger.
          </p>
        </div>
        <a href={exportCsvUrl} download>
          <Button variant="default" size="sm" className="rounded-lg shadow-xs gap-1.5">
            <FileSpreadsheet className="size-4" />
            <span>Export CSV Report</span>
          </Button>
        </a>
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
        <div className="py-8 text-center text-sm text-muted-foreground">
          Aggregating telemetry and audit trail…
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Uploads Trend Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Intake Trend (14 Days)</CardTitle>
            <CardDescription>Volume trajectory of ingested regulatory notices</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} vertical={false} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                            <span className="text-muted-foreground">Date: </span>
                            <span className="font-medium text-popover-foreground">{payload[0].payload.name}</span>
                            <br />
                            <span className="text-muted-foreground">Volume: </span>
                            <span className="font-bold text-popover-foreground">{payload[0].value} docs</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="uploads"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    dot={{ fill: 'var(--color-primary)', strokeWidth: 1.5, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Status Breakdown Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Compliance Status Ratio</CardTitle>
            <CardDescription>Verified vs. segregated and flagged proportions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[230px] w-full relative">
              {statusData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No documents processed yet.
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={4}
                        dataKey="count"
                        stroke="none"
                      >
                        {statusData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border border-border bg-popover px-3 py-1.5 text-xs shadow-md">
                                <span className="font-medium text-popover-foreground">
                                  {payload[0].name}: {payload[0].value}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <span className="block text-2xl font-bold tracking-tight text-foreground">{total}</span>
                    <span className="block text-[11px] text-muted-foreground uppercase tracking-wider">Total</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-center pt-3 border-t border-border">
              {statusData.map((s, i) => (
                <Badge key={s.name} variant="outline" className="text-xs font-normal">
                  <span
                    className="size-2 rounded-full mr-1.5 inline-block"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span>{s.name}: <strong>{s.count}</strong></span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category Distribution Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Documents by Category</CardTitle>
            <CardDescription>Frequency of classified regulatory categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              {categoryData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No categories extracted yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} horizontal={false} />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'currentColor', opacity: 0.6, fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'currentColor', opacity: 0.8, fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip
                      cursor={{ fill: 'currentColor', opacity: 0.05 }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border border-border bg-popover px-3 py-1.5 text-xs shadow-md">
                              <span className="font-semibold text-popover-foreground">
                                {payload[0].payload.name}: {payload[0].value}
                              </span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" fill="var(--color-primary)" radius={[0, 4, 4, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Audit Ledger */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Recent Audit Trail</CardTitle>
            <CardDescription>Chronological log of ingestions, reviews, and overrides</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[300px] space-y-3">
            {audit.length === 0 ? (
              <p className="text-xs text-muted-foreground py-10 text-center">No audit entries recorded yet.</p>
            ) : (
              audit.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border"
                >
                  <div className="p-2 rounded-lg bg-background border border-border shrink-0 mt-0.5">
                    {iconFor(log.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{log.action}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      <span className="font-medium text-foreground">{log.actor}</span>
                      {log.detail ? ` — ${log.detail}` : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                    {formatWhen(log.createdAt)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
