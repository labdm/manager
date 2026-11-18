import { metadataOptions, protectedResourceMetadata } from "../apps/mcp/src/metadata.js";

export function GET(request: Request): Response {
  return protectedResourceMetadata(request);
}

export function OPTIONS(): Response {
  return metadataOptions();
}
