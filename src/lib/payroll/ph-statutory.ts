/**
 * Philippines statutory payroll deductions (MVP, 2025–2026 rules).
 * Employee shares only are withheld from net pay.
 * Rates/caps change by circular — treat as configurable approximations, not legal advice.
 */

export const PH_STATUTORY_VERSION = "2026-mvp";

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** How much of a full month this pay frequency represents. */
export function periodFractionOfMonth(
  payFrequency: string | null | undefined,
): number {
  switch (payFrequency) {
    case "weekly":
      return 12 / 52;
    case "biweekly":
      return 12 / 26;
    case "semimonthly":
      return 0.5;
    case "monthly":
    default:
      return 1;
  }
}

/**
 * Estimate monthly compensation used for contribution bases.
 * Salary: scale period pay_rate up to a month.
 * Hourly: use this period's gross scaled to a month.
 */
export function estimateMonthlyCompensation(input: {
  payType: "salary" | "hourly";
  payRate: number;
  periodGross: number;
  payFrequency: string | null | undefined;
}): number {
  const frac = periodFractionOfMonth(input.payFrequency);
  if (frac <= 0) return money(input.periodGross);

  if (input.payType === "salary") {
    return money(Number(input.payRate) / frac);
  }
  return money(input.periodGross / frac);
}

/** SSS Monthly Salary Credit (simplified step table). */
export function sssMonthlySalaryCredit(monthlyCompensation: number): number {
  const mscMin = 5000;
  const mscMax = 35000;
  if (monthlyCompensation <= mscMin) return mscMin;
  if (monthlyCompensation >= mscMax) return mscMax;
  return Math.round(monthlyCompensation / 500) * 500;
}

export type StatutoryBreakdown = {
  monthlyCompensation: number;
  sssMsc: number;
  sssEmployee: number;
  philhealthEmployee: number;
  pagibigEmployee: number;
  birWithholding: number;
  /** SSS + PhilHealth + Pag-IBIG employee shares for this period */
  statutoryEmployeeTotal: number;
  note: string;
};

/**
 * Compute employee deductions for one pay period.
 * Employer shares are not deducted from net.
 */
export function calculatePhStatutoryDeductions(input: {
  payType: "salary" | "hourly";
  payRate: number;
  periodGross: number;
  payFrequency: string | null | undefined;
}): StatutoryBreakdown {
  const frac = periodFractionOfMonth(input.payFrequency);
  const monthlyCompensation = estimateMonthlyCompensation(input);

  const sssMsc = sssMonthlySalaryCredit(monthlyCompensation);
  const sssMonthlyEe = money(sssMsc * 0.05);

  const phBase = Math.min(100_000, Math.max(10_000, monthlyCompensation));
  const philhealthMonthlyEe = money(phBase * 0.025);

  const pagBase = Math.min(10_000, monthlyCompensation);
  const pagRate = monthlyCompensation <= 1500 ? 0.01 : 0.02;
  const pagibigMonthlyEe = money(pagBase * pagRate);

  const sssEmployee = money(sssMonthlyEe * frac);
  const philhealthEmployee = money(philhealthMonthlyEe * frac);
  const pagibigEmployee = money(pagibigMonthlyEe * frac);
  const statutoryEmployeeTotal = money(
    sssEmployee + philhealthEmployee + pagibigEmployee,
  );

  const monthlyTaxable = Math.max(
    0,
    monthlyCompensation - sssMonthlyEe - philhealthMonthlyEe - pagibigMonthlyEe,
  );
  const birMonthly = birMonthlyWithholding(monthlyTaxable);
  const birWithholding = money(birMonthly * frac);

  const note = `PH statutory (${PH_STATUTORY_VERSION}): MSC ₱${sssMsc.toLocaleString("en-PH")}; EE SSS/PH/HDMF + BIR; period × ${frac.toFixed(4)} of month.`;

  return {
    monthlyCompensation,
    sssMsc,
    sssEmployee,
    philhealthEmployee,
    pagibigEmployee,
    birWithholding,
    statutoryEmployeeTotal,
    note,
  };
}

/**
 * Simplified BIR withholding on taxable monthly compensation (TRAIN brackets).
 */
export function birMonthlyWithholding(taxableMonthly: number): number {
  const t = taxableMonthly;
  if (t <= 20_833) return 0;
  if (t <= 33_333) return money((t - 20_833) * 0.15);
  if (t <= 66_667) return money(1_875 + (t - 33_333) * 0.2);
  if (t <= 166_667) return money(8_541.8 + (t - 66_667) * 0.25);
  if (t <= 666_667) return money(33_541.8 + (t - 166_667) * 0.3);
  return money(183_541.8 + (t - 666_667) * 0.35);
}
