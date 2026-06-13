"use client";

import { useEffect, useRef } from "react";
import {
  A2UIProvider,
  A2UIRenderer,
  useA2UIActions,
  type A2UIClientEventMessage,
} from "@copilotkit/a2ui-renderer";

const CATALOG_ID = "https://a2ui.org/specification/v0_9/basic_catalog.json";

type Origin = { lat: number; lng: number } | undefined;

// Turns a clicked A2UI button into a map. If we know the user's location we
// open turn-by-turn directions to the place; otherwise we just show the place.
function openMapForAction(message: A2UIClientEventMessage, origin: Origin) {
  const ctx = (message?.userAction?.context ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const num = (v: unknown) => (typeof v === "number" ? v : undefined);

  const originParam = origin ? `&origin=${origin.lat},${origin.lng}` : "";
  const lat = num(ctx.lat);
  const lng = num(ctx.lng);
  const destination = str(ctx.destination) || str(ctx.place) || str(ctx.name);
  const search = str(ctx.search);
  const url = str(ctx.url) || str(ctx.href) || str(ctx.link);
  // A full multi-stop route: origin → each stop in order.
  const stops = Array.isArray(ctx.stops)
    ? (ctx.stops as unknown[]).map((s) => str(s)).filter(Boolean) as string[]
    : [];

  let target: string | undefined;
  if (stops.length > 0) {
    const dest = stops[stops.length - 1];
    const waypoints = stops.slice(0, -1);
    const wpParam = waypoints.length
      ? `&waypoints=${waypoints.map(encodeURIComponent).join("|")}`
      : "";
    target = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${encodeURIComponent(dest)}${wpParam}`;
  } else if (lat != null && lng != null) {
    target = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${lat},${lng}`;
  } else if (destination) {
    target = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${encodeURIComponent(destination)}`;
  } else if (search) {
    target = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(search)}`;
  } else if (url) {
    target = url;
  }

  if (target) window.open(target, "_blank", "noopener,noreferrer");
}

export type Stop = { name: string; lat?: number; lng?: number };

// Builds one Google Maps URL for a whole journey: origin → each stop in order.
function buildMultiStopUrl(stops: Stop[], origin: Origin): string | undefined {
  const toPoint = (s: Stop) =>
    typeof s.lat === "number" && typeof s.lng === "number"
      ? `${s.lat},${s.lng}`
      : (s.name || "").trim();
  const points = stops.map(toPoint).filter(Boolean);
  if (points.length === 0) return undefined;
  const dest = points[points.length - 1];
  const waypoints = points.slice(0, -1);
  const originParam = origin ? `&origin=${origin.lat},${origin.lng}` : "";
  const wpParam = waypoints.length
    ? `&waypoints=${waypoints.map(encodeURIComponent).join("|")}`
    : "";
  return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${encodeURIComponent(dest)}${wpParam}`;
}

/** One tappable map of a whole multi-stop journey (you → each stop in order). */
export function TripRoute({ stops, origin }: { stops: Stop[]; origin?: Origin }) {
  const clean = (stops || []).filter(
    (s) => s && (s.name || (s.lat != null && s.lng != null)),
  );
  const url = buildMultiStopUrl(clean, origin);
  if (!url || clean.length === 0) return null;
  return (
    <div className="my-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left">
      <div className="mb-2 text-sm font-semibold text-emerald-800">
        🗺️ Your full route
      </div>
      <ol className="mb-3 ml-5 list-decimal text-sm text-gray-700">
        {origin ? <li>You are here</li> : null}
        {clean.map((s, i) => (
          <li key={i}>{s.name}</li>
        ))}
      </ol>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Open route in Google Maps →
      </a>
    </div>
  );
}

function Feed({
  surfaceId,
  components,
}: {
  surfaceId: string;
  components: Array<Record<string, unknown>>;
}) {
  const { processMessages, getSurface } = useA2UIActions();
  const createdRef = useRef(false);
  useEffect(() => {
    try {
      // Create the surface exactly once; the ref guards against re-renders and
      // the store lookup lagging behind a just-created surface.
      if (!createdRef.current && !getSurface(surfaceId)) {
        processMessages([
          { version: "v0.9", createSurface: { surfaceId, catalogId: CATALOG_ID } },
        ]);
        createdRef.current = true;
      }
      processMessages([
        { version: "v0.9", updateComponents: { surfaceId, components } },
      ]);
    } catch (e) {
      console.warn("[A2UISurface] feed error", e);
    }
  }, [surfaceId, components, processMessages, getSurface]);

  return (
    <A2UIRenderer
      surfaceId={surfaceId}
      fallback={<div className="text-sm text-gray-400">Rendering…</div>}
    />
  );
}

/**
 * Renders an agent-generated A2UI v0.9 component tree. Each call mounts its own
 * isolated A2UI surface (provider + renderer) and feeds in the components.
 * Clicking a card's button opens a map with directions to that place.
 */
export function A2UISurface({
  surfaceId,
  components,
  origin,
}: {
  surfaceId: string;
  components: Array<Record<string, unknown>>;
  origin?: Origin;
}) {
  return (
    <A2UIProvider onAction={(message) => openMapForAction(message, origin)}>
      <Feed surfaceId={surfaceId} components={components} />
    </A2UIProvider>
  );
}
