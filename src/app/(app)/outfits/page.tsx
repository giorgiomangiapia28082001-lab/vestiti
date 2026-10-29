"use client";

import { Heart, Wand2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { OutfitCard } from "@/components/outfit/outfit-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemImage } from "@/components/ui/item-image";
import { Segmented } from "@/components/ui/segmented";
import { GridSkeleton } from "@/components/ui/skeleton";
import { useHistory, useItems, useOutfits } from "@/lib/data/hooks";
import type { ClothingItem } from "@/lib/schemas";
import { daysSince, formatDate, relativeDays } from "@/lib/utils";

type Tab = "favorites" | "saved" | "worn" | "stats";

export default function OutfitsPage() {
  const { data: outfits, isLoading } = useOutfits();
  const { data: items } = useItems();
  const { data: history } = useHistory();
  const [tab, setTab] = useState<Tab>("favorites");
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const outfitById = useMemo(() => new Map((outfits ?? []).map((o) => [o.id, o])), [outfits]);

  const favorites = (outfits ?? []).filter((o) => o.is_favorite);
  const worn = (history ?? []).filter((h) => outfitById.has(h.outfit_id));

  return (
    <div>
      <PageHeader eyebrow="Archivio" title="I miei outfit" />
      <Segmented
        className="mb-8"
        value={tab}
        onChange={setTab}
        options={[
          { value: "favorites", label: "Preferiti", count: favorites.length },
          { value: "saved", label: "Salvati", count: outfits?.length ?? 0 },
          { value: "worn", label: "Indossati", count: worn.length },
          { value: "stats", label: "Statistiche" },
        ]}
      />

      {isLoading ? (
        <GridSkeleton count={6} />
      ) : tab === "stats" ? (
        <Stats items={items ?? []} recent={(outfits ?? []).slice(0, 4)} byId={byId} />
      ) : tab === "worn" ? (
        worn.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {worn.map((h, i) => (
              <OutfitCard key={h.id} outfit={outfitById.get(h.outfit_id)!} items={byId} index={i} meta={`Indossato ${formatDate(h.worn_on)}`} />
            ))}
          </div>
        ) : (
          <EmptyState title="Nessun outfit indossato" icon={<Heart className="size-7" strokeWidth={1.4} />}>
            Apri un outfit e tocca «Segna come indossato»: lo stylist terrà conto di ciò che usi più spesso.
          </EmptyState>
        )
      ) : (tab === "favorites" ? favorites : outfits ?? []).length ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {(tab === "favorites" ? favorites : outfits ?? []).map((o, i) => (
            <OutfitCard key={o.id} outfit={o} items={byId} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Wand2 className="size-7" strokeWidth={1.4} />}
          title={tab === "favorites" ? "Ancora nessun preferito" : "Ancora nessun outfit salvato"}
          action={
            <Link href="/generate">
              <Button size="lg">
                <Wand2 className="size-4" /> Crea un outfit
              </Button>
            </Link>
          }
        >
          Genera le prime proposte con lo stylist e salva quelle che ti piacciono.
        </EmptyState>
      )}
    </div>
  );
}

function Stats({ items, recent, byId }: { items: ClothingItem[]; recent: ReturnType<typeof useOutfits>["data"]; byId: Map<string, ClothingItem> }) {
  const mostUsed = [...items].filter((i) => i.wear_count > 0).sort((a, b) => b.wear_count - a.wear_count).slice(0, 8);
  const rarely = [...items]
    .filter((i) => i.wear_count === 0 || (daysSince(i.last_worn_at) ?? 0) > 45)
    .sort((a, b) => a.wear_count - b.wear_count || (a.last_worn_at ?? "").localeCompare(b.last_worn_at ?? ""))
    .slice(0, 8);
  const lastUsed = [...items].filter((i) => i.last_worn_at).sort((a, b) => b.last_worn_at!.localeCompare(a.last_worn_at!)).slice(0, 8);

  if (!items.length) return <EmptyState title="Nessun dato ancora">Aggiungi capi e segna gli outfit indossati per vedere le statistiche.</EmptyState>;

  return (
    <div className="space-y-12">
      <StatList title="Capi usati più spesso" empty="Segna gli outfit come indossati per vedere quali capi usi di più." items={mostUsed} render={(i) => `${i.wear_count} ${i.wear_count === 1 ? "volta" : "volte"}`} />
      <StatList
        title="Capi che usi raramente"
        empty="Ottimo: stai usando tutto il guardaroba."
        items={rarely}
        render={(i) => (i.wear_count === 0 ? "Mai indossato" : relativeDays(i.last_worn_at))}
        action={
          rarely.length ? (
            <Link href="/generate" className="text-[13px] font-semibold text-olive">
              Crea outfit con questi →
            </Link>
          ) : null
        }
      />
      <StatList title="Ultimo utilizzo" empty="Nessun capo indossato finora." items={lastUsed} render={(i) => formatDate(i.last_worn_at)} />
      {recent?.length ? (
        <section>
          <h2 className="mb-4 font-display text-[28px]">Creati di recente</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {recent.map((o, i) => (
              <OutfitCard key={o.id} outfit={o} items={byId} index={i} meta={`Creato ${formatDate(o.created_at)}`} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StatList({
  title,
  items,
  render,
  empty,
  action,
}: {
  title: string;
  items: ClothingItem[];
  render: (i: ClothingItem) => string;
  empty: string;
  action?: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h2 className="font-display text-[28px] leading-none">{title}</h2>
        {action}
      </div>
      {items.length ? (
        <ul className="divide-y divide-line rounded-[24px] border border-line bg-surface">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/wardrobe/${i.id}`} className="flex items-center gap-3 p-3">
                <ItemImage path={i.image_path} alt="" className="size-12 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{i.name}</span>
                <span className="shrink-0 text-[12.5px] text-muted">{render(i)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[24px] bg-surface-2 p-5 text-[14px] text-muted">{empty}</p>
      )}
    </section>
  );
}
