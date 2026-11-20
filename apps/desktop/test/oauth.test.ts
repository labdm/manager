import { describe, expect, it } from "vitest";
import {
  APP_CALLBACK_URL,
  isOAuthCallback,
  OAUTH_REDIRECT_URL,
} from "../src/oauth";

describe("desktop OAuth URLs", () => {
  it("sends the browser to the hosted completion page", () => {
    expect(OAUTH_REDIRECT_URL).toBe(
      "https://manager.labdm.dev/oauth-callback.html",
    );
  });

  it("keeps the registered deep link for the app callback", () => {
    expect(APP_CALLBACK_URL).toBe("dev.labdm.manager://callback");
  });

  it("accepts a fresh callback URL", () => {
    expect(
      isOAuthCallback(
        "dev.labdm.manager://callback?__clerk_status=complete",
        null,
      ),
    ).toBe(true);
  });

  it("ignores a URL already seen and unrelated URLs", () => {
    const callback = `${APP_CALLBACK_URL}?rotating_token_nonce=abc`;
    expect(isOAuthCallback(callback, [callback])).toBe(false);
    expect(isOAuthCallback("https://example.com/", null)).toBe(false);
    expect(isOAuthCallback(undefined, null)).toBe(false);
  });
});
