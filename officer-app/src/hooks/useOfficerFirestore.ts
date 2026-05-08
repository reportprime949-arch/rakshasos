import { useEffect, useState, useCallback } from 'react';
import { useOfficerStore, DispatchAlert } from '@/store/useOfficerStore';
import { calculateDistance } from '@/utils/distance';

export const useOfficerFirestore = (currentLocation: { lat: number; lng: number } | null) => {
  const { setDispatch, isOnline, activeDispatch, setStatus, officerId, officerName } = useOfficerStore();
  const [pendingEmergencies, setPendingEmergencies] = useState<DispatchAlert[]>([]);

  const syncDispatch = useCallback((incident: DispatchAlert) => {
    if (!activeDispatch || activeDispatch.id !== incident.id) {
      console.log('✅ [DISPATCH AUTO-SYNC]', incident.id);
      setDispatch({
        id: incident.id,
        citizenName: incident.citizenName,
        lat: incident.lat,
        lng: incident.lng,
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

    console.log('🛰️ [OFFICER API POLLING ACTIVE] for ID:', officerId);

    const pollInterval = setInterval(async () => {
      const URL = `${process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com'}/api/emergency`;
      try {
        const response = await fetch(URL, { cache: 'no-store' });
        
        if (!response.ok) {
          console.warn('⚠️ [POLLING FAILED] Status:', response.status);
          return;
        }

        const text = await response.text();
        if (!text) return;

        const allIncidents: DispatchAlert[] = JSON.parse(text);
        
        const filtered = allIncidents.filter((e) => {
          const distance = calculateDistance(
            currentLocation.lat,
            currentLocation.lng,
            e.lat || (e as any).location.lat,
            e.lng || (e as any).location.lng
          );
          (e as any).distanceKm = distance;
          
          const isNearby = (e.status === 'pending' || e.status === 'searching') && distance <= 3;
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
      } catch (error) {
        console.error('🔴 [POLLING ERROR]:', error);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [isOnline, currentLocation, officerId, syncDispatch]);

  useEffect(() => {
    const handleNewIncident = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;
      console.log('💡 [IMMEDIATE UI UPDATE]: New SOS', data.id);
      
      const distance = currentLocation ? calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        data.location.lat,
        data.location.lng
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
          lat: data.location.lat,
          lng: data.location.lng,
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
    const URL = `${process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com'}/api/emergency/${id}`;
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
