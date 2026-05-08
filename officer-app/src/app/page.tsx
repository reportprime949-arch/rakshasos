'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  AlertTriangle, 
  Navigation, 
  CheckCircle, 
  MapPin, 
  Clock, 
  ArrowRight, 
  Wifi, 
  Activity,
  Zap,
  Radio
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useOfficerStore } from '@/store/useOfficerStore';
import { useOfficerFirestore } from '@/hooks/useOfficerFirestore';
import { useOfficerLocation } from '@/hooks/useOfficerLocation';
import { useOfficerSocket } from '@/hooks/useOfficerSocket';
import { IncidentCard } from '@/components/CommandCenter/IncidentCard';
import { IncidentTimeline } from '@/components/CommandCenter/IncidentTimeline';
import { AudioVisualizer } from '@/components/CommandCenter/AudioVisualizer';
import { LocationPermissionModal } from '@/components/CommandCenter/LocationPermissionModal';

// Dynamic import for Map to prevent SSR issues
const OfficerLiveMap = dynamic(() => import('@/components/CommandCenter/OfficerLiveMap'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full rounded-[3rem] bg-[#0a0a0a] border border-white/5 flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-white/5 border-t-blue-500 rounded-full animate-spin" />
    </div>
  )
});

export default function OfficerHome() {
  // Debug Token
  console.log("🛰️ [OFFICER DASHBOARD STARTUP]");
  
  const { 
    isOnline, 
    activeDispatch, 
    status, 
    setOnline, 
    setStatus, 
    clearDispatch,
    officerId,
    officerName
  } = useOfficerStore();

  const [isAccepting, setIsAccepting] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isAlarmActive, setIsAlarmActive] = useState(false);
  const emergencyAlarmRef = useRef<HTMLAudioElement | null>(null);
  const vibrationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { location, locationError } = useOfficerLocation(officerId, officerName);
  const { pendingEmergencies, acceptEmergency } = useOfficerFirestore(location);
  
  // Realtime Socket
  useOfficerSocket(officerId);
  
  useEffect(() => {
    if (locationError) {
      setShowPermissionModal(true);
    } else {
      setShowPermissionModal(false);
    }
  }, [locationError]);

  const handleRetryLocation = () => {
    window.location.reload();
  };

  const startEmergencyAlarm = async () => {
    try {
      if (!emergencyAlarmRef.current) {
        emergencyAlarmRef.current = new Audio('/sounds/alarm.mp3');
        emergencyAlarmRef.current.loop = true;
        emergencyAlarmRef.current.volume = 1;
        emergencyAlarmRef.current.preload = 'auto';
      }

      if (emergencyAlarmRef.current.paused) {
        await emergencyAlarmRef.current.play();
        console.log('🚨 Emergency alarm ACTIVE');
        setIsAlarmActive(true);

        // Mobile Vibration
        if ('vibrate' in navigator) {
          vibrationIntervalRef.current = setInterval(() => {
            navigator.vibrate([500, 300, 500, 300, 1000]);
          }, 3000);
        }
      }
    } catch (error) {
      console.error('Alarm playback failed:', error);
    }
  };

  const stopEmergencyAlarm = () => {
    if (emergencyAlarmRef.current) {
      emergencyAlarmRef.current.pause();
      emergencyAlarmRef.current.currentTime = 0;
      console.log('✅ Officer manually accepted incident');
      setIsAlarmActive(false);

      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
    }
  };

  // Monitor for new incidents to start alarm
  useEffect(() => {
    const hasPending = pendingEmergencies.some(i => i.status === 'PENDING' || i.status === 'SEARCHING' || i.status === 'PRIORITY');
    
    if (hasPending && !isAlarmActive) {
      startEmergencyAlarm();
    }
    // We intentionally DO NOT stop the alarm here as per requirements.
    // It ONLY stops via stopEmergencyAlarm() called in handleAcceptIncident.
  }, [pendingEmergencies, isAlarmActive]);

  const handleAlarmTrigger = (active: boolean) => {
    // This is now handled by startEmergencyAlarm
  };


  const handleAcceptIncident = async (id: string) => {
    stopEmergencyAlarm();
    console.log('✅ Alarm stopped after ACCEPT');
    console.log('👆 [ACCEPT BUTTON CLICKED]', id);
    console.log('🔍 [VALIDATING INCIDENT]');
    setIsAccepting(true);
    console.log('📡 [FIRESTORE UPDATE START]');
    
    const success = await acceptEmergency(id);
    
    if (success) {
      console.log('✅ [FIRESTORE UPDATE SUCCESS]');
      console.log('🚑 [OFFICER STATUS EN_ROUTE]');
      console.log('📊 [CITIZEN REALTIME UPDATED]');
      console.log('🗺️ [NAVIGATION MODE ACTIVE]');
    } else {
      console.log('🔴 [ACCEPT FAILED] - Check Firestore permissions or network');
    }
    setIsAccepting(false);
  };

  const handleArrived = async () => {
    if (!activeDispatch) return;
    try {
      await setDoc(doc(db, 'emergencies', activeDispatch.id), {
        status: 'ARRIVED',
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setStatus('ARRIVED');
    } catch (e) {
      console.error('Error updating status to ARRIVED:', e);
    }
  };

  const handleResolve = async () => {
    if (!activeDispatch) return;
    try {
      await setDoc(doc(db, 'emergencies', activeDispatch.id), {
        status: 'COMPLETED',
        updatedAt: serverTimestamp(),
      }, { merge: true });
      clearDispatch();
      setStatus('IDLE');
    } catch (e) {
      console.error('Error resolving emergency:', e);
    }
  };

  return (
    <main className={`h-screen bg-[#050505] text-[#f5f5f5] flex overflow-hidden font-sans selection:bg-red-500/30 transition-all duration-700 ${isAlarmActive ? 'shadow-[inset_0_0_150px_rgba(220,38,38,0.4)] ring-4 ring-red-600 ring-inset' : ''}`}>

      {/* Emergency Vignette & Flash Overlay */}
      <AnimatePresence>
        {isAlarmActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.2, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="absolute inset-0 bg-red-600 z-[100] pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,49,49,0.03)_0%,transparent_70%)]" />

      {/* LEFT SIDEBAR - COMMAND PANEL */}
      <aside className="w-[450px] h-full border-r border-white/5 bg-black/40 backdrop-blur-3xl flex flex-col z-20 relative">
        {/* Header */}
        <div className="p-8 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <Shield className="text-red-500" size={20} />
              </div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">Raksha Control</h1>
            </div>
            <button
              onClick={() => setOnline(!isOnline)}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all border ${
                isOnline ? 'bg-green-500/10 text-green-500 border-green-500/50 pulse' : 'bg-white/5 text-gray-500 border-white/10'
              }`}
            >
              <Zap size={20} />
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]">Command Active</p>
            </div>
            <div className="h-3 w-px bg-white/10" />
            <div className="flex items-center space-x-2">
              <Wifi size={10} className="text-blue-500" />
              <p className="text-[10px] text-blue-500 font-black uppercase tracking-[0.3em]">Encrypted</p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">
          {/* Active Incident Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Radio className="text-red-500 animate-pulse" size={16} />
                <h2 className="text-xs font-black text-white/40 uppercase tracking-[0.4em]">Active Incident</h2>
              </div>
              <div className="flex items-center space-x-2">
                {pendingEmergencies.length > 0 && !activeDispatch && (
                  <motion.span 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="text-[8px] font-black px-2 py-0.5 rounded bg-red-500 text-white uppercase tracking-widest"
                  >
                    NEW EMERGENCY ALERT
                  </motion.span>
                )}
                <span className="text-[8px] font-black px-2 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 uppercase tracking-widest">Live</span>
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
                  />
                  
                  <div className="glass p-6 rounded-[2rem] border border-white/5 bg-white/5">
                    <div className="flex justify-between items-center mb-6">
                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Current Status</p>
                        <p className="text-sm font-black italic text-blue-500 uppercase tracking-widest">{status}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Travel Time</p>
                        <p className="text-sm font-black italic text-white uppercase tracking-widest">3:42 Min</p>
                      </div>
                    </div>
                    
                    <IncidentTimeline status={status} />
                  </div>

                  {status === 'EN_ROUTE' && (
                    <button
                      onClick={handleArrived}
                      className="w-full h-20 bg-blue-500 rounded-3xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center space-x-3 shadow-[0_20px_50px_rgba(59,130,246,0.3)] hover:scale-[1.02] transition-all group"
                    >
                      <Navigation size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      <span>Confirm Arrival</span>
                    </button>
                  )}

                  {status === 'ARRIVED' && (
                    <button
                      onClick={handleResolve}
                      className="w-full h-20 bg-green-500 rounded-3xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center space-x-3 shadow-[0_20px_50px_rgba(34,197,94,0.3)] hover:scale-[1.02] transition-all group"
                    >
                      <CheckCircle size={20} className="group-hover:scale-110 transition-transform" />
                      <span>Resolve Emergency</span>
                    </button>
                  )}
                </motion.div>
              ) : pendingEmergencies.length > 0 ? (
                <div className="grid gap-6">
                  {pendingEmergencies.map((emergency) => (
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
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-20 text-center space-y-6 opacity-20"
                >
                  <Activity size={48} className="mx-auto text-gray-500 animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">Scanning Global Matrix</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="p-8 border-t border-white/5 bg-black/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${
                isAlarmActive ? 'bg-red-500/10 text-red-500 border-red-500/50 animate-pulse' : 'bg-white/5 text-gray-500 border-white/10'
              }`}>
                <Activity size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Emergency Line</p>
                <p className={`text-xs font-black italic uppercase ${isAlarmActive ? 'text-red-500' : 'text-green-500'}`}>
                  {isAlarmActive ? 'SOS Incoming' : 'Secure Connection'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Sync Status</p>
              <p className="text-xs font-black italic text-blue-500 uppercase">Realtime</p>
            </div>
          </div>
        </div>
      </aside>

      {/* CENTER - LIVE MAP SECTION */}
      <section className="flex-1 h-full p-6 relative bg-black flex flex-col">
        {/* Top Floating Stats */}
        <div className="absolute top-10 left-10 right-10 flex justify-between items-start z-10 pointer-events-none">
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="glass px-8 py-4 rounded-[2rem] border border-white/5 flex items-center space-x-12 pointer-events-auto"
          >
            <div className="text-center">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Signal Strength</p>
              <div className="flex items-center space-x-2 mt-1">
                <div className="w-1 h-3 bg-blue-500 rounded-full" />
                <div className="w-1 h-4 bg-blue-500 rounded-full" />
                <div className="w-1 h-5 bg-blue-500 rounded-full" />
                <div className="w-1 h-2 bg-gray-800 rounded-full" />
              </div>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Live Tracking</p>
              <p className="text-lg font-black italic tracking-tighter text-blue-500 uppercase">Enabled</p>
            </div>
          </motion.div>

          <div className="flex flex-col space-y-4 items-end pointer-events-auto">
             {locationError && (
                <div className="glass px-6 py-3 rounded-2xl border border-red-500/50 bg-red-500/10 text-red-500 flex items-center space-x-3">
                  <AlertTriangle size={16} />
                  <p className="text-[10px] font-black uppercase tracking-widest">{locationError}</p>
                </div>
             )}
          </div>
        </div>

        {/* Real Live Map */}
        <OfficerLiveMap 
          officerLoc={location} 
          citizenLoc={activeDispatch ? { lat: activeDispatch.lat, lng: activeDispatch.lng } : null}
          active={!!activeDispatch}
        />

        {/* Location Permission Modal */}
        <LocationPermissionModal 
          isOpen={showPermissionModal} 
          onRetry={handleRetryLocation} 
        />

        {/* Priority Alert Banner */}
        <AnimatePresence>
          {pendingEmergencies.length > 0 && !activeDispatch && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-2xl z-20"
            >
              <div className="bg-red-600 rounded-[2.5rem] p-8 flex items-center justify-between shadow-[0_0_100px_rgba(220,38,38,0.5)] border border-red-400/30">
                <div className="flex items-center space-x-6">
                   <div className="w-16 h-16 rounded-3xl bg-white/10 flex items-center justify-center animate-pulse">
                      <AlertTriangle size={32} className="text-white" />
                   </div>
                   <div>
                      <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white leading-none">Priority Priority Alert</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/60 mt-2">New Incident detected within 3KM range</p>
                   </div>
                </div>
                <ArrowRight size={32} className="text-white/40" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <style jsx global>{`
        .glass {
          background: rgba(255, 255, 255, 0.03);
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
        .pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .7; transform: scale(0.98); }
        }
        .officer-marker, .citizen-marker {
          cursor: pointer;
        }
      `}</style>
    </main>
  );
}
