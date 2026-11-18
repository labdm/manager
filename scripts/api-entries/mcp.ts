import { handleMcp } from "../../apps/mcp/src/handle-mcp.js";
import { vercelHandler } from "../../apps/mcp/src/vercel-handler.js";

const handler = vercelHandler(handleMcp);

export default handler;
