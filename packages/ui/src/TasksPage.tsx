import { Show, SignInButton, useAuth, useClerk, useUser } from "@clerk/react";
import { Shell } from "./Shell";
import type { BuildInfo } from "./MenuPages";

export function TasksPage({
  showDownloadsLink = true,
  buildInfo,
  vapidPublicKey,
}: {
  showDownloadsLink?: boolean;
  buildInfo?: BuildInfo;
  vapidPublicKey?: string;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  if (isSignedIn) {
    return (
      <Shell
        profile={{
          name: user?.fullName || user?.username || null,
          email: user?.primaryEmailAddress?.emailAddress ?? null,
          imageUrl: user?.imageUrl ?? null,
        }}
        onSignOut={() => {
          void signOut();
        }}
        buildInfo={buildInfo}
        vapidPublicKey={vapidPublicKey}
      />
    );
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-background p-6 text-foreground">
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">Manager</p>
        {showDownloadsLink ? <a href="/download">Downloads</a> : null}
      </div>
      <h1 className="text-2xl font-semibold">Home</h1>
      {!isLoaded ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      <Show when="signed-out">
        <section className="flex flex-col items-start gap-3 rounded-md border bg-card p-4">
          <p className="text-sm">Sign in to see your board.</p>
          <SignInButton mode="modal">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Sign in
            </button>
          </SignInButton>
        </section>
      </Show>
    </main>
  );
}
