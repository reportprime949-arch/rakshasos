import { create } from 'zustand';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { calculateDistance } from '@/utils/distance';
import { API_URL, safeFetch } from '@/lib/api';

export type EmergencyStatus = 
  | 'IDLE'
  | 'COUNTDOWN'
  | 'SEARCHING'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'CANCELLED';

interface EmergencyState {
  id: string | null;
  status: EmergencyStatus;
  startTime: number | null;
  location: { latitude: number; longitude: number } | null;
  lastGPSUpdate: number;
  officer: {
    id?: string;
    name: string;
    badge: string;
    phone: string;
    latitude: number;
    longitude: number;
    eta: string;
  } | null;
  error: string | null;
  
  // Actions
  startCountdown: () => void;
  triggerSOS: (citizenName: string, citizenId: string) => Promise<any>;
  setLocation: (location: { latitude: number; longitude: number }) => void;
  updateStatus: (status: EmergencyStatus) => void;
  assignOfficer: (officer: any) => void;
  cancelEmergency: () => void;
  syncWithFirestore: () => () => void;
  reset: () => void;
}

// Terminal states — polling must stop when we reach these
const TERMINAL_STATUSES: EmergencyStatus[] = ['IDLE', 'COMPLETED', 'CANCELLED'];

export const useEmergencyStore = create<EmergencyState>()(
  (set, get) => ({
    id: null,
    status: 'IDLE',
    startTime: null,
    location: null,
    lastGPSUpdate: 0,
    officer: null,
    error: null,

    reset: () => {
      console.log('🧹 [CITIZEN RESET] Clearing all emergency state');
      try {
        localStorage.removeItem('rakshasos-emergency-session');
        localStorage.removeItem('activeSOS');
        localStorage.removeItem('activeEmergency');
        sessionStorage.clear();
      } catch { /* SSR guard */ }
      set({ 
        id: null, 
        status: 'IDLE', 
        officer: null, 
        location: null, 
        startTime: null,
        error: null 
      });
    },

    startCountdown: () => set({ status: 'COUNTDOWN' }),

    assignOfficer: (officer) => set({ officer, status: 'ASSIGNED' }),

    triggerSOS: async (citizenName, citizenId) => {
      const startTime = Date.now();
      let latitude = 0;
      let longitude = 0;

      // Request fresh GPS coordinates
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
          }
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        console.log("LAT:", latitude);
        console.log("LNG:", longitude);
      } catch (err) {
        console.error("⚠️ [GPS FAILED] Using fallback/store coords:", err);
        const storeLocation = get().location;
        latitude = storeLocation?.latitude || 0;
        longitude = storeLocation?.longitude || 0;
      }

      const payload = {
        citizenId,
        citizenName,
        emergencyType: 'SOS Triggered',
        latitude,
        longitude,
        location: { lat: latitude, lng: longitude }, // Backward compatibility
        timestamp: Date.now(),
      };
      
      console.log('🚨 [SOS] Triggering emergency to:', `${API_URL}/api/emergency`);
      console.log('📡 [API REQUEST]: POST /api/emergency', payload);

      const result = await safeFetch(`${API_URL}/api/emergency`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (result?.success === false) {
        console.error('🔴 [SOS] Creation failed:', result.error);
        set({ error: result.error || 'Failed to connect to command center.' });
        return result;
      }

      const data = result;
      console.log('📥 [API RESPONSE]:', data);
      set({
        id: data.id,
        status: 'SEARCHING',
        startTime,
        location: { latitude, longitude },
        officer: null,
        error: null,
      });
      return data;
    },

    setLocation: (location) => {
      set({ location });
    },

    updateStatus: (status) => set({ status }),

    cancelEmergency: async () => {
      const id = get().id;
      if (id) {
        try {
          await setDoc(doc(db, 'emergencies', id), {
            status: 'CANCELLED',
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch { /* ignore */ }
      }
      console.log('🚫 [CITIZEN MODAL CLOSED] Emergency cancelled');
      get().reset();
    },

    syncWithFirestore: () => {
      const id = get().id;
      if (!id) return () => {};

      console.log('📡 [CITIZEN SYNC] Starting Realtime Sync for:', id);

      const unsub = onSnapshot(doc(db, 'emergencies', id), (docSnap) => {
        if (!docSnap.exists()) {
          console.log('🧹 [CITIZEN RESET] Emergency not found — resetting');
          get().reset();
          return;
        }

        const data = docSnap.data();
        const status = data.status?.toLowerCase();

        if (status === 'resolved' || status === 'cancelled' || status === 'completed') {
          console.log('🛑 [CITIZEN SYNC] Terminal state reached:', status);
          set({ status: (status === 'cancelled') ? 'CANCELLED' : 'COMPLETED', location: null });
          return;
        }

        if (status === 'arrived' || status === 'assigned' || status === 'enroute') {
          set({
            status: status === 'enroute' ? 'EN_ROUTE' : status.toUpperCase() as EmergencyStatus,
            officer: {
              id: data.assignedOfficerId || 'OFF-123',
              name: data.officerName || 'Officer Response Team',
              badge: data.officerBadge || 'OFF-9921',
              phone: data.officerPhone || '+1 555-0123',
              latitude: data.officerLat || 0,
              longitude: data.officerLng || 0,
              eta: data.eta || 'Calculating...',
            }
          });
        }
      });

      // PHASE 1: PUSH LIVE GPS UPDATES
      const gpsInterval = setInterval(async () => {
        const { location, status } = get();
        if (location && !TERMINAL_STATUSES.includes(status)) {
          try {
            await setDoc(doc(db, 'emergencies', id), {
              latitude: location.latitude,
              longitude: location.longitude,
              updatedAt: serverTimestamp()
            }, { merge: true });
          } catch (err) {
            console.error('🛰️ [GPS PUSH ERROR]', err);
          }
        }
      }, 5000);

      return () => {
        unsub();
        clearInterval(gpsInterval);
      };
    }
  })
);

// Helper function for assignment logic
async function findAndAssignOfficer(emergencyId: string, location: { lat: number; lng: number }) {
  try {
    const officersRef = collection(db, 'officers');
    const q = query(officersRef, where('active', '==', true));
    const querySnapshot = await getDocs(q);
    
    let closestOfficer: any = null;
    let minDistance = Infinity;

    querySnapshot.forEach((docSnap) => {
      const officer = docSnap.data();
      const dist = calculateDistance(
        location.lat,
        location.lng,
        officer.lat,
        officer.lng
      );
      
      if (dist < minDistance && dist <= 3) {
        minDistance = dist;
        closestOfficer = { id: docSnap.id, ...officer };
      }
    });

    if (closestOfficer) {
      console.log('🎯 AUTO-ASSIGNED OFFICER:', closestOfficer.id);
      await setDoc(doc(db, 'emergencies', emergencyId), {
        status: 'ASSIGNED',
        assignedOfficerId: closestOfficer.id,
        officerName: closestOfficer.name,
        officerBadge: closestOfficer.badge || 'OFF-9921',
        officerLat: closestOfficer.lat,
        officerLng: closestOfficer.lng,
        distanceKm: minDistance,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      return true;
    }
    return false;
  } catch (error) {
    console.error('🔴 AUTO-ASSIGNMENT FAILED:', error);
    return false;
  }
}
