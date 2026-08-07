import type {
  Employee,
  PayFrequency,
  PayType,
  TimesheetEntry,
} from "@/types/database";
import { calculatePhStatutoryDeductions } from "@/lib/payroll/ph-statutory";

export const OVERTIME_MULTIPLIER = 1.5;

/** @deprecated Flat tax replaced by PH statutory / BIR. Kept for old form defaults. */
export const DEFAULT_TAX_RATE = 0;

export type HoursBreakdown = {
  regularHours: number;
  overtimeHours: number;
  timesheetIds: string[];
};

export type EmployeePayInput = {
  employee: Pick<
    Employee,
    "id" | "full_name" | "pay_type" | "pay_rate" | "status" | "pay_frequency"
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
  sss_employee: number;
  philhealth_employee: number;
  pagibig_employee: number;
  monthly_compensation: number;
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
 * Pay rules + PH statutory deductions:
 * - salary: pay_rate = amount for this pay period
 * - hourly: regular * rate + OT * rate * 1.5 from approved timesheets
 * - deductions: SSS, PhilHealth, Pag-IBIG (EE) + BIR withholding
 */
export function calculateEmployeePay(input: EmployeePayInput): PayLineResult {
  const rate = Number(input.employee.pay_rate);
  const { regularHours, overtimeHours, timesheetIds } = input.hours;
  const payFrequency = (input.employee.pay_frequency ??
    "monthly") as PayFrequency;

  let regular_pay = 0;
  let overtime_pay = 0;
  let earnings_note: string | null = null;

  if (input.employee.pay_type === "salary") {
    regular_pay = rate;
    earnings_note = "Salary: pay_rate treated as period amount.";
  } else {
    regular_pay = regularHours * rate;
    overtime_pay = overtimeHours * rate * OVERTIME_MULTIPLIER;
    if (regularHours === 0 && overtimeHours === 0) {
      earnings_note = "No approved regular/overtime hours in this period.";
    } else {
      earnings_note = `Hourly: OT × ${OVERTIME_MULTIPLIER}.`;
    }
  }

  const gross_pay = money(regular_pay + overtime_pay);

  const statutory = calculatePhStatutoryDeductions({
    payType: input.employee.pay_type,
    payRate: rate,
    periodGross: gross_pay,
    payFrequency,
  });

  const tax_amount = statutory.birWithholding;
  const other_deductions = statutory.statutoryEmployeeTotal;
  const net_pay = money(gross_pay - tax_amount - other_deductions);

  const calc_note = [earnings_note, statutory.note].filter(Boolean).join(" ");

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
    sss_employee: statutory.sssEmployee,
    philhealth_employee: statutory.philhealthEmployee,
    pagibig_employee: statutory.pagibigEmployee,
    monthly_compensation: statutory.monthlyCompensation,
    net_pay,
    calc_note,
    timesheet_ids: timesheetIds,
  };
}
