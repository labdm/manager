import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ClerkProvider, useAuth } from "@clerk/react";
import { TasksPage } from "@manager/ui";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { StrictMode, Suspense, use, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { initClerk } from "tauri-plugin-clerk";
import { desktopConfigError } from "./config";
import "./index.css";

type ClerkInstance = Awaited<ReturnType<typeof initClerk>>;
type OAuthTransport = {
  getRedirectUrl: () => string;
  open: (url: URL) => Promise<{ callbackUrl: string }>;
};

const OAUTH_REDIRECT_URL = "manager://oauth-callback/";
const OAUTH_TIMEOUT_MS = 180_000;

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const configError = desktopConfigError({ convexUrl, clerkPublishableKey });
const root = document.getElementById("root");

if (!root) throw new Error("Root element missing");

function Splash({ children }: { children: ReactNode }) {
  return (
    <main className="shell">
      <p className="mark">Manager</p>
      {children}
    </main>
  );
}

function isOAuthCallback(url: string | undefined, previous: string[] | null) {
  return !!url && url.startsWith(OAUTH_REDIRECT_URL) && !previous?.includes(url);
}

const oauthTransport: OAuthTransport = {
  getRedirectUrl: () => OAUTH_REDIRECT_URL,
  async open(url) {
    const previous = await getCurrent();
    let resolveCallback!: (callbackUrl: string) => void;
    let rejectCallback!: (error: Error) => void;
    const callback = new Promise<string>((resolve, reject) => {
      resolveCallback = resolve;
      rejectCallback = reject;
    });
    let settled = false;
    const state: { timeout?: number; unlisten?: () => void } = {};

    const finish = (error?: Error, callbackUrl?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(state.timeout);
      state.unlisten?.();
      if (error) rejectCallback(error);
      else resolveCallback(callbackUrl!);
    };

    const accept = (urls: string[] | null) => {
      const callbackUrl = urls?.find((url) => isOAuthCallback(url, previous));
      if (callbackUrl) finish(undefined, callbackUrl);
    };

    state.timeout = window.setTimeout(
      () => finish(new Error("Sign-in timed out. Try again.")),
      OAUTH_TIMEOUT_MS,
    );
    state.unlisten = await onOpenUrl(accept);
    accept(await getCurrent());

    try {
      await openUrl(url.toString());
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }

    return { callbackUrl: await callback };
  },
};

if (configError || !convexUrl || !clerkPublishableKey) {
  createRoot(root).render(
    <Splash>
      <h1>Not configured</h1>
      <p>{configError ?? "Missing configuration"}</p>
    </Splash>,
  );
} else {
  const clerkPromise = initClerk({
    allowedRedirectProtocols: ["manager:"],
    __internal_oauthTransport: oauthTransport,
  });
  const convex = new ConvexReactClient(convexUrl);

  createRoot(root).render(
    <StrictMode>
      <Suspense
        fallback={
          <Splash>
            <p className="status">Loading…</p>
          </Splash>
        }
      >
        <DesktopApp
          clerkPromise={clerkPromise}
          convex={convex}
          publishableKey={clerkPublishableKey}
        />
      </Suspense>
    </StrictMode>,
  );
}

function DesktopApp({
  clerkPromise,
  convex,
  publishableKey,
}: {
  clerkPromise: Promise<ClerkInstance>;
  convex: ConvexReactClient;
  publishableKey: string;
}) {
  const clerk = use(clerkPromise);

  return (
    <ClerkProvider publishableKey={publishableKey} Clerk={clerk}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <TasksPage showDownloadsLink={false} />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
