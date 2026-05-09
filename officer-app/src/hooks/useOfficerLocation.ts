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

    const mockCoords = { latitude: 17.3850, longitude: 78.4867 };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLoc = { latitude, longitude };
        console.log("LAT:", latitude);
        console.log("LNG:", longitude);
        setLocation(newLoc);
        setLocationError(null);
        
        // Only emit via socket if position changed by >10 meters
        const last = lastEmittedRef.current;
        if (!last || distanceMeters(last.latitude, last.longitude, newLoc.latitude, newLoc.longitude) > 10) {
          lastEmittedRef.current = newLoc;
          if (emitLocationUpdate) {
            emitLocationUpdate({ officerId, ...newLoc });
          }
        }
      },
      (error) => {
        console.warn('🛰️ [GPS ERROR]', error.message);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location permission denied.");
        } else {
          setLocationError("Location unavailable.");
        }
        setLocation(mockCoords);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        // Allow cached position up to 5 seconds — reduces GPS battery drain
        maximumAge: 5000 
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, officerId, emitLocationUpdate]);

  // Throttled Firestore sync — every 15 seconds, only if position changed >20m
  useEffect(() => {
    if (!isOnline || !location) return;

    const updateFirestore = async () => {
      const last = lastFirestoreRef.current;
      if (last && distanceMeters(last.latitude, last.longitude, location.latitude, location.longitude) < 20) {
        return; // Skip if position hasn't changed significantly
      }
      
      lastFirestoreRef.current = location;
      
      try {
        const isBusy = !!useOfficerStore.getState().activeDispatch;
        await setDoc(doc(db, 'officers', officerId), {
          officerId,
          name,
          latitude: location.latitude,
          longitude: location.longitude,
          lat: location.latitude, // For backward compatibility
          lng: location.longitude, // For backward compatibility
          active: isBusy, // Set active based on whether they have a dispatch
          onDuty: isOnline,
          currentIncidentId: useOfficerStore.getState().activeDispatch?.id || null,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch {
        console.error('🛰️ [GPS] Firestore sync failed');
      }
    };

    // Throttle Firestore updates to every 15 seconds
    const interval = setInterval(updateFirestore, 15000);
    updateFirestore();

    return () => clearInterval(interval);
  }, [isOnline, location, officerId, name]);

  return { location, locationError };
};
