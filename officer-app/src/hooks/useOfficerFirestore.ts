import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useOfficerStore } from '@/store/useOfficerStore';
import { calculateDistance } from '@/utils/distance';

export const useOfficerFirestore = (currentLocation: { lat: number; lng: number } | null) => {
  const { setDispatch, isOnline, activeDispatch, setStatus, officerId, officerName } = useOfficerStore();
  const [pendingEmergencies, setPendingEmergencies] = useState<any[]>([]);

  useEffect(() => {
    if (!isOnline || !currentLocation) {
      console.log('⚠️ [OFFICER OFFLINE] or no GPS');
      setPendingEmergencies([]);
      return;
    }

    console.log('🛰️ [OFFICER API POLLING ACTIVE] for ID:', officerId);

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com'}/api/emergency`);
        const allIncidents = await response.json();
        
        console.log(`📥 [INCIDENT UPDATE] Fetched ${allIncidents.length} complaints`);
        
        const filtered = allIncidents.filter((e: any) => {
          const distance = calculateDistance(
            currentLocation.lat,
            currentLocation.lng,
            e.location.lat,
            e.location.lng
          );
          e.distanceKm = distance;
          
          // Match if searching nearby OR if specifically assigned to me
          const isNearby = (e.status === 'pending' || e.status === 'searching') && distance <= 3;
          const isAssignedToMe = e.assignedOfficerId === officerId;
          
          return isNearby || isAssignedToMe;
        });

        console.log(`🎯 [FILTERED INCIDENTS]: ${filtered.length}`);
        setPendingEmergencies(filtered);
        
        // Auto-populate active dispatch
        const myActiveIncident = filtered.find((e: any) => 
          e.assignedOfficerId === officerId && 
          ['assigned', 'enroute', 'arrived'].includes(e.status)
        );

        if (myActiveIncident) {
          if (!activeDispatch || activeDispatch.id !== myActiveIncident.id) {
            console.log('✅ [DISPATCH RECEIVED]', myActiveIncident.id);
            setDispatch({
              id: myActiveIncident.id,
              citizenName: myActiveIncident.citizenName,
              lat: myActiveIncident.location.lat,
              lng: myActiveIncident.location.lng,
              description: myActiveIncident.description || 'Emergency SOS',
            });
          }
          setStatus(myActiveIncident.status.toUpperCase());
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isOnline, currentLocation, officerId]);

  const acceptEmergency = async (id: string) => {
    console.log('👆 [OFFICER ACTION] Accept Button Clicked:', id);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com'}/api/emergency/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'enroute',
          officerId,
          officerName
        })
      });

      if (response.ok) {
        console.log('✅ [OFFICER ACCEPTED INCIDENT]', id);
        setStatus('EN_ROUTE');
        return true;
      }
      return false;
    } catch (error) {
      console.error('🔴 [ACCEPT FAILED]', error);
      return false;
    }
  };

  return { pendingEmergencies, acceptEmergency };
};
