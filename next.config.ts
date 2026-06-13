import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't bundle linkup-sdk on the server — let Node require it at runtime.
  // It has an optional, lazily-required dependency (@x402/core/http, used only
  // for crypto micropayments) that we don't use and isn't installed; bundling
  // it makes Turbopack fail to resolve that import.
  serverExternalPackages: ["linkup-sdk"],
};

export default nextConfig;
