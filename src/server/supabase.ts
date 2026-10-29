import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/config";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Autentica la richiesta tramite il token di sessione Supabase inviato
 * nell'header Authorization e restituisce un client che agisce come
 * l'utente: tutte le query restano soggette alla Row Level Security.
 */
export async function requireUser(request: Request): Promise<{ supabase: SupabaseClient; user: User }> {
  if (!isSupabaseConfigured) throw new HttpError(503, "Database non configurato.");
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Accesso richiesto.");
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Sessione scaduta: accedi di nuovo.");
  return { supabase, user: data.user };
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  console.error(error);
  return Response.json({ error: "Si è verificato un errore imprevisto." }, { status: 500 });
}
