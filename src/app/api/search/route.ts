import { LinkupClient } from "linkup-sdk";
import { NextRequest, NextResponse } from "next/server";

// Server-side LinkUp client. Keeps LINKUP_API_KEY on the server, never the browser.
const linkup = new LinkupClient({ apiKey: process.env.LINKUP_API_KEY! });

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const result = await linkup.search({
    query,
    depth: "standard",
    outputType: "sourcedAnswer",
  });

  return NextResponse.json({
    answer: result.answer,
    sources: result.sources
      .slice(0, 5)
      .map((s) => ({ name: s.name, url: s.url })),
  });
}
