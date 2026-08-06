"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  DEFAULT_TAX_RATE,
  calculateEmployeePay,
  summarizeApprovedHours,
} from "@/lib/payroll/calculate";
import { createClient } from "@/lib/supabase/server";
import type {
  Employee,
  PayRun,
  PayRunLine,
  PayRunWithLines,
  Timesheet,
  TimesheetEntry,
} from "@/types/database";

export type PayRunFormState = {
  error?: string;
  ok?: boolean;
};

function money(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function withTotals(run: PayRun, lines: PayRunLine[]): PayRunWithLines {
  return {
    ...run,
    tax_rate: Number(run.tax_rate),
    lines,
    totals: {
      gross: money(lines.reduce((s, l) => s + Number(l.gross_pay), 0)),
      tax: money(lines.reduce((s, l) => s + Number(l.tax_amount), 0)),
      net: money(lines.reduce((s, l) => s + Number(l.net_pay), 0)),
      employees: lines.length,
    },
  };
}

export async function listPayRuns(): Promise<PayRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pay_runs")
    .select("*")
    .order("period_start", { ascending: false })
    .returns<PayRun[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ ...r, tax_rate: Number(r.tax_rate) }));
}

export async function getPayRun(id: string): Promise<PayRunWithLines | null> {
  const supabase = await createClient();
  const { data: run, error } = await supabase
    .from("pay_runs")
    .select("*")
    .eq("id", id)
    .maybeSingle<PayRun>();

  if (error) throw new Error(error.message);
  if (!run) return null;

  const { data: lines, error: linesError } = await supabase
    .from("pay_run_lines")
    .select("*")
    .eq("pay_run_id", id)
    .order("employee_name", { ascending: true })
    .returns<PayRunLine[]>();

  if (linesError) throw new Error(linesError.message);

  const normalized = (lines ?? []).map((l) => ({
    ...l,
    pay_rate: Number(l.pay_rate),
    regular_hours: Number(l.regular_hours),
    overtime_hours: Number(l.overtime_hours),
    regular_pay: Number(l.regular_pay),
    overtime_pay: Number(l.overtime_pay),
    gross_pay: Number(l.gross_pay),
    tax_amount: Number(l.tax_amount),
    other_deductions: Number(l.other_deductions),
    net_pay: Number(l.net_pay),
  }));

  return withTotals({ ...run, tax_rate: Number(run.tax_rate) }, normalized);
}

export async function createPayRun(
  _prev: PayRunFormState,
  formData: FormData,
): Promise<PayRunFormState> {
  const period_start = String(formData.get("period_start") ?? "").trim();
  const period_end = String(formData.get("period_end") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const taxRaw = String(formData.get("tax_rate") ?? "").trim();
  const tax_rate = taxRaw === "" ? DEFAULT_TAX_RATE : Number(taxRaw) / 100;

  if (!period_start || !period_end) {
    return { error: "Period start and end are required." };
  }
  if (period_end < period_start) {
    return { error: "Period end must be on or after start." };
  }
  if (!(tax_rate >= 0) || tax_rate > 1 || Number.isNaN(tax_rate)) {
    return { error: "Tax rate must be between 0 and 100%." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("pay_runs")
    .insert({
      period_start,
      period_end,
      status: "draft",
      tax_rate,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const calcError = await calculatePayRun(data.id);
  if (calcError.error) {
    return {
      error: `Pay run created, but calculation failed: ${calcError.error}`,
    };
  }

  revalidatePath("/payroll");
  redirect(`/payroll/${data.id}`);
}

export async function calculatePayRun(
  payRunId: string,
): Promise<PayRunFormState> {
  const supabase = await createClient();

  const { data: run, error: runError } = await supabase
    .from("pay_runs")
    .select("*")
    .eq("id", payRunId)
    .maybeSingle<PayRun>();

  if (runError) return { error: runError.message };
  if (!run) return { error: "Pay run not found." };
  if (run.status !== "draft") {
    return { error: "Only draft pay runs can be recalculated." };
  }

  const taxRate = Number(run.tax_rate);

  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, full_name, pay_type, pay_rate, status")
    .eq("status", "active")
    .returns<
      Pick<Employee, "id" | "full_name" | "pay_type" | "pay_rate" | "status">[]
    >();

  if (empError) return { error: empError.message };

  const { data: timesheets, error: tsError } = await supabase
    .from("timesheets")
    .select("id, employee_id, period_start, period_end, status")
    .eq("status", "approved")
    .lte("period_start", run.period_end)
    .gte("period_end", run.period_start)
    .returns<
      Pick<
        Timesheet,
        "id" | "employee_id" | "period_start" | "period_end" | "status"
      >[]
    >();

  if (tsError) return { error: tsError.message };

  const timesheetIds = (timesheets ?? []).map((t) => t.id);
  let entries: TimesheetEntry[] = [];
  if (timesheetIds.length > 0) {
    const { data: entryRows, error: entryError } = await supabase
      .from("timesheet_entries")
      .select("*")
      .in("timesheet_id", timesheetIds)
      .returns<TimesheetEntry[]>();
    if (entryError) return { error: entryError.message };
    entries = entryRows ?? [];
  }

  // Clear previous lines (cascade removes line_timesheets).
  const { error: delError } = await supabase
    .from("pay_run_lines")
    .delete()
    .eq("pay_run_id", payRunId);
  if (delError) return { error: delError.message };

  for (const employee of employees ?? []) {
    const empSheets = (timesheets ?? []).filter(
      (t) => t.employee_id === employee.id,
    );
    const grouped = empSheets.map((t) => ({
      timesheetId: t.id,
      entries: entries.filter((e) => e.timesheet_id === t.id),
    }));
    const hours = summarizeApprovedHours(grouped);
    const line = calculateEmployeePay(
      {
        employee: {
          ...employee,
          pay_rate: Number(employee.pay_rate),
        },
        hours,
      },
      taxRate,
    );

    // Skip hourly with zero pay and no hours? Still include for visibility.
    const { data: inserted, error: lineError } = await supabase
      .from("pay_run_lines")
      .insert({
        pay_run_id: payRunId,
        employee_id: line.employee_id,
        employee_name: line.employee_name,
        pay_type: line.pay_type,
        pay_rate: line.pay_rate,
        regular_hours: line.regular_hours,
        overtime_hours: line.overtime_hours,
        regular_pay: line.regular_pay,
        overtime_pay: line.overtime_pay,
        gross_pay: line.gross_pay,
        tax_amount: line.tax_amount,
        other_deductions: line.other_deductions,
        net_pay: line.net_pay,
        calc_note: line.calc_note,
      })
      .select("id")
      .single();

    if (lineError) return { error: lineError.message };

    if (line.timesheet_ids.length > 0) {
      const links = line.timesheet_ids.map((timesheet_id) => ({
        pay_run_line_id: inserted.id,
        timesheet_id,
      }));
      const { error: linkError } = await supabase
        .from("pay_run_line_timesheets")
        .insert(links);
      if (linkError) return { error: linkError.message };
    }
  }

  const { error: updateError } = await supabase
    .from("pay_runs")
    .update({ calculated_at: new Date().toISOString() })
    .eq("id", payRunId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${payRunId}`);
  return { ok: true };
}

export async function recalculatePayRun(
  payRunId: string,
): Promise<PayRunFormState> {
  return calculatePayRun(payRunId);
}

export async function deleteDraftPayRun(
  payRunId: string,
): Promise<PayRunFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pay_runs")
    .delete()
    .eq("id", payRunId)
    .eq("status", "draft");

  if (error) return { error: error.message };

  revalidatePath("/payroll");
  redirect("/payroll");
}
