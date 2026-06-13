"use client";

import { useEffect, useRef } from "react";
import {
  A2UIProvider,
  A2UIRenderer,
  useA2UIActions,
} from "@copilotkit/a2ui-renderer";

const CATALOG_ID = "https://a2ui.org/specification/v0_9/basic_catalog.json";

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
 */
export function A2UISurface({
  surfaceId,
  components,
}: {
  surfaceId: string;
  components: Array<Record<string, unknown>>;
}) {
  return (
    <A2UIProvider>
      <Feed surfaceId={surfaceId} components={components} />
    </A2UIProvider>
  );
}
