import { z } from "zod";
import { categoryInfo } from "@/lib/domain";
import { AIError, getAIProvider } from "@/server/ai";
import { errorResponse, HttpError, requireUser } from "@/server/supabase";
import { consumeAiQuota } from "@/server/usage";

const MAX_BYTES = 3 * 1024 * 1024;

const bodySchema = z.object({
  image: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Formato immagine non supportato"),
});

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser(request);
    const provider = getAIProvider();
    if (!provider) throw new HttpError(503, "Il riconoscimento AI non è configurato: compila i dati manualmente.");

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Immagine non valida.");
    const [, mime, base64] = parsed.data.image.match(/^data:(image\/\w+);base64,(.+)$/)!;
    if ((base64.length * 3) / 4 > MAX_BYTES) throw new HttpError(413, "Immagine troppo grande.");

    const quota = await consumeAiQuota(supabase, user.id, "analyze");
    if (!quota.allowed) throw new HttpError(429, "Hai raggiunto il limite giornaliero di analisi AI. Riprova domani o compila i dati a mano.");

    const result = await provider.analyzeGarment({ base64, mediaType: mime as "image/jpeg" | "image/png" | "image/webp" });

    // Normalizza l'output del modello sui vincoli del database.
    const info = categoryInfo(result.category);
    const fixedSlot = result.category !== "sportswear" && result.category !== "other";
    const analysis = {
      ...result,
      slot: fixedSlot ? info.slot : result.slot,
      formality: Math.min(5, Math.max(1, Math.round(result.formality))),
      name: result.name.slice(0, 80),
      subcategory: result.subcategory?.slice(0, 60) || null,
      material: result.material?.slice(0, 60) || null,
      brand: result.brand?.slice(0, 60) || null,
      secondary_colors: [...new Set(result.secondary_colors.filter((c) => c !== result.primary_color))].slice(0, 4),
      seasons: [...new Set(result.seasons)],
      styles: [...new Set(result.styles)].slice(0, 3),
      tags: [...new Set(result.tags.map((t) => t.trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 5),
      confidence: Math.min(1, Math.max(0, result.confidence)),
    };
    return Response.json({ analysis, remaining: quota.remaining });
  } catch (error) {
    if (error instanceof AIError) {
      const status = error.code === "rate_limited" ? 429 : error.code === "not_configured" ? 503 : 502;
      return Response.json({ error: error.message }, { status });
    }
    return errorResponse(error);
  }
}
