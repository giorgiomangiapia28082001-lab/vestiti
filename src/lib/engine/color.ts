import { COLORS, type ColorName, colorInfo, label, PATTERNS } from "../domain";

export interface ColorAnalysis {
  /** Punteggio di armonia 0–1. */
  score: number;
  kind: "neutral" | "tonal" | "accent" | "analogous" | "complementary" | "contrast" | "busy";
  /** Spiegazione in italiano. */
  story: string;
}

interface ColoredPiece {
  primary_color: ColorName;
  secondary_colors?: ColorName[];
  pattern?: string;
  slot?: string;
}

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

const EARTH = new Set<ColorName>(["cream", "beige", "camel", "brown", "olive", "sage"]);

function list(names: string[]) {
  const labels = names.map((n) => label.color(n).toLowerCase());
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

/**
 * Valuta l'armonia cromatica di un insieme di capi.
 * Regole: i neutri si abbinano a tutto, un solo colore d'accento è un
 * classico, due accenti funzionano se vicini (analoghi) o se
 * complementari e attenuati; tre o più accenti rendono l'outfit confuso.
 * Considera anche il contrasto di luminosità tra parte alta e bassa e il
 * numero di fantasie vistose.
 */
export function analyzeColors(pieces: ColoredPiece[]): ColorAnalysis {
  if (pieces.length === 0) return { score: 0.5, kind: "neutral", story: "" };

  const primaries = pieces.map((p) => p.primary_color);
  const unique = [...new Set(primaries)];
  const accents = unique.filter((c) => !colorInfo(c).neutral);
  const neutrals = unique.filter((c) => colorInfo(c).neutral);

  let score: number;
  let kind: ColorAnalysis["kind"];
  let story: string;

  if (accents.length === 0) {
    const allEarth = unique.every((c) => EARTH.has(c) || c === "white");
    if (unique.length === 1) {
      score = 0.82;
      kind = "tonal";
      story = `Look monocromatico in ${list(unique)}: un effetto pulito e deciso che allunga la figura.`;
    } else if (allEarth) {
      score = 0.9;
      kind = "tonal";
      story = `Palette di toni naturali (${list(unique)}): sfumature calde della stessa famiglia che si fondono in modo raffinato.`;
    } else {
      score = 0.8;
      kind = "neutral";
      story = `Palette interamente neutra (${list(unique)}): colori che dialogano senza sforzo e lasciano parlare tagli e materiali.`;
    }
  } else if (accents.length === 1) {
    const accent = accents[0];
    if (accent === "multicolor") {
      score = neutrals.length > 0 ? 0.78 : 0.6;
      kind = "accent";
      story = `Il capo multicolore è il protagonista; ${neutrals.length ? `i toni neutri (${list(neutrals)}) lo bilanciano` : "il resto dovrebbe restare sobrio"}.`;
    } else {
      score = 0.9;
      kind = "accent";
      story = `${label.color(accent)} è l'unico colore acceso e risalta sui neutri${neutrals.length ? ` (${list(neutrals)})` : ""}: un punto focale chiaro, senza eccessi.`;
    }
  } else if (accents.length === 2 && !accents.includes("multicolor")) {
    const [a, b] = accents.map((c) => colorInfo(c));
    const d = a.hue !== null && b.hue !== null ? hueDistance(a.hue, b.hue) : 90;
    const muted = a.l > 70 || a.l < 30 || b.l > 70 || b.l < 30;
    if (d <= 45) {
      score = 0.82;
      kind = "analogous";
      story = `${a.label} e ${b.label.toLowerCase()} sono tonalità vicine sulla ruota dei colori: un accostamento armonioso e studiato.`;
    } else if (d >= 140) {
      score = muted ? 0.74 : 0.55;
      kind = "complementary";
      story = `${a.label} e ${b.label.toLowerCase()} creano un contrasto complementare${muted ? ", ammorbidito da una delle due tonalità più tenue" : ": d'impatto, da portare con sicurezza"}.`;
    } else {
      score = 0.48;
      kind = "contrast";
      story = `${a.label} e ${b.label.toLowerCase()} sono due colori decisi: ${neutrals.length ? "i neutri aiutano a tenerli insieme" : "un abbinamento audace"}.`;
    }
  } else {
    score = 0.25;
    kind = "busy";
    story = `Molti colori accesi insieme (${list(accents)}): l'effetto rischia di essere confuso.`;
  }

  // Abbinamenti tra neutri considerati delicati.
  const has = (c: ColorName) => unique.includes(c);
  if (has("navy") && has("black")) score -= 0.06;
  if (has("brown") && has("black") && !has("camel")) score -= 0.05;

  // Contrasto di luminosità tra parte superiore e inferiore.
  const top = pieces.find((p) => p.slot === "top");
  const bottom = pieces.find((p) => p.slot === "bottom");
  if (top && bottom && top.primary_color !== bottom.primary_color) {
    const diff = Math.abs(colorInfo(top.primary_color).l - colorInfo(bottom.primary_color).l);
    if (diff >= 25) {
      score += 0.05;
      if (kind === "neutral") story += " Il contrasto tra chiaro e scuro dà struttura alla silhouette.";
    } else if (diff < 8) {
      score -= 0.04;
    }
  }

  // Fantasie: al massimo una fantasia vistosa.
  const boldPatterns = pieces.filter((p) => PATTERNS.find((x) => x.value === p.pattern)?.bold);
  if (boldPatterns.length > 1) {
    score -= 0.3;
    story += " Attenzione: più fantasie vistose insieme competono tra loro.";
  } else if (boldPatterns.length === 1) {
    const pat = label.pattern(boldPatterns[0].pattern).toLowerCase();
    story += ` Una sola fantasia (${pat}) e il resto più sobrio mantiene l'equilibrio.`;
  }

  return { score: clamp01(score), kind, story };
}

export function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Colori della palette per un selettore. */
export const COLOR_OPTIONS = COLORS;
