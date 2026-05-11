/**
 * Centralized API configuration for the Citizen App.
 * All backend requests must use this config to ensure consistent URLs.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://rakshasos-backend.onrender.com';
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_URL;

/**
 * Safe fetch wrapper that handles:
 * - Network failures (cold-start, timeout)
 * - Empty responses
 * - JSON parse errors
 * - Non-OK status codes
 */
const requestCache = new Map<string, { promise: Promise<any>, timestamp: number }>();
const MAX_CACHE_SIZE = 50;

function pruneRequestCache() {
  const now = Date.now();
  for (const [key, val] of requestCache.entries()) {
    if (now - val.timestamp > 5000) requestCache.delete(key);
  }
  if (requestCache.size > MAX_CACHE_SIZE) {
    const firstKey = requestCache.keys().next().value;
    if (firstKey !== undefined) requestCache.delete(firstKey);
  }
}

export async function safeFetch(url: string, options?: RequestInit) {
  pruneRequestCache();
  const method = options?.method || 'GET';
  const body = options?.body ? String(options.body) : '';
  const cacheKey = `${method}:${url}:${body}`;

  // Deduplicate inflight or recent requests (within 1s for GET, 500ms for others)
  const ttl = method === 'GET' ? 1000 : 500;
  const cached = requestCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < ttl)) {
    return cached.promise;
  }

  const fetchPromise = (async () => {
    try {
      const controller = new AbortController();
      // 45s timeout — Render cold starts can take 15-30s
      const timeout = setTimeout(() => controller.abort(), 45000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers || {})
        }
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("[FETCH FAILED]", error);
      return { success: false, error: "Network request failed" };
    }
  })();

  requestCache.set(cacheKey, { promise: fetchPromise, timestamp: Date.now() });
  return fetchPromise;
}
