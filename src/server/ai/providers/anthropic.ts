import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { aiOutfitsResponseSchema, garmentAnalysisSchema } from "@/lib/schemas";
import { AIError, type AIProvider, type ComposeInput, type ImageInput } from "../types";
import { ANALYZE_SYSTEM, COMPOSE_SYSTEM, composePrompt } from "./prompts";

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

  composeOutfits(input: ComposeInput) {
    return this.run(aiOutfitsResponseSchema, COMPOSE_SYSTEM, [{ type: "text", text: composePrompt(input) }], "medium", 16000);
  }
}
