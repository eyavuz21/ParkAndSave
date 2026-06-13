import { NextRequest, NextResponse } from "next/server";

// Finds real nearby supermarkets from OpenStreetMap (the same data source as
// SpatialCart). No API key needed. Accepts {lat,lng} or a {place} name.

const UA = "ParkAndSave/1.0 (hackathon demo)";

async function geocode(place: string): Promise<{ lat: number; lng: number } | null> {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(place)}`,
    { headers: { "User-Agent": UA, Accept: "application/json" } },
  );
  if (!r.ok) return null;
  const j = await r.json();
  if (!Array.isArray(j) || !j[0]) return null;
  return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon) };
}

function metres(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  let { lat, lng } = body as { lat?: number; lng?: number };
  const { place, radius } = body as { place?: string; radius?: number };

  if ((lat == null || lng == null) && place) {
    const g = await geocode(place);
    if (!g)
      return NextResponse.json(
        { error: `Could not find a location for "${place}".` },
        { status: 404 },
      );
    lat = g.lat;
    lng = g.lng;
  }
  if (lat == null || lng == null) {
    return NextResponse.json({ error: "location required" }, { status: 400 });
  }

  const r = Math.min(Math.max(radius || 1200, 200), 3000);
  const query = `[out:json][timeout:20];(node["shop"="supermarket"](around:${r},${lat},${lng});way["shop"="supermarket"](around:${r},${lat},${lng}););out center 20;`;

  const resp = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "data=" + encodeURIComponent(query),
  });
  if (!resp.ok)
    return NextResponse.json({ error: "shop lookup failed" }, { status: 502 });

  const j = await resp.json();
  const shops = (j.elements || [])
    .map((e: { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }) => {
      const la = e.lat ?? e.center?.lat;
      const lo = e.lon ?? e.center?.lon;
      const name = e.tags?.name || e.tags?.brand;
      if (la == null || lo == null || !name) return null;
      return {
        name,
        brand: e.tags?.brand,
        lat: la,
        lng: lo,
        distance: metres(lat!, lng!, la, lo),
      };
    })
    .filter(Boolean)
    .sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance)
    .slice(0, 8);

  return NextResponse.json({ origin: { lat, lng }, shops });
}
