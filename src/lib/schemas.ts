import { z } from "zod";
import {
  CATEGORY_VALUES,
  COLOR_VALUES,
  FIT_VALUES,
  OCCASION_VALUES,
  PATTERN_VALUES,
  ROLE_VALUES,
  SEASON_VALUES,
  SLOT_VALUES,
  STYLE_VALUES,
} from "./domain";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

// ---------------------------------------------------------------------------
// Capi
// ---------------------------------------------------------------------------
export const clothingItemInputSchema = z.object({
  name: z.string().trim().min(1, "Dai un nome al capo").max(80),
  category: z.enum(CATEGORY_VALUES),
  subcategory: optionalText(60),
  slot: z.enum(SLOT_VALUES),
  primary_color: z.enum(COLOR_VALUES),
  secondary_colors: z.array(z.enum(COLOR_VALUES)).max(4).default([]),
  material: optionalText(60),
  pattern: z.enum(PATTERN_VALUES).default("solid"),
  seasons: z.array(z.enum(SEASON_VALUES)).default([]),
  styles: z.array(z.enum(STYLE_VALUES)).default([]),
  fit: z.enum(FIT_VALUES).nullish().transform((v) => v ?? null),
  formality: z.number().int().min(1).max(5).default(2),
  brand: optionalText(60),
  tags: z.array(z.string().trim().min(1).max(30)).max(20).default([]),
  notes: optionalText(500),
  ai_analyzed: z.boolean().default(false),
});
export type ClothingItemInput = z.input<typeof clothingItemInputSchema>;

export interface ClothingItem {
  id: string;
  user_id: string;
  name: string;
  category: (typeof CATEGORY_VALUES)[number];
  subcategory: string | null;
  slot: (typeof SLOT_VALUES)[number];
  image_path: string | null;
  primary_color: (typeof COLOR_VALUES)[number];
  secondary_colors: (typeof COLOR_VALUES)[number][];
  material: string | null;
  pattern: (typeof PATTERN_VALUES)[number];
  seasons: (typeof SEASON_VALUES)[number][];
  styles: (typeof STYLE_VALUES)[number][];
  fit: (typeof FIT_VALUES)[number] | null;
  formality: number;
  brand: string | null;
  tags: string[];
  notes: string | null;
  is_favorite: boolean;
  wear_count: number;
  last_worn_at: string | null;
  ai_analyzed: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Profilo
// ---------------------------------------------------------------------------
export const profileInputSchema = z.object({
  display_name: optionalText(60),
  style_preferences: z.array(z.enum(STYLE_VALUES)).default([]),
  favorite_colors: z.array(z.enum(COLOR_VALUES)).default([]),
  avoid_colors: z.array(z.enum(COLOR_VALUES)).default([]),
  season_preferences: z.array(z.enum(SEASON_VALUES)).default([]),
  fit_preferences: z.array(z.enum(FIT_VALUES)).default([]),
});

export interface Profile {
  id: string;
  display_name: string | null;
  style_preferences: (typeof STYLE_VALUES)[number][];
  favorite_colors: (typeof COLOR_VALUES)[number][];
  avoid_colors: (typeof COLOR_VALUES)[number][];
  season_preferences: (typeof SEASON_VALUES)[number][];
  fit_preferences: (typeof FIT_VALUES)[number][];
}

// ---------------------------------------------------------------------------
// Outfit
// ---------------------------------------------------------------------------
export interface OutfitItemRow {
  item_id: string;
  role: (typeof ROLE_VALUES)[number];
  position: number;
}

export interface Outfit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  occasion: string | null;
  style: string | null;
  season: string | null;
  color_story: string | null;
  tips: string[];
  rating: number | null;
  is_favorite: boolean;
  source: "ai" | "rules" | "manual";
  notes: string | null;
  created_at: string;
  updated_at: string;
  outfit_items: OutfitItemRow[];
}

export const outfitPieceSchema = z.object({
  item_id: z.string().uuid(),
  role: z.enum(ROLE_VALUES),
});
export type OutfitPiece = z.infer<typeof outfitPieceSchema>;

