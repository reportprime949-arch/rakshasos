import { useState, useEffect } from 'react';
import { gpsManager, GPSState } from '@/utils/GeolocationManager';

interface LocationState {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
  error: string | null;
  loading: boolean;
  permissionStatus: PermissionState | 'unknown';
  gpsState: GPSState;
}

export const useGeolocation = () => {
  const [state, setState] = useState<LocationState>(() => {
    const last = gpsManager.getLastKnownLocation();
    return {
      coords: last?.coords || null,
      error: null,
      loading: !last,
      permissionStatus: 'unknown',
      gpsState: last?.state || 'searching',
    };
  });

  useEffect(() => {
    let permResult: PermissionStatus | null = null;

    // Check initial permission if possible
    if (typeof window !== 'undefined' && 'permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          permResult = result;
          setState(prev => ({ ...prev, permissionStatus: result.state }));
          result.onchange = () => {
            setState(prev => ({ ...prev, permissionStatus: result.state }));
          };
        })
        .catch(() => {});
    }

    const unsubscribe = gpsManager.subscribe((update) => {
      setState((prev) => ({
        ...prev,
        coords: update.coords,
        gpsState: update.state,
        loading: false,
        error: update.state === 'error' || update.state === 'denied' ? 'GPS Error' : null,
      }));
    });

    return () => {
      unsubscribe();
      if (permResult) {
        permResult.onchange = null;
      }
    };
  }, []);

  return {
    ...state,
    openSettings: () => alert('Please enable location in your browser settings to continue.'),
  };
};
