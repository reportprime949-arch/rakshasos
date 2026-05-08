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

        const currentLocation = get().location;

        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com'}/api/sos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              citizenName,
              emergencyType: 'SOS Triggered',
              location: currentLocation || { lat: 0, lng: 0 }
            })
          });

          const data = await response.json();

          set({
            id: data.id,
            status: 'SEARCHING',
            startTime,
            officer: null,
            error: null
          });

        } catch (error) {
          console.error('🔴 SOS CREATION FAILED:', error);
          set({ error: 'Failed to connect to command center.' });
        }
      },

      setLocation: async (location) => {
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
          } catch (e) {}
        }
        get().reset();
      },

      syncWithFirestore: () => {
        const id = get().id;
        if (!id) return () => {};

        console.log('📡 SYNCING WITH API (Polling):', id);

        const interval = setInterval(async () => {
          try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com'}/api/sos/${id}`);
            const data = await response.json();

            if (data && data.status) {
              if (data.status === 'assigned' || data.status === 'enroute' || data.status === 'arrived') {
                set({
                  status: data.status.toUpperCase() as EmergencyStatus,
                  officer: {
                    id: 'OFF-123',
                    name: 'Officer Response Team',
                    badge: 'OFF-9921',
                    phone: '+1 555-0123',
                    lat: data.location.lat + 0.005, // Mock officer movement
                    lng: data.location.lng + 0.005,
                    eta: '4 Min',
                  }
                });
              } else if (data.status === 'resolved') {
                set({ status: 'COMPLETED' });
              }
            }
          } catch (error) {
            console.error('Polling error:', error);
          }
        }, 3000);

        return () => clearInterval(interval);
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
