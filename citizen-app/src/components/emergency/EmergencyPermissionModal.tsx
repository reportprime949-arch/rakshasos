import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, MapPin, Phone, ShieldAlert } from 'lucide-react';

interface Props {
  onRequestPermission: () => void;
  permissionStatus: string;
}

export const EmergencyPermissionModal = ({ onRequestPermission, permissionStatus }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="w-full max-w-sm space-y-8">
        <div className="relative">
          <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mx-auto relative z-10">
            <MapPin className="text-red-500" size={40} />
          </div>
          <div className="absolute inset-0 bg-red-500/30 rounded-full blur-3xl animate-pulse" />
        </div>

        <div className="space-y-4">
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">GPS Access Required</h2>
          <p className="text-gray-400 font-medium leading-relaxed">
            We need your location to dispatch the nearest emergency officer. Your alert is active, but we cannot guide help to you without GPS.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <button
            onClick={onRequestPermission}
            className="w-full h-16 bg-white text-black rounded-2xl font-black text-lg uppercase tracking-widest flex items-center justify-center space-x-3 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            <ShieldAlert size={20} />
            <span>Enable Location</span>
          </button>

          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest py-2">or</p>

          <div className="grid grid-cols-1 gap-4">
            <a
              href="tel:911"
              className="w-full h-16 bg-red-500 text-white rounded-2xl font-black text-lg uppercase tracking-widest flex items-center justify-center space-x-3 active:scale-95 transition-all"
            >
              <Phone size={20} />
              <span>Call Emergency</span>
            </a>
          </div>
        </div>

        <div className="pt-8 flex items-center justify-center space-x-3 text-red-500/60">
           <AlertTriangle size={14} />
           <p className="text-[10px] font-bold uppercase tracking-widest">
             {permissionStatus === 'denied' ? 'Permission Denied in Browser Settings' : 'Waiting for GPS Lock...'}
           </p>
        </div>
      </div>
    </motion.div>
  );
};
