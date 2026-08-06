import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-zinc-500">
        Payroll Management
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight">
        Secure payroll for your team
      </h1>
      <p className="mt-4 max-w-xl text-zinc-600">
        Next.js + Supabase starter with auth, roles, and a path to pay runs,
        approvals, and payslips.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium"
        >
          Create account
        </Link>
      </div>
    </main>
  );
}
