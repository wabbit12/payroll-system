import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type NotificationInput = {
  userId: string;
  title: string;
  body?: string;
  link?: string;
};

/** Cross-user notify via service role (bypasses RLS insert limits). */
export async function notifyUser(input: NotificationInput): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      user_id: input.userId,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
  } catch {
    // Notifications must not break primary workflows.
  }
}

export async function notifyRoles(
  roles: UserRole[],
  payload: Omit<NotificationInput, "userId">,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, role")
      .in("role", roles);

    for (const profile of profiles ?? []) {
      await notifyUser({
        userId: profile.id,
        title: payload.title,
        body: payload.body,
        link: payload.link,
      });
    }
  } catch {
    // ignore
  }
}

export async function listMyNotifications(limit = 50) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);
}

export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
}
