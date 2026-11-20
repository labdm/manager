import { Show, SignInButton, UserButton, useAuth } from "@clerk/react";
import { api } from "@manager/backend/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import type {
  DownloadAsset,
  DownloadRelease,
} from "@manager/backend/convex/lib/downloadAssets";
import {
  assetFormat,
  groupAssetsByPlatform,
} from "./downloadAssetsView";
import { shouldLoadReleases } from "./downloadEnvironment";
import "./downloads.css";

const platformLabels: Record<DownloadAsset["platform"], string> = {
  web: "Web",
  macos: "macOS",
  ios: "iOS",
};

const desktopPlatforms: DownloadAsset["platform"][] = ["web", "macos"];
const PRODUCTION_DOWNLOAD_URL = "https://manager.labdm.dev/download";
const CI_RUNS_URL = "https://github.com/dmytro-afonin/manager/actions";

interface DownloadPageProps {
  deployEnv?: string;
}

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unit]}`;
}

function formatDate(value: string): string {
  if (!value) return "Undated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function assetsFor(
  release: DownloadRelease,
  platforms: DownloadAsset["platform"][],
): DownloadAsset[] {
  return release.assets.filter((asset) => platforms.includes(asset.platform));
}

function AssetLink({ asset }: { asset: DownloadAsset }) {
  return (
    <a
      className="asset-link"
      href={asset.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Download ${asset.name}`}
    >
      <span className="asset-format">{assetFormat(asset.name)}</span>
      <span className="asset-size">{formatSize(asset.size)}</span>
      <span className="asset-arrow" aria-hidden="true">
        ↓
      </span>
    </a>
  );
}

