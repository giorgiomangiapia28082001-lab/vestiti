"use client";

import { useMemo } from "react";
import { ItemImage } from "@/components/ui/item-image";
import { Sheet } from "@/components/ui/sheet";
import { label } from "@/lib/domain";
import { rankAlternatives, scoreToPercent, type EngineContext } from "@/lib/engine";
import type { ClothingItem, OutfitPiece } from "@/lib/schemas";

/** Elenco di capi alternativi per sostituire un solo pezzo dell'outfit. */
export function SwapSheet({
  open,
  onOpenChange,
  pieces,
  target,
  items,
  ctx,
  onPick,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pieces: OutfitPiece[];
  target: OutfitPiece | null;
  items: ClothingItem[];
  ctx: EngineContext;
  onPick: (itemId: string) => void;
  onRemove?: () => void;
}) {
  const current = target ? items.find((i) => i.id === target.item_id) : null;
  const alternatives = useMemo(
    () => (target && open ? rankAlternatives(pieces, target.item_id, items, ctx, 24) : []),
    [target, open, pieces, items, ctx],
  );
  const optional = target && ["outer", "mid", "accessory"].includes(target.role);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Sostituisci ${label.role(target?.role).toLowerCase()}`}
      description={current ? `Al posto di «${current.name}». Gli altri capi restano invariati.` : undefined}
    >
      {alternatives.length === 0 ? (
        <p className="py-6 text-[14px] text-muted">Non ci sono altri capi di questo tipo nel tuo guardaroba.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 pt-2">
          {alternatives.map(({ item, score }) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onPick(item.id)}
                className="group block w-full text-left"
                aria-label={`Scegli ${item.name}, compatibilità ${scoreToPercent(score)}%`}
              >
                <ItemImage path={item.image_path} alt={item.name} className="aspect-square rounded-2xl" />
                <p className="mt-1.5 line-clamp-2 text-[12px] font-semibold leading-snug">{item.name}</p>
                <p className="text-[11px] text-olive">{scoreToPercent(score)}% compatibile</p>
              </button>
            </li>
          ))}
        </ul>
      )}
      {optional && onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="mt-6 w-full rounded-full border border-line py-3 text-[13.5px] font-semibold text-muted hover:text-ink"
        >
          Rimuovi questo capo dall&apos;outfit
        </button>
      ) : null}
    </Sheet>
  );
}
