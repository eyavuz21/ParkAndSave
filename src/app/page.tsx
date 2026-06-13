"use client";

import { CopilotPopup } from "@copilotkit/react-ui";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { A2UISurface } from "./A2UISurface";
import { useUserLocation } from "./useUserLocation";

// Compact A2UI authoring spec injected into the agent so it can generate
// valid surfaces. (The full schema is huge; this is the practical subset.)
const A2UI_SPEC = `You generate A2UI v0.9 component trees.
RULES:
- "components" is a FLAT array. Every item has a unique "id" and a "component" type.
- EXACTLY ONE component must have id="root" (the entry point).
- Containers reference their children BY ID (strings), not by nesting objects.
AVAILABLE COMPONENTS (only use these):
- Text:    { id, component:"Text", text:"...", variant?:"display"|"headline"|"title"|"body"|"caption" }
- Column:  { id, component:"Column", children:["id1","id2"], align?, justify? }   // vertical stack
- Row:     { id, component:"Row", children:["id1","id2"], align?, justify? }       // horizontal
- Card:    { id, component:"Card", child:"oneId" }                                  // ONE child only
- Divider: { id, component:"Divider" }
- Button:  { id, component:"Button", child:"textId", action:{ event:{ name:"open", context:{ destination:"Full place name, street, area" } } } }
  EVERY Button MUST have action.event.context. Clicking opens a MAP with directions.
  • For a specific place (a named shop or car park), set context.destination to its full name + street + area, e.g. "Waitrose, Tower Bridge Road, SE1". Include context.lat and context.lng (numbers) too if you know them.
  • For a generic 'find X' button, instead set context.search, e.g. "bakery near Tower Bridge".
- Image:   { id, component:"Image", url:"https://...", description:"alt text" }
Example: a list of cards -> a "root" Column whose children are several Card ids; each Card's child is a Column of Text components.`;

