import { describe, expect, it } from "vitest";
import type { DownloadAsset } from "@manager/backend/convex/lib/downloadAssets";
import {
  assetFormat,
  groupAssetsByPlatform,
} from "../src/downloadAssetsView";

function asset(name: string, platform: DownloadAsset["platform"]): DownloadAsset {
  return { platform, name, url: `https://example.test/${name}`, size: 1, updatedAt: "" };
}

describe("assetFormat", () => {
  it("recognizes both archive formats", () => {
    expect(assetFormat("Manager-macOS-v1.zip")).toBe("zip");
    expect(assetFormat("Manager-macOS-v1.tar.gz")).toBe("tar.gz");
  });
});

describe("groupAssetsByPlatform", () => {
  it("groups by platform and puts zip first", () => {
    const groups = groupAssetsByPlatform(
      [
        asset("Manager-macOS-v1.tar.gz", "macos"),
        asset("manager-web-v1.zip", "web"),
        asset("Manager-macOS-v1.zip", "macos"),
      ],
      ["web", "macos"],
    );

    expect(groups.map((group) => group.platform)).toEqual(["web", "macos"]);
    expect(groups[1].assets.map((item) => item.name)).toEqual([
      "Manager-macOS-v1.zip",
      "Manager-macOS-v1.tar.gz",
    ]);
  });
});
