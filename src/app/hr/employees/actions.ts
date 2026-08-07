"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { writeAuditLog } from "@/lib/audit/log";
import { encryptField, decryptField, maskSecret } from "@/lib/crypto/fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  Employee,
  EmployeePublic,
  EmploymentStatus,
  PayFrequency,
  PayType,
} from "@/types/database";

function toPublic(row: Employee): EmployeePublic {
  let tax = "";
  let account = "";
  let routing = "";

  try {
    tax = row.tax_id_encrypted ? decryptField(row.tax_id_encrypted) : "";
    account = row.bank_account_encrypted
      ? decryptField(row.bank_account_encrypted)
      : "";
    routing = row.bank_routing_encrypted
      ? decryptField(row.bank_routing_encrypted)
      : "";
  } catch {
    tax = "";
    account = "";
    routing = "";
  }

  const {
    tax_id_encrypted: _t,
    bank_account_encrypted: _a,
    bank_routing_encrypted: _r,
    ...rest
  } = row;

  return {
    ...rest,
    pay_rate: Number(row.pay_rate),
    tax_id_masked: maskSecret(tax),
    bank_account_masked: maskSecret(account),
    bank_routing_masked: maskSecret(routing),
  };
}

async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) return null;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    return match?.id ?? null;
  } catch {
    return null;
  }
}

export async function listEmployees(): Promise<EmployeePublic[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("full_name", { ascending: true })
    .returns<Employee[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(toPublic);
}

export async function getEmployee(id: string): Promise<EmployeePublic | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .maybeSingle<Employee>();

  if (error) throw new Error(error.message);
  return data ? toPublic(data) : null;
}

export async function getMyEmployee(): Promise<EmployeePublic | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: linked, error: linkedError } = await supabase
    .from("employees")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Employee>();

  if (linkedError) throw new Error(linkedError.message);
  if (linked) return toPublic(linked);

  // HR may have created the row before signup — claim by matching email.
  const email = user.email.toLowerCase();
  const { data: unlinked, error: unlinkedError } = await supabase
    .from("employees")
    .select("*")
    .is("user_id", null)
    .ilike("email", email)
    .maybeSingle<Employee>();

  if (unlinkedError) throw new Error(unlinkedError.message);
  if (!unlinked) return null;

  const { data: claimed, error: claimError } = await supabase
    .from("employees")
    .update({ user_id: user.id })
    .eq("id", unlinked.id)
    .is("user_id", null)
    .select("*")
    .maybeSingle<Employee>();

  if (claimError) throw new Error(claimError.message);
  return claimed ? toPublic(claimed) : toPublic(unlinked);
}

export type EmployeeFormState = {
  error?: string;
  ok?: boolean;
};

function readForm(formData: FormData) {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const employee_number =
    String(formData.get("employee_number") ?? "").trim() || null;
  const job_title = String(formData.get("job_title") ?? "").trim() || null;
  const department = String(formData.get("department") ?? "").trim() || null;
  const hire_date = String(formData.get("hire_date") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "active") as EmploymentStatus;
  const pay_type = String(formData.get("pay_type") ?? "salary") as PayType;
  const pay_frequency = String(
    formData.get("pay_frequency") ?? "monthly",
  ) as PayFrequency;
  const pay_rate = Number(formData.get("pay_rate") ?? 0);
  const tax_id = String(formData.get("tax_id") ?? "").trim();
  const bank_account = String(formData.get("bank_account") ?? "").trim();
  const bank_routing = String(formData.get("bank_routing") ?? "").trim();

  return {
    full_name,
    email,
    employee_number,
    job_title,
    department,
    hire_date,
    status,
    pay_type,
    pay_frequency,
    pay_rate,
    tax_id,
    bank_account,
    bank_routing,
  };
}

export async function createEmployee(
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const fields = readForm(formData);

  if (!fields.full_name || !fields.email) {
    return { error: "Name and email are required." };
  }
  if (!(fields.pay_rate >= 0) || Number.isNaN(fields.pay_rate)) {
    return { error: "Pay rate must be zero or greater." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const user_id = await findAuthUserIdByEmail(fields.email);

  const payload = {
    full_name: fields.full_name,
    email: fields.email,
    employee_number: fields.employee_number,
    job_title: fields.job_title,
    department: fields.department,
    hire_date: fields.hire_date,
    status: fields.status,
    pay_type: fields.pay_type,
    pay_frequency: fields.pay_frequency,
    pay_rate: fields.pay_rate,
    tax_id_encrypted: fields.tax_id ? encryptField(fields.tax_id) : null,
    bank_account_encrypted: fields.bank_account
      ? encryptField(fields.bank_account)
      : null,
    bank_routing_encrypted: fields.bank_routing
      ? encryptField(fields.bank_routing)
      : null,
    user_id,
    created_by: user.id,
  };

  const { data, error } = await supabase
    .from("employees")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { error: error.message };

  await writeAuditLog({
    action: "employee.create",
    entityType: "employee",
    entityId: data.id,
    summary: `Created employee ${fields.full_name}`,
    metadata: {
      email: fields.email,
      pay_type: fields.pay_type,
      sensitive_fields_set: {
        tax_id: !!fields.tax_id,
        bank_account: !!fields.bank_account,
        bank_routing: !!fields.bank_routing,
      },
    },
  });

  revalidatePath("/hr");
  revalidatePath("/me");
  redirect(`/hr/employees/${data.id}`);
}

export async function updateEmployee(
  id: string,
  _prev: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const fields = readForm(formData);

  if (!fields.full_name || !fields.email) {
    return { error: "Name and email are required." };
  }
  if (!(fields.pay_rate >= 0) || Number.isNaN(fields.pay_rate)) {
    return { error: "Pay rate must be zero or greater." };
  }

  const supabase = await createClient();
  const user_id = await findAuthUserIdByEmail(fields.email);

  const payload: Record<string, unknown> = {
    full_name: fields.full_name,
    email: fields.email,
    employee_number: fields.employee_number,
    job_title: fields.job_title,
    department: fields.department,
    hire_date: fields.hire_date,
    status: fields.status,
    pay_type: fields.pay_type,
    pay_frequency: fields.pay_frequency,
    pay_rate: fields.pay_rate,
    user_id,
  };

  if (fields.tax_id) payload.tax_id_encrypted = encryptField(fields.tax_id);
  if (fields.bank_account) {
    payload.bank_account_encrypted = encryptField(fields.bank_account);
  }
  if (fields.bank_routing) {
    payload.bank_routing_encrypted = encryptField(fields.bank_routing);
  }

  const { error } = await supabase
    .from("employees")
    .update(payload)
    .eq("id", id);

  if (error) return { error: error.message };

  await writeAuditLog({
    action: "employee.update",
    entityType: "employee",
    entityId: id,
    summary: `Updated employee ${fields.full_name}`,
    metadata: {
      email: fields.email,
      pay_rate_changed: true,
      sensitive_fields_updated: {
        tax_id: !!fields.tax_id,
        bank_account: !!fields.bank_account,
        bank_routing: !!fields.bank_routing,
      },
    },
  });

  revalidatePath("/hr");
  revalidatePath(`/hr/employees/${id}`);
  revalidatePath("/me");
  return { ok: true };
}
