/** Get user's current position. Returns null if denied or unavailable. */
export function getPosition(options?: { allowCache?: boolean }): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    // maximumAge: 0 forces a fresh fix for accurate distance; allowCache uses 10s cache for speed
    const maximumAge = options?.allowCache ? 10000 : 0;
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge }
    );
  });
}
