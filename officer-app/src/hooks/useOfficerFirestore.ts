import { useEffect, useState, useCallback } from 'react';
import { useOfficerStore, DispatchAlert } from '@/store/useOfficerStore';
import { calculateDistance } from '@/utils/distance';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export const useOfficerFirestore = (currentLocation: { latitude: number; longitude: number } | null) => {
  const { setDispatch, isOnline, activeDispatch, setStatus, officerId, officerName } = useOfficerStore();
  const [pendingEmergencies, setPendingEmergencies] = useState<DispatchAlert[]>([]);

  const syncDispatch = useCallback((incident: DispatchAlert) => {
    if (!activeDispatch || activeDispatch.id !== incident.id) {
      console.log('✅ [DISPATCH AUTO-SYNC]', incident.id);
      setDispatch({
        id: incident.id,
        citizenName: incident.citizenName,
        latitude: incident.latitude || incident.lat || (incident as any).location?.lat,
        longitude: incident.longitude || incident.lng || (incident as any).location?.lng,
        description: incident.description || 'Emergency SOS',
        status: incident.status
      });
    }
    setStatus(incident.status.toUpperCase() as any);
  }, [activeDispatch, setDispatch, setStatus]);

  useEffect(() => {
    if (!isOnline || !currentLocation) {
      setPendingEmergencies((prev) => prev.length > 0 ? [] : prev);
      return;
    }

    // PHASE 5: REALTIME FIRESTORE SYNC
    const emergenciesRef = collection(db, 'emergencies');
    const q = query(
      emergenciesRef, 
      where('status', 'in', ['pending', 'searching', 'assigned', 'enroute', 'arrived'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allIncidents: DispatchAlert[] = [];
      snapshot.forEach((doc) => {
        allIncidents.push({ id: doc.id, ...doc.data() } as DispatchAlert);
      });

      const filtered = allIncidents.filter((e) => {
        const eLat = e.latitude || (e as any).location?.lat || e.lat || 0;
        const eLng = e.longitude || (e as any).location?.lng || e.lng || 0;
        
        const distance = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          eLat,
          eLng
        );
        (e as any).distanceKm = distance;
        
        const isNearby = (e.status === 'pending' || e.status === 'searching') && distance <= 50; // 50km radius
        const isAssignedToMe = (e as any).assignedOfficerId === officerId;
        
        return isNearby || isAssignedToMe;
      });

      setPendingEmergencies(filtered);
      
      const myActiveIncident = filtered.find((e) => 
        (e as any).assignedOfficerId === officerId && 
        ['assigned', 'enroute', 'arrived'].includes(e.status)
      );

      if (myActiveIncident) {
        syncDispatch(myActiveIncident);
      }
    }, (error) => {
      console.error('🔴 [FIRESTORE SYNC ERROR]:', error);
    });

    return () => unsubscribe();
  }, [isOnline, currentLocation, officerId, syncDispatch]);

  useEffect(() => {
    const handleNewIncident = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;
      console.log('💡 [IMMEDIATE UI UPDATE]: New SOS', data.id);
      
      const distance = currentLocation ? calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        data.latitude || data.location?.lat,
        data.longitude || data.location?.lng
      ) : 0;
      
      const incidentWithDistance = { ...data, distanceKm: distance };
      setPendingEmergencies(prev => {
        if (prev.find(e => e.id === data.id)) return prev;
        return [incidentWithDistance, ...prev];
      });
    };

    const handleIncidentUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;
      console.log('💡 [IMMEDIATE UI UPDATE]: Incident Status', data.id, data.status);
      
      setPendingEmergencies(prev => prev.map(e => e.id === data.id ? { ...e, ...data } : e));
      
      if (data.assignedOfficerId === officerId && ['assigned', 'enroute', 'arrived'].includes(data.status)) {
        setDispatch({
          id: data.id,
          citizenName: data.citizenName,
          latitude: data.latitude || data.location?.lat,
          longitude: data.longitude || data.location?.lng,
          description: data.description || 'Emergency SOS',
          status: data.status
        });
        setStatus(data.status.toUpperCase());
      }
    };

    window.addEventListener('new-incident', handleNewIncident);
    window.addEventListener('incident-updated', handleIncidentUpdate);
    return () => {
      window.removeEventListener('new-incident', handleNewIncident);
      window.removeEventListener('incident-updated', handleIncidentUpdate);
    };
  }, [currentLocation, officerId, setDispatch, setStatus]);

  const acceptEmergency = async (id: string) => {
    const URL = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/emergency/${id}`;
    console.log('👆 [ACTION] Accepting via API:', URL);
    try {
      const response = await fetch(URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'enroute',
          officerId,
          officerName
        })
      });

      if (response.ok) {
        const text = await response.text();
        console.log('✅ [ACTION SUCCESS] Response:', text);
        setStatus('EN_ROUTE');
        return true;
      }
      console.warn('❌ [ACTION FAILED] Status:', response.status);
      return false;
    } catch (error) {
      console.error('🔴 [ACTION ERROR]:', error);
      return false;
    }
  };

  return { pendingEmergencies, acceptEmergency };
};