// ---------------------------------------------------------------------------
// Richiesta di generazione outfit
// ---------------------------------------------------------------------------
export const generateRequestSchema = z.object({
  occasion: z.enum(OCCASION_VALUES).default("everyday"),
  style: z.enum(STYLE_VALUES).nullish().transform((v) => v ?? null),
  custom_style: optionalText(80),
  season: z.enum(SEASON_VALUES),
  temperature: z.number().min(-30).max(50).nullish().transform((v) => v ?? null),
  weather: z.enum(["clear", "cloudy", "rain", "snow", "wind"]).nullish().transform((v) => v ?? null),
  formality: z.number().int().min(1).max(5).nullish().transform((v) => v ?? null),
  preferred_colors: z.array(z.enum(COLOR_VALUES)).default([]),
  avoid_colors: z.array(z.enum(COLOR_VALUES)).default([]),
  include_item_ids: z.array(z.string().uuid()).max(6).default([]),
  exclude_item_ids: z.array(z.string().uuid()).max(200).default([]),
  rediscover: z.boolean().default(false),
  /** Combinazioni già mostrate da non riproporre. */
  avoid_combos: z.array(z.array(z.string().uuid()).max(12)).max(40).default([]),
  count: z.number().int().min(1).max(6).default(4),
  seed: z.number().int().default(1),
  use_ai: z.boolean().default(true),
});
export type GenerateRequest = z.output<typeof generateRequestSchema>;
export type GenerateRequestInput = z.input<typeof generateRequestSchema>;

export interface GeneratedOutfit {
  key: string;
  name: string;
  description: string;
  occasion: string;
  style: string | null;
  season: string;
  color_story: string;
  tips: string[];
  pieces: OutfitPiece[];
  score: number;
  source: "ai" | "rules";
}

export interface GenerateResponse {
  outfits: GeneratedOutfit[];
  notices: string[];
  ai: { used: boolean; reason?: string };
}

// ---------------------------------------------------------------------------
// Output strutturati dell'AI (validati prima dell'uso)
// ---------------------------------------------------------------------------
export const garmentAnalysisSchema = z.object({
  is_clothing: z.boolean().describe("false se la foto non mostra un capo o accessorio"),
  name: z.string().describe("Nome breve e descrittivo in italiano, es. 'Camicia oxford azzurra'"),
  category: z.enum(CATEGORY_VALUES),
  subcategory: z.string().describe("Tipologia specifica in italiano, es. 'chino', 'cardigan', 'mocassini'"),
  slot: z.enum(SLOT_VALUES),
  primary_color: z.enum(COLOR_VALUES),
  secondary_colors: z.array(z.enum(COLOR_VALUES)),
  material: z.string().describe("Materiale apparente in italiano, es. 'cotone', 'lana', 'denim', 'pelle'"),
  pattern: z.enum(PATTERN_VALUES),
  seasons: z.array(z.enum(SEASON_VALUES)),
  styles: z.array(z.enum(STYLE_VALUES)),
  fit: z.enum(FIT_VALUES).nullable(),
  formality: z.number().int().describe("Da 1 (molto informale) a 5 (molto formale)"),
  brand: z.string().nullable().describe("Solo se un logo o un'etichetta sono chiaramente leggibili"),
  tags: z.array(z.string()).describe("Massimo 5 tag brevi in italiano"),
  confidence: z.number().describe("Confidenza complessiva da 0 a 1"),
});
export type GarmentAnalysis = z.infer<typeof garmentAnalysisSchema>;

export const aiOutfitSchema = z.object({
  item_ids: z.array(z.string()).describe("Identificativi dei capi scelti, presi SOLO dall'elenco fornito"),
  name: z.string().describe("Nome creativo e breve in italiano"),
  description: z.string().describe("Descrizione dello stile, 1-2 frasi"),
  color_story: z.string().describe("Perché colori, proporzioni e materiali funzionano insieme"),
  tips: z.array(z.string()).describe("2-3 consigli pratici per indossarlo al meglio"),
});

export const aiOutfitsResponseSchema = z.object({
  outfits: z.array(aiOutfitSchema),
  missing: z.array(z.string()).describe("Capi che mancano nel guardaroba per questa richiesta, se rilevanti"),
});
export type AIOutfitsResponse = z.infer<typeof aiOutfitsResponseSchema>;
