"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createPayRun, type PayRunFormState } from "@/app/payroll/actions";

const initial: PayRunFormState = {};

export default function NewPayRunPage() {
  const [state, formAction, pending] = useActionState(createPayRun, initial);

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">New pay run</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Picks all active employees. Hourly pay uses approved timesheets that
        overlap this period. Deductions use PH statutory rules (SSS, PhilHealth,
        Pag-IBIG, BIR) based on each employee&apos;s pay frequency.
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
          Notes
          <textarea
            name="notes"
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
          {pending ? "Calculating…" : "Create draft & calculate"}
        </button>
      </form>

      <p className="mt-6 text-sm">
        <Link href="/payroll" className="underline">
          Back
        </Link>
      </p>
    </main>
  );
}
