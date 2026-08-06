import Link from "next/link";
import { redirect } from "next/navigation";
import { canAccessPath, isAdminRole, roleLabel } from "@/lib/auth/roles";
import { getSessionProfile } from "@/lib/auth/get-profile";
import type { UserRole } from "@/types/database";

const NAV: { href: string; label: string; rolesHint: string }[] = [
  { href: "/me", label: "My profile", rolesHint: "all" },
  { href: "/me/timesheets", label: "My timesheets", rolesHint: "all" },
  { href: "/manager", label: "Manager approvals", rolesHint: "manager+" },
  { href: "/hr", label: "HR / Employees", rolesHint: "hr_admin" },
  { href: "/payroll", label: "Payroll", rolesHint: "payroll_admin" },
  { href: "/admin", label: "Admin", rolesHint: "super_admin" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const params = await searchParams;
  const { userId, email, profile } = await getSessionProfile();

  if (!userId) {
    redirect("/login");
  }

  const role = profile?.role ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-sm text-zinc-600">Signed in as {email}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            Sign out
          </button>
        </form>
      </div>

      {params.denied ? (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You don&apos;t have access to that area with your current role.
        </p>
      ) : null}

      <section className="mt-8 rounded-lg border border-zinc-200 p-4">
        <h2 className="text-sm font-medium text-zinc-500">Profile</h2>
        {profile ? (
          <dl className="mt-3 grid gap-2 text-sm">
            <div>
              <dt className="text-zinc-500">Name</dt>
              <dd>{profile.full_name}</dd>
            </div>
            <div>
              <dt className="text-zinc-500">Role</dt>
              <dd>
                {roleLabel(profile.role)}{" "}
                <span className="font-mono text-zinc-500">({profile.role})</span>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-amber-700">
            No profile row yet. Run{" "}
            <code className="rounded bg-zinc-100 px-1">
              supabase/migrations/001_profiles.sql
            </code>{" "}
            in the Supabase SQL Editor.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-zinc-500">Areas you can open</h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm">
          {NAV.map((item) => {
            const allowed =
              item.href.startsWith("/me") ||
              canAccessPath(item.href, role as UserRole | null);
            return (
              <li key={item.href}>
                {allowed ? (
                  <Link href={item.href} className="underline">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-zinc-400">
                    {item.label}{" "}
                    <span className="text-xs">(needs {item.rolesHint})</span>
                  </span>
                )}
              </li>
            );
          })}
          {isAdminRole(role) ? (
            <li>
              <Link href="/mfa" className="underline">
                Set up MFA
              </Link>
            </li>
          ) : null}
        </ul>
      </section>

      <p className="mt-8 text-sm text-zinc-600">
        Phase 3: timesheets. Next: pay runs.{" "}
        <Link href="/" className="underline">
          Home
        </Link>
      </p>
    </main>
  );
}
