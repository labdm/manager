import type { IncomingMessage, ServerResponse } from "node:http";

type WebHandler = (request: Request) => Promise<Response> | Response;

function header(req: IncomingMessage, name: string): string {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

/** Supports Vercel's Node req/res handler and the Web Request handler. */
export function vercelHandler(handle: WebHandler) {
  return async function handler(
    req: IncomingMessage | Request,
    res?: ServerResponse,
  ): Promise<Response | void> {
    try {
      if (res === undefined && req instanceof Request) {
        return await handle(req);
      }
      const nodeReq = req as IncomingMessage;
      const host = header(nodeReq, "x-forwarded-host") || header(nodeReq, "host") || "manager.labdm.dev";
      const proto = header(nodeReq, "x-forwarded-proto") || "https";
      const url = `${proto}://${host}${nodeReq.url || "/"}`;
      const body = await readBody(nodeReq);
      const request = new Request(url, {
        method: nodeReq.method,
        headers: nodeReq.headers as HeadersInit,
        body: body ? new Uint8Array(body) : undefined,
      });
      const response = await handle(request);
      if (!res) return response;
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : "Unknown error";
      console.error(message);
      if (res) {
        res.statusCode = 500;
        res.end("Function error");
        return;
      }
      return new Response("Function error", { status: 500 });
    }
  };
}
