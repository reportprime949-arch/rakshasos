'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { animateMarkerTo, cancelMarkerAnimation } from '@/utils/animateMarker';

// Fix for default Leaflet icon issue in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

// Premium Cyber Icons
const incidentIcon = L.divIcon({
  className: 'cyber-incident-icon',
  html: `
    <div class="relative">
      <div class="absolute -inset-4 bg-red-600/30 rounded-full blur-xl animate-ping opacity-50"></div>
      <div class="w-8 h-8 bg-[#0a0a0a] rounded-xl border-2 border-red-600 flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,1)] relative z-10 overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-tr from-red-600/40 to-transparent"></div>
        <div class="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const officerIcon = L.divIcon({
  className: 'cyber-officer-icon',
  html: `
    <div class="relative">
      <div class="absolute -inset-4 bg-blue-500/30 rounded-full blur-xl animate-pulse"></div>
      <div class="w-8 h-8 bg-[#0a0a0a] rounded-xl border-2 border-blue-500 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.6)] relative z-10 overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

// === SMOOTH MARKER COMPONENT ===
const SmoothMarker = React.memo(function SmoothMarker({
  position,
  icon,
  children,
}: {
  position: [number, number];
  icon: L.DivIcon;
  children?: React.ReactNode;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const lastPosRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!markerRef.current) return;
    if (lastPosRef.current) {
      animateMarkerTo(markerRef.current, position[0], position[1], 800);
    }
    lastPosRef.current = position;
  }, [position[0], position[1]]);

  useEffect(() => {
    return () => {
      if (markerRef.current) cancelMarkerAnimation(markerRef.current);
    };
  }, []);

  return (
    <Marker ref={markerRef} position={lastPosRef.current || position} icon={icon}>
      {children}
    </Marker>
  );
});

interface AdminMapProps {
  incidents: any[];
  officers: any[];
}

const MapController = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  const hasSetRef = useRef(false);

  useEffect(() => {
    if (!hasSetRef.current) {
      map.setView(center, 13);
      hasSetRef.current = true;
    }
  }, [center, map]);

  return null;
};

const AdminLiveMap = React.memo(({ incidents, officers }: AdminMapProps) => {
  const defaultCenter: [number, number] = [17.3850, 78.4867];

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#050505]">
      <style jsx global>{`
        .leaflet-tile-container {
          filter: invert(100%) hue-rotate(180deg) brightness(80%) contrast(120%) saturate(10%);
        }
        .leaflet-container {
          background: #050505 !important;
          cursor: crosshair !important;
        }
        .cyber-grid-overlay {
          background-image: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%),
                            linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
          background-size: 100% 2px, 3px 100%;
          pointer-events: none;
        }
        .cyber-incident-icon, .cyber-officer-icon {
          background: none !important;
          border: none !important;
        }
      `}</style>

      {/* TACTICAL OVERLAYS */}
      <div className="absolute inset-0 z-[400] cyber-grid-overlay opacity-20" />
      <div className="absolute inset-0 z-[400] pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.5)_100%)]" />

      <MapContainer
        center={defaultCenter}
        zoom={13}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
        preferCanvas={true}
      >
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
          updateWhenZooming={false}
          updateWhenIdle={true}
          keepBuffer={12}
        />
        <MapController center={defaultCenter} />

        {/* INCIDENT MARKERS */}
        {incidents.filter(i => (i.lat || i.latitude) && (i.lng || i.longitude)).map((incident) => {
          const lat = incident.latitude || incident.lat;
          const lng = incident.longitude || incident.lng;
          return (
            <SmoothMarker 
              key={`incident-${incident.id}`} 
              position={[lat, lng]} 
              icon={incidentIcon}
            >
              <Tooltip permanent direction="top" offset={[0, -20]} className="!bg-black/90 !border-red-500/40 !text-white !font-black !text-[8px] !uppercase !tracking-[0.2em] !px-3 !py-1 !rounded-lg !shadow-2xl">
                <div className="flex flex-col items-center">
                  <span className="text-red-500 mb-1">SOS ALERT</span>
                  <span>{incident.id}</span>
                </div>
              </Tooltip>
            </SmoothMarker>
          );
        })}

        {/* OFFICER MARKERS */}
        {officers.filter(o => o.latitude && o.longitude).map((officer) => (
          <SmoothMarker 
            key={`officer-${officer.id || officer.officerId}`} 
            position={[officer.latitude, officer.longitude]} 
            icon={officerIcon}
          >
            <Tooltip permanent direction="top" offset={[0, -20]} className="!bg-black/90 !border-blue-500/40 !text-white !font-black !text-[8px] !uppercase !tracking-[0.2em] !px-3 !py-1 !rounded-lg !shadow-2xl">
               <div className="flex flex-col items-center">
                  <span className="text-blue-500 mb-1">OFFICER {officer.status?.toUpperCase() || 'LIVE'}</span>
                  <span>{officer.name || officer.officerId}</span>
                </div>
            </Tooltip>
          </SmoothMarker>
        ))}
      </MapContainer>
    </div>
  );
});

export default AdminLiveMap;
