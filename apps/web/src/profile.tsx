import { Show, SignInButton, UserProfile, useAuth } from "@clerk/react";
import "../../../packages/ui/src/styles.css";

const appearance = {
  variables: {
    colorPrimary: "#3d4fbf",
    colorBackground: "#fbfaf7",
    colorText: "#1c2130",
    borderRadius: "0.75rem",
    fontFamily: "inherit",
  },
  elements: {
    rootBox: "w-full max-w-3xl",
    cardBox: "w-full shadow-none",
    card: "w-full border border-neutral-200 bg-white shadow-none",
    navbar: "bg-transparent",
    pageScrollBox: "bg-transparent",
  },
};

/** Embedded account page. Hash routing keeps Clerk's sections on /profile. */
export function ProfilePage() {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground">
      <a href="/" className="text-sm text-primary">
        Back
      </a>
      <h1 className="mb-4 mt-3 text-2xl font-semibold">Account</h1>
      {!isLoaded ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Sign in
          </button>
        </SignInButton>
      </Show>
      {isSignedIn ? <UserProfile routing="hash" appearance={appearance} /> : null}
    </main>
  );
}
