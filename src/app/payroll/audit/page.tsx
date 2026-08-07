import Link from "next/link";
import { listAuditLogs } from "@/lib/audit/log";

export default async function AuditLogPage() {
  let logs: Awaited<ReturnType<typeof listAuditLogs>> = [];
  let loadError: string | null = null;

  try {
    logs = await listAuditLogs(150);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load";
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Sensitive payroll and HR actions (approve, pay, bank export, employee
        changes).
      </p>

      {loadError ? (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}. Run{" "}
          <code className="rounded bg-white px-1">
            supabase/migrations/011_audit_notifications.sql
          </code>
          .
        </p>
      ) : null}

      <ul className="mt-8 divide-y divide-zinc-100 border-t border-zinc-200">
        {logs.length === 0 && !loadError ? (
          <li className="py-6 text-sm text-zinc-500">No audit entries yet.</li>
        ) : null}
        {logs.map((row) => (
          <li key={row.id} className="py-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-xs text-zinc-800">
                {row.action}
              </span>
              <span className="text-xs text-zinc-500">
                {new Date(row.created_at).toLocaleString()}
              </span>
            </div>
            {row.summary ? (
              <p className="mt-1 text-zinc-700">{row.summary}</p>
            ) : null}
            <div className="mt-1 text-xs text-zinc-500">
              {row.entity_type}
              {row.entity_id ? (
                <>
                  {" · "}
                  <span className="font-mono">{row.entity_id}</span>
                </>
              ) : null}
              {row.actor_id ? (
                <>
                  {" · actor "}
                  <span className="font-mono">
                    {String(row.actor_id).slice(0, 8)}…
                  </span>
                </>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm">
        <Link href="/payroll" className="underline">
          Back to payroll
        </Link>
      </p>
    </main>
  );
}
