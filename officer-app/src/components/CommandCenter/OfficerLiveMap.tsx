'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

import { Navigation, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Premium Cyber Icons — defined outside component to avoid re-creation
const officerIcon = L.divIcon({
  className: 'cyber-officer-icon',
  html: `
    <div class="relative">
      <div class="absolute -inset-4 bg-green-500/40 rounded-full blur-xl animate-pulse"></div>
      <div class="w-8 h-8 bg-[#0a0a0a] rounded-xl border-2 border-green-500 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.6)] relative z-10 overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-br from-green-500/20 to-transparent"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
});

const incidentIcon = L.divIcon({
  className: 'cyber-incident-icon',
  html: `
    <div class="relative">
      <div class="absolute -inset-12 bg-red-600/20 rounded-full blur-3xl animate-ping opacity-50"></div>
      <div class="absolute -inset-16 bg-red-600/10 rounded-full border-2 border-red-600/30 animate-[ping_2s_linear_infinite]"></div>
      <div class="absolute -inset-20 bg-red-600/5 rounded-full border border-red-600/20 animate-[ping_3s_linear_infinite]"></div>
      
      <div class="w-10 h-10 bg-[#0a0a0a] rounded-2xl border-2 border-red-600 flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,1)] relative z-10 animate-bounce overflow-hidden">
        <div class="absolute inset-0 bg-gradient-to-tr from-red-600/40 to-transparent"></div>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

// Haversine distance in meters
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface MapProps {
  officerLoc: { latitude: number; longitude: number } | null;
  citizenLoc: { latitude: number; longitude: number } | null;
  active: boolean;
  incidents?: any[];
  activeDispatch?: any | null;
}

// Memoized map controller — only re-runs when coordinates actually change
const MapController = React.memo(function MapController({ officerLoc, citizenLoc, active }: MapProps) {
  const map = useMap();

  useEffect(() => {
    if (active && officerLoc && citizenLoc) {
      const cLat = citizenLoc.latitude;
      const cLng = citizenLoc.longitude;
      console.log(`🗺️ [MAP CONTROLLER] Fitting bounds: Officer[${officerLoc.latitude}, ${officerLoc.longitude}] Citizen[${cLat}, ${cLng}]`);
      
      const bounds = L.latLngBounds([
        [officerLoc.latitude, officerLoc.longitude],
        [cLat, cLng]
      ]);
      map.fitBounds(bounds, { padding: [120, 120], animate: true, duration: 2 });
    } else if (officerLoc) {
      console.log(`🗺️ [MAP CONTROLLER] Setting view to Officer: ${officerLoc.latitude}, ${officerLoc.longitude}`);
      map.setView([officerLoc.latitude, officerLoc.longitude], 14, { animate: true });
    }
  }, [officerLoc?.latitude, officerLoc?.longitude, citizenLoc?.latitude, citizenLoc?.longitude, active, map]);

  return null;
});

const OfficerLiveMap = React.memo(({ officerLoc, citizenLoc, active, incidents = [], activeDispatch = null }: MapProps) => {
  const [routes, setRoutes] = useState<any[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const lastRouteFetchRef = useRef<{ oLat: number; oLng: number; cLat: number; cLng: number } | null>(null);
  const routeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced route fetch — only refetch when positions change by >50m
  useEffect(() => {
    if (!active || !officerLoc || !citizenLoc) {
      setRoutes([]);
      return;
    }

    const cLat = citizenLoc.latitude;
    const cLng = citizenLoc.longitude;
    const last = lastRouteFetchRef.current;

    // Skip if positions haven't changed significantly (50m threshold)
    if (last && !isInitialLoad) {
      const officerMoved = distanceMeters(last.oLat, last.oLng, officerLoc.latitude, officerLoc.longitude);
      const citizenMoved = distanceMeters(last.cLat, last.cLng, cLat, cLng);
      if (officerMoved < 50 && citizenMoved < 50) return;
    }

    // Debounce route requests to avoid rapid-fire API calls
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);

    routeTimerRef.current = setTimeout(async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${officerLoc.longitude},${officerLoc.latitude};${cLng},${cLat}?overview=full&geometries=geojson`;
        console.log("🗺️ [OSRM REQUEST]:", url);
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          console.log(`🗺️ [OSRM SUCCESS] Distance: ${route.distance}m, Duration: ${route.duration}s`);
          setRoutes(data.routes);
          lastRouteFetchRef.current = { oLat: officerLoc.latitude, oLng: officerLoc.longitude, cLat, cLng };
          if (isInitialLoad) setIsInitialLoad(false);
        }
      } catch (e) { 
        console.error('🔴 [ROUTING ERROR]:', e); 
      }
    }, isInitialLoad ? 0 : 3000);

    return () => {
      if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    };
  }, [officerLoc?.latitude, officerLoc?.longitude, citizenLoc?.latitude, citizenLoc?.longitude, active]);

  const currentRoute = routes[0];
  const eta = currentRoute ? `${Math.round(currentRoute.duration / 60)} MIN` : 'CALC...';
  const distance = currentRoute ? `${(currentRoute.distance / 1000).toFixed(1)} KM` : '---';

  const routeCoords = useMemo(() => {
    if (!currentRoute) return [];
    return currentRoute.geometry.coordinates.map((c: any) => [c[1], c[0]]);
  }, [currentRoute]);

  const midpoint = useMemo(() => {
    if (routeCoords.length < 2) return null;
    return routeCoords[Math.floor(routeCoords.length / 2)];
  }, [routeCoords]);

  // Memoize officer position to prevent marker re-renders
  const officerPosition = useMemo(() => {
    if (!officerLoc) return null;
    return [officerLoc.latitude, officerLoc.longitude] as [number, number];
  }, [officerLoc?.latitude, officerLoc?.longitude]);

  // Memoize incident positions
  const incidentPositions = useMemo(() => {
    return incidents.map((incident: any) => {
      const lat = incident.latitude || 0;
      const lng = incident.longitude || 0;
      if (incident.id === activeDispatch?.id) {
        console.log(`🚨 [MAP INCIDENT] Active Dispatch Coords: LAT:${lat}, LNG:${lng}`);
      }
      return {
        id: incident.id,
        position: [lat, lng] as [number, number],
        isActive: incident.id === activeDispatch?.id
      };
    });
  }, [incidents, activeDispatch?.id]);

  return (
    <div className="relative w-full h-full rounded-[3.5rem] overflow-hidden border border-white/5 bg-[#050505] cyber-map-container shadow-[0_0_100px_rgba(0,0,0,0.8)]">
      <style jsx global>{`
        .cyber-map-container .leaflet-tile-container {
          filter: invert(100%) hue-rotate(180deg) brightness(80%) contrast(120%) saturate(20%);
        }
        .leaflet-container { background: #050505 !important; cursor: crosshair !important; }
        .cyber-map-grid {
          background-image: linear-gradient(rgba(18,16,16,0) 50%, rgba(0,0,0,0.25) 50%), 
                            linear-gradient(90deg, rgba(255,0,0,0.06), rgba(0,255,0,0.02), rgba(0,0,255,0.06));
          background-size: 100% 2px, 3px 100%;
          pointer-events: none;
        }
        .cyber-route-card {
          background: rgba(10, 10, 10, 0.9) !important;
          border: 1px solid rgba(59, 130, 246, 0.5) !important;
          color: white !important;
          padding: 8px 12px !important;
          border-radius: 12px !important;
          font-weight: 900 !important;
          font-family: 'Geist Mono', monospace !important;
          font-size: 10px !important;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.3) !important;
          white-space: nowrap !important;
        }
        .route-path-animated {
          stroke-dasharray: 10, 20;
          animation: route-flow 1s linear infinite;
        }
        @keyframes route-flow {
          to { stroke-dashoffset: -30; }
        }
      `}</style>

      {/* TACTICAL GRID OVERLAY */}
      <div className="absolute inset-0 z-[400] cyber-map-grid opacity-20" />
      <div className="absolute inset-0 z-[400] pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />

      <MapContainer
        center={[17.3850, 78.4867]}
        zoom={14}
        zoomControl={false}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          updateWhenZooming={false}
          updateWhenIdle={true}
        />
        <MapController officerLoc={officerLoc} citizenLoc={citizenLoc} active={active} />

        {/* GLOWING ROUTE PATH */}
        {routeCoords.length > 0 && (
          <>
            <Polyline
              positions={routeCoords}
              pathOptions={{ color: '#2563eb', weight: 14, opacity: 0.15, lineJoin: 'round', lineCap: 'round' }}
            />
            <Polyline
              positions={routeCoords}
              className="route-path-animated"
              pathOptions={{ color: '#3b82f6', weight: 6, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }}
            />
          </>
        )}

        {/* MIDPOINT INFO CARD */}
        {midpoint && (
          <Marker position={midpoint as any} icon={L.divIcon({ className: 'hidden' })}>
            <Tooltip permanent direction="center" className="cyber-route-card">
              <div className="flex items-center space-x-2">
                <Navigation size={12} className="text-blue-500" />
                <span>{eta} • {distance}</span>
              </div>
            </Tooltip>
          </Marker>
        )}

        {/* OFFICER UNIT */}
        {officerPosition && (
          <Marker position={officerPosition} icon={officerIcon}>
            <Tooltip permanent direction="top" offset={[0, -20]} className="!bg-transparent !border-none !shadow-none !text-green-500 font-black text-[8px] tracking-[0.3em] uppercase italic">
              YOU (OFFICER)
            </Tooltip>
          </Marker>
        )}

        {/* ALL ACTIVE INCIDENTS */}
        {incidentPositions.map((item) => (
          <Marker 
            key={item.id} 
            position={item.position} 
            icon={incidentIcon}
          >
            <Tooltip permanent direction="top" offset={[0, -25]} className="!bg-transparent !border-none !shadow-none !text-red-500 font-black text-[8px] tracking-[0.3em] uppercase italic">
              {item.isActive ? 'ACTIVE DISPATCH' : 'PENDING SOS'}
            </Tooltip>
          </Marker>
        ))}

        {/* ACTIVE DISPATCH (If not in incidents list) */}
        {active && citizenLoc && !incidents.find(i => i.id === activeDispatch?.id) && (
          <Marker position={[citizenLoc.latitude, citizenLoc.longitude]} icon={incidentIcon}>
            <Tooltip permanent direction="top" offset={[0, -25]} className="!bg-transparent !border-none !shadow-none !text-red-500 font-black text-[8px] tracking-[0.3em] uppercase italic">
              ACTIVE DISPATCH
            </Tooltip>
          </Marker>
        )}
      </MapContainer>

      {/* TOP FLOATING STATUS BAR */}
      <div className="absolute top-10 left-10 right-10 flex justify-between items-start z-[1000] pointer-events-none">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass p-6 rounded-[2.5rem] border border-white/5 bg-black/40 backdrop-blur-3xl flex items-center space-x-12 pointer-events-auto"
        >
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.3)]">
              <Activity className="text-blue-500" size={20} />
            </div>
            <div>
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.4em]">Signal Status</p>
              <h4 className="text-xs font-black text-white italic tracking-tighter uppercase italic">Encrypted Matrix</h4>
            </div>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.4em]">Tracking Mode</p>
            <h4 className="text-xs font-black text-green-500 italic tracking-tighter uppercase italic">Live Vector Active</h4>
          </div>
        </motion.div>

        {/* CYBER LEGEND */}
        <div className="glass p-5 rounded-3xl border border-white/5 bg-black/40 backdrop-blur-3xl space-y-3 pointer-events-auto">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)] animate-pulse" />
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">You (Officer)</span>
          </div>
          <div className="flex items-center space-x-3">
             <div className="w-6 h-1 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,1)]" />
             <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Best Route</span>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,1)] animate-ping" />
            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Incident Location</span>
          </div>
        </div>
      </div>

      {/* NAVIGATION HUD - BOTTOM CENTER */}
      <AnimatePresence>
        {active && currentRoute && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto"
          >
            <div className="glass px-16 py-8 rounded-[3.5rem] border border-blue-500/20 bg-black/60 backdrop-blur-3xl flex items-center space-x-20 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              
              <div className="text-center relative">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400 mb-1">Time to Target</p>
                <h4 className="text-4xl font-black italic tracking-tighter text-white uppercase">{eta}</h4>
              </div>
              <div className="h-14 w-px bg-white/10" />
              <div className="text-center relative">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 mb-1">Vector Length</p>
                <h4 className="text-4xl font-black italic tracking-tighter text-white uppercase">{distance}</h4>
              </div>
              <div className="h-14 w-px bg-white/10" />
              <div className="flex flex-col items-center relative">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-2 animate-bounce">
                  <Navigation className="text-blue-500" size={24} />
                </div>
                <p className="text-[8px] font-black text-blue-500 uppercase tracking-[0.3em]">Directing Now</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}, (prev, next) => {
  // Custom comparator — only re-render when meaningful props change
  const sameOfficer = prev.officerLoc?.latitude === next.officerLoc?.latitude && prev.officerLoc?.longitude === next.officerLoc?.longitude;
  const sameCitizen = prev.citizenLoc?.latitude === next.citizenLoc?.latitude && prev.citizenLoc?.longitude === next.citizenLoc?.longitude;
  const sameActive = prev.active === next.active;
  const sameIncidents = prev.incidents?.length === next.incidents?.length;
  const sameDispatch = prev.activeDispatch?.id === next.activeDispatch?.id;
  return sameOfficer && sameCitizen && sameActive && sameIncidents && sameDispatch;
});

export default OfficerLiveMap;
