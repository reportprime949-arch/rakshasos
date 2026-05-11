import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);
  
  // Cache for routes: emergencyId -> { routeData, timestamp }
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 5000; // 5 seconds
  
  // OpenRouteService API Key (can be provided via ENV)
  private readonly ORS_API_KEY = process.env.ORS_API_KEY || '';
  private readonly OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

  /**
   * Fetch route between two points.
   * Priority: OpenRouteService (if key provided) -> OSRM (fallback)
   */
  async getRoute(emergencyId: string, start: [number, number], end: [number, number]) {
    const cacheKey = `${emergencyId}-${start.join(',')}-${end.join(',')}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      let data;
      if (this.ORS_API_KEY) {
        data = await this.fetchFromORS(start, end);
      } else {
        data = await this.fetchFromOSRM(start, end);
      }

      if (data) {
        this.cache.set(cacheKey, { data, timestamp: Date.now() });
        // Clean up old cache entries occasionally
        if (this.cache.size > 100) {
           const now = Date.now();
           for (const [key, val] of this.cache.entries()) {
             if (now - val.timestamp > this.CACHE_TTL * 2) this.cache.delete(key);
           }
        }
      }
      return data;
    } catch (error) {
      this.logger.error(`Route fetch failed: ${error.message}`);
      return null;
    }
  }

  private async fetchFromORS(start: [number, number], end: [number, number]) {
    const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${this.ORS_API_KEY}&start=${start[1]},${start[0]}&end=${end[1]},${end[0]}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.features?.[0]) {
      const feature = data.features[0];
      const coords = feature.geometry.coordinates.map(c => [c[1], c[0]]); // Swap to [lat, lng]
      const properties = feature.properties.summary;
      
      return {
        coordinates: coords,
        distance: properties.distance,
        duration: properties.duration,
        eta: Math.ceil(properties.duration / 60) + ' min',
        distanceText: (properties.distance / 1000).toFixed(1) + ' km'
      };
    }
    return null;
  }

  private async fetchFromOSRM(start: [number, number], end: [number, number]) {
    const url = `${this.OSRM_URL}/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.routes?.[0]) {
      const route = data.routes[0];
      const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
      
      return {
        coordinates: coords,
        distance: route.distance,
        duration: route.duration,
        eta: Math.ceil(route.duration / 60) + ' min',
        distanceText: (route.distance / 1000).toFixed(1) + ' km'
      };
    }
    return null;
  }
}
