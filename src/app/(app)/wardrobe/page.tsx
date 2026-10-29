"use client";

import { Plus, Search, Shirt, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { ColorDot } from "@/components/ui/color-dot";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { GridSkeleton } from "@/components/ui/skeleton";
import { ItemCard } from "@/components/wardrobe/item-card";
import { useItems } from "@/lib/data/hooks";
import { CATEGORIES, COLORS, SEASONS, STYLES, label, type Category, type ColorName, type Season, type Style } from "@/lib/domain";
import { daysSince } from "@/lib/utils";

type Usage = "never" | "rare" | "often";
type Sort = "recent" | "name" | "most" | "least";

const USAGE = [
  { value: "never", label: "Mai indossati" },
  { value: "rare", label: "Usati raramente" },
  { value: "often", label: "Usati spesso" },
] as const;

const SORTS = [
  { value: "recent", label: "Aggiunti di recente" },
  { value: "name", label: "Nome (A-Z)" },
  { value: "most", label: "Più indossati" },
  { value: "least", label: "Meno indossati" },
] as const;

export default function WardrobePage() {
  const { data: items, isLoading, error, mutate } = useItems();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [colors, setColors] = useState<ColorName[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilters = colors.length + seasons.length + styles.length + usage.length + (favoritesOnly ? 1 : 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (items ?? []).filter((i) => {
      if (category && i.category !== category) return false;
      if (favoritesOnly && !i.is_favorite) return false;
      if (colors.length && !colors.some((c) => c === i.primary_color || i.secondary_colors.includes(c))) return false;
      if (seasons.length && i.seasons.length && !seasons.some((s) => i.seasons.includes(s))) return false;
      if (styles.length && !styles.some((s) => i.styles.includes(s))) return false;
      if (usage.length) {
        const d = daysSince(i.last_worn_at);
        const match =
          (usage.includes("never") && i.wear_count === 0) ||
          (usage.includes("rare") && i.wear_count > 0 && (i.wear_count <= 2 || (d !== null && d > 45))) ||
          (usage.includes("often") && i.wear_count >= 5);
        if (!match) return false;
      }
      if (q) {
        const hay = [i.name, i.brand, i.subcategory, i.material, label.category(i.category), label.color(i.primary_color), ...i.tags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorted = [...list];
    if (sort === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "it"));
    if (sort === "most") sorted.sort((a, b) => b.wear_count - a.wear_count);
    if (sort === "least") sorted.sort((a, b) => a.wear_count - b.wear_count);
    return sorted;
  }, [items, query, category, colors, seasons, styles, usage, favoritesOnly, sort]);

  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items ?? []) m.set(i.category, (m.get(i.category) ?? 0) + 1);
    return m;
  }, [items]);

  function resetFilters() {
    setColors([]);
    setSeasons([]);
    setStyles([]);
    setUsage([]);
    setFavoritesOnly(false);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalogo personale"
        title="Il mio guardaroba"
        subtitle={items ? `${items.length} ${items.length === 1 ? "capo" : "capi"}` : undefined}
        actions={
          <Link href="/wardrobe/new" className="hidden sm:block">
            <Button>
              <Plus className="size-4" /> Aggiungi
            </Button>
          </Link>
        }
      />

      {error ? (
        <EmptyState title="Impossibile caricare il guardaroba" action={<Button onClick={() => mutate()}>Riprova</Button>}>
          Controlla la connessione e riprova.
        </EmptyState>
      ) : isLoading ? (
        <GridSkeleton count={8} />
      ) : !items?.length ? (
        <EmptyState
          icon={<Shirt className="size-7" strokeWidth={1.4} />}
          title="Ancora nessun capo"
          action={
            <Link href="/wardrobe/new">
              <Button size="lg">
                <Plus className="size-4" /> Aggiungi il primo capo
              </Button>
            </Link>
          }
        >
          Fotografa camicie, pantaloni, scarpe e accessori: diventeranno il tuo catalogo personale.
        </EmptyState>
      ) : (
        <>
          <div className="sticky top-0 z-30 -mx-4 space-y-3 bg-bg/90 px-4 pb-3 pt-2 backdrop-blur-xl sm:mx-0 sm:px-0">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cerca per nome, brand, colore, tag…"
                  className="h-11 rounded-full pl-10"
                  aria-label="Cerca nel guardaroba"
                />
              </div>
              <Button variant="secondary" onClick={() => setFiltersOpen(true)} className="relative h-11" aria-label="Filtri">
                <SlidersHorizontal className="size-4" />
                <span className="hidden sm:inline">Filtri</span>
                {activeFilters ? (
                  <span className="grid size-5 place-items-center rounded-full bg-olive text-[10.5px] text-white dark:text-bg">{activeFilters}</span>
                ) : null}
              </Button>
            </div>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              <Chip size="sm" selected={!category} onClick={() => setCategory(null)}>
                Tutti
              </Chip>
              {CATEGORIES.filter((c) => categoryCounts.has(c.value)).map((c) => (
                <Chip key={c.value} size="sm" selected={category === c.value} onClick={() => setCategory(category === c.value ? null : c.value)}>
                  {c.label} <span className="opacity-60">{categoryCounts.get(c.value)}</span>
                </Chip>
              ))}
            </div>
          </div>

          {activeFilters ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-[12.5px]">
              {[...colors.map(label.color), ...seasons.map(label.season), ...styles.map(label.style), ...usage.map((u) => USAGE.find((x) => x.value === u)!.label), ...(favoritesOnly ? ["Preferiti"] : [])].map((t) => (
                <span key={t} className="rounded-full bg-surface-2 px-3 py-1.5 text-ink-soft">
                  {t}
                </span>
              ))}
              <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 px-2 py-1.5 font-semibold text-muted hover:text-ink">
                <X className="size-3.5" /> Azzera
              </button>
            </div>
          ) : null}

          {filtered.length ? (
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map((item, i) => (
                <ItemCard key={item.id} item={item} index={i} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="Nessun capo trovato"
              className="mt-4"
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    resetFilters();
                    setQuery("");
                    setCategory(null);
                  }}
                >
                  Mostra tutto
                </Button>
              }
            >
              Prova a cambiare la ricerca o i filtri.
            </EmptyState>
          )}
        </>
      )}

      <Sheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filtri"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={resetFilters}>
              Azzera
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Mostra {filtered.length} capi
            </Button>
          </div>
        }
      >
        <div className="space-y-7 pt-2">
          <Field label="Ordina per" htmlFor="sort">
            <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Preferiti">
            <Chip size="sm" selected={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
              Solo preferiti
            </Chip>
          </Field>
          <Field label="Colore">
            <ChipGroup
              label="Colore"
              size="sm"
              options={COLORS}
              value={colors}
              onChange={setColors}
              render={(o) => (
                <>
                  <ColorDot color={o.value} /> {o.label}
                </>
              )}
            />
          </Field>
          <Field label="Stagione">
            <ChipGroup label="Stagione" size="sm" options={SEASONS} value={seasons} onChange={setSeasons} />
          </Field>
          <Field label="Stile">
            <ChipGroup label="Stile" size="sm" options={STYLES} value={styles} onChange={setStyles} />
          </Field>
          <Field label="Frequenza di utilizzo">
            <ChipGroup label="Frequenza" size="sm" options={USAGE} value={usage} onChange={setUsage} />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}
