import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock, MapPin, ShieldCheck, UserCheck, Navigation } from 'lucide-react';
import { EmergencyStatus } from '@/store/useEmergencyStore';

interface TimelineItemProps {
  label: string;
  isActive: boolean;
  isCompleted: boolean;
  icon: React.ReactNode;
  isLast?: boolean;
}

const TimelineItem = React.memo(({ label, isActive, isCompleted, icon, isLast }: TimelineItemProps) => (
  <div className="flex items-start space-x-4">
    <div className="flex flex-col items-center">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
        isCompleted ? 'bg-green-500/20 text-green-500' : 
        isActive ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-white/5 text-gray-600'
      }`}>
        {isCompleted ? <CheckCircle2 size={18} /> : icon}
      </div>
      {!isLast && <div className={`w-0.5 h-10 my-1 ${isCompleted ? 'bg-green-500/20' : 'bg-white/10'}`} />}
    </div>
    <div className="pt-1">
      <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${
        isCompleted ? 'text-green-500/60' : isActive ? 'text-white italic' : 'text-gray-600'
      }`}>
        {label}
      </p>
    </div>
  </div>
));

export const StatusTimeline = React.memo(({ currentStatus }: { currentStatus: EmergencyStatus }) => {
  const steps = [
    { id: 'SEARCHING', label: 'Searching Dispatch', icon: <MapPin size={16} /> },
    { id: 'ASSIGNED', label: 'Officer Assigned', icon: <UserCheck size={16} /> },
    { id: 'EN_ROUTE', label: 'Officer En Route', icon: <Navigation size={16} /> },
    { id: 'ARRIVED', label: 'Officer Arrived', icon: <ShieldCheck size={16} /> },
  ];

  const getStatusIndex = (status: EmergencyStatus) => {
    const order: EmergencyStatus[] = ['IDLE', 'SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED'];
    return order.indexOf(status);
  };

  const currentIndex = getStatusIndex(currentStatus);

  return (
    <div className="space-y-0">
      {steps.map((step, index) => (
        <TimelineItem
          key={step.id}
          label={step.label}
          isActive={currentStatus === step.id}
          isCompleted={currentIndex > getStatusIndex(step.id as EmergencyStatus)}
          icon={step.icon}
          isLast={index === steps.length - 1}
        />
      ))}
    </div>
  );
});

