'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  officerLoc: { latitude: number; longitude: number } | null;
  citizenLoc: { latitude: number; longitude: number } | null;
  status: string;
}

function MapController({ officerLoc, citizenLoc, status }: MapProps) {
  const map = useMap();

  useEffect(() => {
    if (officerLoc && citizenLoc) {
      const bounds = L.latLngBounds([
        [officerLoc.latitude, officerLoc.longitude],
        [citizenLoc.latitude, citizenLoc.longitude]
      ]);
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [officerLoc?.latitude, officerLoc?.longitude, citizenLoc?.latitude, citizenLoc?.longitude, map]);

  return null;
}

const CitizenLiveMap = React.memo(({ officerLoc, citizenLoc, status }: MapProps) => {
  const [route, setRoute] = useState<any>(null);
  const [isInitial, setIsInitial] = useState(true);

  useEffect(() => {
    // Fix for default Leaflet icon issue in Next.js (Client-side only)
    if (typeof window !== 'undefined') {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
    }
  }, []);

  // Use useMemo to prevent re-creation of icons on every render
  const officerIcon = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return L.divIcon({
      className: 'citizen-map-officer',
      html: `
        <div class="relative">
          <div class="absolute -inset-8 bg-blue-500/20 rounded-full blur-2xl animate-pulse"></div>
          <div class="w-10 h-10 bg-[#0a0a0a] rounded-2xl border-2 border-blue-500 flex items-center justify-center shadow-[0_0_30px_rgba(59,130,246,0.5)] relative z-10 overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent"></div>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  }, []);

  const citizenIcon = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return L.divIcon({
      className: 'citizen-map-self',
      html: `
        <div class="relative">
          <div class="absolute -inset-10 bg-red-600/20 rounded-full blur-3xl animate-ping"></div>
          <div class="w-8 h-8 bg-[#0a0a0a] rounded-xl border-2 border-red-600 flex items-center justify-center shadow-[0_0_40px_rgba(220,38,38,0.6)] relative z-10 animate-bounce">
             <div class="w-2 h-2 bg-red-600 rounded-full animate-ping"></div>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }, []);

  useEffect(() => {
    const fetchRoute = async () => {
      if (!officerLoc || !citizenLoc || status === 'COMPLETED') return;
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${officerLoc.longitude},${officerLoc.latitude};${citizenLoc.longitude},${citizenLoc.latitude}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.routes?.[0]) {
          setRoute(data.routes[0]);
          if (isInitial) setIsInitial(false);
        }
      } catch (e) {}
    };
    const timer = setTimeout(fetchRoute, isInitial ? 0 : 5000);
    return () => clearTimeout(timer);
  }, [officerLoc?.latitude, officerLoc?.longitude, citizenLoc?.latitude, citizenLoc?.longitude, status]);

  const routeCoords = useMemo(() => {
    if (!route) return [];
    return route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
  }, [route]);

  if (typeof window === 'undefined') return null;

  return (
    <div className="w-full h-full relative group">
      <style jsx global>{`
        .leaflet-dark-mode .leaflet-tile-container {
          filter: invert(100%) hue-rotate(180deg) brightness(80%) contrast(120%) saturate(20%);
        }
        .leaflet-container { background: #050505 !important; }
        .citizen-map-officer, .citizen-map-self { background: none !important; border: none !important; }
        .route-path-animated {
          stroke-dasharray: 10, 20;
          animation: route-flow 1s linear infinite;
        }
        @keyframes route-flow {
          to { stroke-dashoffset: -30; }
        }
      `}</style>
      
      {/* TACTICAL OVERLAYS */}
      <div className="absolute inset-0 z-[400] pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] [background-size:100%_2px,3px_100%] opacity-20" />
      <div className="absolute inset-0 z-[400] pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]" />

      <MapContainer
        center={[citizenLoc?.latitude || 20, citizenLoc?.longitude || 78]}
        zoom={citizenLoc ? 15 : 4}
        className="leaflet-dark-mode"
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
          updateWhenZooming={false}
          updateWhenIdle={true}
        />
        <MapController officerLoc={officerLoc} citizenLoc={citizenLoc} status={status} />

        {routeCoords.length > 0 && (
          <>
            <Polyline
              positions={routeCoords}
              pathOptions={{ color: '#2563eb', weight: 12, opacity: 0.1, lineJoin: 'round' }}
            />
            <Polyline
              positions={routeCoords}
              className="route-path-animated"
              pathOptions={{
                color: status === 'COMPLETED' ? '#22c55e' : '#3b82f6',
                weight: 4,
                opacity: 0.9,
                lineJoin: 'round'
              }}
            />
          </>
        )}

        {officerLoc && officerIcon && (
          <Marker position={[officerLoc.latitude, officerLoc.longitude]} icon={officerIcon} />
        )}

        {citizenLoc && citizenIcon && (
          <Marker position={[citizenLoc.latitude, citizenLoc.longitude]} icon={citizenIcon} />
        )}
      </MapContainer>

      {/* FLOATING STATUS HUD */}
      <div className="absolute top-6 right-6 z-[500] flex flex-col items-end space-y-2 pointer-events-none">
        <div className="glass px-4 py-2 rounded-xl border border-white/5 bg-black/40 backdrop-blur-md flex items-center space-x-3">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,1)]" />
          <span className="text-[8px] font-black text-white uppercase tracking-[0.2em]">Vector Lock Active</span>
        </div>
        {route && (
          <div className="glass px-4 py-2 rounded-xl border border-white/5 bg-black/40 backdrop-blur-md flex items-center space-x-3">
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-[0.2em]">ETA:</span>
            <span className="text-[8px] font-black text-blue-500 uppercase tracking-[0.2em]">{Math.round(route.duration / 60)} MIN</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default CitizenLiveMap;
