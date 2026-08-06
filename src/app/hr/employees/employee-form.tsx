"use client";

import { useActionState } from "react";
import type { EmployeePublic } from "@/types/database";
import {
  createEmployee,
  updateEmployee,
  type EmployeeFormState,
} from "@/app/hr/employees/actions";

const initial: EmployeeFormState = {};

type Props =
  | { mode: "create" }
  | { mode: "edit"; employee: EmployeePublic };

export function EmployeeForm(props: Props) {
  const action =
    props.mode === "create"
      ? createEmployee
      : updateEmployee.bind(null, props.employee.id);

  const [state, formAction, pending] = useActionState(action, initial);
  const e = props.mode === "edit" ? props.employee : null;

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Full name *
          <input
            name="full_name"
            required
            defaultValue={e?.full_name ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email *
          <input
            name="email"
            type="email"
            required
            defaultValue={e?.email ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Employee number
          <input
            name="employee_number"
            defaultValue={e?.employee_number ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select
            name="status"
            defaultValue={e?.status ?? "active"}
            className="rounded-md border border-zinc-300 px-3 py-2"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="on_leave">On leave</option>
            <option value="terminated">Terminated</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Job title
          <input
            name="job_title"
            defaultValue={e?.job_title ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Department
          <input
            name="department"
            defaultValue={e?.department ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hire date
          <input
            name="hire_date"
            type="date"
            defaultValue={e?.hire_date ?? ""}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
      </div>

      <fieldset className="rounded-lg border border-zinc-200 p-4">
        <legend className="px-1 text-sm font-medium">Compensation</legend>
        <div className="mt-2 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Pay type
            <select
              name="pay_type"
              defaultValue={e?.pay_type ?? "salary"}
              className="rounded-md border border-zinc-300 px-3 py-2"
            >
              <option value="salary">Salary</option>
              <option value="hourly">Hourly</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Pay rate *
            <input
              name="pay_rate"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={e?.pay_rate ?? ""}
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Frequency
            <select
              name="pay_frequency"
              defaultValue={e?.pay_frequency ?? "monthly"}
              className="rounded-md border border-zinc-300 px-3 py-2"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="semimonthly">Semi-monthly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-zinc-200 p-4">
        <legend className="px-1 text-sm font-medium">
          Sensitive (encrypted at rest)
        </legend>
        <p className="text-xs text-zinc-500">
          Leave blank on edit to keep the existing value. UI shows masked values
          only.
        </p>
        {e ? (
          <dl className="mt-2 grid gap-1 text-xs text-zinc-500 sm:grid-cols-3">
            <div>Tax ID on file: {e.tax_id_masked || "—"}</div>
            <div>Account on file: {e.bank_account_masked || "—"}</div>
            <div>Routing on file: {e.bank_routing_masked || "—"}</div>
          </dl>
        ) : null}
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            Tax ID
            <input
              name="tax_id"
              autoComplete="off"
              className="rounded-md border border-zinc-300 px-3 py-2"
              placeholder={e ? "Enter to replace" : ""}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Bank account
            <input
              name="bank_account"
              autoComplete="off"
              className="rounded-md border border-zinc-300 px-3 py-2"
              placeholder={e ? "Enter to replace" : ""}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Bank routing
            <input
              name="bank_routing"
              autoComplete="off"
              className="rounded-md border border-zinc-300 px-3 py-2"
              placeholder={e ? "Enter to replace" : ""}
            />
          </label>
        </div>
      </fieldset>

      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-green-700">Saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending
          ? "Saving…"
          : props.mode === "create"
            ? "Create employee"
            : "Save changes"}
      </button>
    </form>
  );
}
