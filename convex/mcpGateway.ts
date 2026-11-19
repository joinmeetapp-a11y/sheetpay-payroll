"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { anyApi } from "convex/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { validateMcpInput } from "../shared/mcpInputs";
const api: any = anyApi;
let keys: ReturnType<typeof createRemoteJWKSet> | undefined;
export const invoke = internalAction({
  args: {
    token: v.string(),
    tool: v.string(),
    input: v.any(),
    requestId: v.string(),
  },
  handler: async (ctx, a): Promise<any> => {
    const issuer = process.env.MCP_ISSUER_URL,
      resource = issuer ? `${issuer.replace(/\/$/, "")}/mcp` : null;
    if (!issuer || !resource) throw Error("NOT_CONFIGURED");
    if (a.token.length > 16384 || a.requestId.length > 100)
      throw Error("INVALID_REQUEST");
    keys ??= createRemoteJWKSet(new URL(`${issuer.replace(/\/$/, "")}/jwks`));
    const { payload: p } = await jwtVerify(a.token, keys, {
      issuer,
      audience: resource,
      algorithms: ["RS256"],
      requiredClaims: [
        "exp",
        "iat",
        "jti",
        "sub",
        "scope",
        "client_id",
        "grant_id",
        "connection_id",
      ],
      maxTokenAge: "6m",
    });
    if (
      typeof p.sub !== "string" ||
      typeof p.scope !== "string" ||
      typeof p.client_id !== "string" ||
      typeof p.jti !== "string" ||
      typeof p.connection_id !== "string" ||
      typeof p.grant_id !== "string"
    )
      throw Error("INVALID_TOKEN");

    const principal = {
      sub: p.sub,
      connectionId: p.connection_id,
      clientId: p.client_id,
      grantId: p.grant_id,
      jti: p.jti,
      scopes: p.scope.split(" "),
    };
    try {
      const input = validateMcpInput(a.tool, a.input);
      return await ctx.runMutation(api.mcp.execute, {
        principal,
        tool: a.tool,
        input,
        requestId: a.requestId,
      });
    } catch (error: any) {
      await ctx.runMutation(api.mcp.auditDenied, {
        principal,
        tool: a.tool,
        requestId: a.requestId,
        resourceReference:
          typeof a.input?.clientId === "string"
            ? a.input.clientId.slice(0, 128)
            : typeof a.input?.jobId === "string"
              ? a.input.jobId.slice(0, 128)
              : undefined,
      });
      const allowed = [
        "RATE_LIMITED",
        "IDEMPOTENCY_CONFLICT",
        "INVALID_REQUEST",
        "NO_EMPLOYEES",
        "CLIENT_TOO_LARGE",
        "INSUFFICIENT_SCOPE",
      ];
      const code = allowed.includes(error?.data?.code)
        ? error.data.code
        : error?.message === "INVALID_REQUEST"
          ? "INVALID_REQUEST"
          : "ACCESS_DENIED";
      return {
        _mcpError: {
          code,
          message:
            "Review permissions, request limits and source records in Sheetpay.",
        },
      };
    }
  },
});
