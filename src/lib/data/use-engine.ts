"use client";

import { useMemo } from "react";
import { explainOutfit, type Candidate, type EngineItem, type FeedbackOutfit, type UserTaste } from "../engine";
import type { GeneratedOutfit, GenerateRequest } from "../schemas";
import { useOutfits, useProfile } from "./hooks";

/** Gusti e feedback dell'utente per il motore eseguito nel browser. */
export function useTasteAndFeedback(): { taste: UserTaste; feedback: FeedbackOutfit[] } {
  const { data: profile } = useProfile();
  const { data: outfits } = useOutfits();
  return useMemo(
    () => ({
      taste: {
        favorite_colors: profile?.favorite_colors ?? [],
        avoid_colors: profile?.avoid_colors ?? [],
        style_preferences: profile?.style_preferences ?? [],
      },
      feedback: (outfits ?? []).map((o) => ({
        item_ids: o.outfit_items.map((x) => x.item_id),
        rating: o.rating,
        is_favorite: o.is_favorite,
      })),
    }),
    [profile, outfits],
  );
}

export function candidateToGenerated(c: Candidate, byId: Map<string, EngineItem>, req: GenerateRequest, key: string): GeneratedOutfit {
  return {
    key,
    ...explainOutfit(c.pieces, byId, req),
    occasion: req.occasion,
    style: req.style ?? req.custom_style,
    season: req.season,
    pieces: c.pieces,
    score: c.score,
    source: "rules",
  };
}
