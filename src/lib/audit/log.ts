import { createClient } from "@/lib/supabase/server";

export type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("audit_logs").insert({
      actor_id: user?.id ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      summary: input.summary ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    // Audit must not break primary workflows.
  }
}

export async function listAuditLogs(limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}
