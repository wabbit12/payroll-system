"use server";

import { revalidatePath } from "next/cache";
import { getPayRun } from "@/app/payroll/actions";
import { writeAuditLog } from "@/lib/audit/log";
import { decryptField, maskSecret } from "@/lib/crypto/fields";
import { notifyRoles } from "@/lib/notifications/notify";
import { canMarkPayRunPaid } from "@/lib/payroll/status";
import { createClient } from "@/lib/supabase/server";
import type { Employee } from "@/types/database";

export type PaymentActionState = {
  error?: string;
  ok?: boolean;
};

async function requirePayableRun(payRunId: string) {
  const run = await getPayRun(payRunId);
  if (!run) return { error: "Pay run not found." as const };
  if (!canMarkPayRunPaid(run.status)) {
    return {
      error: `Cannot pay: run status is "${run.status}". Approve/lock first.` as const,
    };
  }
  return { run };
}

function paymentRef(): string {
  return `SIM-PH-${Date.now()}`;
}

export async function startSimulatedPayment(
  payRunId: string,
  note?: string,
): Promise<PaymentActionState> {
  const checked = await requirePayableRun(payRunId);
  if ("error" in checked) return { error: checked.error };
  const { run } = checked;

  if (run.payment_status === "paid") {
    return { error: "This pay run is already marked paid." };
  }
  if (run.payment_status === "pending") {
    return { error: "Payment is already pending." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("pay_runs")
    .update({
      payment_status: "pending",
      payment_provider: "simulated",
      payment_reference: paymentRef(),
      payment_note: note?.trim() || "Simulated PH payroll disbursement started.",
      payment_started_at: new Date().toISOString(),
      payment_completed_at: null,
      payment_by: user.id,
    })
    .eq("id", payRunId);

  if (error) return { error: error.message };

  await writeAuditLog({
    action: "payment.start",
    entityType: "pay_run",
    entityId: payRunId,
    summary: "Started simulated PH payment",
    metadata: { payment_status: "pending" },
  });

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${payRunId}`);
  return { ok: true };
}

export async function completeSimulatedPayment(
  payRunId: string,
  note?: string,
): Promise<PaymentActionState> {
  const checked = await requirePayableRun(payRunId);
  if ("error" in checked) return { error: checked.error };
  const { run } = checked;

  if (run.payment_status === "paid") {
    return { error: "This pay run is already marked paid." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("pay_runs")
    .update({
      payment_status: "paid",
      payment_provider: "simulated",
      payment_reference: run.payment_reference ?? paymentRef(),
      payment_note:
        note?.trim() ||
        "Simulated as paid (no live bank transfer — PH MVP).",
      payment_started_at: run.payment_started_at ?? new Date().toISOString(),
      payment_completed_at: new Date().toISOString(),
      payment_by: user.id,
    })
    .eq("id", payRunId);

  if (error) return { error: error.message };

  await writeAuditLog({
    action: "payment.complete",
    entityType: "pay_run",
    entityId: payRunId,
    summary: "Marked simulated payment paid",
    metadata: { payment_status: "paid", net: run.totals.net },
  });

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${payRunId}`);
  return { ok: true };
}

export async function failSimulatedPayment(
  payRunId: string,
  note?: string,
): Promise<PaymentActionState> {
  const checked = await requirePayableRun(payRunId);
  if ("error" in checked) return { error: checked.error };
  const { run } = checked;

  if (run.payment_status === "paid") {
    return { error: "Already paid — cannot mark failed." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("pay_runs")
    .update({
      payment_status: "failed",
      payment_provider: "simulated",
      payment_reference: run.payment_reference ?? paymentRef(),
      payment_note:
        note?.trim() || "Simulated payment failure (for testing alerts/UI).",
      payment_started_at: run.payment_started_at ?? new Date().toISOString(),
      payment_completed_at: new Date().toISOString(),
      payment_by: user.id,
    })
    .eq("id", payRunId);

  if (error) return { error: error.message };

  await writeAuditLog({
    action: "payment.fail",
    entityType: "pay_run",
    entityId: payRunId,
    summary: "Marked simulated payment failed",
    metadata: { payment_status: "failed" },
  });

  await notifyRoles(["payroll_admin", "super_admin"], {
    title: "Payment failed",
    body: `Simulated payment failed for ${run.period_start} to ${run.period_end}.`,
    link: `/payroll/${payRunId}`,
  });

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${payRunId}`);
  return { ok: true };
}

export async function markSimulatedPaid(
  payRunId: string,
): Promise<PaymentActionState> {
  return completeSimulatedPayment(payRunId);
}

export async function buildPaymentExportCsv(
  payRunId: string,
): Promise<{ csv?: string; filename?: string; error?: string }> {
  const run = await getPayRun(payRunId);
  if (!run) return { error: "Pay run not found." };
  if (!canMarkPayRunPaid(run.status)) {
    return {
      error: `Export only allowed for approved/locked runs (status: ${run.status}).`,
    };
  }

  const supabase = await createClient();
  const employeeIds = run.lines.map((l) => l.employee_id);
  const { data: employees, error } = await supabase
    .from("employees")
    .select(
      "id, full_name, email, bank_account_encrypted, bank_routing_encrypted",
    )
    .in("id", employeeIds)
    .returns<
      Pick<
        Employee,
        | "id"
        | "full_name"
        | "email"
        | "bank_account_encrypted"
        | "bank_routing_encrypted"
      >[]
    >();

  if (error) return { error: error.message };

  const byId = new Map((employees ?? []).map((e) => [e.id, e]));

  const header = [
    "employee_name",
    "email",
    "net_pay",
    "bank_account_masked",
    "bank_routing_masked",
    "period_start",
    "period_end",
    "pay_run_id",
    "currency",
  ];

  const rows = run.lines.map((line) => {
    const emp = byId.get(line.employee_id);
    let account = "";
    let routing = "";
    try {
      account = emp?.bank_account_encrypted
        ? decryptField(emp.bank_account_encrypted)
        : "";
      routing = emp?.bank_routing_encrypted
        ? decryptField(emp.bank_routing_encrypted)
        : "";
    } catch {
      account = "";
      routing = "";
    }

    return [
      line.employee_name,
      emp?.email ?? "",
      Number(line.net_pay).toFixed(2),
      maskSecret(account),
      maskSecret(routing),
      run.period_start,
      run.period_end,
      run.id,
      "PHP",
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");
  const filename = `payroll-export-${run.period_start}-${run.period_end}.csv`;

  await writeAuditLog({
    action: "payment.export_csv",
    entityType: "pay_run",
    entityId: payRunId,
    summary: "Exported bank CSV (masked accounts)",
    metadata: { lines: run.lines.length },
  });

  return { csv, filename };
}
