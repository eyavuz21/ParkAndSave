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

  let target: string | undefined;
  if (lat != null && lng != null) {
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
