"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { StarRating } from "@/components/ui/star-rating";
import { label } from "@/lib/domain";
import type { ClothingItem, Outfit } from "@/lib/schemas";
import { OutfitCollage } from "./outfit-collage";

export function OutfitCard({
  outfit,
  items,
  index = 0,
  meta,
}: {
  outfit: Outfit;
  items: Map<string, ClothingItem>;
  index?: number;
  meta?: React.ReactNode;
}) {
  return (
    <Link
      href={`/outfits/${outfit.id}`}
      className="group block animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      <div className="relative transition-transform duration-300 group-hover:-translate-y-0.5">
        <OutfitCollage pieces={outfit.outfit_items} items={items} className="shadow-soft group-hover:shadow-lift" />
        {outfit.is_favorite ? (
          <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-surface/90 backdrop-blur">
            <Heart className="size-4 fill-brown text-brown" aria-label="Preferito" />
          </span>
        ) : null}
      </div>
      <div className="mt-3 px-1">
        <p className="truncate font-display text-[21px] leading-tight">{outfit.name}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-muted">
          <span className="truncate">{meta ?? [label.occasion(outfit.occasion), label.style(outfit.style)].filter(Boolean).join(" · ")}</span>
          {outfit.rating ? <StarRating value={outfit.rating} size="sm" /> : null}
        </div>
      </div>
    </Link>
  );
}
