import Link from "next/link";

export default function PayrollPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Payroll Admin</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Pay runs and approvals will live here (Phases 4–5).
      </p>
      <p className="mt-6 text-sm">
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </p>
    </main>
  );
}
