import Link from "next/link";
import { listEmployees } from "@/app/hr/employees/actions";

export default async function HrPage() {
  let employees: Awaited<ReturnType<typeof listEmployees>> = [];
  let loadError: string | null = null;

  try {
    employees = await listEmployees();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load employees";
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="mt-2 text-sm text-zinc-600">
            HR Admin — create and manage employee records.
          </p>
        </div>
        <Link
          href="/hr/employees/new"
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
        >
          Add employee
        </Link>
      </div>

      {loadError ? (
        <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {loadError}. If the table is missing, run{" "}
          <code className="rounded bg-white px-1">
            supabase/migrations/003_employees.sql
          </code>{" "}
          in the SQL Editor.
        </p>
      ) : null}

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Email</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Pay</th>
              <th className="py-2 font-medium">Linked login</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && !loadError ? (
              <tr>
                <td colSpan={5} className="py-6 text-zinc-500">
                  No employees yet. Add your first record.
                </td>
              </tr>
            ) : null}
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-zinc-100">
                <td className="py-3 pr-3">
                  <Link
                    href={`/hr/employees/${emp.id}`}
                    className="font-medium underline"
                  >
                    {emp.full_name}
                  </Link>
                  {emp.job_title ? (
                    <div className="text-xs text-zinc-500">{emp.job_title}</div>
                  ) : null}
                </td>
                <td className="py-3 pr-3">{emp.email}</td>
                <td className="py-3 pr-3 font-mono text-xs">{emp.status}</td>
                <td className="py-3 pr-3">
                  {emp.pay_type === "hourly" ? (
                    <>${emp.pay_rate.toFixed(2)}/hr</>
                  ) : (
                    <>${emp.pay_rate.toFixed(2)} / {emp.pay_frequency}</>
                  )}
                </td>
                <td className="py-3 text-xs text-zinc-500">
                  {emp.user_id ? "Yes" : "No"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </p>
    </main>
  );
}
