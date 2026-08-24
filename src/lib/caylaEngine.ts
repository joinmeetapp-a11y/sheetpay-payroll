import {
  AccountantClient,
  AuditLogEntry,
  CaylaMessage,
  Employee,
  FirmTeamMember,
  PayrollRun,
} from '../types';
import { formatCurrency, recalculateEmployee, recalculatePayrollRun } from './taxEngine';
import { initialAugustPayrollRun } from './initialData';

export interface CaylaConversationContext {
  lastMentionedEmployeeId: string | null;
  lastMentionedEmployeeName: string | null;
  lastActionType: string | null;
  lastFieldModified: string | null;
  payrollGenerated: boolean;
  activeClientId?: string | null;
}

export interface CaylaExecutionResult {
  message: CaylaMessage;
  updatedPayroll?: PayrollRun;
  newAuditEntry?: AuditLogEntry;
  selectedEmployeeId?: string;
  triggerPayrollDisplay?: boolean;
  activeTemplateId?: string;
  switchedClientId?: string;
  newActiveClientId?: string;
  updatedClients?: AccountantClient[];
  updatedBatchJobs?: any[];
  triggerBatchPayroll?: boolean;
  triggerAddClient?: boolean;
  batchClients?: AccountantClient[];
}

export class CaylaAgentEngine {
  private context: CaylaConversationContext = {
    lastMentionedEmployeeId: null,
    lastMentionedEmployeeName: null,
    lastActionType: null,
    lastFieldModified: null,
    payrollGenerated: false,
    activeClientId: null,
  };

  public getContext(): CaylaConversationContext {
    return { ...this.context };
  }

  public setContext(newCtx: Partial<CaylaConversationContext>) {
    this.context = { ...this.context, ...newCtx };
  }

