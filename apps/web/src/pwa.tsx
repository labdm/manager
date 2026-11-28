import { useEffect, useState } from "react";

/** Registers the app-shell service worker and offers an update when a new one is waiting. */
export function PwaUpdate() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    void navigator.serviceWorker.register("/sw.js").then((registration) => {
      if (cancelled) return;
      if (registration.waiting) setWaiting(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(installing);
          }
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!waiting) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t bg-white px-4 py-3 text-sm">
      <p>A new version of Manager is ready.</p>
      <button
        type="button"
        className="rounded-md bg-blue-700 px-3 py-1.5 text-white"
        onClick={() => {
          waiting.postMessage("SKIP_WAITING");
          window.location.reload();
        }}
      >
        Update
      </button>
    </div>
  );
}
