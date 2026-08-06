"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createTimesheet,
  type TimesheetFormState,
} from "@/app/me/timesheets/actions";

const initial: TimesheetFormState = {};

export default function NewTimesheetPage() {
  const [state, formAction, pending] = useActionState(createTimesheet, initial);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">New timesheet</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Choose the pay period dates, then add daily hours on the next screen.
      </p>

      <form action={formAction} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Period start
          <input
            name="period_start"
            type="date"
            required
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Period end
          <input
            name="period_end"
            type="date"
            required
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Note (optional)
          <textarea
            name="employee_note"
            rows={2}
            className="rounded-md border border-zinc-300 px-3 py-2"
          />
        </label>

        {state.error ? (
          <p className="text-sm text-red-600">{state.error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create draft"}
        </button>
      </form>

      <p className="mt-6 text-sm">
        <Link href="/me/timesheets" className="underline">
          Back
        </Link>
      </p>
    </main>
  );
}
