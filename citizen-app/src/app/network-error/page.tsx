'use client';

import { motion } from 'framer-motion';
import { WifiOff, RotateCcw, ArrowLeft, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEmergencyStore } from '@/store/useEmergencyStore';

export default function NetworkErrorPage() {
  const router = useRouter();
  const reset = useEmergencyStore(state => state.reset);

  const handleRetry = () => {
    reset();
    router.push('/');
  };

  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.1)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:40px_40px]" />

      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md z-10 space-y-12 text-center"
      >
        {/* Error Icon */}
        <div className="relative inline-block">
          <motion.div 
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.8, 0.5] 
            }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="absolute -inset-8 bg-red-500/20 rounded-full blur-2xl"
          />
          <div className="relative w-32 h-32 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/30">
            <WifiOff size={56} className="text-red-500" />
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-4">
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase">
            Connection <span className="text-red-500">Failed</span>
          </h1>
          <p className="text-gray-500 text-sm font-medium leading-relaxed">
            Unable to contact the emergency server. Please check your internet connection or try again.
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-4 pt-8">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRetry}
            className="h-20 bg-red-600 hover:bg-red-500 text-white rounded-3xl flex items-center justify-center space-x-3 transition-all shadow-[0_20px_50px_rgba(220,38,38,0.3)] border border-white/10"
          >
            <RotateCcw size={20} />
            <span className="font-black text-xs uppercase tracking-[0.3em]">Retry SOS</span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { reset(); router.push('/'); }}
            className="h-20 glass text-white/60 hover:text-white rounded-3xl flex items-center justify-center space-x-3 transition-all border border-white/5"
          >
            <ArrowLeft size={20} />
            <span className="font-black text-xs uppercase tracking-[0.3em]">Back to Dashboard</span>
          </motion.button>
        </div>

        {/* Technical Info */}
        <div className="pt-12 flex items-center justify-center space-x-2 text-[10px] font-bold text-gray-700 uppercase tracking-widest">
          <AlertCircle size={12} />
          <span>Error Code: ERR_CONNECTION_FAILED</span>
        </div>
      </motion.div>

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
