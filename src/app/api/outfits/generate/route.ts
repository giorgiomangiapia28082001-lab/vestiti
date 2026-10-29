import { generateRequestSchema } from "@/lib/schemas";
import { generateOutfits } from "@/server/outfits";
import { errorResponse, HttpError, requireUser } from "@/server/supabase";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser(request);
    const parsed = generateRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new HttpError(400, "Parametri di generazione non validi.");
    const result = await generateOutfits(supabase, user.id, parsed.data);
    return Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
