"use client";

import { Camera, Copy, Heart, Pencil, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { OutfitCard } from "@/components/outfit/outfit-card";
import { Button } from "@/components/ui/button";
import { ColorDot } from "@/components/ui/color-dot";
import { useConfirm } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemImage } from "@/components/ui/item-image";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemForm, toFormValues, type ItemFormValues } from "@/components/wardrobe/item-form";
import { deleteItem, duplicateItem, setItemFavorite, updateItem } from "@/lib/data/api";
import { refresh, useItems, useOutfits } from "@/lib/data/hooks";
import { prepareImage, validateImageFile } from "@/lib/data/images";
import { FORMALITY_LABELS, label } from "@/lib/domain";
import { clothingItemInputSchema, type ClothingItem } from "@/lib/schemas";
import { cn, errorMessage, formatDate, relativeDays } from "@/lib/utils";

export default function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const { data: items, isLoading, mutate } = useItems();
  const { data: outfits } = useOutfits();
  const item = items?.find((i) => i.id === id);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<ItemFormValues | null>(null);
  const [newImage, setNewImage] = useState<{ blob: Blob; preview: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const usedIn = useMemo(() => (outfits ?? []).filter((o) => o.outfit_items.some((x) => x.item_id === id)), [outfits, id]);

  if (isLoading) {
    return (
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-[4/5] w-full rounded-[28px]" />
        <div className="space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }
  if (!item) {
    return (
      <EmptyState title="Capo non trovato" className="mt-10" action={<Link href="/wardrobe"><Button>Torna al guardaroba</Button></Link>}>
        Potrebbe essere stato eliminato.
      </EmptyState>
    );
  }

  function startEdit(it: ClothingItem) {
    setValues(toFormValues(it));
    setEditing(true);
    setFormError(null);
  }

  async function save() {
    if (!values || !item) return;
    const parsed = clothingItemInputSchema.safeParse(values);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Controlla i dati.");
      return;
    }
    setSaving(true);
    try {
      await updateItem(item.id, values, newImage?.blob);
      await mutate();
      setEditing(false);
      setNewImage(null);
      toast.success("Modifiche salvate");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function pickImage(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) return toast.error(invalid);
    try {
      const prepared = await prepareImage(file);
      setNewImage({ blob: prepared.blob, preview: prepared.previewUrl });
      if (!editing) startEdit(item!);
    } catch (e) {
      toast.error(errorMessage(e, "Impossibile leggere la foto."));
    }
  }

  async function toggleFavorite() {
    setBusy("fav");
    try {
      await setItemFavorite(item!.id, !item!.is_favorite);
      await mutate();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function duplicate() {
    setBusy("dup");
    try {
      const copy = await duplicateItem(item!);
      await mutate();
      toast.success("Capo duplicato");
      router.push(`/wardrobe/${copy.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    const ok = await confirm({
      title: "Eliminare questo capo?",
      message: usedIn.length
        ? `«${item!.name}» verrà rimosso anche da ${usedIn.length} outfit salvati. L'operazione non si può annullare.`
        : `«${item!.name}» verrà eliminato definitivamente.`,
      confirmLabel: "Elimina",
      destructive: true,
    });
    if (!ok) return;
    setBusy("del");
    try {
      await deleteItem(item!);
      await refresh("items", "outfits");
      toast.success("Capo eliminato");
      router.replace("/wardrobe");
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(null);
    }
  }

  const details: [string, React.ReactNode][] = [
    ["Categoria", [label.category(item.category), item.subcategory].filter(Boolean).join(" · ")],
    [
      "Colori",
      <span key="c" className="flex flex-wrap items-center gap-2">
        {[item.primary_color, ...item.secondary_colors].map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <ColorDot color={c} /> {label.color(c)}
          </span>
        ))}
      </span>,
    ],
    ["Materiale", item.material],
    ["Fantasia", label.pattern(item.pattern)],
    ["Stagioni", item.seasons.length ? item.seasons.map(label.season).join(", ") : "Tutte"],
    ["Stile", item.styles.map(label.style).join(", ")],
    ["Vestibilità", label.fit(item.fit)],
    ["Formalità", FORMALITY_LABELS[item.formality]],
    ["Brand", item.brand],
  ];

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => { pickImage(e.target.files); e.target.value = ""; }} />
      <PageHeader back="/wardrobe" eyebrow={label.category(item.category)} title={editing ? "Modifica capo" : item.name} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="relative">
            {newImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- anteprima locale (blob URL)
              <img src={newImage.preview} alt="Nuova foto" className="aspect-[4/5] w-full rounded-[28px] bg-surface-2 object-contain shadow-soft" />
            ) : (
              <ItemImage path={item.image_path} alt={item.name} className="aspect-[4/5] w-full rounded-[28px] shadow-soft" fit="contain" />
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-4 right-4 inline-flex h-10 items-center gap-2 rounded-full bg-surface/90 px-4 text-[12.5px] font-semibold backdrop-blur"
            >
              <Camera className="size-4" /> {item.image_path ? "Cambia foto" : "Aggiungi foto"}
            </button>
          </div>
          {!editing ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[22px] border border-line bg-surface p-4">
                <p className="font-display text-[30px] leading-none">{item.wear_count}</p>
                <p className="mt-1 text-[12px] text-muted">volte indossato</p>
              </div>
              <div className="rounded-[22px] border border-line bg-surface p-4">
                <p className="font-display text-[22px] leading-tight">{relativeDays(item.last_worn_at)}</p>
                <p className="mt-1 text-[12px] text-muted">{item.last_worn_at ? `ultimo uso: ${formatDate(item.last_worn_at)}` : "ultimo utilizzo"}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div>
          {editing && values ? (
            <>
              <ItemForm values={values} onChange={setValues} errors={{ name: formError ?? undefined }} />
              <div className="sticky bottom-24 z-20 mt-8 flex gap-2 rounded-full border border-line bg-bg/90 p-2 backdrop-blur-xl lg:bottom-6">
                <Button variant="secondary" onClick={() => { setEditing(false); setNewImage(null); }}>
                  Annulla
                </Button>
                <Button className="flex-1" loading={saving} onClick={save}>
                  Salva modifiche
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => startEdit(item)}>
                  <Pencil className="size-4" /> Modifica
                </Button>
                <Button variant="secondary" onClick={toggleFavorite} loading={busy === "fav"} aria-pressed={item.is_favorite}>
                  <Heart className={cn("size-4", item.is_favorite && "fill-brown text-brown")} />
                  {item.is_favorite ? "Preferito" : "Preferiti"}
                </Button>
                <Button variant="secondary" onClick={duplicate} loading={busy === "dup"}>
                  <Copy className="size-4" /> Duplica
                </Button>
                <Button variant="danger" onClick={remove} loading={busy === "del"}>
                  <Trash2 className="size-4" /> Elimina
                </Button>
              </div>

              <Link
                href={`/generate?include=${item.id}`}
                className="mt-5 flex items-center justify-between rounded-[22px] bg-olive-soft px-5 py-4 text-[14px] font-semibold text-olive"
              >
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="size-4" /> Crea un outfit con questo capo
                </span>
                <span aria-hidden>→</span>
              </Link>

              <dl className="mt-6 divide-y divide-line rounded-[24px] border border-line bg-surface px-5">
                {details
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-4 py-3.5 text-[14px]">
                      <dt className="w-28 shrink-0 text-muted">{k}</dt>
                      <dd className="min-w-0 flex-1 font-medium">{v}</dd>
                    </div>
                  ))}
              </dl>

              {item.tags.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((t) => (
                    <span key={t} className="rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-soft">
                      #{t}
                    </span>
                  ))}
                </div>
              ) : null}
              {item.notes ? <p className="mt-5 whitespace-pre-line text-[14px] leading-relaxed text-ink-soft">{item.notes}</p> : null}

              <section className="mt-10">
                <h2 className="font-display text-[28px]">Negli outfit</h2>
                {usedIn.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {usedIn.slice(0, 6).map((o, i) => (
                      <OutfitCard key={o.id} outfit={o} items={byId} index={i} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[14px] text-muted">Non è ancora in nessun outfit salvato.</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
