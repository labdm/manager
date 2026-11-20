export type DownloadPlatform = "web" | "windows" | "macos" | "android" | "ios";

export interface DownloadAsset {
  platform: DownloadPlatform;
  name: string;
  url: string;
  size: number;
  updatedAt: string;
}

export interface DownloadRelease {
  tag: string;
  name: string;
  url: string;
  publishedAt: string;
  assets: DownloadAsset[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Maps release asset filenames to the platforms the download page knows. */
export function classifyAssetName(name: string): DownloadPlatform | null {
  const lower = name.toLowerCase();
  if (/(^|[^a-z])ios([^a-z]|$)|iphone|ipad/.test(lower)) return "ios";
  if (/(^|[^a-z])windows([^a-z]|$)/.test(lower)) return "windows";
  if (/(^|[^a-z])macos([^a-z]|$)/.test(lower)) return "macos";
  if (/(^|[^a-z])android([^a-z]|$)/.test(lower)) return "android";
  if (/(^|[^a-z])web([^a-z]|$)/.test(lower)) return "web";
  return null;
}

/**
 * Converts the public GitHub releases payload into the small, typed shape the
 * web app consumes. Unknown assets and empty releases are dropped.
 */
export function parseGitHubReleases(value: unknown): DownloadRelease[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): DownloadRelease[] => {
    if (!isRecord(entry) || entry.draft === true) return [];

    const tag = stringField(entry.tag_name);
    if (!tag) return [];

    const rawAssets = Array.isArray(entry.assets) ? entry.assets : [];
    const assets = rawAssets.flatMap((raw): DownloadAsset[] => {
      if (!isRecord(raw)) return [];
      const name = stringField(raw.name);
      const url = stringField(raw.browser_download_url);
      if (!name || !url || typeof raw.size !== "number") return [];
      const platform = classifyAssetName(name);
      if (!platform) return [];
      return [
        {
          platform,
          name,
          url,
          size: raw.size,
          updatedAt: stringField(raw.updated_at) ?? "",
        },
      ];
    });

    if (assets.length === 0) return [];

    return [
      {
        tag,
        name: stringField(entry.name) ?? tag,
        url: stringField(entry.html_url) ?? "",
        publishedAt:
          stringField(entry.published_at) ?? stringField(entry.created_at) ?? "",
        assets,
      },
    ];
  });
}

/** iOS assets are stripped before they leave the server for a non-admin. */
export function visibleAssets(
  assets: DownloadAsset[],
  isAdmin: boolean,
): DownloadAsset[] {
  return isAdmin ? assets : assets.filter((asset) => asset.platform !== "ios");
}
