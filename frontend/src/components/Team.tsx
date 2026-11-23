import React, { useEffect, useState } from 'react';
import { Building2, AlertTriangle, FileText, ArrowUpRight } from 'lucide-react';
import { motion } from 'motion/react';
import { fetchDepartments, DepartmentSummary } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Team() {
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments()
      .then(setDepartments)
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
            Issuing Authorities
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Regulatory bodies, ministries, and procurement agencies identified across documents.
          </p>
        </div>
        <Badge variant="outline" className="font-mono text-xs w-fit">
          {departments.length} authorities tracked
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
          Discovering authorities and document distributions…
        </div>
      )}

      {!loading && !error && departments.length === 0 && (
        <Card className="text-center py-12">
          <CardContent className="flex flex-col items-center justify-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <Building2 size={24} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No Authorities Identified</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Upload regulatory PDFs and the extracted issuing authorities will populate here automatically.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {departments.map((dept, i) => (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            key={dept.name}
          >
            <Card className="h-full hover:border-foreground/20 transition-all shadow-xs flex flex-col justify-between">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building2 size={20} />
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs font-semibold">
                    {dept.documentCount} {dept.documentCount === 1 ? 'doc' : 'docs'}
                  </Badge>
                </div>

                <h3 className="text-base font-semibold text-foreground mb-1 line-clamp-1" title={dept.name}>
                  {dept.name}
                </h3>
                <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                  Latest: <span className="text-foreground font-mono">{dept.latestDoc || '—'}</span>
                </p>

                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Compliance State</span>
                  {dept.flagged > 0 ? (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[11px]">
                      {dept.flagged} flagged
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px]">
                      All clean
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
