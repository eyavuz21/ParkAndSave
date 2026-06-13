"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Stop = { name: string; lat?: number; lng?: number };
type Pt = { name: string; lat: number; lng: number };

// Numbered circular pin (avoids Leaflet's image-asset icons, which break in bundlers).
function badge(label: string, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function FitBounds({ points }: { points: Pt[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = L.latLngBounds(
      points.map((p) => [p.lat, p.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
  }, [points, map]);
  return null;
}

/**
 * An embedded OpenStreetMap of the whole journey: your location (★) + each stop
 * (numbered), connected by a route line. Stops without coordinates are
 * geocoded via Nominatim so e.g. the car park still shows.
 */
export function RouteMap({
  stops,
  origin,
}: {
  stops: Stop[];
  origin?: { lat: number; lng: number };
}) {
  const [points, setPoints] = useState<Pt[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved: Pt[] = [];
      if (origin) resolved.push({ name: "You", lat: origin.lat, lng: origin.lng });
      for (const s of stops) {
        if (typeof s.lat === "number" && typeof s.lng === "number") {
          resolved.push({ name: s.name, lat: s.lat, lng: s.lng });
        } else if (s.name) {
          try {
            const r = await fetch(
              `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(s.name)}`,
              { headers: { Accept: "application/json" } },
            );
            const j = await r.json();
            if (Array.isArray(j) && j[0]) {
              resolved.push({
                name: s.name,
                lat: parseFloat(j[0].lat),
                lng: parseFloat(j[0].lon),
              });
            }
          } catch {
            // skip stops we can't locate
          }
        }
      }
      if (!cancelled) setPoints(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [stops, origin]);

  if (points.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-400">
        Loading map…
      </div>
    );
  }

  const line = points.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <MapContainer
      style={{ height: 240, width: "100%", borderRadius: 12 }}
      center={[points[0].lat, points[0].lng]}
      zoom={13}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline
        positions={line}
        pathOptions={{ color: "#059669", weight: 4, opacity: 0.85 }}
      />
      {points.map((p, i) => {
        const isOrigin = !!origin && i === 0;
        const label = isOrigin ? "★" : String(origin ? i : i + 1);
        return (
          <Marker
            key={i}
            position={[p.lat, p.lng]}
            icon={badge(label, isOrigin ? "#3b82f6" : "#059669")}
          >
            <Tooltip>{p.name}</Tooltip>
          </Marker>
        );
      })}
      <FitBounds points={points} />
    </MapContainer>
  );
}
