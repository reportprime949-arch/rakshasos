import { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useOfficerStore } from '@/store/useOfficerStore';
import { io, Socket } from 'socket.io-client';

export const useOfficerLocation = (officerId: string, name: string) => {
  const { isOnline } = useOfficerStore();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com';
    console.log('🛰️ [GPS SOCKET] Connecting to:', API_URL);
    socketRef.current = io(API_URL, { 
      transports: ['websocket', 'polling'],
      reconnection: true 
    });
    
    socketRef.current.on('connect_error', (err) => {
      console.warn('🛰️ [GPS SOCKET ERROR]', err.message);
    });

    return () => { socketRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
    if (!isOnline) return;

    const mockCoords = { lat: 17.3850, lng: 78.4867 };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLoc = { lat: latitude, lng: longitude };
        setLocation(newLoc);
        setLocationError(null);
        
        if (socketRef.current?.connected) {
          socketRef.current.emit('officer:location_update', {
            officerId,
            ...newLoc,
            timestamp: Date.now()
          });
        }
      },
      (error) => {
        console.warn('🛰️ [GPS ERROR]', error.message);
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location permission denied.");
        } else {
          setLocationError("Location unavailable.");
        }
        setLocation(mockCoords);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline, officerId]);

  useEffect(() => {
    if (!isOnline || !location) return;

    const updateFirestore = async () => {
      try {
        await setDoc(doc(db, 'officers', officerId), {
          officerId,
          name,
          lat: location.lat,
          lng: location.lng,
          active: true,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        console.log('🛰️ [GPS] Synced to Firestore');
      } catch {
        console.error('🛰️ [GPS] Firestore sync failed');
      }
    };

    // Throttle Firestore updates to every 10 seconds to save battery/quota
    const interval = setInterval(updateFirestore, 10000);
    updateFirestore();

    return () => clearInterval(interval);
  }, [isOnline, location, officerId, name]);

  return { location, locationError };
};
