"use client";

import { useActionState, useState, useTransition } from "react";
import {
  approvePayRun,
  deleteDraftPayRun,
  lockPayRun,
  recalculatePayRun,
  rejectPayRun,
  submitPayRunForApproval,
  type PayRunFormState,
} from "@/app/payroll/actions";
import { generatePayslipsForRun } from "@/app/payroll/payslip-actions";
import type { PayRunStatus } from "@/types/database";

const initial: PayRunFormState = {};

export function PayRunActions({
  payRunId,
  status,
}: {
  payRunId: string;
  status: PayRunStatus;
}) {
  const [msg, setMsg] = useState<PayRunFormState & { count?: number }>({});
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");

  const approve = approvePayRun.bind(null, payRunId);
  const reject = rejectPayRun.bind(null, payRunId);
  const [approveState, approveAction, approvePending] = useActionState(
    approve,
    initial,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    reject,
    initial,
  );

  return (
    <div className="space-y-4">
      {(status === "draft" || status === "rejected") && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60"
            onClick={() =>
              start(async () => {
                setMsg(await recalculatePayRun(payRunId));
              })
            }
          >
            {pending ? "Working…" : "Recalculate"}
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() =>
              start(async () => {
                setMsg(await submitPayRunForApproval(payRunId));
              })
            }
          >
            Submit for approval
          </button>
          {status === "draft" ? (
            <button
              type="button"
              disabled={pending}
              className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-60"
              onClick={() =>
                start(async () => {
                  const result = await deleteDraftPayRun(payRunId);
                  if (result.error) setMsg(result);
                })
              }
            >
              Delete draft
            </button>
          ) : null}
        </div>
      )}

      {status === "pending_approval" && (
        <div className="space-y-3 rounded-lg border border-zinc-200 p-4">
          <p className="text-sm text-zinc-600">
            Review totals, then approve or reject. Rejected runs can be
            recalculated and resubmitted.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            Review note (required to reject)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="rounded-md border border-zinc-300 px-3 py-2"
              placeholder="Optional for approve; required for reject"
            />
          </label>
          {(approveState.error || rejectState.error) && (
            <p className="text-sm text-red-600">
              {approveState.error ?? rejectState.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <form action={approveAction}>
              <input type="hidden" name="review_note" value={note} />
              <button
                type="submit"
                disabled={approvePending}
                className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {approvePending ? "Saving…" : "Approve"}
              </button>
            </form>
            <form action={rejectAction}>
              <input type="hidden" name="review_note" value={note} />
              <button
                type="submit"
                disabled={rejectPending}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60"
              >
                {rejectPending ? "Saving…" : "Reject"}
              </button>
            </form>
          </div>
        </div>
      )}

      {status === "approved" && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-zinc-600">
            Approved. Lock to freeze amounts, or generate payslips now.
          </p>
          <button
            type="button"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() =>
              start(async () => {
                setMsg(await lockPayRun(payRunId));
              })
            }
          >
            {pending ? "Locking…" : "Lock pay run"}
          </button>
          <button
            type="button"
            disabled={pending}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60"
            onClick={() =>
              start(async () => {
                setMsg(await generatePayslipsForRun(payRunId));
              })
            }
          >
            {pending ? "Generating…" : "Generate payslips"}
          </button>
        </div>
      )}

      {status === "locked" && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-zinc-600">
            Locked — amounts are immutable. Generate or refresh payslip PDFs.
          </p>
          <button
            type="button"
            disabled={pending}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            onClick={() =>
              start(async () => {
                setMsg(await generatePayslipsForRun(payRunId));
              })
            }
          >
            {pending ? "Generating…" : "Generate payslips"}
          </button>
        </div>
      )}

      {msg.error ? <p className="text-sm text-red-600">{msg.error}</p> : null}
      {msg.ok ? (
        <p className="text-sm text-green-700">
          Updated
          {typeof msg.count === "number" ? ` · ${msg.count} payslip(s)` : ""}.
        </p>
      ) : null}
    </div>
  );
}
