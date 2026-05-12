import { create } from 'zustand';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { calculateDistance } from '@/utils/distance';
import { distanceMeters } from '@/utils/animateMarker';
import { gpsManager } from '@/utils/GeolocationManager';
import { API_URL } from '@/lib/api';


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
  isTriggering: boolean;
  error: string | null;

  // Actions
  startCountdown: () => void;
  triggerSOS: (citizenName: string, citizenId: string) => Promise<any>;
  checkActiveEmergency: () => Promise<void>;
  setLocation: (location: { latitude: number; longitude: number }) => void;
  updateStatus: (status: EmergencyStatus) => void;
  assignOfficer: (officer: any) => void;
  cancelEmergency: () => void;
  syncWithFirestore: () => () => void;
  reset: () => void;
}

const TERMINAL_STATUSES: EmergencyStatus[] = ['IDLE', 'COMPLETED', 'CANCELLED'];
let lastPushedLat = 0;
let lastPushedLng = 0;
let activeSyncId: string | null = null;

export const useEmergencyStore = create<EmergencyState>()(
  (set, get) => ({
    id: null,
    status: 'IDLE',
    startTime: null,
    location: null,
    lastGPSUpdate: 0,
    officer: null,
    isTriggering: false,
    error: null,

    checkActiveEmergency: async () => {
      // Logic removed as per "No auto-restore" requirement.
      // Every refresh starts fresh to prevent Ghost SOS bugs.
      console.log('🚫 [RECOVERY] Auto-recovery disabled to prevent Ghost SOS.');
    },

    reset: () => {
      console.log('🧹 [CITIZEN RESET] Clearing all states and caches');
      lastPushedLat = 0;
      lastPushedLng = 0;
      activeSyncId = null;
      try {
        // Clear all possible session markers
        localStorage.removeItem('rakshasos_active_id');
        localStorage.removeItem('rakshasos-emergency-session');
        localStorage.removeItem('emergency-storage');
        sessionStorage.clear();
      } catch { /* SSR */ }
      set({ 
        id: null, 
        status: 'IDLE', 
        officer: null, 
        location: null, 
        startTime: null, 
        error: null, 
        isTriggering: false 
      });
    },

    startCountdown: () => set({ status: 'COUNTDOWN' }),

    assignOfficer: (officer) => set({ officer, status: 'ASSIGNED' }),

    triggerSOS: async (citizenName, citizenId) => {
      if (get().isTriggering || get().id) {
        console.warn('⚠️ [SOS] Trigger already in progress or SOS active. Ignoring duplicate call.');
        return { success: true, id: get().id };
      }

      set({ isTriggering: true, error: null });

      console.log('══════════════════════════════════════════');
      console.log('🚨 [SOS] BUTTON CLICKED — Starting Emergency Pipeline');
      console.log('══════════════════════════════════════════');
      console.log('🚨 [SOS] citizenName:', citizenName);
      console.log('🚨 [SOS] citizenId:', citizenId);
      console.log('🚨 [SOS] timestamp:', new Date().toISOString());

      const startTime = Date.now();
      let latitude = 0;
      let longitude = 0;

      // ── STEP 1: Acquire GPS coordinates ──
      try {
        console.log('📍 [SOS] Step 1: Fetching high-accuracy GPS fix...');
        const lastKnown = gpsManager.getLastKnownLocation();
        if (lastKnown && Date.now() - lastKnown.coords.timestamp < 10000) {
          // Use high-quality recent cache
          latitude = lastKnown.coords.latitude;
          longitude = lastKnown.coords.longitude;
          console.log('📍 [SOS] GPS from cache:', latitude, longitude);
        } else {
          // Fallback to quick check
          console.log('📍 [SOS] No recent cache, requesting fresh GPS...');
          const freshCoords = await Promise.race([
            new Promise<GeolocationPosition>((resolve, reject) => {
              if (typeof window === 'undefined' || !navigator.geolocation) return reject(new Error('No GPS'));
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true, timeout: 3000, maximumAge: 0
              });
            }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 3500))
          ]) as GeolocationPosition;
          latitude = freshCoords.coords.latitude;
          longitude = freshCoords.coords.longitude;
          console.log('📍 [SOS] GPS from fresh fix:', latitude, longitude);
        }
      } catch (err) {
        console.warn('⚠️ [SOS] GPS acquisition failed, using store location:', err);
        const storeLocation = get().location;
        latitude = storeLocation?.latitude || 0;
        longitude = storeLocation?.longitude || 0;
      }

      if (latitude === 0 || longitude === 0) {
        console.error('❌ [SOS] FAILED: GPS signal unavailable — cannot trigger SOS');
        set({ error: 'Location required to trigger SOS.' });
        return { success: false, error: 'GPS unavailable' };
      }

      // ── STEP 2: Build payload ──
      const payload = {
        citizenId,
        citizenName,
        emergencyType: 'SOS Triggered',
        latitude,
        longitude,
        location: { lat: latitude, lng: longitude },
        timestamp: Date.now(),
        status: 'pending',
      };
      console.log('📦 [SOS] Step 2: Payload built:', JSON.stringify(payload));

      // ── STEP 3: POST to backend ──
      try {
        console.log('🌐 [SOS] Step 3: Sending POST to', `${API_URL}/api/emergency`);

        const controller = new AbortController();
        // 45s timeout — Render free tier cold starts can take 30s+
        const timeout = setTimeout(() => controller.abort(), 45000);

        const response = await fetch(`${API_URL}/api/emergency`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        console.log('📡 [SOS] Response status:', response.status, response.statusText);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          console.error('❌ [SOS] Backend rejected request:', response.status, errorText);
          set({ error: `Server error: ${response.status}` });
          return { success: false, error: `HTTP ${response.status}` };
        }

        const result = await response.json();
        console.log('✅ [SOS] Step 3 COMPLETE — Backend response:', JSON.stringify(result));

        if (result?.success && result?.id) {
          console.log('🎯 [SOS] Emergency created! ID:', result.id);

          // ── STEP 4: Update local state ──
          set({
            id: result.id,
            status: 'SEARCHING',
            startTime,
            location: { latitude, longitude },
            error: null,
            isTriggering: false,
          });
          console.log('💾 [SOS] Step 4: Local state updated — status=SEARCHING, id=' + result.id);

          // ── STEP 5: Socket emit for immediate broadcast (redundant safety) ──
          try {
            console.log('📡 [SOS] Step 5: Socket emit not needed — backend broadcasts automatically');
          } catch (socketErr) {
            console.warn('⚠️ [SOS] Socket emit failed (non-critical):', socketErr);
          }

          console.log('══════════════════════════════════════════');
          console.log('✅ [SOS] PIPELINE COMPLETE — Emergency', result.id, 'active');
          console.log('⏱️ [SOS] Total time:', Date.now() - startTime, 'ms');
          console.log('══════════════════════════════════════════');

          return result;
        } else {
          console.error('❌ [SOS] Backend response missing success/id:', result);
          set({ error: result?.error || 'Failed to create emergency.', isTriggering: false });
          return { success: false, error: result?.error || 'Invalid response' };
        }
      } catch (err: any) {
        console.error('══════════════════════════════════════════');
        console.error('❌ [SOS] CRITICAL ERROR in SOS pipeline');
        console.error('❌ [SOS] Error name:', err?.name);
        console.error('❌ [SOS] Error message:', err?.message);
        console.error('❌ [SOS] Stack:', err?.stack);
        console.error('══════════════════════════════════════════');
        set({ error: 'Network request failed. Check your connection.', isTriggering: false });
        return { success: false, error: err?.message || 'Network failure' };
      }
    },

    setLocation: (location) => {
      const current = get().location;
      if (current) {
        const moved = distanceMeters(current.latitude, current.longitude, location.latitude, location.longitude);
        if (moved < 5) return;
      }
      set({ location });
    },

    updateStatus: (status) => set({ status }),

    cancelEmergency: async () => {
      const id = get().id;
      if (id) {
        try { await setDoc(doc(db, 'emergencies', id), { status: 'CANCELLED', updatedAt: serverTimestamp() }, { merge: true }); } catch { /* ignore */ }
      }
      get().reset();
    },

    syncWithFirestore: () => {
      const id = get().id;
      if (!id || activeSyncId === id) return () => { };
      activeSyncId = id;
      console.log('🛰️ [STORE] Starting Firestore Sync for:', id);
      const unsub = onSnapshot(doc(db, 'emergencies', id), (docSnap) => {
        if (!docSnap.exists()) { get().reset(); return; }
        const data = docSnap.data();
        const status = data.status?.toLowerCase();
        if (status === 'resolved' || status === 'cancelled' || status === 'completed') {
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
      const gpsInterval = setInterval(async () => {
        const { location, status, id: currentId } = get();
        if (!currentId || TERMINAL_STATUSES.includes(status)) {
           console.log('🛑 [GPS PUSH] Terminal status or no ID — stopping interval');
           clearInterval(gpsInterval);
           return;
        }

        if (location) {
          const moved = distanceMeters(lastPushedLat, lastPushedLng, location.latitude, location.longitude);
          if (moved < 10 && lastPushedLat !== 0) return;
          lastPushedLat = location.latitude;
          lastPushedLng = location.longitude;
          try {
            await setDoc(doc(db, 'emergencies', id), { 
              latitude: location.latitude, 
              longitude: location.longitude, 
              updatedAt: serverTimestamp(),
              source: 'citizen-gps-sync'
            }, { merge: true });
          } catch (err) { console.error('🛰️ [GPS PUSH ERROR]', err); }
        }
      }, 5000);
      return () => {
        unsub();
        clearInterval(gpsInterval);
        if (activeSyncId === id) activeSyncId = null;
      };
    }
  })
);
