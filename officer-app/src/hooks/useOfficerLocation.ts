import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useOfficerStore } from '@/store/useOfficerStore';

// Haversine distance in meters — used to debounce location updates
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const useOfficerLocation = (
  officerId: string, 
  name: string, 
  emitLocationUpdate?: (data: { officerId: string; latitude: number; longitude: number }) => void
) => {
  const { isOnline } = useOfficerStore();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const lastEmittedRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastFirestoreRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // GPS tracking with debounced emission
  useEffect(() => {
    if (!isOnline) return;

    // PHASE 2: STRICT REAL GPS ONLY
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLoc = { latitude, longitude };
        
        console.log("🛰️ [GPS UPDATE] LAT:", latitude, "LNG:", longitude);
        setLocation(newLoc);
        setLocationError(null);
        
        // Emit via socket if position changed by >5 meters for smooth movement
        const last = lastEmittedRef.current;
        if (!last || distanceMeters(last.latitude, last.longitude, newLoc.latitude, newLoc.longitude) > 5) {
          lastEmittedRef.current = newLoc;
          if (emitLocationUpdate) {
            emitLocationUpdate({ officerId, ...newLoc });
          }
        }
      },
      (error) => {
        console.warn('🚨 [OFFICER GPS ERROR]', error.message);
        let msg = "Location unavailable.";
        if (error.code === error.PERMISSION_DENIED) msg = "Location permission denied.";
        else if (error.code === error.TIMEOUT) msg = "GPS Signal Timeout.";
        
        setLocationError(msg);
        // DO NOT use mock coords here. If GPS fails, it fails.
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 0 
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, officerId, emitLocationUpdate]);

  // Throttled Firestore sync — every 5 seconds for "Uber-like" smoothness
  useEffect(() => {
    if (!isOnline || !location) return;

    const updateFirestore = async () => {
      const last = lastFirestoreRef.current;
      // Update Firestore if position changed >10m
      if (last && distanceMeters(last.latitude, last.longitude, location.latitude, location.longitude) < 10) {
        return; 
      }
      
      lastFirestoreRef.current = location;
      
      try {
        const isBusy = !!useOfficerStore.getState().activeDispatch;
        await setDoc(doc(db, 'officers', officerId), {
          officerId,
          name,
          latitude: location.latitude,
          longitude: location.longitude,
          lat: location.latitude, 
          lng: location.longitude, 
          active: isBusy,
          onDuty: isOnline,
          currentIncidentId: useOfficerStore.getState().activeDispatch?.id || null,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        console.log('🔥 [FIREBASE] Officer Location Synced');
      } catch (err) {
        console.error('🛰️ [GPS] Firestore sync failed:', err);
      }
    };

    const interval = setInterval(updateFirestore, 5000);
    updateFirestore();

    return () => clearInterval(interval);
  }, [isOnline, location, officerId, name]);

  return { location, locationError };
};
