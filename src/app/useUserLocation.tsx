"use client";

import { useCallback, useEffect, useState } from "react";

export type UserLocation = { label: string; lat: number; lng: number } | null;
export type LocationStatus =
  | "idle"
  | "locating"
  | "ready"
  | "denied"
  | "unsupported";

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { Accept: "application/json" } },
    );
    if (r.ok) {
      const j = await r.json();
      if (j?.display_name) return j.display_name as string;
    }
  } catch {
    // fall through
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * The user's location for the app. Uses a FRESH browser GPS reading (no cache)
 * and exposes `refresh()` to re-read it and `setManual()` to override it by
 * typing a place name — so a wrong reading is always correctable.
 */
export function useUserLocation(): {
  location: UserLocation;
  status: LocationStatus;
  refresh: () => void;
  setManual: (place: string) => Promise<void>;
} {
  const [location, setLocation] = useState<UserLocation>(null);
  const [status, setStatus] = useState<LocationStatus>("idle");

  const refresh = useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const label = await reverseGeocode(lat, lng);
        setLocation({ label, lat, lng });
        setStatus("ready");
      },
      () => setStatus("denied"),
      // maximumAge: 0 forces a fresh reading rather than a stale cached one.
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, []);

  const setManual = useCallback(async (place: string) => {
    const q = place.trim();
    if (!q) return;
    setStatus("locating");
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/json" } },
      );
      const j = await r.json();
      if (Array.isArray(j) && j[0]) {
        setLocation({
          label: j[0].display_name,
          lat: parseFloat(j[0].lat),
          lng: parseFloat(j[0].lon),
        });
        setStatus("ready");
        return;
      }
    } catch {
      // fall through
    }
    setStatus("denied");
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { location, status, refresh, setManual };
}
