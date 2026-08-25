import { Employee } from '../types';

/**
 * Hide demo/preview employee rows the moment at least one real employee
 * exists. When the account is still empty, demo rows pass through so
 * onboarding previews and empty-state illustrations can render.
 *
 * Demo rows are identified explicitly by `isDemo === true` — never by name,
 * avatar URL, or any inferred property. This prevents accidental deletion of
 * real employees who happen to share a name with a demo record.
 */
export function filterOutDemoOnceReal(employees: Employee[]): Employee[] {
  if (!Array.isArray(employees) || employees.length === 0) return employees ?? [];
  const hasReal = employees.some((e) => !e.isDemo);
  if (!hasReal) return employees;
  return employees.filter((e) => !e.isDemo);
}

export function isRealEmployee(e: Employee): boolean {
  return !e.isDemo;
}
