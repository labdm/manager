import type { BuildInfo } from "@manager/ui";

export const buildInfo: BuildInfo = {
  version: __MANAGER_VERSION__,
  sha: __MANAGER_SHA__,
  builtAt: __MANAGER_BUILT_AT__,
};
