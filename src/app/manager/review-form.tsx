"use client";

import { useActionState, useState } from "react";
import {
  reviewTimesheet,
  type TimesheetFormState,
} from "@/app/me/timesheets/actions";
import type { TimesheetWithEntries } from "@/types/database";

const initial: TimesheetFormState = {};

export function ReviewForm({
  timesheet,
}: {
  timesheet: TimesheetWithEntries;
}) {
  const [note, setNote] = useState("");
  const approve = reviewTimesheet.bind(null, timesheet.id, "approved");
  const reject = reviewTimesheet.bind(null, timesheet.id, "rejected");
  const [approveState, approveAction, approvePending] = useActionState(
    approve,
    initial,
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    reject,
    initial,
  );

  return (
    <div className="mt-8 space-y-6">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Employee</dt>
          <dd>{timesheet.employee_name}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Period</dt>
          <dd>
            {timesheet.period_start} → {timesheet.period_end}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Total hours</dt>
          <dd>{(timesheet.total_hours ?? 0).toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Status</dt>
          <dd className="font-mono text-xs">{timesheet.status}</dd>
        </div>
      </dl>

      <section>
        <h2 className="text-sm font-medium text-zinc-500">Entries</h2>
        <ul className="mt-3 divide-y divide-zinc-100 border-t border-zinc-200 text-sm">
          {timesheet.entries.map((entry) => (
            <li key={entry.id} className="py-3">
              {entry.work_date} · {Number(entry.hours).toFixed(2)}h ·{" "}
              <span className="font-mono text-xs">{entry.entry_type}</span>
            </li>
          ))}
        </ul>
      </section>

      {timesheet.status === "submitted" ? (
        <div className="space-y-4 rounded-lg border border-zinc-200 p-4">
          <label className="flex flex-col gap-1 text-sm">
            Review note (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>

          {approveState.error || rejectState.error ? (
            <p className="text-sm text-red-600">
              {approveState.error ?? rejectState.error}
            </p>
          ) : null}

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
      ) : (
        <p className="text-sm text-zinc-600">
          Already reviewed as{" "}
          <span className="font-mono">{timesheet.status}</span>.
          {timesheet.review_note ? ` Note: ${timesheet.review_note}` : ""}
        </p>
      )}
    </div>
  );
}
