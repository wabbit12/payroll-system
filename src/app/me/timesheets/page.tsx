import Link from "next/link";
import { listMyTimesheets } from "@/app/me/timesheets/actions";

export default async function MyTimesheetsPage() {
  let rows: Awaited<ReturnType<typeof listMyTimesheets>> = [];
  let loadError: string | null = null;

  try {
    rows = await listMyTimesheets();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load";
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My timesheets</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Log hours, submit for manager approval. Only approved hours feed
            payroll later.
          </p>
        </div>
        <Link
          href="/me/timesheets/new"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          New timesheet
        </Link>
      </div>

      {loadError ? (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}. If tables are missing, run{" "}
          <code className="rounded bg-white px-1">
            supabase/migrations/005_timesheets.sql
          </code>
          .
        </p>
      ) : null}

      <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-200">
        {rows.length === 0 && !loadError ? (
          <li className="py-6 text-sm text-zinc-500">No timesheets yet.</li>
        ) : null}
        {rows.map((ts) => (
          <li key={ts.id} className="flex items-center justify-between gap-4 py-4 text-sm">
            <div>
              <Link
                href={`/me/timesheets/${ts.id}`}
                className="font-medium underline"
              >
                {ts.period_start} → {ts.period_end}
              </Link>
              <div className="mt-1 text-xs text-zinc-500">
                {ts.total_hours?.toFixed(2) ?? "0.00"} hrs ·{" "}
                <span className="font-mono">{ts.status}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm">
        <Link href="/me" className="underline">
          My profile
        </Link>
        {" · "}
        <Link href="/dashboard" className="underline">
          Dashboard
        </Link>
      </p>
    </main>
  );
}
