"use client";

import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { OutfitCollage } from "@/components/outfit/outfit-collage";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { markOutfitWorn, planOutfit, unplan } from "@/lib/data/api";
import { refresh, useHistory, useItems, useOutfits, usePlanned } from "@/lib/data/hooks";
import { label } from "@/lib/domain";
import { cn, errorMessage, isoDate } from "@/lib/utils";

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // lunedì = 0
  x.setDate(x.getDate() - day);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const dayFmt = new Intl.DateTimeFormat("it-IT", { weekday: "long" });
const numFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });
const rangeFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long" });

export default function CalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = isoDate(days[0]);
  const to = isoDate(days[6]);
  const { data: planned, isLoading, mutate } = usePlanned(from, to);
  const { data: outfits } = useOutfits();
  const { data: items } = useItems();
  const { data: history } = useHistory();
  const [picking, setPicking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const outfitById = useMemo(() => new Map((outfits ?? []).map((o) => [o.id, o])), [outfits]);
  const plannedByDay = useMemo(() => new Map((planned ?? []).map((p) => [p.planned_for, p])), [planned]);
  const today = isoDate();
  const sortedOutfits = useMemo(
    () => [...(outfits ?? [])].sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite) || (b.rating ?? 0) - (a.rating ?? 0)),
    [outfits],
  );

  async function assign(outfitId: string) {
    if (!picking) return;
    const day = picking;
    setPicking(null);
    setBusy(day);
    try {
      await planOutfit(outfitId, day);
      await mutate();
      toast.success("Outfit pianificato");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string, day: string) {
    setBusy(day);
    try {
      await unplan(id);
      await mutate();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function worn(outfitId: string, day: string) {
    setBusy(day);
    try {
      await markOutfitWorn(outfitId, day);
      await refresh("history", "items");
      toast.success("Segnato come indossato");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Pianificazione" title="Calendario" subtitle="Decidi in anticipo cosa indossare durante la settimana." />

      <div className="mb-6 flex items-center justify-between gap-3">
        <Button variant="secondary" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Settimana precedente">
          <ChevronLeft className="size-5" />
        </Button>
        <div className="text-center">
          <p className="font-display text-[22px] leading-tight">
            {rangeFmt.format(days[0])} – {rangeFmt.format(days[6])}
          </p>
          {isoDate(weekStart) !== isoDate(startOfWeek(new Date())) ? (
            <button type="button" className="text-[12px] font-semibold text-olive" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Torna a questa settimana
            </button>
          ) : null}
        </div>
        <Button variant="secondary" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Settimana successiva">
          <ChevronRight className="size-5" />
        </Button>
      </div>

      <ol className="grid gap-3 lg:grid-cols-7 lg:gap-2">
        {days.map((d) => {
          const key = isoDate(d);
          const entry = plannedByDay.get(key);
          const outfit = entry ? outfitById.get(entry.outfit_id) : null;
          const isToday = key === today;
          const past = key < today;
          const alreadyWorn = outfit && (history ?? []).some((h) => h.outfit_id === outfit.id && h.worn_on === key);
          return (
            <li
              key={key}
              className={cn(
                "flex gap-4 rounded-[24px] border bg-surface p-3 lg:flex-col lg:gap-3",
                isToday ? "border-ink shadow-soft" : "border-line",
                past && !outfit && "opacity-60",
              )}
            >
              <div className="w-20 shrink-0 pt-1 lg:w-auto">
                <p className={cn("text-[12px] font-semibold capitalize", isToday ? "text-olive" : "text-muted")}>{isToday ? "Oggi" : dayFmt.format(d)}</p>
                <p className="font-display text-[24px] leading-none">{numFmt.format(d)}</p>
              </div>
              <div className="min-w-0 flex-1">
                {isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : outfit ? (
                  <div className="flex gap-3 lg:flex-col">
                    <Link href={`/outfits/${outfit.id}`} className="w-24 shrink-0 lg:w-full">
                      <OutfitCollage pieces={outfit.outfit_items} items={byId} className="rounded-[16px]" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[14px]">{outfit.name}</p>
                      <p className="truncate text-[12px] text-muted">{label.occasion(outfit.occasion)}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setPicking(key)} disabled={busy === key}>
                          Cambia
                        </Button>
                        {key <= today ? (
                          <Button size="sm" variant={alreadyWorn ? "olive" : "secondary"} onClick={() => !alreadyWorn && worn(outfit.id, key)} disabled={busy === key || Boolean(alreadyWorn)} aria-label="Segna come indossato">
                            <Check className="size-3.5" /> {alreadyWorn ? "Indossato" : ""}
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => remove(entry!.id, key)} disabled={busy === key} aria-label="Rimuovi dal calendario">
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPicking(key)}
                    disabled={busy === key}
                    className="flex h-full min-h-20 w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-sand text-[13px] font-semibold text-muted transition-colors hover:border-ink hover:text-ink"
                  >
                    <Plus className="size-4" /> Scegli outfit
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <Sheet
        open={Boolean(picking)}
        onOpenChange={(o) => !o && setPicking(null)}
        title="Scegli un outfit"
        description={picking ? `Per ${rangeFmt.format(new Date(`${picking}T12:00:00`))}` : undefined}
      >
        {sortedOutfits.length ? (
          <ul className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-3">
            {sortedOutfits.map((o) => (
              <li key={o.id}>
                <button type="button" onClick={() => assign(o.id)} className="block w-full text-left">
                  <OutfitCollage pieces={o.outfit_items} items={byId} className="rounded-[18px]" />
                  <p className="mt-2 truncate text-[13px] font-semibold">{o.name}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-6 text-center">
            <p className="text-[14px] text-muted">Non hai ancora outfit salvati.</p>
            <Link href="/generate" className="mt-4 inline-block">
              <Button>Crea un outfit</Button>
            </Link>
          </div>
        )}
      </Sheet>
    </div>
  );
}
