"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { OutfitCollage } from "@/components/outfit/outfit-collage";
import { saveGeneratedOutfit } from "@/lib/data/api";
import { refresh } from "@/lib/data/hooks";
import type { ClothingItem, GeneratedOutfit } from "@/lib/schemas";
import { cn, errorMessage } from "@/lib/utils";

/** Proposta calcolata in tempo reale, salvabile nei preferiti. */
export function SuggestionCard({
  outfit,
  items,
  caption,
  index = 0,
}: {
  outfit: GeneratedOutfit;
  items: Map<string, ClothingItem>;
  caption?: string;
  index?: number;
}) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await saveGeneratedOutfit(outfit, { is_favorite: true });
      setSaved(true);
      refresh("outfits");
      toast.success("Aggiunto ai preferiti");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="w-[68vw] max-w-[280px] shrink-0 animate-fade-up snap-start sm:w-auto sm:max-w-none" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="relative">
        <OutfitCollage pieces={outfit.pieces} items={items} className="shadow-soft" />
        <button
          type="button"
          onClick={save}
          disabled={saved || saving}
          aria-label={saved ? "Salvato nei preferiti" : "Salva nei preferiti"}
          className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-surface/90 backdrop-blur transition-transform active:scale-90"
        >
          <Heart className={cn("size-[18px]", saved ? "fill-brown text-brown" : "text-ink-soft")} />
        </button>
      </div>
      <h3 className="mt-3 truncate px-1 font-display text-[21px] leading-tight">{outfit.name}</h3>
      {caption ? <p className="mt-0.5 truncate px-1 text-[12px] text-muted">{caption}</p> : null}
    </article>
  );
}