export default function Home() {
  // Detect the user's current location and make it readable to the agent, so
  // "find parking near me" works without typing an address.
  const { location, status } = useUserLocation();
  useCopilotReadable({
    description:
      "The user's current location from their device. Use this as the default " +
      "place to search when the user says 'near me' or doesn't name a location.",
    value: location
      ? location.label
      : `not available (status: ${status})`,
  });

  // TOOL 1 — live web search via LinkUp (runs in the browser, calls our secret
  // server route). Used to get real parking/shop data.
  useCopilotAction({
    name: "searchLiveWeb",
    description:
      "Search the live web for up-to-date, real-world information such as car " +
      "park prices, availability, opening hours, or shop details. Returns a " +
      "sourced answer with links. Use this to GET data before displaying it.",
    parameters: [
      {
        name: "query",
        type: "string",
        description:
          "A natural-language search query, e.g. 'cheapest car parks near Tower Bridge London and hourly prices'.",
        required: true,
      },
    ],
    handler: async ({ query }) => {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) throw new Error("Live web search failed");
      return await res.json(); // { answer, sources }
    },
    render: ({ status, args }) => {
      const searching = status === "inProgress" || status === "executing";
      return (
        <div className="my-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          {searching ? (
            <span>🔎 Searching the live web for “{args?.query}”…</span>
          ) : (
            <span>✅ Live web search complete.</span>
          )}
        </div>
      );
    },
  });

  // TOOL 2 — find real nearby supermarkets from OpenStreetMap (SpatialCart's
  // data source). Defaults to the user's GPS location.
  useCopilotAction({
    name: "findNearbyShops",
    description:
      "Find real nearby supermarkets / grocery shops from OpenStreetMap for a " +
      "shopping trip. Returns shop names sorted by walking distance. Defaults to " +
      "the user's current location; pass 'place' to search somewhere else.",
    parameters: [
      {
        name: "place",
        type: "string",
        description:
          "Optional place to search near, e.g. 'Camden, London'. Omit to use the user's current GPS location.",
        required: false,
      },
    ],
    handler: async ({ place }) => {
      if (!place && !location) {
        return {
          error:
            "No location available. Ask the user for a place name, or they can enable location.",
        };
      }
      const body = place
        ? { place }
        : { lat: location!.lat, lng: location!.lng };
      const res = await fetch("/api/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return { error: "Could not find shops nearby." };
      return await res.json(); // { origin, shops: [{ name, brand, distance }] }
    },
    render: ({ status, args }) => {
      const searching = status === "inProgress" || status === "executing";
      return (
        <div className="my-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
          {searching ? (
            <span>
              🛒 Finding supermarkets{args?.place ? ` near ${args.place}` : " near you"}…
            </span>
          ) : (
            <span>✅ Found nearby supermarkets.</span>
          )}
        </div>
      );
    },
  });

  // TOOL 3 — A2UI generative UI. The agent generates a component tree and we
  // render it with the official A2UI renderer.
  useCopilotAction({
    name: "render_a2ui",
    description:
      "Display rich, structured UI to the user by generating an A2UI v0.9 " +
      "component tree. Use this to present parking options, shop comparisons, " +
      "or trip plans as cards instead of plain text. " +
      A2UI_SPEC,
    parameters: [
      {
        name: "surfaceId",
        type: "string",
        description: "A unique id for this surface, e.g. 'parking-options'.",
        required: true,
      },
      {
        name: "components",
        type: "object[]",
        description:
          "The A2UI component array. Flat list; exactly one item has id='root'.",
        required: true,
      },
    ],
    handler: async () =>
      "SUCCESS: The option cards are now fully displayed on the user's screen. " +
      "Do NOT list, table, or describe the options again. Reply with AT MOST one " +
      "short sentence (a single tip) and then stop.",
    render: ({ status, args }) => {
      const components = args?.components as
        | Array<Record<string, unknown>>
        | undefined;
      // Only render once the streamed tree is COMPLETE and structurally valid,
      // otherwise A2UI rejects partial components (e.g. root without a type).
      const ready =
        status === "complete" &&
        Array.isArray(components) &&
        components.length > 0 &&
        components.every((c) => c?.id && c?.component) &&
        components.some((c) => c?.id === "root");
      if (!ready) {
        return (
          <div className="my-2 text-sm text-gray-400">🎨 Generating UI…</div>
        );
      }
      return (
        <div className="my-2 rounded-xl border border-gray-200 p-3">
          <A2UISurface
            surfaceId={String(args?.surfaceId || "surface")}
            components={components!}
            origin={location ? { lat: location.lat, lng: location.lng } : undefined}
          />
        </div>
      );
    },
  });

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-5 bg-gradient-to-b from-emerald-50 via-white to-white p-8 text-center">
      <div className="text-6xl">🅿️</div>
      <h1 className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent">
        ParkAndSave
      </h1>
      <p className="max-w-md text-lg text-gray-600">
        Your AI errand copilot — find the cheapest, quickest{" "}
        <strong className="font-semibold text-gray-800">parking</strong> and the
        nearest <strong className="font-semibold text-gray-800">shops</strong>,
        all in one trip.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        {[
          "🅿️ parking near me",
          "🛒 do my shopping",
          "🗺️ plan my trip",
        ].map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700"
          >
            {chip}
          </span>
        ))}
      </div>

      <p className="text-sm text-gray-400">
        Click the chat bubble (bottom-right) and try one of those. 👉
      </p>

      <p className="text-xs text-gray-400">
        {status === "ready" && location
          ? `📍 Using your location: ${location.label}`
          : status === "locating"
            ? "📍 Detecting your location…"
            : status === "denied"
              ? "📍 Location off — just tell me a place name instead."
              : ""}
      </p>

      <footer className="mt-6 max-w-md text-xs leading-relaxed text-gray-400">
        Powered by CopilotKit · AG-UI · A2UI · LinkUp · OpenStreetMap.
        <br />
        Builds on{" "}
        <a
          href="https://spatialcart.up.railway.app/"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-emerald-600"
        >
          SpatialCart
        </a>
        , our cheapest-shopping-route project.
      </footer>

      <CopilotPopup
        instructions={`You are ParkAndSave, a friendly assistant that helps people plan an errand trip — saving time and money on PARKING and SHOPPING. The user's current location is in your context; use it as the default area when they say 'near me' or don't name a place.
TOOLS:
- searchLiveWeb: get live web data (car park prices, opening hours, shop info).
- findNearbyShops: list real nearby supermarkets from OpenStreetMap for a shopping trip.
- render_a2ui: display results as nice A2UI cards.
HOW TO RESPOND:
- IMPORTANT: Call tools ONE AT A TIME. Never call more than one tool in a single step — make a call, wait for its result, then make the next. One searchLiveWeb call is enough; do not fire several at once.
- For PARKING: call searchLiveWeb, then render_a2ui (one card per car park: name, price, link button).
- For SHOPPING (a shopping list, or 'cheapest'/'fastest' shop): call findNearbyShops to get ALL nearby supermarkets with their distances and brands, then act as a ROUTE OPTIMISER over every store at once. render_a2ui ONCE with THREE route options, each as its own Card:
   ⚡ FASTEST ROUTE — the single closest store that covers the whole list (least walking).
   💰 CHEAPEST ROUTE — a multi-stop route that splits the list across the best-value stores (Aldi, Lidl, Co-op for staples; others for specifics), ordered by location to minimise backtracking, with the estimated saving.
   ⚖️ BALANCED ROUTE (the recommended one) — this MUST be a real TWO-STOP journey combining cheap + fast: stop 1 = a budget store (Aldi/Lidl/Co-op) for the cheap staples, stop 2 = a closer/convenient store for the rest or fresh items.
   EACH route Card gets EXACTLY ONE Button labelled "🗺️ Map full route" (never separate buttons per store). Its action.event.context.stops MUST be the ORDERED array of EVERY stop on that route, each as "Store name, street, area" (add the store's lat/lng numbers if known). Clicking opens the WHOLE multi-stop journey on one map (your location → stop 1 → stop 2 → …). For the BALANCED route stops MUST contain BOTH stores in visit order. List each route's stops in order with estimated total distance/time.
- For a full TRIP / 'do my shopping' / 'plan my trip': call findNearbyShops AND searchLiveWeb (parking near those shops), then render_a2ui ONCE: the FASTEST / CHEAPEST / BALANCED shopping routes PLUS a section of parking cards. For the recommended BALANCED route, make its "View full route" stops begin with the chosen car park, then the stores in order — so the map shows park → shop → shop.
CRITICAL RULE: The A2UI cards ARE the complete answer. After render_a2ui, your final text reply MUST be at most ONE short sentence (a single tip). You are STRICTLY FORBIDDEN from repeating the options as a markdown table or list. Repeating the details is a failure.`}
        labels={{
          title: "ParkAndSave",
          initial:
            "Hi! I'm ParkAndSave 👋 Tell me to find cheap parking, nearby shops, or plan a whole trip — I'll search live and show you the options as cards.",
        }}
      />
    </main>
  );
}