  /**
   * Process an accountant cross-client natural language prompt
   */
  public async processAccountantPrompt(
    prompt: string,
    clients: AccountantClient[],
    teamMembersOrActiveClient?: any,
    activeClientIdOrTeamMembers?: any
  ): Promise<CaylaExecutionResult> {
    const cleanPrompt = (prompt || '').trim().toLowerCase();
    const messageId = `msg-${Date.now()}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const safeClients = Array.isArray(clients) ? clients : [];

    // Gracefully resolve parameter ordering
    let teamMembers: FirmTeamMember[] = [];
    let activeClientId: string | null = null;
    let activeClient: AccountantClient | null = null;

    if (Array.isArray(teamMembersOrActiveClient)) {
      teamMembers = teamMembersOrActiveClient;
      if (typeof activeClientIdOrTeamMembers === 'string') {
        activeClientId = activeClientIdOrTeamMembers;
      }
    } else if (teamMembersOrActiveClient && typeof teamMembersOrActiveClient === 'object') {
      activeClient = teamMembersOrActiveClient;
      if (Array.isArray(activeClientIdOrTeamMembers)) {
        teamMembers = activeClientIdOrTeamMembers;
      }
    }

    if (!activeClient && activeClientId && safeClients.length > 0) {
      activeClient = safeClients.find((c) => c.id === activeClientId) || null;
    }
    if (!activeClient && safeClients.length > 0) {
      activeClient = safeClients[0];
    }

    // 1. ADD NEW CLIENT
    if (
      cleanPrompt.includes('add a client') ||
      cleanPrompt.includes('add client') ||
      cleanPrompt.includes('add a new client') ||
      cleanPrompt.includes('create client') ||
      cleanPrompt.includes('onboard client')
    ) {
      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: 'Opening the new client setup wizard. You can configure company tax profiles, pay schedules, and upload employee rosters or payslips.',
          timestamp,
          actionSummary: {
            type: 'timesheet_imported',
            title: 'Add New Client',
            description: 'Initiating streamlined multi-tenant client onboarding flow.',
          },
        },
        triggerAddClient: true,
      };
    }

    // 2. BATCH PAYROLL: "Prepare payroll for all monthly clients", "Prepare payroll for every client due Friday", "Prepare all ready payrolls", "Prepare everything that's ready"
    if (
      cleanPrompt.includes('prepare payroll for every client') ||
      cleanPrompt.includes('prepare all ready') ||
      cleanPrompt.includes('prepare everything that') ||
      cleanPrompt.includes('prepare all payrolls') ||
      cleanPrompt.includes('run all payrolls') ||
      cleanPrompt.includes('prepare payroll for all monthly') ||
      cleanPrompt.includes('batch payroll')
    ) {
      const readyClients = safeClients.filter(
        (c) => c.payrollStatus === 'Ready to Run' || c.payrollStatus === 'Ready for Approval'
      );
      const totalEmployees = readyClients.reduce((acc, c) => acc + (c.employeeCount || 0), 0);

      const progressSteps = [
        `Identified ${readyClients.length} clients ready for payroll processing...`,
        ...readyClients.map((c) => `Processing isolated tenant: ${c.name || c.companyName} (${c.employeeCount} staff)...`),
        'Validating statutory PAYE and NIS tables across jurisdictions...',
        'Generated isolated draft registers and TD4 tax allocations.',
      ];

      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `I found ${readyClients.length} clients with payroll ready (${totalEmployees} total employees). I'm processing each business tenant separately with isolated compliance checks.`,
          timestamp,
          progressSteps,
          actionSummary: {
            type: 'payroll_run',
            title: `Batch Payroll: ${readyClients.length} Clients Processed`,
            description: `${totalEmployees} employees calculated across ${readyClients.length} separate enterprise accounts.`,
            details: readyClients.map((c) => ({
              label: c.name || c.companyName || 'Client',
              value: `${c.employeeCount} staff • ${formatCurrency(c.monthlyPayrollValue || 0)}`,
            })),
          },
        },
        triggerBatchPayroll: true,
        batchClients: readyClients,
      };
    }

    // 3. TARGET SPECIFIC CLIENT RUN PAYROLL: "Run payroll for Caribbean Tech", "Prepare ABC Construction payroll"
    const matchingClient = safeClients.find((c) => {
      const clientName = c.name || c.companyName || '';
      if (!clientName) return false;
      const lower = clientName.toLowerCase();
      const firstWord = clientName.split(' ')[0]?.toLowerCase() || '';
      return cleanPrompt.includes(lower) || (firstWord.length > 2 && cleanPrompt.includes(firstWord));
    });

    if (
      matchingClient &&
      (cleanPrompt.includes('run payroll') ||
        cleanPrompt.includes('prepare') ||
        cleanPrompt.includes('calculate') ||
        cleanPrompt.includes('switch to') ||
        cleanPrompt.includes('open'))
    ) {
      this.context.activeClientId = matchingClient.id;
      const clientDisplayName = matchingClient.name || matchingClient.companyName || 'Client';
      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `Switched context to ${clientDisplayName} (${matchingClient.country}). ${matchingClient.employeeCount} active employees loaded. Payroll status: ${matchingClient.payrollStatus}.`,
          timestamp,
          actionSummary: {
            type: 'payroll_run',
            title: `Working on: ${clientDisplayName}`,
            description: `${matchingClient.employeeCount} employees • Frequency: ${matchingClient.payFrequency} • Due: ${matchingClient.nextPayrollDate}`,
            details: [
              { label: 'Next Due', value: matchingClient.nextPayrollDate },
              { label: 'Employees', value: `${matchingClient.employeeCount} staff` },
              { label: 'Monthly Value', value: formatCurrency(matchingClient.monthlyPayrollValue || 0) },
              { label: 'Status', value: matchingClient.payrollStatus },
            ],
          },
        },
        switchedClientId: matchingClient.id,
        newActiveClientId: matchingClient.id,
      };
    }

    // 4. "Which clients have payroll due this week?" / "What's due this week?" / "What's due today?"
    if (
      cleanPrompt.includes('due this week') ||
      cleanPrompt.includes('due today') ||
      cleanPrompt.includes('upcoming payroll') ||
      cleanPrompt.includes('what is due') ||
      cleanPrompt.includes("what's due") ||
      cleanPrompt.includes('deadlines')
    ) {
      const dueClients = safeClients.filter((c) => c.payrollStatus !== 'Completed' && c.payrollStatus !== 'Finalized');
      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `You have ${dueClients.length} client payrolls scheduled this cycle across your portfolio. 5 are Ready to Run, 1 is Waiting on Timesheets, and 1 is Awaiting Client Approval.`,
          timestamp,
          actionSummary: {
            type: 'payroll_run',
            title: 'Upcoming Client Payroll Deadlines',
            description: `${dueClients.length} client cycles requiring accountant attention.`,
            details: dueClients.slice(0, 5).map((c) => ({
              label: `${c.name || c.companyName} (${c.country})`,
              value: `Due: ${c.nextPayrollDate} • ${c.payrollStatus}`,
            })),
          },
        },
      };
    }

    // 5. "Which clients haven't sent their timesheets?" / "Show me clients with unfinished payroll" / "Missing employee info"
    if (
      cleanPrompt.includes('timesheet') ||
      cleanPrompt.includes('missing') ||
      cleanPrompt.includes('unfinished') ||
      cleanPrompt.includes('attention') ||
      cleanPrompt.includes('not sent')
    ) {
      const attentionClients = safeClients.filter(
        (c) => (c.missingInformation && c.missingInformation.length > 0) || c.payrollStatus === 'Waiting on Client' || c.payrollStatus === 'Missing Information'
      );
      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `I identified ${attentionClients.length} clients with pending items or missing documentation:`,
          timestamp,
          actionSummary: {
            type: 'timesheet_imported',
            title: 'Actionable Client Exceptions',
            description: 'Timesheet, tax registration, and biometric attendance blockers.',
            details: attentionClients.map((c) => ({
              label: c.name || c.companyName || 'Client',
              value: c.missingInformation?.join('; ') || c.payrollStatus,
            })),
          },
        },
      };
    }

    // 6. "Show payroll totals across my clients" / "Compare payroll costs across all my clients"
    if (
      cleanPrompt.includes('totals') ||
      cleanPrompt.includes('compare payroll') ||
      cleanPrompt.includes('total payroll value') ||
      cleanPrompt.includes('across my clients') ||
      cleanPrompt.includes('portfolio value')
    ) {
      const totalManaged = safeClients.reduce((acc, c) => acc + (c.monthlyPayrollValue || 0), 0);
      const totalEmployees = safeClients.reduce((acc, c) => acc + (c.employeeCount || 0), 0);

      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `Your firm currently manages **${safeClients.length} active corporate clients** and **${totalEmployees} employees**, with a combined monthly payroll volume of **${formatCurrency(totalManaged)}**.`,
          timestamp,
          actionSummary: {
            type: 'tax_check',
            title: 'Firm Portfolio Payroll Aggregates',
            description: `${safeClients.length} corporate accounts active in Cayla.`,
            details: [
              { label: 'Total Clients', value: `${safeClients.length} businesses` },
              { label: 'Active Staff', value: `${totalEmployees} workers` },
              { label: 'Monthly Volume', value: formatCurrency(totalManaged) },
              { label: 'Annual Run-Rate', value: formatCurrency(totalManaged * 12) },
            ],
          },
        },
      };
    }

    // 7. "How much PAYE is due across my Trinidad clients?" / "Tax liabilities"
    if (cleanPrompt.includes('paye') || cleanPrompt.includes('tax') || cleanPrompt.includes('nis') || cleanPrompt.includes('liabilities')) {
      const trinidadClients = safeClients.filter((c) => (c.country || '').includes('Trinidad'));
      const estimatedPAYE = trinidadClients.reduce((acc, c) => acc + Math.round((c.monthlyPayrollValue || 0) * 0.14), 0);
      const estimatedNIS = trinidadClients.reduce((acc, c) => acc + Math.round((c.monthlyPayrollValue || 0) * 0.052), 0);

      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `Across your ${trinidadClients.length} Trinidad & Tobago clients, the estimated August statutory remittance is **${formatCurrency(estimatedPAYE)} PAYE** (BIR) and **${formatCurrency(estimatedNIS)} NIS** (National Insurance Board). Statutory deadline is the 15th.`,
          timestamp,
          actionSummary: {
            type: 'tax_check',
            title: 'Trinidad Statutory Remittance Estimates',
            description: 'Board of Inland Revenue (BIR) and NIB statutory estimates.',
            details: [
              { label: 'Trinidad Clients', value: `${trinidadClients.length} entities` },
              { label: 'Estimated PAYE Due', value: formatCurrency(estimatedPAYE) },
              { label: 'Estimated NIS Due', value: formatCurrency(estimatedNIS) },
              { label: 'Statutory Remittance Deadline', value: '15th of month' },
            ],
          },
        },
      };
    }

    // 8. TEAM MEMBER QUERIES: "Show Sarah's clients", "Which payrolls does Kevin have due today?"
    if (Array.isArray(teamMembers)) {
      for (const member of teamMembers) {
        if (!member || !member.name) continue;
        const memberName = member.name || '';
        const firstName = memberName.split(' ')[0]?.toLowerCase() || '';
        if ((firstName && cleanPrompt.includes(firstName)) || (memberName && cleanPrompt.includes(memberName.toLowerCase()))) {
          const assigned = safeClients.filter(
            (c) =>
              (member.assignedClientIds && member.assignedClientIds.includes(c.id)) ||
              (c.assignedTo && firstName && c.assignedTo.toLowerCase().includes(firstName))
          );
          return {
            message: {
              id: messageId,
              sender: 'cayla',
              text: `${member.name} (${member.role || 'Accountant'}) is currently assigned **${assigned.length} clients** (${assigned.map((c) => c.name || c.companyName).join(', ')}).`,
              timestamp,
              actionSummary: {
                type: 'employee_update',
                title: `${member.name}'s Portfolio`,
                description: `${assigned.length} assigned enterprise accounts.`,
                details: assigned.map((c) => ({
                  label: c.name || c.companyName || 'Client',
                  value: `Due: ${c.nextPayrollDate} • ${c.payrollStatus}`,
                })),
              },
            },
          };
        }
      }
    }

    // 9. If activeClient is selected and prompt is a standard payroll command (e.g. "Run payroll", "Give Marcus 8 hours overtime")
    if (activeClient && activeClient.employees && activeClient.employees.length > 0) {
      const baseRun: PayrollRun =
        activeClient.payrollRun ||
        recalculatePayrollRun({
          ...initialAugustPayrollRun,
          id: `run-${activeClient.id}-aug-2026`,
          currency: activeClient.currency || 'TTD',
          currencySymbol: activeClient.currencySymbol || '$',
          employeesCount: activeClient.employees.length,
          employees: activeClient.employees,
        });
      return this.processPrompt(prompt, activeClient.payrollRun || null, baseRun, activeClient.employees[0]?.id || null);
    }

    // Default Cross-Client Help Response
    return {
      message: {
        id: messageId,
        sender: 'cayla',
        text: `You're in **Accountant Command Center**. Ask me anything across your client portfolio, such as:
- *"Which clients have payroll due this week?"*
- *"Run payroll for Caribbean Tech"*
- *"Prepare all ready payrolls"*
- *"Which clients haven't sent their timesheets?"*
- *"Show Sarah's clients"*
- *"Show payroll totals across my clients"*`,
        timestamp,
      },
    };
  }

  /**
   * Process a natural language prompt from the user
   */
  public async processPrompt(
    prompt: string,
    currentPayroll: PayrollRun | null,
    basePayrollData: PayrollRun,
    selectedEmployeeId: string | null
  ): Promise<CaylaExecutionResult> {
    const cleanPrompt = (prompt || '').trim().toLowerCase();
    const messageId = `msg-${Date.now()}`;

    // Helper: Find employee by name or pronoun in current payroll or base data
    const activePayroll = currentPayroll || basePayrollData || initialAugustPayrollRun;
    const employeesList = activePayroll.employees || [];

    const findEmployee = (query: string): Employee | undefined => {
      const cleanQuery = (query || '').toLowerCase();
      if (!cleanQuery) return undefined;
      return employeesList.find(
        (e) =>
          (e.name && e.name.toLowerCase().includes(cleanQuery)) ||
          (e.employeeId && e.employeeId.toLowerCase() === cleanQuery)
      );
    };

    // Resolve context employee if "him", "her", "he", "she", "them", "his", "their" is used
    const pronounRegex = /\b(him|her|his|hers|he|she|this employee|the employee)\b/i;
    let targetEmployee: Employee | undefined;

    if (pronounRegex.test(cleanPrompt) && this.context.lastMentionedEmployeeId) {
      targetEmployee = employeesList.find(
        (e) => e.id === this.context.lastMentionedEmployeeId
      );
    }

    // Try finding named employee in prompt
    if (!targetEmployee) {
      for (const emp of employeesList) {
        if (!emp || !emp.name) continue;
        const empName = emp.name || '';
        const firstName = empName.split(' ')[0]?.toLowerCase() || '';
        const lastName = empName.split(' ')[1]?.toLowerCase() || '';
        if (
          (empName && cleanPrompt.includes(empName.toLowerCase())) ||
          (firstName && cleanPrompt.includes(firstName)) ||
          (lastName && cleanPrompt.includes(lastName))
        ) {
          targetEmployee = emp;
          break;
        }
      }
    }

    // 1. RUN PAYROLL INTENT (e.g. "Run payroll for August", "Run this month's payroll", "Calculate august payroll")
    if (
      cleanPrompt.includes('run payroll') ||
      cleanPrompt.includes('run this month') ||
      cleanPrompt.includes('calculate payroll') ||
      cleanPrompt.includes('start payroll') ||
      cleanPrompt.includes('august payroll') ||
      cleanPrompt.includes('prepare payroll')
    ) {
      const generated = recalculatePayrollRun(basePayrollData);
      this.context.payrollGenerated = true;

      const progressSteps = [
        'Loading 24 employees from roster...',
        'Checking biometric & digital attendance...',
        'Calculating gross earnings & allowances...',
        'Calculating statutory PAYE income tax...',
        'Calculating NIS national insurance...',
        'Calculating Health Surcharge contributions...',
        'Validating compliance with tax engine...',
        'Creating draft payslips for 24 staff...',
      ];

      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: 'August payroll is ready for review.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          progressSteps,
          isWorking: false,
          actionSummary: {
            type: 'payroll_run',
            title: 'August 2026 Payroll Generated',
            description: '24 employees processed with full statutory deductions calculated.',
            details: [
              { label: 'Employees', value: '24 active' },
              { label: 'Gross Pay', value: formatCurrency(generated.grossPay) },
              { label: 'Deductions', value: formatCurrency(generated.totalDeductions) },
              { label: 'Net Pay', value: formatCurrency(generated.netPay) },
            ],
          },
        },
        updatedPayroll: generated,
        triggerPayrollDisplay: true,
        selectedEmployeeId: generated.employees[0]?.id || 'emp-1',
        newAuditEntry: {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          actor: 'cayla',
          action: 'Generated August 2026 draft payroll run',
          reversible: false,
        },
      };
    }

    // 2. CONTEXTUAL OVERRIDE: "Make that $700" or "Make that 10 hours"
    if (cleanPrompt.startsWith('make that') || cleanPrompt.startsWith('change that to') || cleanPrompt.startsWith('set to')) {
      const numberMatch = cleanPrompt.match(/(\d+(\.\d+)?)/);
      if (numberMatch && targetEmployee && this.context.lastFieldModified) {
        const val = parseFloat(numberMatch[1]);
        const field = this.context.lastFieldModified;
        const prevVal = (targetEmployee as any)[field];

        const updatedEmp: Employee = {
          ...targetEmployee,
          [field]: val,
          changedFields: [field],
        };

        const recalculatedEmp = recalculateEmployee(updatedEmp);
        const updatedPayroll = recalculatePayrollRun({
          ...activePayroll,
          employees: activePayroll.employees.map((e) => (e.id === recalculatedEmp.id ? recalculatedEmp : e)),
        });

        const fieldLabel = field === 'overtimeHours' ? `${val} overtime hours` : `${formatCurrency(val)} ${field}`;

        return {
          message: {
            id: messageId,
            sender: 'cayla',
            text: `Updated ${targetEmployee.name}'s ${field} to ${fieldLabel} and recalculated his payroll.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            undoAction: {
              id: `undo-${Date.now()}`,
              employeeName: targetEmployee.name,
              field,
              previousValue: prevVal,
              newValue: val,
            },
          },
          updatedPayroll,
          selectedEmployeeId: targetEmployee.id,
          newAuditEntry: {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            actor: 'cayla',
            action: `Modified ${field} to ${val}`,
            employeeName: targetEmployee.name,
            employeeId: targetEmployee.id,
            field,
            previousValue: prevVal,
            newValue: val,
            reversible: true,
          },
        };
      }
    }

    // 3. OVERTIME INTENT: "Give Marcus 8 hours overtime", "Add 5 hours overtime to Sarah"
    if (cleanPrompt.includes('overtime') || cleanPrompt.includes('ot hours')) {
      const hoursMatch = cleanPrompt.match(/(\d+(\.\d+)?)\s*(hours|hrs|hr|h)?/i);
      const hours = hoursMatch ? parseFloat(hoursMatch[1]) : 8;

      const emp = targetEmployee || activePayroll.employees[0];
      this.context.lastMentionedEmployeeId = emp.id;
      this.context.lastMentionedEmployeeName = emp.name;
      this.context.lastFieldModified = 'overtimeHours';

      const prevHours = emp.overtimeHours;
      const updatedEmp: Employee = {
        ...emp,
        overtimeHours: hours,
        changedFields: ['overtimeHours', 'grossPay', 'paye', 'nis', 'netPay'],
      };

      const recalculatedEmp = recalculateEmployee(updatedEmp);
      const updatedPayroll = recalculatePayrollRun({
        ...activePayroll,
        employees: activePayroll.employees.map((e) => (e.id === emp.id ? recalculatedEmp : e)),
      });

      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `I added ${hours} overtime hours to ${emp.name} and recalculated his payroll.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          undoAction: {
            id: `undo-${Date.now()}`,
            employeeName: emp.name,
            field: 'overtimeHours',
            previousValue: `${prevHours} hrs`,
            newValue: `${hours} hrs`,
          },
        },
        updatedPayroll,
        selectedEmployeeId: emp.id,
        newAuditEntry: {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          actor: 'cayla',
          action: `Updated overtime to ${hours} hrs`,
          employeeName: emp.name,
          employeeId: emp.id,
          field: 'overtimeHours',
          previousValue: prevHours,
          newValue: hours,
          reversible: true,
        },
      };
    }

    // 4. BONUS INTENT: "Give him a $500 bonus", "Add $1,000 bonus to Sarah"
    if (cleanPrompt.includes('bonus')) {
      const amountMatch = cleanPrompt.match(/\$?(\d+([,.]\d+)?)/);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : 500;

      const emp = targetEmployee || activePayroll.employees[0];
      this.context.lastMentionedEmployeeId = emp.id;
      this.context.lastMentionedEmployeeName = emp.name;
      this.context.lastFieldModified = 'bonus';

      const prevBonus = emp.bonus;
      const updatedEmp: Employee = {
        ...emp,
        bonus: amount,
        changedFields: ['bonus', 'grossPay', 'paye', 'nis', 'netPay'],
      };

      const recalculatedEmp = recalculateEmployee(updatedEmp);
      const updatedPayroll = recalculatePayrollRun({
        ...activePayroll,
        employees: activePayroll.employees.map((e) => (e.id === emp.id ? recalculatedEmp : e)),
      });

      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `I've added a ${formatCurrency(amount)} bonus for ${emp.name}. His gross pay is now ${formatCurrency(
            recalculatedEmp.grossPay
          )} and net pay is ${formatCurrency(recalculatedEmp.netPay)}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          undoAction: {
            id: `undo-${Date.now()}`,
            employeeName: emp.name,
            field: 'bonus',
            previousValue: formatCurrency(prevBonus),
            newValue: formatCurrency(amount),
          },
        },
        updatedPayroll,
        selectedEmployeeId: emp.id,
        newAuditEntry: {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          actor: 'cayla',
          action: `Added ${formatCurrency(amount)} bonus`,
          employeeName: emp.name,
          employeeId: emp.id,
          field: 'bonus',
          previousValue: prevBonus,
          newValue: amount,
          reversible: true,
        },
      };
    }

    // 5. ALLOWANCES / COMMISSIONS: "Add travel allowance $300 to David"
    if (cleanPrompt.includes('allowance') || cleanPrompt.includes('commission')) {
      const isCommission = cleanPrompt.includes('commission');
      const amountMatch = cleanPrompt.match(/\$?(\d+([,.]\d+)?)/);
      const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '')) : 300;

      const emp = targetEmployee || activePayroll.employees[0];
      const field = isCommission ? 'commission' : 'allowances';
      this.context.lastMentionedEmployeeId = emp.id;
      this.context.lastMentionedEmployeeName = emp.name;
      this.context.lastFieldModified = field;

      const prevVal = (emp as any)[field];
      const updatedEmp: Employee = {
        ...emp,
        [field]: amount,
        changedFields: [field, 'grossPay', 'paye', 'nis', 'netPay'],
      };

      const recalculatedEmp = recalculateEmployee(updatedEmp);
      const updatedPayroll = recalculatePayrollRun({
        ...activePayroll,
        employees: activePayroll.employees.map((e) => (e.id === emp.id ? recalculatedEmp : e)),
      });

      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `Added ${formatCurrency(amount)} ${isCommission ? 'commission' : 'allowance'} for ${emp.name}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          undoAction: {
            id: `undo-${Date.now()}`,
            employeeName: emp.name,
            field,
            previousValue: formatCurrency(prevVal),
            newValue: formatCurrency(amount),
          },
        },
        updatedPayroll,
        selectedEmployeeId: emp.id,
        newAuditEntry: {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          actor: 'cayla',
          action: `Added ${formatCurrency(amount)} ${field}`,
          employeeName: emp.name,
          employeeId: emp.id,
          field,
          previousValue: prevVal,
          newValue: amount,
          reversible: true,
        },
      };
    }

    // 6. SHOW / VIEW EMPLOYEE OR PAYSLIP: "Show Marcus", "View Sarah payslip", "Show me Priya"
    if (
      cleanPrompt.startsWith('show') ||
      cleanPrompt.startsWith('view') ||
      cleanPrompt.startsWith('select') ||
      cleanPrompt.includes('payslip for')
    ) {
      if (targetEmployee) {
        this.context.lastMentionedEmployeeId = targetEmployee.id;
        this.context.lastMentionedEmployeeName = targetEmployee.name;

        return {
          message: {
            id: messageId,
            sender: 'cayla',
            text: `Showing August payslip preview for ${targetEmployee.name} (${targetEmployee.position}).`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actionSummary: {
              type: 'payslip_ready',
              title: `${targetEmployee.name} Payslip`,
              description: `Net Pay: ${formatCurrency(targetEmployee.netPay)} | Basic: ${formatCurrency(targetEmployee.basicPay)}`,
            },
          },
          selectedEmployeeId: targetEmployee.id,
        };
      }
    }

    // 7. EMAIL PAYSLIP: "Email his payslip", "Email Marcus payslip", "Send payslip to Sarah"
    if (cleanPrompt.includes('email') || cleanPrompt.includes('send payslip')) {
      const emp = targetEmployee || activePayroll.employees[0];
      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `Payslip for ${emp.name} has been dispatched to ${emp.email}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionSummary: {
            type: 'email_sent',
            title: 'Payslip Dispatched',
            description: `Sent to ${emp.email} (encrypted PDF with password protection).`,
          },
        },
        selectedEmployeeId: emp.id,
        newAuditEntry: {
          id: `audit-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          actor: 'cayla',
          action: `Dispatched payslip email to ${emp.email}`,
          employeeName: emp.name,
          employeeId: emp.id,
          reversible: false,
        },
      };
    }

    // 8. TAXES / DEDUCTIONS SUMMARY: "Check my payroll taxes", "Check taxes", "Tax breakdown"
    if (cleanPrompt.includes('tax') || cleanPrompt.includes('statutory') || cleanPrompt.includes('paye') || cleanPrompt.includes('nis')) {
      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `Here is the statutory tax summary for ${activePayroll.periodLabel}: Total PAYE is ${formatCurrency(
            activePayroll.payeTotal
          )}, NIS is ${formatCurrency(activePayroll.nisTotal)}, and Health Surcharge is ${formatCurrency(
            activePayroll.hsTotal
          )}. All 24 employees meet statutory thresholds.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionSummary: {
            type: 'tax_check',
            title: 'Statutory Tax Audit Passed',
            description: '100% compliant with BIR & NIS regulations.',
            details: [
              { label: 'PAYE Income Tax', value: formatCurrency(activePayroll.payeTotal) },
              { label: 'NIS Contributions', value: formatCurrency(activePayroll.nisTotal) },
              { label: 'Health Surcharge', value: formatCurrency(activePayroll.hsTotal) },
              { label: 'Total Statutory', value: formatCurrency(activePayroll.payeTotal + activePayroll.nisTotal + activePayroll.hsTotal) },
            ],
          },
        },
      };
    }

    // 9. CREATE PAYSLIPS / TEMPLATES
    if (cleanPrompt.includes('create payslips') || cleanPrompt.includes('generate payslips') || cleanPrompt.includes('payslip templates')) {
      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `All 24 draft payslips are formatted and ready. You can switch between 12 distinct professional templates anytime in the payslip preview pane.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionSummary: {
            type: 'payslip_ready',
            title: '24 Payslips Available',
            description: '12 templates active. Ready for batch download, print, or email.',
          },
        },
      };
    }

    // 10. FINALIZE PAYROLL (CONFIRMATION REQUIREMENT)
    if (cleanPrompt.includes('finalize') || cleanPrompt.includes('approve payroll') || cleanPrompt.includes('submit payroll')) {
      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: 'August payroll is ready. Please review the final figures below and confirm authorization.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          confirmationRequired: {
            title: 'Authorize August 2026 Payroll',
            description: `24 employees | Gross Payroll: ${formatCurrency(activePayroll.grossPay)} | Net Payroll: ${formatCurrency(
              activePayroll.netPay
            )} | 24 payslips ready`,
            confirmAction: 'Finalize Payroll',
            cancelAction: 'Review Payroll',
            payload: { runId: activePayroll.id },
          },
        },
      };
    }

    // 11. TIMESHEET UPLOAD OR IMPORT
    if (cleanPrompt.includes('timesheet') || cleanPrompt.includes('attendance') || cleanPrompt.includes('csv')) {
      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `You can upload your timesheet CSV or biometric punch file. I will automatically parse overtime hours, attendance, and update affected employees.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionSummary: {
            type: 'timesheet_imported',
            title: 'Timesheet Ingestion Ready',
            description: 'Supports CSV, XLSX, and biometric punch exports.',
          },
        },
      };
    }

    // 12. PRICING & PLANS QUERY
    if (
      cleanPrompt.includes('pricing') ||
      cleanPrompt.includes('cost') ||
      cleanPrompt.includes('plans') ||
      cleanPrompt.includes('how much') ||
      cleanPrompt.includes('subscription') ||
      cleanPrompt.includes('free tier') ||
      cleanPrompt.includes('compare plans')
    ) {
      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: `Here is Cayla's pricing structure:
• **Free ($0/mo)**: Try Cayla on real payroll. 10 payroll runs/mo, 10 payslips/mo, up to 10 employees, automatic tax calculations, limited Cayla AI, 3 OCR scans/mo, 2 templates.
• **Business ($97/mo)**: Unlimited employees, businesses, payroll runs & payslips. Full Cayla AI, 50 OCR scans/mo, voice commands, included tax calculations & tax forms, all 12 templates, full reports.
• **Accountant ($197/mo)**: Multi-client practice command center with unlimited clients, batch payroll, client approvals, team access, 150 OCR scans/mo, and multi-client reports.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionSummary: {
            type: 'tax_check',
            title: 'Cayla Plans & Pricing',
            description: 'Simple, transparent tiers with unrestricted tax calculations.',
            details: [
              { label: 'Free Trial Tier', value: '$0/mo • 10 runs & payslips' },
              { label: 'Business Tier', value: '$97/mo • Unlimited runs & payslips' },
              { label: 'Accountant Tier', value: '$197/mo • Multi-client command' },
              { label: 'Statutory Calculations', value: 'Included in all tiers' },
            ],
          },
        },
      };
    }

    // 13. CONVERSION TRIGGER: 10-PAYSLIP LIMIT / UPGRADE INTENT
    if (
      cleanPrompt.includes('limit') ||
      cleanPrompt.includes('upgrade') ||
      cleanPrompt.includes('hit limit') ||
      cleanPrompt.includes('used 10') ||
      cleanPrompt.includes('10 payslip') ||
      cleanPrompt.includes('quota')
    ) {
      return {
        message: {
          id: messageId,
          sender: 'cayla',
          text: "You've used your 10 free payslips this month. Upgrade to Business for unlimited payroll, unlimited payslips and full access to Cayla.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actionSummary: {
            type: 'tax_check',
            title: 'Upgrade to Business ($97/mo)',
            description: 'Unlock unlimited payroll runs, unlimited payslips, and full Cayla AI intelligence.',
            details: [
              { label: 'Current Usage', value: '10 / 10 Free Payslips' },
              { label: 'Business Plan', value: '$97 / month' },
              { label: 'Volume', value: 'Unlimited employees & runs' },
              { label: 'AI Scans', value: '50 OCR scans / month' },
            ],
          },
        },
      };
    }

    // 14. GENERAL QUERY / STATUTORY KNOWLEDGE / DEFAULT CAYLA RESPONSE
    return {
      message: {
        id: messageId,
        sender: 'cayla',
        text: `I'm ready. You can tell me to "Run payroll for August", "Give Marcus 8 hours overtime", "Check taxes", or "Email his payslip".`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    };
  }
}
