import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot, serverTimestamp, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { calculateDistance } from '@/utils/distance';

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
  triggerSOS: (citizenName: string, citizenId: string) => Promise<void>;
  setLocation: (location: { lat: number; lng: number }) => void;
  updateStatus: (status: EmergencyStatus) => void;
  assignOfficer: (officer: any) => void;
  cancelEmergency: () => void;
  syncWithFirestore: () => () => void;
  reset: () => void;
}

export const useEmergencyStore = create<EmergencyState>()(
  persist(
    (set, get) => ({
      id: null,
      status: 'IDLE',
      startTime: null,
      location: null,
      lastGPSUpdate: 0,
      officer: null,
      error: null,

      reset: () => set({ 
        id: null, 
        status: 'IDLE', 
        officer: null, 
        location: null, 
        startTime: null,
        error: null 
      }),

      startCountdown: () => set({ status: 'COUNTDOWN' }),

      assignOfficer: (officer) => set({ officer, status: 'ASSIGNED' }),

      triggerSOS: async (citizenName, citizenId) => {
        const id = `SOS-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        const startTime = Date.now();
        
        console.log('🚨 TRIGGERING SOS:', id);

        set({
          id,
          status: 'SEARCHING',
          startTime,
          officer: null,
          error: null
        });

        const currentLocation = get().location;

        try {
          // 1. Create the emergency document
          await setDoc(doc(db, 'emergencies', id), {
            id,
            citizenId,
            citizenName,
            status: 'SEARCHING',
            lat: currentLocation?.lat || 0,
            lng: currentLocation?.lng || 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            assignedOfficerId: null,
          }, { merge: true });

          // 2. Immediate search for officers
          if (currentLocation) {
            await findAndAssignOfficer(id, currentLocation);
          }

          // 3. Set a timeout for retry/failure
          setTimeout(async () => {
            const currentStatus = get().status;
            if (currentStatus === 'SEARCHING') {
              console.log('🔄 RETRYING OFFICER SEARCH...');
              const latestLocation = get().location;
              if (latestLocation) {
                await findAndAssignOfficer(id, latestLocation);
              }
              
              // Second timeout for final failure
              setTimeout(() => {
                if (get().status === 'SEARCHING') {
                  console.log('❌ NO OFFICERS FOUND');
                  set({ error: 'NO OFFICERS AVAILABLE. RETRYING...' });
                }
              }, 15000);
            }
          }, 5000);

        } catch (error) {
          console.error('🔴 SOS CREATION FAILED:', error);
          set({ error: 'Failed to connect to command center.' });
        }
      },

      setLocation: async (location) => {
        const prevLocation = get().location;
        set({ location });
        
        const id = get().id;
        const now = Date.now();
        if (id && (!prevLocation || (now - get().lastGPSUpdate > 5000))) {
          try {
            await setDoc(doc(db, 'emergencies', id), {
              lat: location.lat,
              lng: location.lng,
              updatedAt: serverTimestamp(),
            }, { merge: true });
            set({ lastGPSUpdate: now });
          } catch (e) {}
        }
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
          } catch (e) {}
        }
        get().reset();
      },

      syncWithFirestore: () => {
        const id = get().id;
        if (!id) return () => {};

        console.log('📡 SYNCING WITH FIRESTORE:', id);

        const unsub = onSnapshot(doc(db, 'emergencies', id), (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data();
            console.log('📥 FIRESTORE UPDATE:', data.status, data.assignedOfficerId);
            
            if (data.status === 'ASSIGNED' || data.status === 'EN_ROUTE' || data.status === 'ARRIVED') {
              set({
                status: data.status as EmergencyStatus,
                officer: {
                  id: data.assignedOfficerId,
                  name: data.officerName || 'Scanning Matrix...',
                  badge: data.officerBadge || 'OFF-9921',
                  phone: data.officerPhone || '+1 555-0123',
                  lat: data.officerLat || (get().location?.lat || 0),
                  lng: data.officerLng || (get().location?.lng || 0),
                  eta: data.eta || 'Calculating...',
                }
              });
            } else if (data.status === 'COMPLETED') {
              set({ status: 'COMPLETED' });
            } else if (data.status === 'CANCELLED') {
              get().reset();
            }
          }
        });

        return unsub;
      }
    }),
    {
      name: 'rakshasos-emergency-session',
    }
  )
);

// Helper function for assignment logic
async function findAndAssignOfficer(emergencyId: string, location: { lat: number; lng: number }) {
  try {
    const officersRef = collection(db, 'officers');
    const q = query(officersRef, where('active', '==', true));
    const querySnapshot = await getDocs(q);
    
    let closestOfficer: any = null;
    let minDistance = Infinity;

    querySnapshot.forEach((doc) => {
      const officer = doc.data();
      const dist = calculateDistance(
        location.lat,
        location.lng,
        officer.lat,
        officer.lng
      );
      
      if (dist < minDistance && dist <= 3) {
        minDistance = dist;
        closestOfficer = { id: doc.id, ...officer };
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
