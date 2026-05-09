import { useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, orderBy, limit, where } from 'firebase/firestore';
import { useAdminStore } from '@/store/useAdminStore';

export const useAdminFirestore = () => {
  const { setEmergencies, addEmergency, updateEmergency } = useAdminStore();

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com'}/api/emergency`);
        const emergencies = await response.json();
        
        const mapped = emergencies.map((e: any) => {
          const latitude = e.latitude || e.location?.lat || e.lat || 0;
          const longitude = e.longitude || e.location?.lng || e.lng || 0;
          console.log(`📡 [ADMIN SYNC] Incident ${e.id} LAT:`, latitude, "LNG:", longitude);
          
          return {
            id: e.id,
            citizenName: e.citizenName,
            status: e.status.toUpperCase(),
            latitude,
            longitude,
            lat: latitude,
            lng: longitude,
            createdAt: e.createdAt,
            emergencyType: e.emergencyType,
          };
        });
        
        setEmergencies(mapped);
      } catch (error) {
        console.error('Admin polling error:', error);
      }
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [setEmergencies]);

  useEffect(() => {
    const handleNewIncident = (event: any) => {
      const e = event.detail;
      console.log('🚨 [ADMIN IMMEDIATE] New SOS:', e.id);
      const latitude = e.latitude || e.location?.lat || e.lat || 0;
      const longitude = e.longitude || e.location?.lng || e.lng || 0;
      console.log(`🚨 [ADMIN IMMEDIATE] New SOS ${e.id} LAT:`, latitude, "LNG:", longitude);

      const mapped = {
        id: e.id,
        citizenName: e.citizenName,
        status: (e.status || 'PENDING').toUpperCase(),
        latitude,
        longitude,
        lat: latitude,
        lng: longitude,
        createdAt: e.createdAt,
        emergencyType: e.emergencyType,
      };
      addEmergency(mapped);
    };

    const handleIncidentUpdate = (event: any) => {
      const e = event.detail;
      console.log('🔄 [ADMIN IMMEDIATE] SOS Updated:', e.id);
      const latitude = e.latitude || e.location?.lat || e.lat || 0;
      const longitude = e.longitude || e.location?.lng || e.lng || 0;
      console.log(`🔄 [ADMIN IMMEDIATE] Update SOS ${e.id} LAT:`, latitude, "LNG:", longitude);

      const mapped = {
        id: e.id,
        citizenName: e.citizenName,
        status: (e.status || 'PENDING').toUpperCase(),
        latitude,
        longitude,
        lat: latitude,
        lng: longitude,
        createdAt: e.createdAt,
        emergencyType: e.emergencyType,
      };
      updateEmergency(mapped);
    };

    window.addEventListener('new-incident', handleNewIncident);
    window.addEventListener('incident-updated', handleIncidentUpdate);
    return () => {
      window.removeEventListener('new-incident', handleNewIncident);
      window.removeEventListener('incident-updated', handleIncidentUpdate);
    };
  }, [setEmergencies]);

  useEffect(() => {
    const q = query(collection(db, 'officers'), where('active', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const officers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      useAdminStore.getState().setOfficers(officers);
    });
    return () => unsubscribe();
  }, []);

  return {};
};
