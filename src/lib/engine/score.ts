import { type Role, type Season, type Style, occasionInfo } from "../domain";
import type { GenerateRequest, OutfitPiece } from "../schemas";
import { analyzeColors, clamp01 } from "./color";
import type { EngineContext, EngineItem, FeedbackOutfit, ScoreBreakdown } from "./types";

// ---------------------------------------------------------------------------
// Parametri derivati dalla richiesta
// ---------------------------------------------------------------------------
export function targetFormality(req: GenerateRequest): number {
  if (req.formality) return req.formality;
  const base: number = occasionInfo(req.occasion).formality;
  const styleShift: Partial<Record<Style, number>> = { elegant: 1, old_money: 0.5, sporty: -1, streetwear: -0.5 };
  return Math.max(1, Math.min(5, Math.round(base + (req.style ? styleShift[req.style] ?? 0 : 0))));
}

export function targetStyles(req: GenerateRequest): Style[] {
  if (req.style) return [req.style];
  return [...occasionInfo(req.occasion).styles] as Style[];
}

const STYLE_NEIGHBOURS: Record<Style, Style[]> = {
  casual: ["smart_casual", "streetwear", "minimal"],
  smart_casual: ["casual", "minimal", "old_money", "elegant"],
  elegant: ["old_money", "smart_casual", "minimal"],
  streetwear: ["casual", "sporty"],
  minimal: ["smart_casual", "casual", "elegant"],
  old_money: ["elegant", "smart_casual", "minimal"],
  sporty: ["streetwear", "casual"],
};

export type Climate = "hot" | "warm" | "mild" | "cool" | "cold";

export function climateOf(req: GenerateRequest): Climate {
  const t = req.temperature;
  if (t !== null) {
    if (t >= 25) return "hot";
    if (t >= 19) return "warm";
    if (t >= 14) return "mild";
    if (t >= 7) return "cool";
    return "cold";
  }
  const bySeason: Record<Season, Climate> = { summer: "hot", spring: "mild", autumn: "cool", winter: "cold" };
  return bySeason[req.season];
}

const ADJACENT: Record<Season, Season[]> = {
  spring: ["summer", "autumn"],
  summer: ["spring"],
  autumn: ["winter", "spring"],
  winter: ["autumn"],
};

const HEAVY = /lana|wool|cashmere|piumino|montone|shearling|velluto|tweed|flanella|pile|fleece/i;
const LIGHT = /lino|linen|seersucker|rete|mesh/i;

/**
 * Idoneità di un capo a stagione e temperatura (0 = da escludere).
 */
export function seasonFit(item: EngineItem, req: GenerateRequest): number {
  let s: number;
  if (item.seasons.length === 0) s = 0.8;
  else if (item.seasons.includes(req.season)) s = 1;
  else if (item.seasons.some((x) => ADJACENT[req.season].includes(x))) s = 0.45;
  else s = 0;

  const climate = climateOf(req);
  const material = item.material ?? "";
  if (item.category === "shorts" && (climate === "cool" || climate === "cold")) return 0;
  if (item.category === "shorts" && climate === "mild") s = Math.min(s, 0.35);
  if (item.category === "knitwear" && climate === "hot") s = Math.min(s, 0.1);
  if (HEAVY.test(material) && (climate === "hot" || climate === "warm")) s = Math.min(s, climate === "hot" ? 0.05 : 0.4);
  if (LIGHT.test(material) && (climate === "cold" || climate === "cool")) s = Math.min(s, 0.3);
  if (item.slot === "outer" && climate === "hot" && targetFormality(req) < 5) s = Math.min(s, 0.15);
  return s;
}

export function styleFit(item: EngineItem, styles: Style[]): number {
  if (item.styles.length === 0) return 0.55;
  if (item.styles.some((s) => styles.includes(s))) return 1;
  if (item.styles.some((s) => styles.some((t) => STYLE_NEIGHBOURS[t].includes(s)))) return 0.7;
  return 0.25;
}

