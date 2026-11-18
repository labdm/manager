import { authorizationServerMetadata, metadataOptions } from "../../apps/mcp/src/metadata.js";
import { vercelHandler } from "../../apps/mcp/src/vercel-handler.js";

const handler = vercelHandler((request: Request) =>
  request.method === "OPTIONS" ? metadataOptions() : authorizationServerMetadata(),
);

export default handler;
