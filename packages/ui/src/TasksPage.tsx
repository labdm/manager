import { Show, SignInButton, UserButton, useAuth } from "@clerk/react";
import { HomePage } from "./HomePage";
import "./tasks.css";

export function TasksPage({
  showDownloadsLink = true,
}: {
  showDownloadsLink?: boolean;
}) {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <main className="shell home-shell">
      <header className={isSignedIn ? "signed-in" : undefined}>
        <div>
          <p className="mark">Manager</p>
          {isSignedIn ? null : <h1>Home</h1>}
        </div>
        <div className="top-actions">
          {showDownloadsLink ? (
            <a className="top-link" href="/download">
              Downloads
            </a>
          ) : null}
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </header>
      {!isLoaded ? <p className="status">Loading…</p> : null}
      <Show when="signed-out">
        <section className="panel">
          <p>Sign in to see your board.</p>
          <SignInButton mode="modal">
            <button type="button">Sign in</button>
          </SignInButton>
        </section>
      </Show>
      {isSignedIn ? <HomePage /> : null}
    </main>
  );
}
