import Link from "next/link";
import { markAllRead, markOneRead } from "@/app/notifications/actions";
import { listMyNotifications } from "@/lib/notifications/notify";

export default async function NotificationsPage() {
  let items: Awaited<ReturnType<typeof listMyNotifications>> = [];
  let loadError: string | null = null;

  try {
    items = await listMyNotifications();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Failed to load";
  }

  const unread = items.filter((n) => !n.read_at).length;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Notifications
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            In-app alerts for approvals, payslips, and payment issues.
            {unread > 0 ? ` ${unread} unread.` : ""}
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllRead}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              Mark all read
            </button>
          </form>
        ) : null}
      </div>

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
        {items.length === 0 && !loadError ? (
          <li className="py-6 text-sm text-zinc-500">No notifications yet.</li>
        ) : null}
        {items.map((n) => (
          <li
            key={n.id}
            className={`flex items-start justify-between gap-4 py-4 text-sm ${
              n.read_at ? "opacity-60" : ""
            }`}
          >
            <div>
              <div className="font-medium">{n.title}</div>
              {n.body ? (
                <p className="mt-1 text-zinc-600">{n.body}</p>
              ) : null}
              <div className="mt-1 text-xs text-zinc-500">
                {new Date(n.created_at).toLocaleString()}
                {n.link ? (
                  <>
                    {" · "}
                    <Link href={n.link} className="underline">
                      Open
                    </Link>
                  </>
                ) : null}
              </div>
            </div>
            {!n.read_at ? (
              <form action={markOneRead.bind(null, n.id)}>
                <button
                  type="submit"
                  className="text-xs text-zinc-600 underline"
                >
                  Mark read
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="underline">
          Back to dashboard
        </Link>
      </p>
    </main>
  );
}
