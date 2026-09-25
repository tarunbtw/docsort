import React from 'react';
import { mockDepartments } from '../data';
import { Users, Plus } from 'lucide-react';
import { motion } from 'motion/react';

export default function Team() {
  return (
    <>
       <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-light text-[#f5f5f5]">Departments</h1>
        <button className="flex items-center gap-2 bg-[#141414] text-[#f5f5f5] border border-[#262626] px-4 py-2.5 rounded-full text-sm font-medium hover:bg-[#262626] transition-colors">
          <Plus size={16} /> Add Department
        </button>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mockDepartments.map((dept, i) => (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
            key={dept.id} 
            className="bg-[#141414] p-6 rounded-[1.5rem] border border-[#262626] hover:border-[#525252] hover:-translate-y-1 transition-all"
          >
            <div className="w-12 h-12 bg-[#262626] rounded-full flex items-center justify-center mb-4 text-[#f5f5f5]">
              <Users size={20} />
            </div>
            <h3 className="text-lg font-medium text-[#f5f5f5] mb-1">{dept.name}</h3>
            <p className="text-sm text-[#525252] mb-6">Head: <span className="text-[#a3a3a3]">{dept.head}</span></p>
            
            <div className="flex justify-between items-center pt-4 border-t border-[#262626]">
              <span className="text-sm text-[#a3a3a3]">Documents Owned</span>
              <span className="text-[#f5f5f5] font-medium bg-[#0a0a0a] border border-[#262626] px-3 py-1 rounded-lg text-sm">{dept.docs}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </>
  );
}
