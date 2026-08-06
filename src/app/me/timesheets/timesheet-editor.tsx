"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addTimesheetEntry,
  deleteTimesheetEntry,
  submitTimesheet,
  type TimesheetFormState,
} from "@/app/me/timesheets/actions";
import type { TimesheetWithEntries } from "@/types/database";

const initial: TimesheetFormState = {};

export function TimesheetEditor({
  timesheet,
}: {
  timesheet: TimesheetWithEntries;
}) {
  const editable =
    timesheet.status === "draft" || timesheet.status === "rejected";
  const addAction = addTimesheetEntry.bind(null, timesheet.id);
  const [addState, addFormAction, addPending] = useActionState(
    addAction,
    initial,
  );
  const [submitMsg, setSubmitMsg] = useState<TimesheetFormState>({});
  const [pendingSubmit, startSubmit] = useTransition();
  const [pendingDelete, startDelete] = useTransition();

  return (
    <div className="mt-8 space-y-8">
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Period</dt>
          <dd>
            {timesheet.period_start} → {timesheet.period_end}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Status</dt>
          <dd className="font-mono text-xs">{timesheet.status}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Total hours</dt>
          <dd>{(timesheet.total_hours ?? 0).toFixed(2)}</dd>
        </div>
        {timesheet.review_note ? (
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Manager note</dt>
            <dd>{timesheet.review_note}</dd>
          </div>
        ) : null}
      </dl>

      <section>
        <h2 className="text-sm font-medium text-zinc-500">Entries</h2>
        <ul className="mt-3 divide-y divide-zinc-100 border-t border-zinc-200 text-sm">
          {timesheet.entries.length === 0 ? (
            <li className="py-4 text-zinc-500">No hours logged yet.</li>
          ) : null}
          {timesheet.entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div>
                <div>
                  {entry.work_date} · {Number(entry.hours).toFixed(2)}h ·{" "}
                  <span className="font-mono text-xs">{entry.entry_type}</span>
                </div>
                {entry.notes ? (
                  <div className="text-xs text-zinc-500">{entry.notes}</div>
                ) : null}
              </div>
              {editable ? (
                <button
                  type="button"
                  disabled={pendingDelete}
                  className="text-xs text-red-600 underline disabled:opacity-60"
                  onClick={() =>
                    startDelete(async () => {
                      await deleteTimesheetEntry(timesheet.id, entry.id);
                    })
                  }
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {editable ? (
        <form
          action={addFormAction}
          className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4"
        >
          <h2 className="text-sm font-medium">Add hours</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              Date
              <input
                name="work_date"
                type="date"
                required
                min={timesheet.period_start}
                max={timesheet.period_end}
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Hours
              <input
                name="hours"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                required
                className="rounded-md border border-zinc-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Type
              <select
                name="entry_type"
                defaultValue="regular"
                className="rounded-md border border-zinc-300 px-3 py-2"
              >
                <option value="regular">Regular</option>
                <option value="overtime">Overtime</option>
                <option value="unpaid_leave">Unpaid leave</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Notes
            <input
              name="notes"
              className="rounded-md border border-zinc-300 px-3 py-2"
            />
          </label>
          {addState.error ? (
            <p className="text-sm text-red-600">{addState.error}</p>
          ) : null}
          <button
            type="submit"
            disabled={addPending}
            className="w-fit rounded-md border border-zinc-300 px-3 py-2 text-sm disabled:opacity-60"
          >
            {addPending ? "Adding…" : "Add entry"}
          </button>
        </form>
      ) : null}

      {editable ? (
        <div className="flex flex-col gap-2">
          {submitMsg.error ? (
            <p className="text-sm text-red-600">{submitMsg.error}</p>
          ) : null}
          {submitMsg.ok ? (
            <p className="text-sm text-green-700">Submitted for approval.</p>
          ) : null}
          <button
            type="button"
            disabled={pendingSubmit}
            onClick={() =>
              startSubmit(async () => {
                const result = await submitTimesheet(timesheet.id);
                setSubmitMsg(result);
              })
            }
            className="w-fit rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pendingSubmit ? "Submitting…" : "Submit for approval"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">
          This timesheet is <span className="font-mono">{timesheet.status}</span>
          {timesheet.status === "submitted"
            ? " and waiting on a manager."
            : "."}
        </p>
      )}
    </div>
  );
}
