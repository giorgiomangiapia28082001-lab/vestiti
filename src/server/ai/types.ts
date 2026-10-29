import "server-only";
import type { AIOutfitsResponse, GarmentAnalysis } from "@/lib/schemas";

export interface ImageInput {
  /** Contenuto base64 senza prefisso data URL. */
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

/** Capo descritto in forma compatta per il modello. */
export interface CompactItem {
  id: string;
  name: string;
  category: string;
  slot: string;
  color: string;
  secondary: string[];
  material: string | null;
  pattern: string;
  seasons: string[];
  styles: string[];
  fit: string | null;
  formality: number;
  worn: number;
}

export interface OutfitBrief {
  occasion: string;
  style: string | null;
  season: string;
  temperature: number | null;
  weather: string | null;
  formality: number;
  preferredColors: string[];
  avoidColors: string[];
  mustInclude: string[];
  rediscover: boolean;
  count: number;
  tasteNotes: string[];
}

export interface ComposeInput {
  brief: OutfitBrief;
  items: CompactItem[];
  /** Combinazioni pre-calcolate dal motore a regole, come spunto. */
  suggestions: string[][];
  /** Combinazioni già proposte da non ripetere. */
  avoid: string[][];
}

/**
 * Interfaccia comune per i provider AI. Per cambiare modello o fornitore
 * basta implementarla e registrarla in ./index.ts.
 */
export interface AIProvider {
  readonly name: string;
  analyzeGarment(image: ImageInput): Promise<GarmentAnalysis>;
  composeOutfits(input: ComposeInput): Promise<AIOutfitsResponse>;
}

export class AIError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "refused" | "invalid_output" | "rate_limited" | "provider_error",
  ) {
    super(message);
  }
}
