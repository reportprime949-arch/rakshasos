'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const incidentIcon = L.divIcon({
  className: 'cyber-incident-icon',
  html: `
    <div class="relative">
      <div class="absolute -inset-4 bg-red-600/20 rounded-full blur-xl animate-ping"></div>
      <div class="w-6 h-6 bg-[#0a0a0a] rounded-lg border-2 border-red-600 flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.5)] relative z-10">
        <div class="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
      </div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const officerIcon = L.divIcon({
  className: 'cyber-officer-icon',
  html: `
    <div class="relative">
      <div class="absolute -inset-4 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
      <div class="w-6 h-6 bg-[#0a0a0a] rounded-lg border-2 border-blue-500 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] relative z-10">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

interface AdminMapProps {
  incidents: any[];
}

function MapController() {
  const map = useMap();
  useEffect(() => {
    map.setView([17.3850, 78.4867], 13);
  }, [map]);
  return null;
}

const AdminLiveMap = ({ incidents }: AdminMapProps) => {
  return (
    <div className="w-full h-full relative">
      <style jsx global>{`
        .leaflet-tile-container {
          filter: invert(100%) hue-rotate(180deg) brightness(80%) contrast(120%) saturate(10%);
        }
        .leaflet-container { background: #050505 !important; }
      `}</style>
      
      <MapContainer
        center={[17.3850, 78.4867]}
        zoom={13}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapController />

        {incidents.map((incident) => (
          <Marker 
            key={incident.id} 
            position={[incident.location.lat, incident.location.lng]} 
            icon={incidentIcon}
          >
            <Tooltip permanent direction="top" offset={[0, -10]} className="!bg-black/80 !border-red-500/30 !text-white font-black text-[8px] uppercase tracking-widest">
              {incident.emergencyType} - {incident.id}
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default AdminLiveMap;
