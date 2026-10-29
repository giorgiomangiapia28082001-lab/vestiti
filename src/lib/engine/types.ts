import type { ClothingItem, GenerateRequest, OutfitPiece } from "../schemas";

/** Campi di un capo usati dal motore. */
export type EngineItem = Pick<
  ClothingItem,
  | "id"
  | "name"
  | "category"
  | "subcategory"
  | "slot"
  | "primary_color"
  | "secondary_colors"
  | "material"
  | "pattern"
  | "seasons"
  | "styles"
  | "fit"
  | "formality"
  | "is_favorite"
  | "wear_count"
  | "last_worn_at"
>;

/** Feedback dell'utente su outfit passati, usato per apprendere i gusti. */
export interface FeedbackOutfit {
  item_ids: string[];
  rating: number | null;
  is_favorite: boolean;
}

export interface UserTaste {
  favorite_colors: string[];
  avoid_colors: string[];
  style_preferences: string[];
}

export interface EngineContext {
  request: GenerateRequest;
  taste?: UserTaste;
  feedback?: FeedbackOutfit[];
  /** Data di riferimento (per "indossato di recente"). */
  today?: Date;
}

export interface ScoreBreakdown {
  color: number;
  formality: number;
  style: number;
  season: number;
  structure: number;
  bonus: number;
}

export interface Candidate {
  pieces: OutfitPiece[];
  items: EngineItem[];
  score: number;
  breakdown: ScoreBreakdown;
}
