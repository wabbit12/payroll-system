import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyEmployee } from "@/app/hr/employees/actions";
import { getSessionProfile } from "@/lib/auth/get-profile";

export default async function MyProfilePage() {
  const { userId } = await getSessionProfile();
  if (!userId) redirect("/login");

  let employee: Awaited<ReturnType<typeof getMyEmployee>> = null;
  let loadError: string | null = null;

  try {
    employee = await getMyEmployee();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load profile";
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
      <p className="mt-2 text-sm text-zinc-600">
        You can only see your own employee record.
      </p>

      {loadError ? (
        <p className="mt-6 text-sm text-red-600">{loadError}</p>
      ) : null}

      {!employee && !loadError ? (
        <p className="mt-6 rounded-md border border-zinc-200 px-3 py-3 text-sm text-zinc-600">
          No employee record is linked to your login yet. Ask HR to create one
          using the <strong>exact same email</strong> you signed up with. If
          they already did, refresh this page — it will auto-link when emails
          match.
        </p>
      ) : null}

      {employee ? (
        <dl className="mt-8 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Name</dt>
            <dd>{employee.full_name}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Email</dt>
            <dd>{employee.email}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Status</dt>
            <dd className="font-mono text-xs">{employee.status}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Job title</dt>
            <dd>{employee.job_title || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Department</dt>
            <dd>{employee.department || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Hire date</dt>
            <dd>{employee.hire_date || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Pay</dt>
            <dd>
              {employee.pay_type === "hourly"
                ? `$${employee.pay_rate.toFixed(2)}/hr`
                : `$${employee.pay_rate.toFixed(2)} / ${employee.pay_frequency}`}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Tax ID</dt>
            <dd>{employee.tax_id_masked || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Bank account</dt>
            <dd>{employee.bank_account_masked || "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Bank routing</dt>
            <dd>{employee.bank_routing_masked || "—"}</dd>
          </div>
        </dl>
      ) : null}

      <p className="mt-8 text-sm">
        <Link href="/me/timesheets" className="underline">
          My timesheets
        </Link>
        {" · "}
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </p>
    </main>
  );
}
