import { httpAction } from "./_generated/server";
import { anyApi } from "convex/server";
const api: any = anyApi;
async function boundedText(request: Request, max: number) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw Error("REQUEST_TOO_LARGE");
    }
    chunks.push(value);
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    buffer.set(c, offset);
    offset += c.length;
  }
  return new TextDecoder().decode(buffer);
}
const reply = (value: any, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
export const tools = httpAction(async (ctx, request) => {
  try {
    const raw = await boundedText(request, 65536);
    if (raw.length > 65536) return reply({ error: "REQUEST_TOO_LARGE" }, 413);
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer ([^ ]+)$/)?.[1];
    if (!token) return reply({ error: "UNAUTHENTICATED" }, 401);
    const body = JSON.parse(raw),
      requestId =
        typeof body.requestId === "string"
          ? body.requestId
          : crypto.randomUUID();
    const result = await ctx.runAction(api.mcpGateway.invoke, {
      token,
      tool: body.tool,
      input: body.input,
      requestId,
    });
    if (result?._mcpError) {
      const code = result._mcpError.code;
      return reply(
        { error: code, message: result._mcpError.message },
        code === "RATE_LIMITED"
          ? 429
          : code === "IDEMPOTENCY_CONFLICT"
            ? 409
            : code === "INVALID_REQUEST"
              ? 400
              : 403,
      );
    }
    return reply(result);
  } catch {
    return reply(
      {
        error: "ACCESS_DENIED",
        message:
          "Operation denied or unavailable. Review access and source data in Sheetpay.",
      },
      403,
    );
  }
});
export const store = httpAction(async (ctx, request) => {
  const secret = process.env.MCP_STORAGE_SECRET,
    provided = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || !provided || provided.length > 512)
    return reply({ error: "UNAUTHORIZED" }, 401);
  const digest = async (s: string) =>
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    );
  const [a, b] = await Promise.all([digest(secret), digest(provided)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff) return reply({ error: "UNAUTHORIZED" }, 401);
  try {
    const raw = await boundedText(request, 70000);
    if (raw.length > 70000) return reply({ error: "REQUEST_TOO_LARGE" }, 413);
    return reply(await ctx.runMutation(api.mcpStore.operate, JSON.parse(raw)));
  } catch {
    return reply({ error: "INVALID_REQUEST" }, 400);
  }
});
