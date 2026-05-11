import L from 'leaflet';

interface AnimationState {
  frameId: number | null;
  startTime: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
}

const activeAnimations = new WeakMap<L.Marker, AnimationState>();

export function animateMarkerTo(
  marker: L.Marker,
  newLat: number,
  newLng: number,
  duration: number = 500
): void {
  if (!marker || !newLat || !newLng) return;

  const existing = activeAnimations.get(marker);
  if (existing?.frameId) {
    cancelAnimationFrame(existing.frameId);
  }

  const currentPos = marker.getLatLng();
  const startLat = currentPos.lat;
  const startLng = currentPos.lng;

  if (
    Math.abs(startLat - newLat) < 0.00001 &&
    Math.abs(startLng - newLng) < 0.00001
  ) {
    return;
  }

  const state: AnimationState = {
    frameId: null,
    startTime: performance.now(),
    startLat,
    startLng,
    endLat: newLat,
    endLng: newLng,
  };

  activeAnimations.set(marker, state);

  function step(timestamp: number) {
    const elapsed = timestamp - state.startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    const lat = state.startLat + (state.endLat - state.startLat) * eased;
    const lng = state.startLng + (state.endLng - state.startLng) * eased;

    marker.setLatLng([lat, lng]);

    if (progress < 1) {
      state.frameId = requestAnimationFrame(step);
    } else {
      state.frameId = null;
      activeAnimations.delete(marker);
    }
  }

  state.frameId = requestAnimationFrame(step);
}

export function cancelMarkerAnimation(marker: L.Marker): void {
  const state = activeAnimations.get(marker);
  if (state?.frameId) {
    cancelAnimationFrame(state.frameId);
    activeAnimations.delete(marker);
  }
}

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
