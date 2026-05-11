'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { createRouteService, RouteData } from '@/utils/routeService';
import { animateMarkerTo, cancelMarkerAnimation, distanceMeters } from '@/utils/animateMarker';

// Fix for default Leaflet icon issue in Next.js
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

import { Navigation, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================
// ICONS — defined outside component to avoid re-creation
// ============================================================
const officerIcon = L.divIcon({
  className: 'cyber-officer-icon',
  html: `
    <div class="relative">
      <div class="w-8 h-8 bg-black rounded-xl border-2 border-green-500 flex items-center justify-center shadow-lg transform-gpu">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      </div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const incidentIcon = L.divIcon({
  className: 'cyber-incident-icon',
  html: `
    <div class="relative transform-gpu">
      <div class="absolute -inset-4 bg-red-600/20 rounded-full animate-pulse"></div>
      <div class="w-10 h-10 bg-black rounded-2xl border-2 border-red-600 flex items-center justify-center shadow-2xl relative z-10 overflow-hidden">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      </div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const hiddenIcon = L.divIcon({ className: 'hidden', iconSize: [0, 0] });

// ============================================================
// TYPES
// ============================================================
interface MapProps {
  officerLoc: { latitude: number; longitude: number } | null;
  citizenLoc: { latitude: number; longitude: number } | null;
  active: boolean;
  incidents?: any[];
  activeDispatch?: any | null;
}

// ============================================================
// SMOOTH MARKER (animates via Leaflet API, not React state)
// ============================================================
const SmoothMarker = React.memo(function SmoothMarker({
  position,
  icon,
  children,
}: {
  position: [number, number] | null;
  icon: L.DivIcon;
  children?: React.ReactNode;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const lastPosRef = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!position || !markerRef.current) return;
    if (lastPosRef.current) {
      animateMarkerTo(markerRef.current, position[0], position[1], 600);
    }
    lastPosRef.current = position;
  }, [position?.[0], position?.[1]]);

  useEffect(() => {
    return () => {
      if (markerRef.current) cancelMarkerAnimation(markerRef.current);
    };
  }, []);

  if (!position) return null;

  return (
    <Marker ref={markerRef} position={lastPosRef.current || position} icon={icon}>
      {children}
    </Marker>
  );
});

// ============================================================
// MAP CONTROLLER — handles viewport/zoom changes
// ============================================================
const MapController = React.memo(function MapController({
  officerLoc,
  citizenLoc,
  active,
  routeCoords = [],
}: MapProps & { routeCoords?: [number, number][] }) {
  const map = useMap();
  const hasFittedRef = useRef(false);
  const lastBoundsDistRef = useRef(0);
  const lastRouteLenRef = useRef(0);

  useEffect(() => {
    if (active && officerLoc && citizenLoc) {
      const dist = distanceMeters(
        officerLoc.latitude,
        officerLoc.longitude,
        citizenLoc.latitude,
        citizenLoc.longitude,
      );

      const shouldFit =
        !hasFittedRef.current ||
        Math.abs(dist - lastBoundsDistRef.current) > 1000 ||
        (routeCoords.length > 0 && lastRouteLenRef.current === 0);

      if (shouldFit) {
        hasFittedRef.current = true;
        lastBoundsDistRef.current = dist;
        lastRouteLenRef.current = routeCoords.length;

        const points: [number, number][] = [
          [officerLoc.latitude, officerLoc.longitude],
          [citizenLoc.latitude, citizenLoc.longitude],
        ];

        if (routeCoords.length > 10) {
          points.push(routeCoords[Math.floor(routeCoords.length / 4)]);
          points.push(routeCoords[Math.floor(routeCoords.length / 2)]);
          points.push(routeCoords[Math.floor((3 * routeCoords.length) / 4)]);
        } else if (routeCoords.length > 0) {
          points.push(...routeCoords);
        }

        const bounds = L.latLngBounds(points);
        map.flyToBounds(bounds, {
          padding: [100, 100],
          duration: 2,
          easeLinearity: 0.25,
        });
      }
    } else if (officerLoc && !hasFittedRef.current) {
      hasFittedRef.current = true;
      map.setView([officerLoc.latitude, officerLoc.longitude], 14, { animate: false });
    }
  }, [
    officerLoc?.latitude,
    officerLoc?.longitude,
    citizenLoc?.latitude,
    citizenLoc?.longitude,
    routeCoords.length,
    active,
    map,
  ]);

  return null;
});

// ============================================================
// MAIN MAP COMPONENT
// ============================================================
const OfficerLiveMap = React.memo(
  ({ officerLoc, citizenLoc, active, incidents = [], activeDispatch = null }: MapProps) => {
    const [route, setRoute] = useState<RouteData | null>(null);
    const [routeLoading, setRouteLoading] = useState(false);
    const routeServiceRef = useRef(createRouteService());

    // Route service lifecycle
    useEffect(() => {
      const svc = routeServiceRef.current;

      if (!active || !officerLoc || !citizenLoc) {
        svc.stop();
        setRoute(null);
        return;
      }

      svc.start(
        (r) => setRoute(r),
        (loading) => setRouteLoading(loading),
      );

      return () => svc.stop();
    }, [active, !!officerLoc, !!citizenLoc]);

    // Update positions on the route service (ref-based, no re-render)
    useEffect(() => {
      if (officerLoc && citizenLoc) {
        routeServiceRef.current.updatePositions(
          officerLoc.latitude,
          officerLoc.longitude,
          citizenLoc.latitude,
          citizenLoc.longitude,
        );
      }
    }, [officerLoc?.latitude, officerLoc?.longitude, citizenLoc?.latitude, citizenLoc?.longitude]);

    const eta = route?.eta || 'CALC...';
    const distance = route?.distanceText || '---';
    const nextStep = route?.nextStep || 'Proceed to target';

    // Memoize route coordinates
    const routeCoords = useMemo(() => (route ? route.coordinates : []), [route]);

    // Memoize midpoint for info card
    const midpoint = useMemo(() => {
      if (routeCoords.length < 2) return null;
      return routeCoords[Math.floor(routeCoords.length / 2)];
    }, [routeCoords]);

    // Memoize officer position
    const officerPosition = useMemo<[number, number] | null>(
      () => (officerLoc ? [officerLoc.latitude, officerLoc.longitude] : null),
      [officerLoc?.latitude, officerLoc?.longitude],
    );

    // Stable incident positions memo using ref-based comparison
    const prevIncidentKeyRef = useRef('');
    const incidentPositions = useMemo(() => {
      const key = incidents.map((i: any) => `${i.id}-${i.latitude}-${i.longitude}`).join(',');
      prevIncidentKeyRef.current = key;
      return incidents.map((incident: any) => ({
        id: incident.id,
        position: [incident.latitude || 0, incident.longitude || 0] as [number, number],
        isActive: incident.id === activeDispatch?.id,
      }));
    }, [
      incidents.map((i: any) => `${i.id}-${i.latitude}-${i.longitude}`).join(','),
      activeDispatch?.id,
    ]);

    return (
      <div className="relative w-full h-full rounded-[3.5rem] overflow-hidden border border-white/5 bg-[#050505] cyber-map-container shadow-[0_0_100px_rgba(0,0,0,0.8)]">
        <style jsx global>{`
          .cyber-map-container .leaflet-tile-container {
            filter: invert(100%) hue-rotate(180deg) brightness(80%) contrast(120%) saturate(20%);
          }
          .leaflet-container {
            background: #050505 !important;
            cursor: crosshair !important;
          }
          .cyber-map-grid {
            background-image: linear-gradient(
                rgba(18, 16, 16, 0) 50%,
                rgba(0, 0, 0, 0.25) 50%
              ),
              linear-gradient(
                90deg,
                rgba(255, 0, 0, 0.06),
                rgba(0, 255, 0, 0.02),
                rgba(0, 0, 255, 0.06)
              );
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
            to {
              stroke-dashoffset: -30;
            }
          }
          .cyber-officer-icon,
          .cyber-incident-icon {
            background: none !important;
            border: none !important;
          }
        `}</style>

        {/* TACTICAL GRID OVERLAY */}
        <div className="absolute inset-0 z-[400] cyber-map-grid opacity-20" />
        <div className="absolute inset-0 z-[400] pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />

        {/* ROUTE LOADING */}
        {routeLoading && !route && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[500] glass px-6 py-3 rounded-2xl border border-blue-500/20 bg-black/60 backdrop-blur-xl flex items-center space-x-3">
            <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">
              Calculating Route…
            </span>
          </div>
        )}

        <MapContainer
          center={[officerLoc?.latitude || 20, officerLoc?.longitude || 78]}
          zoom={officerLoc ? 15 : 4}
          zoomControl={false}
          style={{ width: '100%', height: '100%' }}
          preferCanvas={true}
          className="transform-gpu will-change-transform"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            updateWhenZooming={false}
            updateWhenIdle={true}
            keepBuffer={8}
            updateInterval={100}
          />
          <MapController
            officerLoc={officerLoc}
            citizenLoc={citizenLoc}
            active={active}
            routeCoords={routeCoords}
          />

          {/* ROUTE PATH (2 layers instead of 3) */}
          {routeCoords.length > 0 && (
            <React.Fragment
              key={`route-${routeCoords[0]?.join(',')}-${routeCoords[routeCoords.length - 1]?.join(',')}`}
            >
              <Polyline
                positions={routeCoords}
                pathOptions={{
                  color: '#2563eb',
                  weight: 14,
                  opacity: 0.15,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
              <Polyline
                positions={routeCoords}
                className="route-path-animated"
                pathOptions={{
                  color: '#3b82f6',
                  weight: 5,
                  opacity: 0.9,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
            </React.Fragment>
          )}

          {/* MIDPOINT INFO CARD */}
          {midpoint && (
            <Marker position={midpoint as any} icon={hiddenIcon}>
              <Tooltip permanent direction="center" className="cyber-route-card">
                <div className="flex items-center space-x-2">
                  <Navigation size={12} className="text-blue-500" />
                  <span>
                    {eta} • {distance}
                  </span>
                </div>
              </Tooltip>
            </Marker>
          )}

          {/* OFFICER MARKER */}
          <SmoothMarker position={officerPosition} icon={officerIcon}>
            <Tooltip
              permanent
              direction="top"
              offset={[0, -20]}
              className="!bg-transparent !border-none !shadow-none !text-green-500 font-black text-[8px] tracking-[0.3em] uppercase italic"
            >
              YOU (OFFICER)
            </Tooltip>
          </SmoothMarker>

          {/* INCIDENT MARKERS */}
          {incidentPositions.map((item) => (
            <Marker key={item.id} position={item.position} icon={incidentIcon}>
              <Tooltip
                permanent
                direction="top"
                offset={[0, -25]}
                className="!bg-transparent !border-none !shadow-none !text-red-500 font-black text-[8px] tracking-[0.3em] uppercase italic"
              >
                {item.isActive ? 'ACTIVE DISPATCH' : 'PENDING SOS'}
              </Tooltip>
            </Marker>
          ))}

          {/* ACTIVE DISPATCH (if not already in incidents list) */}
          {active &&
            citizenLoc &&
            !incidents.find((i) => i.id === activeDispatch?.id) && (
              <Marker
                position={[citizenLoc.latitude, citizenLoc.longitude]}
                icon={incidentIcon}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -25]}
                  className="!bg-transparent !border-none !shadow-none !text-red-500 font-black text-[8px] tracking-[0.3em] uppercase italic"
                >
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
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.4em]">
                  Signal Status
                </p>
                <h4 className="text-xs font-black text-white italic tracking-tighter uppercase">
                  Encrypted Matrix
                </h4>
              </div>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div>
              <p className="text-[8px] font-black text-gray-500 uppercase tracking-[0.4em]">
                Tracking Mode
              </p>
              <h4 className="text-xs font-black text-green-500 italic tracking-tighter uppercase">
                Live Vector Active
              </h4>
            </div>
          </motion.div>

          {/* LEGEND */}
          <div className="glass p-5 rounded-3xl border border-white/5 bg-black/40 backdrop-blur-3xl space-y-3 pointer-events-auto">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)] animate-pulse" />
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                You (Officer)
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-1 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,1)]" />
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                Best Route
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_10px_rgba(220,38,38,1)] animate-pulse" />
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">
                Incident Location
              </span>
            </div>
          </div>
        </div>

        {/* NAVIGATION HUD */}
        <AnimatePresence>
          {active && route && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto"
            >
              <div className="glass px-12 py-6 rounded-[3rem] border border-blue-500/20 bg-black/80 backdrop-blur-3xl flex items-center space-x-12 shadow-[0_40px_100px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex flex-col">
                  <p className="text-[8px] font-black uppercase tracking-[0.4em] text-blue-500 mb-2">
                    Next Maneuver
                  </p>
                  <h4 className="text-sm font-black text-white uppercase italic max-w-[200px] truncate">
                    {nextStep}
                  </h4>
                </div>

                <div className="h-10 w-px bg-white/10" />

                <div className="text-center">
                  <p className="text-[8px] font-black uppercase tracking-[0.4em] text-gray-500 mb-1">
                    ETA
                  </p>
                  <h4 className="text-2xl font-black italic tracking-tighter text-white uppercase">
                    {eta}
                  </h4>
                </div>

                <div className="h-10 w-px bg-white/10" />

                <div className="text-center">
                  <p className="text-[8px] font-black uppercase tracking-[0.4em] text-gray-500 mb-1">
                    Dist
                  </p>
                  <h4 className="text-2xl font-black italic tracking-tighter text-white uppercase">
                    {distance}
                  </h4>
                </div>

                <div className="h-10 w-px bg-white/10" />

                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 mb-1">
                    <Navigation className="text-blue-500" size={20} />
                  </div>
                  <p className="text-[6px] font-black text-blue-500 uppercase tracking-[0.3em]">
                    Live
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
  (prev, next) => {
    const sameOfficer =
      prev.officerLoc?.latitude === next.officerLoc?.latitude &&
      prev.officerLoc?.longitude === next.officerLoc?.longitude;
    const sameCitizen =
      prev.citizenLoc?.latitude === next.citizenLoc?.latitude &&
      prev.citizenLoc?.longitude === next.citizenLoc?.longitude;
    const sameActive = prev.active === next.active;
    const sameIncidents =
      prev.incidents?.map((i: any) => `${i.id}:${i.latitude}:${i.longitude}`).join(',') ===
      next.incidents?.map((i: any) => `${i.id}:${i.latitude}:${i.longitude}`).join(',');
    const sameDispatch = prev.activeDispatch?.id === next.activeDispatch?.id;
    return sameOfficer && sameCitizen && sameActive && sameIncidents && sameDispatch;
  },
);

export default OfficerLiveMap;
