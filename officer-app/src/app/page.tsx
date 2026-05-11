'use client';

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Shield,
  Navigation,
  CheckCircle,
  Zap,
  Radio,
  Volume2,
  VolumeX,
  Activity,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useOfficerStore } from '@/store/useOfficerStore';
import { useOfficerLocation } from '@/hooks/useOfficerLocation';
import { useOfficerSocket } from '@/hooks/useOfficerSocket';
import { useOfficerFirestore } from '@/hooks/useOfficerFirestore';
import { useAlarmSystem } from '@/hooks/useAlarmSystem';
import { IncidentCard } from '@/components/CommandCenter/IncidentCard';
import { IncidentTimeline } from '@/components/CommandCenter/IncidentTimeline';
import { LocationPermissionModal } from '@/components/CommandCenter/LocationPermissionModal';
import { ResolutionSuccessModal } from '@/components/CommandCenter/ResolutionSuccessModal';

const OfficerLiveMap = dynamic(
  () => import('@/components/CommandCenter/OfficerLiveMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full rounded-[3rem] bg-[#0a0a0a] border border-white/5 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-white/5 border-t-blue-500 rounded-full animate-spin" />
      </div>
    ),
  },
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com';
const POLL_INTERVAL = 15000;

export default function OfficerHome() {
  const [mounted, setMounted] = useState(false);

  const isOnline = useOfficerStore((s) => s.isOnline);
  const activeDispatch = useOfficerStore((s) => s.activeDispatch);
  const activeIncidents = useOfficerStore((s) => s.activeIncidents);
  const status = useOfficerStore((s) => s.status);
  const socketStatus = useOfficerStore((s) => s.socketStatus);
  const audioMuted = useOfficerStore((s) => s.audioMuted);
  const setOnline = useOfficerStore((s) => s.setOnline);
  const setStatus = useOfficerStore((s) => s.setStatus);
  const setIncidents = useOfficerStore((s) => s.setIncidents);
  const setDispatch = useOfficerStore((s) => s.setDispatch);
  const setBackendStatus = useOfficerStore((s) => s.setBackendStatus);
  const clearDispatch = useOfficerStore((s) => s.clearDispatch);
  const removeIncident = useOfficerStore((s) => s.removeIncident);
  const officerId = useOfficerStore((s) => s.officerId);
  const officerName = useOfficerStore((s) => s.officerName);

  const [isAccepting, setIsAccepting] = useState(false);
  const [isArriving, setIsArriving] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [lastResolvedId, setLastResolvedId] = useState('');
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const [showMapMobile, setShowMapMobile] = useState(false);

  const { acceptIncident: emitAccept, emitLocationUpdate } = useOfficerSocket(officerId, officerName);
  const { location, locationError } = useOfficerLocation(officerId, officerName, emitLocationUpdate);
  const { acceptEmergency } = useOfficerFirestore(location);
  const { playAlarm, stopAlarm, toggleMute, onAlarmActiveChange } = useAlarmSystem();

  useEffect(() => {
    onAlarmActiveChange.current = (active: boolean) => {
      setIsAlarmActive(active);
    };
    return () => {
      onAlarmActiveChange.current = null;
    };
  }, [onAlarmActiveChange]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/emergency/active`, { cache: 'no-store' });
      if (!res.ok) {
        setBackendStatus('UNREACHABLE');
        return;
      }
      const data = await res.json();
      setBackendStatus('HEALTHY');

      const filtered = data.filter(
        (i: any) => i.status !== 'resolved' && i.status !== 'completed' && i.status !== 'cancelled',
      );

      const existingIncidents = useOfficerStore.getState().activeIncidents;
      const mergedMap = new Map<string, any>();
      existingIncidents.forEach(inc => mergedMap.set(inc.id, inc));
      filtered.forEach((inc: any) => mergedMap.set(inc.id, inc));
      const merged = Array.from(mergedMap.values());
      setIncidents(merged);

      const assigned = data.find(
        (i: any) =>
          i.assignedOfficerId === officerId &&
          ['assigned', 'enroute', 'arrived'].includes(i.status),
      );
      if (assigned) {
        setDispatch({
          ...assigned,
          latitude: assigned.latitude || assigned.lat || assigned.location?.lat || 0,
          longitude: assigned.longitude || assigned.lng || assigned.location?.lng || 0,
        });
      }
    } catch {
      setBackendStatus('UNREACHABLE');
    }
  }, [officerId, setBackendStatus, setIncidents, setDispatch]);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  useEffect(() => {
    setShowPermissionModal(!!locationError);
  }, [locationError]);

  const handleAcceptIncident = useCallback(
    async (id: string) => {
      stopAlarm();
      setIsAccepting(true);

      const incident = activeIncidents.find((i) => i.id === id);
      if (incident) {
        setDispatch({
          ...incident,
          latitude: incident.latitude || incident.lat || 0,
          longitude: incident.longitude || incident.lng || 0,
        });
      }

      emitAccept(id, officerId);
      setIsAccepting(false);
    },
    [activeIncidents, emitAccept, officerId, setDispatch, stopAlarm],
  );

  const handleArrived = useCallback(async () => {
    if (!activeDispatch) return;
    setIsArriving(true);
    console.log('📡 [OFFICER] Confirming arrival for:', activeDispatch.id);

    const controller = new AbortController();
    // 45s timeout for Render cold starts
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(`${API_URL}/api/emergency/${activeDispatch.id}/arrive`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        mode: 'cors',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Arrive failed: ${response.status} ${errorText}`);
      }

      console.log('✅ [OFFICER] Arrival confirmed');
      setStatus('ARRIVED');
      setDispatch({ ...activeDispatch, status: 'arrived' });
    } catch (error: any) {
      console.error('🔴 [OFFICER ARRIVE FAILED]:', error);
      alert(`Confirm Arrival Failed: ${error.name === 'AbortError' ? 'Request timed out' : error.message}`);
    } finally {
      setIsArriving(false);
    }
  }, [activeDispatch, setStatus, setDispatch]);

  const handleResolve = useCallback(async () => {
    if (!activeDispatch) return;
    const resolvedId = activeDispatch.id;
    setIsResolving(true);
    console.log('📡 [OFFICER] Resolving incident:', resolvedId);

    const controller = new AbortController();
    // 45s timeout for Render cold starts
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const res = await fetch(`${API_URL}/api/emergency/${resolvedId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        mode: 'cors',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Resolve failed: ${res.status} ${errorText}`);
      }

      console.log('✅ [OFFICER] Incident resolved successfully');
      setLastResolvedId(resolvedId);
      setShowResolveModal(true);
      removeIncident(resolvedId);
      clearDispatch();
      fetchIncidents();
    } catch (e: any) {
      console.error('🔴 [OFFICER RESOLVE FAILED]:', e);
      alert(`Resolution Failed: ${e.name === 'AbortError' ? 'Request timed out (Render Cold Start?)' : e.message}`);
    } finally {
      setIsResolving(false);
    }
  }, [activeDispatch, removeIncident, clearDispatch, fetchIncidents]);

  if (!mounted) return null;

  return (
    <main
      className={`h-screen bg-[#050505] text-[#f5f5f5] flex overflow-hidden font-sans selection:bg-red-500/30 transition-all duration-700 transform-gpu will-change-[filter,box-shadow] ${
        isAlarmActive
          ? 'shadow-[inset_0_0_150px_rgba(220,38,38,0.4)] ring-4 ring-red-600 ring-inset'
          : ''
      }`}
    >
      <AnimatePresence>
        {isAlarmActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-red-600 z-[100] pointer-events-none transform-gpu"
          />
        )}
      </AnimatePresence>

      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* Mobile Map Toggle */}
      <div className="lg:hidden fixed bottom-10 right-10 z-[300]">
        <button
          onClick={() => setShowMapMobile(!showMapMobile)}
          className="w-16 h-16 rounded-full bg-blue-600 text-white shadow-2xl flex items-center justify-center border-4 border-white/10"
        >
          {showMapMobile ? <Radio size={24} /> : <Navigation size={24} />}
        </button>
      </div>

      {/* SIDEBAR */}
      <aside
        className={`w-full lg:w-[480px] h-full flex flex-col bg-black/40 backdrop-blur-3xl border-r border-white/5 relative z-20 overflow-hidden transition-all duration-500 ${
          showMapMobile ? '-translate-x-full lg:translate-x-0' : 'translate-x-0'
        }`}
      >
        {/* HEADER */}
        <div className="p-8 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <Shield className="text-red-500" size={20} />
              </div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">
                Raksha Control
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMute}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                  audioMuted
                    ? 'bg-red-500/10 text-red-500 border-red-500/50'
                    : 'bg-white/5 text-gray-400 border-white/10'
                }`}
                title={audioMuted ? 'Unmute Alarm' : 'Mute Alarm'}
              >
                {audioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button
                onClick={() => setOnline(!isOnline)}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border ${
                  isOnline
                    ? 'bg-green-500/10 text-green-500 border-green-500/50 pulse'
                    : 'bg-white/5 text-gray-500 border-white/10'
                }`}
              >
                <Zap size={20} />
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]">
                Command Active
              </p>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center space-x-2">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  socketStatus === 'CONNECTED'
                    ? 'bg-green-500'
                    : socketStatus === 'CONNECTING'
                    ? 'bg-yellow-500 animate-pulse'
                    : 'bg-red-500'
                }`}
              />
              <p
                className={`text-[10px] font-black uppercase tracking-[0.3em] ${
                  socketStatus === 'CONNECTED'
                    ? 'text-green-500'
                    : socketStatus === 'CONNECTING'
                    ? 'text-yellow-500'
                    : 'text-red-500'
                }`}
              >
                {socketStatus === 'CONNECTED'
                  ? 'Encrypted'
                  : socketStatus === 'CONNECTING'
                  ? 'Reconnecting'
                  : 'Offline'}
              </p>
            </div>
          </div>
        </div>

        {/* INCIDENT PANEL */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Radio className="text-red-500 animate-pulse" size={16} />
                <h2 className="text-xs font-black text-white/40 uppercase tracking-[0.4em]">
                  Active Incident
                </h2>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {activeDispatch ? (
                <motion.div
                  key="active"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <IncidentCard
                    emergency={activeDispatch}
                    onViewDetails={() => {}}
                    onAccept={() => handleAcceptIncident(activeDispatch.id)}
                    isLoading={isAccepting}
                    showAcceptButton={false}
                  />
                  <div className="glass p-6 rounded-[2rem] border border-white/5 bg-white/5">
                    <div className="flex justify-between items-center mb-6">
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                          Current Status
                        </p>
                        <p className="text-sm font-black italic text-blue-500 uppercase tracking-widest">
                          {status}
                        </p>
                      </div>
                    </div>
                    <IncidentTimeline status={status} />
                  </div>

                  {status !== 'ARRIVED' &&
                    (status === 'ASSIGNED' || status === 'EN_ROUTE') && (
                      <button
                        onClick={handleArrived}
                        disabled={isArriving}
                        className="w-full h-20 rounded-3xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center space-x-3 bg-blue-500 shadow-[0_20px_50px_rgba(59,130,246,0.3)]"
                      >
                        {isArriving ? (
                          <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Navigation size={20} />
                        )}
                        <span>Confirm Arrival</span>
                      </button>
                    )}

                  {status === 'ARRIVED' && (
                    <button
                      onClick={handleResolve}
                      disabled={isResolving}
                      className="w-full h-20 rounded-3xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center space-x-3 bg-green-600 shadow-[0_20px_50px_rgba(34,197,94,0.3)]"
                    >
                      {isResolving ? (
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <CheckCircle size={20} />
                      )}
                      <span>Resolve Incident</span>
                    </button>
                  )}
                </motion.div>
              ) : activeIncidents.length > 0 ? (
                <div className="grid gap-6">
                  {activeIncidents.map((emergency) => (
                    <IncidentCard
                      key={emergency.id}
                      emergency={emergency}
                      onViewDetails={() => {}}
                      onAccept={() => handleAcceptIncident(emergency.id)}
                      isLoading={isAccepting}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center space-y-6 opacity-20">
                  <Activity size={48} className="mx-auto text-gray-500 animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">
                    Unit Ready: Awaiting Dispatch
                  </p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* BOTTOM STATUS BAR */}
        <div className="p-8 border-t border-white/5 bg-black/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  isAlarmActive
                    ? 'bg-red-500/10 text-red-500 border-red-500/50'
                    : 'bg-white/5 text-gray-500 border-white/10'
                }`}
              >
                <Activity size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">
                  Emergency Line
                </p>
                <p
                  className={`text-xs font-black italic uppercase ${
                    isAlarmActive ? 'text-red-500' : 'text-green-500'
                  }`}
                >
                  {isAlarmActive ? 'SOS Incoming' : 'Secure'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAP SECTION */}
      <section
        className={`absolute inset-0 lg:relative lg:flex-1 h-full p-6 bg-black transition-transform duration-500 ${
          showMapMobile ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <OfficerLiveMap
          officerLoc={location}
          citizenLoc={
            activeDispatch
              ? { latitude: activeDispatch.latitude, longitude: activeDispatch.longitude }
              : null
          }
          active={!!activeDispatch}
          incidents={activeIncidents}
          activeDispatch={activeDispatch}
        />

        <LocationPermissionModal
          isOpen={showPermissionModal}
          onRetry={() => window.location.reload()}
        />
        <ResolutionSuccessModal
          isOpen={showResolveModal}
          onClose={() => setShowResolveModal(false)}
          incidentId={lastResolvedId}
        />

        {/* SYSTEM STATUS PANEL */}
        <div className="absolute bottom-10 right-10 z-[200]">
          <details className="glass rounded-[2rem] border border-white/5 bg-black/80 backdrop-blur-3xl w-72 overflow-hidden">
            <summary className="p-6 flex items-center justify-between cursor-pointer list-none">
              <div className="flex items-center space-x-3">
                <Activity size={14} className="text-blue-500" />
                <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                  Systems
                </span>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${
                  socketStatus === 'CONNECTED' ? 'bg-green-500' : 'bg-red-500'
                } animate-pulse`}
              />
            </summary>
            <div className="p-6 pt-0 space-y-3 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-[8px] text-gray-500 font-bold uppercase">Socket</span>
                <span
                  className={`text-[8px] font-black uppercase ${
                    socketStatus === 'CONNECTED' ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {socketStatus}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] text-gray-500 font-bold uppercase">Audio</span>
                <span
                  className={`text-[8px] font-black uppercase ${
                    audioMuted ? 'text-red-500' : 'text-green-500'
                  }`}
                >
                  {audioMuted ? 'MUTED' : 'ARMED'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] text-gray-500 font-bold uppercase">GPS</span>
                <span
                  className={`text-[8px] font-black uppercase ${
                    location ? 'text-green-500' : 'text-yellow-500'
                  }`}
                >
                  {location ? 'LOCKED' : 'SEARCHING'}
                </span>
              </div>
            </div>
          </details>
        </div>
      </section>

      <style jsx global>{`
        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .pulse {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(0.98);
          }
        }
      `}</style>
    </main>
  );
}
