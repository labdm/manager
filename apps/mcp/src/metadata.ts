import {
  corsHeaders,
  fetchClerkAuthorizationServerMetadata,
  generateClerkProtectedResourceMetadata,
} from "@clerk/mcp-tools/server";
import {
  MCP_SCOPES,
  clerkPublishableKey,
  mcpMetadataConfigError,
  mcpResourceUrl,
} from "./mcp-auth.js";

const NO_STORE = { "Cache-Control": "no-store" };

function json(body: unknown, status: number, cache: Record<string, string>): Response {
  return Response.json(body, { status, headers: { ...cache, ...corsHeaders } });
}

export function metadataOptions(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function authorizationServerMetadata(): Promise<Response> {
  const configError = mcpMetadataConfigError();
  if (configError) return json({ error: configError }, 503, NO_STORE);
  try {
    const metadata = await fetchClerkAuthorizationServerMetadata({
      publishableKey: clerkPublishableKey(),
    });
    return json(metadata, 200, { "Cache-Control": "max-age=3600" });
  } catch {
    return json(
      { error: "Clerk authorization server metadata is unavailable" },
      503,
      NO_STORE,
    );
  }
}

export function protectedResourceMetadata(request: Request): Response {
  const configError = mcpMetadataConfigError();
  if (configError) return json({ error: configError }, 503, NO_STORE);
  const resource = mcpResourceUrl();
  if (resource.kind !== "ok") return json({ error: resource.message }, 503, NO_STORE);

  const metadata = generateClerkProtectedResourceMetadata({
    publishableKey: clerkPublishableKey(),
    resourceUrl: new URL(request.url).origin,
    properties: {
      resource: resource.url,
      scopes_supported: [...MCP_SCOPES],
    },
  });
  return json(metadata, 200, { "Cache-Control": "max-age=3600" });
}
