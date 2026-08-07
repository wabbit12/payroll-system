"use server";

import { revalidatePath } from "next/cache";
import { getMyEmployee } from "@/app/hr/employees/actions";
import { getPayRun } from "@/app/payroll/actions";
import { writeAuditLog } from "@/lib/audit/log";
import { notifyUser } from "@/lib/notifications/notify";
import { buildPayslipPdf } from "@/lib/payroll/payslip-pdf";
import { canGeneratePayslips } from "@/lib/payroll/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Employee, Payslip } from "@/types/database";

export type PayslipActionState = {
  error?: string;
  ok?: boolean;
  count?: number;
};

function moneyFields(row: Payslip): Payslip {
  return {
    ...row,
    gross_pay: Number(row.gross_pay),
    tax_amount: Number(row.tax_amount),
    other_deductions: Number(row.other_deductions),
    net_pay: Number(row.net_pay),
  };
}

export async function listPayslipsForRun(payRunId: string): Promise<Payslip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payslips")
    .select("*")
    .eq("pay_run_id", payRunId)
    .order("generated_at", { ascending: false })
    .returns<Payslip[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(moneyFields);
}

export async function listMyPayslips(): Promise<Payslip[]> {
  const me = await getMyEmployee();
  if (!me) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payslips")
    .select("*")
    .eq("employee_id", me.id)
    .order("period_end", { ascending: false })
    .returns<Payslip[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(moneyFields);
}

export async function generatePayslipsForRun(
  payRunId: string,
): Promise<PayslipActionState> {
  const run = await getPayRun(payRunId);
  if (!run) return { error: "Pay run not found." };
  if (!canGeneratePayslips(run.status)) {
    return {
      error: "Payslips can only be generated for approved or locked pay runs.",
    };
  }
  if (run.lines.length === 0) {
    return { error: "Pay run has no lines." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const admin = createAdminClient();
  let count = 0;

  for (const line of run.lines) {
    const { data: employee } = await supabase
      .from("employees")
      .select(
        "id, user_id, full_name, email, employee_number, job_title, department, pay_type",
      )
      .eq("id", line.employee_id)
      .maybeSingle<
        Pick<
          Employee,
          | "id"
          | "user_id"
          | "full_name"
          | "email"
          | "employee_number"
          | "job_title"
          | "department"
          | "pay_type"
        >
      >();

    const pdf = await buildPayslipPdf({
      employeeName: line.employee_name,
      employeeEmail: employee?.email,
      employeeNumber: employee?.employee_number,
      jobTitle: employee?.job_title,
      department: employee?.department,
      periodStart: run.period_start,
      periodEnd: run.period_end,
      payType: line.pay_type,
      payRate: line.pay_rate,
      regularHours: line.regular_hours,
      overtimeHours: line.overtime_hours,
      regularPay: line.regular_pay,
      overtimePay: line.overtime_pay,
      grossPay: line.gross_pay,
      taxAmount: line.tax_amount,
      otherDeductions: line.other_deductions,
      sssEmployee: line.sss_employee,
      philhealthEmployee: line.philhealth_employee,
      pagibigEmployee: line.pagibig_employee,
      netPay: line.net_pay,
      calcNote: line.calc_note,
    });

    const fileName = `payslip-${run.period_start}-${run.period_end}.pdf`;
    const storagePath = `${line.employee_id}/${run.id}.pdf`;

    const { error: uploadError } = await admin.storage
      .from("payslips")
      .upload(storagePath, pdf, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return { error: `Upload failed for ${line.employee_name}: ${uploadError.message}` };
    }

    const { error: upsertError } = await supabase.from("payslips").upsert(
      {
        pay_run_id: run.id,
        pay_run_line_id: line.id,
        employee_id: line.employee_id,
        storage_path: storagePath,
        file_name: fileName,
        period_start: run.period_start,
        period_end: run.period_end,
        gross_pay: line.gross_pay,
        tax_amount: line.tax_amount,
        other_deductions: line.other_deductions,
        net_pay: line.net_pay,
        generated_by: user.id,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "pay_run_id,employee_id" },
    );

    if (upsertError) {
      return {
        error: `Saved PDF but DB failed for ${line.employee_name}: ${upsertError.message}`,
      };
    }

    if (employee?.user_id) {
      await notifyUser({
        userId: employee.user_id,
        title: "Payslip ready",
        body: `Your payslip for ${run.period_start} to ${run.period_end} is available.`,
        link: "/me/payslips",
      });
    }

    count += 1;
  }

  await writeAuditLog({
    action: "payslip.generate",
    entityType: "pay_run",
    entityId: payRunId,
    summary: `Generated ${count} payslip(s)`,
    metadata: { count },
  });

  revalidatePath(`/payroll/${payRunId}`);
  revalidatePath("/me/payslips");
  revalidatePath("/notifications");
  return { ok: true, count };
}

export async function getPayslipDownloadUrl(
  payslipId: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: payslip, error } = await supabase
    .from("payslips")
    .select("storage_path")
    .eq("id", payslipId)
    .maybeSingle<{ storage_path: string }>();

  if (error) return { error: error.message };
  if (!payslip) return { error: "Payslip not found or not allowed." };

  const { data, error: signError } = await supabase.storage
    .from("payslips")
    .createSignedUrl(payslip.storage_path, 60);

  if (signError) return { error: signError.message };
  return { url: data.signedUrl };
}
