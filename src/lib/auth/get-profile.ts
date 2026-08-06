import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export async function getSessionProfile(): Promise<{
  userId: string | null;
  email: string | null;
  profile: Profile | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null, email: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: profile ?? null,
  };
}
