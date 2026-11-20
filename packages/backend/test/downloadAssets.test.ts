import { describe, expect, it } from "vitest";
import {
  classifyAssetName,
  parseGitHubReleases,
  visibleAssets,
} from "../convex/lib/downloadAssets";

describe("classifyAssetName", () => {
  it("recognises the release asset names", () => {
    expect(classifyAssetName("manager-web-v0.1.0.zip")).toBe("web");
    expect(classifyAssetName("Manager-macOS-Native-v0.1.0.zip")).toBe("macos");
    expect(classifyAssetName("Manager-macOS-Desktop-v0.1.0.dmg")).toBe("macos");
    expect(classifyAssetName("Manager-Windows-v0.1.0.zip")).toBe("windows");
    expect(classifyAssetName("Manager-Android-v0.1.0.apk")).toBe("android");
    expect(classifyAssetName("manager-android-v0.1.0.aab")).toBe("android");
    expect(classifyAssetName("Manager-iOS-Simulator-v0.1.0.zip")).toBe("ios");
  });

  it("ignores other assets", () => {
    expect(classifyAssetName("source_code.tar.gz")).toBeNull();
    expect(classifyAssetName("checksums.txt")).toBeNull();
  });
});

describe("parseGitHubReleases", () => {
  it("only keeps releases with recognisable assets", () => {
    const releases = parseGitHubReleases([
      {
        tag_name: "v0.1.0",
        name: "Manager v0.1.0",
        html_url: "https://github.com/labdm/manager/releases/tag/v0.1.0",
        published_at: "2026-11-20T00:00:00Z",
        assets: [
          {
            name: "manager-web-v0.1.0.zip",
            browser_download_url: "https://example.com/web.zip",
            size: 10,
            updated_at: "2026-11-20T00:00:00Z",
          },
          {
            name: "checksums.txt",
            browser_download_url: "https://example.com/checksums.txt",
            size: 4,
            updated_at: "2026-11-20T00:00:00Z",
          },
        ],
      },
      { tag_name: "v0.0.9", assets: [] },
    ]);

    expect(releases).toHaveLength(1);
    expect(releases[0]?.assets.map((asset) => asset.platform)).toEqual(["web"]);
  });

  it("rejects non-list payloads", () => {
    expect(parseGitHubReleases(null)).toEqual([]);
  });
});

describe("visibleAssets", () => {
  const assets = [
    { platform: "web", name: "web.zip", url: "", size: 1, updatedAt: "" },
    { platform: "windows", name: "windows.zip", url: "", size: 1, updatedAt: "" },
    { platform: "macos", name: "mac.zip", url: "", size: 1, updatedAt: "" },
    { platform: "android", name: "android.apk", url: "", size: 1, updatedAt: "" },
    { platform: "ios", name: "ios.zip", url: "", size: 1, updatedAt: "" },
  ] as const;

  it("hides iOS builds from non-admins", () => {
    expect(visibleAssets([...assets], false).map((asset) => asset.platform)).toEqual([
      "web",
      "windows",
      "macos",
      "android",
    ]);
  });

  it("shows every platform to admins", () => {
    expect(visibleAssets([...assets], true)).toHaveLength(5);
  });
});
