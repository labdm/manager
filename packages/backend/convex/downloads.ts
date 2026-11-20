import type { FunctionReference } from "convex/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";
import {
  parseGitHubReleases,
  visibleAssets,
  type DownloadAsset,
  type DownloadRelease,
} from "./lib/downloadAssets";

const REPOSITORY = "labdm/manager";

// An explicit reference type keeps this action out of the generated `api`
// inference cycle: `fullApi` includes this module.
const meQuery: FunctionReference<
  "query",
  "public",
  Record<string, never>,
  { role: "user" | "admin" } | null
> = api.users.me;

const platformValidator = v.union(
  v.literal("web"),
  v.literal("windows"),
  v.literal("macos"),
  v.literal("android"),
  v.literal("ios"),
);

const assetValidator = v.object({
  platform: platformValidator,
  name: v.string(),
  url: v.string(),
  size: v.number(),
  updatedAt: v.string(),
});

const releaseValidator = v.object({
  tag: v.string(),
  name: v.string(),
  url: v.string(),
  publishedAt: v.string(),
  assets: v.array(assetValidator),
});

function filterReleases(
  releases: DownloadRelease[],
  isAdmin: boolean,
): DownloadRelease[] {
  return releases.flatMap((release) => {
    const assets: DownloadAsset[] = visibleAssets(release.assets, isAdmin);
    if (assets.length === 0) return [];
    return [{ ...release, assets }];
  });
}

/**
 * GitHub release inventory for the website. Filtering happens here so an
 * unsigned iOS build is never included in a response to a non-admin, even
 * though the GitHub release itself is public.
 */
export const list = action({
  args: { limit: v.optional(v.number()) },
  returns: v.array(releaseValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(Math.trunc(args.limit ?? 12), 1), 50);
    const user = await ctx.runQuery(meQuery, {});
    const isAdmin = user?.role === "admin";

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "manager-convex-downloads",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const token = process.env.GITHUB_TOKEN?.trim();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(
      `https://api.github.com/repos/${REPOSITORY}/releases?per_page=${limit}`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`GitHub releases unavailable (${response.status})`);
    }

    const payload: unknown = await response.json();
    return filterReleases(parseGitHubReleases(payload), isAdmin);
  },
});
