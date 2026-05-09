/**
 * Centralized API configuration for the Citizen App.
 * All backend requests must use this config to ensure consistent URLs.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || API_URL;

/**
 * Safe fetch wrapper that handles:
 * - Network failures (cold-start, timeout)
 * - Empty responses
 * - JSON parse errors
 * - Non-OK status codes
 */
export async function safeFetch(url: string, options?: RequestInit) {
  try {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);

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

    return await response.json();

  } catch (error) {
    console.error("[FETCH FAILED]", error);

    return {
      success: false,
      error: "Network request failed"
    };
  }
}
