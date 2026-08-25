"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal as _internal } from "./_generated/api";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internal = _internal as any;

// ─── Models ──────────────────────────────────────────────────────────────────
const MODEL_NORMAL = "gpt-4o-mini";
const MODEL_COMPLEX = "gpt-4o";
const MAX_TOKENS_NORMAL = 1024;
const MAX_TOKENS_COMPLEX = 2048;

// ─── Tool definitions ─────────────────────────────────────────────────────────
const CAYLA_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_employees",
      description: "Search for employees by name, department, position, or status",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term" },
          department: { type: "string", description: "Filter by department" },
          status: { type: "string", enum: ["active", "inactive", "all"], description: "Employment status" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_employee",
      description: "Get detailed information about a specific employee",
      parameters: {
        type: "object",
        properties: {
          employeeId: { type: "string", description: "Employee ID or name" },
        },
        required: ["employeeId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_payroll_summary",
      description: "Get a summary of the most recent or a specified payroll period",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Period like 'July 2025' or 'last month'. Leave blank for most recent." },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_payroll_run",
      description: "Get a specific payroll run with full employee breakdown",
      parameters: {
        type: "object",
        properties: {
          month: { type: "string", description: "Month name, e.g. 'July'" },
          year: { type: "number", description: "Year, e.g. 2025" },
        },
        required: ["month", "year"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "calculate_payroll",
      description: "Calculate payroll totals for the current employee roster for a given period",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Period label, e.g. 'August 2025'" },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_tax_breakdown",
      description: "Get PAYE, NIS, and Health Surcharge breakdown for a period or employee",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Period label, e.g. 'July 2025'" },
          employeeId: { type: "string", description: "Specific employee (optional)" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_statutory_deductions",
      description: "Get statutory deductions (NIS, Health Surcharge) for a period",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Period label" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_payroll_anomalies",
      description: "Detect anomalies in payroll data: unusually high/low pay, missing data, inconsistencies",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Period to analyze. Defaults to most recent." },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compare_payroll_periods",
      description: "Compare payroll between two periods and explain differences",
      parameters: {
        type: "object",
        properties: {
          period1: { type: "string", description: "First period, e.g. 'June 2025'" },
          period2: { type: "string", description: "Second period, e.g. 'July 2025'" },
        },
        required: ["period1", "period2"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_attendance_summary",
      description: "Get attendance and overtime summary for a period",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Period label" },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_payslip_email",
      description: "Send a payslip email to a specific employee for a given period",
      parameters: {
        type: "object",
        properties: {
          employeeId: { type: "string", description: "Employee ID or name" },
          period: { type: "string", description: "Payroll period" },
        },
        required: ["employeeId", "period"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_all_payslips",
      description: "Send payslip emails to ALL employees for a given period. THIS IS A SENSITIVE ACTION — requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Payroll period" },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "run_payroll",
      description: "Process and finalize payroll for a given period. THIS IS A SENSITIVE ACTION — requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          period: { type: "string", description: "Payroll period, e.g. 'August 2025'" },
          month: { type: "string" },
          year: { type: "number" },
        },
        required: ["period"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "invite_employee",
      description: "Send an invitation email to an employee to access their payslip portal",
      parameters: {
        type: "object",
        properties: {
          employeeId: { type: "string", description: "Employee ID or name" },
        },
        required: ["employeeId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "invite_team_member",
      description: "Invite a team member to the Sheetpay workspace",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "Email address to invite" },
          role: { type: "string", description: "Role: 'accountant', 'hr_manager', 'viewer'" },
          name: { type: "string", description: "Full name of invitee" },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_business_info",
      description: "Get the current business details: name, address, tax registration, currency",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_employee_count",
      description: "Get total number of active employees and breakdown by department",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_payroll_history",
      description: "Get a list of all past payroll runs with totals",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Number of records to return (default 12)" },
        },
        required: [],
      },
    },
  },
  // ── Reminders ─────────────────────────────────────────────────────────────
  {
    type: "function" as const,
    function: {
      name: "list_reminders",
      description: "List all reminders the current user has scheduled (payroll, attendance, timesheet, etc.).",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_reminder",
      description:
        "Create a scheduled reminder. Only call this AFTER the user has explicitly confirmed the schedule in chat — describe the proposed reminder first, wait for a yes, then call this tool. Times are in the user's local timezone.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["payroll", "attendance", "timesheet", "payslip", "tax_deadline", "custom"],
            description: "Which category of reminder this is",
          },
          title: { type: "string", description: "Short user-facing title, e.g. 'Run weekly payroll'" },
          frequency: {
            type: "string",
            enum: ["once", "daily", "weekly", "biweekly", "monthly", "before_payroll"],
          },
          dayOfWeek: {
            type: "number",
            description: "0=Sun, 1=Mon, …, 6=Sat. Required for weekly/biweekly.",
          },
          dayOfMonth: { type: "number", description: "1-31. Required for monthly." },
          scheduledTime: {
            type: "string",
            description: "HH:MM 24-hour, e.g. '15:00' for 3 PM, in the user's timezone.",
          },
          timezone: {
            type: "string",
            description:
              "IANA timezone id, e.g. 'America/Port_of_Spain'. Default to the business's timezone if unknown.",
          },
          fireOnceAt: {
            type: "number",
            description: "For frequency='once' only: UTC ms when to fire.",
          },
          daysBeforePayroll: {
            type: "number",
            description: "For frequency='before_payroll': how many days ahead of the payroll date.",
          },
          deepLink: {
            type: "string",
            description:
              "Where tapping the notification opens: '/payroll' | '/payroll/current' | '/attendance' | '/payslips' | '/cayla'.",
          },
          messageTemplate: {
            type: "string",
            description: "Optional custom body text. Leave blank to use the default template for `type`.",
          },
        },
        required: ["type", "title", "frequency", "scheduledTime", "timezone"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_reminder",
      description: "Change a reminder's schedule or state. Confirm with the user first.",
      parameters: {
        type: "object",
        properties: {
          reminderId: { type: "string" },
          title: { type: "string" },
          enabled: { type: "boolean" },
          frequency: { type: "string" },
          dayOfWeek: { type: "number" },
          dayOfMonth: { type: "number" },
          scheduledTime: { type: "string" },
          timezone: { type: "string" },
          deepLink: { type: "string" },
          messageTemplate: { type: "string" },
        },
        required: ["reminderId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_reminder",
      description: "Permanently delete a reminder. Always confirm with the user first — this is destructive.",
      parameters: {
        type: "object",
        properties: { reminderId: { type: "string" } },
        required: ["reminderId"],
      },
    },
  },
];

// Sensitive tools that require user confirmation before execution
const SENSITIVE_TOOLS = new Set([
  "run_payroll",
  "send_all_payslips",
  "delete_reminder",
]);

// ─── System prompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(businessName: string, currency: string, currencySymbol: string): string {
  return `You are Cayla, the AI payroll assistant built into Sheetpay — an AI-powered payroll management platform for Caribbean businesses.

Business context:
- Business: ${businessName || "this business"}
- Currency: ${currency} (${currencySymbol})
- Jurisdiction: Trinidad & Tobago / Caribbean (PAYE, NIS, Health Surcharge apply)
- Today: ${new Date().toDateString()}

Your personality:
- Friendly, professional, and concise. You speak like a smart, trusted payroll advisor.
- You proactively flag anomalies, remind about deadlines, and confirm before destructive actions.
- You use the business's currency (${currencySymbol}) when displaying monetary values.
- You always format numbers with 2 decimal places for payroll figures.

Capabilities:
- You can look up employee records, payroll runs, tax breakdowns, and attendance data using the provided tools.
- For SENSITIVE ACTIONS (run_payroll, send_all_payslips), call the tool and it will return a pendingConfirmation object — do NOT execute until the user confirms.
- When the user confirms a pending action, proceed with execution immediately.
- Always be clear when an action will send emails or process money — state what will happen before doing it.
- If you don't have data to answer a question, say so clearly rather than guessing.

Format guidelines:
- Use markdown for tables, bold totals, and lists when presenting payroll data.
- Keep responses short unless the user asks for details.
- Currency format: ${currencySymbol}X,XXX.XX`;
}

// ─── Main chat action ─────────────────────────────────────────────────────────
export const chat = action({
  args: {
    message: v.string(),
    userId: v.string(),
    businessId: v.optional(v.string()),
    confirmingAction: v.optional(v.string()),
    confirmationPayload: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        text: "I'm not available right now — the AI service is not configured. Please contact your administrator.",
        error: "OPENAI_API_KEY not set",
      };
    }

    // Load conversation history
    const conv = await ctx.runQuery(internal.caylaQueries.getConversationHistory, { userId: args.userId });

    // Get business info for system prompt
    let businessName = "your business";
    let currency = "TTD";
    let currencySymbol = "$";

    // Build history from stored conversation
    const historyMessages: any[] = conv
      ? conv.messages.slice(-20).map((m: any) => {
          if (m.role === "tool") {
            return {
              role: "tool",
              tool_call_id: m.toolCallId,
              content: m.content,
            };
          }
          return { role: m.role, content: m.content };
        })
      : [];

    // Handle confirmation of a pending action
    const userMessageContent = args.confirmingAction
      ? `[CONFIRMED: ${args.confirmingAction}] ${args.message}`
      : args.message;

    const messages: any[] = [
      { role: "system", content: buildSystemPrompt(businessName, currency, currencySymbol) },
      ...historyMessages,
      { role: "user", content: userMessageContent },
    ];

    // Get or create conversation ID
    const conversationId = await ctx.runMutation(internal.caylaQueries.getOrCreateConversation, {
      userId: args.userId,
      businessId: args.businessId,
    });

    // Determine model based on message complexity
    const needsComplexModel =
      args.confirmingAction != null ||
      args.message.length > 300 ||
      /compare|analyze|anomal|audit|complex/i.test(args.message);
    const model = needsComplexModel ? MODEL_COMPLEX : MODEL_NORMAL;

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const toolsCalled: string[] = [];
    let pendingConfirmation: any = null;

    // ── Tool calling loop ──────────────────────────────────────────────────────
    for (let iteration = 0; iteration < 8; iteration++) {
      const response = await callOpenAI(apiKey, {
        model,
        messages,
        tools: CAYLA_TOOLS,
        tool_choice: "auto",
        max_tokens: needsComplexModel ? MAX_TOKENS_COMPLEX : MAX_TOKENS_NORMAL,
        temperature: 0.3,
      });

      if (!response.ok) {
        const err = await response.json() as any;
        console.error("[Cayla] OpenAI error:", err);
        return { text: "I ran into an issue connecting to my AI engine. Please try again.", error: err.error?.message };
      }

      const completion = await response.json() as any;
      const choice = completion.choices?.[0];
      const usage = completion.usage;

      if (usage) {
        totalInputTokens += usage.prompt_tokens ?? 0;
        totalOutputTokens += usage.completion_tokens ?? 0;
      }

      const assistantMessage = choice?.message;
      if (!assistantMessage) break;

      messages.push(assistantMessage);

      // No tool calls — we have a final response
      if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
        const finalText = assistantMessage.content ?? "I'm not sure how to help with that.";

        // Save conversation
        const newStoredMessages: any[] = [
          { role: "user", content: args.message, timestamp: Date.now() },
          { role: "assistant", content: finalText, timestamp: Date.now() },
        ];

        await ctx.runMutation(internal.caylaQueries.appendMessages, {
          conversationId,
          newMessages: newStoredMessages,
          tokensUsed: totalInputTokens + totalOutputTokens,
        });

        await ctx.runMutation(internal.caylaQueries.logUsage, {
          userId: args.userId,
          businessId: args.businessId,
          model,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          userMessage: args.message,
          toolsCalled: toolsCalled.length > 0 ? toolsCalled : undefined,
        });

        return {
          text: finalText,
          pendingConfirmation,
          toolsCalled,
        };
      }

      // Execute each tool call
      const toolResults: any[] = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name;
        toolsCalled.push(fnName);
        let args_parsed: any = {};
        try {
          args_parsed = JSON.parse(toolCall.function.arguments || "{}");
        } catch {
          args_parsed = {};
        }

        // Sensitive action — request confirmation instead of executing
        if (SENSITIVE_TOOLS.has(fnName) && !args.confirmingAction?.includes(fnName)) {
          const confirmationDetails = buildConfirmationRequest(fnName, args_parsed);
          pendingConfirmation = confirmationDetails;

          toolResults.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              pendingConfirmation: true,
              message: `This action requires user confirmation: ${confirmationDetails.description}`,
            }),
          });
        } else {
          // Execute the tool
          try {
            const result = await executeToolCall(ctx, fnName, args_parsed, {
              userId: args.userId,
              businessId: args.businessId,
              currency,
              currencySymbol,
            });
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (toolErr: any) {
            toolResults.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: toolErr.message }),
            });
          }
        }
      }

      messages.push(...toolResults);
    }

    // Fallback if loop exits without resolution
    return {
      text: "I couldn't fully process that request. Please try again or rephrase your question.",
      pendingConfirmation,
      toolsCalled,
    };
  },
});

