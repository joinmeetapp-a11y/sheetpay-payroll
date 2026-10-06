// Legacy command expectations used only to seed mocked model outputs in regression tests.
import {DAY} from '../../convex/lib/caylaAgentPolicy';
/** Exact common command patterns save a model call. Names are matched only within authorized context. */
export function commonIntent(message: string, context: any): any | null {
  const text = message.trim().toLowerCase();
  if (/ignore.{0,30}instructions|system\s*prompt|override.{0,20}approval|delete|compensation|subscription|change.*(rate|salary|statutory)/i.test(text)) return { action: 'help', scope: 'current', clientIds: [], clarification: 'This operation requires the existing control screen.' };
  // The shortcut understands whole named months and weekday due dates only.
  // Preserve more specific dates by passing them to the validated interpreter.
  const monthPattern = '(?:january|february|march|april|may|june|july|august|september|october|november|december)';
  if (/\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b|\b(?:today|tomorrow|yesterday)\b|\b(?:last|next|previous)\s+(?:month|week|year|pay\s*period)\b/.test(text)
    || new RegExp(`\\b${monthPattern}\\s+\\d{1,2}(?!\\d)\\b|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthPattern}\\b`).test(text)) return null;
  let action;
  if (/remind|reminder/.test(text)) action = /^(show|list|get|what|which)/.test(text) ? 'reminders' : 'reminder';
  else if (/email|send.*payslip/.test(text)) action = 'emails';
  else if (/missing|exception|unusual|review.*employee/.test(text)) action = 'exceptions';
  else if (/tax.*form|yearly.*tax/.test(text)) action = 'tax';
  else if (/report/.test(text)) action = 'report';
  else if (/history|previous payroll/.test(text)) action = 'history';
  else if (/which|waiting|upcoming|who.*due|show.*client/.test(text)) action = 'upcoming';
  else if (/generat.*payslip|prepare.*payslip/.test(text)) action = 'payslips';
  else if (/^(cayla[,\s]*)?(run|prepare|check)\s+(payroll|the payroll)/.test(text)) action = 'prepare';
  else return null;
  const names = context.clients.filter((c: any) => text.includes(c.name.toLowerCase()));
  const current = /this client|current client/.test(text);
  if (names.length > 1) return null;
  // A named client that is not in this context must never silently become the current client.
  if (/(?:payroll|reminder)\s+for\s+(?!this|the|all|my|clients|everyone)([a-z])/i.test(text) && !names.length) return null;
  const intent: any = { action, scope: names.length || current ? 'current' : /all clients|my \d+ clients|my clients|clients|everyone|everybody|all.*payslips/.test(text) ? 'all' : 'current', clientIds: names.map((c: any) => c.id) };
  if (action === 'exceptions' && /missing.*hours/.test(text)) intent.exceptionFilter = 'missing_hours';
  if (['exceptions','upcoming'].includes(action) && context.context?.view === 'Dashboard' && !names.length && !current) intent.scope = 'all';
  const today = Date.parse(context.today + 'T00:00:00Z');
  if (/due|this week/.test(text)) {
    intent.scope = 'due';
    if (/this week/.test(text)) { intent.dueFrom = context.today; intent.dueTo = new Date(today + 6 * DAY).toISOString().slice(0, 10); }
    else {
      const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const weekday = weekdays.findIndex(day => text.includes(day));
      if (weekday < 0) return null;
      const diff = (weekday - new Date(today).getUTCDay() + 7) % 7;
      intent.dueFrom = intent.dueTo = new Date(today + diff * DAY).toISOString().slice(0, 10);
    }
  }
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const month = months.findIndex(name => new RegExp('\\b' + name + '\\b').test(text));
  if (month >= 0) {
    const year = Number(text.match(/\b(20\d{2})\b/)?.[1] || context.today.slice(0,4));
    intent.periodStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0,10);
    intent.periodEnd = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0,10);
  }
  if (action === 'reminder') {
    const words: Record<string,number> = { one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7 };
    const days = text.match(/(\d+|one|two|three|four|five|seven)\s+days?\s+before/);
    intent.daysBefore = days ? (words[days[1]] ?? Number(days[1])) : 3;
  }
  if (/this employee/.test(text)) intent.target = 'employee';
  else if (/this (payroll run|run|payslip)/.test(text)) intent.target = 'run';
  if (intent.target) intent.scope = 'current';
  return intent;
}

