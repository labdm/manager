export default async function handler(req, res) {
  try {
    const mod = await import("./mcp-impl.js");
    const fn = mod.default;
    if (typeof fn !== "function") {
      const keys = Object.keys(mod).join(",");
      throw new Error("MCP bundle has no default function: " + keys);
    }
    return await fn(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "MCP function failed";
    console.error(error);
    if (res && typeof res.end === "function") {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain");
      res.end(message);
      return;
    }
    return new Response(message, { status: 500 });
  }
}
