'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Circle, CheckCircle2 } from 'lucide-react';

export const IncidentTimeline = ({ status }: { status: string }) => {
  const steps = [
    { id: 'SOS_TRIGGERED', label: 'SOS Triggered' },
    { id: 'ALERT_RECEIVED', label: 'Alert Received' },
    { id: 'EN_ROUTE', label: 'En Route' },
    { id: 'ARRIVED', label: 'Arrived' }
  ];

  const getStatusIndex = () => {
    if (status === 'IDLE') return -1;
    if (status === 'PENDING') return 1;
    if (status === 'RESPONDING') return 2;
    if (status === 'ARRIVED') return 3;
    return 1;
  };

  const currentIndex = getStatusIndex();

  return (
    <div className="space-y-4">
      <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em]">Incident Timeline</h4>
      <div className="space-y-6 relative">
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-white/5" />
        
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center space-x-4 relative">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center z-10 ${
              i <= currentIndex ? 'bg-red-500' : 'bg-[#111]'
            }`}>
              {i <= currentIndex ? (
                <CheckCircle2 size={12} className="text-white" />
              ) : (
                <Circle size={8} className="text-gray-800" />
              )}
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${
              i <= currentIndex ? 'text-white' : 'text-gray-600'
            }`}>
              {step.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
