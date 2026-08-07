"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit/log";
import { calculateEmployeePay, summarizeApprovedHours } from "@/lib/payroll/calculate";
import {
  canMarkPayRunPaid,
  isPayRunEditable,
} from "@/lib/payroll/status";
import { notifyRoles } from "@/lib/notifications/notify";
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
  return (data ?? []).map((r) => ({
    ...r,
    tax_rate: Number(r.tax_rate),
    payment_status: r.payment_status ?? "unpaid",
    payment_provider: r.payment_provider ?? "simulated",
  }));
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
    sss_employee: Number(l.sss_employee ?? 0),
    philhealth_employee: Number(l.philhealth_employee ?? 0),
    pagibig_employee: Number(l.pagibig_employee ?? 0),
    monthly_compensation:
      l.monthly_compensation == null
        ? null
        : Number(l.monthly_compensation),
    net_pay: Number(l.net_pay),
  }));

  return withTotals(
    {
      ...run,
      tax_rate: Number(run.tax_rate),
      payment_status: run.payment_status ?? "unpaid",
      payment_provider: run.payment_provider ?? "simulated",
    },
    normalized,
  );
}

export async function createPayRun(
  _prev: PayRunFormState,
  formData: FormData,
): Promise<PayRunFormState> {
  const period_start = String(formData.get("period_start") ?? "").trim();
  const period_end = String(formData.get("period_end") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!period_start || !period_end) {
    return { error: "Period start and end are required." };
  }
  if (period_end < period_start) {
    return { error: "Period end must be on or after start." };
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
      // Legacy column; PH statutory engine computes BIR + contributions.
      tax_rate: 0,
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
  if (!isPayRunEditable(run.status)) {
    return { error: "Only draft or rejected pay runs can be recalculated." };
  }

  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, full_name, pay_type, pay_rate, pay_frequency, status")
    .eq("status", "active")
    .returns<
      Pick<
        Employee,
        | "id"
        | "full_name"
        | "pay_type"
        | "pay_rate"
        | "pay_frequency"
        | "status"
      >[]
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
    const line = calculateEmployeePay({
      employee: {
        ...employee,
        pay_rate: Number(employee.pay_rate),
      },
      hours,
    });

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
        sss_employee: line.sss_employee,
        philhealth_employee: line.philhealth_employee,
        pagibig_employee: line.pagibig_employee,
        monthly_compensation: line.monthly_compensation,
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
    .update({
      calculated_at: new Date().toISOString(),
      // Recalc after reject keeps it as draft for resubmit clarity.
      status: run.status === "rejected" ? "draft" : run.status,
      review_note: run.status === "rejected" ? null : run.review_note,
    })
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

export async function submitPayRunForApproval(
  payRunId: string,
): Promise<PayRunFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const run = await getPayRun(payRunId);
  if (!run) return { error: "Pay run not found." };
  if (!isPayRunEditable(run.status)) {
    return { error: "Only draft or rejected runs can be submitted." };
  }
  if (run.lines.length === 0) {
    return { error: "Calculate the pay run before submitting." };
  }
  if (run.totals.gross <= 0) {
    return { error: "Gross total is zero — check employees and timesheets." };
  }

  const { error } = await supabase
    .from("pay_runs")
    .update({
      status: "pending_approval",
      submitted_by: user.id,
      submitted_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
      review_note: null,
    })
    .eq("id", payRunId)
    .in("status", ["draft", "rejected"]);

  if (error) return { error: error.message };

  await writeAuditLog({
    action: "pay_run.submit",
    entityType: "pay_run",
    entityId: payRunId,
    summary: `Submitted ${run.period_start} to ${run.period_end} for approval`,
    metadata: {
      period_start: run.period_start,
      period_end: run.period_end,
      net: run.totals.net,
    },
  });

  await notifyRoles(["payroll_admin", "super_admin"], {
    title: "Pay run needs approval",
    body: `${run.period_start} to ${run.period_end} is pending approval.`,
    link: `/payroll/${payRunId}`,
  });

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${payRunId}`);
  return { ok: true };
}

export async function approvePayRun(
  payRunId: string,
  _prev: PayRunFormState,
  formData: FormData,
): Promise<PayRunFormState> {
  const review_note = String(formData.get("review_note") ?? "").trim() || null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("pay_runs")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note,
    })
    .eq("id", payRunId)
    .eq("status", "pending_approval");

  if (error) return { error: error.message };

  await writeAuditLog({
    action: "pay_run.approve",
    entityType: "pay_run",
    entityId: payRunId,
    summary: "Approved pay run",
    metadata: { review_note },
  });

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${payRunId}`);
  return { ok: true };
}

export async function rejectPayRun(
  payRunId: string,
  _prev: PayRunFormState,
  formData: FormData,
): Promise<PayRunFormState> {
  const review_note = String(formData.get("review_note") ?? "").trim();
  if (!review_note) {
    return { error: "A review note is required when rejecting." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("pay_runs")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note,
    })
    .eq("id", payRunId)
    .eq("status", "pending_approval");

  if (error) return { error: error.message };

  await writeAuditLog({
    action: "pay_run.reject",
    entityType: "pay_run",
    entityId: payRunId,
    summary: "Rejected pay run",
    metadata: { review_note },
  });

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${payRunId}`);
  return { ok: true };
}

export async function lockPayRun(payRunId: string): Promise<PayRunFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("pay_runs")
    .update({
      status: "locked",
      locked_by: user.id,
      locked_at: new Date().toISOString(),
    })
    .eq("id", payRunId)
    .eq("status", "approved");

  if (error) return { error: error.message };

  await writeAuditLog({
    action: "pay_run.lock",
    entityType: "pay_run",
    entityId: payRunId,
    summary: "Locked pay run (immutable lines)",
  });

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${payRunId}`);
  return { ok: true };
}

/**
 * Gate used by payment actions: run must be approved/locked,
 * and not already paid.
 */
export async function assertPayRunPayable(
  payRunId: string,
): Promise<PayRunFormState> {
  const run = await getPayRun(payRunId);
  if (!run) return { error: "Pay run not found." };
  if (!canMarkPayRunPaid(run.status)) {
    return {
      error: `Cannot mark paid: status is "${run.status}". Approve (and optionally lock) first.`,
    };
  }
  if (run.payment_status === "paid") {
    return { error: "This pay run is already marked paid." };
  }
  return { ok: true };
}