// ---------------------------------------------------------------------------
// Preferenze apprese dai feedback
// ---------------------------------------------------------------------------
export interface Affinity {
  item: Map<string, number>;
  pair: Map<string, number>;
  combos: Map<string, number>;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const comboKey = (ids: string[]) => [...ids].sort().join("|");

export function buildAffinity(feedback: FeedbackOutfit[] = [], avoid: string[][] = []): Affinity {
  const itemSum = new Map<string, { s: number; n: number }>();
  const pairSum = new Map<string, { s: number; n: number }>();
  const combos = new Map<string, number>();
  for (const o of feedback) {
    let signal = o.rating ? (o.rating - 3) / 2 : 0;
    if (o.is_favorite) signal += 0.5;
    combos.set(comboKey(o.item_ids), signal);
    if (signal === 0) continue;
    for (const id of o.item_ids) {
      const cur = itemSum.get(id) ?? { s: 0, n: 0 };
      itemSum.set(id, { s: cur.s + signal, n: cur.n + 1 });
    }
    for (let i = 0; i < o.item_ids.length; i++) {
      for (let j = i + 1; j < o.item_ids.length; j++) {
        const k = pairKey(o.item_ids[i], o.item_ids[j]);
        const cur = pairSum.get(k) ?? { s: 0, n: 0 };
        pairSum.set(k, { s: cur.s + signal, n: cur.n + 1 });
      }
    }
  }
  for (const ids of avoid) combos.set(comboKey(ids), -1);
  const avg = (m: Map<string, { s: number; n: number }>) =>
    new Map([...m].map(([k, v]) => [k, Math.max(-1, Math.min(1, v.s / v.n))]));
  return { item: avg(itemSum), pair: avg(pairSum), combos };
}

// ---------------------------------------------------------------------------
// Punteggio di un outfit
// ---------------------------------------------------------------------------
const ROLE_WEIGHT: Record<Role, number> = {
  top: 1,
  mid: 0.8,
  bottom: 1,
  one_piece: 1.6,
  outer: 0.9,
  shoes: 0.8,
  accessory: 0.3,
};

export interface ScoredOutfit {
  score: number;
  breakdown: ScoreBreakdown;
}

export function scoreOutfit(
  pieces: OutfitPiece[],
  byId: Map<string, EngineItem>,
  ctx: EngineContext,
  affinity: Affinity,
): ScoredOutfit {
  const req = ctx.request;
  const items = pieces.map((p) => byId.get(p.item_id)!).filter(Boolean);
  const roles = pieces.map((p) => p.role);
  const styles = targetStyles(req);
  const formality = targetFormality(req);
  const climate = climateOf(req);

  let wSum = 0;
  let fSum = 0;
  let sSum = 0;
  let seaSum = 0;
  pieces.forEach((p, i) => {
    const it = items[i];
    if (!it) return;
    const w = ROLE_WEIGHT[p.role];
    wSum += w;
    fSum += w * clamp01(1 - Math.abs(it.formality - formality) * 0.28);
    sSum += w * styleFit(it, styles);
    seaSum += w * seasonFit(it, req);
  });
  const formalityScore = wSum ? fSum / wSum : 0;
  const styleScore = wSum ? sSum / wSum : 0;
  const seasonScore = wSum ? seaSum / wSum : 0;

  // Coerenza interna di formalità (escludendo gli accessori).
  const core = items.filter((_, i) => roles[i] !== "accessory");
  const fs = core.map((i) => i.formality);
  const spread = fs.length ? Math.max(...fs) - Math.min(...fs) : 0;
  const coherence = spread <= 1 ? 1 : spread === 2 ? 0.75 : 0.35;

  const color = analyzeColors(
    pieces
      .filter((p) => p.role !== "accessory")
      .map((p) => {
        const it = byId.get(p.item_id)!;
        return { ...it, slot: p.role === "mid" ? "top" : p.role };
      }),
  );

  // Struttura: completezza rispetto al clima e all'occasione.
  let structure = 0.6;
  const hasShoes = roles.includes("shoes");
  const hasOuter = roles.includes("outer");
  const hasMid = roles.includes("mid");
  if (hasShoes) structure += 0.25;
  if (climate === "cold" || climate === "cool") structure += hasOuter ? 0.15 : -0.25;
  if (climate === "cold" && hasMid) structure += 0.08;
  if ((climate === "hot" || climate === "warm") && hasMid) structure -= 0.3;
  if (climate === "hot" && hasOuter && formality < 5) structure -= 0.3;
  if (formality >= 4 && hasOuter) structure += 0.08;
  const accessories = roles.filter((r) => r === "accessory").length;
  if (accessories === 1) structure += 0.04;
  if (accessories > 2) structure -= 0.1;
  structure = clamp01(structure);

  // Proporzioni: volume sopra bilanciato da una linea più asciutta sotto.
  const top = items[roles.indexOf("top")];
  const bottom = items[roles.indexOf("bottom")];
  let proportion = 0;
  if (top?.fit && bottom?.fit) {
    const loose = (f: string) => f === "oversize" || f === "relaxed";
    if (loose(top.fit) && bottom.fit === "slim") proportion += 0.03;
    if (top.fit === "oversize" && bottom.fit === "oversize") proportion -= 0.04;
  }

  // Bonus: gusti, feedback, novità, frequenza d'uso.
  let bonus = proportion;
  const taste = ctx.taste;
  const favoriteColors = new Set([...(taste?.favorite_colors ?? []), ...req.preferred_colors]);
  const softAvoid = new Set(taste?.avoid_colors ?? []);
  const today = ctx.today ?? new Date();
  for (const it of core) {
    if (favoriteColors.has(it.primary_color)) bonus += 0.03;
    if (softAvoid.has(it.primary_color)) bonus -= 0.12;
    if (it.secondary_colors.some((c) => req.avoid_colors.includes(c))) bonus -= 0.08;
    if (it.is_favorite) bonus += 0.015;
    const affinityScore = affinity.item.get(it.id);
    if (affinityScore) bonus += 0.05 * affinityScore;
    const daysSinceWorn = it.last_worn_at ? (today.getTime() - new Date(it.last_worn_at).getTime()) / 86_400_000 : Infinity;
    if (daysSinceWorn < 2) bonus -= 0.05;
    if (req.rediscover) {
      if (it.wear_count === 0 || daysSinceWorn > 30) bonus += 0.06;
      else bonus -= 0.03;
    }
  }
  if (taste?.style_preferences?.length && !req.style) {
    const prefersMatch = core.filter((it) => it.styles.some((s) => taste.style_preferences.includes(s))).length;
    bonus += 0.02 * prefersMatch;
  }
  const ids = items.map((i) => i.id);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = affinity.pair.get(pairKey(ids[i], ids[j]));
      if (a) bonus += 0.04 * a;
    }
  }
  const known = affinity.combos.get(comboKey(ids));
  if (known !== undefined) bonus += known < 0 ? -0.4 : -0.08; // evita di riproporre lo stesso outfit

  // Palestra: richiede capi sportivi.
  if (req.occasion === "gym") {
    const sporty = core.filter((it) => it.category === "sportswear" || it.styles.includes("sporty")).length;
    bonus += sporty >= 2 ? 0.1 : -0.3;
  }

  const breakdown: ScoreBreakdown = {
    color: color.score,
    formality: formalityScore * coherence,
    style: styleScore,
    season: seasonScore,
    structure,
    bonus,
  };
  const score =
    0.3 * breakdown.color +
    0.22 * breakdown.formality +
    0.18 * breakdown.style +
    0.18 * breakdown.season +
    0.12 * breakdown.structure +
    bonus;
  return { score, breakdown };
}

/** Converte il punteggio grezzo in una percentuale leggibile. */
export function scoreToPercent(score: number) {
  return Math.round(Math.max(0, Math.min(1, (score - 0.3) / 0.82)) * 100);
}
