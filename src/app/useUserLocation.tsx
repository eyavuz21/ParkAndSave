"use client";

import { useEffect, useState } from "react";

export type UserLocation = { label: string; lat: number; lng: number } | null;
export type LocationStatus =
  | "idle"
  | "locating"
  | "ready"
  | "denied"
  | "unsupported";

/**
 * Gets the user's current location from the browser's Geolocation API and
 * reverse-geocodes it to a human-readable place name via OpenStreetMap
 * (Nominatim — free, no API key). The browser prompts for permission.
 */
export function useUserLocation(): {
  location: UserLocation;
  status: LocationStatus;
} {
  const [location, setLocation] = useState<UserLocation>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        let label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
            { headers: { Accept: "application/json" } },
          );
          if (r.ok) {
            const j = await r.json();
            if (j?.display_name) label = j.display_name;
          }
        } catch {
          // keep the lat/lng label on failure
        }
        setLocation({ label, lat, lng });
        setStatus("ready");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return { location, status };
}
