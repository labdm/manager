import { authorizationServerMetadata, metadataOptions } from "../apps/mcp/src/metadata.js";
import { vercelHandler } from "../apps/mcp/src/vercel-handler.js";

const handler = vercelHandler((request) =>
  request.method === "OPTIONS" ? metadataOptions() : authorizationServerMetadata(),
);

export default handler;
export const GET = handler;
export const OPTIONS = handler;
