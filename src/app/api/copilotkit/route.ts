import {
  CopilotRuntime,
  AnthropicAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

// The agent's "brain". Reads ANTHROPIC_API_KEY from .env.local.
// NOTE: baseURL must include "/v1". CopilotKit's adapter copies this client's
// baseURL into the Vercel AI SDK, which then appends "/messages". The Anthropic
// SDK's default baseURL omits "/v1", which produces a 404 — so we set it here.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: "https://api.anthropic.com/v1",
});

const serviceAdapter = new AnthropicAdapter({
  anthropic,
  model: "claude-sonnet-4-6",
});

// Tools live on the frontend via useCopilotAction (see src/app/page.tsx),
// which auto-continues the conversation and lets us render generative UI.
const runtime = new CopilotRuntime();

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
