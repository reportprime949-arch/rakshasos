import { useState, useEffect, useCallback, useRef } from 'react';

interface LocationState {
  coords: {
    latitude: number;
    longitude: number;
  } | null;
  error: string | null;
  loading: boolean;
  permissionStatus: PermissionState | 'unknown';
}

export const useGeolocation = () => {
  const [state, setState] = useState<LocationState>({
    coords: null,
    error: null,
    loading: true,
    permissionStatus: 'unknown',
  });

  const watchId = useRef<number | null>(null);
  const retryInterval = useRef<NodeJS.Timeout | null>(null);

  const updateLocation = useCallback((position: GeolocationPosition) => {
    setState((prev) => ({
      ...prev,
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      loading: false,
      error: null,
    }));
    // Stop retrying once we have a lock
    if (retryInterval.current) {
      clearInterval(retryInterval.current);
      retryInterval.current = null;
    }
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Location error.';
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'PERMISSION_DENIED';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'POSITION_UNAVAILABLE';
        break;
      case error.TIMEOUT:
        errorMessage = 'TIMEOUT';
        break;
    }
    setState((prev) => ({ ...prev, error: errorMessage, loading: false }));
  }, []);

  const startTracking = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setState(prev => ({ ...prev, loading: false, error: 'Geolocation not supported' }));
      return;
    }

    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
    }

    // PHASE 1: REQUIRED SETTINGS
    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    watchId.current = navigator.geolocation.watchPosition(updateLocation, handleError, options);
  }, [updateLocation, handleError]);

  // Aggressive retry logic
  const startAggressiveRetry = useCallback(() => {
    if (retryInterval.current) return;
    
    startTracking();
    retryInterval.current = setInterval(() => {
      if (!state.coords) {
        startTracking();
      }
    }, 3000);
  }, [startTracking, state.coords]);

  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setState((prev) => ({ ...prev, permissionStatus: result.state }));
        result.onchange = () => {
          setState((prev) => ({ ...prev, permissionStatus: result.state }));
          if (result.state === 'granted') startTracking();
        };
      });
    }

    startTracking();

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      if (retryInterval.current) clearInterval(retryInterval.current);
    };
  }, [startTracking]);

  const openSettings = () => {
    // Web simulation of deep linking to settings
    // In React Native, this would be Linking.openSettings()
    alert('Please go to your browser settings and enable location for this site.');
  };

  return { ...state, requestPermission: startTracking, startAggressiveRetry, openSettings };
};
