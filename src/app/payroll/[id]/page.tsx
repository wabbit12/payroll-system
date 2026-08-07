import Link from "next/link";
import { notFound } from "next/navigation";
import { getPayRun } from "@/app/payroll/actions";
import { listPayslipsForRun } from "@/app/payroll/payslip-actions";
import { PayRunActions } from "@/app/payroll/pay-run-actions";
import { DownloadPayslipButton } from "@/app/me/payslips/download-button";
import { payRunStatusLabel, paymentStatusLabel } from "@/lib/payroll/status";

export default async function PayRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await getPayRun(id);
  if (!run) notFound();

  let payslips: Awaited<ReturnType<typeof listPayslipsForRun>> = [];
  try {
    payslips = await listPayslipsForRun(id);
  } catch {
    payslips = [];
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Pay run</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {run.period_start} → {run.period_end} ·{" "}
        <span className="font-mono text-xs">{run.status}</span> (
        {payRunStatusLabel(run.status)}) · PH statutory (SSS / PhilHealth /
        Pag-IBIG / BIR) · payment{" "}
        <span className="font-mono text-xs">{run.payment_status}</span> (
        {paymentStatusLabel(run.payment_status)})
      </p>

      <section className="mt-6 grid gap-3 rounded-lg border border-zinc-200 p-4 text-sm sm:grid-cols-4">
        <div>
          <div className="text-zinc-500">Employees</div>
          <div className="text-lg font-semibold">{run.totals.employees}</div>
        </div>
        <div>
          <div className="text-zinc-500">Gross</div>
          <div className="text-lg font-semibold">
            ₱{run.totals.gross.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500">BIR + statutory</div>
          <div className="text-lg font-semibold">
            ₱
            {(
              run.totals.tax +
              run.lines.reduce((s, l) => s + Number(l.other_deductions), 0)
            ).toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-zinc-500">Net</div>
          <div className="text-lg font-semibold">
            ₱{run.totals.net.toFixed(2)}
          </div>
        </div>
      </section>

      {(run.submitted_at ||
        run.reviewed_at ||
        run.locked_at ||
        run.review_note ||
        run.payment_reference) && (
        <dl className="mt-4 grid gap-2 rounded-lg border border-zinc-100 p-4 text-sm sm:grid-cols-2">
          {run.submitted_at ? (
            <div>
              <dt className="text-zinc-500">Submitted</dt>
              <dd>{new Date(run.submitted_at).toLocaleString()}</dd>
            </div>
          ) : null}
          {run.reviewed_at ? (
            <div>
              <dt className="text-zinc-500">Reviewed</dt>
              <dd>{new Date(run.reviewed_at).toLocaleString()}</dd>
            </div>
          ) : null}
          {run.locked_at ? (
            <div>
              <dt className="text-zinc-500">Locked</dt>
              <dd>{new Date(run.locked_at).toLocaleString()}</dd>
            </div>
          ) : null}
          {run.payment_reference ? (
            <div>
              <dt className="text-zinc-500">Payment ref</dt>
              <dd className="font-mono text-xs">{run.payment_reference}</dd>
            </div>
          ) : null}
          {run.payment_completed_at ? (
            <div>
              <dt className="text-zinc-500">Payment completed</dt>
              <dd>{new Date(run.payment_completed_at).toLocaleString()}</dd>
            </div>
          ) : null}
          {run.review_note ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Review note</dt>
              <dd>{run.review_note}</dd>
            </div>
          ) : null}
          {run.payment_note ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Payment note</dt>
              <dd>{run.payment_note}</dd>
            </div>
          ) : null}
        </dl>
      )}

      <div className="mt-6">
        <PayRunActions
          payRunId={run.id}
          status={run.status}
          paymentStatus={run.payment_status}
        />
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 pr-3 font-medium">Employee</th>
              <th className="py-2 pr-3 font-medium">Type</th>
              <th className="py-2 pr-3 font-medium">Gross</th>
              <th className="py-2 pr-3 font-medium">SSS</th>
              <th className="py-2 pr-3 font-medium">PhilHealth</th>
              <th className="py-2 pr-3 font-medium">Pag-IBIG</th>
              <th className="py-2 pr-3 font-medium">BIR</th>
              <th className="py-2 pr-3 font-medium">Net</th>
              <th className="py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {run.lines.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-zinc-500">
                  No lines. Add active employees, then recalculate. If columns
                  are missing, run{" "}
                  <code className="rounded bg-zinc-100 px-1">
                    012_ph_statutory.sql
                  </code>
                  .
                </td>
              </tr>
            ) : null}
            {run.lines.map((line) => (
              <tr key={line.id} className="border-b border-zinc-100 align-top">
                <td className="py-3 pr-3">
                  <div className="font-medium">{line.employee_name}</div>
                  <div className="text-xs text-zinc-500">
                    rate ₱{line.pay_rate.toFixed(2)}
                    {line.monthly_compensation != null
                      ? ` · monthly est. ₱${Number(line.monthly_compensation).toFixed(0)}`
                      : ""}
                  </div>
                </td>
                <td className="py-3 pr-3 font-mono text-xs">{line.pay_type}</td>
                <td className="py-3 pr-3">₱{line.gross_pay.toFixed(2)}</td>
                <td className="py-3 pr-3">
                  ₱{Number(line.sss_employee ?? 0).toFixed(2)}
                </td>
                <td className="py-3 pr-3">
                  ₱{Number(line.philhealth_employee ?? 0).toFixed(2)}
                </td>
                <td className="py-3 pr-3">
                  ₱{Number(line.pagibig_employee ?? 0).toFixed(2)}
                </td>
                <td className="py-3 pr-3">₱{line.tax_amount.toFixed(2)}</td>
                <td className="py-3 pr-3 font-medium">
                  ₱{line.net_pay.toFixed(2)}
                </td>
                <td className="py-3 text-xs text-zinc-500">
                  {line.calc_note ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 text-sm text-zinc-600">
        Flow: draft → submit → approve → lock → generate payslips. Unapproved
        runs cannot be marked paid.
      </p>

      {payslips.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-zinc-500">Generated payslips</h2>
          <ul className="mt-3 divide-y divide-zinc-100 border-t border-zinc-200 text-sm">
            {payslips.map((slip) => {
              const name =
                run.lines.find((l) => l.employee_id === slip.employee_id)
                  ?.employee_name ?? slip.employee_id;
              return (
              <li
                key={slip.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  {name}
                  <div className="text-xs text-zinc-500">
                    Net ${Number(slip.net_pay).toFixed(2)} ·{" "}
                    {new Date(slip.generated_at).toLocaleString()}
                  </div>
                </div>
                <DownloadPayslipButton payslipId={slip.id} />
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 text-sm">
        <Link href="/payroll" className="underline">
          Back to pay runs
        </Link>
      </p>
    </main>
  );
}
