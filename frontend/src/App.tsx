/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Rocket, Home, FolderOpen, ShieldCheck, FileText, Users, Settings as SettingsIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import Repository from './components/Repository';
import Compliance from './components/Compliance';
import Reports from './components/Reports';
import Team from './components/Team';
import Settings from './components/Settings';
import { Toaster } from '@/components/ui/sonner';

export type Tab = 'dashboard' | 'repository' | 'compliance' | 'reports' | 'team' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const NavButton = ({ tab, label, icon: Icon }: { tab: Tab, label: string, icon: any }) => (
    <button 
      onClick={() => setActiveTab(tab)}
      className={`p-3 lg:px-4 lg:py-3 rounded-2xl flex items-center justify-center lg:justify-start lg:gap-3 lg:w-full shadow-sm transition-all duration-300 ${
        activeTab === tab 
          ? 'text-black bg-white' 
          : 'text-[#525252] hover:text-white hover:bg-[#262626]'
      }`}
    >
      <Icon size={20} className="shrink-0" />
      <span className="hidden lg:block text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-[#f5f5f5] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 flex flex-col items-center lg:items-start py-8 lg:px-4 bg-[#141414] border-r border-[#262626] shrink-0">
        <div className="mb-12 px-2 text-[#a3a3a3] hover:text-[#f5f5f5] transition-colors cursor-pointer flex items-center gap-3">
          <Rocket size={24} />
          <span className="hidden lg:block text-lg font-semibold tracking-tight text-white">Docsort</span>
        </div>
        <nav className="flex flex-col gap-4 lg:gap-2 flex-1 w-full items-center lg:items-stretch">
          <NavButton tab="dashboard" label="Dashboard" icon={Home} />
          <NavButton tab="repository" label="Repository" icon={FolderOpen} />
          <NavButton tab="compliance" label="Compliance" icon={ShieldCheck} />
          <NavButton tab="reports" label="Reports" icon={FileText} />
          <NavButton tab="team" label="Team" icon={Users} />
          <NavButton tab="settings" label="Settings" icon={SettingsIcon} />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-8 lg:px-12 py-8 bg-[#0a0a0a]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full"
          >
            {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
            {activeTab === 'repository' && <Repository />}
            {activeTab === 'compliance' && <Compliance />}
            {activeTab === 'reports' && <Reports />}
            {activeTab === 'team' && <Team />}
            {activeTab === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>
      </main>
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
