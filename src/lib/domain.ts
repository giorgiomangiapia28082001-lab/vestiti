// Vocabolario condiviso tra UI, motore di abbinamento, AI e database.
// I valori (chiavi) sono in inglese e vengono salvati nel database;
// le etichette sono quelle mostrate all'utente.

export const CATEGORIES = [
  { value: "tshirt_polo", label: "T-shirt e polo", slot: "top", formality: 1 },
  { value: "shirt", label: "Camicie", slot: "top", formality: 3 },
  { value: "knitwear", label: "Felpe e maglioni", slot: "top", formality: 2 },
  { value: "outerwear", label: "Giacche e cappotti", slot: "outer", formality: 3 },
  { value: "trousers", label: "Pantaloni e jeans", slot: "bottom", formality: 2 },
  { value: "shorts", label: "Pantaloncini", slot: "bottom", formality: 1 },
  { value: "shoes", label: "Scarpe e sneakers", slot: "shoes", formality: 2 },
  { value: "accessories", label: "Accessori", slot: "accessory", formality: 2 },
  { value: "sportswear", label: "Abbigliamento sportivo", slot: "top", formality: 1 },
  { value: "other", label: "Altri capi", slot: "top", formality: 2 },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];
export const CATEGORY_VALUES = CATEGORIES.map((c) => c.value) as [Category, ...Category[]];

export const SLOTS = [
  { value: "top", label: "Parte superiore" },
  { value: "bottom", label: "Parte inferiore" },
  { value: "one_piece", label: "Capo intero (abito, tuta)" },
  { value: "outer", label: "Capospalla" },
  { value: "shoes", label: "Scarpe" },
  { value: "accessory", label: "Accessorio" },
] as const;
export type Slot = (typeof SLOTS)[number]["value"];
export const SLOT_VALUES = SLOTS.map((s) => s.value) as [Slot, ...Slot[]];

// Ruolo di un capo dentro un outfit. "mid" è uno strato intermedio
// (es. maglione sopra una camicia).
export const ROLES = [
  { value: "top", label: "Sopra" },
  { value: "mid", label: "Strato" },
  { value: "bottom", label: "Sotto" },
  { value: "one_piece", label: "Capo intero" },
  { value: "outer", label: "Capospalla" },
  { value: "shoes", label: "Scarpe" },
  { value: "accessory", label: "Accessorio" },
] as const;
export type Role = (typeof ROLES)[number]["value"];
export const ROLE_VALUES = ROLES.map((r) => r.value) as [Role, ...Role[]];

export const SEASONS = [
  { value: "spring", label: "Primavera" },
  { value: "summer", label: "Estate" },
  { value: "autumn", label: "Autunno" },
  { value: "winter", label: "Inverno" },
] as const;
export type Season = (typeof SEASONS)[number]["value"];
export const SEASON_VALUES = SEASONS.map((s) => s.value) as [Season, ...Season[]];

export const STYLES = [
  { value: "casual", label: "Casual" },
  { value: "smart_casual", label: "Smart casual" },
  { value: "elegant", label: "Elegante" },
  { value: "streetwear", label: "Streetwear" },
  { value: "minimal", label: "Minimal" },
  { value: "old_money", label: "Old money" },
  { value: "sporty", label: "Sportivo" },
] as const;
export type Style = (typeof STYLES)[number]["value"];
export const STYLE_VALUES = STYLES.map((s) => s.value) as [Style, ...Style[]];

export const OCCASIONS = [
  { value: "everyday", label: "Tutti i giorni", formality: 2, styles: ["casual", "minimal", "smart_casual"] },
  { value: "work", label: "Lavoro", formality: 3, styles: ["smart_casual", "minimal", "elegant", "old_money"] },
  { value: "university", label: "Università", formality: 2, styles: ["casual", "streetwear", "minimal"] },
  { value: "date", label: "Appuntamento", formality: 3, styles: ["smart_casual", "minimal", "old_money"] },
  { value: "night_out", label: "Serata", formality: 3, styles: ["smart_casual", "streetwear", "minimal"] },
  { value: "party", label: "Festa", formality: 3, styles: ["streetwear", "smart_casual", "elegant"] },
  { value: "vacation", label: "Vacanza", formality: 1, styles: ["casual", "old_money", "minimal"] },
  { value: "gym", label: "Palestra", formality: 1, styles: ["sporty"] },
  { value: "formal_event", label: "Evento elegante", formality: 5, styles: ["elegant", "old_money"] },
] as const satisfies readonly { value: string; label: string; formality: number; styles: readonly Style[] }[];
export type Occasion = (typeof OCCASIONS)[number]["value"];
export const OCCASION_VALUES = OCCASIONS.map((o) => o.value) as [Occasion, ...Occasion[]];

export const PATTERNS = [
  { value: "solid", label: "Tinta unita", bold: false },
  { value: "striped", label: "Righe", bold: false },
  { value: "checked", label: "Quadri", bold: true },
  { value: "printed", label: "Stampa", bold: true },
  { value: "floral", label: "Floreale", bold: true },
  { value: "graphic", label: "Grafica", bold: true },
  { value: "textured", label: "Texture", bold: false },
  { value: "other", label: "Altro", bold: false },
] as const;
export type Pattern = (typeof PATTERNS)[number]["value"];
export const PATTERN_VALUES = PATTERNS.map((p) => p.value) as [Pattern, ...Pattern[]];

export const FITS = [
  { value: "slim", label: "Slim" },
  { value: "regular", label: "Regular" },
  { value: "relaxed", label: "Relaxed" },
  { value: "oversize", label: "Oversize" },
  { value: "cropped", label: "Cropped" },
] as const;
export type Fit = (typeof FITS)[number]["value"];
export const FIT_VALUES = FITS.map((f) => f.value) as [Fit, ...Fit[]];

