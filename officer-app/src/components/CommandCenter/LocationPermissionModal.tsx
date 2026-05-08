'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Shield, Navigation, AlertCircle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onRetry: () => void;
}

export const LocationPermissionModal = ({ isOpen, onRetry }: ModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="w-full max-w-md glass rounded-[3rem] p-10 border border-red-500/30 text-center space-y-8"
          >
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-red-500 rounded-3xl animate-ping opacity-20" />
              <div className="relative w-24 h-24 bg-red-500/10 rounded-3xl flex items-center justify-center border border-red-500/30">
                <MapPin size={48} className="text-red-500" />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white leading-tight">
                Location Access Required
              </h2>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 leading-relaxed">
                Enable GPS to receive nearby SOS alerts and activate navigation matrix.
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={onRetry}
                className="w-full h-16 bg-red-600 rounded-2xl font-black text-xs uppercase tracking-[0.3em] text-white hover:bg-red-500 transition-all shadow-[0_0_40px_rgba(220,38,38,0.3)]"
              >
                Enable Access
              </button>
              
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 flex items-start space-x-3 text-left">
                <AlertCircle size={16} className="text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[9px] font-bold text-gray-400 leading-normal">
                  If blocked, go to browser settings, select "Privacy and Security" &gt; "Site Settings" and allow location for this site.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