function ReleaseCard({
  release,
  platforms,
}: {
  release: DownloadRelease;
  platforms: DownloadAsset["platform"][];
}) {
  const groups = groupAssetsByPlatform(
    assetsFor(release, platforms),
    platforms,
  );
  if (groups.length === 0) return null;

  return (
    <article className="release-card">
      <div className="release-heading">
        <div>
          <p className="release-kicker">Release</p>
          <h3>{release.tag}</h3>
          {release.name !== release.tag ? (
            <p className="release-name">{release.name}</p>
          ) : null}
        </div>
        <div className="release-meta">
          <time dateTime={release.publishedAt || undefined}>
            {formatDate(release.publishedAt)}
          </time>
          {release.url ? (
            <a href={release.url} target="_blank" rel="noreferrer">
              Release notes ↗
            </a>
          ) : null}
        </div>
      </div>
      <div className="asset-groups">
        {groups.map((group) => (
          <section
            className={`asset-group asset-${group.platform}`}
            key={group.platform}
          >
            <div className="asset-group-head">
              <span className="asset-platform">
                {platformLabels[group.platform]}
              </span>
              <span className="asset-meta">
                Updated {formatDate(group.assets[0].updatedAt)}
              </span>
            </div>
            <div className="asset-formats">
              {group.assets.map((asset) => (
                <AssetLink key={asset.name} asset={asset} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function ReleaseList({
  releases,
  platforms,
  empty,
}: {
  releases: DownloadRelease[];
  platforms: DownloadAsset["platform"][];
  empty: string;
}) {
  const visible = releases.filter(
    (release) => assetsFor(release, platforms).length > 0,
  );
  if (visible.length === 0) return <p className="download-empty">{empty}</p>;
  return (
    <div className="release-list">
      {visible.map((release) => (
        <ReleaseCard
          key={release.tag}
          release={release}
          platforms={platforms}
        />
      ))}
    </div>
  );
}

function PreviewNotice() {
  return (
    <aside className="preview-notice">
      <div>
        <p className="access-title">Preview build</p>
        <p>
          Published downloads live on the production site. CI artifacts are
          short-lived and need GitHub access.
        </p>
      </div>
      <div className="preview-links">
        <a href={PRODUCTION_DOWNLOAD_URL} target="_blank" rel="noreferrer">
          Production downloads ↗
        </a>
        <a href={CI_RUNS_URL} target="_blank" rel="noreferrer">
          CI runs ↗
        </a>
      </div>
    </aside>
  );
}

export function DownloadPage({ deployEnv }: DownloadPageProps = {}) {
  const isPreview = !shouldLoadReleases(deployEnv);
  const { isLoaded, isSignedIn } = useAuth();
  const ensureUser = useMutation(api.users.ensure);
  const listReleases = useAction(api.downloads.list);
  const me = useQuery(api.users.me);
  const [releases, setReleases] = useState<DownloadRelease[]>();
  const [releaseError, setReleaseError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    void ensureUser().catch(() => undefined);
  }, [isSignedIn, ensureUser]);

  useEffect(() => {
    if (isPreview) return;
    let cancelled = false;
    listReleases({ limit: 20 })
      .then((result) => {
        if (!cancelled) setReleases(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setReleaseError(
            caught instanceof Error ? caught.message : "Could not load releases",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listReleases, isPreview]);

  const isAdmin = me?.role === "admin";
  const allReleases = releases ?? [];

  return (
    <main className="download-shell">
      {isPreview ? <PreviewNotice /> : null}
      <header className="download-header">
        <div>
          <p className="mark">Manager / Builds</p>
          <h1>Downloads</h1>
          <p className="download-lede">
            One app, the same tasks everywhere. Pick a build, keep your place.
          </p>
        </div>
        <nav className="download-nav" aria-label="Primary">
          <a href="/">Tasks</a>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </nav>
      </header>

      <section className="download-section" aria-labelledby="desktop-heading">
        <div className="section-heading">
          <div>
            <p className="section-index">01</p>
            <h2 id="desktop-heading">Desktop &amp; web</h2>
          </div>
          <p>Open in a browser or install on Apple Silicon.</p>
        </div>
        {isPreview ? (
          <p className="status">
            Preview builds do not list release assets. Use the links above.
          </p>
        ) : releaseError ? (
          <p className="error">{releaseError}</p>
        ) : releases === undefined ? (
          <p className="status">Loading releases…</p>
        ) : (
          <ReleaseList
            releases={allReleases}
            platforms={desktopPlatforms}
            empty="No desktop releases yet. Publish a v* tag to create one."
          />
        )}
      </section>

      <section className="download-section restricted" aria-labelledby="ios-heading">
        <div className="section-heading">
          <div>
            <p className="section-index">02</p>
            <h2 id="ios-heading">
              iOS <span className="access-badge">Admins only</span>
            </h2>
          </div>
          <p>Simulator builds for validating the native client.</p>
        </div>

        {isPreview ? (
          <p className="status">
            Preview builds do not include iOS release assets.
          </p>
        ) : !isLoaded ? (
          <p className="status">Checking session…</p>
        ) : !isSignedIn ? (
          <div className="access-panel">
            <div>
              <p className="access-title">Sign in to continue</p>
              <p>iOS builds are only shown to administrators.</p>
            </div>
            <SignInButton mode="modal">
              <button type="button">Sign in</button>
            </SignInButton>
          </div>
        ) : me === undefined ? (
          <p className="status">Checking access…</p>
        ) : !isAdmin ? (
          <div className="access-panel">
            <div>
              <p className="access-title">Restricted</p>
              <p>Your account does not have access to iOS builds.</p>
            </div>
          </div>
        ) : releaseError ? (
          <p className="error">{releaseError}</p>
        ) : releases === undefined ? (
          <p className="status">Loading releases…</p>
        ) : (
          <ReleaseList
            releases={allReleases}
            platforms={["ios"]}
            empty="No iOS releases yet. Publish a v* tag to create one."
          />
        )}
      </section>

      <footer className="download-footer">
        <p>
          Builds are ad-hoc signed, not notarized. If macOS refuses to open the
          app, run <code>xattr -cr /path/to/Manager.app</code>. iOS archives run
          in the Simulator only.
        </p>
      </footer>
    </main>
  );
}