export const FORMALITY_LABELS: Record<number, string> = {
  1: "Molto informale",
  2: "Informale",
  3: "Smart",
  4: "Formale",
  5: "Molto formale",
};

// Palette dei colori riconosciuti. `neutral` indica i colori che si
// abbinano a quasi tutto; `hue` è la tonalità in gradi (null per i neutri
// acromatici), `l` la luminosità percepita 0–100.
export const COLORS = [
  { value: "black", label: "Nero", hex: "#141414", neutral: true, hue: null, l: 6 },
  { value: "charcoal", label: "Antracite", hex: "#3b3b3d", neutral: true, hue: null, l: 25 },
  { value: "grey", label: "Grigio", hex: "#8d8d8f", neutral: true, hue: null, l: 58 },
  { value: "light_grey", label: "Grigio chiaro", hex: "#cfcfcf", neutral: true, hue: null, l: 82 },
  { value: "white", label: "Bianco", hex: "#f7f7f5", neutral: true, hue: null, l: 97 },
  { value: "cream", label: "Panna", hex: "#efe6d2", neutral: true, hue: 42, l: 91 },
  { value: "beige", label: "Beige", hex: "#d6c3a1", neutral: true, hue: 38, l: 79 },
  { value: "camel", label: "Cammello", hex: "#b08a5a", neutral: true, hue: 33, l: 60 },
  { value: "brown", label: "Marrone", hex: "#6b4a2f", neutral: true, hue: 27, l: 35 },
  { value: "navy", label: "Blu navy", hex: "#1f2a44", neutral: true, hue: 222, l: 17 },
  { value: "denim", label: "Denim", hex: "#4a6a8f", neutral: true, hue: 212, l: 44 },
  { value: "blue", label: "Blu", hex: "#2f5fb3", neutral: false, hue: 218, l: 41 },
  { value: "light_blue", label: "Azzurro", hex: "#a9c6e4", neutral: false, hue: 210, l: 78 },
  { value: "olive", label: "Verde oliva", hex: "#5f6236", neutral: true, hue: 63, l: 40 },
  { value: "sage", label: "Salvia", hex: "#a3ad8f", neutral: false, hue: 82, l: 69 },
  { value: "green", label: "Verde", hex: "#2f7a4a", neutral: false, hue: 142, l: 45 },
  { value: "burgundy", label: "Bordeaux", hex: "#6a1f2b", neutral: false, hue: 350, l: 25 },
  { value: "red", label: "Rosso", hex: "#c0322f", neutral: false, hue: 2, l: 45 },
  { value: "pink", label: "Rosa", hex: "#e7aab4", neutral: false, hue: 350, l: 76 },
  { value: "orange", label: "Arancione", hex: "#d9702b", neutral: false, hue: 24, l: 59 },
  { value: "mustard", label: "Senape", hex: "#c99a2e", neutral: false, hue: 42, l: 65 },
  { value: "yellow", label: "Giallo", hex: "#ecd04a", neutral: false, hue: 50, l: 83 },
  { value: "purple", label: "Viola", hex: "#5e3f87", neutral: false, hue: 266, l: 33 },
  { value: "multicolor", label: "Multicolore", hex: "conic", neutral: false, hue: null, l: 55 },
] as const;
export type ColorName = (typeof COLORS)[number]["value"];
export const COLOR_VALUES = COLORS.map((c) => c.value) as [ColorName, ...ColorName[]];

// ---------------------------------------------------------------------------
// Helper di lookup
// ---------------------------------------------------------------------------
function labelMap<T extends { value: string; label: string }>(list: readonly T[]) {
  return Object.fromEntries(list.map((x) => [x.value, x.label])) as Record<string, string>;
}

const categoryLabels = labelMap(CATEGORIES);
const seasonLabels = labelMap(SEASONS);
const styleLabels = labelMap(STYLES);
const occasionLabels = labelMap(OCCASIONS);
const patternLabels = labelMap(PATTERNS);
const fitLabels = labelMap(FITS);
const colorLabels = labelMap(COLORS);
const roleLabels = labelMap(ROLES);
const slotLabels = labelMap(SLOTS);

export const label = {
  category: (v?: string | null) => (v ? categoryLabels[v] ?? v : ""),
  season: (v?: string | null) => (v ? seasonLabels[v] ?? v : ""),
  style: (v?: string | null) => (v ? styleLabels[v] ?? v : ""),
  occasion: (v?: string | null) => (v ? occasionLabels[v] ?? v : ""),
  pattern: (v?: string | null) => (v ? patternLabels[v] ?? v : ""),
  fit: (v?: string | null) => (v ? fitLabels[v] ?? v : ""),
  color: (v?: string | null) => (v ? colorLabels[v] ?? v : ""),
  role: (v?: string | null) => (v ? roleLabels[v] ?? v : ""),
  slot: (v?: string | null) => (v ? slotLabels[v] ?? v : ""),
};

export function colorInfo(value: string) {
  return COLORS.find((c) => c.value === value) ?? COLORS[0];
}

export function categoryInfo(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function occasionInfo(value: string) {
  return OCCASIONS.find((o) => o.value === value) ?? OCCASIONS[0];
}

/** Stagione corrente nell'emisfero nord. */
export function currentSeason(date = new Date()): Season {
  const m = date.getMonth();
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

/** Stagione suggerita dalla temperatura percepita. */
export function seasonFromTemperature(t: number): Season {
  if (t >= 24) return "summer";
  if (t >= 15) return "spring";
  if (t >= 8) return "autumn";
  return "winter";
}
