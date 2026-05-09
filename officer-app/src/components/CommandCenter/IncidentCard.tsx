'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, MapPin, User, ChevronRight } from 'lucide-react';

interface IncidentCardProps {
  emergency: any;
  onViewDetails: () => void;
  onAccept: () => void;
  isLoading?: boolean;
  showAcceptButton?: boolean;
}

export const IncidentCard = ({ emergency, onViewDetails, onAccept, isLoading, showAcceptButton = true }: IncidentCardProps) => {
  const handleAcceptClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('👆 [ACCEPT BUTTON CLICKED]', emergency.id);
    onAccept();
  };

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ 
        x: 0, 
        opacity: 1,
        boxShadow: (emergency.status === 'SEARCHING' || emergency.status === 'PRIORITY') 
          ? [
              '0 0 0px rgba(239, 68, 68, 0)', 
              '0 0 30px rgba(239, 68, 68, 0.4)', 
              '0 0 0px rgba(239, 68, 68, 0)'
            ] 
          : 'none',
        borderColor: (emergency.status === 'SEARCHING' || emergency.status === 'PRIORITY')
          ? ['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 1)', 'rgba(239, 68, 68, 0.2)']
          : 'rgba(255, 255, 255, 0.05)'
      }}
      transition={{ 
        boxShadow: { repeat: Infinity, duration: 1.5 },
        borderColor: { repeat: Infinity, duration: 1.5 },
        default: { duration: 0.3 }
      }}
      className={`glass p-6 rounded-[2rem] border bg-gradient-to-br from-red-500/5 to-transparent relative overflow-hidden group pointer-events-auto transition-colors ${
        (emergency.status === 'SEARCHING' || emergency.status === 'PRIORITY') ? 'border-red-500' : 'border-white/5'
      }`}
    >
      <div className="absolute top-0 right-0 p-4">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <AlertTriangle className="text-red-500" size={24} />
        </div>
        <div>
          <h3 className="text-lg font-black tracking-tighter uppercase italic text-white">{emergency.citizenName}</h3>
          <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest animate-pulse">Priority Dispatch</p>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500">
          <span className="flex items-center gap-2"><User size={12} /> ID: {emergency.id.split('-')[1]}</span>
          <span className="flex items-center gap-2"><Clock size={12} /> LIVE</span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500">
          <span className="flex items-center gap-2"><MapPin size={12} /> {emergency.distanceKm?.toFixed(1) || '1.8'} KM AWAY</span>
          <span className="text-white font-black italic uppercase tracking-widest">ETA: 4 MIN</span>
        </div>
      </div>

      <div className={`grid ${showAcceptButton ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
        <button
          onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
          className="h-12 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
        >
          Details
        </button>
        {showAcceptButton && (
          <button
            onClick={handleAcceptClick}
            disabled={isLoading}
            className={`h-12 rounded-2xl bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all cursor-pointer relative overflow-hidden ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'CONNECTING...' : 'Accept'}
            {(emergency.status === 'SEARCHING' || emergency.status === 'PRIORITY') && (
              <motion.div
                animate={{ opacity: [0, 0.5, 0], scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute inset-0 bg-white pointer-events-none"
              />
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
};
