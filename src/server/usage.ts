import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiDailyLimit } from "./ai";

/** Verifica il limite giornaliero di chiamate AI e, se c'è margine, lo registra. */
export async function consumeAiQuota(
  supabase: SupabaseClient,
  userId: string,
  kind: "analyze" | "outfits",
): Promise<{ allowed: boolean; remaining: number }> {
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) throw error;
  const limit = aiDailyLimit();
  const used = count ?? 0;
  if (used >= limit) return { allowed: false, remaining: 0 };
  const { error: insertError } = await supabase.from("ai_usage").insert({ user_id: userId, kind });
  if (insertError) throw insertError;
  return { allowed: true, remaining: limit - used - 1 };
}
