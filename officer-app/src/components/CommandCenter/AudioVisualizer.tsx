'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const AudioVisualizer = ({ active }: { active: boolean }) => {
  return (
    <div className="flex items-end justify-center space-x-1 h-12 w-full px-4 py-2 bg-red-500/5 rounded-xl border border-red-500/10">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          animate={active ? {
            height: [10, Math.random() * 30 + 10, 10],
          } : {
            height: 10
          }}
          transition={active ? {
            duration: 0.5 + Math.random() * 0.5,
            repeat: Infinity,
            ease: "easeInOut"
          } : {}}
          className={`w-1.5 rounded-full ${active ? 'bg-red-500' : 'bg-gray-800'}`}
        />
      ))}
    </div>
  );
};
