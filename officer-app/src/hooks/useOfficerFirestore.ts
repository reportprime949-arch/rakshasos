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

    console.log('🛰️ [OFFICER LISTENER ACTIVE] for ID:', officerId);

    // Listen for incidents that are SEARCHING or specifically ASSIGNED to this officer
    const q = query(
      collection(db, 'emergencies'),
      where('status', 'in', ['SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`📥 [INCIDENT UPDATE] Snapshot received: ${snapshot.size} docs`);
      
      const allIncidents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      const filtered = allIncidents.filter(e => {
        const distance = calculateDistance(
          currentLocation.lat,
          currentLocation.lng,
          e.lat,
          e.lng
        );
        e.distanceKm = distance;
        
        // Match if searching nearby OR if specifically assigned to me
        const isNearby = e.status === 'SEARCHING' && distance <= 3;
        const isAssignedToMe = e.assignedOfficerId === officerId;
        
        return isNearby || isAssignedToMe;
      });

      console.log(`🎯 [FILTERED INCIDENTS]: ${filtered.length}`);
      setPendingEmergencies(filtered);
      
      // Auto-populate active dispatch if we were assigned or are en route
      const myActiveIncident = filtered.find(e => 
        e.assignedOfficerId === officerId && 
        ['ASSIGNED', 'EN_ROUTE', 'ARRIVED'].includes(e.status)
      );

      if (myActiveIncident) {
        if (!activeDispatch || activeDispatch.id !== myActiveIncident.id) {
          console.log('✅ [DISPATCH RECEIVED]', myActiveIncident.id);
          setDispatch({
            id: myActiveIncident.id,
            citizenName: myActiveIncident.citizenName,
            lat: myActiveIncident.lat,
            lng: myActiveIncident.lng,
            description: myActiveIncident.description || 'Emergency SOS',
          });
        }
        
        // Sync local status with Firestore status
        setStatus(myActiveIncident.status);
        console.log(`🔄 [STATUS UPDATED] to ${myActiveIncident.status}`);
      } else {
        if (activeDispatch) {
          console.log('🏁 [DISPATCH RESOLVED OR REMOVED]');
          setDispatch(null);
        }
      }
    });

    return () => unsubscribe();
  }, [isOnline, currentLocation, officerId]);

  const acceptEmergency = async (id: string) => {
    console.log('👆 [OFFICER ACTION] Accept Button Clicked:', id);
    try {
      // 1. Update Emergency Document
      const emergencyRef = doc(db, 'emergencies', id);
      await setDoc(emergencyRef, {
        status: 'EN_ROUTE',
        acceptedAt: serverTimestamp(),
        officerAccepted: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      console.log('✅ [OFFICER ACCEPTED INCIDENT]', id);
      console.log('📡 [STATUS UPDATED TO EN_ROUTE]');

      // 2. Update/Create Dispatch Document for Admin tracking
      const dispatchRef = doc(db, 'dispatches', `DISPATCH-${id}`);
      await setDoc(dispatchRef, {
        emergencyId: id,
        officerId,
        officerName,
        dispatchStatus: 'ACTIVE',
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setStatus('EN_ROUTE');
      console.log('📊 [CITIZEN SYNCED] via Firestore');
      return true;
    } catch (error) {
      console.error('🔴 [ACCEPT FAILED]', error);
      return false;
    }
  };

  return { pendingEmergencies, acceptEmergency };
};
