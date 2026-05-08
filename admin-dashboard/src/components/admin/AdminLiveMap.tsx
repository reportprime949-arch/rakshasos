'use client';

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon issue in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

// Custom Admin Icons
const incidentIcon = L.divIcon({
  className: 'admin-incident-marker',
  html: `
    <div class="relative">
      <!-- Intense Tactical Radar Pulse -->
      <div class="absolute -inset-10 bg-red-600/20 rounded-full blur-2xl animate-ping opacity-60"></div>
      <div class="absolute -inset-12 bg-red-600/10 rounded-full border border-red-600/30 animate-[ping_2s_linear_infinite]"></div>
      
      <div class="w-8 h-8 bg-red-600 rounded-full border-2 border-white flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,1)] relative z-10">
        <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const officerIcon = L.divIcon({
  className: 'admin-officer-marker',
  html: `
    <div class="relative">
      <div class="absolute -inset-2 bg-blue-500/30 rounded-full blur-md"></div>
      <div class="w-6 h-6 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg relative z-10">
         <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

interface AdminLiveMapProps {
  incidents: any[];
  officers: any[];
}

const AdminLiveMap = ({ incidents, officers }: AdminLiveMapProps) => {
  if (typeof window === 'undefined') return null;

  return (
    <div className="absolute inset-0 z-0 w-full h-full rounded-[2rem] overflow-hidden leaflet-dark-mode">
      <style jsx global>{`
        .leaflet-dark-mode .leaflet-tile-container {
          filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(110%);
        }
        .leaflet-container { background: #050505 !important; }
        .admin-incident-marker, .admin-officer-marker { background: none !important; border: none !important; }
      `}</style>
      
      {/* TACTICAL OVERLAY */}
      <div className="absolute inset-0 bg-black/45 z-[401] pointer-events-none" />
      <div className="absolute inset-0 z-[402] pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] [background-size:100%_2px,2px_100%]" />

      <MapContainer
        center={[16.9736, 82.2266]}
        zoom={13}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {incidents.map((incident) => (
          <React.Fragment key={incident.id}>
            <Marker position={[incident.lat, incident.lng]} icon={incidentIcon} />
            <Circle 
              center={[incident.lat, incident.lng]} 
              radius={500} 
              pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.1, weight: 1 }}
            />
          </React.Fragment>
        ))}

        {officers.map((officer) => (
          <Marker 
            key={officer.id} 
            position={[officer.lat, officer.lng]} 
            icon={officerIcon} 
          />
        ))}
      </MapContainer>
    </div>
  );
};

export default AdminLiveMap;
