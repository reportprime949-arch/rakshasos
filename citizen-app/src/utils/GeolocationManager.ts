import { distanceMeters } from './animateMarker';

export type GPSState = 'searching' | 'locked' | 'weak' | 'denied' | 'error';

interface LocationUpdate {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  };
  state: GPSState;
}

type Listener = (update: LocationUpdate) => void;

class GeolocationManager {
  private static instance: GeolocationManager;
  private watchId: number | null = null;
  private listeners: Set<Listener> = new Set();
  private lastUpdate: LocationUpdate | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private isForeground: boolean = true;
  
  private readonly WATCHDOG_TIMEOUT = 15000; // 15s without update = freeze
  private readonly MIN_ACCURACY = 100; // 100m
  private readonly CACHE_KEY = 'rakshasos_gps_v2';

  private isVisibilityListenerSetup: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      this.loadCache();
      this.setupVisibilityListener();
    }
  }

  public static getInstance(): GeolocationManager {
    if (!GeolocationManager.instance) {
      GeolocationManager.instance = new GeolocationManager();
    }
    return GeolocationManager.instance;
  }

  private loadCache() {
    try {
      const cached = localStorage.getItem(this.CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Only use if less than 5 minutes old
        if (Date.now() - parsed.coords.timestamp < 300000) {
          this.lastUpdate = parsed;
        }
      }
    } catch (e) {
      console.error('[GPS Manager] Cache load failed', e);
    }
  }

  private lastRestartTime: number = 0;
  private readonly MIN_RESTART_INTERVAL = 10000; // 10s between restarts

  private saveCache(update: LocationUpdate) {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(update));
    } catch (e) { /* ignore */ }
  }

  private setupVisibilityListener() {
    if (this.isVisibilityListenerSetup) return;
    
    document.addEventListener('visibilitychange', () => {
      this.isForeground = document.visibilityState === 'visible';
      console.log(`[GPS Manager] Visibility changed: ${this.isForeground ? 'Foreground' : 'Background'}`);
      
      // Only restart if foreground and we've lost tracking or it's been a while
      if (this.isForeground && this.listeners.size > 0 && !this.watchId) {
        this.restart('visibility_regained');
      }
    });
    this.isVisibilityListenerSetup = true;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.lastUpdate) listener(this.lastUpdate);
    
    if (this.listeners.size === 1) {
      this.start();
    }

    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.stop();
      }
    };
  }

  private start() {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      this.emitError('GPS Not Supported');
      return;
    }

    if (this.watchId !== null) return;

    console.log('[GPS Manager] Starting watchPosition');
    
    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000, // Force fresh data
    };

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          try { this.handleSuccess(pos); } 
          catch (e) { console.warn('[GPS Manager] Success handler failed', e); }
        },
        (err) => {
          try { this.handleError(err); }
          catch (e) { console.warn('[GPS Manager] Error handler failed', e); }
        },
        options
      );
    } catch (e) {
      console.error('[GPS Manager] watchPosition critical failure', e);
      this.scheduleRetry();
    }

    this.resetWatchdog();
  }

  private stop() {
    if (this.watchId !== null) {
      console.log('[GPS Manager] Stopping watchPosition');
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.clearTimers();
  }

  private restart(reason: string) {
    const now = Date.now();
    if (now - this.lastRestartTime < this.MIN_RESTART_INTERVAL) {
      console.warn(`[GPS Manager] Skipping restart (${reason}), too soon since last restart`);
      return;
    }
    
    // Don't restart if backgrounded unless critical
    if (!this.isForeground && reason !== 'watchdog_timeout_freeze') {
       return;
    }

    console.log(`[GPS Manager] Restarting due to: ${reason}`);
    this.lastRestartTime = now;
    this.stop();
    this.start();
  }

  private resetWatchdog() {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    this.watchdogTimer = setTimeout(() => {
      // Only watchdog restart if we actually have listeners and we are in foreground
      if (this.listeners.size > 0 && this.isForeground) {
        this.restart('watchdog_timeout_freeze');
      }
    }, this.WATCHDOG_TIMEOUT);
  }

  private clearTimers() {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.watchdogTimer = null;
    this.retryTimer = null;
  }

  private handleSuccess(pos: GeolocationPosition) {
    this.resetWatchdog();
    
    const { latitude, longitude, accuracy } = pos.coords;
    const timestamp = Date.now();
    
    // Accuracy filtering
    const isWeak = accuracy > this.MIN_ACCURACY;
    const state: GPSState = isWeak ? 'weak' : 'locked';

    // Optimization: Skip if update is too similar and within a short timeframe (1s)
    if (this.lastUpdate && timestamp - this.lastUpdate.coords.timestamp < 1000) {
      const dist = distanceMeters(
        this.lastUpdate.coords.latitude, 
        this.lastUpdate.coords.longitude, 
        latitude, 
        longitude
      );
      if (dist < 1) return; // Haven't moved meaningfully in <1s
    }

    const update: LocationUpdate = {
      coords: { latitude, longitude, accuracy, timestamp },
      state
    };

    this.lastUpdate = update;
    this.saveCache(update);
    this.notifyListeners(update);
  }

  private handleError(err: GeolocationPositionError) {
    if (err.code === err.TIMEOUT) {
      console.warn('[GPS Manager] GPS timeout — retrying silently');
      return; // Watchdog will handle it if it persists
    }

    if (err.code === err.PERMISSION_DENIED) {
      console.warn('[GPS Manager] Permission denied');
      this.stop(); // Don't retry if denied
      const errorUpdate: LocationUpdate = {
        coords: this.lastUpdate?.coords || { latitude: 0, longitude: 0, accuracy: 999, timestamp: Date.now() },
        state: 'denied'
      };
      this.notifyListeners(errorUpdate);
      return;
    }

    console.warn(`[GPS Manager] Non-fatal GPS issue (${err.code}): ${err.message}`);
    this.scheduleRetry();

    const errorUpdate: LocationUpdate = {
      coords: this.lastUpdate?.coords || { latitude: 0, longitude: 0, accuracy: 999, timestamp: Date.now() },
      state: 'error'
    };
    
    this.notifyListeners(errorUpdate);
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.listeners.size > 0) this.restart('retry_after_error');
    }, 5000);
  }

  private emitError(msg: string) {
    this.notifyListeners({
      coords: { latitude: 0, longitude: 0, accuracy: 0, timestamp: Date.now() },
      state: 'error'
    });
  }

  private notifyListeners(update: LocationUpdate) {
    this.listeners.forEach(l => l(update));
  }

  public getLastKnownLocation() {
    return this.lastUpdate;
  }

  public simulateLocation(latitude: number, longitude: number) {
    console.log(`[GPS Manager] 🛡️ SIMULATING LOCATION: ${latitude}, ${longitude}`);
    this.stop(); // Stop real tracking
    
    const update: LocationUpdate = {
      coords: { 
        latitude, 
        longitude, 
        accuracy: 10, 
        timestamp: Date.now() 
      },
      state: 'locked'
    };

    this.lastUpdate = update;
    this.notifyListeners(update);
  }
}


export const gpsManager = GeolocationManager.getInstance();
