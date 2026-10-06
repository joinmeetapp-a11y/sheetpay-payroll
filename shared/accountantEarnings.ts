/** Existing Accountant earnings formula shared by the editor and the server agent. */
export function accountantGrossEarnings(row: { basicPay?: number; overtimeHours?: number; overtimeRate?: number; bonus?: number; commission?: number; allowances?: number }) {
  return Number(row.basicPay || 0) + Number(row.overtimeHours || 0) * Number(row.overtimeRate || 0) + Number(row.bonus || 0) + Number(row.commission || 0) + Number(row.allowances || 0);
}
