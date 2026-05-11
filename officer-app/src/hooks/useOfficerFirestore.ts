import { useEffect, useCallback, useRef } from 'react';
import { useOfficerStore, DispatchAlert } from '@/store/useOfficerStore';
import { calculateDistance } from '@/utils/distance';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export const useOfficerFirestore = (
  currentLocation: { latitude: number; longitude: number } | null,
) => {
  // ATOMIC selectors — each subscribes only to its own slice
  const isOnline = useOfficerStore((s) => s.isOnline);
  const officerId = useOfficerStore((s) => s.officerId);
  const officerName = useOfficerStore((s) => s.officerName);
  const setDispatch = useOfficerStore((s) => s.setDispatch);
  const setStatus = useOfficerStore((s) => s.setStatus);
  const setIncidents = useOfficerStore((s) => s.setIncidents);
  const setFirestoreStatus = useOfficerStore((s) => s.setFirestoreStatus);

  // Refs for values that change often but shouldn't restart effects
  const locationRef = useRef(currentLocation);
  useEffect(() => {
    locationRef.current = currentLocation;
  }, [currentLocation]);

  const syncDispatch = useCallback(
    (incident: DispatchAlert) => {
      const current = useOfficerStore.getState().activeDispatch;
      if (!current || current.id !== incident.id || current.status !== incident.status) {
        setDispatch({
          id: incident.id,
          citizenName: incident.citizenName,
          latitude: incident.latitude || incident.lat || (incident as any).location?.lat || 0,
          longitude: incident.longitude || incident.lng || (incident as any).location?.lng || 0,
          description: incident.description || 'Emergency SOS',
          status: incident.status,
        });
      }
    },
    [setDispatch],
  );

  // ----------------------------------------------------------
  // FIRESTORE REALTIME LISTENER
  // ----------------------------------------------------------
  useEffect(() => {
    if (!isOnline) {
      setIncidents([]);
      return;
    }

    setFirestoreStatus('INITIALIZING');
    const emergenciesRef = collection(db, 'emergencies');
    const q = query(
      emergenciesRef,
      where('status', 'in', ['pending', 'searching', 'assigned', 'enroute', 'arrived']),
      where('active', '==', true),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setFirestoreStatus('SYNCED');
        const loc = locationRef.current;
        const allIncidents: DispatchAlert[] = [];

        snapshot.forEach((docSnap) => {
          allIncidents.push({ id: docSnap.id, ...docSnap.data() } as DispatchAlert);
        });

        const filtered = allIncidents.filter((e) => {
          const eLat = e.latitude || (e as any).location?.lat || e.lat || 0;
          const eLng = e.longitude || (e as any).location?.lng || e.lng || 0;

          let distance = 0;
          if (loc) {
            distance = calculateDistance(loc.latitude, loc.longitude, eLat, eLng);
            (e as any).distanceKm = distance;
          }

          const isNearby =
            (e.status === 'pending' || e.status === 'searching') && distance <= 50;
          const isAssignedToMe = (e as any).assignedOfficerId === officerId;

          return isNearby || isAssignedToMe;
        });

        // Only update store if incidents actually changed
        const prevIncidents = useOfficerStore.getState().activeIncidents;
        const hasChanged =
          filtered.length !== prevIncidents.length ||
          filtered.some(
            (inc, idx) =>
              inc.id !== prevIncidents[idx]?.id || inc.status !== prevIncidents[idx]?.status,
          );

        if (hasChanged) {
          setIncidents(filtered);
        }

        // Sync active dispatch
        const myActiveIncident = filtered.find(
          (e) =>
            (e as any).assignedOfficerId === officerId &&
            ['assigned', 'enroute', 'arrived'].includes(e.status),
        );

        if (myActiveIncident) {
          syncDispatch(myActiveIncident);
        }
      },
      (error) => {
        console.error('🔴 [FIRESTORE ERROR]:', error);
        setFirestoreStatus('ERROR');
      },
    );

    return () => {
      unsubscribe();
    };
  }, [isOnline, officerId, syncDispatch, setIncidents, setFirestoreStatus]);

  // ----------------------------------------------------------
  // ACCEPT EMERGENCY (REST API)
  // ----------------------------------------------------------
  const acceptEmergency = useCallback(
    async (id: string) => {
      const URL = `${process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com'}/api/emergency/${id}`;

      try {
        const response = await fetch(URL, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'enroute',
            officerId,
            officerName,
          }),
        });

        if (response.ok) {
          setStatus('EN_ROUTE');
          return true;
        }
        return false;
      } catch (error) {
        console.error('🔴 [ACCEPT ERROR]:', error);
        return false;
      }
    },
    [officerId, officerName, setStatus],
  );

  return { acceptEmergency };
};
