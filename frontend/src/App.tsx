/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Rocket,
  Home,
  FolderOpen,
  ShieldCheck,
  FileText,
  Building2,
  Settings as SettingsIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Dashboard from './components/Dashboard';
import Repository from './components/Repository';
import Compliance from './components/Compliance';
import Reports from './components/Reports';
import Team from './components/Team';
import Settings from './components/Settings';
import { ThemeToggle } from './components/ThemeToggle';
import { Toaster } from '@/components/ui/sonner';

export type Tab = 'dashboard' | 'repository' | 'compliance' | 'reports' | 'team' | 'settings';

interface NavItem {
  tab: Tab;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { tab: 'dashboard', label: 'Dashboard', icon: Home },
  { tab: 'repository', label: 'Repository', icon: FolderOpen },
  { tab: 'compliance', label: 'Compliance Queue', icon: ShieldCheck },
  { tab: 'reports', label: 'Reports & Audit', icon: FileText },
  { tab: 'team', label: 'Authorities', icon: Building2 },
  { tab: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden antialiased">
      {/* Sidebar */}
      <aside className="w-20 lg:w-64 flex flex-col items-center lg:items-stretch py-6 px-3 lg:px-4 bg-sidebar border-r border-sidebar-border shrink-0 select-none">
        {/* Brand */}
        <div
          onClick={() => setActiveTab('dashboard')}
          className="mb-8 px-2 flex items-center gap-3 cursor-pointer group"
        >
          <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
            <Rocket size={18} />
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
              Docsort
            </span>
            <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
              Regulatory Triage
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex flex-col gap-1.5 flex-1 w-full">
          {NAV_ITEMS.map(({ tab, label, icon: Icon }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-3 py-2.5 rounded-xl flex items-center justify-center lg:justify-start gap-3 w-full text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs'
                    : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
                title={label}
              >
                <Icon size={18} className="shrink-0" />
                <span className="hidden lg:inline-block truncate">{label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="hidden lg:block absolute right-2 size-1.5 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions & Theme switch */}
        <div className="pt-4 border-t border-sidebar-border flex flex-col gap-3 w-full">
          <div className="flex items-center justify-between px-1">
            <span className="hidden lg:inline text-xs font-medium text-muted-foreground">
              Appearance
            </span>
            <ThemeToggle />
          </div>

          {/* User badge */}
          <div className="flex items-center gap-3 p-1.5 rounded-xl bg-sidebar-accent/40 border border-sidebar-border/60">
            <img
              src="https://api.dicebear.com/7.x/notionists/svg?seed=Haris&backgroundColor=11212D"
              alt="Avatar"
              className="size-8 rounded-lg bg-muted border border-border shrink-0"
            />
            <div className="hidden lg:flex flex-col min-w-0">
              <span className="text-xs font-medium text-sidebar-foreground truncate">
                Compliance Officer
              </span>
              <span className="text-[10px] text-muted-foreground truncate">
                Auditor Session
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 overflow-y-auto px-6 lg:px-10 py-8 bg-background">
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} />}
              {activeTab === 'repository' && <Repository />}
              {activeTab === 'compliance' && <Compliance />}
              {activeTab === 'reports' && <Reports />}
              {activeTab === 'team' && <Team />}
              {activeTab === 'settings' && <Settings />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <Toaster position="bottom-right" />
    </div>
  );
}
