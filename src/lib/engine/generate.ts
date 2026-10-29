import type { Role } from "../domain";
import type { GenerateRequest, OutfitPiece } from "../schemas";
import { buildAffinity, climateOf, comboKey, scoreOutfit, seasonFit, targetFormality, type Affinity } from "./score";
import type { Candidate, EngineContext, EngineItem } from "./types";

const BEAM = 40;

/** Generatore pseudo-casuale deterministico (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface EligibleResult {
  eligible: EngineItem[];
  forced: EngineItem[];
  notices: string[];
}

/** Filtra i capi utilizzabili per la richiesta (vincoli rigidi). */
export function eligibleItems(items: EngineItem[], req: GenerateRequest): EligibleResult {
  const notices: string[] = [];
  const exclude = new Set(req.exclude_item_ids);
  const avoid = new Set(req.avoid_colors);
  const include = new Set(req.include_item_ids);
  const forced = items.filter((i) => include.has(i.id));
  const eligible = items.filter((i) => {
    if (include.has(i.id)) return true;
    if (exclude.has(i.id)) return false;
    if (avoid.has(i.primary_color)) return false;
    return seasonFit(i, req) > 0;
  });
  if (forced.length < include.size) notices.push("Alcuni capi da includere non sono più nel guardaroba.");
  for (const f of forced) {
    if (seasonFit(f, req) === 0) notices.push(`«${f.name}» non è ideale per questa stagione o temperatura, ma l'ho incluso come richiesto.`);
  }
  return { eligible, forced, notices };
}

/** Indica il ruolo naturale di un capo dato il suo slot. */
export function defaultRole(item: EngineItem): Role {
  return item.slot;
}

function pool(items: EngineItem[], slot: EngineItem["slot"]) {
  return items.filter((i) => i.slot === slot);
}

interface Draft {
  pieces: OutfitPiece[];
  score: number;
}

/**
 * Genera outfit completi tramite beam search: a ogni passo aggiunge un
 * livello (base → scarpe → capospalla → strato → accessori) e mantiene
 * solo le combinazioni migliori, poi seleziona proposte diverse tra loro.
 */
