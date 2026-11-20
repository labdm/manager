import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// tauri-plugin-clerk 0.1.1 rewrites plugin-http's IPC call by looking for a
// JSON `clientConfig` body. plugin-http 2.9 moved that config into a
// `client-config` header, so Clerk calls started carrying both Origin and
// Authorization and the app failed before rendering. Keep both sides pinned.
const pluginHttpPackage = JSON.parse(
  readFileSync(
    new URL(
      "../node_modules/@tauri-apps/plugin-http/package.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { version: string };

const pluginHttpSource = readFileSync(
  new URL(
    "../node_modules/@tauri-apps/plugin-http/dist-js/index.js",
    import.meta.url,
  ),
  "utf8",
);

const cargoToml = readFileSync(
  new URL("../src-tauri/Cargo.toml", import.meta.url),
  "utf8",
);

describe("plugin-http compatibility", () => {
  it("uses the IPC payload shape expected by tauri-plugin-clerk", () => {
    expect(pluginHttpPackage.version).toBe("2.8.3");
    expect(pluginHttpSource).toContain("clientConfig:");
    expect(pluginHttpSource).not.toContain("'client-config'");
  });

  it("pins the Rust plugin to the same version", () => {
    expect(cargoToml).toContain('tauri-plugin-http = { version = "=2.8.3"');
  });
});
