/**
 * Centralized route fetching service using OSRM with fallbacks and caching.
 * Handles debouncing, caching, abort control, and movement thresholds.
 */
import { distanceMeters } from './animateMarker';

export interface RouteData {
  coordinates: [number, number][]; // [lat, lng] pairs for Leaflet
  duration: number; // seconds
  distance: number; // meters
  eta: string; // formatted ETA string
  distanceText: string; // formatted distance string
  nextStep: string; // next maneuver instruction
  raw: any; // raw OSRM route object
}

interface RouteFetchState {
  lastOfficerLat: number;
  lastOfficerLng: number;
  lastCitizenLat: number;
  lastCitizenLng: number;
  lastFetchTime: number;
  abortController: AbortController | null;
  intervalId: any | null;
  cachedRoute: RouteData | null;
}

const MOVEMENT_THRESHOLD_M = 30; // Reduced threshold for better road responsiveness
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

// Client-side persistent cache (in-memory)
// Client-side persistent cache (in-memory)
const ROUTE_CACHE = new Map<string, { data: RouteData; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds
const MAX_CACHE_SIZE = 50;

function cleanupCache() {
  const now = Date.now();
  
  // 1. Remove expired entries
  for (const [key, value] of ROUTE_CACHE.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      ROUTE_CACHE.delete(key);
    }
  }

  // 2. If still too large, remove oldest (FIFO-ish since Map maintains order)
  if (ROUTE_CACHE.size > MAX_CACHE_SIZE) {
    const keysToDelete = Array.from(ROUTE_CACHE.keys()).slice(0, ROUTE_CACHE.size - MAX_CACHE_SIZE);
    keysToDelete.forEach(k => ROUTE_CACHE.delete(k));
  }
}

function getAdaptiveDelay(distanceM: number): number {
  if (distanceM > 2000) return 8000; // 8s if >2km
  if (distanceM > 500) return 4000;  // 4s if >500m
  return 2500;                      // 2.5s if close
}

function getCacheKey(lat1: number, lng1: number, lat2: number, lng2: number) {
  return `${lat1.toFixed(4)},${lng1.toFixed(4)}->${lat2.toFixed(4)},${lng2.toFixed(4)}`;
}

function parseRoute(route: any): RouteData {
  const coords: [number, number][] = route.geometry.coordinates.map(
    (c: [number, number]) => [c[1], c[0]]
  );

  const durationMin = Math.round(route.duration / 60);
  const distanceKm = (route.distance / 1000).toFixed(1);
  const nextStep =
    route.legs?.[0]?.steps?.[0]?.maneuver?.instruction || 'Proceed to target';

  return {
    coordinates: coords,
    duration: route.duration,
    distance: route.distance,
    eta: durationMin <= 0 ? '< 1 MIN' : `${durationMin} MIN`,
    distanceText: `${distanceKm} KM`,
    nextStep,
    raw: route,
  };
}

export function createRouteService() {
  const state: RouteFetchState = {
    lastOfficerLat: 0,
    lastOfficerLng: 0,
    lastCitizenLat: 0,
    lastCitizenLng: 0,
    lastFetchTime: 0,
    abortController: null,
    intervalId: null,
    cachedRoute: null,
  };

  let onRouteUpdate: ((route: RouteData | null) => void) | null = null;
  let onLoadingChange: ((loading: boolean) => void) | null = null;

  let currentOfficerLat = 0;
  let currentOfficerLng = 0;
  let currentCitizenLat = 0;
  let currentCitizenLng = 0;

  async function fetchRoute(force: boolean = false): Promise<RouteData | null> {
    if (!currentOfficerLat || !currentOfficerLng || !currentCitizenLat || !currentCitizenLng) {
      return state.cachedRoute;
    }

    if (!force && state.lastOfficerLat !== 0) {
      const officerMoved = distanceMeters(state.lastOfficerLat, state.lastOfficerLng, currentOfficerLat, currentOfficerLng);
      const citizenMoved = distanceMeters(state.lastCitizenLat, state.lastCitizenLng, currentCitizenLat, currentCitizenLng);
      if (officerMoved < MOVEMENT_THRESHOLD_M && citizenMoved < MOVEMENT_THRESHOLD_M) {
        return state.cachedRoute;
      }
    }

    const cacheKey = getCacheKey(currentOfficerLat, currentOfficerLng, currentCitizenLat, currentCitizenLng);
    const cached = ROUTE_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      state.cachedRoute = cached.data;
      onRouteUpdate?.(cached.data);
      return cached.data;
    }

    if (state.abortController) state.abortController.abort();
    state.abortController = new AbortController();

    onLoadingChange?.(true);

    try {
      const url = `${OSRM_BASE}/${currentOfficerLng},${currentOfficerLat};${currentCitizenLng},${currentCitizenLat}?overview=full&geometries=geojson&steps=true&annotations=true`;

      const res = await fetch(url, { signal: state.abortController.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();

      if (data.routes?.[0]) {
        const route = parseRoute(data.routes[0]);
        state.cachedRoute = route;
        state.lastOfficerLat = currentOfficerLat;
        state.lastOfficerLng = currentOfficerLng;
        state.lastCitizenLat = currentCitizenLat;
        state.lastCitizenLng = currentCitizenLng;
        state.lastFetchTime = Date.now();

        cleanupCache(); // Cleanup before adding new entry
        ROUTE_CACHE.set(cacheKey, { data: route, timestamp: Date.now() });

        onRouteUpdate?.(route);
        onLoadingChange?.(false);
        return route;
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('🟠 [ROUTE SERVICE] OSRM Fetch failed:', e.message);
      }
    }

    onLoadingChange?.(false);
    return state.cachedRoute;
  }

  return {
    updatePositions(lat1: number, lng1: number, lat2: number, lng2: number) {
      currentOfficerLat = lat1;
      currentOfficerLng = lng1;
      currentCitizenLat = lat2;
      currentCitizenLng = lng2;
    },

    start(onRoute: (r: RouteData | null) => void, onLoading: (l: boolean) => void) {
      onRouteUpdate = onRoute;
      onLoadingChange = onLoading;
      fetchRoute(true);

      const fetchLoop = async () => {
        if (state.intervalId === null) return;
        await fetchRoute(false);
        const delay = getAdaptiveDelay(state.cachedRoute?.distance || 1000);
        state.intervalId = setTimeout(fetchLoop, delay);
      };

      state.intervalId = setTimeout(fetchLoop, 3000);
    },

    stop() {
      if (state.intervalId) {
        clearTimeout(state.intervalId);
        state.intervalId = null;
      }
      if (state.abortController) {
        state.abortController.abort();
        state.abortController = null;
      }
      onRouteUpdate = null;
      onLoadingChange = null;
    }
  };
}