export function generateCandidates(
  allItems: EngineItem[],
  ctx: EngineContext,
): { candidates: Candidate[]; notices: string[]; eligibleIds: Set<string> } {
  const req = ctx.request;
  const { eligible, forced, notices } = eligibleItems(allItems, req);
  const byId = new Map(allItems.map((i) => [i.id, i]));
  const affinity = buildAffinity(ctx.feedback, req.avoid_combos);
  const random = rng(req.seed);
  const jitter = new Map(eligible.map((i) => [i.id, random() * 0.05]));
  const climate = climateOf(req);
  const formality = targetFormality(req);

  const forcedBySlot = new Map<string, EngineItem[]>();
  for (const f of forced) forcedBySlot.set(f.slot, [...(forcedBySlot.get(f.slot) ?? []), f]);

  const pick = (slot: EngineItem["slot"]) => {
    const f = forcedBySlot.get(slot);
    return f && f.length ? [f[0]] : pool(eligible, slot);
  };

  const evaluate = (pieces: OutfitPiece[]): number => {
    const { score } = scoreOutfit(pieces, byId, ctx, affinity);
    return score + pieces.reduce((s, p) => s + (jitter.get(p.item_id) ?? 0), 0) / Math.max(1, pieces.length);
  };

  const keepBest = (list: Draft[], perItemCap = 8): Draft[] => {
    list.sort((a, b) => b.score - a.score);
    const usage = new Map<string, number>();
    const out: Draft[] = [];
    for (const p of list) {
      const over = p.pieces.some((x) => (usage.get(x.item_id) ?? 0) >= perItemCap);
      if (over) continue;
      out.push(p);
      p.pieces.forEach((x) => usage.set(x.item_id, (usage.get(x.item_id) ?? 0) + 1));
      if (out.length >= BEAM) break;
    }
    return out;
  };

  // 1. Base: parte superiore + inferiore, oppure capo intero.
  const tops = pick("top");
  const bottoms = pick("bottom");
  const onePieces = forcedBySlot.has("top") || forcedBySlot.has("bottom") ? [] : pick("one_piece");
  let beam: Draft[] = [];
  const forcedTops = forcedBySlot.get("top") ?? [];
  for (const t of tops) {
    for (const b of bottoms) {
      const pieces: OutfitPiece[] = [
        { item_id: t.id, role: "top" },
        { item_id: b.id, role: "bottom" },
      ];
      beam.push({ pieces, score: evaluate(pieces) });
    }
  }
  for (const o of onePieces) {
    const pieces: OutfitPiece[] = [{ item_id: o.id, role: "one_piece" }];
    beam.push({ pieces, score: evaluate(pieces) });
  }

  if (beam.length === 0) {
    if (tops.length === 0 && onePieces.length === 0) notices.push("Mancano capi per la parte superiore adatti a questa richiesta.");
    if (bottoms.length === 0 && onePieces.length === 0) notices.push("Mancano pantaloni o gonne adatti a questa richiesta.");
    return { candidates: [], notices, eligibleIds: new Set(eligible.map((i) => i.id)) };
  }
  beam = keepBest(beam, 10);

  // 2. Scarpe.
  const shoes = pick("shoes");
  if (shoes.length === 0) {
    notices.push(
      allItems.some((i) => i.slot === "shoes")
        ? "Nessuna scarpa del guardaroba è adatta a queste condizioni: ti propongo gli outfit senza scarpe."
        : "Non hai ancora aggiunto scarpe: aggiungile per outfit completi.",
    );
  } else {
    const next: Draft[] = [];
    for (const p of beam) {
      for (const s of shoes) {
        const pieces = [...p.pieces, { item_id: s.id, role: "shoes" as Role }];
        next.push({ pieces, score: evaluate(pieces) });
      }
    }
    beam = keepBest(next);
  }

  // 3. Capospalla.
  const outers = pick("outer");
  const outerRequired = forcedBySlot.has("outer") || climate === "cold" || climate === "cool";
  const outerAllowed = climate !== "hot" || formality >= 5 || forcedBySlot.has("outer");
  if (outerAllowed && outers.length > 0) {
    const next: Draft[] = outerRequired ? [] : [...beam];
    for (const p of beam) {
      for (const o of outers) {
        const pieces = [...p.pieces, { item_id: o.id, role: "outer" as Role }];
        next.push({ pieces, score: evaluate(pieces) });
      }
    }
    beam = keepBest(next);
  } else if (outerRequired) {
    notices.push("Fa freddo ma non hai un capospalla adatto: valuta di aggiungere una giacca o un cappotto.");
  }

  // 4. Strato intermedio (maglione sopra camicia o t-shirt) quando fa fresco.
  const layerable = (climate === "cold" || climate === "cool") && !onePieces.length;
  const forcedMid = forcedTops.length > 1 ? forcedTops[1] : null;
  if (layerable || forcedMid) {
    const mids = forcedMid ? [forcedMid] : eligible.filter((i) => i.slot === "top" && i.category === "knitwear");
    const next: Draft[] = forcedMid ? [] : [...beam];
    for (const p of beam) {
      const base = byId.get(p.pieces.find((x) => x.role === "top")?.item_id ?? "");
      if (!base || base.category === "knitwear") {
        if (forcedMid) next.push(p);
        continue;
      }
      for (const m of mids) {
        if (m.id === base.id) continue;
        const pieces = [...p.pieces, { item_id: m.id, role: "mid" as Role }];
        next.push({ pieces, score: evaluate(pieces) });
      }
    }
    if (next.length) beam = keepBest(next);
  }

  // 5. Accessori: aggiunti solo se migliorano l'outfit.
  const accessories = forcedBySlot.get("accessory") ?? pool(eligible, "accessory");
  if (accessories.length && req.occasion !== "gym") {
    beam = beam.map((p) => {
      let best = p;
      for (const a of accessories) {
        if (best.pieces.filter((x) => x.role === "accessory").length >= 2) break;
        const pieces = [...best.pieces, { item_id: a.id, role: "accessory" as Role }];
        const score = evaluate(pieces);
        const isForced = forcedBySlot.get("accessory")?.includes(a);
        if (score > best.score || isForced) best = { pieces, score };
      }
      return best;
    });
  }

  // Garantisce che i capi obbligatori siano presenti.
  const requiredIds = forced.map((f) => f.id);
  beam = beam.filter((p) => requiredIds.every((id) => p.pieces.some((x) => x.item_id === id)));
  if (beam.length === 0 && forced.length) {
    notices.push("Non sono riuscito a combinare tutti i capi obbligatori insieme: prova a includerne meno.");
  }

  // 6. Selezione finale con diversità (Maximal Marginal Relevance).
  const finals = beam.map((p) => ({ ...p, ...scoreOutfit(p.pieces, byId, ctx, affinity) }));
  const selected: typeof finals = [];
  const seen = new Set<string>();
  while (selected.length < req.count && finals.length) {
    let bestIdx = -1;
    let bestVal = -Infinity;
    finals.forEach((f, idx) => {
      const ids = f.pieces.map((p) => p.item_id);
      if (seen.has(comboKey(ids))) return;
      const overlap = selected.length
        ? Math.max(
            ...selected.map((s) => {
              const sIds = new Set(s.pieces.filter((p) => p.role !== "accessory").map((p) => p.item_id));
              const core = f.pieces.filter((p) => p.role !== "accessory");
              return core.filter((p) => sIds.has(p.item_id)).length / Math.max(1, core.length);
            }),
          )
        : 0;
      const val = f.score + (jitter.get(ids[0]) ?? 0) - 0.18 * overlap;
      if (val > bestVal) {
        bestVal = val;
        bestIdx = idx;
      }
    });
    if (bestIdx < 0) break;
    const [chosen] = finals.splice(bestIdx, 1);
    seen.add(comboKey(chosen.pieces.map((p) => p.item_id)));
    selected.push(chosen);
  }

  const candidates: Candidate[] = selected.map((s) => ({
    pieces: sortPieces(s.pieces),
    items: s.pieces.map((p) => byId.get(p.item_id)!),
    score: s.score,
    breakdown: s.breakdown,
  }));
  return { candidates, notices, eligibleIds: new Set(eligible.map((i) => i.id)) };
}

