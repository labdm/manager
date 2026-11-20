/**
 * Clerk sends the browser here after OAuth. It must be a real HTTPS page: a
 * custom scheme URL leaves the browser tab hanging on a loading indicator.
 */
export const OAUTH_REDIRECT_URL =
  "https://manager.labdm.dev/oauth-callback.html";

/** The callback page forwards Clerk's parameters to this registered deep link. */
export const APP_CALLBACK_URL = "dev.labdm.manager://callback";

export function isOAuthCallback(
  url: string | undefined,
  previous: string[] | null,
): boolean {
  return !!url && url.startsWith(APP_CALLBACK_URL) && !previous?.includes(url);
}
