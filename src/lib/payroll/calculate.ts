import type { Employee, PayType, TimesheetEntry } from "@/types/database";

export const DEFAULT_TAX_RATE = 0.1; // 10% placeholder statutory deduction
export const OVERTIME_MULTIPLIER = 1.5;

export type HoursBreakdown = {
  regularHours: number;
  overtimeHours: number;
  timesheetIds: string[];
};

export type EmployeePayInput = {
  employee: Pick<
    Employee,
    "id" | "full_name" | "pay_type" | "pay_rate" | "status"
  >;
  hours: HoursBreakdown;
};

export type PayLineResult = {
  employee_id: string;
  employee_name: string;
  pay_type: PayType;
  pay_rate: number;
  regular_hours: number;
  overtime_hours: number;
  regular_pay: number;
  overtime_pay: number;
  gross_pay: number;
  tax_amount: number;
  other_deductions: number;
  net_pay: number;
  calc_note: string | null;
  timesheet_ids: string[];
};

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function summarizeApprovedHours(
  entriesByTimesheet: {
    timesheetId: string;
    entries: Pick<TimesheetEntry, "hours" | "entry_type">[];
  }[],
): HoursBreakdown {
  let regularHours = 0;
  let overtimeHours = 0;
  const timesheetIds: string[] = [];

  for (const group of entriesByTimesheet) {
    let used = false;
    for (const entry of group.entries) {
      const hours = Number(entry.hours);
      if (entry.entry_type === "regular") {
        regularHours += hours;
        used = true;
      } else if (entry.entry_type === "overtime") {
        overtimeHours += hours;
        used = true;
      }
      // unpaid_leave: no pay
    }
    if (used) timesheetIds.push(group.timesheetId);
  }

  return {
    regularHours: money(regularHours),
    overtimeHours: money(overtimeHours),
    timesheetIds,
  };
}

/**
 * MVP pay rules:
 * - salary: pay_rate is the amount for this pay period
 * - hourly: regular * rate + overtime * rate * 1.5 from approved timesheets
 * - tax: flat taxRate on gross (placeholder until country rules)
 */
export function calculateEmployeePay(
  input: EmployeePayInput,
  taxRate: number,
): PayLineResult {
  const rate = Number(input.employee.pay_rate);
  const { regularHours, overtimeHours, timesheetIds } = input.hours;

  let regular_pay = 0;
  let overtime_pay = 0;
  let calc_note: string | null = null;

  if (input.employee.pay_type === "salary") {
    regular_pay = rate;
    calc_note = "Salary: pay_rate treated as period amount.";
  } else {
    regular_pay = regularHours * rate;
    overtime_pay = overtimeHours * rate * OVERTIME_MULTIPLIER;
    if (regularHours === 0 && overtimeHours === 0) {
      calc_note = "No approved regular/overtime hours in this period.";
    } else {
      calc_note = `Hourly: OT × ${OVERTIME_MULTIPLIER}.`;
    }
  }

  const gross_pay = money(regular_pay + overtime_pay);
  const tax_amount = money(gross_pay * taxRate);
  const other_deductions = 0;
  const net_pay = money(gross_pay - tax_amount - other_deductions);

  return {
    employee_id: input.employee.id,
    employee_name: input.employee.full_name,
    pay_type: input.employee.pay_type,
    pay_rate: rate,
    regular_hours: regularHours,
    overtime_hours: overtimeHours,
    regular_pay: money(regular_pay),
    overtime_pay: money(overtime_pay),
    gross_pay,
    tax_amount,
    other_deductions,
    net_pay,
    calc_note,
    timesheet_ids: timesheetIds,
  };
}
