/// <reference types="vite/client" />

declare module "*.css";

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  readonly VITE_DEPLOY_ENV?: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
}

declare const __MANAGER_VERSION__: string;
declare const __MANAGER_SHA__: string;
declare const __MANAGER_BUILT_AT__: string;

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
