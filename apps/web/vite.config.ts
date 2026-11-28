import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version?: string;
};

function gitSha(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (fromVercel) return fromVercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}

const builtAt = process.env.VERCEL_GIT_COMMIT_DATE?.trim() || new Date().toISOString();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 3000 },
  define: {
    __MANAGER_VERSION__: JSON.stringify(pkg.version ?? "0.1.0"),
    __MANAGER_SHA__: JSON.stringify(gitSha()),
    __MANAGER_BUILT_AT__: JSON.stringify(builtAt),
  },
});
