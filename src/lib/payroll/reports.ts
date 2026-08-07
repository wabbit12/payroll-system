import { createClient } from "@/lib/supabase/server";

export type PayrollReportSummary = {
  runs: number;
  employeesPaidLines: number;
  gross: number;
  tax: number;
  sss: number;
  philhealth: number;
  pagibig: number;
  net: number;
  byDepartment: {
    department: string;
    gross: number;
    net: number;
    lines: number;
  }[];
  byStatus: {
    status: string;
    payment_status: string;
    count: number;
    net: number;
  }[];
};

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export async function getPayrollReportSummary(): Promise<PayrollReportSummary> {
  const supabase = await createClient();

  const { data: runs, error: runsError } = await supabase
    .from("pay_runs")
    .select("id, status, payment_status, period_start, period_end");

  if (runsError) throw new Error(runsError.message);

  const { data: lines, error: linesError } = await supabase
    .from("pay_run_lines")
    .select(
      "pay_run_id, employee_id, employee_name, gross_pay, tax_amount, net_pay, sss_employee, philhealth_employee, pagibig_employee, other_deductions",
    );

  if (linesError) throw new Error(linesError.message);

  const employeeIds = [
    ...new Set((lines ?? []).map((l) => l.employee_id as string)),
  ];

  const deptByEmployee = new Map<string, string>();
  if (employeeIds.length > 0) {
    const { data: employees } = await supabase
      .from("employees")
      .select("id, department")
      .in("id", employeeIds);
    for (const e of employees ?? []) {
      deptByEmployee.set(e.id, e.department?.trim() || "Unassigned");
    }
  }

  let gross = 0;
  let tax = 0;
  let sss = 0;
  let philhealth = 0;
  let pagibig = 0;
  let net = 0;
  const deptMap = new Map<
    string,
    { department: string; gross: number; net: number; lines: number }
  >();

  for (const line of lines ?? []) {
    const g = Number(line.gross_pay);
    const t = Number(line.tax_amount);
    const n = Number(line.net_pay);
    const sssEe = Number(line.sss_employee ?? 0);
    const phEe = Number(line.philhealth_employee ?? 0);
    const pagEe = Number(line.pagibig_employee ?? 0);
    gross += g;
    tax += t;
    sss += sssEe;
    philhealth += phEe;
    pagibig += pagEe;
    net += n;

    const dept = deptByEmployee.get(line.employee_id) ?? "Unassigned";
    const current = deptMap.get(dept) ?? {
      department: dept,
      gross: 0,
      net: 0,
      lines: 0,
    };
    current.gross += g;
    current.net += n;
    current.lines += 1;
    deptMap.set(dept, current);
  }

  const statusMap = new Map<
    string,
    { status: string; payment_status: string; count: number; net: number }
  >();

  for (const run of runs ?? []) {
    const key = `${run.status}|${run.payment_status ?? "unpaid"}`;
    const runNet = (lines ?? [])
      .filter((l) => l.pay_run_id === run.id)
      .reduce((s, l) => s + Number(l.net_pay), 0);
    const current = statusMap.get(key) ?? {
      status: run.status,
      payment_status: run.payment_status ?? "unpaid",
      count: 0,
      net: 0,
    };
    current.count += 1;
    current.net += runNet;
    statusMap.set(key, current);
  }

  return {
    runs: runs?.length ?? 0,
    employeesPaidLines: lines?.length ?? 0,
    gross: money(gross),
    tax: money(tax),
    sss: money(sss),
    philhealth: money(philhealth),
    pagibig: money(pagibig),
    net: money(net),
    byDepartment: [...deptMap.values()]
      .map((d) => ({
        ...d,
        gross: money(d.gross),
        net: money(d.net),
      }))
      .sort((a, b) => b.net - a.net),
    byStatus: [...statusMap.values()]
      .map((s) => ({ ...s, net: money(s.net) }))
      .sort((a, b) => b.count - a.count),
  };
}
