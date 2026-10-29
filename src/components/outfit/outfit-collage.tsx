"use client";

import { ItemImage } from "@/components/ui/item-image";
import { label, type Role } from "@/lib/domain";
import type { ClothingItem, OutfitPiece } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const MAIN_ROLES: Role[] = ["top", "one_piece", "bottom"];
const SIDE_ROLES: Role[] = ["outer", "mid", "shoes", "accessory"];

/**
 * Composizione "flat lay" con le fotografie reali dei capi: parte alta e
 * bassa a sinistra, capospalla, scarpe e accessori a destra.
 */
export function OutfitCollage({
  pieces,
  items,
  className,
  showLabels = false,
  onPieceClick,
}: {
  pieces: OutfitPiece[];
  items: Map<string, ClothingItem>;
  className?: string;
  showLabels?: boolean;
  onPieceClick?: (piece: OutfitPiece) => void;
}) {
  const resolved = pieces
    .map((p) => ({ piece: p, item: items.get(p.item_id) }))
    .filter((x): x is { piece: OutfitPiece; item: ClothingItem } => Boolean(x.item));
  const main = MAIN_ROLES.flatMap((r) => resolved.filter((x) => x.piece.role === r));
  const side = SIDE_ROLES.flatMap((r) => resolved.filter((x) => x.piece.role === r)).slice(0, 4);

  const tile = (x: { piece: OutfitPiece; item: ClothingItem }, big: boolean) => {
    const content = (
      <>
        <ItemImage path={x.item.image_path} alt={x.item.name} className="absolute inset-0" sizes={big ? "40vw" : "20vw"} />
        {showLabels ? (
          <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-surface/90 px-2.5 py-1 text-[10.5px] font-semibold backdrop-blur">
            {label.role(x.piece.role)}
          </span>
        ) : null}
      </>
    );
    const cls = "relative min-h-0 overflow-hidden rounded-[18px] bg-surface-2";
    return onPieceClick ? (
      <button
        key={x.piece.item_id}
        type="button"
        onClick={() => onPieceClick(x.piece)}
        className={cn(cls, "text-left transition-transform active:scale-[0.98]")}
        aria-label={`${label.role(x.piece.role)}: ${x.item.name}`}
      >
        {content}
      </button>
    ) : (
      <div key={x.piece.item_id} className={cls}>
        {content}
      </div>
    );
  };

  if (resolved.length === 0) {
    return <div className={cn("aspect-[4/5] rounded-[24px] bg-surface-2", className)} aria-hidden />;
  }

  return (
    <div className={cn("grid aspect-[4/5] gap-1.5 rounded-[24px] bg-surface-2 p-1.5", side.length ? "grid-cols-[3fr_2fr]" : "grid-cols-1", className)}>
      <div className="grid min-h-0 gap-1.5" style={{ gridTemplateRows: `repeat(${Math.max(1, main.length)}, minmax(0, 1fr))` }}>
        {main.map((x) => tile(x, true))}
      </div>
      {side.length ? (
        <div className="grid min-h-0 gap-1.5" style={{ gridTemplateRows: `repeat(${side.length}, minmax(0, 1fr))` }}>
          {side.map((x) => tile(x, false))}
        </div>
      ) : null}
    </div>
  );
}
