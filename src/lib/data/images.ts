"use client";

import { COLORS, type ColorName } from "../domain";
import { getSupabase } from "../supabase/client";
import { STORAGE_BUCKET } from "../supabase/config";

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 1280;

export interface PreparedImage {
  blob: Blob;
  dataUrl: string;
  previewUrl: string;
  colors: { primary: ColorName; secondary: ColorName[] };
}

export function validateImageFile(file: File): string | null {
  if (file.type && !file.type.startsWith("image/")) return `«${file.name}» non è un'immagine.`;
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) return `Formato di «${file.name}» non supportato. Usa JPG, PNG o WebP.`;
  if (file.size > MAX_INPUT_BYTES) return `«${file.name}» supera i 20 MB.`;
  return null;
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Ridimensiona e comprime la foto nel browser (lato lungo 1280px, WebP o
 * JPEG) prima del caricamento ed estrae i colori dominanti.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const source = await decode(file);
  const w = "naturalWidth" in source ? source.naturalWidth : source.width;
  const h = "naturalHeight" in source ? source.naturalHeight : source.height;
  if (!w || !h) throw new Error("Impossibile leggere l'immagine.");
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Il browser non supporta l'elaborazione delle immagini.");
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if ("close" in source) source.close();

  let blob = await toBlob(canvas, "image/webp", 0.84);
  if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", 0.86);
  if (!blob) throw new Error("Compressione dell'immagine non riuscita.");

  const colors = extractColors(canvas);
  const dataUrl = await blobToDataUrl(blob);
  return { blob, dataUrl, previewUrl: URL.createObjectURL(blob), colors };
}

// ---------------------------------------------------------------------------
// Estrazione dei colori dominanti (senza AI)
// ---------------------------------------------------------------------------
function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

const PALETTE = COLORS.filter((c) => c.hex.startsWith("#")).map((c) => {
  const n = parseInt(c.hex.slice(1), 16);
  return { value: c.value as ColorName, lab: srgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255) };
});

function nearest(lab: [number, number, number]): ColorName {
  let best = PALETTE[0];
  let bestD = Infinity;
  for (const p of PALETTE) {
    const d = (p.lab[0] - lab[0]) ** 2 + (p.lab[1] - lab[1]) ** 2 + (p.lab[2] - lab[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best.value;
}

export function extractColors(canvas: HTMLCanvasElement): { primary: ColorName; secondary: ColorName[] } {
  const size = 64;
  const small = document.createElement("canvas");
  small.width = size;
  small.height = size;
  const ctx = small.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { primary: "black", secondary: [] };
  ctx.drawImage(canvas, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  // Lo sfondo è stimato dai pixel del bordo e poi escluso.
  const border: [number, number, number][] = [];
  for (let i = 0; i < size; i++) {
    for (const [x, y] of [
      [i, 0],
      [i, size - 1],
      [0, i],
      [size - 1, i],
    ]) {
      const o = (y * size + x) * 4;
      border.push(srgbToLab(data[o], data[o + 1], data[o + 2]));
    }
  }
  const bg = border.reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]).map((v) => v / border.length);

  const counts = new Map<ColorName, number>();
  let total = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      if (data[o + 3] < 128) continue;
      const lab = srgbToLab(data[o], data[o + 1], data[o + 2]);
      const dBg = Math.sqrt((lab[0] - bg[0]) ** 2 + (lab[1] - bg[1]) ** 2 + (lab[2] - bg[2]) ** 2);
      if (dBg < 12) continue;
      // I pixel al centro pesano di più.
      const cx = x / size - 0.5;
      const cy = y / size - 0.5;
      const weight = 1.5 - Math.min(1, Math.sqrt(cx * cx + cy * cy) * 2);
      const name = nearest(lab);
      counts.set(name, (counts.get(name) ?? 0) + weight);
      total += weight;
    }
  }
  if (total === 0) return { primary: nearest(bg as [number, number, number]), secondary: [] };
  const ranked = [...counts].sort((a, b) => b[1] - a[1]);
  const secondary = ranked
    .slice(1, 3)
    .filter(([, v]) => v / total > 0.14)
    .map(([k]) => k);
  return { primary: ranked[0][0], secondary };
}

// ---------------------------------------------------------------------------
// Archiviazione e URL firmati
// ---------------------------------------------------------------------------
export async function uploadItemImage(userId: string, blob: Blob): Promise<string> {
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await getSupabase().storage.from(STORAGE_BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Caricamento della foto non riuscito: ${error.message}`);
  return path;
}

export async function removeImage(path: string) {
  await getSupabase().storage.from(STORAGE_BUCKET).remove([path]);
}

const URL_TTL = 60 * 60 * 24 * 7;
const urlCache = new Map<string, { url: string; expires: number }>();
let pending = new Map<string, ((url: string | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  const batch = pending;
  pending = new Map();
  timer = null;
  const paths = [...batch.keys()];
  try {
    const { data, error } = await getSupabase().storage.from(STORAGE_BUCKET).createSignedUrls(paths, URL_TTL);
    if (error) throw error;
    for (const entry of data ?? []) {
      if (!entry.path) continue;
      const url = entry.signedUrl ?? null;
      if (url) urlCache.set(entry.path, { url, expires: Date.now() + (URL_TTL - 3600) * 1000 });
      batch.get(entry.path)?.forEach((cb) => cb(url));
      batch.delete(entry.path);
    }
  } catch {
    // gestito sotto: i percorsi rimasti ricevono null
  }
  for (const cbs of batch.values()) cbs.forEach((cb) => cb(null));
}

export function cachedImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const hit = urlCache.get(path);
  return hit && hit.expires > Date.now() ? hit.url : null;
}

/** Restituisce un URL firmato, raggruppando le richieste in un'unica chiamata. */
export function getImageUrl(path: string): Promise<string | null> {
  const hit = cachedImageUrl(path);
  if (hit) return Promise.resolve(hit);
  return new Promise((resolve) => {
    pending.set(path, [...(pending.get(path) ?? []), resolve]);
    if (!timer) timer = setTimeout(flush, 16);
  });
}
