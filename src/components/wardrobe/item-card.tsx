"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ColorDot } from "@/components/ui/color-dot";
import { ItemImage } from "@/components/ui/item-image";
import { setItemFavorite } from "@/lib/data/api";
import { refresh } from "@/lib/data/hooks";
import { label } from "@/lib/domain";
import type { ClothingItem } from "@/lib/schemas";
import { cn, errorMessage } from "@/lib/utils";

export function ItemCard({ item, index = 0 }: { item: ClothingItem; index?: number }) {
  const [favorite, setFavorite] = useState(item.is_favorite);
  const [synced, setSynced] = useState(item.is_favorite);
  if (synced !== item.is_favorite) {
    setSynced(item.is_favorite);
    setFavorite(item.is_favorite);
  }

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    const next = !favorite;
    setFavorite(next);
    try {
      await setItemFavorite(item.id, next);
      refresh("items");
    } catch (err) {
      setFavorite(!next);
      toast.error(errorMessage(err));
    }
  }

  return (
    <Link
      href={`/wardrobe/${item.id}`}
      className="group block animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div className="relative">
        <ItemImage
          path={item.image_path}
          alt={item.name}
          className="aspect-[4/5] w-full rounded-[22px] shadow-soft transition-all duration-300 group-hover:shadow-lift"
          sizes="(min-width: 1024px) 22vw, 45vw"
        />
        <button
          type="button"
          onClick={toggle}
          aria-pressed={favorite}
          aria-label={favorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
          className="absolute right-2.5 top-2.5 grid size-9 place-items-center rounded-full bg-surface/85 backdrop-blur transition-transform active:scale-90"
        >
          <Heart className={cn("size-[17px]", favorite ? "fill-brown text-brown" : "text-ink-soft")} strokeWidth={1.8} />
        </button>
      </div>
      <div className="mt-2.5 px-1">
        <p className="truncate text-[14px] font-semibold leading-snug">{item.name}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
          <ColorDot color={item.primary_color} className="size-3" />
          {item.secondary_colors.slice(0, 2).map((c) => (
            <ColorDot key={c} color={c} className="-ml-1 size-3" />
          ))}
          <span className="truncate">{item.brand || label.category(item.category)}</span>
        </div>
      </div>
    </Link>
  );
}
