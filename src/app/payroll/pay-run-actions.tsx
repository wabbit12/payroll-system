"use client";

import { useState, useTransition } from "react";
import {
  deleteDraftPayRun,
  recalculatePayRun,
  type PayRunFormState,
} from "@/app/payroll/actions";

export function PayRunActions({
  payRunId,
  status,
}: {
  payRunId: string;
  status: string;
}) {
  const [msg, setMsg] = useState<PayRunFormState>({});
  const [pending, start] = useTransition();

  if (status !== "draft") {
    return (
      <p className="text-sm text-zinc-600">
        This run is <span className="font-mono">{status}</span> and cannot be
        recalculated here (Phase 5 approval comes next).
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        onClick={() =>
          start(async () => {
            const result = await recalculatePayRun(payRunId);
            setMsg(result);
          })
        }
      >
        {pending ? "Working…" : "Recalculate"}
      </button>
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
      {msg.error ? (
        <p className="w-full text-sm text-red-600">{msg.error}</p>
      ) : null}
      {msg.ok ? (
        <p className="w-full text-sm text-green-700">Recalculated.</p>
      ) : null}
    </div>
  );
}
