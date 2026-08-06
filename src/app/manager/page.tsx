import Link from "next/link";
import { listPendingTimesheets } from "@/app/me/timesheets/actions";

export default async function ManagerPage() {
  let rows: Awaited<ReturnType<typeof listPendingTimesheets>> = [];
  let loadError: string | null = null;

  try {
    rows = await listPendingTimesheets();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load";
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        Timesheet approvals
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Review submitted hours. Only approved timesheets will feed payroll
        (Phase 4).
      </p>

      {loadError ? (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}. Run{" "}
          <code className="rounded bg-white px-1">
            supabase/migrations/005_timesheets.sql
          </code>{" "}
          if needed.
        </p>
      ) : null}

      <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-200">
        {rows.length === 0 && !loadError ? (
          <li className="py-6 text-sm text-zinc-500">
            No timesheets waiting for approval.
          </li>
        ) : null}
        {rows.map((ts) => (
          <li
            key={ts.id}
            className="flex items-center justify-between gap-4 py-4 text-sm"
          >
            <div>
              <Link
                href={`/manager/timesheets/${ts.id}`}
                className="font-medium underline"
              >
                {ts.employee_name}
              </Link>
              <div className="mt-1 text-xs text-zinc-500">
                {ts.period_start} → {ts.period_end} ·{" "}
                {(ts.total_hours ?? 0).toFixed(2)} hrs
              </div>
            </div>
            <span className="font-mono text-xs">{ts.status}</span>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </p>
    </main>
  );
}
