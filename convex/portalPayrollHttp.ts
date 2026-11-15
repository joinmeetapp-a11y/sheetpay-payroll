import { httpAction } from "./_generated/server";
import { anyApi } from "convex/server";
import { ConvexError } from "convex/values";
export const portalPayrollHttp = httpAction(async (ctx, request) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  try {
    if (
      !/^Bearer sp_portal_[a-f0-9]{64}$/.test(
        request.headers.get("authorization") || "",
      )
    )
      return new Response(JSON.stringify({ error: "PAYROLL_UNAUTHORIZED" }), {
        status: 401,
        headers,
      });
    if (!request.headers.get("content-type")?.includes("application/json"))
      return new Response(JSON.stringify({ error: "JSON is required" }), {
        status: 415,
        headers,
      });
    if (Number(request.headers.get("content-length") || 0) > 40000)
      return new Response(JSON.stringify({ error: "Request too large" }), {
        status: 413,
        headers,
      });
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Missing body");
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 40000) {
        await reader.cancel();
        return new Response(JSON.stringify({ error: "Request too large" }), {
          status: 413,
          headers,
        });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("Invalid JSON body");
    const token = (request.headers.get("authorization") || "").replace(
      /^Bearer /,
      "",
    );
    await ctx.runMutation(anyApi.portalPayroll.consumeRate, {
      token,
      organizationId:
        typeof body.organizationId === "string" ? body.organizationId : "",
    });
    const result = await ctx.runMutation(anyApi.portalPayroll.execute, {
      token,
      body,
    });
    return new Response(JSON.stringify(result), { headers });
  } catch (error) {
    const data = error instanceof ConvexError ? error.data : null;
    const message =
      typeof data === "string"
        ? data
        : data &&
            typeof data === "object" &&
            "code" in data &&
            data.code === "PLAN_LIMIT_REACHED" &&
            "message" in data &&
            typeof data.message === "string"
          ? data.message
          : "Payroll request failed. Check the Sheetpay backend logs.";
    const status =
      message === "PAYROLL_UNAUTHORIZED"
        ? 401
        : message === "PAYROLL_RATE_LIMITED"
          ? 429
          : data
            ? 400
            : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: {
        ...headers,
        ...(status === 429 ? { "Retry-After": "60" } : {}),
      },
    });
  }
});
