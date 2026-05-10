'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, X, MapPin, Navigation, Phone, AlertCircle, CheckCircle, Zap, AlertTriangle, Activity } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useEmergencyStore } from '@/store/useEmergencyStore';
import { StatusTimeline } from '@/components/emergency/StatusTimeline';
import { OfficerCard } from '@/components/emergency/OfficerCard';
import { useSocket } from '@/hooks/useSocket';

const CitizenLiveMap = dynamic(() => import('@/components/emergency/CitizenLiveMap'), { 
  ssr: false,
  loading: () => <div className="w-full h-full bg-[#0a0a0a] animate-pulse" />
});

export default function CitizenHome() {
  const { coords, error, loading, permissionStatus, requestPermission, openSettings } = useGeolocation();
  const { 
    id, 
    status, 
    officer, 
    startCountdown,
    triggerSOS, 
    setLocation,
    cancelEmergency 
  } = useEmergencyStore();
  const router = useRouter();

  const [countdown, setCountdown] = useState(3);
  
  // Connect to realtime server
  const socket = useSocket('citizen-test-token');

  // === PHASE 1: MANDATORY GPS ACCESS ===
  const isGpsDenied = permissionStatus === 'denied' || error === 'PERMISSION_DENIED';
  const isGpsLoading = loading && !coords;
  const canTriggerSos = coords !== null && !isGpsDenied;

  // === CRITICAL: Purge stale emergency state on mount ===
  useEffect(() => {
    try {
      localStorage.removeItem('rakshasos-emergency-session');
      localStorage.removeItem('activeSOS');
      localStorage.removeItem('activeEmergency');
    } catch { /* SSR guard */ }

    const currentStatus = useEmergencyStore.getState().status;
    if (currentStatus !== 'IDLE') {
      useEmergencyStore.getState().reset();
    }
  }, []);

  // Countdown timer for SOS activation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === 'COUNTDOWN') {
      if (countdown > 0) {
        if (window.navigator.vibrate) window.navigator.vibrate(50);
        timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      } else {
        const handleSOS = async () => {
          if (!coords) return; // Final safety check
          try {
             const result = await triggerSOS('Test Citizen', 'CIT-12345');
             if (result?.success) {
                router.push("/alert-sent");
             } else {
                router.push("/network-error");
             }
          } catch (err) {
             console.error(err);
             router.push("/network-error");
          }
        };
        handleSOS();
      }
    } else {
      setCountdown(3);
    }
    return () => clearTimeout(timer);
  }, [status, countdown, triggerSOS, router, coords]);

  // Start polling when an active SOS exists
  useEffect(() => {
    if (id) {
      const unsub = useEmergencyStore.getState().syncWithFirestore();
      return () => unsub();
    }
  }, [id]);

  // Sync GPS coordinates to store
  useEffect(() => {
    if (coords) setLocation({ latitude: coords.latitude, longitude: coords.longitude });
  }, [coords, setLocation]);

  return (
    <main className={`min-h-screen transition-colors duration-1000 flex flex-col overflow-hidden ${
      status === 'COMPLETED' ? 'bg-[#001219]' : 'bg-black'
    }`}>
      {/* PHASE 1: FULLSCREEN PERMISSION WARNING */}
      <AnimatePresence>
        {isGpsDenied && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center mb-8 border-2 border-red-500/50">
              <MapPin className="text-red-500" size={48} />
            </div>
            <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase mb-4">Location Required</h2>
            <p className="text-gray-400 text-sm mb-12 max-w-xs leading-relaxed">
              RakshaSOS requires precise GPS tracking to send emergency services to your exact location. We cannot trigger an SOS without it.
            </p>
            <button
              onClick={openSettings}
              className="px-12 py-5 bg-red-600 rounded-full text-xs font-black uppercase tracking-[0.3em] text-white shadow-[0_0_50px_rgba(220,38,38,0.3)]"
            >
              Enable GPS Access
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Background Glow */}
      <AnimatePresence>
        {status !== 'IDLE' && status !== 'COMPLETED' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.15)_0%,transparent_70%)] pointer-events-none"
          />
        )}
        {status === 'COMPLETED' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.1)_0%,transparent_70%)] pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {status === 'IDLE' || status === 'COUNTDOWN' ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-6 space-y-12 relative z-10"
          >
            <div className="space-y-4 text-center">
              <h1 className="text-5xl font-black tracking-tighter uppercase italic text-white/20">RakshaSOS</h1>
            </div>

            <div className="relative">
              {status === 'COUNTDOWN' ? (
                <div className="w-72 h-72 rounded-full border-8 border-red-500 flex items-center justify-center bg-red-500/10 shadow-[0_0_50px_rgba(239,68,68,0.3)]">
                  <span className="text-8xl font-black text-red-500">{countdown}</span>
                </div>
              ) : (
                <button
                  onClick={startCountdown}
                  disabled={!canTriggerSos}
                  className={`emergency-btn w-72 h-72 rounded-full flex flex-col items-center justify-center space-y-2 transition-all ${
                    canTriggerSos ? 'pulse scale-100 opacity-100' : 'opacity-40 grayscale scale-95 cursor-not-allowed'
                  }`}
                >
                  <span className="text-5xl font-black text-white">SOS</span>
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest">
                    {isGpsLoading ? 'Locking GPS...' : 'Tap to Alert'}
                  </p>
                </button>
              )}
            </div>

            <div className="pt-12 flex flex-col items-center space-y-4">
               <div className="flex items-center space-x-2 text-gray-700">
                <div className={`w-2 h-2 rounded-full ${permissionStatus === 'granted' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)]' : 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,1)]'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Signal: {permissionStatus === 'granted' ? 'High Accuracy' : 'Standby'}
                </span>
              </div>
              
              {!canTriggerSos && !isGpsDenied && (
                <motion.p 
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center"
                >
                  Acquiring secure GPS signal...
                </motion.p>
              )}
            </div>
          </motion.div>
        ) : status === 'COMPLETED' ? (
          <motion.div
            key="completed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden"
          >
            {/* PREMIUM BACKGROUND SYSTEM */}
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 bg-[#001219]" />
              <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#1e3a8a_1px,transparent_1px),linear-gradient(to_bottom,#1e3a8a_1px,transparent_1px)] bg-[size:60px_60px]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.15)_0%,transparent_70%)]" />
              
              {/* Animated Scanlines */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] [background-size:100%_4px,4px_100%] animate-pulse" />
              
              {/* Radar Grid Texture */}
              <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_center,#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
            </div>

            {/* TOP STATUS CHIP */}
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute top-10 right-10 z-20 glass px-5 py-2.5 rounded-full border border-green-500/30 flex items-center space-x-3 bg-green-500/5 shadow-[0_0_20px_rgba(34,197,94,0.2)]"
            >
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,1)]" />
              <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.3em]">System Secure</span>
            </motion.div>

            {/* CINEMATIC SUCCESS ICON */}
            <div className="relative mb-12 z-10">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="relative"
              >
                {/* Rotating Halos */}
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 10, ease: 'linear' }}
                  className="absolute -inset-16 border border-green-500/10 rounded-full"
                />
                <motion.div 
                  animate={{ rotate: -360 }}
                  transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
                  className="absolute -inset-20 border border-dashed border-green-500/5 rounded-full"
                />
                
                {/* Success Shield */}
                <div className="relative w-36 h-36 bg-green-500 rounded-[2.5rem] flex items-center justify-center shadow-[0_0_80px_rgba(34,197,94,0.4)] border-4 border-white/20 overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent"></div>
                  <CheckCircle size={72} className="text-white relative z-10 drop-shadow-2xl" />
                </div>
                
                {/* Pulse Rings */}
                <div className="absolute inset-0 rounded-full border-4 border-green-500 animate-ping opacity-20 scale-150" />
              </motion.div>
            </div>

            {/* TYPOGRAPHY SECTION */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center space-y-4 mb-12 z-10"
            >
              <h2 className="text-5xl font-black italic tracking-tighter text-white uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                Emergency <span className="text-green-500">Resolved</span>
              </h2>
              <div className="flex flex-col items-center space-y-2">
                <p className="text-sm text-gray-400 font-medium tracking-wide">Authorities have resolved your emergency.</p>
                <motion.div 
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="flex items-center space-x-2 text-green-500 font-black tracking-[0.2em] text-[10px] uppercase"
                >
                  <CheckCircle size={12} />
                  <span>You are now safe</span>
                </motion.div>
              </div>
            </motion.div>

            {/* PREMIUM OFFICER CARD & MINI MAP */}
            <motion.div 
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="w-full max-w-lg z-10 space-y-6"
            >
              <div className="glass p-8 rounded-[3.5rem] border border-white/5 bg-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6">
                   <Zap size={20} className="text-green-500/50" />
                </div>
                <div className="flex items-center space-x-6 mb-8">
                  <div className="w-16 h-16 rounded-3xl bg-green-500/10 flex items-center justify-center border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                    <Shield className="text-green-500" size={32} />
                  </div>
                  <div>
                    <p className="text-[8px] font-black text-green-500 uppercase tracking-[0.4em] mb-1">Mission Specialist</p>
                    <h3 className="text-2xl font-black text-white italic tracking-tighter uppercase">{officer?.name || 'Officer Miller'}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-8 pb-8 border-b border-white/5">
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Badge</p>
                    <p className="text-sm font-bold text-white italic">{officer?.badge || 'OFF-9921'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Status</p>
                    <div className="flex items-center space-x-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,1)]" />
                       <p className="text-sm font-bold text-green-500 italic uppercase">Closed</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Time</p>
                    <p className="text-sm font-bold text-white italic">2.4 Min</p>
                  </div>
                </div>

                {/* Mini Tactical Map */}
                <div className="mt-8 h-40 rounded-[2.5rem] overflow-hidden border border-white/5 relative group-hover:border-green-500/20 transition-colors">
                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                  <CitizenLiveMap 
                    officerLoc={{ latitude: officer?.latitude || 17.3850, longitude: officer?.longitude || 78.4867 }}
                    citizenLoc={coords ? { latitude: coords.latitude, longitude: coords.longitude } : { latitude: 17.3850, longitude: 78.4867 }}
                    status="COMPLETED"
                  />
                  <div className="absolute bottom-4 left-6 z-20 flex items-center space-x-2">
                    <MapPin size={10} className="text-green-500" />
                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Arrived Safely</span>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="grid grid-cols-2 gap-4">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => useEmergencyStore.getState().reset()} 
                  className="h-20 glass bg-white/10 hover:bg-white/20 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] transition-all border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
                >
                  Close Session
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="h-20 bg-transparent hover:bg-green-500/10 text-green-500 border border-green-500/30 rounded-3xl font-black text-xs uppercase tracking-[0.3em] transition-all"
                >
                  Send Feedback
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col bg-[#050505] relative"
          >
            <header className="p-6 flex justify-between items-start z-10">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                   <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                   <h2 className="text-xs font-black uppercase tracking-widest text-red-500 italic">Connected to Dispatch</h2>
                </div>
                <div className="flex items-center space-x-3">
                  <p className="text-2xl font-black text-white tracking-tighter">{id}</p>
                  <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/50 text-[8px] font-black text-red-500 uppercase tracking-widest animate-pulse">Live</span>
                </div>
              </div>
              <button onClick={cancelEmergency} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                <X size={20} className="text-gray-400" />
              </button>
            </header>

              <div className="flex-1 px-6 space-y-6 flex flex-col">
                <div className="flex-1 relative rounded-[2.5rem] bg-[#0a0a0a] border border-white/5 overflow-hidden shadow-2xl">
                  {status !== 'SEARCHING' && officer ? (
                    <div className="absolute inset-0">
                      <CitizenLiveMap 
                        officerLoc={{ latitude: officer.latitude, longitude: officer.longitude }} 
                        citizenLoc={coords ? { latitude: coords.latitude, longitude: coords.longitude } : null}
                        status={status}
                      />
                      <div className="absolute top-6 left-6 z-10 glass px-4 py-2 rounded-xl border border-white/10 flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[8px] font-black text-white uppercase tracking-widest">Tracking Mode: Active</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff20_1px,transparent_1px)] [background-size:20px_20px]" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center space-y-4">
                          <div className={`w-14 h-14 border-4 border-white/5 border-t-red-500 rounded-full ${status === 'SEARCHING' ? 'animate-spin' : ''} mx-auto`} />
                            <div className="space-y-1">
                            <p className="text-sm font-black text-white uppercase italic">
                              {status === 'SEARCHING' ? 'Scanning Matrix' : 'Connecting Unit'}
                            </p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                              Locating nearest response units...
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="pb-10">
                  <AnimatePresence mode="wait">
                    {officer && (status !== 'SEARCHING') ? (
                      <motion.div key="officer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <OfficerCard officer={officer} />
                      </motion.div>
                    ) : (
                      <motion.div key="timeline" className="glass rounded-3xl p-8 border border-white/5">
                        <StatusTimeline currentStatus={status} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
        .emergency-btn {
          background: radial-gradient(circle at center, #ff3131 0%, #8b0000 100%);
          box-shadow: 0 0 50px rgba(255, 49, 49, 0.4);
          border: 4px solid rgba(255, 255, 255, 0.1);
        }
        .pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 50px rgba(255, 49, 49, 0.4); }
          50% { transform: scale(0.98); box-shadow: 0 0 80px rgba(255, 49, 49, 0.6); }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </main>
  );
}
