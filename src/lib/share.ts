"use client";

import { getImageUrl } from "./data/images";
import type { ClothingItem, OutfitPiece } from "./schemas";

const MAIN = ["top", "one_piece", "bottom"];
const SIDE = ["outer", "mid", "shoes", "accessory"];

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

/** Crea un'immagine 1080×1350 dell'outfit con le foto reali dei capi. */
export async function renderOutfitImage(name: string, pieces: OutfitPiece[], items: Map<string, ClothingItem>): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f6f2eb";
  ctx.fillRect(0, 0, W, H);

  const resolved = pieces.map((p) => ({ p, item: items.get(p.item_id) })).filter((x) => x.item);
  const main = MAIN.flatMap((r) => resolved.filter((x) => x.p.role === r));
  const side = SIDE.flatMap((r) => resolved.filter((x) => x.p.role === r)).slice(0, 4);

  const pad = 48;
  const gap = 18;
  const top = pad;
  const areaH = H - pad - 190;
  const mainW = side.length ? (W - pad * 2 - gap) * 0.6 : W - pad * 2;
  const sideW = W - pad * 2 - gap - mainW;

  const draw = async (list: typeof resolved, x: number, w: number) => {
    const h = (areaH - gap * (list.length - 1)) / Math.max(1, list.length);
    for (const [i, { item }] of list.entries()) {
      const y = top + i * (h + gap);
      ctx.save();
      roundRect(ctx, x, y, w, h, 28);
      ctx.fillStyle = "#efe9df";
      ctx.fill();
      ctx.clip();
      const url = item?.image_path ? await getImageUrl(item.image_path) : null;
      if (url) {
        const img = await loadImage(url);
        drawCover(ctx, img, x, y, w, h);
      }
      ctx.restore();
    }
  };
  await draw(main, pad, mainW);
  if (side.length) await draw(side, pad + mainW + gap, sideW);

  ctx.fillStyle = "#1d1b18";
  ctx.font = "italic 64px 'Instrument Serif', Georgia, serif";
  ctx.fillText(name.slice(0, 32), pad, H - 92);
  ctx.fillStyle = "#6e675d";
  ctx.font = "600 24px Manrope, system-ui, sans-serif";
  ctx.fillText("WARDROBE AI", pad, H - 48);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Impossibile creare l'immagine.");
  return blob;
}

/**
 * Condivide l'outfit con il pannello nativo del telefono (Web Share API).
 * Se non è supportato, scarica l'immagine.
 */
export async function shareOutfit(name: string, description: string | null, pieces: OutfitPiece[], items: Map<string, ClothingItem>) {
  const list = pieces.map((p) => `• ${items.get(p.item_id)?.name}`).join("\n");
  const text = `${name}\n${description ?? ""}\n\n${list}`.trim();
  let file: File | null = null;
  try {
    const blob = await renderOutfitImage(name, pieces, items);
    file = new File([blob], `${name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "outfit"}.png`, { type: "image/png" });
  } catch {
    file = null;
  }
  if (file && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name, text });
    return "shared";
  }
  if (navigator.share) {
    await navigator.share({ title: name, text });
    return "shared";
  }
  if (file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "downloaded";
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
