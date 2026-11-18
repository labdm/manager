import { handleMcp } from "../apps/mcp/src/handle-mcp";

export function GET(request: Request): Promise<Response> {
  return handleMcp(request);
}

export function POST(request: Request): Promise<Response> {
  return handleMcp(request);
}

export function DELETE(request: Request): Promise<Response> {
  return handleMcp(request);
}
