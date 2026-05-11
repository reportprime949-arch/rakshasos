'use client';

import React from 'react';
import { AlertTriangle, Clock, MapPin, User } from 'lucide-react';

interface IncidentCardProps {
  emergency: any;
  onViewDetails: () => void;
  onAccept: () => void;
  isLoading?: boolean;
  showAcceptButton?: boolean;
}

export const IncidentCard = React.memo(
  ({ emergency, onViewDetails, onAccept, isLoading, showAcceptButton = true }: IncidentCardProps) => {
    const handleAcceptClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onAccept();
    };

    const isPriority = emergency.status === 'SEARCHING' || emergency.status === 'PRIORITY' || emergency.status === 'pending' || emergency.status === 'searching';

    return (
      <div
        className={`incident-card glass p-6 rounded-[2rem] border bg-gradient-to-br from-red-500/5 to-transparent relative overflow-hidden group pointer-events-auto transition-colors ${
          isPriority ? 'border-red-500' : 'border-white/5'
        }`}
      >
        <style jsx>{`
          .incident-card .glow-pulse {
            animation: glowPulse 2s ease-in-out infinite;
          }
          @keyframes glowPulse {
            0%, 100% { opacity: 0; }
            50% { opacity: 1; }
          }
        `}</style>

        {/* CSS-only Glow Effect (replaces framer-motion infinite loop) */}
        {isPriority && (
          <div
            className="glow-pulse absolute inset-0 bg-red-500/10 pointer-events-none"
            style={{ boxShadow: 'inset 0 0 50px rgba(239, 68, 68, 0.2)' }}
          />
        )}

        <div className="absolute top-0 right-0 p-4">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        </div>

        <div className="flex items-center space-x-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <AlertTriangle className="text-red-500" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black tracking-tighter uppercase italic text-white">
              {emergency.citizenName}
            </h3>
            <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest animate-pulse">
              Priority Dispatch
            </p>
          </div>
        </div>

        <div className="space-y-3 mb-8">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <span className="flex items-center gap-2">
              <User size={12} /> ID: {emergency.id?.split('-')[1] || '---'}
            </span>
            <span className="flex items-center gap-2">
              <Clock size={12} /> LIVE
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500">
            <span className="flex items-center gap-2">
              <MapPin size={12} /> {emergency.distanceKm?.toFixed(1) || '---'} KM AWAY
            </span>
            <span className="text-white font-black italic uppercase tracking-widest">
              ETA: {emergency.eta || '---'}
            </span>
          </div>
        </div>

        <div className={`grid ${showAcceptButton ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
            className="h-12 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
          >
            Details
          </button>
          {showAcceptButton && (
            <button
              onClick={handleAcceptClick}
              disabled={isLoading}
              className={`h-12 rounded-2xl bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all cursor-pointer relative overflow-hidden ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? 'CONNECTING...' : 'Accept'}
              {isPriority && (
                <div className="glow-pulse absolute inset-0 bg-white/20 pointer-events-none" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  },
);

IncidentCard.displayName = 'IncidentCard';
