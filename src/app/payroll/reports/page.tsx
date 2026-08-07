import Link from "next/link";
import { getPayrollReportSummary } from "@/lib/payroll/reports";

function php(n: number) {
  return n.toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
}

export default async function PayrollReportsPage() {
  let summary: Awaited<ReturnType<typeof getPayrollReportSummary>> | null =
    null;
  let loadError: string | null = null;

  try {
    summary = await getPayrollReportSummary();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load";
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Payroll reports</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Gross, PH statutory employee shares, BIR withholding, and department
        breakdown across all pay run lines.
      </p>

      {loadError ? (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}
        </p>
      ) : null}

      {summary ? (
        <>
          <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                Pay runs / lines
              </dt>
              <dd className="mt-1 text-xl font-semibold">
                {summary.runs} / {summary.employeesPaidLines}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                Gross
              </dt>
              <dd className="mt-1 text-xl font-semibold">
                {php(summary.gross)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                Net
              </dt>
              <dd className="mt-1 text-xl font-semibold">{php(summary.net)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                SSS (EE)
              </dt>
              <dd className="mt-1 text-lg font-semibold">{php(summary.sss)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                PhilHealth (EE)
              </dt>
              <dd className="mt-1 text-lg font-semibold">
                {php(summary.philhealth)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                Pag-IBIG (EE)
              </dt>
              <dd className="mt-1 text-lg font-semibold">
                {php(summary.pagibig)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                BIR withholding
              </dt>
              <dd className="mt-1 text-lg font-semibold">{php(summary.tax)}</dd>
            </div>
          </dl>

          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              By department
            </h2>
            <ul className="mt-3 divide-y divide-zinc-100 border-t border-zinc-200">
              {summary.byDepartment.length === 0 ? (
                <li className="py-4 text-sm text-zinc-500">No lines yet.</li>
              ) : null}
              {summary.byDepartment.map((d) => (
                <li
                  key={d.department}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{d.department}</div>
                    <div className="text-xs text-zinc-500">
                      {d.lines} line{d.lines === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div>{php(d.net)} net</div>
                    <div className="text-xs text-zinc-500">
                      {php(d.gross)} gross
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              By run status
            </h2>
            <ul className="mt-3 divide-y divide-zinc-100 border-t border-zinc-200">
              {summary.byStatus.map((s) => (
                <li
                  key={`${s.status}-${s.payment_status}`}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <div>
                    <span className="font-mono text-xs">{s.status}</span>
                    {" · "}
                    <span className="font-mono text-xs">
                      {s.payment_status}
                    </span>
                    <div className="text-xs text-zinc-500">
                      {s.count} run{s.count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div>{php(s.net)} net</div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <p className="mt-8 text-sm">
        <Link href="/payroll" className="underline">
          Back to payroll
        </Link>
      </p>
    </main>
  );
}
