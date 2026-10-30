import "server-only";
import { COLORS, CATEGORIES, FITS, OCCASIONS, PATTERNS, SEASONS, SLOTS, STYLES } from "@/lib/domain";
import type { ComposeInput } from "../types";

// Istruzioni condivise da tutti i provider. Restano identiche tra le
// richieste, così possono essere messe in cache dove il provider lo supporta.

const vocab = (list: readonly { value: string; label: string }[]) => list.map((x) => `${x.value} (${x.label})`).join(", ");

export const ANALYZE_SYSTEM = `Sei un esperto stylist e merchandiser di moda. Analizzi la fotografia di un singolo capo d'abbigliamento, paio di scarpe o accessorio e ne estrai le caratteristiche in modo preciso.

Vocabolario ammesso (usa esclusivamente questi valori):
- category: ${vocab(CATEGORIES)}
- slot: ${vocab(SLOTS)}. Deriva lo slot dalla categoria; per sportswear e other scegli in base al capo (es. leggings → bottom, abito → one_piece).
- primary_color / secondary_colors: ${vocab(COLORS)}. Il jeans classico è "denim". Ignora lo sfondo della foto.
- pattern: ${vocab(PATTERNS)}
- seasons: ${vocab(SEASONS)}. Indica tutte le stagioni in cui il capo è indossabile.
- styles: ${vocab(STYLES)}. Da uno a tre stili.
- fit: ${vocab(FITS)} oppure null se non valutabile.

Regole:
- formality va da 1 (molto informale: t-shirt grafica, shorts, ciabatte) a 5 (molto formale: abito scuro, camicia bianca da cerimonia, scarpe oxford).
- brand solo se un logo o un'etichetta sono chiaramente leggibili, altrimenti null. Non indovinare.
- Il nome deve essere breve (2-5 parole), in italiano, con tipologia e colore, es. "Maglione girocollo blu navy".
- tags: massimo 5 parole chiave in italiano (es. "cotone", "girocollo", "basic").
- Se l'immagine non mostra un capo o un accessorio, imposta is_clothing a false e compila gli altri campi con i valori più neutri.`;

export const COMPOSE_SYSTEM = `Sei uno stylist personale esperto. Crei outfit utilizzando ESCLUSIVAMENTE i capi presenti nel guardaroba dell'utente, identificati dal loro "id".

Regole inderogabili:
- Usa solo id presenti nell'elenco "guardaroba". Non inventare capi e non descrivere capi che non sono nell'elenco.
- Ogni outfit contiene: una parte superiore (slot top) e una inferiore (slot bottom), oppure un solo capo intero (slot one_piece); al massimo un capospalla (outer), un paio di scarpe (shoes) e fino a 2 accessori. Puoi sovrapporre un capo in maglia (category knitwear) sopra una camicia o t-shirt quando fa fresco.
- Includi sempre i capi indicati come obbligatori.
- Se un elemento manca (es. scarpe adatte), crea comunque l'outfit con ciò che esiste e segnalalo in "missing".

Criteri di stile: equilibrio dei colori (non solo colori simili: neutri, un accento, analoghi o complementari attenuati), proporzioni e vestibilità, coerenza di formalità, stagionalità e temperatura, materiali, adeguatezza all'occasione. Proponi outfit diversi tra loro.

Scrivi in italiano, con tono da rivista di moda: elegante, concreto, mai prolisso. Nelle spiegazioni cita i capi con il loro nome.`;

function compactJson(v: unknown) {
  return JSON.stringify(v);
}

/** Messaggio con richiesta, guardaroba e combinazioni suggerite. */
export function composePrompt({ brief, items, suggestions, avoid }: ComposeInput) {
  const occasionLabel = OCCASIONS.find((o) => o.value === brief.occasion)?.label ?? brief.occasion;
  const request = {
    occasione: occasionLabel,
    stile: brief.style,
    stagione: brief.season,
    temperatura_c: brief.temperature,
    meteo: brief.weather,
    formalita_desiderata_1_5: brief.formality,
    colori_preferiti: brief.preferredColors,
    colori_da_evitare: brief.avoidColors,
    capi_obbligatori: brief.mustInclude,
    valorizza_capi_poco_usati: brief.rediscover,
    numero_outfit: brief.count,
    gusti_appresi: brief.tasteNotes,
  };
  return [
    `Richiesta: ${compactJson(request)}`,
    `Guardaroba (${items.length} capi): ${compactJson(items)}`,
    suggestions.length
      ? `Combinazioni valutate positivamente dal motore di regole (puoi usarle, migliorarle o ignorarle): ${compactJson(suggestions)}`
      : "",
    avoid.length ? `Combinazioni già mostrate all'utente, da NON ripetere: ${compactJson(avoid)}` : "",
    `Crea ${brief.count} outfit diversi tra loro.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
