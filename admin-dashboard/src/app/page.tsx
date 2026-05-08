'use client';

import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, MapPin, AlertCircle, Users, Activity, ExternalLink } from 'lucide-react';
import { useAdminStore } from '@/store/useAdminStore';
import { useAdminFirestore } from '@/hooks/useAdminFirestore';
import { useState, useEffect } from 'react';

const AdminLiveMap = dynamic(() => import('@/components/admin/AdminLiveMap'), { 
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
       <div className="text-center space-y-6">
          <div className="w-24 h-24 border-4 border-white/5 border-t-blue-500 rounded-full animate-spin mx-auto" />
          <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.5em]">Synchronizing Matrix...</p>
       </div>
    </div>
  )
});

export default function AdminDashboard() {
  const { emergencies, activeOfficers } = useAdminStore();
  const [isEmergencyVisualActive, setIsEmergencyVisualActive] = useState(false);
  
  // Connect to Firestore realtime listener
  useAdminFirestore();

  // Monitor for new incidents to trigger visual alerts only
  useEffect(() => {
    const hasPending = emergencies.some(i => i.status === 'PENDING' || i.status === 'SEARCHING');
    setIsEmergencyVisualActive(hasPending);
  }, [emergencies]);

  return (
    <div className={`flex h-screen bg-black text-white overflow-hidden font-sans transition-all duration-700 ${isEmergencyVisualActive ? 'shadow-[inset_0_0_150px_rgba(220,38,38,0.4)] ring-4 ring-red-600 ring-inset' : ''}`}>

      {/* Emergency Vignette & Flash Overlay */}
      <AnimatePresence>
        {isEmergencyVisualActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.15, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-red-600 z-[100] pointer-events-none"
          />
        )}
      </AnimatePresence>
      {/* Sidebar - Incident Feed */}
      <aside className="w-[400px] border-r border-white/5 bg-[#050505] flex flex-col z-20">
        <div className="p-8 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-black tracking-tighter uppercase italic">Raksha Control</h1>
            {emergencies.length > 0 && (
              <motion.span 
                animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="text-[8px] font-black px-2 py-1 rounded bg-red-600 text-white uppercase tracking-widest"
              >
                NEW EMERGENCY ALERT
              </motion.span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <p className="text-gray-500 text-[10px] uppercase tracking-[0.3em] font-black">Live Monitoring Active</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Active Incidents</h2>
            <span className="bg-red-500/10 text-red-500 text-[10px] px-3 py-1 rounded-full font-black border border-red-500/20">
              {emergencies.length} LIVE
            </span>
          </div>

          <AnimatePresence mode="popLayout">
            {emergencies.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-12 text-center border border-dashed border-white/10 rounded-3xl"
              >
                <Activity size={32} className="mx-auto text-gray-800 mb-4" />
                <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">No active emergencies detected</p>
              </motion.div>
            ) : (
              emergencies.map((alert: any) => (
                <motion.div
                  key={alert.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-6 rounded-[2rem] border transition-all hover:bg-white/5 cursor-pointer group ${
                    alert.status === 'PENDING' || alert.status === 'SEARCHING' ? 'bg-red-500/5 border-red-500/20' : 'bg-white/5 border-white/5'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Incident ID</p>
                      <h3 className="text-lg font-black tracking-tighter italic">{alert.id}</h3>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${
                      alert.status === 'PENDING' || alert.status === 'SEARCHING' ? 'bg-red-500 text-white' : 'bg-blue-500/20 text-blue-500'
                    }`}>
                      {alert.status}
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center space-x-3">
                      <Users size={14} className="text-gray-600" />
                      <p className="text-xs font-bold text-gray-400">{alert.citizenName || 'Unknown Citizen'}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <MapPin size={14} className="text-gray-600" />
                      <p className="text-[10px] font-mono text-gray-500">
                        {alert.lat?.toFixed(4) || '0.0000'}, {alert.lng?.toFixed(4) || '0.0000'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    {alert.assignedOfficerId ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <p className="text-[10px] font-black uppercase text-blue-500">Officer Assigned</p>
                      </div>
                    ) : (
                      <p className="text-[10px] font-black uppercase text-amber-500 animate-pulse">Awaiting Dispatch</p>
                    )}
                    <ExternalLink size={14} className="text-gray-700 group-hover:text-white transition-colors" />
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* Main Content - Geospatial View */}
      <main className="flex-1 relative bg-black overflow-hidden">
        {/* Actual Live Map Component */}
        <AdminLiveMap 
          incidents={emergencies} 
          officers={activeOfficers} 
        />
        
        {/* Top Analytics */}
        <div className="absolute top-10 left-10 right-10 flex justify-between items-start pointer-events-none z-10">
          <div className="glass px-8 py-4 rounded-[2rem] border border-white/5 flex items-center space-x-12 pointer-events-auto shadow-2xl">
            <div className="text-center">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Active Officers</p>
              <p className="text-3xl font-black italic tracking-tighter">{activeOfficers.length || '---'}</p>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Response Time</p>
              <p className="text-3xl font-black italic tracking-tighter text-green-500">3.8m</p>
            </div>
          </div>

          <div className="glass px-8 py-4 rounded-[2rem] border border-white/5 pointer-events-auto shadow-2xl">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                <Activity size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Network Throughput</p>
                <p className="text-sm font-black italic">1,244 Events/sec</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        .glass {
          background: rgba(10, 10, 10, 0.6);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