// ─── OpenAI fetch wrapper ─────────────────────────────────────────────────────
async function callOpenAI(apiKey: string, body: any) {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// ─── Confirmation builder ─────────────────────────────────────────────────────
function buildConfirmationRequest(toolName: string, args: any) {
  switch (toolName) {
    case "run_payroll":
      return {
        title: "Process Payroll",
        description: `This will finalize payroll for ${args.period ?? args.month + " " + args.year}. Once confirmed, payslips will be generated for all active employees.`,
        confirmAction: `run_payroll:${JSON.stringify(args)}`,
        cancelAction: "cancel",
        payload: args,
      };
    case "send_all_payslips":
      return {
        title: "Send All Payslips",
        description: `This will send payslip emails to ALL active employees for ${args.period}. This cannot be undone.`,
        confirmAction: `send_all_payslips:${JSON.stringify(args)}`,
        cancelAction: "cancel",
        payload: args,
      };
    default:
      return {
        title: "Confirm Action",
        description: `Confirm: ${toolName}`,
        confirmAction: toolName,
        cancelAction: "cancel",
        payload: args,
      };
  }
}

// ─── Tool executor ────────────────────────────────────────────────────────────
async function executeToolCall(
  ctx: any,
  toolName: string,
  args: any,
  context: { userId: string; businessId?: string; currency: string; currencySymbol: string }
) {
  return await ctx.runAction(internal.caylaInternal.executeTool, {
    toolName,
    args,
    userId: context.userId,
    businessId: context.businessId,
    currency: context.currency,
    currencySymbol: context.currencySymbol,
  });
}
