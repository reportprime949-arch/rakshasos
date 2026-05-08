'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEmergencyStore } from '@/store/useEmergencyStore';

export default function AlertSentPage() {
  const router = useRouter();
  const status = useEmergencyStore(state => state.status);

  // Auto-redirect to dashboard after a short delay to show the tracking UI
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/');
    }, 2500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.1)_0%,transparent_70%)] pointer-events-none" />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_center,#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md z-10 space-y-12 text-center"
      >
        {/* Success Icon */}
        <div className="relative inline-block">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, delay: 0.2 }}
            className="relative w-32 h-32 bg-green-500 rounded-[2rem] flex items-center justify-center shadow-[0_0_80px_rgba(34,197,94,0.4)] border-4 border-white/20"
          >
            <CheckCircle size={56} className="text-white" />
          </motion.div>
          
          {/* Animated Rings */}
          <div className="absolute inset-0 rounded-[2rem] border-2 border-green-500 animate-ping opacity-20 scale-125" />
        </div>

        {/* Text Content */}
        <div className="space-y-4">
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase">
            Alert <span className="text-green-500">Transmitted</span>
          </h1>
          <p className="text-gray-500 text-sm font-medium tracking-wide">
            Your emergency request has been received by the Command Center.
          </p>
        </div>

        {/* Loading Indicator */}
        <div className="pt-8 flex flex-col items-center space-y-4">
          <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '0%' }}
              transition={{ duration: 2.5, ease: "linear" }}
              className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)]"
            />
          </div>
          <p className="text-[10px] font-black text-green-500/50 uppercase tracking-[0.5em] animate-pulse">
            Connecting to Dispatch...
          </p>
        </div>
      </motion.div>

      {/* Action Button (Manual override) */}
      <motion.button 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={() => router.push('/')}
        className="absolute bottom-12 z-20 px-8 py-4 glass border border-white/5 rounded-2xl text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-white hover:border-white/20 transition-all"
      >
        Skip and Track
      </motion.button>

      <style jsx>{`
        .glass {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
      `}</style>
    </main>
  );
}
