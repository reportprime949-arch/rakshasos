import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useOfficerStore } from '@/store/useOfficerStore';

export const useOfficerLocation = (officerId: string, name: string) => {
  const { isOnline } = useOfficerStore();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOnline) return;

    // Use mock coordinates for testing if location is blocked/unavailable
    const mockCoords = { lat: 17.3850, lng: 78.4867 };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lng: longitude });
        setLocationError(null);
      },
      (error) => {
        // Handle denied permissions or other errors gracefully
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Please allow location access to receive nearby emergencies.");
          // Fallback to mock coordinates for testing
          setLocation(mockCoords);
        } else {
          setLocationError("Location unavailable. Using default coordinates.");
          setLocation(mockCoords);
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 0 
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isOnline]);

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
          radiusKm: 3,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (error) {
        // Silently handle firestore errors
      }
    };

    const interval = setInterval(updateFirestore, 5000);
    updateFirestore();

    return () => clearInterval(interval);
  }, [isOnline, location, officerId, name]);

  return { location, locationError };
};
