import Link from "next/link";
import { listMyPayslips } from "@/app/payroll/payslip-actions";
import { DownloadPayslipButton } from "@/app/me/payslips/download-button";

export default async function MyPayslipsPage() {
  let rows: Awaited<ReturnType<typeof listMyPayslips>> = [];
  let loadError: string | null = null;

  try {
    rows = await listMyPayslips();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load payslips";
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">My payslips</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Download payslips generated from approved payroll runs.
      </p>

      {loadError ? (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}. If needed, run{" "}
          <code className="rounded bg-white px-1">
            supabase/migrations/009_payslips.sql
          </code>
          .
        </p>
      ) : null}

      <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-200">
        {rows.length === 0 && !loadError ? (
          <li className="py-6 text-sm text-zinc-500">
            No payslips yet. Payroll generates them after a run is approved.
          </li>
        ) : null}
        {rows.map((slip) => (
          <li
            key={slip.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
          >
            <div>
              <div className="font-medium">
                {slip.period_start} → {slip.period_end}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Net ${Number(slip.net_pay).toFixed(2)} · Gross $
                {Number(slip.gross_pay).toFixed(2)} · Tax $
                {Number(slip.tax_amount).toFixed(2)}
              </div>
            </div>
            <DownloadPayslipButton payslipId={slip.id} />
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
