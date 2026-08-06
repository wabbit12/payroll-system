import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Super Admin</h1>
      <p className="mt-2 text-sm text-zinc-600">
        System settings and role management will live here.
      </p>
      <p className="mt-6 text-sm">
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </p>
    </main>
  );
}
