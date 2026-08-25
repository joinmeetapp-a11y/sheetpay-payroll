"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const OPENAI_URL = "https://api.openai.com/v1";
const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";
const VISION_MODEL = "gpt-4o";

/**
 * Transcribe an audio blob (base64) via OpenAI's audio transcription endpoint.
 * Used by the onboarding voice tutorial and the Cayla transcript fallback path.
 */
export const transcribeAudio = action({
  args: {
    audioBase64: v.string(),
    mimeType: v.string(),
    language: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { text: "", error: "OPENAI_API_KEY not configured" };
    }

    const buf = Buffer.from(args.audioBase64, "base64");
    const ext =
      (args.mimeType.split("/")[1] || "webm").split(";")[0].replace("x-", "") ||
      "webm";
    const blob = new Blob([buf], { type: args.mimeType });

    const form = new FormData();
    form.append("file", blob, `audio.${ext}`);
    form.append("model", TRANSCRIBE_MODEL);
    if (args.language) form.append("language", args.language);
    form.append("response_format", "json");

    try {
      const res = await fetch(`${OPENAI_URL}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("[ai.transcribeAudio] OpenAI error:", err);
        return { text: "", error: `OpenAI ${res.status}` };
      }
      const json = (await res.json()) as { text?: string };
      return { text: json.text ?? "" };
    } catch (err: any) {
      console.error("[ai.transcribeAudio] fetch failed:", err);
      return { text: "", error: err?.message ?? "network error" };
    }
  },
});

/**
 * Extract structured payroll data from an image of a payslip / register.
 * Returns null-filled fields for anything not visible — the client is
 * responsible for surfacing "needs review" prompts to the user.
 */
export const extractPayrollDocument = action({
  args: {
    fileBase64: v.string(),
    mimeType: v.string(),
    fileName: v.optional(v.string()),
    // Firebase uid — required for authenticated users so we can enforce the
    // free-plan OCR cap and record usage. Optional to preserve backwards
    // compatibility with any anonymous caller; the anonymous path skips
    // enforcement but also doesn't count toward any account.
    requesterUid: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        error: "OPENAI_API_KEY not configured",
        employees: [],
      };
    }

    if (!args.mimeType.startsWith("image/")) {
      return {
        ok: false,
        error: "OCR only supports image uploads. Convert PDFs to images first.",
        employees: [],
      };
    }

    // Enforce free-plan OCR cap BEFORE burning an OpenAI vision call. The
    // check runs against the caller's account; over-limit throws which we
    // convert to a structured error the UI translates into an upgrade prompt.
    if (args.requesterUid) {
      try {
        await ctx.runMutation(internal.usage.internalAssertLimitByUid, {
          firebaseUid: args.requesterUid,
          kind: "ocr",
        });
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        if (msg.includes("FREE_LIMIT_REACHED")) {
          return {
            ok: false,
            error: "FREE_LIMIT_REACHED:ocr",
            reason: "Your free-plan OCR scans are used up for this month. Upgrade to keep scanning.",
            employees: [],
          };
        }
        throw err;
      }
    }

    const dataUrl = `data:${args.mimeType};base64,${args.fileBase64}`;

    const schemaDescription = `Return ONLY valid JSON matching this schema:
{
  "businessName": string | null,
  "taxId": string | null,
  "nisEmployerId": string | null,
  "currency": string | null,
  "periodLabel": string | null,
  "employees": [
    {
      "name": string,
      "employeeId": string | null,
      "position": string | null,
      "department": string | null,
      "basicSalary": number | null,
      "allowances": number | null,
      "overtimeHours": number | null,
      "bonus": number | null,
      "paye": number | null,
      "nis": number | null,
      "healthSurcharge": number | null,
      "otherDeductions": number | null,
      "grossPay": number | null,
      "netPay": number | null,
      "birNumber": string | null,
      "nisNumber": string | null,
      "payFrequency": "monthly" | "fortnightly" | "weekly" | null
    }
  ]
}

Rules:
- Extract every employee row visible in the document.
- Never invent values. Use null when a field is missing or unclear.
- Numeric fields: return raw numbers (no currency symbols, no commas).
- If the document shows a single payslip, return a single-employee array.`;

    const body = {
      model: VISION_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a strict payroll OCR engine for Caribbean payroll documents (PAYE, NIS, Health Surcharge). Only return JSON.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: schemaDescription },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 4096,
      temperature: 0,
    };

    try {
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
        console.error("[ai.extractPayrollDocument] OpenAI error:", err);
        return { ok: false, error: `OpenAI ${res.status}`, employees: [] };
      }
      const json = (await res.json()) as any;
      const content = json.choices?.[0]?.message?.content ?? "{}";
      let parsed: any = {};
      try {
        parsed = JSON.parse(content);
      } catch {
        parsed = {};
      }
      const employees = Array.isArray(parsed.employees) ? parsed.employees : [];

      // Count usage only for genuinely successful extractions. A parse failure
      // that returns zero employees should not consume a scan. opId derived
      // from a hash of the fileName + first-employee marker so a UI retry of
      // the same file dedupes; different files get different ids.
      if (args.requesterUid && employees.length > 0) {
        const marker = `${args.fileName ?? "ocr"}:${employees[0]?.name ?? ""}:${employees.length}`;
        const opId = `ocr:${marker}`;
        try {
          await ctx.runMutation(internal.usage.internalIncrementByUid, {
            firebaseUid: args.requesterUid,
            kind: "ocr",
            opId,
          });
        } catch (err) {
          console.error("[ai.extractPayrollDocument] usage increment failed:", err);
        }
      }

      return {
        ok: true,
        businessName: parsed.businessName ?? null,
        taxId: parsed.taxId ?? null,
        nisEmployerId: parsed.nisEmployerId ?? null,
        currency: parsed.currency ?? null,
        periodLabel: parsed.periodLabel ?? null,
        employees,
        fileName: args.fileName ?? null,
      };
    } catch (err: any) {
      console.error("[ai.extractPayrollDocument] fetch failed:", err);
      return {
        ok: false,
        error: err?.message ?? "network error",
        employees: [],
      };
    }
  },
});
