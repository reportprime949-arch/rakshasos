import { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useOfficerStore } from '@/store/useOfficerStore';
import { distanceMeters } from '@/utils/animateMarker';
import { gpsManager } from '@/utils/GeolocationManager';

const SOCKET_EMIT_THRESHOLD_M = 20;
const FIRESTORE_THRESHOLD_M = 25;
const FIRESTORE_SYNC_INTERVAL = 5000;

export const useOfficerLocation = (
  officerId: string,
  name: string,
  emitLocationUpdate?: (data: { officerId: string; latitude: number; longitude: number }) => void,
) => {
  // Atomic selector — only re-render when isOnline changes
  const isOnline = useOfficerStore((s) => s.isOnline);

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(() => {
    const last = gpsManager.getLastKnownLocation();
    return last ? { latitude: last.coords.latitude, longitude: last.coords.longitude } : null;
  });
  const [locationError, setLocationError] = useState<string | null>(null);

  // Refs for throttling (no re-renders)
  const locationRef = useRef<{ latitude: number; longitude: number } | null>(location);
  const lastEmittedRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastFirestoreRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastEmitTimeRef = useRef<number>(0);
  const emitRef = useRef(emitLocationUpdate);

  useEffect(() => {
    emitRef.current = emitLocationUpdate;
  }, [emitLocationUpdate]);

  // ----------------------------------------------------------
  // GPS SUBSCRIPTION
  // ----------------------------------------------------------
  useEffect(() => {
    if (!isOnline) return;

    const unsubscribe = gpsManager.subscribe((update) => {
      const { latitude, longitude } = update.coords;
      const newLoc = { latitude, longitude };

      // Store in ref for Firestore sync (no re-render)
      locationRef.current = newLoc;

      // Update React state for UI (Map marker)
      setLocation(newLoc);

      if (update.state === 'error' || update.state === 'denied') {
        setLocationError(
          update.state === 'denied' ? 'Location permission denied.' : 'GPS Signal Timeout.',
        );
        return;
      }
      setLocationError(null);

      // Throttled Socket Emit
      const lastEmit = lastEmittedRef.current;
      const now = Date.now();
      const timeSinceLastEmit = now - lastEmitTimeRef.current;

      if (
        !lastEmit ||
        (distanceMeters(lastEmit.latitude, lastEmit.longitude, latitude, longitude) >
          SOCKET_EMIT_THRESHOLD_M &&
          timeSinceLastEmit >= 3000)
      ) {
        lastEmittedRef.current = newLoc;
        lastEmitTimeRef.current = now;
        emitRef.current?.({ officerId, ...newLoc });
      }
    });

    return () => unsubscribe();
  }, [isOnline, officerId]);

  // ----------------------------------------------------------
  // FIRESTORE SYNC — uses ref, not state, to avoid restarting interval
  // ----------------------------------------------------------
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(async () => {
      const loc = locationRef.current;
      if (!loc) return;

      const last = lastFirestoreRef.current;
      if (
        last &&
        distanceMeters(last.latitude, last.longitude, loc.latitude, loc.longitude) < FIRESTORE_THRESHOLD_M
      ) {
        return;
      }

      lastFirestoreRef.current = { ...loc };

      try {
        const store = useOfficerStore.getState();
        await setDoc(
          doc(db, 'officers', officerId),
          {
            officerId,
            name,
            latitude: loc.latitude,
            longitude: loc.longitude,
            lat: loc.latitude,
            lng: loc.longitude,
            active: !!store.activeDispatch,
            onDuty: store.isOnline,
            currentIncidentId: store.activeDispatch?.id || null,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (err) {
        // Firestore sync is non-critical — don't crash
      }
    }, FIRESTORE_SYNC_INTERVAL);

    return () => clearInterval(interval);
  }, [isOnline, officerId, name]);

  return { location, locationError };
};
