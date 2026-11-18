import {
  authorizationServerMetadata,
  metadataOptions,
} from "../apps/mcp/src/metadata.js";

export function GET(): Promise<Response> {
  return authorizationServerMetadata();
}

export function OPTIONS(): Response {
  return metadataOptions();
}
