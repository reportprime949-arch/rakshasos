'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Shield, ArrowRight } from 'lucide-react';

interface ResolutionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string;
}

export const ResolutionSuccessModal = ({ isOpen, onClose, incidentId }: ResolutionSuccessModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md glass p-10 rounded-[3rem] border border-green-500/30 bg-black/40 shadow-[0_0_100px_rgba(34,197,94,0.2)] text-center overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.1)_0%,transparent_70%)] pointer-events-none" />
            
            <div className="relative z-10">
              <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-500/20 shadow-[0_0_40px_rgba(34,197,94,0.2)]">
                <CheckCircle className="text-green-500" size={48} />
              </div>
              
              <h3 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-4">
                Emergency <span className="text-green-500">Resolved</span>
              </h3>
              
              <p className="text-sm text-gray-400 font-medium mb-8 leading-relaxed">
                Mission completed. Incident <span className="text-white font-bold tracking-widest">{incidentId}</span> has been closed and archived in the system registry.
              </p>
              
              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={onClose}
                  className="h-16 bg-green-500 hover:bg-green-400 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center space-x-3 transition-all shadow-[0_10px_30px_rgba(34,197,94,0.3)]"
                >
                  <span>Return to Command</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Decorative Scanline */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] [background-size:100%_4px,4px_100%]" />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
