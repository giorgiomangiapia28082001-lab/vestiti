import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { COLORS, CATEGORIES, FITS, OCCASIONS, PATTERNS, SEASONS, SLOTS, STYLES } from "@/lib/domain";
import { aiOutfitsResponseSchema, garmentAnalysisSchema } from "@/lib/schemas";
import { AIError, type AIProvider, type ComposeInput, type ImageInput } from "../types";

const vocab = (list: readonly { value: string; label: string }[]) => list.map((x) => `${x.value} (${x.label})`).join(", ");

// Prompt di sistema stabili: restano identici tra le richieste, così
// possono essere messi in cache.
const ANALYZE_SYSTEM = `Sei un esperto stylist e merchandiser di moda. Analizzi la fotografia di un singolo capo d'abbigliamento, paio di scarpe o accessorio e ne estrai le caratteristiche in modo preciso.

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

const COMPOSE_SYSTEM = `Sei uno stylist personale esperto. Crei outfit utilizzando ESCLUSIVAMENTE i capi presenti nel guardaroba dell'utente, identificati dal loro "id".

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

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
    this.model = model;
  }

  private async run<T extends z.ZodType>(
    schema: T,
    system: string,
    content: Anthropic.Beta.BetaContentBlockParam[],
    effort: "low" | "medium",
    maxTokens: number,
  ): Promise<z.infer<T>> {
    try {
      const response = await this.client.beta.messages.parse({
        model: this.model,
        max_tokens: maxTokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
        output_config: { effort, format: betaZodOutputFormat(schema) },
      });
      if (response.stop_reason === "refusal") {
        throw new AIError("Il modello ha rifiutato la richiesta.", "refused");
      }
      if (response.stop_reason === "max_tokens" || !response.parsed_output) {
        throw new AIError("Risposta AI incompleta o non valida.", "invalid_output");
      }
      return response.parsed_output as z.infer<T>;
    } catch (error) {
      if (error instanceof AIError) throw error;
      if (error instanceof Anthropic.RateLimitError) {
        throw new AIError("Il servizio AI è momentaneamente sovraccarico.", "rate_limited");
      }
      if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
        throw new AIError("Credenziali AI non valide: controlla ANTHROPIC_API_KEY.", "not_configured");
      }
      if (error instanceof Anthropic.APIError) {
        throw new AIError(`Errore del servizio AI (${error.status ?? "rete"}).`, "provider_error");
      }
      throw new AIError("Impossibile interpretare la risposta AI.", "invalid_output");
    }
  }

  analyzeGarment(image: ImageInput) {
    return this.run(
      garmentAnalysisSchema,
      ANALYZE_SYSTEM,
      [
        { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } },
        { type: "text", text: "Analizza questo capo e restituisci le sue caratteristiche." },
      ],
      "low",
      4000,
    );
  }

  composeOutfits({ brief, items, suggestions, avoid }: ComposeInput) {
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
    const text = [
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
    return this.run(aiOutfitsResponseSchema, COMPOSE_SYSTEM, [{ type: "text", text }], "medium", 16000);
  }
}
