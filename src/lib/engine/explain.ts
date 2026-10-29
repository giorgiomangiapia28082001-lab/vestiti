import { label, type Occasion, type Style } from "../domain";
import type { GeneratedOutfit, GenerateRequest, OutfitPiece } from "../schemas";
import { analyzeColors } from "./color";
import { climateOf, targetFormality } from "./score";
import type { EngineItem } from "./types";

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const OCCASION_WORDS: Record<Occasion, string[]> = {
  everyday: ["Quotidiano", "Giorno pieno", "Passeggiata in città", "Weekend"],
  work: ["Ufficio", "Riunione del lunedì", "Business quieto", "Scrivania"],
  university: ["Campus", "Lezione del mattino", "Biblioteca", "Aula studio"],
  date: ["Primo appuntamento", "Aperitivo", "Cena per due", "Rendez-vous"],
  night_out: ["Notte in città", "After dark", "Cocktail bar", "Serata"],
  party: ["Festa", "Dancefloor", "Celebrazione", "Party"],
  vacation: ["Riviera", "Viaggio leggero", "Dolce vita", "Fuga al mare"],
  gym: ["Allenamento", "Active", "Training", "Movimento"],
  formal_event: ["Gala", "Cerimonia", "Serata elegante", "Black tie"],
};

const STYLE_WORDS: Partial<Record<Style, string>> = {
  minimal: "essenziale",
  old_money: "senza tempo",
  streetwear: "urbano",
  elegant: "raffinato",
  smart_casual: "disinvolto",
  casual: "rilassato",
  sporty: "dinamico",
};

function itemPhrase(item: EngineItem | undefined) {
  return item ? item.name.charAt(0).toLowerCase() + item.name.slice(1) : "";
}

/** Nome, descrizione e consigli per un outfit generato dalle regole. */
export function explainOutfit(
  pieces: OutfitPiece[],
  byId: Map<string, EngineItem>,
  req: GenerateRequest,
): Pick<GeneratedOutfit, "name" | "description" | "color_story" | "tips"> {
  const get = (role: OutfitPiece["role"]) => byId.get(pieces.find((p) => p.role === role)?.item_id ?? "");
  const top = get("top");
  const mid = get("mid");
  const bottom = get("bottom");
  const onePiece = get("one_piece");
  const outer = get("outer");
  const shoes = get("shoes");
  const accessories = pieces.filter((p) => p.role === "accessory").map((p) => byId.get(p.item_id)!).filter(Boolean);
  const core = pieces.filter((p) => p.role !== "accessory").map((p) => byId.get(p.item_id)!).filter(Boolean);

  const h = hash(pieces.map((p) => p.item_id).join(""));
  const words = OCCASION_WORDS[req.occasion];
  const dominant = (outer ?? top ?? onePiece ?? bottom)?.primary_color;
  const name = `${words[h % words.length]} in ${label.color(dominant).toLowerCase()}`;

  const styleWord = req.style ? STYLE_WORDS[req.style] : req.custom_style ? req.custom_style.toLowerCase() : null;
  const base = onePiece
    ? itemPhrase(onePiece)
    : [itemPhrase(top), mid ? `${itemPhrase(mid)} sovrapposto` : null, itemPhrase(bottom)].filter(Boolean).join(", ");
  const extras = [outer && itemPhrase(outer), shoes && itemPhrase(shoes)].filter(Boolean).join(" e ");
  const description =
    `Un look${styleWord ? ` ${styleWord}` : ""} per ${label.occasion(req.occasion).toLowerCase()}: ${base}` +
    (extras ? `, completato da ${extras}.` : ".");

  const color = analyzeColors(
    pieces
      .filter((p) => p.role !== "accessory")
      .map((p) => ({ ...byId.get(p.item_id)!, slot: p.role === "mid" ? "top" : p.role })),
  );
  const formality = targetFormality(req);
  const fs = core.map((c) => c.formality);
  const coherent = fs.length > 0 && Math.max(...fs) - Math.min(...fs) <= 1;
  const story = [
    color.story,
    coherent ? "Tutti i capi condividono lo stesso livello di formalità, per questo l'insieme risulta coerente." : "",
  ]
    .filter(Boolean)
    .join(" ");

  const tips: string[] = [];
  const climate = climateOf(req);
  if (mid && top) tips.push(`Lascia intravedere il colletto o l'orlo di ${itemPhrase(top)} sotto ${itemPhrase(mid)} per dare profondità.`);
  if (top?.category === "shirt" && formality >= 3) tips.push("Infila la camicia nei pantaloni per una linea più pulita.");
  if (top?.category === "shirt" && formality <= 2) tips.push("Arrotola le maniche fino a metà avambraccio per un'aria più rilassata.");
  if (top?.fit && bottom?.fit && ["oversize", "relaxed"].includes(top.fit) && bottom.fit === "slim") {
    tips.push("Il volume sopra e la linea asciutta sotto creano una proporzione equilibrata: lascia la parte superiore morbida.");
  }
  if (req.weather === "rain") tips.push("Previsto maltempo: preferisci scarpe che non temono l'acqua e porta un ombrello.");
  if (climate === "cold" && outer) tips.push(`Con il freddo, chiudi ${itemPhrase(outer)} e aggiungi una sciarpa in tono.`);
  if (climate === "hot") tips.push("Con il caldo scegli tessuti traspiranti e lascia la camicia o la polo fuori dai pantaloni se l'occasione lo consente.");
  if (!accessories.length && req.occasion !== "gym") tips.push("Completa con un accessorio semplice, come un orologio o una cintura in tono con le scarpe.");
  if (shoes && bottom && bottom.category === "trousers" && formality >= 3) tips.push("Un orlo che sfiora appena la scarpa rende la figura più slanciata.");
  if (tips.length < 2) tips.push("Cura i dettagli: capi stirati e scarpe pulite fanno la differenza.");

  return { name, description, color_story: story, tips: tips.slice(0, 3) };
}
