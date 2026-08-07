import Link from "next/link";
import { listPayRuns } from "@/app/payroll/actions";

export default async function PayrollPage() {
  let runs: Awaited<ReturnType<typeof listPayRuns>> = [];
  let loadError: string | null = null;

  try {
    runs = await listPayRuns();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load pay runs";
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pay runs</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Create a draft run for a period. Salary uses period pay rate; hourly
            uses approved timesheet hours. Deductions: PH SSS, PhilHealth,
            Pag-IBIG, and BIR withholding.
          </p>
        </div>
        <Link
          href="/payroll/new"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          New pay run
        </Link>
      </div>

      <p className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link href="/payroll/reports" className="underline">
          Reports
        </Link>
        <Link href="/payroll/audit" className="underline">
          Audit log
        </Link>
      </p>

      {loadError ? (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}. If tables are missing, run{" "}
          <code className="rounded bg-white px-1">
            supabase/migrations/006_pay_runs.sql
          </code>
          .
        </p>
      ) : null}

      <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-200">
        {runs.length === 0 && !loadError ? (
          <li className="py-6 text-sm text-zinc-500">No pay runs yet.</li>
        ) : null}
        {runs.map((run) => (
          <li
            key={run.id}
            className="flex items-center justify-between gap-4 py-4 text-sm"
          >
            <div>
              <Link href={`/payroll/${run.id}`} className="font-medium underline">
                {run.period_start} → {run.period_end}
              </Link>
              <div className="mt-1 text-xs text-zinc-500">
                PH statutory ·{" "}
                <span className="font-mono">{run.status}</span>
                {" · "}
                <span className="font-mono">
                  {run.payment_status ?? "unpaid"}
                </span>
                {run.calculated_at
                  ? ` · calculated ${new Date(run.calculated_at).toLocaleString()}`
                  : ""}
              </div>
            </div>
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
