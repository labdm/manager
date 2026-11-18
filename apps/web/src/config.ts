export function webConfigError(env: {
  convexUrl?: string;
  clerkPublishableKey?: string;
}): string | null {
  const convexUrl = env.convexUrl?.trim() ?? "";
  const clerkPublishableKey = env.clerkPublishableKey?.trim() ?? "";
  const missing: string[] = [];
  if (!convexUrl) missing.push("VITE_CONVEX_URL");
  if (!clerkPublishableKey) missing.push("VITE_CLERK_PUBLISHABLE_KEY");
  if (missing.length > 0) {
    const verb = missing.length === 1 ? "is" : "are";
    return `${missing.join(" and ")} ${verb} not set`;
  }
  if (
    !clerkPublishableKey.startsWith("pk_test_") &&
    !clerkPublishableKey.startsWith("pk_live_")
  ) {
    return "VITE_CLERK_PUBLISHABLE_KEY must be a Clerk publishable key";
  }
  return null;
}
