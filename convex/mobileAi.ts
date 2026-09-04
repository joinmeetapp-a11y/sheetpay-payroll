"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

// OpenAI-backed OCR + AI-create actions shaped for the Sheetpay Mobile
// (Sheetpay-Mobile) app. Returns match the shape OCRReviewModal.tsx and
// the AI Create flow already expect, so the mobile app can call these
// directly without any client-side translation.

const OPENAI_URL = "https://api.openai.com/v1";
const VISION_MODEL = "gpt-4o";
const TEXT_MODEL = "gpt-4o";

const MOBILE_PAYSLIP_SCHEMA = `Return ONLY valid JSON matching this schema:
{
  "employerName": string,
  "employerAddress": string,
  "employerPhone": string,
  "employerEmail": string,
  "employerTaxNumber": string,
  "employeeName": string,
  "employeeId": string,
  "jobTitle": string,
  "department": string,
  "employeeEmail": string,
  "employeePhone": string,
  "employeeAddress": string,
  "payPeriodStart": string,
  "payPeriodEnd": string,
  "payDate": string,
  "payFrequency": string,
  "currency": string,
  "hoursWorked": number,
  "hourlyRate": number,
  "regularEarnings": number,
  "overtimeHours": number,
  "overtimeRate": number,
  "overtimePay": number,
  "earnings": [
    { "label": string, "amount": number, "hours": number, "rate": number }
  ],
  "deductions": [
    { "label": string, "amount": number, "category": string }
  ],
  "grossPay": number,
  "totalDeductions": number,
  "netPay": number,
  "confidenceScore": number,
  "uncertainFields": [string],
  "notes": string
}

Rules:
- Use empty string "" (not null) for missing string fields; use 0 for missing numbers.
- confidenceScore is 0-100.
- uncertainFields lists the exact JSON keys that were hard to read or ambiguous.
- Numeric fields must be raw numbers (no currency symbols, no commas).
- category values: "tax", "pension", "insurance", "loan", or "other".
- payFrequency: "weekly", "biweekly", "semimonthly", or "monthly".`;

// Sanitize the raw JSON the model returns so the mobile UI never crashes
// on nulls or missing keys. Mirrors OCRReviewModal.tsx's defaults.
function normalizeMobilePayslip(input: unknown): Record<string, unknown> {
  const src = (input as Record<string, unknown>) || {};
  const asString = (k: string) =>
    typeof src[k] === "string" ? (src[k] as string) : "";
  const asNumber = (k: string) => {
    const v = src[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };
  const asArray = (k: string) => (Array.isArray(src[k]) ? src[k] as unknown[] : []);

  const earnings = asArray("earnings").map((e) => {
    const row = (e as Record<string, unknown>) || {};
    return {
      label: typeof row.label === "string" ? row.label : "Regular Pay",
      amount: Number(row.amount) || 0,
      hours: Number(row.hours) || 0,
      rate: Number(row.rate) || 0,
    };
  });

  const deductions = asArray("deductions").map((d) => {
    const row = (d as Record<string, unknown>) || {};
    return {
      label: typeof row.label === "string" ? row.label : "Deduction",
      amount: Number(row.amount) || 0,
      category:
        typeof row.category === "string" ? row.category : "other",
    };
  });

  return {
    employerName: asString("employerName"),
    employerAddress: asString("employerAddress"),
    employerPhone: asString("employerPhone"),
    employerEmail: asString("employerEmail"),
    employerTaxNumber: asString("employerTaxNumber"),
    employeeName: asString("employeeName"),
    employeeId: asString("employeeId"),
    jobTitle: asString("jobTitle"),
    department: asString("department"),
    employeeEmail: asString("employeeEmail"),
    employeePhone: asString("employeePhone"),
    employeeAddress: asString("employeeAddress"),
    payPeriodStart: asString("payPeriodStart"),
    payPeriodEnd: asString("payPeriodEnd"),
    payDate: asString("payDate"),
    payFrequency: asString("payFrequency"),
    currency: asString("currency") || "USD",
    hoursWorked: asNumber("hoursWorked"),
    hourlyRate: asNumber("hourlyRate"),
    regularEarnings: asNumber("regularEarnings"),
    overtimeHours: asNumber("overtimeHours"),
    overtimeRate: asNumber("overtimeRate"),
    overtimePay: asNumber("overtimePay"),
    earnings,
    deductions,
    grossPay: asNumber("grossPay"),
    totalDeductions: asNumber("totalDeductions"),
    netPay: asNumber("netPay"),
    confidenceScore: Math.min(100, Math.max(0, asNumber("confidenceScore") || 85)),
    uncertainFields: asArray("uncertainFields").filter(
      (v) => typeof v === "string",
    ) as string[],
    notes: asString("notes"),
  };
}

async function callOpenAI(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const res = await fetch(`${OPENAI_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// OCR: image of a payslip / wage stub → mobile-shaped payslip fields.
// Called by Sheetpay Mobile's App.tsx handleProcessScan flow.
export const extractPayslip = action({
  args: {
    base64Data: v.string(),
    mimeType: v.string(),
  },
  handler: async (_ctx, args): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    if (!args.mimeType.startsWith("image/")) {
      return {
        success: false,
        error: "Only image uploads are supported. Convert PDFs to images first.",
      };
    }

    const dataUrl = `data:${args.mimeType};base64,${args.base64Data.replace(/^data:[^;]+;base64,/, "")}`;

    try {
      const parsed = await callOpenAI({
        model: VISION_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are Sheetpay's specialized global payroll OCR engine. Extract structured fields from a payslip, payroll register, or wage stub. Never invent numbers. If a field is not present, use empty string or 0.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: MOBILE_PAYSLIP_SCHEMA },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 4096,
        temperature: 0,
      });

      return { success: true, data: normalizeMobilePayslip(parsed) };
    } catch (err: unknown) {
      console.error("[mobileAi.extractPayslip] failed:", err);
      return {
        success: false,
        error: (err as { message?: string })?.message ?? "OCR failed",
      };
    }
  },
});

// AI Create: natural-language prompt → mobile-shaped payslip fields.
// Called by Sheetpay Mobile's AICreateModal.tsx.
export const generatePayslip = action({
  args: {
    prompt: v.string(),
  },
  handler: async (_ctx, args): Promise<{ success: boolean; data?: unknown; error?: string }> => {
    if (!args.prompt.trim()) {
      return { success: false, error: "Prompt is required." };
    }

    try {
      const parsed = await callOpenAI({
        model: TEXT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are Sheetpay's intelligent payroll assistant. Convert the user's natural-language request into a complete, structured payslip. Compute hours × rate, overtime (default 1.5× regular unless the user says otherwise), bonuses, gross pay, total deductions and net pay. Never invent employer details the user did not state; leave those blank.",
          },
          {
            role: "user",
            content: `${MOBILE_PAYSLIP_SCHEMA}\n\nUser request: ${args.prompt.trim()}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 2048,
        temperature: 0.2,
      });

      return { success: true, data: normalizeMobilePayslip(parsed) };
    } catch (err: unknown) {
      console.error("[mobileAi.generatePayslip] failed:", err);
      return {
        success: false,
        error: (err as { message?: string })?.message ?? "AI generation failed",
      };
    }
  },
});
