import type { AIOutfitsResponse, GeneratedOutfit } from "../schemas";
import { validateItemIds } from "./generate";
import { comboKey, scoreOutfit, type Affinity } from "./score";
import type { EngineContext, EngineItem } from "./types";

/**
 * Converte le proposte dell'AI in outfit utilizzabili. Scarta quelle con
 * capi inesistenti o non ammessi, strutture non indossabili, capi
 * obbligatori mancanti, duplicati e combinazioni già mostrate.
 */
export function acceptAiOutfits(
  response: AIOutfitsResponse,
  opts: {
    allowed: Map<string, EngineItem>;
    byId: Map<string, EngineItem>;
    ctx: EngineContext;
    affinity: Affinity;
  },
): GeneratedOutfit[] {
  const { allowed, byId, ctx, affinity } = opts;
  const req = ctx.request;
  const required = req.include_item_ids.filter((id) => allowed.has(id));
  const avoided = new Set(req.avoid_combos.map(comboKey));
  const seen = new Set<string>();
  const out: GeneratedOutfit[] = [];
  response.outfits.forEach((o, i) => {
    const check = validateItemIds(o.item_ids, allowed, required);
    if (!check.ok) return;
    const key = comboKey(check.pieces.map((p) => p.item_id));
    if (seen.has(key) || avoided.has(key)) return;
    seen.add(key);
    out.push({
      key: `a-${req.seed}-${i}`,
      name: o.name.trim().slice(0, 80) || "Outfit",
      description: o.description.slice(0, 1000),
      color_story: o.color_story.slice(0, 600),
      tips: o.tips.slice(0, 3).map((t) => t.slice(0, 240)),
      occasion: req.occasion,
      style: req.style ?? req.custom_style,
      season: req.season,
      pieces: check.pieces,
      score: scoreOutfit(check.pieces, byId, ctx, affinity).score,
      source: "ai",
    });
  });
  return out;
}
