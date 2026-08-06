"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMyEmployee } from "@/app/hr/employees/actions";
import { createClient } from "@/lib/supabase/server";
import type {
  Timesheet,
  TimesheetEntry,
  TimesheetEntryType,
  TimesheetWithEntries,
} from "@/types/database";

export type TimesheetFormState = {
  error?: string;
  ok?: boolean;
};

function sumHours(entries: TimesheetEntry[]): number {
  return entries.reduce((acc, e) => acc + Number(e.hours), 0);
}

async function loadEntries(
  supabase: Awaited<ReturnType<typeof createClient>>,
  timesheetId: string,
): Promise<TimesheetEntry[]> {
  const { data, error } = await supabase
    .from("timesheet_entries")
    .select("*")
    .eq("timesheet_id", timesheetId)
    .order("work_date", { ascending: true })
    .returns<TimesheetEntry[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map((e) => ({ ...e, hours: Number(e.hours) }));
}

export async function listMyTimesheets(): Promise<TimesheetWithEntries[]> {
  const me = await getMyEmployee();
  if (!me) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("timesheets")
    .select("*")
    .eq("employee_id", me.id)
    .order("period_start", { ascending: false })
    .returns<Timesheet[]>();

  if (error) throw new Error(error.message);

  const rows: TimesheetWithEntries[] = [];
  for (const ts of data ?? []) {
    const entries = await loadEntries(supabase, ts.id);
    rows.push({
      ...ts,
      entries,
      total_hours: sumHours(entries),
      employee_name: me.full_name,
    });
  }
  return rows;
}

export async function listPendingTimesheets(): Promise<TimesheetWithEntries[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("timesheets")
    .select("*")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true })
    .returns<Timesheet[]>();

  if (error) throw new Error(error.message);

  const rows: TimesheetWithEntries[] = [];
  for (const ts of data ?? []) {
    const entries = await loadEntries(supabase, ts.id);
    const { data: emp } = await supabase
      .from("employees")
      .select("full_name")
      .eq("id", ts.employee_id)
      .maybeSingle<{ full_name: string }>();

    rows.push({
      ...ts,
      entries,
      total_hours: sumHours(entries),
      employee_name: emp?.full_name ?? "Unknown",
    });
  }
  return rows;
}

export async function getTimesheet(
  id: string,
): Promise<TimesheetWithEntries | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("timesheets")
    .select("*")
    .eq("id", id)
    .maybeSingle<Timesheet>();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const entries = await loadEntries(supabase, data.id);
  const { data: emp } = await supabase
    .from("employees")
    .select("full_name")
    .eq("id", data.employee_id)
    .maybeSingle<{ full_name: string }>();

  return {
    ...data,
    entries,
    total_hours: sumHours(entries),
    employee_name: emp?.full_name,
  };
}

export async function createTimesheet(
  _prev: TimesheetFormState,
  formData: FormData,
): Promise<TimesheetFormState> {
  const me = await getMyEmployee();
  if (!me) {
    return {
      error:
        "No employee record linked to your login. Ask HR to create one with your email.",
    };
  }

  const period_start = String(formData.get("period_start") ?? "").trim();
  const period_end = String(formData.get("period_end") ?? "").trim();
  const employee_note =
    String(formData.get("employee_note") ?? "").trim() || null;

  if (!period_start || !period_end) {
    return { error: "Period start and end are required." };
  }
  if (period_end < period_start) {
    return { error: "Period end must be on or after start." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("timesheets")
    .insert({
      employee_id: me.id,
      period_start,
      period_end,
      status: "draft",
      employee_note,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/me/timesheets");
  redirect(`/me/timesheets/${data.id}`);
}

export async function addTimesheetEntry(
  timesheetId: string,
  _prev: TimesheetFormState,
  formData: FormData,
): Promise<TimesheetFormState> {
  const work_date = String(formData.get("work_date") ?? "").trim();
  const hours = Number(formData.get("hours") ?? 0);
  const entry_type = String(
    formData.get("entry_type") ?? "regular",
  ) as TimesheetEntryType;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!work_date) return { error: "Work date is required." };
  if (!(hours > 0) || hours > 24 || Number.isNaN(hours)) {
    return { error: "Hours must be between 0 and 24." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("timesheet_entries").insert({
    timesheet_id: timesheetId,
    work_date,
    hours,
    entry_type,
    notes,
  });

  if (error) return { error: error.message };

  revalidatePath(`/me/timesheets/${timesheetId}`);
  revalidatePath("/manager");
  return { ok: true };
}

export async function deleteTimesheetEntry(
  timesheetId: string,
  entryId: string,
): Promise<TimesheetFormState> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("timesheet_entries")
    .delete()
    .eq("id", entryId)
    .eq("timesheet_id", timesheetId);

  if (error) return { error: error.message };

  revalidatePath(`/me/timesheets/${timesheetId}`);
  return { ok: true };
}

export async function submitTimesheet(
  timesheetId: string,
): Promise<TimesheetFormState> {
  const supabase = await createClient();
  const ts = await getTimesheet(timesheetId);
  if (!ts) return { error: "Timesheet not found." };
  if (ts.status !== "draft" && ts.status !== "rejected") {
    return { error: "Only draft or rejected timesheets can be submitted." };
  }
  if (ts.entries.length === 0) {
    return { error: "Add at least one hours entry before submitting." };
  }

  const { error } = await supabase
    .from("timesheets")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    })
    .eq("id", timesheetId);

  if (error) return { error: error.message };

  revalidatePath(`/me/timesheets/${timesheetId}`);
  revalidatePath("/me/timesheets");
  revalidatePath("/manager");
  return { ok: true };
}

export async function reviewTimesheet(
  timesheetId: string,
  decision: "approved" | "rejected",
  _prev: TimesheetFormState,
  formData: FormData,
): Promise<TimesheetFormState> {
  const review_note = String(formData.get("review_note") ?? "").trim() || null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("timesheets")
    .update({
      status: decision,
      review_note,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", timesheetId)
    .eq("status", "submitted");

  if (error) return { error: error.message };

  revalidatePath("/manager");
  revalidatePath(`/manager/timesheets/${timesheetId}`);
  revalidatePath(`/me/timesheets/${timesheetId}`);
  revalidatePath("/me/timesheets");
  redirect("/manager");
}
