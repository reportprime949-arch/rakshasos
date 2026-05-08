'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  officerLoc: { lat: number; lng: number } | null;
  citizenLoc: { lat: number; lng: number } | null;
  status: string;
}

function MapController({ officerLoc, citizenLoc, status }: MapProps) {
  const map = useMap();

  useEffect(() => {
    if (officerLoc && citizenLoc) {
      const bounds = L.latLngBounds([
        [officerLoc.lat, officerLoc.lng],
        [citizenLoc.lat, citizenLoc.lng]
      ]);
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    }
  }, [officerLoc?.lat, officerLoc?.lng, citizenLoc?.lat, citizenLoc?.lng, map]);

  return null;
}

const CitizenLiveMap = ({ officerLoc, citizenLoc, status }: MapProps) => {
  const [route, setRoute] = useState<any>(null);

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
          <div class="absolute -inset-4 bg-blue-500/30 rounded-full blur-lg animate-pulse"></div>
          <div class="w-8 h-8 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg relative z-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }, []);

  const citizenIcon = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return L.divIcon({
      className: 'citizen-map-self',
      html: `
        <div class="relative">
          <div class="absolute -inset-4 bg-red-600/20 rounded-full blur-lg"></div>
          <div class="w-6 h-6 bg-red-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg relative z-10">
            <div class="w-2 h-2 bg-white rounded-full animate-ping"></div>
          </div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
  }, []);

  useEffect(() => {
    const fetchRoute = async () => {
      if (!officerLoc || !citizenLoc || status === 'COMPLETED') return;
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${officerLoc.lng},${officerLoc.lat};${citizenLoc.lng},${citizenLoc.lat}?overview=full&geometries=geojson`);
        const data = await res.json();
        if (data.routes?.[0]) setRoute(data.routes[0]);
      } catch (e) {}
    };
    fetchRoute();
  }, [officerLoc, citizenLoc, status]);

  const routeCoords = useMemo(() => {
    if (!route) return [];
    return route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
  }, [route]);

  if (typeof window === 'undefined') return null;

  return (
    <div className="w-full h-full relative leaflet-dark-mode">
      <style jsx global>{`
        .leaflet-dark-mode .leaflet-tile-container {
          filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
        }
        .leaflet-container { background: #0a0a0a !important; }
        .citizen-map-officer, .citizen-map-self { background: none !important; border: none !important; }
      `}</style>
      <MapContainer
        center={[citizenLoc?.lat || 0, citizenLoc?.lng || 0]}
        zoom={15}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapController officerLoc={officerLoc} citizenLoc={citizenLoc} status={status} />

        {routeCoords.length > 0 && (
          <Polyline
            positions={routeCoords}
            pathOptions={{
              color: status === 'COMPLETED' ? '#22c55e' : '#3b82f6',
              weight: 6,
              opacity: 0.8,
              lineJoin: 'round'
            }}
          />
        )}

        {officerLoc && officerIcon && (
          <Marker position={[officerLoc.lat, officerLoc.lng]} icon={officerIcon} />
        )}

        {citizenLoc && citizenIcon && (
          <Marker position={[citizenLoc.lat, citizenLoc.lng]} icon={citizenIcon} />
        )}
      </MapContainer>
    </div>
  );
};

export default CitizenLiveMap;
