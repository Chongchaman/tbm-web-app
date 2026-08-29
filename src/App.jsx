import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Calculator, 
  Sparkles, 
  Compass, 
  History, 
  Database, 
  Droplets, 
  HardHat, 
  ShieldCheck, 
  Menu, 
  X, 
  User,
  Cloud,
  CloudCheck,
  CloudOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import AdvancePlannerView from './views/AdvancePlannerView';
import AutoPlannerView from './views/AutoPlannerView';
import PlannerView from './views/PlannerView';
import DashboardView from './views/DashboardView';
import HistoryLogView from './views/HistoryLogView';
import ConsumablesView from './views/ConsumablesView';
import MasterDataView from './views/MasterDataView';
import ErrorBoundary from './components/ErrorBoundary';
import SupabaseModal from './components/SupabaseModal';
import { INITIAL_RING_LOGS } from './data/tbmConstants';
import { isSupabaseConfigured } from './services/supabaseClient';
import { 
  fetchRingLogsFromCloud, 
  saveRingLogToCloud, 
  batchSaveRingLogsToCloud, 
  deleteRingLogFromCloud,
  subscribeToRealtimeRings 
} from './services/supabaseService';

export default function App() {
  const [activeTab, setActiveTab] = useState('advanceplanner');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(isSupabaseConfigured());

  const [ringLogs, setRingLogs] = useState(() => {
    try {
      const saved = localStorage.getItem('tbm_ring_logs');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_RING_LOGS;
  });

  const [role, setRole] = useState('Chief Engineer');

  // Save to LocalStorage whenever ringLogs changes
  useEffect(() => {
    try {
      localStorage.setItem('tbm_ring_logs', JSON.stringify(ringLogs));
    } catch (e) {
      console.error(e);
    }
  }, [ringLogs]);

  // Initial Cloud Load and Realtime Subscription
  useEffect(() => {
    if (isCloudConnected) {
      // 1. Fetch latest rings from Supabase Cloud
      fetchRingLogsFromCloud().then((res) => {
        if (res.data && res.data.length > 0) {
          setRingLogs(res.data);
        }
      });

      // 2. Subscribe to Realtime Postgres Changes across devices
      const unsubscribe = subscribeToRealtimeRings(
        // On Insert
        (newRing) => {
          setRingLogs((prev) => {
            const exists = prev.some((r) => r.ringNumber === newRing.ringNumber);
            if (exists) return prev;
            return [...prev, newRing].sort((a, b) => (a.ringNumber || 0) - (b.ringNumber || 0));
          });
        },
        // On Update
        (updatedRing) => {
          setRingLogs((prev) =>
            prev.map((r) => (r.ringNumber === updatedRing.ringNumber ? updatedRing : r))
          );
        },
        // On Delete
        (deletedRingNum) => {
          setRingLogs((prev) => prev.filter((r) => r.ringNumber !== deletedRingNum));
        }
      );

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, [isCloudConnected]);

  // Handlers for ring log management (Syncs to both Local & Cloud)
  const handleSaveRing = async (newRecord) => {
    setRingLogs((prev) => [...prev, newRecord]);
    if (isCloudConnected) {
      await saveRingLogToCloud(newRecord);
    }
  };

  const handleBatchSaveRings = async (records) => {
    setRingLogs((prev) => [...prev, ...records]);
    if (isCloudConnected) {
      await batchSaveRingLogsToCloud(records);
    }
  };

  const handleUpdateRing = async (index, updatedRecord) => {
    setRingLogs((prev) => {
      const copy = [...prev];
      copy[index] = updatedRecord;
      return copy;
    });
    if (isCloudConnected) {
      await saveRingLogToCloud(updatedRecord);
    }
  };

  const handleDeleteRing = async (index) => {
    const ringToDelete = ringLogs[index];
    if (window.confirm('Are you sure you want to delete this ring record?')) {
      setRingLogs((prev) => prev.filter((_, i) => i !== index));
      if (isCloudConnected && ringToDelete) {
        await deleteRingLogFromCloud(ringToDelete.ringNumber);
      }
    }
  };

  const menuItems = [
    { id: 'advanceplanner', label: 'Advance STA Plan', icon: Compass, highlight: true, badge: 'STA' },
    { id: 'autoplanner', label: 'Auto Plan (AI)', icon: Sparkles },
    { id: 'planning', label: 'Manual Planner', icon: Calculator },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'history', label: 'Ring History', icon: History, count: ringLogs.length },
    { id: 'consumables', label: 'Foam & Polymer', icon: Droplets },
    { id: 'masterdata', label: 'Alignment & Master Data', icon: Database },
  ];

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-bg text-text font-sans antialiased selection:bg-acc selection:text-black">
        {/* Sidebar */}
        <motion.aside
          initial={false}
          animate={{ width: isSidebarOpen ? 260 : 78 }}
          className="glass h-screen sticky top-0 flex flex-col border-r border-white/5 z-50 overflow-hidden shrink-0"
        >
          {/* Brand Header */}
          <div className="p-5 flex items-center gap-3 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-acc shadow-[0_0_20px_rgba(0,212,255,0.35)] flex items-center justify-center shrink-0">
              <HardHat size={22} color="#000" />
            </div>
            {isSidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col overflow-hidden">
                <span className="font-bold text-base tracking-tight bg-gradient-to-r from-white via-white/90 to-cyan-200 bg-clip-text text-transparent whitespace-nowrap">
                  TBM PLANNER
                </span>
                <span className="text-[10px] text-acc font-mono uppercase tracking-wider">
                  MWA-9D TBM#34
                </span>
              </motion.div>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all font-medium text-xs ${
                    isActive
                      ? item.highlight
                        ? 'bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-emerald-500/20 text-acc border border-acc/40 shadow-lg shadow-cyan-500/15'
                        : 'bg-acc/15 text-acc border border-acc/30 shadow-lg shadow-cyan-500/10'
                      : 'text-text-muted hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                  title={!isSidebarOpen ? item.label : undefined}
                >
                  <Icon size={20} className={`shrink-0 ${item.highlight && !isActive ? 'text-purple-400' : ''}`} />
                  {isSidebarOpen && (
                    <span className="tracking-wide text-left flex-1 truncate">{item.label}</span>
                  )}
                  {isSidebarOpen && item.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 font-bold">
                      {item.badge}
                    </span>
                  )}
                  {isSidebarOpen && item.count !== undefined && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/10 text-text-muted">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Cloud Database Status Footer */}
          <div className="p-3 border-t border-white/5">
            <button
              type="button"
              onClick={() => setIsSupabaseModalOpen(true)}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-surf-3 hover:bg-surf-2 border border-white/5 text-left transition-all group"
            >
              <div className={`p-1.5 rounded-lg ${isCloudConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-text-muted'}`}>
                <Cloud size={16} />
              </div>
              {isSidebarOpen && (
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] text-text block truncate">Supabase Cloud</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isCloudConnected ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`}></span>
                  </div>
                  <span className="text-[10px] text-text-muted block truncate font-mono">
                    {isCloudConnected ? '🟢 Live Realtime' : '⚪ Local Mode'}
                  </span>
                </div>
              )}
            </button>
          </div>
        </motion.aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Navbar */}
          <header className="sticky top-0 z-40 glass border-b border-white/5 px-6 py-3.5 flex items-center justify-between backdrop-blur-md">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-white/5 rounded-lg text-text-muted hover:text-white transition-colors"
                aria-label="Toggle Sidebar"
              >
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text capitalize">
                  {menuItems.find(m => m.id === activeTab)?.label || activeTab}
                </span>
                <span className="text-xs text-text-muted font-mono">/ MRT Purple Line &bull; MWA-9D</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Cloud Realtime Status Pill Button */}
              <button
                type="button"
                onClick={() => setIsSupabaseModalOpen(true)}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold transition-all border ${
                  isCloudConnected
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 shadow-sm'
                    : 'bg-surf-3 border-white/10 text-text-muted hover:text-white hover:border-acc/40'
                }`}
              >
                <Cloud size={14} className={isCloudConnected ? 'text-emerald-400' : 'text-text-muted'} />
                {isCloudConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>}
                <span>{isCloudConnected ? 'Supabase Live' : 'เชื่อมต่อ Cloud'}</span>
              </button>

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="bg-surf-3 border border-white/10 text-text text-xs rounded-lg px-2.5 py-1.5 font-sans outline-none focus:border-acc"
              >
                <option value="Chief Engineer">Role: Chief Engineer</option>
                <option value="TBM Pilot / Operator">Role: TBM Operator</option>
                <option value="Chief Surveyor">Role: Chief Surveyor</option>
                <option value="Project Admin">Role: Project Admin</option>
              </select>
            </div>
          </header>

          {/* Tab Views with Animation */}
          <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.18 }}
              >
                {activeTab === 'advanceplanner' && (
                  <AdvancePlannerView ringLogs={ringLogs} onBatchSave={handleBatchSaveRings} onNavigate={setActiveTab} />
                )}
                {activeTab === 'autoplanner' && (
                  <AutoPlannerView ringLogs={ringLogs} onBatchSave={handleBatchSaveRings} />
                )}
                {activeTab === 'planning' && (
                  <PlannerView ringLogs={ringLogs} onSaveRing={handleSaveRing} />
                )}
                {activeTab === 'dashboard' && (
                  <DashboardView ringLogs={ringLogs} />
                )}
                {activeTab === 'history' && (
                  <HistoryLogView
                    ringLogs={ringLogs}
                    onUpdateRing={handleUpdateRing}
                    onDeleteRing={handleDeleteRing}
                    onAddRing={handleSaveRing}
                  />
                )}
                {activeTab === 'consumables' && (
                  <ConsumablesView />
                )}
                {activeTab === 'masterdata' && (
                  <MasterDataView onNavigate={setActiveTab} />
                )}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Cloud Supabase Setup & Realtime Sync Modal */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        ringLogs={ringLogs}
        onSyncRingLogs={setRingLogs}
        onConnectionChange={setIsCloudConnected}
      />
    </ErrorBoundary>
  );
}
