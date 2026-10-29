"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ItemImage } from "@/components/ui/item-image";
import { Sheet } from "@/components/ui/sheet";
import { CATEGORIES, type Category } from "@/lib/domain";
import type { ClothingItem } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export function ItemPicker({
  open,
  onOpenChange,
  title,
  description,
  items,
  selected,
  onChange,
  max,
  disabledIds = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  items: ClothingItem[];
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  disabledIds?: string[];
}) {
  const [category, setCategory] = useState<Category | null>(null);
  const available = useMemo(() => new Set(items.map((i) => i.category)), [items]);
  const list = category ? items.filter((i) => i.category === category) : items;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <Button className="w-full" onClick={() => onOpenChange(false)}>
          Fatto{selected.length ? ` · ${selected.length} selezionati` : ""}
        </Button>
      }
    >
      <div className="no-scrollbar -mx-6 mb-4 flex gap-2 overflow-x-auto px-6">
        <Chip size="sm" selected={!category} onClick={() => setCategory(null)}>
          Tutti
        </Chip>
        {CATEGORIES.filter((c) => available.has(c.value)).map((c) => (
          <Chip key={c.value} size="sm" selected={category === c.value} onClick={() => setCategory(category === c.value ? null : c.value)}>
            {c.label}
          </Chip>
        ))}
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {list.map((item) => {
          const isSelected = selected.includes(item.id);
          const disabled = disabledIds.includes(item.id) || (!isSelected && max !== undefined && selected.length >= max);
          return (
            <li key={item.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                disabled={disabled}
                onClick={() => onChange(isSelected ? selected.filter((x) => x !== item.id) : [...selected, item.id])}
                className="block w-full text-left disabled:opacity-35"
              >
                <div className="relative">
                  <ItemImage path={item.image_path} alt={item.name} className={cn("aspect-square rounded-2xl ring-2 transition-all", isSelected ? "ring-ink" : "ring-transparent")} />
                  {isSelected ? (
                    <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-ink text-bg">
                      <Check className="size-3.5" />
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 line-clamp-2 text-[11.5px] font-medium leading-snug">{item.name}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
