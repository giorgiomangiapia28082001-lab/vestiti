import "server-only";
import { z } from "zod";
import {
  CATEGORIES,
  CATEGORY_VALUES,
  COLORS,
  FITS,
  PATTERNS,
  SEASONS,
  STYLES,
  COLOR_VALUES,
  FIT_VALUES,
  PATTERN_VALUES,
  SEASON_VALUES,
  SLOT_VALUES,
  STYLE_VALUES,
  categoryInfo,
} from "@/lib/domain";
import { aiOutfitsResponseSchema, garmentAnalysisSchema } from "@/lib/schemas";
import { AIError, type AIProvider, type ComposeInput, type ImageInput } from "../types";
import { ANALYZE_SYSTEM, COMPOSE_SYSTEM, composePrompt } from "./prompts";

/*
  Google Gemini tramite API REST, come nell'app Garage: si usa un modello
  "flash" ancora disponibile (l'elenco viene chiesto al servizio) e, se uno
  è sovraccarico o non risponde, si passa al successivo.
*/

const API = "https://generativelanguage.googleapis.com/v1beta";
const PREFERRED = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-flash-lite-latest", "gemini-2.5-flash-lite"];
const MODEL_CACHE_MS = 6 * 3600e3;

let modelCache: { list: string[]; at: number } | null = null;

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------------------
// Normalizzazione: i modelli a volte usano valori fuori vocabolario.
// ---------------------------------------------------------------------------
const oneOf = <T extends string>(values: readonly T[], v: unknown, fallback: T): T =>
  values.includes(canon(v) as T) ? (canon(v) as T) : fallback;
const manyOf = <T extends string>(values: readonly T[], v: unknown): T[] =>
  Array.isArray(v) ? [...new Set(v.map(canon).filter((x): x is T => values.includes(x as T)))] : [];
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

// Accetta anche le etichette italiane ("azzurro") e qualche sinonimo inglese.
const ALIASES: Record<string, string> = Object.fromEntries([
  ...[...COLORS, ...SEASONS, ...STYLES, ...PATTERNS, ...FITS, ...CATEGORIES].map((x) => [x.label.toLowerCase(), x.value]),
  ["fall", "autumn"],
  ["navy", "navy"],
  ["gray", "grey"],
  ["dark grey", "charcoal"],
  ["khaki", "beige"],
  ["tan", "camel"],
  ["smart casual", "smart_casual"],
  ["old money", "old_money"],
  ["sport", "sporty"],
]);
const canon = (v: unknown) => {
  if (typeof v !== "string") return v;
  const k = v.trim().toLowerCase();
  return ALIASES[k] ?? k.replace(/[\s-]+/g, "_");
};

function normalizeGarment(raw: Record<string, unknown>) {
  const category = oneOf(CATEGORY_VALUES, raw.category, "other");
  return {
    is_clothing: raw.is_clothing !== false,
    name: str(raw.name, "Capo"),
    category,
    subcategory: str(raw.subcategory),
    slot: oneOf(SLOT_VALUES, raw.slot, categoryInfo(category).slot),
    primary_color: oneOf(COLOR_VALUES, raw.primary_color, "black"),
    secondary_colors: manyOf(COLOR_VALUES, raw.secondary_colors),
    material: str(raw.material),
    pattern: oneOf(PATTERN_VALUES, raw.pattern, "solid"),
    seasons: manyOf(SEASON_VALUES, raw.seasons),
    styles: manyOf(STYLE_VALUES, raw.styles),
    fit: FIT_VALUES.includes(canon(raw.fit) as never) ? (canon(raw.fit) as (typeof FIT_VALUES)[number]) : null,
    formality: Number.isFinite(Number(raw.formality)) ? Number(raw.formality) : 2,
    brand: typeof raw.brand === "string" && raw.brand.trim() ? raw.brand : null,
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string") : [],
    confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : 0.5,
  };
}

function parseJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";

  constructor(
    private apiKey: string,
    private forcedModel?: string,
  ) {}

  private async models(): Promise<string[]> {
    if (this.forcedModel) return [this.forcedModel];
    if (!modelCache || Date.now() - modelCache.at > MODEL_CACHE_MS) {
      try {
        const list = await withTimeout(4000, async (signal) => {
          const r = await fetch(`${API}/models?pageSize=200&key=${this.apiKey}`, { signal });
          const d = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
          return (d.models ?? [])
            .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
            .map((m) => m.name.replace(/^models\//, ""));
        });
        if (list.length) modelCache = { list, at: Date.now() };
      } catch {
        // elenco non disponibile: si usano i preferiti
      }
    }
    const available = modelCache?.list;
    if (!available) return PREFERRED.slice(0, 3);
    const out = PREFERRED.filter((m) => available.includes(m));
    for (const m of available) {
      if (out.length >= 3) break;
      if (!out.includes(m) && /flash/.test(m) && !/image|tts|audio|live|embedding|thinking-exp/.test(m)) out.push(m);
    }
    return out.slice(0, 3);
  }

  /** Chiede una risposta JSON, provando i modelli in ordine. */
  private async generate(system: string, parts: object[], maxTokens: number, budgetMs: number): Promise<Record<string, unknown>> {
    const models = await this.models();
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { maxOutputTokens: maxTokens, responseMimeType: "application/json", temperature: 0.4 },
    });
    const started = Date.now();
    const errors: string[] = [];
    for (const [i, model] of models.entries()) {
      const left = budgetMs - (Date.now() - started);
      if (left < 2500) break;
      const slice = i < models.length - 1 ? Math.max(2500, Math.round(left * 0.6)) : left;
      try {
        const res = await withTimeout(slice, (signal) =>
          fetch(`${API}/models/${model}:generateContent?key=${this.apiKey}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body,
            signal,
          }),
        );
        if (res.status === 400 || res.status === 401 || res.status === 403) {
          const detail = await res.text();
          if (/API key|PERMISSION|UNAUTHENTICATED/i.test(detail)) {
            throw new AIError("Chiave Gemini non valida: controlla GEMINI_API_KEY.", "not_configured");
          }
          errors.push(`${model}: ${res.status}`);
          continue;
        }
        if (!res.ok) {
          errors.push(`${model}: ${res.status}`);
          continue;
        }
        const data = (await res.json()) as {
          candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
          promptFeedback?: { blockReason?: string };
        };
        if (data.promptFeedback?.blockReason) throw new AIError("Il modello ha rifiutato la richiesta.", "refused");
        const text = (data.candidates?.[0]?.content?.parts ?? [])
          .filter((p) => !p.thought)
          .map((p) => p.text ?? "")
          .join("")
          .trim();
        if (!text) {
          errors.push(`${model}: risposta vuota`);
          continue;
        }
        try {
          return parseJson(text);
        } catch {
          errors.push(`${model}: JSON non valido`);
        }
      } catch (error) {
        if (error instanceof AIError) throw error;
        errors.push(`${model}: ${(error as Error).name === "AbortError" ? "tempo scaduto" : "errore di rete"}`);
      }
    }
    console.error("Gemini:", errors.join(" | "));
    throw new AIError("Lo stylist AI non è disponibile in questo momento.", "provider_error");
  }

  async analyzeGarment(image: ImageInput) {
    const raw = await this.generate(
      ANALYZE_SYSTEM + `\n\nRispondi SOLO con un oggetto JSON con queste chiavi: ${Object.keys(garmentAnalysisSchema.shape).join(", ")}.`,
      [{ inline_data: { mime_type: image.mediaType, data: image.base64 } }, { text: "Analizza questo capo e restituisci le sue caratteristiche." }],
      2048,
      25_000,
    );
    const parsed = garmentAnalysisSchema.safeParse(normalizeGarment(raw));
    if (!parsed.success) throw new AIError("Risposta AI non valida.", "invalid_output");
    return parsed.data;
  }

  async composeOutfits(input: ComposeInput) {
    const raw = await this.generate(
      COMPOSE_SYSTEM +
        '\n\nRispondi SOLO con un oggetto JSON nel formato {"outfits":[{"item_ids":["..."],"name":"...","description":"...","color_story":"...","tips":["..."]}],"missing":["..."]}.',
      [{ text: composePrompt(input) }],
      8192,
      40_000,
    );
    const lenient = z
      .object({ outfits: z.array(z.unknown()).catch([]), missing: z.array(z.unknown()).catch([]) })
      .parse(raw);
    const outfits = lenient.outfits
      .map((o) => aiOutfitsResponseSchema.shape.outfits.element.safeParse(o))
      .filter((r) => r.success)
      .map((r) => r.data!);
    const missing = lenient.missing.filter((m): m is string => typeof m === "string");
    return { outfits, missing };
  }
}
