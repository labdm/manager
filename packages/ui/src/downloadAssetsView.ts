import type {
  DownloadAsset,
  DownloadPlatform,
} from "@manager/backend/convex/lib/downloadAssets";

export interface AssetGroup {
  platform: DownloadPlatform;
  assets: DownloadAsset[];
}

const formatOrder = ["msi", "exe", "dmg", "zip", "tar.gz"];

export function assetFormat(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".tar.gz")) return "tar.gz";
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".msi")) return "msi";
  if (lower.endsWith(".exe")) return "exe";
  if (lower.endsWith(".dmg")) return "dmg";
  return "download";
}

/** Distinguishes the two macOS builds when both are published in a release. */
export function assetVariant(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes("macos-native")) return "Native app";
  if (lower.includes("macos-desktop")) return "Desktop app";
  if (lower.includes("ios-simulator")) return "Simulator";
  return null;
}

/** Groups release assets by platform, with zip before tar.gz in each group. */
export function groupAssetsByPlatform(
  assets: DownloadAsset[],
  platforms: DownloadPlatform[],
): AssetGroup[] {
  return platforms.flatMap((platform) => {
    const items = assets
      .filter((asset) => asset.platform === platform)
      .sort((left, right) => {
        const format = formatOrder.indexOf(assetFormat(left.name)) -
          formatOrder.indexOf(assetFormat(right.name));
        return format !== 0 ? format : left.name.localeCompare(right.name);
      });
    return items.length > 0 ? [{ platform, assets: items }] : [];
  });
}