const ROLE_ORDER: Role[] = ["outer", "mid", "top", "one_piece", "bottom", "shoes", "accessory"];
export function sortPieces(pieces: OutfitPiece[]): OutfitPiece[] {
  return [...pieces].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
}

/**
 * Valida una lista di identificativi proposta dall'AI: ogni capo deve
 * esistere tra quelli ammessi e la struttura deve essere indossabile.
 * Restituisce i pezzi con il ruolo assegnato oppure il motivo del rifiuto.
 */
export function validateItemIds(
  ids: string[],
  allowed: Map<string, EngineItem>,
  requiredIds: string[] = [],
): { ok: true; pieces: OutfitPiece[] } | { ok: false; reason: string } {
  const unique = [...new Set(ids)];
  const items: EngineItem[] = [];
  for (const id of unique) {
    const it = allowed.get(id);
    if (!it) return { ok: false, reason: `capo sconosciuto: ${id}` };
    items.push(it);
  }
  const tops = items.filter((i) => i.slot === "top");
  const bottoms = items.filter((i) => i.slot === "bottom");
  const onePieces = items.filter((i) => i.slot === "one_piece");
  const outers = items.filter((i) => i.slot === "outer");
  const shoes = items.filter((i) => i.slot === "shoes");
  const accessories = items.filter((i) => i.slot === "accessory");

  if (onePieces.length > 1) return { ok: false, reason: "più capi interi" };
  if (onePieces.length === 1 && (bottoms.length > 0 || tops.length > 0)) {
    return { ok: false, reason: "capo intero combinato con altri capi base" };
  }
  if (onePieces.length === 0 && (tops.length === 0 || bottoms.length !== 1)) {
    return { ok: false, reason: "serve esattamente una parte superiore e una inferiore" };
  }
  if (tops.length > 2) return { ok: false, reason: "troppe parti superiori" };
  if (outers.length > 1 || shoes.length > 1 || accessories.length > 3) {
    return { ok: false, reason: "troppi capi dello stesso tipo" };
  }

  const pieces: OutfitPiece[] = [];
  if (tops.length === 2) {
    // Lo strato intermedio è il capo in maglia; se nessuno lo è, rifiuta.
    const knitIdx = tops.findIndex((t) => t.category === "knitwear");
    const otherIdx = knitIdx === 0 ? 1 : 0;
    if (knitIdx < 0 || tops[otherIdx].category === "knitwear") return { ok: false, reason: "due capi superiori non stratificabili" };
    pieces.push({ item_id: tops[otherIdx].id, role: "top" }, { item_id: tops[knitIdx].id, role: "mid" });
  } else if (tops.length === 1) {
    pieces.push({ item_id: tops[0].id, role: "top" });
  }
  for (const b of bottoms) pieces.push({ item_id: b.id, role: "bottom" });
  for (const o of onePieces) pieces.push({ item_id: o.id, role: "one_piece" });
  for (const o of outers) pieces.push({ item_id: o.id, role: "outer" });
  for (const s of shoes) pieces.push({ item_id: s.id, role: "shoes" });
  for (const a of accessories) pieces.push({ item_id: a.id, role: "accessory" });

  const missing = requiredIds.filter((id) => !unique.includes(id));
  if (missing.length) return { ok: false, reason: "mancano capi obbligatori" };
  return { ok: true, pieces: sortPieces(pieces) };
}

/**
 * Alternative per sostituire un singolo capo mantenendo il resto
 * dell'outfit, ordinate per punteggio complessivo.
 */
export function rankAlternatives<T extends EngineItem>(
  pieces: OutfitPiece[],
  replaceItemId: string,
  allItems: T[],
  ctx: EngineContext,
  limit = 12,
  affinity: Affinity = buildAffinity(ctx.feedback),
): { item: T; score: number }[] {
  const byId = new Map<string, EngineItem>(allItems.map((i) => [i.id, i]));
  const target = pieces.find((p) => p.item_id === replaceItemId);
  const current = byId.get(replaceItemId);
  if (!target || !current) return [];
  const used = new Set(pieces.map((p) => p.item_id));
  const candidates = allItems.filter((i) => {
    if (used.has(i.id)) return false;
    if (target.role === "mid") return i.slot === "top" && i.category === "knitwear";
    return i.slot === current.slot;
  });
  return candidates
    .map((item) => {
      const next = pieces.map((p) => (p.item_id === replaceItemId ? { ...p, item_id: item.id } : p));
      return { item, score: scoreOutfit(next, byId, ctx, affinity).score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
