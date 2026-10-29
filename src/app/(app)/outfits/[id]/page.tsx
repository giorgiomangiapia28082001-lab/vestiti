"use client";

import { CalendarPlus, Check, Copy, Heart, Pencil, Plus, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { ItemPicker } from "@/components/generator/item-picker";
import { OutfitCollage } from "@/components/outfit/outfit-collage";
import { SwapSheet } from "@/components/outfit/swap-sheet";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ItemImage } from "@/components/ui/item-image";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StarRating } from "@/components/ui/star-rating";
import {
  deleteOutfit,
  duplicateOutfit,
  markOutfitWorn,
  planOutfit,
  replaceOutfitPieces,
  updateOutfit,
} from "@/lib/data/api";
import { refresh, useHistory, useItems, useOutfits } from "@/lib/data/hooks";
import { useTasteAndFeedback } from "@/lib/data/use-engine";
import { OCCASION_VALUES, STYLE_VALUES, currentSeason, label, type Role } from "@/lib/domain";
import { buildAffinity, scoreOutfit, scoreToPercent, sortPieces, validateItemIds } from "@/lib/engine";
import { generateRequestSchema, type OutfitPiece } from "@/lib/schemas";
import { shareOutfit } from "@/lib/share";
import { cn, errorMessage, formatDate, isoDate } from "@/lib/utils";

