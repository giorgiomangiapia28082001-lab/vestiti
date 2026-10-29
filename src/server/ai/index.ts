import "server-only";
import { AnthropicProvider } from "./providers/anthropic";
import type { AIProvider } from "./types";

export * from "./types";

let cached: AIProvider | null | undefined;

/**
 * Restituisce il provider AI configurato tramite variabili d'ambiente,
 * oppure null se l'AI non è disponibile. In quel caso l'app usa il
 * motore a regole e l'estrazione dei colori lato client.
 *
 * AI_PROVIDER: "anthropic" (predefinito se c'è una chiave) | "none"
 * AI_MODEL:    modello da usare (predefinito: claude-opus-5-5)
 */
export function getAIProvider(): AIProvider | null {
  if (cached !== undefined) return cached;
  const provider = (process.env.AI_PROVIDER ?? "anthropic").toLowerCase();
  const model = process.env.AI_MODEL || "claude-opus-5-5";
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    cached = new AnthropicProvider(process.env.ANTHROPIC_API_KEY, model);
  } else {
    cached = null;
  }
  return cached;
}

/** Numero massimo di chiamate AI per utente nelle ultime 24 ore. */
export function aiDailyLimit(): number {
  const n = Number(process.env.AI_DAILY_LIMIT ?? 60);
  return Number.isFinite(n) && n > 0 ? n : 60;
}
