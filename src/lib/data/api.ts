"use client";

import { categoryInfo } from "../domain";
import {
  clothingItemInputSchema,
  profileInputSchema,
  type ClothingItem,
  type ClothingItemInput,
  type GeneratedOutfit,
  type GenerateRequestInput,
  type GenerateResponse,
  type GarmentAnalysis,
  type Outfit,
  type OutfitPiece,
  type Profile,
} from "../schemas";
import { getSupabase } from "../supabase/client";
import { removeImage, uploadItemImage } from "./images";

const OUTFIT_SELECT = "*, outfit_items(item_id, role, position)";

async function currentUserId() {
  const { data } = await getSupabase().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Sessione scaduta: accedi di nuovo.");
  return id;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ---------------------------------------------------------------------------
// API server (AI e generazione)
// ---------------------------------------------------------------------------
async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione scaduta: accedi di nuovo.");
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Errore ${res.status}`);
  return json as T;
}

export async function fetchAiStatus(): Promise<{ enabled: boolean }> {
  const res = await fetch("/api/ai/status");
  if (!res.ok) return { enabled: false };
  return res.json();
}

export function analyzeGarment(dataUrl: string) {
  return apiPost<{ analysis: GarmentAnalysis & { slot: ClothingItem["slot"] }; remaining: number }>("/api/ai/analyze", {
    image: dataUrl,
  });
}

export function generateOutfits(req: GenerateRequestInput) {
  return apiPost<GenerateResponse>("/api/outfits/generate", req);
}

// ---------------------------------------------------------------------------
// Capi
// ---------------------------------------------------------------------------
export async function listItems(): Promise<ClothingItem[]> {
  const res = await getSupabase().from("clothing_items").select("*").order("created_at", { ascending: false });
  return check(res) as ClothingItem[];
}

export async function createItem(input: ClothingItemInput, image: Blob | null): Promise<ClothingItem> {
  const userId = await currentUserId();
  const values = clothingItemInputSchema.parse(input);
  const image_path = image ? await uploadItemImage(userId, image) : null;
  const res = await getSupabase()
    .from("clothing_items")
    .insert({ ...values, user_id: userId, image_path })
    .select("*")
    .single();
  if (res.error && image_path) await removeImage(image_path);
  return check(res) as ClothingItem;
}

export async function updateItem(id: string, input: ClothingItemInput, image?: Blob | null): Promise<ClothingItem> {
  const values = clothingItemInputSchema.parse(input);
  const patch: Record<string, unknown> = { ...values };
  let oldPath: string | null = null;
  if (image) {
    const userId = await currentUserId();
    const current = check(await getSupabase().from("clothing_items").select("image_path").eq("id", id).single());
    oldPath = (current as { image_path: string | null }).image_path;
    patch.image_path = await uploadItemImage(userId, image);
  }
  const res = await getSupabase().from("clothing_items").update(patch).eq("id", id).select("*").single();
  const item = check(res) as ClothingItem;
  if (oldPath) await deleteImageIfUnused(oldPath);
  return item;
}

export async function setItemFavorite(id: string, is_favorite: boolean) {
  check(await getSupabase().from("clothing_items").update({ is_favorite }).eq("id", id));
}

/** Duplica un capo: la copia condivide la stessa fotografia. */
export async function duplicateItem(item: ClothingItem): Promise<ClothingItem> {
  const { id, user_id, created_at, updated_at, wear_count, last_worn_at, is_favorite, ...rest } = item;
  void id;
  void created_at;
  void updated_at;
  void wear_count;
  void last_worn_at;
  void is_favorite;
  const res = await getSupabase()
    .from("clothing_items")
    .insert({ ...rest, user_id, name: `${item.name} (copia)`.slice(0, 80) })
    .select("*")
    .single();
  return check(res) as ClothingItem;
}

async function deleteImageIfUnused(path: string) {
  const { count } = await getSupabase()
    .from("clothing_items")
    .select("id", { count: "exact", head: true })
    .eq("image_path", path);
  if (!count) await removeImage(path);
}

export async function deleteItem(item: ClothingItem) {
  check(await getSupabase().from("clothing_items").delete().eq("id", item.id));
  if (item.image_path) await deleteImageIfUnused(item.image_path);
}

/** Converte l'analisi AI nei campi del modulo. */
export function analysisToInput(a: GarmentAnalysis & { slot: ClothingItem["slot"] }): ClothingItemInput {
  return {
    name: a.name,
    category: a.category,
    subcategory: a.subcategory,
    slot: a.slot ?? categoryInfo(a.category).slot,
    primary_color: a.primary_color,
    secondary_colors: a.secondary_colors,
    material: a.material,
    pattern: a.pattern,
    seasons: a.seasons,
    styles: a.styles,
    fit: a.fit,
    formality: a.formality,
    brand: a.brand,
    tags: a.tags,
    ai_analyzed: true,
  };
}

// ---------------------------------------------------------------------------
// Outfit
// ---------------------------------------------------------------------------
export async function listOutfits(): Promise<Outfit[]> {
  const res = await getSupabase().from("outfits").select(OUTFIT_SELECT).order("created_at", { ascending: false }).limit(500);
  return check(res) as Outfit[];
}

export async function getOutfit(id: string): Promise<Outfit | null> {
  const res = await getSupabase().from("outfits").select(OUTFIT_SELECT).eq("id", id).maybeSingle();
  return check(res) as Outfit | null;
}

async function writeOutfitItems(outfitId: string, pieces: OutfitPiece[]) {
  const supabase = getSupabase();
  check(await supabase.from("outfit_items").delete().eq("outfit_id", outfitId));
  if (pieces.length === 0) return;
  check(
    await supabase
      .from("outfit_items")
      .insert(pieces.map((p, position) => ({ outfit_id: outfitId, item_id: p.item_id, role: p.role, position }))),
  );
}

export async function saveGeneratedOutfit(o: GeneratedOutfit, extra: { is_favorite?: boolean; rating?: number | null } = {}) {
  const userId = await currentUserId();
  const res = await getSupabase()
    .from("outfits")
    .insert({
      user_id: userId,
      name: o.name.slice(0, 80),
      description: o.description,
      occasion: o.occasion,
      style: o.style,
      season: o.season,
      color_story: o.color_story,
      tips: o.tips,
      source: o.source,
      is_favorite: extra.is_favorite ?? false,
      rating: extra.rating ?? null,
    })
    .select("id")
    .single();
  const { id } = check(res) as { id: string };
  try {
    await writeOutfitItems(id, o.pieces);
  } catch (e) {
    await getSupabase().from("outfits").delete().eq("id", id);
    throw e;
  }
  return id;
}

export async function updateOutfit(
  id: string,
  patch: Partial<Pick<Outfit, "name" | "notes" | "rating" | "is_favorite" | "description" | "color_story" | "tips">>,
) {
  check(await getSupabase().from("outfits").update(patch).eq("id", id));
}

export async function replaceOutfitPieces(id: string, pieces: OutfitPiece[]) {
  await writeOutfitItems(id, pieces);
  check(await getSupabase().from("outfits").update({ source: "manual" }).eq("id", id));
}

export async function duplicateOutfit(o: Outfit): Promise<string> {
  const userId = await currentUserId();
  const res = await getSupabase()
    .from("outfits")
    .insert({
      user_id: userId,
      name: `${o.name} (variante)`.slice(0, 80),
      description: o.description,
      occasion: o.occasion,
      style: o.style,
      season: o.season,
      color_story: o.color_story,
      tips: o.tips,
      source: "manual",
      notes: o.notes,
    })
    .select("id")
    .single();
  const { id } = check(res) as { id: string };
  await writeOutfitItems(
    id,
    o.outfit_items.map((x) => ({ item_id: x.item_id, role: x.role })),
  );
  return id;
}

export async function deleteOutfit(id: string) {
  check(await getSupabase().from("outfits").delete().eq("id", id));
}

// ---------------------------------------------------------------------------
// Cronologia e calendario
// ---------------------------------------------------------------------------
export interface HistoryEntry {
  id: string;
  outfit_id: string;
  worn_on: string;
  notes: string | null;
  created_at: string;
}

export async function listHistory(): Promise<HistoryEntry[]> {
  const res = await getSupabase().from("outfit_history").select("*").order("worn_on", { ascending: false }).limit(500);
  return check(res) as HistoryEntry[];
}

export async function markOutfitWorn(outfitId: string, worn_on: string, notes?: string | null) {
  const userId = await currentUserId();
  check(await getSupabase().from("outfit_history").insert({ user_id: userId, outfit_id: outfitId, worn_on, notes: notes || null }));
}

export interface PlannedEntry {
  id: string;
  outfit_id: string;
  planned_for: string;
  notes: string | null;
}

export async function listPlanned(from: string, to: string): Promise<PlannedEntry[]> {
  const res = await getSupabase()
    .from("planned_outfits")
    .select("*")
    .gte("planned_for", from)
    .lte("planned_for", to)
    .order("planned_for");
  return check(res) as PlannedEntry[];
}

export async function planOutfit(outfitId: string, planned_for: string) {
  const userId = await currentUserId();
  check(
    await getSupabase()
      .from("planned_outfits")
      .upsert({ user_id: userId, outfit_id: outfitId, planned_for }, { onConflict: "user_id,planned_for" }),
  );
}

export async function unplan(id: string) {
  check(await getSupabase().from("planned_outfits").delete().eq("id", id));
}

// ---------------------------------------------------------------------------
// Profilo
// ---------------------------------------------------------------------------
export async function getProfile(): Promise<Profile | null> {
  const userId = await currentUserId();
  const res = await getSupabase().from("profiles").select("*").eq("id", userId).maybeSingle();
  return check(res) as Profile | null;
}

export async function saveProfile(input: unknown) {
  const userId = await currentUserId();
  const values = profileInputSchema.parse(input);
  check(await getSupabase().from("profiles").upsert({ id: userId, ...values }));
}
