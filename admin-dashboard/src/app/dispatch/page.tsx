'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, MapPin, Activity, Zap, Users, AlertTriangle, ShieldAlert, BarChart3, Clock, Signal } from 'lucide-react';
import dynamic from 'next/dynamic';

const AdminLiveMap = dynamic(() => import('@/components/AdminLiveMap'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-[#050505] animate-pulse" />
});

export default function DispatchPanel() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [stats, setStats] = useState({
    activeSOS: 0,
    onlineOfficers: 0,
    avgResponseTime: '0.0',
    uptime: '99.9%'
  });

  useEffect(() => {
    // Real-time interval for fetching data
    const fetchData = async () => {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      try {
        const [incRes, offRes] = await Promise.all([
          fetch(`${API_URL}/api/emergency`),
          fetch(`${API_URL}/api/officer`) // Assuming this endpoint exists
        ]);
        
        if (incRes.ok) {
           const incData = await incRes.json();
           setIncidents(incData);
           setStats(prev => ({ ...prev, activeSOS: incData.filter((i:any) => i.status !== 'completed').length }));
        }
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#020202] text-white p-8 flex flex-col font-sans">
      {/* Header HUD */}
      <header className="flex justify-between items-center mb-8 glass p-6 rounded-[2rem] border border-white/5">
        <div className="flex items-center space-x-4">
           <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
              <ShieldAlert className="text-blue-500" size={28} />
           </div>
           <div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase">Tactical Dispatch</h1>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em]">Matrix Command Center</p>
           </div>
        </div>

        <div className="flex items-center space-x-12">
           <div className="text-center">
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Active SOS</p>
              <h4 className="text-xl font-black text-red-500">{stats.activeSOS}</h4>
           </div>
           <div className="text-center">
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Response Time</p>
              <h4 className="text-xl font-black text-blue-400">{stats.avgResponseTime}m</h4>
           </div>
           <div className="text-center">
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">System Uptime</p>
              <h4 className="text-xl font-black text-green-500">{stats.uptime}</h4>
           </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-12 gap-8">
        {/* Incident List */}
        <div className="col-span-3 space-y-6 overflow-y-auto no-scrollbar max-h-[80vh]">
          <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] px-2">Active Feed</h3>
          <AnimatePresence>
            {incidents.map((incident) => (
              <motion.div 
                key={incident.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className={`glass p-5 rounded-3xl border border-white/5 bg-white/5 cursor-pointer hover:bg-white/10 transition-all ${
                  incident.status === 'pending' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-blue-500'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[8px] font-black text-gray-500 uppercase">{incident.id}</span>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                    incident.status === 'pending' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'
                  }`}>
                    {incident.status}
                  </span>
                </div>
                <h4 className="text-sm font-black text-white italic mb-1 uppercase tracking-tighter">{incident.emergencyType}</h4>
                <p className="text-[10px] text-gray-400 font-medium mb-3 uppercase tracking-wide">{incident.citizenName}</p>
                <div className="flex items-center space-x-2 text-[8px] font-bold text-gray-500">
                  <Clock size={10} />
                  <span>{new Date(incident.createdAt).toLocaleTimeString()}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Tactical Map */}
        <div className="col-span-6 relative rounded-[3rem] bg-[#050505] border border-white/5 overflow-hidden shadow-2xl">
           <AdminLiveMap incidents={incidents} />
           
           {/* Map HUD Overlay */}
           <div className="absolute top-6 left-6 z-10 glass px-5 py-3 rounded-2xl border border-white/10 flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest">Tracking Mode: Full Fleet</span>
           </div>
        </div>

        {/* Officer Registry & Stats */}
        <div className="col-span-3 space-y-8">
           <div className="glass p-6 rounded-[2.5rem] border border-white/5">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-6">Unit Registry</h3>
              <div className="space-y-4">
                 {[1, 2, 3].map((i) => (
                   <div key={i} className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all">
                      <div className="flex items-center space-x-3">
                         <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                            <Shield size={18} className="text-green-500" />
                         </div>
                         <div>
                            <p className="text-xs font-black text-white italic">OFF-00{i}</p>
                            <p className="text-[8px] font-black text-gray-500 uppercase">Patrol Unit</p>
                         </div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                   </div>
                 ))}
              </div>
           </div>

           <div className="glass p-6 rounded-[2.5rem] border border-white/5 bg-blue-500/5">
              <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-4">Analytics Radar</h3>
              <div className="h-32 flex items-end justify-between px-2">
                 {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                   <motion.div 
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    className="w-2 bg-blue-500/30 rounded-t-sm"
                   />
                 ))}
              </div>
              <p className="text-[8px] text-center text-blue-400/60 font-black uppercase tracking-[0.3em] mt-4">Hourly SOS Volume</p>
           </div>
        </div>
      </div>

      <style jsx global>{`
        .glass {
          background: rgba(255, 255, 255, 0.02);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
