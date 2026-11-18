import { ClerkProvider, useAuth } from "@clerk/react";
import { RouterProvider } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { webConfigError } from "./config";
import { router } from "./router";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const configError = webConfigError({ convexUrl, clerkPublishableKey });
const root = document.getElementById("root");
if (!root) throw new Error("Root element missing");

if (configError || !convexUrl || !clerkPublishableKey) {
  createRoot(root).render(
    <main className="shell">
      <h1>Manager</h1>
      <p>{configError ?? "Missing configuration"}</p>
    </main>,
  );
} else {
  const convex = new ConvexReactClient(convexUrl);
  createRoot(root).render(
    <StrictMode>
      <ClerkProvider publishableKey={clerkPublishableKey}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <RouterProvider router={router} />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    </StrictMode>,
  );
}
