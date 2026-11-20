import { describe, expect, it } from "vitest";
import type { DownloadAsset } from "@manager/backend/convex/lib/downloadAssets";
import {
  assetFormat,
  assetVariant,
  groupAssetsByPlatform,
} from "../src/downloadAssetsView";

function asset(name: string, platform: DownloadAsset["platform"]): DownloadAsset {
  return { platform, name, url: `https://example.test/${name}`, size: 1, updatedAt: "" };
}

describe("assetFormat", () => {
  it("recognizes both archive formats", () => {
    expect(assetFormat("Manager-macOS-Desktop-v1.zip")).toBe("zip");
    expect(assetFormat("Manager-macOS-Native-v1.tar.gz")).toBe("tar.gz");
    expect(assetFormat("Manager-macOS-Desktop-v1.dmg")).toBe("dmg");
    expect(assetFormat("Manager-Windows-v1.msi")).toBe("msi");
    expect(assetFormat("Manager-Windows-v1.exe")).toBe("exe");
  });
});

describe("assetVariant", () => {
  it("labels builds that share a platform", () => {
    expect(assetVariant("Manager-macOS-Native-v1.zip")).toBe("Native app");
    expect(assetVariant("Manager-macOS-Desktop-v1.dmg")).toBe("Desktop app");
    expect(assetVariant("Manager-iOS-Simulator-v1.zip")).toBe("Simulator");
    expect(assetVariant("manager-web-v1.zip")).toBeNull();
  });
});

describe("groupAssetsByPlatform", () => {
  it("groups both macOS builds and puts zip first", () => {
    const groups = groupAssetsByPlatform(
      [
        asset("Manager-macOS-Native-v1.tar.gz", "macos"),
        asset("manager-web-v1.zip", "web"),
        asset("Manager-macOS-Native-v1.zip", "macos"),
        asset("Manager-macOS-Desktop-v1.dmg", "macos"),
        asset("Manager-macOS-Desktop-v1.zip", "macos"),
      ],
      ["web", "macos"],
    );

    expect(groups.map((group) => group.platform)).toEqual(["web", "macos"]);
    expect(groups[1].assets.map((item) => item.name)).toEqual([
      "Manager-macOS-Desktop-v1.dmg",
      "Manager-macOS-Desktop-v1.zip",
      "Manager-macOS-Native-v1.zip",
      "Manager-macOS-Native-v1.tar.gz",
    ]);
  });
});
