"use client";

import { CopilotKit } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";

// Wraps the whole app so any component can use CopilotKit.
// runtimeUrl points at the route handler we created in api/copilotkit.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">{children}</CopilotKit>
  );
}
