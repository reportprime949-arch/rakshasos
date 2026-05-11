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

/**
 * GeolocationManager — Singleton GPS tracker.
 *
 * Features:
 * - Single watchPosition per app
 * - Jump filtering (rejects >500m jumps with poor accuracy)
 * - Minimum movement threshold (5m) before notifying
 * - Notification throttle (3s)
 * - Watchdog timer restarts GPS if no update in 60s
 * - Auto-retry on error
 * - LocalStorage cache for fast startup
 */
class GeolocationManager {
  private static instance: GeolocationManager;
  private watchId: number | null = null;
  private listeners: Set<Listener> = new Set();
  private lastUpdate: LocationUpdate | null = null;
  private lastNotifiedUpdate: LocationUpdate | null = null;
  private watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly WATCHDOG_TIMEOUT = 60000;
  private readonly MIN_ACCURACY = 100;
  private readonly JUMP_THRESHOLD_M = 500;
  private readonly JUMP_ACCURACY_LIMIT = 50;
  private readonly MIN_MOVEMENT_M = 5;
  private readonly CACHE_KEY = 'rakshasos_officer_gps_v3';
  private lastNotificationTime = 0;
  private readonly NOTIFICATION_THROTTLE = 3000;

  private isVisibilityListenerSetup = false;

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
        if (Date.now() - parsed.coords.timestamp < 300000) {
          this.lastUpdate = parsed;
        }
      }
    } catch (e) {
      /* ignore */
    }
  }

  private saveCache(update: LocationUpdate) {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(update));
    } catch (e) {
      /* ignore */
    }
  }

  private setupVisibilityListener() {
    if (this.isVisibilityListenerSetup) return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.listeners.size > 0 && this.watchId === null) {
        this.start();
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
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    if (this.watchId !== null) return;

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 10000,
    };

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (pos) => this.handleSuccess(pos),
        (err) => this.handleError(err),
        options,
      );
      this.startWatchdog();
    } catch (e) {
      this.scheduleRetry();
    }
  }

  private stop() {
    if (this.watchId !== null) {
      try {
        navigator.geolocation.clearWatch(this.watchId);
      } catch (e) {
        /* ignore */
      }
      this.watchId = null;
    }
    this.clearTimers();
  }

  private restart() {
    this.stop();
    this.start();
  }

  private clearTimers() {
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private startWatchdog() {
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    this.watchdogTimer = setTimeout(() => {
      // No GPS update in 60s — restart
      if (this.listeners.size > 0) {
        this.restart();
      }
    }, this.WATCHDOG_TIMEOUT);
  }

  private handleSuccess(pos: GeolocationPosition) {
    const { latitude, longitude, accuracy } = pos.coords;
    const timestamp = Date.now();

    // Reset watchdog on every successful fix
    this.startWatchdog();

    // ----------------------------------------------------------
    // JUMP FILTER: Reject implausible jumps
    // ----------------------------------------------------------
    if (this.lastUpdate && accuracy > this.JUMP_ACCURACY_LIMIT) {
      const jumpDist = distanceMeters(
        this.lastUpdate.coords.latitude,
        this.lastUpdate.coords.longitude,
        latitude,
        longitude,
      );
      if (jumpDist > this.JUMP_THRESHOLD_M) {
        // Implausible jump with poor accuracy — reject
        return;
      }
    }

    const isWeak = accuracy > this.MIN_ACCURACY;
    const state: GPSState = isWeak ? 'weak' : 'locked';

    const update: LocationUpdate = {
      coords: { latitude, longitude, accuracy, timestamp },
      state,
    };

    this.lastUpdate = update;
    this.saveCache(update);

    // ----------------------------------------------------------
    // MOVEMENT + THROTTLE CHECK
    // ----------------------------------------------------------
    const now = timestamp;
    const timeSinceLastNotify = now - this.lastNotificationTime;

    if (timeSinceLastNotify < this.NOTIFICATION_THROTTLE) return;

    if (this.lastNotifiedUpdate) {
      const moved = distanceMeters(
        this.lastNotifiedUpdate.coords.latitude,
        this.lastNotifiedUpdate.coords.longitude,
        latitude,
        longitude,
      );
      if (moved < this.MIN_MOVEMENT_M) return;
    }

    this.lastNotificationTime = now;
    this.lastNotifiedUpdate = update;
    this.notifyListeners(update);
  }

  private handleError(err: GeolocationPositionError) {
    if (err.code === err.TIMEOUT) {
      // Timeout is non-fatal — watchdog will restart if needed
      return;
    }

    if (err.code === err.PERMISSION_DENIED) {
      this.stop();
      this.notifyListeners({
        coords: this.lastUpdate?.coords || {
          latitude: 0,
          longitude: 0,
          accuracy: 999,
          timestamp: Date.now(),
        },
        state: 'denied',
      });
      return;
    }

    this.scheduleRetry();
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.listeners.size > 0) this.restart();
    }, 10000);
  }

  private notifyListeners(update: LocationUpdate) {
    this.listeners.forEach((l) => l(update));
  }

  public getLastKnownLocation() {
    return this.lastUpdate;
  }
}

export const gpsManager = GeolocationManager.getInstance();
