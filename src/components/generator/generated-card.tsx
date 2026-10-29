"use client";

import { ArrowUpRight, Heart, RefreshCw, Replace, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { OutfitCollage } from "@/components/outfit/outfit-collage";
import { SwapSheet } from "@/components/outfit/swap-sheet";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";
import { replaceOutfitPieces, saveGeneratedOutfit, updateOutfit } from "@/lib/data/api";
import { refresh } from "@/lib/data/hooks";
import { label } from "@/lib/domain";
import { scoreOutfit, buildAffinity, scoreToPercent, type EngineContext } from "@/lib/engine";
import type { ClothingItem, GeneratedOutfit, OutfitPiece } from "@/lib/schemas";
import { cn, errorMessage } from "@/lib/utils";

export function GeneratedCard({
  outfit,
  items,
  byId,
  ctx,
  index,
  onRegenerate,
  regenerating,
}: {
  outfit: GeneratedOutfit;
  items: ClothingItem[];
  byId: Map<string, ClothingItem>;
  ctx: EngineContext;
  index: number;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [pieces, setPieces] = useState<OutfitPiece[]>(outfit.pieces);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [swapTarget, setSwapTarget] = useState<OutfitPiece | null>(null);
  const [swapHint, setSwapHint] = useState(false);
  const edited = pieces !== outfit.pieces;
  const score = edited ? scoreOutfit(pieces, byId, ctx, buildAffinity(ctx.feedback)).score : outfit.score;

  async function persist(extra: { is_favorite?: boolean; rating?: number | null }) {
    setBusy(true);
    try {
      if (savedId) {
        await updateOutfit(savedId, extra);
      } else {
        const id = await saveGeneratedOutfit({ ...outfit, pieces }, extra);
        setSavedId(id);
      }
      refresh("outfits");
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (await persist({ is_favorite: favorite, rating })) toast.success("Outfit salvato");
  }

  async function toggleFavorite() {
    const next = !favorite;
    setFavorite(next);
    if (!(await persist({ is_favorite: next }))) setFavorite(!next);
    else if (next) toast.success("Aggiunto ai preferiti");
  }

  async function rate(value: number | null) {
    const prev = rating;
    setRating(value);
    if (!(await persist({ rating: value }))) setRating(prev);
    else if (!savedId) toast.success("Valutazione salvata: lo stylist imparerà dai tuoi gusti");
  }

  async function swap(itemId: string) {
    if (!swapTarget) return;
    const next = pieces.map((p) => (p.item_id === swapTarget.item_id ? { ...p, item_id: itemId } : p));
    setSwapTarget(null);
    setPieces(next);
    if (savedId) {
      try {
        await replaceOutfitPieces(savedId, next);
        refresh("outfits");
      } catch (e) {
        toast.error(errorMessage(e));
      }
    }
  }

  async function removePiece() {
    if (!swapTarget) return;
    const next = pieces.filter((p) => p.item_id !== swapTarget.item_id);
    setSwapTarget(null);
    setPieces(next);
    if (savedId) await replaceOutfitPieces(savedId, next).catch((e) => toast.error(errorMessage(e)));
  }

  return (
    <article
      className="grid animate-fade-up gap-5 rounded-[32px] border border-line bg-surface p-3 shadow-soft sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:p-4"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="relative">
        <OutfitCollage
          pieces={pieces}
          items={byId}
          showLabels
          onPieceClick={(p) => {
            setSwapHint(false);
            setSwapTarget(p);
          }}
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-[11.5px] font-semibold backdrop-blur">
          {outfit.source === "ai" ? <Sparkles className="size-3.5 text-olive" /> : null}
          {scoreToPercent(score)}% armonia
        </span>
        {swapHint ? (
          <p className="absolute inset-x-3 bottom-3 rounded-2xl bg-ink/90 px-4 py-3 text-center text-[12.5px] font-semibold text-bg" role="status">
            Tocca il capo che vuoi sostituire
          </p>
        ) : null}
      </div>

      <div className="flex flex-col px-2 pb-2 sm:px-1 sm:py-2">
        <p className="eyebrow">
          {label.occasion(outfit.occasion)}
          {outfit.style ? ` · ${label.style(outfit.style) || outfit.style}` : ""}
          {outfit.source === "ai" ? " · Stylist AI" : ""}
        </p>
        <h3 className="mt-2 font-display text-[32px] leading-[1.02]">{outfit.name}</h3>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{outfit.description}</p>

        <div className="mt-4 rounded-[20px] bg-surface-2 p-4">
          <p className="eyebrow mb-1.5">Perché funziona</p>
          <p className="text-[13.5px] leading-relaxed text-ink-soft">{outfit.color_story}</p>
        </div>
        {outfit.tips.length ? (
          <ul className="mt-4 space-y-2">
            {outfit.tips.map((t) => (
              <li key={t} className="flex gap-2.5 text-[13.5px] leading-relaxed text-ink-soft">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-olive" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3">
          <StarRating value={rating} onChange={rate} />
          <button
            type="button"
            onClick={toggleFavorite}
            disabled={busy}
            aria-pressed={favorite}
            aria-label={favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
            className="grid size-11 place-items-center rounded-full border border-line transition-transform active:scale-90"
          >
            <Heart className={cn("size-5", favorite ? "fill-brown text-brown" : "text-ink-soft")} />
          </button>
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {savedId ? (
            <Link href={`/outfits/${savedId}`} className="flex-1">
              <Button variant="olive" className="w-full">
                Salvato · Apri <ArrowUpRight className="size-4" />
              </Button>
            </Link>
          ) : (
            <Button className="flex-1" onClick={save} loading={busy}>
              Salva outfit
            </Button>
          )}
          <Button variant="secondary" onClick={() => setSwapHint((v) => !v)} aria-label="Sostituisci un capo">
            <Replace className="size-4" /> <span className="hidden sm:inline">Sostituisci</span>
          </Button>
          <Button variant="secondary" onClick={onRegenerate} loading={regenerating} aria-label="Rigenera questa proposta">
            <RefreshCw className="size-4" /> <span className="hidden sm:inline">Rigenera</span>
          </Button>
        </div>
      </div>

      <SwapSheet
        open={Boolean(swapTarget)}
        onOpenChange={(o) => !o && setSwapTarget(null)}
        pieces={pieces}
        target={swapTarget}
        items={items}
        ctx={ctx}
        onPick={swap}
        onRemove={removePiece}
      />
    </article>
  );
}
