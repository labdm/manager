/** Preview deployments have no published release inventory to show. */
export function shouldLoadReleases(deployEnv?: string): boolean {
  return deployEnv !== "preview";
}
