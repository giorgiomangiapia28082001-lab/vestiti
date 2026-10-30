import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { label } from "@/lib/domain";
import {
  acceptAiOutfits,
  buildAffinity,
  comboKey,
  explainOutfit,
  generateCandidates,
  targetFormality,
  type EngineItem,
  type FeedbackOutfit,
  type UserTaste,
} from "@/lib/engine";
import type { GeneratedOutfit, GenerateRequest, GenerateResponse, Profile } from "@/lib/schemas";
import { AIError, getAIProvider, type CompactItem } from "./ai";
import { consumeAiQuota } from "./usage";

const ITEM_FIELDS =
  "id,name,category,subcategory,slot,primary_color,secondary_colors,material,pattern,seasons,styles,fit,formality,is_favorite,wear_count,last_worn_at";

/** Numero massimo di capi inviati al modello in una richiesta. */
const MAX_AI_ITEMS = 120;

async function loadContext(supabase: SupabaseClient, userId: string) {
  const [items, profile, outfits] = await Promise.all([
    supabase.from("clothing_items").select(ITEM_FIELDS).eq("user_id", userId).limit(1000),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("outfits")
      .select("rating,is_favorite,outfit_items(item_id)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  if (items.error) throw items.error;
  if (outfits.error) throw outfits.error;
  const feedback: FeedbackOutfit[] = (outfits.data ?? []).map((o) => ({
    rating: o.rating,
    is_favorite: o.is_favorite,
    item_ids: (o.outfit_items as { item_id: string }[]).map((x) => x.item_id),
  }));
  const p = profile.data as Profile | null;
  const taste: UserTaste = {
    favorite_colors: p?.favorite_colors ?? [],
    avoid_colors: p?.avoid_colors ?? [],
    style_preferences: p?.style_preferences ?? [],
  };
  return { items: (items.data ?? []) as EngineItem[], feedback, taste };
}

function compact(item: EngineItem): CompactItem {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    slot: item.slot,
    color: item.primary_color,
    secondary: item.secondary_colors,
    material: item.material,
    pattern: item.pattern,
    seasons: item.seasons,
    styles: item.styles,
    fit: item.fit,
    formality: item.formality,
    worn: item.wear_count,
  };
}

function tasteNotes(taste: UserTaste, feedback: FeedbackOutfit[], byId: Map<string, EngineItem>): string[] {
  const notes: string[] = [];
  if (taste.style_preferences.length) notes.push(`Stili preferiti: ${taste.style_preferences.map(label.style).join(", ")}`);
  if (taste.favorite_colors.length) notes.push(`Colori preferiti: ${taste.favorite_colors.map(label.color).join(", ")}`);
  if (taste.avoid_colors.length) notes.push(`Colori poco amati: ${taste.avoid_colors.map(label.color).join(", ")}`);
  const affinity = buildAffinity(feedback);
  const liked = [...affinity.item].filter(([, v]) => v > 0.4).map(([id]) => byId.get(id)?.name).filter(Boolean);
  const disliked = [...affinity.item].filter(([, v]) => v < -0.4).map(([id]) => byId.get(id)?.name).filter(Boolean);
  if (liked.length) notes.push(`Capi presenti in outfit molto apprezzati: ${liked.slice(0, 8).join(", ")}`);
  if (disliked.length) notes.push(`Capi presenti in outfit valutati male: ${disliked.slice(0, 8).join(", ")}`);
  return notes;
}

/**
 * Genera outfit combinando il motore a regole con l'AI (se configurata).
 * Ogni proposta dell'AI viene validata contro i capi reali dell'utente;
 * quelle non valide vengono scartate e sostituite da proposte del motore.
 */
export async function generateOutfits(
  supabase: SupabaseClient,
  userId: string,
  req: GenerateRequest,
): Promise<GenerateResponse> {
  const { items, feedback, taste } = await loadContext(supabase, userId);
  if (items.length === 0) {
    return { outfits: [], notices: ["Il guardaroba è vuoto: aggiungi qualche capo per iniziare."], ai: { used: false } };
  }
  const ctx = { request: req, taste, feedback };
  const byId = new Map(items.map((i) => [i.id, i]));
  const affinity = buildAffinity(feedback, req.avoid_combos);
  const avoided = new Set(req.avoid_combos.map(comboKey));
  const pool = generateCandidates(items, { ...ctx, request: { ...req, count: Math.max(req.count * 2, 8) } });
  const notices = [...pool.notices];

  const fromRules = (pieces: GeneratedOutfit["pieces"], score: number, i: number): GeneratedOutfit => ({
    key: `r-${req.seed}-${i}`,
    ...explainOutfit(pieces, byId, req),
    occasion: req.occasion,
    style: req.style ?? req.custom_style,
    season: req.season,
    pieces,
    score,
    source: "rules",
  });

  let results: GeneratedOutfit[] = [];
  let ai: GenerateResponse["ai"] = { used: false };
  const provider = getAIProvider();

  if (!req.use_ai) {
    ai = { used: false, reason: "disabled" };
  } else if (!provider) {
    ai = { used: false, reason: "not_configured" };
  } else if (pool.candidates.length > 0) {
    const quota = await consumeAiQuota(supabase, userId, "outfits");
    if (!quota.allowed) {
      ai = { used: false, reason: "quota" };
      notices.push("Limite giornaliero AI raggiunto: proposte create dal motore di stile.");
    } else {
      try {
        // Capi ammessi: quelli che superano i vincoli rigidi, dando
        // priorità a quelli che compaiono nelle combinazioni migliori.
        const eligible = items.filter((i) => pool.eligibleIds.has(i.id));
        const inCandidates = new Set(pool.candidates.flatMap((c) => c.pieces.map((p) => p.item_id)));
        const sent = [...eligible]
          .sort((a, b) => Number(inCandidates.has(b.id)) - Number(inCandidates.has(a.id)))
          .slice(0, MAX_AI_ITEMS);
        const allowed = new Map(sent.map((i) => [i.id, i]));
        const response = await provider.composeOutfits({
          brief: {
            occasion: req.occasion,
            style: req.style ? label.style(req.style) : req.custom_style,
            season: label.season(req.season),
            temperature: req.temperature,
            weather: req.weather,
            formality: targetFormality(req),
            preferredColors: req.preferred_colors.map(label.color),
            avoidColors: req.avoid_colors.map(label.color),
            mustInclude: req.include_item_ids.filter((id) => allowed.has(id)),
            rediscover: req.rediscover,
            count: req.count,
            tasteNotes: tasteNotes(taste, feedback, byId),
          },
          items: sent.map(compact),
          avoid: req.avoid_combos,
          suggestions: pool.candidates.slice(0, 6).map((c) => c.pieces.map((p) => p.item_id)),
        });
        results = acceptAiOutfits(response, { allowed, byId, ctx, affinity });
        for (const m of response.missing.slice(0, 3)) notices.push(m);
        ai = { used: results.length > 0, reason: results.length ? undefined : "invalid_output" };
      } catch (error) {
        console.error("AI compose failed", error);
        ai = { used: false, reason: error instanceof AIError ? error.code : "provider_error" };
        notices.push("Lo stylist AI non è raggiungibile in questo momento: proposte create dal motore di stile.");
      }
    }
  }

  // Completa con le proposte del motore a regole, evitando duplicati.
  const taken = new Set(results.map((r) => comboKey(r.pieces.map((p) => p.item_id))));
  for (const [i, c] of pool.candidates.entries()) {
    if (results.length >= req.count) break;
    const key = comboKey(c.pieces.map((p) => p.item_id));
    if (taken.has(key) || avoided.has(key)) continue;
    taken.add(key);
    results.push(fromRules(c.pieces, c.score, i));
  }
  results = results.slice(0, req.count);

  return { outfits: results, notices: [...new Set(notices)], ai };
}
