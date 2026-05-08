import React from 'react';
import { Phone, Shield, Navigation } from 'lucide-react';

interface OfficerProps {
  officer: {
    name: string;
    badge: string;
    phone: string;
    eta: string;
  };
}

export const OfficerCard = ({ officer }: OfficerProps) => {
  return (
    <div className="glass rounded-3xl p-6 border-blue-500/20 bg-blue-500/5">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
            <Shield className="text-blue-500" size={28} />
          </div>
          <div>
            <h3 className="text-white font-black text-lg">{officer.name}</h3>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Badge {officer.badge}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-blue-500 font-black text-xl">{officer.eta}</p>
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Est. Arrival</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <a
          href={`tel:${officer.phone}`}
          className="flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 h-14 rounded-2xl transition-all"
        >
          <Phone size={18} className="text-green-500" />
          <span className="text-xs font-black uppercase tracking-widest text-white">Call</span>
        </a>
        <button className="flex items-center justify-center space-x-2 bg-white/5 hover:bg-white/10 h-14 rounded-2xl transition-all">
          <Navigation size={18} className="text-blue-500" />
          <span className="text-xs font-black uppercase tracking-widest text-white">Track</span>
        </button>
      </div>
    </div>
  );
};
