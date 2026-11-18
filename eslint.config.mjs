import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/_generated/**",
      "**/public/**",
      "coverage/**",
      "pnpm-lock.yaml",
      "api/mcp.js",
      "api/mcp-impl.js",
      "api/oauth-authorization-server.js",
      "api/oauth-protected-resource.js",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
