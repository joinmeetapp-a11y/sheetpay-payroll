"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal as _internal } from "./_generated/api";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internal = _internal as any;

export const executeTool = internalAction({
  args: {
    toolName: v.string(),
    args: v.any(),
    userId: v.string(),
    businessId: v.optional(v.string()),
    currency: v.string(),
    currencySymbol: v.string(),
  },
  handler: async (ctx, params): Promise<any> => {
    const { toolName, args, userId, businessId, currency, currencySymbol } = params;
    const sym = currencySymbol;

    switch (toolName) {
      // ── Employee tools ──────────────────────────────────────────────────────
      case "search_employees": {
        const employees: any[] = await ctx.runQuery(internal.caylaQueries.getEmployeesForUser, { userId });
        const query = (args.query ?? "").toLowerCase();
        const dept = (args.department ?? "").toLowerCase();
        const status = args.status ?? "all";

        let results = employees.filter((e) => {
          const matchesQuery =
            !query ||
            e.name?.toLowerCase().includes(query) ||
            e.employeeId?.toLowerCase().includes(query) ||
            e.position?.toLowerCase().includes(query) ||
            e.department?.toLowerCase().includes(query);
          const matchesDept = !dept || e.department?.toLowerCase().includes(dept);
          const matchesStatus = status === "all" || e.status === status;
          return matchesQuery && matchesDept && matchesStatus;
        });

        return {
          count: results.length,
          employees: results.slice(0, 10).map((e) => ({
            id: e.employeeId,
            name: e.name,
            position: e.position,
            department: e.department,
            status: e.status,
            netPay: `${sym}${Number(e.netPay ?? 0).toFixed(2)}`,
            grossPay: `${sym}${Number(e.grossPay ?? 0).toFixed(2)}`,
          })),
        };
      }

      case "get_employee": {
        const employees: any[] = await ctx.runQuery(internal.caylaQueries.getEmployeesForUser, { userId });
        const id = (args.employeeId ?? "").toLowerCase();
        const emp = employees.find(
          (e) =>
            e.employeeId?.toLowerCase() === id ||
            e.name?.toLowerCase().includes(id) ||
            e._id === args.employeeId
        );

        if (!emp) return { error: `No employee found matching "${args.employeeId}"` };

        return {
          id: emp.employeeId,
          name: emp.name,
          position: emp.position,
          department: emp.department,
          status: emp.status,
          email: emp.email,
          payFrequency: emp.payFrequency,
          basicPay: `${sym}${Number(emp.basicPay ?? 0).toFixed(2)}`,
          grossPay: `${sym}${Number(emp.grossPay ?? 0).toFixed(2)}`,
          netPay: `${sym}${Number(emp.netPay ?? 0).toFixed(2)}`,
          paye: `${sym}${Number(emp.paye ?? 0).toFixed(2)}`,
          nis: `${sym}${Number(emp.nis ?? 0).toFixed(2)}`,
          healthSurcharge: `${sym}${Number(emp.healthSurcharge ?? 0).toFixed(2)}`,
          overtimeHours: emp.overtimeHours,
          overtimeRate: emp.overtimeRate,
          bonus: `${sym}${Number(emp.bonus ?? 0).toFixed(2)}`,
          commission: `${sym}${Number(emp.commission ?? 0).toFixed(2)}`,
          allowances: `${sym}${Number(emp.allowances ?? 0).toFixed(2)}`,
        };
      }

      case "get_employee_count": {
        const employees: any[] = await ctx.runQuery(internal.caylaQueries.getEmployeesForUser, { userId });
        const active = employees.filter((e) => e.status === "active" || e.status !== "inactive");
        const byDept: Record<string, number> = {};
        for (const e of active) {
          byDept[e.department ?? "Other"] = (byDept[e.department ?? "Other"] ?? 0) + 1;
        }
        return {
          total: employees.length,
          active: active.length,
          inactive: employees.length - active.length,
          byDepartment: byDept,
        };
      }

      // ── Payroll tools ───────────────────────────────────────────────────────
      case "get_payroll_summary": {
        const runs: any[] = await ctx.runQuery(internal.caylaQueries.getPayrollRunsForUser, { userId });
        if (runs.length === 0) return { message: "No payroll runs found yet." };

        let targetRun = runs[0];
        if (args.period) {
          const p = args.period.toLowerCase();
          targetRun =
            runs.find(
              (r) =>
                r.periodLabel?.toLowerCase().includes(p) ||
                r.month?.toLowerCase().includes(p)
            ) ?? runs[0];
        }

        return formatPayrollRun(targetRun, sym);
      }

      case "get_payroll_run": {
        const runs: any[] = await ctx.runQuery(internal.caylaQueries.getPayrollRunsForUser, { userId });
        const month = (args.month ?? "").toLowerCase();
        const year = args.year;
        const run = runs.find(
          (r) =>
            r.month?.toLowerCase() === month && (!year || r.year === year)
        );
        if (!run) return { error: `No payroll run found for ${args.month} ${args.year ?? ""}`.trim() };
        return formatPayrollRunDetailed(run, sym);
      }

      case "get_payroll_history": {
        const runs: any[] = await ctx.runQuery(internal.caylaQueries.getPayrollRunsForUser, { userId });
        const limit = args.limit ?? 12;
        return {
          count: runs.length,
          runs: runs.slice(0, limit).map((r) => ({
            period: r.periodLabel ?? `${r.month} ${r.year}`,
            status: r.status,
            employees: r.employeesSnapshot?.length ?? 0,
            totalGross: `${sym}${Number(r.totalGross ?? 0).toFixed(2)}`,
            totalNet: `${sym}${Number(r.totalNet ?? 0).toFixed(2)}`,
          })),
        };
      }

      case "calculate_payroll": {
        const employees: any[] = await ctx.runQuery(internal.caylaQueries.getEmployeesForUser, { userId });
        const active = employees.filter((e) => e.status !== "inactive");

        const totals = active.reduce(
          (acc, e) => ({
            gross: acc.gross + (e.grossPay ?? 0),
            net: acc.net + (e.netPay ?? 0),
            paye: acc.paye + (e.paye ?? 0),
            nis: acc.nis + (e.nis ?? 0),
            health: acc.health + (e.healthSurcharge ?? 0),
          }),
          { gross: 0, net: 0, paye: 0, nis: 0, health: 0 }
        );

        return {
          period: args.period,
          employeeCount: active.length,
          totalGross: `${sym}${totals.gross.toFixed(2)}`,
          totalNet: `${sym}${totals.net.toFixed(2)}`,
          totalPAYE: `${sym}${totals.paye.toFixed(2)}`,
          totalNIS: `${sym}${totals.nis.toFixed(2)}`,
          totalHealthSurcharge: `${sym}${totals.health.toFixed(2)}`,
          totalDeductions: `${sym}${(totals.paye + totals.nis + totals.health).toFixed(2)}`,
        };
      }

      case "get_tax_breakdown": {
        const runs: any[] = await ctx.runQuery(internal.caylaQueries.getPayrollRunsForUser, { userId });
        let run = runs[0];
        if (args.period) {
          const p = args.period.toLowerCase();
          run = runs.find((r) => r.periodLabel?.toLowerCase().includes(p) || r.month?.toLowerCase().includes(p)) ?? runs[0];
        }
        if (!run) return { message: "No payroll data found." };

        const breakdown: any = {
          period: run.periodLabel ?? `${run.month} ${run.year}`,
          paye: `${sym}${Number(run.totalPaye ?? 0).toFixed(2)}`,
          nis: `${sym}${Number(run.totalNis ?? 0).toFixed(2)}`,
          healthSurcharge: `${sym}${Number(run.totalHealthSurcharge ?? 0).toFixed(2)}`,
          totalDeductions: `${sym}${Number(run.totalDeductions ?? 0).toFixed(2)}`,
        };

        if (args.employeeId && run.employeesSnapshot) {
          const id = args.employeeId.toLowerCase();
          const emp = run.employeesSnapshot.find(
            (e: any) => e.name?.toLowerCase().includes(id) || e.employeeId?.toLowerCase() === id
          );
          if (emp) {
            breakdown.employee = {
              name: emp.name,
              paye: `${sym}${Number(emp.paye ?? 0).toFixed(2)}`,
              nis: `${sym}${Number(emp.nis ?? 0).toFixed(2)}`,
              healthSurcharge: `${sym}${Number(emp.healthSurcharge ?? 0).toFixed(2)}`,
            };
          }
        }

        return breakdown;
      }

      case "get_statutory_deductions": {
        const runs: any[] = await ctx.runQuery(internal.caylaQueries.getPayrollRunsForUser, { userId });
        let run = runs[0];
        if (args.period) {
          const p = args.period.toLowerCase();
          run = runs.find((r) => r.periodLabel?.toLowerCase().includes(p) || r.month?.toLowerCase().includes(p)) ?? runs[0];
        }
        if (!run) return { message: "No payroll data found." };
        return {
          period: run.periodLabel ?? `${run.month} ${run.year}`,
          nis: `${sym}${Number(run.totalNis ?? 0).toFixed(2)}`,
          healthSurcharge: `${sym}${Number(run.totalHealthSurcharge ?? 0).toFixed(2)}`,
          paye: `${sym}${Number(run.totalPaye ?? 0).toFixed(2)}`,
          total: `${sym}${Number(run.totalDeductions ?? 0).toFixed(2)}`,
        };
      }

      case "find_payroll_anomalies": {
        const employees: any[] = await ctx.runQuery(internal.caylaQueries.getEmployeesForUser, { userId });
        const runs: any[] = await ctx.runQuery(internal.caylaQueries.getPayrollRunsForUser, { userId });

        const anomalies: string[] = [];

        // Check for employees with missing email
        const noEmail = employees.filter((e) => !e.email && e.status !== "inactive");
        if (noEmail.length > 0) {
          anomalies.push(`${noEmail.length} active employee(s) have no email address and won't receive payslips: ${noEmail.slice(0, 3).map((e) => e.name).join(", ")}${noEmail.length > 3 ? " ..." : ""}`);
        }

        // Check for zero net pay
        const zeroNet = employees.filter((e) => (e.netPay ?? 0) <= 0 && e.status !== "inactive");
        if (zeroNet.length > 0) {
          anomalies.push(`${zeroNet.length} active employee(s) have zero or negative net pay: ${zeroNet.map((e) => e.name).join(", ")}`);
        }

        // Check for unusually high overtime
        const highOT = employees.filter((e) => (e.overtimeHours ?? 0) > 40);
        if (highOT.length > 0) {
          anomalies.push(`${highOT.length} employee(s) have >40 overtime hours logged: ${highOT.map((e) => e.name).join(", ")}`);
        }

        // Compare last two payroll runs for large changes
        if (runs.length >= 2) {
          const diff = Math.abs(runs[0].totalNet - runs[1].totalNet);
          const pct = runs[1].totalNet > 0 ? (diff / runs[1].totalNet) * 100 : 0;
          if (pct > 20) {
            anomalies.push(
              `Total net payroll changed by ${pct.toFixed(1)}% between ${runs[1].periodLabel ?? runs[1].month} (${sym}${Number(runs[1].totalNet).toFixed(2)}) and ${runs[0].periodLabel ?? runs[0].month} (${sym}${Number(runs[0].totalNet).toFixed(2)})`
            );
          }
        }

        if (anomalies.length === 0) {
          return { status: "clean", message: "No anomalies detected in payroll data." };
        }

        return { status: "anomalies_found", count: anomalies.length, anomalies };
      }

      case "compare_payroll_periods": {
        const runs: any[] = await ctx.runQuery(internal.caylaQueries.getPayrollRunsForUser, { userId });

        const find = (period: string) => {
          const p = period.toLowerCase();
          return runs.find((r) => r.periodLabel?.toLowerCase().includes(p) || r.month?.toLowerCase().includes(p));
        };

        const run1 = find(args.period1);
        const run2 = find(args.period2);

        if (!run1) return { error: `No payroll data found for ${args.period1}` };
        if (!run2) return { error: `No payroll data found for ${args.period2}` };

        const diff = (a: number, b: number) => {
          const d = a - b;
          const pct = b !== 0 ? ((d / b) * 100).toFixed(1) : "N/A";
          return { diff: `${sym}${d >= 0 ? "+" : ""}${d.toFixed(2)}`, pct: `${pct}%` };
        };

        return {
          period1: { label: run1.periodLabel ?? `${run1.month} ${run1.year}`, ...formatPayrollRun(run1, sym) },
          period2: { label: run2.periodLabel ?? `${run2.month} ${run2.year}`, ...formatPayrollRun(run2, sym) },
          changes: {
            grossPay: diff(run1.totalGross, run2.totalGross),
            netPay: diff(run1.totalNet, run2.totalNet),
            paye: diff(run1.totalPaye, run2.totalPaye),
            nis: diff(run1.totalNis, run2.totalNis),
            healthSurcharge: diff(run1.totalHealthSurcharge, run2.totalHealthSurcharge),
            employeeCount: diff(run1.employeesSnapshot?.length ?? 0, run2.employeesSnapshot?.length ?? 0),
          },
        };
      }

      case "get_attendance_summary": {
        const employees: any[] = await ctx.runQuery(internal.caylaQueries.getEmployeesForUser, { userId });
        const withOT = employees.filter((e) => (e.overtimeHours ?? 0) > 0);
        const totalOT = employees.reduce((s, e) => s + (e.overtimeHours ?? 0), 0);
        return {
          period: args.period ?? "Current",
          totalEmployees: employees.length,
          employeesWithOvertime: withOT.length,
          totalOvertimeHours: totalOT,
          overtimeDetails: withOT.slice(0, 5).map((e) => ({
            name: e.name,
            hours: e.overtimeHours,
            rate: `${sym}${Number(e.overtimeRate ?? 0).toFixed(2)}`,
          })),
        };
      }

      // ── Email / invite tools ────────────────────────────────────────────────
      case "send_payslip_email": {
        const employees: any[] = await ctx.runQuery(internal.caylaQueries.getEmployeesForUser, { userId });
        const id = (args.employeeId ?? "").toLowerCase();
        const emp = employees.find(
          (e) => e.name?.toLowerCase().includes(id) || e.employeeId?.toLowerCase() === id
        );

        if (!emp) return { error: `Employee not found: ${args.employeeId}` };
        if (!emp.email) return { error: `${emp.name} has no email address on file` };

        const result = await ctx.runAction(internal.emailService.sendEmailInternal, {
          to: emp.email,
          emailType: "employeePayslip",
          data: {
            employeeName: emp.name,
            period: args.period,
            businessName: "",
            grossPay: Number(emp.grossPay ?? 0).toFixed(2),
            netPay: Number(emp.netPay ?? 0).toFixed(2),
            currency: currency,
            deductions: [
              { label: "PAYE", amount: Number(emp.paye ?? 0).toFixed(2) },
              { label: "NIS", amount: Number(emp.nis ?? 0).toFixed(2) },
              { label: "Health Surcharge", amount: Number(emp.healthSurcharge ?? 0).toFixed(2) },
            ].filter((d) => parseFloat(d.amount) > 0),
            payslipLink: "https://mysheetpay.web.app/app",
          },
          userId,
          businessId,
        });

        return {
          success: result.success,
          message: result.success
            ? `Payslip email sent to ${emp.name} (${emp.email})`
            : `Failed to send: ${result.error}`,
        };
      }

      case "send_all_payslips": {
        const employees: any[] = await ctx.runQuery(internal.caylaQueries.getEmployeesForUser, { userId });
        const withEmail = employees.filter((e) => e.email && e.status !== "inactive");
        const noEmail = employees.filter((e) => !e.email && e.status !== "inactive");

        let sent = 0;
        let failed = 0;

        for (const emp of withEmail) {
          const result = await ctx.runAction(internal.emailService.sendEmailInternal, {
            to: emp.email,
            emailType: "employeePayslip",
            data: {
              employeeName: emp.name,
              period: args.period,
              grossPay: Number(emp.grossPay ?? 0).toFixed(2),
              netPay: Number(emp.netPay ?? 0).toFixed(2),
              currency,
              deductions: [
                { label: "PAYE", amount: Number(emp.paye ?? 0).toFixed(2) },
                { label: "NIS", amount: Number(emp.nis ?? 0).toFixed(2) },
                { label: "Health Surcharge", amount: Number(emp.healthSurcharge ?? 0).toFixed(2) },
              ].filter((d) => parseFloat(d.amount) > 0),
              payslipLink: "https://mysheetpay.web.app/app",
            },
            userId,
            businessId,
          });
          if (result.success) sent++;
          else failed++;
        }

        return {
          success: true,
          period: args.period,
          sent,
          failed,
          skipped: noEmail.length,
          message: `Sent ${sent} payslips for ${args.period}${failed > 0 ? `, ${failed} failed` : ""}${noEmail.length > 0 ? `, ${noEmail.length} skipped (no email)` : ""}.`,
        };
      }

      case "run_payroll": {
        const employees: any[] = await ctx.runQuery(internal.caylaQueries.getEmployeesForUser, { userId });
        const active = employees.filter((e) => e.status !== "inactive");

        const totals = active.reduce(
          (acc, e) => ({
            gross: acc.gross + (e.grossPay ?? 0),
            net: acc.net + (e.netPay ?? 0),
            paye: acc.paye + (e.paye ?? 0),
            nis: acc.nis + (e.nis ?? 0),
            health: acc.health + (e.healthSurcharge ?? 0),
            deductions: acc.deductions + (e.paye ?? 0) + (e.nis ?? 0) + (e.healthSurcharge ?? 0) + (e.otherDeductions ?? 0),
          }),
          { gross: 0, net: 0, paye: 0, nis: 0, health: 0, deductions: 0 }
        );

        const now = new Date();
        const month = args.month ?? now.toLocaleString("en", { month: "long" });
        const year = args.year ?? now.getFullYear();

        await ctx.runMutation(internal.caylaQueries.savePayrollRun, {
          userId,
          businessId: businessId ?? "",
          month,
          year,
          periodLabel: args.period ?? `${month} ${year}`,
          employeesSnapshot: active,
          totalGross: totals.gross,
          totalPaye: totals.paye,
          totalNis: totals.nis,
          totalHealthSurcharge: totals.health,
          totalDeductions: totals.deductions,
          totalNet: totals.net,
        });

        return {
          success: true,
          period: args.period ?? `${month} ${year}`,
          employeeCount: active.length,
          totalGross: `${sym}${totals.gross.toFixed(2)}`,
          totalNet: `${sym}${totals.net.toFixed(2)}`,
          message: `Payroll for ${args.period ?? month + " " + year} has been processed for ${active.length} employees.`,
        };
      }

      case "invite_employee": {
        const employees: any[] = await ctx.runQuery(internal.caylaQueries.getEmployeesForUser, { userId });
        const id = (args.employeeId ?? "").toLowerCase();
        const emp = employees.find(
          (e) => e.name?.toLowerCase().includes(id) || e.employeeId?.toLowerCase() === id
        );
        if (!emp) return { error: `Employee not found: ${args.employeeId}` };
        if (!emp.email) return { error: `${emp.name} has no email address on file` };

        const result = await ctx.runAction(internal.emailService.sendEmailInternal, {
          to: emp.email,
          emailType: "payslipGenerated",
          data: {
            employeeName: emp.name,
            period: "your latest payroll period",
            businessName: "",
          },
          userId,
          businessId,
        });

        return {
          success: result.success,
          message: result.success
            ? `Invitation sent to ${emp.name} at ${emp.email}`
            : `Failed to send invitation: ${result.error}`,
        };
      }

      case "invite_team_member": {
        // Cayla now uses the full invitation flow (record + secure token +
        // rate-limited resend) instead of firing a raw email.
        const biz: any = await ctx.runQuery(internal.caylaQueries.getBusinessForUser, { userId });
        const businessName = biz?.name || "your workspace";
        const result: any = await ctx.runAction(internal.emails.inviteTeamMember as any, {
          organizationId: businessId ?? String(biz?._id ?? userId),
          businessName,
          invitedByUserId: userId,
          inviterName: args.name ?? "Your administrator",
          inviteeEmail: args.email,
          role: args.role ?? "Team Member",
          appOrigin: "https://sheetpay.app",
        });
        return {
          success: !!result.ok,
          message: result.ok
            ? `Team invitation sent to ${args.name ?? args.email}`
            : `Failed to send: ${result.error ?? "unknown"}`,
        };
      }

      // ── Business tools ──────────────────────────────────────────────────────
      case "get_business_info": {
        const biz: any = await ctx.runQuery(internal.caylaQueries.getBusinessForUser, { userId });
        if (!biz) return { message: "No business information found." };
        return {
          name: biz.name,
          address: biz.address,
          email: biz.email,
          phone: biz.phone,
          currency: biz.currency,
          taxRegistrationId: biz.taxRegistrationId,
          nisNumber: biz.nisNumber,
        };
      }

      // ── Reminders ───────────────────────────────────────────────────────────
      case "list_reminders": {
        // Uses internal query (no requesterUid roundtrip needed here since
        // we're already inside a trusted server-side executeTool with a
        // validated userId).
        const rows: any[] = await ctx.runQuery(internal.reminders.listRemindersForCayla, {
          userId: userId as any,
        });
        if (rows.length === 0) return { reminders: [], message: "No reminders set up yet." };
        return {
          reminders: rows.map((r: any) => ({
            id: r._id,
            title: r.title,
            type: r.type,
            frequency: r.frequency,
            dayOfWeek: r.dayOfWeek ?? null,
            dayOfMonth: r.dayOfMonth ?? null,
            scheduledTime: r.scheduledTime,
            timezone: r.timezone,
            enabled: r.enabled,
            nextRunAt: r.nextRunAt,
            deepLink: r.deepLink ?? null,
          })),
        };
      }

      case "create_reminder": {
        try {
          const { id } = await ctx.runMutation(internal.reminders.createReminderForCayla, {
            userId: userId as any,
            type: args.type,
            title: args.title,
            frequency: args.frequency,
            dayOfWeek: args.dayOfWeek,
            dayOfMonth: args.dayOfMonth,
            scheduledTime: args.scheduledTime,
            timezone: args.timezone,
            fireOnceAt: args.fireOnceAt,
            daysBeforePayroll: args.daysBeforePayroll,
            deepLink: args.deepLink,
            messageTemplate: args.messageTemplate,
          });
          return { ok: true, reminderId: id, message: `Reminder "${args.title}" saved.` };
        } catch (err: any) {
          return { ok: false, error: String(err?.message ?? err) };
        }
      }

      case "update_reminder": {
        try {
          const { reminderId, ...patch } = args;
          await ctx.runMutation(internal.reminders.updateReminderForCayla, {
            userId: userId as any,
            reminderId: reminderId as any,
            patch,
          });
          return { ok: true, message: "Reminder updated." };
        } catch (err: any) {
          return { ok: false, error: String(err?.message ?? err) };
        }
      }

      case "delete_reminder": {
        try {
          await ctx.runMutation(internal.reminders.deleteReminderForCayla, {
            userId: userId as any,
            reminderId: args.reminderId as any,
          });
          return { ok: true, message: "Reminder deleted." };
        } catch (err: any) {
          return { ok: false, error: String(err?.message ?? err) };
        }
      }

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatPayrollRun(run: any, sym: string) {
  return {
    period: run.periodLabel ?? `${run.month} ${run.year}`,
    status: run.status,
    employeeCount: run.employeesSnapshot?.length ?? 0,
    totalGross: `${sym}${Number(run.totalGross ?? 0).toFixed(2)}`,
    totalNet: `${sym}${Number(run.totalNet ?? 0).toFixed(2)}`,
    totalPAYE: `${sym}${Number(run.totalPaye ?? 0).toFixed(2)}`,
    totalNIS: `${sym}${Number(run.totalNis ?? 0).toFixed(2)}`,
    totalHealthSurcharge: `${sym}${Number(run.totalHealthSurcharge ?? 0).toFixed(2)}`,
    totalDeductions: `${sym}${Number(run.totalDeductions ?? 0).toFixed(2)}`,
  };
}

function formatPayrollRunDetailed(run: any, sym: string) {
  const base = formatPayrollRun(run, sym);
  return {
    ...base,
    employees: (run.employeesSnapshot ?? []).slice(0, 20).map((e: any) => ({
      name: e.name,
      department: e.department,
      grossPay: `${sym}${Number(e.grossPay ?? 0).toFixed(2)}`,
      netPay: `${sym}${Number(e.netPay ?? 0).toFixed(2)}`,
      paye: `${sym}${Number(e.paye ?? 0).toFixed(2)}`,
      nis: `${sym}${Number(e.nis ?? 0).toFixed(2)}`,
    })),
  };
}
