import { create } from 'zustand';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';
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
  location: { lat: number; lng: number } | null;
  lastGPSUpdate: number;
  officer: {
    id?: string;
    name: string;
    badge: string;
    phone: string;
    lat: number;
    lng: number;
    eta: string;
  } | null;
  error: string | null;
  
  // Actions
  startCountdown: () => void;
  triggerSOS: (citizenName: string, citizenId: string) => Promise<any>;
  setLocation: (location: { lat: number; lng: number }) => void;
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
        latitude = storeLocation?.lat || 0;
        longitude = storeLocation?.lng || 0;
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
        location: { lat: latitude, lng: longitude },
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
      if (!id) {
        console.log('⚠️ [CITIZEN SYNC] No active SOS ID — skipping polling');
        return () => {};
      }

      console.log('📡 [CITIZEN SYNC] Starting polling for:', id);

      const interval = setInterval(async () => {
        const currentStatus = get().status;

        // Stop polling if we've reached a terminal state
        if (TERMINAL_STATUSES.includes(currentStatus)) {
          console.log('🛑 [CITIZEN SYNC] Terminal state reached, stopping polling:', currentStatus);
          clearInterval(interval);
          return;
        }

        const { ok, data, status } = await safeFetch(`${API_URL}/api/emergency/${id}`);

        if (!ok) {
          if (status === 404) {
            console.log('🧹 [CITIZEN RESET] Emergency not found on backend — resetting');
            get().reset();
            clearInterval(interval);
          }
          return;
        }

        if (!data || !data.status) {
          console.log('🧹 [CITIZEN RESET] Empty API response — closing modal');
          get().reset();
          clearInterval(interval);
          return;
        }

        if (data.status === 'resolved' || data.status === 'cancelled') {
          console.log('🛑 [CITIZEN SYNC] Backend reports resolved/cancelled — completing');
          set({ status: data.status === 'resolved' ? 'COMPLETED' : 'CANCELLED' });
          clearInterval(interval);
          return;
        }

        if (data.status === 'assigned' || data.status === 'enroute' || data.status === 'arrived') {
          console.log('🚔 [CITIZEN ACTIVE SOS FOUND] Officer responding:', data.status);
          set({
            status: data.status.toUpperCase() as EmergencyStatus,
            officer: {
              id: data.assignedOfficerId || 'OFF-123',
              name: data.officerName || 'Officer Response Team',
              badge: data.officerBadge || 'OFF-9921',
              phone: '+1 555-0123',
              lat: data.officerLat || (data.location?.lat || 0) + 0.005,
              lng: data.officerLng || (data.location?.lng || 0) + 0.005,
              eta: '4 Min',
            }
          });
        }
      }, 3000);

      return () => {
        console.log('🛑 [CITIZEN SYNC] Cleanup — clearing polling interval');
        clearInterval(interval);
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
