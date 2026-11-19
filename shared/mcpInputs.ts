export const MCP_TOOLS = [
  "list_clients",
  "get_missing_documents",
  "get_payroll_status",
  "prepare_payroll",
  "get_payroll_preview",
  "get_preparation_status",
  "prepare_client_reminders",
] as const;
export function validateMcpInput(tool: string, raw: unknown): any {
  if (
    !MCP_TOOLS.includes(tool as any) ||
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  )
    throw Error("INVALID_REQUEST");
  const i = raw as Record<string, unknown>;
  const allowed =
    tool === "list_clients"
      ? ["cursor", "limit", "search"]
      : ["get_payroll_preview", "get_preparation_status"].includes(tool)
        ? ["jobId"]
        : tool.startsWith("prepare_")
          ? [
              "clientId",
              "idempotencyKey",
              "periodStart",
              "periodEnd",
              "payDate",
              "timezone",
              ...(tool === "prepare_client_reminders"
                ? ["reminderDate", "reminderTime"]
                : []),
            ]
          : ["clientId", "cursor", "limit"];
  if (Object.keys(i).some((k) => !allowed.includes(k)))
    throw Error("INVALID_REQUEST");
  const out: any = {};
  for (const [k, v] of Object.entries(i)) {
    if (k === "limit") {
      if (!Number.isSafeInteger(v) || Number(v) < 1 || Number(v) > 25)
        throw Error("INVALID_REQUEST");
      out[k] = v;
      continue;
    }
    if (v === null && k === "cursor") {
      out[k] = null;
      continue;
    }
    const max = k === "cursor" ? 4096 : k === "search" ? 100 : 128;
    if (typeof v !== "string" || v.length > max) throw Error("INVALID_REQUEST");
    out[k] = v;
  }
  if (tool === "list_clients") {
    out.limit ??= 20;
    return out;
  }
  if (["get_payroll_preview", "get_preparation_status"].includes(tool)) {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(out.jobId || ""))
      throw Error("INVALID_REQUEST");
    return out;
  }
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(out.clientId || ""))
    throw Error("INVALID_REQUEST");
  if (tool.startsWith("prepare_")) {
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(out.idempotencyKey || ""))
      throw Error("INVALID_REQUEST");
    for (const k of ["periodStart", "periodEnd", "payDate"])
      if (!/^\d{4}-\d{2}-\d{2}$/.test(out[k] || ""))
        throw Error("INVALID_REQUEST");
    try {
      new Intl.DateTimeFormat("en", { timeZone: out.timezone || "" }).format();
    } catch {
      throw Error("INVALID_REQUEST");
    }
    if (
      tool === "prepare_client_reminders" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(out.reminderDate || "") ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(out.reminderTime || ""))
    )
      throw Error("INVALID_REQUEST");
  }
  if (!tool.startsWith("prepare_")) out.limit ??= 10;
  return out;
}
