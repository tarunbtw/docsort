import React, { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { motion } from 'motion/react';
import { fetchDepartments, DepartmentSummary } from '../lib/api';

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
    <>
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-light text-[#f5f5f5]">Departments</h1>
          <p className="text-[#a3a3a3] mt-2">Issuing authorities observed across processed documents.</p>
        </div>
      </header>

      {error && (
        <div className="bg-[#141414] border border-[#262626] rounded-[1.5rem] p-6 text-[#a3a3a3]">
          Could not reach the backend: {error}
        </div>
      )}

      {loading && <p className="text-[#a3a3a3]">Loading departments…</p>}

      {!loading && !error && departments.length === 0 && (
        <div className="text-center py-12 bg-[#141414] rounded-[1.5rem] border border-[#262626]">
          <Users size={48} className="text-[#525252] mx-auto mb-4" />
          <h3 className="text-[#f5f5f5] font-medium text-lg">No authorities yet</h3>
          <p className="text-[#a3a3a3]">Upload documents and the issuing authorities will appear here.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept, i) => (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            key={dept.name}
            className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626] hover:border-[#525252] hover:-translate-y-1 transition-all"
          >
            <div className="w-12 h-12 bg-[#262626] rounded-full flex items-center justify-center mb-4 text-[#f5f5f5]">
              <Users size={20} />
            </div>
            <h3 className="text-lg font-medium text-[#f5f5f5] mb-1">{dept.name}</h3>
            <p className="text-sm text-[#525252] mb-6">
              Latest: <span className="text-[#a3a3a3]">{dept.latestDoc}</span>
            </p>

            <div className="flex justify-between items-center pt-4 border-t border-[#262626]">
              <span className="text-sm text-[#a3a3a3]">Documents</span>
              <span className="text-[#f5f5f5] font-medium bg-[#0a0a0a] border border-[#262626] px-3 py-1 rounded-lg text-sm">
                {dept.documentCount}
              </span>
            </div>
            {dept.flagged > 0 && (
              <p className="text-xs text-[#a3a3a3] mt-3">{dept.flagged} flagged for review</p>
            )}
          </motion.div>
        ))}
      </div>
    </>
  );
}
