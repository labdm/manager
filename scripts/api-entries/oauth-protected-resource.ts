import { metadataOptions, protectedResourceMetadata } from "../../apps/mcp/src/metadata.js";
import { vercelHandler } from "../../apps/mcp/src/vercel-handler.js";

const handler = vercelHandler((request: Request) =>
  request.method === "OPTIONS" ? metadataOptions() : protectedResourceMetadata(request),
);

export default handler;