export default function OutfitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const { data: outfits, isLoading, mutate } = useOutfits();
  const { data: items } = useItems();
  const { data: history } = useHistory();
  const { taste, feedback } = useTasteAndFeedback();
  const outfit = outfits?.find((o) => o.id === id);

  const [swapTarget, setSwapTarget] = useState<OutfitPiece | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [wornOpen, setWornOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState<string | null>(null);
  const [date, setDate] = useState(isoDate());
  const [wornNote, setWornNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const pieces = useMemo(
    () => sortPieces((outfit?.outfit_items ?? []).filter((p) => byId.has(p.item_id)).map((p) => ({ item_id: p.item_id, role: p.role }))),
    [outfit, byId],
  );
  const ctx = useMemo(
    () => ({
      request: generateRequestSchema.parse({
        occasion: OCCASION_VALUES.find((o) => o === outfit?.occasion) ?? "everyday",
        season: outfit?.season ?? currentSeason(),
        style: STYLE_VALUES.find((s) => s === outfit?.style) ?? null,
      }),
      taste,
      feedback,
    }),
    [outfit, taste, feedback],
  );
  const wornDates = (history ?? []).filter((h) => h.outfit_id === id);

  if (isLoading) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-[4/5] w-full rounded-[28px]" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!outfit) {
    return (
      <EmptyState title="Outfit non trovato" className="mt-10" action={<Link href="/outfits"><Button>I miei outfit</Button></Link>}>
        Potrebbe essere stato eliminato.
      </EmptyState>
    );
  }
  const current = outfit;
  const score = scoreToPercent(scoreOutfit(pieces, byId, ctx, buildAffinity(feedback)).score);
  const missingCount = current.outfit_items.length - pieces.length;

  async function run(key: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(key);
    try {
      await fn();
      await mutate();
      if (success) toast.success(success);
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function changePieces(next: OutfitPiece[]) {
    await run("pieces", () => replaceOutfitPieces(current.id, next), "Outfit aggiornato");
  }

  async function addItems(ids: string[]) {
    const extra = ids.filter((x) => !pieces.some((p) => p.item_id === x));
    if (!extra.length) return;
    const check = validateItemIds([...pieces.map((p) => p.item_id), ...extra], byId);
    if (!check.ok) {
      toast.error(`Non posso aggiungerlo: ${check.reason}. Usa «sostituisci» toccando il capo da cambiare.`);
      return;
    }
    setAddOpen(false);
    await changePieces(check.pieces);
  }

  async function share() {
    setBusy("share");
    try {
      const result = await shareOutfit(current.name, current.description, pieces, byId);
      if (result === "downloaded") toast.success("Immagine dell'outfit scaricata");
      if (result === "copied") toast.success("Descrizione copiata negli appunti");
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") toast.error("Condivisione non riuscita.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Eliminare questo outfit?",
      message: "Verrà rimosso anche dalla cronologia e dal calendario. I capi restano nel guardaroba.",
      confirmLabel: "Elimina",
      destructive: true,
    });
    if (!ok) return;
    setBusy("delete");
    try {
      await deleteOutfit(current.id);
      await refresh("outfits", "history", "planned");
      toast.success("Outfit eliminato");
      router.replace("/outfits");
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  }

  const optionalRoles: Role[] = ["outer", "accessory", "mid"];

  return (
    <div>
      <PageHeader
        back
        eyebrow={[label.occasion(current.occasion), label.season(current.season)].filter(Boolean).join(" · ") || "Outfit"}
        title={current.name}
        subtitle={`${score}% di armonia · ${current.source === "ai" ? "creato dallo stylist AI" : current.source === "manual" ? "modificato da te" : "creato dal motore di stile"}`}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <OutfitCollage pieces={pieces} items={byId} showLabels onPieceClick={setSwapTarget} className="shadow-lift" />
          <p className="mt-3 text-center text-[12.5px] text-muted">Tocca un capo per sostituirlo mantenendo il resto.</p>
          {missingCount > 0 ? (
            <p className="mt-2 text-center text-[12.5px] text-brown">{missingCount} capi di questo outfit sono stati eliminati dal guardaroba.</p>
          ) : null}
        </div>

        <div className="space-y-8">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setWornOpen(true)}>
              <Check className="size-4" /> Segna come indossato
            </Button>
            <Button
              variant="secondary"
              aria-pressed={current.is_favorite}
              loading={busy === "fav"}
              onClick={() => run("fav", () => updateOutfit(current.id, { is_favorite: !current.is_favorite }))}
            >
              <Heart className={cn("size-4", current.is_favorite && "fill-brown text-brown")} />
              {current.is_favorite ? "Preferito" : "Salva nei preferiti"}
            </Button>
            <Button variant="secondary" onClick={() => setPlanOpen(true)}>
              <CalendarPlus className="size-4" /> Pianifica
            </Button>
            <Button variant="secondary" onClick={share} loading={busy === "share"}>
              <Share2 className="size-4" /> Condividi
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-[22px] border border-line bg-surface px-5 py-3">
            <span className="text-[13.5px] font-semibold">La tua valutazione</span>
            <StarRating value={current.rating} onChange={(v) => run("rating", () => updateOutfit(current.id, { rating: v }))} />
          </div>

          {current.description ? <p className="text-[15px] leading-relaxed text-ink-soft">{current.description}</p> : null}
          {current.color_story ? (
            <div className="rounded-[22px] bg-surface-2 p-5">
              <p className="eyebrow mb-2">Perché funziona</p>
              <p className="text-[14px] leading-relaxed text-ink-soft">{current.color_story}</p>
            </div>
          ) : null}
          {current.tips.length ? (
            <div>
              <p className="eyebrow mb-3">Come indossarlo</p>
              <ul className="space-y-2.5">
                {current.tips.map((t) => (
                  <li key={t} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-soft">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-olive" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[28px]">I capi</h2>
              <Button variant="ghost" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" /> Aggiungi
              </Button>
            </div>
            <ul className="divide-y divide-line rounded-[24px] border border-line bg-surface">
              {pieces.map((p) => {
                const it = byId.get(p.item_id)!;
                return (
                  <li key={p.item_id} className="flex items-center gap-3 p-3">
                    <Link href={`/wardrobe/${it.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <ItemImage path={it.image_path} alt="" className="size-14 shrink-0 rounded-2xl" />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold">{it.name}</span>
                        <span className="block text-[12px] text-muted">
                          {label.role(p.role)} · {it.brand || label.category(it.category)}
                        </span>
                      </span>
                    </Link>
                    <Button variant="secondary" size="sm" onClick={() => setSwapTarget(p)}>
                      Cambia
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>

          <Field label="Note personali" htmlFor="notes">
            <Textarea
              id="notes"
              value={notes ?? current.notes ?? ""}
              maxLength={1000}
              placeholder="Es. perfetto con il sole, da provare con la cintura marrone…"
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== null && notes !== (current.notes ?? "")) run("notes", () => updateOutfit(current.id, { notes: notes || null }), "Note salvate");
              }}
            />
          </Field>

          {wornDates.length ? (
            <section>
              <p className="eyebrow mb-3">Indossato</p>
              <ul className="space-y-2">
                {wornDates.map((h) => (
                  <li key={h.id} className="rounded-2xl bg-surface-2 px-4 py-3 text-[13.5px]">
                    <span className="font-semibold">{formatDate(h.worn_on)}</span>
                    {h.notes ? <span className="text-muted"> · {h.notes}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-line pt-6">
            <Button
              variant="ghost"
              onClick={() => {
                setName(current.name);
                setRenaming(true);
              }}
            >
              <Pencil className="size-4" /> Rinomina
            </Button>
            <Button
              variant="ghost"
              loading={busy === "dup"}
              onClick={async () => {
                setBusy("dup");
                try {
                  const newId = await duplicateOutfit(current);
                  await mutate();
                  toast.success("Variante creata: modificala come preferisci");
                  router.push(`/outfits/${newId}`);
                } catch (e) {
                  toast.error(errorMessage(e));
                } finally {
                  setBusy(null);
                }
              }}
            >
              <Copy className="size-4" /> Duplica e modifica
            </Button>
            <Button variant="ghost" className="text-danger" onClick={remove} loading={busy === "delete"}>
              <Trash2 className="size-4" /> Elimina
            </Button>
          </div>
        </div>
      </div>

      <SwapSheet
        open={Boolean(swapTarget)}
        onOpenChange={(o) => !o && setSwapTarget(null)}
        pieces={pieces}
        target={swapTarget}
        items={items ?? []}
        ctx={ctx}
        onPick={(itemId) => {
          const t = swapTarget!;
          setSwapTarget(null);
          changePieces(pieces.map((p) => (p.item_id === t.item_id ? { ...p, item_id: itemId } : p)));
        }}
        onRemove={
          swapTarget && optionalRoles.includes(swapTarget.role)
            ? () => {
                const t = swapTarget;
                setSwapTarget(null);
                changePieces(pieces.filter((p) => p.item_id !== t.item_id));
              }
            : undefined
        }
      />

      <ItemPicker
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Aggiungi capi"
        description="Ad esempio un capospalla o un accessorio."
        items={(items ?? []).filter((i) => ["outer", "accessory", "shoes"].includes(i.slot) || i.category === "knitwear")}
        selected={[]}
        onChange={(ids) => addItems(ids)}
        disabledIds={pieces.map((p) => p.item_id)}
      />

      <Sheet
        open={wornOpen}
        onOpenChange={setWornOpen}
        title="Segna come indossato"
        description="Aggiorna la cronologia e la data di ultimo utilizzo dei capi."
        footer={
          <Button
            className="w-full"
            loading={busy === "worn"}
            onClick={async () => {
              const ok = await run("worn", () => markOutfitWorn(current.id, date, wornNote), "Segnato come indossato");
              if (ok) {
                setWornOpen(false);
                setWornNote("");
                refresh("history", "items");
              }
            }}
          >
            Conferma
          </Button>
        }
      >
        <div className="space-y-5 pt-2">
          <Field label="Data" htmlFor="worn-date">
            <Input id="worn-date" type="date" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Nota (facoltativa)" htmlFor="worn-note">
            <Input id="worn-note" value={wornNote} maxLength={300} placeholder="Es. cena di lavoro" onChange={(e) => setWornNote(e.target.value)} />
          </Field>
        </div>
      </Sheet>

      <Sheet
        open={planOpen}
        onOpenChange={setPlanOpen}
        title="Pianifica outfit"
        description="Sostituisce l'eventuale outfit già previsto per quel giorno."
        footer={
          <Button
            className="w-full"
            loading={busy === "plan"}
            onClick={async () => {
              const ok = await run("plan", () => planOutfit(current.id, date), `Pianificato per ${formatDate(date)}`);
              if (ok) {
                setPlanOpen(false);
                refresh("planned");
              }
            }}
          >
            Aggiungi al calendario
          </Button>
        }
      >
        <Field label="Giorno" htmlFor="plan-date" className="pt-2">
          <Input id="plan-date" type="date" value={date} min={isoDate()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </Sheet>

      <Sheet
        open={renaming}
        onOpenChange={setRenaming}
        title="Rinomina outfit"
        footer={
          <Button
            className="w-full"
            disabled={!name.trim()}
            loading={busy === "name"}
            onClick={async () => {
              if (await run("name", () => updateOutfit(current.id, { name: name.trim().slice(0, 80) }))) setRenaming(false);
            }}
          >
            Salva
          </Button>
        }
      >
        <Input className="mt-2" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} aria-label="Nome dell'outfit" />
      </Sheet>
    </div>
  );
}
