import "server-only";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";
import type { AIProvider } from "./types";

export * from "./types";

let cached: AIProvider | null | undefined;

/** Chiave Gemini: col nome esatto o con un nome simile (come nell'app Garage). */
function geminiKey(): string {
  const exact = process.env.GEMINI_API_KEY?.trim();
  if (exact) return exact;
  const name = Object.keys(process.env).find((k) => /GEMINI|GOOGLE_AI/i.test(k) && /KEY|TOKEN|API/i.test(k) && process.env[k]);
  return name ? process.env[name]!.trim() : "";
}

/**
 * Restituisce il provider AI configurato tramite variabili d'ambiente,
 * oppure null se l'AI non è disponibile. In quel caso l'app usa il
 * motore a regole e l'estrazione dei colori lato client.
 *
 * AI_PROVIDER: "gemini" | "anthropic" | "none". Se non è impostato si usa
 *              Gemini quando c'è GEMINI_API_KEY, altrimenti Claude con
 *              ANTHROPIC_API_KEY.
 * AI_MODEL:    modello specifico (facoltativo). Per Gemini, se manca, viene
 *              scelto automaticamente un modello "flash" disponibile.
 */
export function getAIProvider(): AIProvider | null {
  if (cached !== undefined) return cached;
  const requested = process.env.AI_PROVIDER?.toLowerCase();
  const gemini = geminiKey();
  const anthropic = process.env.ANTHROPIC_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim() || undefined;

  if (requested === "none") cached = null;
  else if ((requested === "gemini" || !requested) && gemini) cached = new GeminiProvider(gemini, model);
  else if ((requested === "anthropic" || !requested) && anthropic) cached = new AnthropicProvider(anthropic, model ?? "claude-opus-5-5");
  else cached = null;
  return cached;
}

/** Numero massimo di chiamate AI per utente nelle ultime 24 ore. */
export function aiDailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT ?? 60);
  return Number.isFinite(n) && n > 0 ? n : 60;
}
