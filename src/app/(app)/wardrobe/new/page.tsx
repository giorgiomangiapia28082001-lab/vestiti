"use client";

import { AlertCircle, Camera, Check, ImagePlus, Loader2, PenLine, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ItemForm, emptyItemValues, toFormValues, type ItemFormValues } from "@/components/wardrobe/item-form";
import { analysisToInput, analyzeGarment, createItem } from "@/lib/data/api";
import { refresh, useAiStatus } from "@/lib/data/hooks";
import { prepareImage, validateImageFile, type PreparedImage } from "@/lib/data/images";
import { label } from "@/lib/domain";
import { clothingItemInputSchema } from "@/lib/schemas";
import { cn, errorMessage } from "@/lib/utils";

type Status = "preparing" | "analyzing" | "ready" | "error" | "saving" | "saved";

interface Entry {
  id: string;
  file: File;
  status: Status;
  prepared?: PreparedImage;
  values: ItemFormValues;
  aiError?: string;
  error?: string;
}

const SINGULAR: Record<string, string> = {
  tshirt_polo: "T-shirt",
  shirt: "Camicia",
  knitwear: "Maglione",
  outerwear: "Giacca",
  trousers: "Pantaloni",
  shorts: "Pantaloncini",
  shoes: "Scarpe",
  accessories: "Accessorio",
  sportswear: "Capo sportivo",
  other: "Capo",
};

export default function NewItemPage() {
  const router = useRouter();
  const { data: aiStatus } = useAiStatus();
  const aiEnabled = Boolean(aiStatus?.enabled);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [current, setCurrent] = useState(0);
  const [manual, setManual] = useState(false);
  const [manualValues, setManualValues] = useState<ItemFormValues>(emptyItemValues());
  const [savingManual, setSavingManual] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  const patch = useCallback((id: string, p: Partial<Entry>) => {
    setEntries((list) => list.map((e) => (e.id === id ? { ...e, ...p } : e)));
  }, []);

  const analyze = useCallback(
    async (id: string, dataUrl: string) => {
      patch(id, { status: "analyzing", aiError: undefined });
      try {
        const { analysis } = await analyzeGarment(dataUrl);
        if (!analysis.is_clothing) {
          patch(id, { status: "ready", aiError: "L'AI non ha riconosciuto un capo in questa foto: controlla i dati." });
          return;
        }
        patch(id, { status: "ready", values: toFormValues(analysisToInput(analysis)) });
      } catch (e) {
        patch(id, { status: "ready", aiError: errorMessage(e) });
      }
    },
    [patch],
  );

  const process = useCallback(
    async (entry: Entry) => {
      try {
        const prepared = await prepareImage(entry.file);
        const values = {
          ...entriesRef.current.find((e) => e.id === entry.id)!.values,
          primary_color: prepared.colors.primary,
          secondary_colors: prepared.colors.secondary,
        };
        patch(entry.id, { prepared, values, status: aiEnabled ? "analyzing" : "ready" });
        if (aiEnabled) await analyze(entry.id, prepared.dataUrl);
      } catch (e) {
        patch(entry.id, {
          status: "error",
          error: `Impossibile leggere questa foto (${errorMessage(e, "formato non supportato")}). Prova a esportarla in JPG.`,
        });
      }
    },
    [aiEnabled, analyze, patch],
  );

  async function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = [...list].slice(0, 20);
    const invalid = files.map(validateImageFile).filter(Boolean);
    invalid.forEach((m) => toast.error(m!));
    const valid = files.filter((f) => !validateImageFile(f));
    const fresh: Entry[] = valid.map((file) => ({ id: crypto.randomUUID(), file, status: "preparing", values: emptyItemValues() }));
    setEntries((prev) => [...prev, ...fresh]);
    entriesRef.current = [...entriesRef.current, ...fresh];
    // Elaborazione con concorrenza limitata a 2.
    const queue = [...fresh];
    const worker = async () => {
      while (queue.length) await process(queue.shift()!);
    };
    await Promise.all([worker(), worker()]);
  }

  // Libera gli URL di anteprima quando la pagina viene chiusa.
  useEffect(
    () => () => entriesRef.current.forEach((e) => e.prepared && URL.revokeObjectURL(e.prepared.previewUrl)),
    [],
  );

  const pending = entries.filter((e) => e.status !== "saved");
  const entry = entries[current];

  function moveToNext(fromIndex: number, list = entriesRef.current) {
    const next = list.findIndex((e, i) => i > fromIndex && e.status !== "saved");
    const any = list.findIndex((e) => e.status !== "saved");
    if (next >= 0) setCurrent(next);
    else if (any >= 0) setCurrent(any);
    else {
      toast.success(list.length > 1 ? `${list.length} capi aggiunti al guardaroba` : "Capo aggiunto al guardaroba");
      refresh("items");
      router.push("/wardrobe");
    }
  }

  async function saveEntry(e: Entry): Promise<boolean> {
    const parsed = clothingItemInputSchema.safeParse(e.values);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Controlla i dati inseriti.");
      return false;
    }
    patch(e.id, { status: "saving" });
    try {
      await createItem(e.values, e.prepared?.blob ?? null);
      patch(e.id, { status: "saved" });
      entriesRef.current = entriesRef.current.map((x) => (x.id === e.id ? { ...x, status: "saved" } : x));
      return true;
    } catch (err) {
      patch(e.id, { status: "ready" });
      toast.error(errorMessage(err));
      return false;
    }
  }

  async function saveCurrent() {
    if (!entry) return;
    setFormError(null);
    if (await saveEntry(entry)) moveToNext(current);
  }

  async function saveAllAnalyzed() {
    for (const e of entriesRef.current) {
      if (e.status === "ready" && e.values.ai_analyzed && e.values.name) await saveEntry(e);
    }
    moveToNext(-1);
  }

  function skip(id: string) {
    const idx = entriesRef.current.findIndex((e) => e.id === id);
    const removed = entriesRef.current[idx];
    if (removed?.prepared) URL.revokeObjectURL(removed.prepared.previewUrl);
    const list = entriesRef.current.filter((e) => e.id !== id);
    entriesRef.current = list;
    setEntries(list);
    if (!list.some((e) => e.status !== "saved")) {
      if (list.length) moveToNext(-1, list);
      else setCurrent(0);
    } else setCurrent(Math.max(0, Math.min(idx, list.length - 1)));
  }

  async function saveManual() {
    setFormError(null);
    const parsed = clothingItemInputSchema.safeParse(manualValues);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Controlla i dati inseriti.");
      return;
    }
    setSavingManual(true);
    try {
      await createItem(manualValues, null);
      toast.success("Capo aggiunto al guardaroba");
      refresh("items");
      router.push("/wardrobe");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingManual(false);
    }
  }

  const inputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );

  // ---- Inserimento manuale senza foto ----
  if (manual) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader back eyebrow="Nuovo capo" title="Inserimento manuale" subtitle="Potrai aggiungere la foto in seguito." />
        <ItemForm values={manualValues} onChange={setManualValues} errors={{ name: formError ?? undefined }} />
        <StickyActions>
          <Button variant="secondary" onClick={() => setManual(false)}>
            Annulla
          </Button>
          <Button className="flex-1" size="lg" loading={savingManual} onClick={saveManual}>
            Salva nel guardaroba
          </Button>
        </StickyActions>
      </div>
    );
  }

  // ---- Selezione delle foto ----
  if (pending.length === 0 || !entry) {
    return (
      <div className="mx-auto max-w-2xl">
        {inputs}
        <PageHeader back eyebrow="Nuovo capo" title="Aggiungi al guardaroba" subtitle="Una foto per capo, su uno sfondo il più possibile neutro." />
        <div className="grid animate-fade-up gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="group flex min-h-56 flex-col justify-between rounded-[28px] bg-ink p-6 text-left text-bg shadow-lift transition-transform active:scale-[0.99]"
          >
            <Camera className="size-7" strokeWidth={1.4} />
            <div>
              <p className="font-display text-[32px] leading-none">Scatta una foto</p>
              <p className="mt-2 text-[13px] opacity-70">Usa la fotocamera del telefono.</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex min-h-56 flex-col justify-between rounded-[28px] border border-line bg-surface p-6 text-left shadow-soft transition-transform active:scale-[0.99]"
          >
            <ImagePlus className="size-7" strokeWidth={1.4} />
            <div>
              <p className="font-display text-[32px] leading-none">Dalla galleria</p>
              <p className="mt-2 text-[13px] text-muted">Puoi selezionare più foto insieme (fino a 20).</p>
            </div>
          </button>
        </div>
        <div className="mt-6 flex items-start gap-3 rounded-[22px] bg-surface-2 p-4 text-[13px] text-muted">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-olive" />
          {aiEnabled
            ? "L'AI riconoscerà categoria, colori, materiale, fantasia, stile e stagione: dovrai solo confermare."
            : "Il riconoscimento AI non è configurato: i colori verranno estratti dalla foto e compilerai tu gli altri dati."}
        </div>
        <button
          type="button"
          onClick={() => setManual(true)}
          className="mt-4 inline-flex items-center gap-2 py-2 text-[13.5px] font-semibold text-muted hover:text-ink"
        >
          <PenLine className="size-4" /> Inserisci senza foto
        </button>
      </div>
    );
  }

  // ---- Revisione ----
  const position = entries.filter((e) => e.status !== "saved").indexOf(entry) + 1;
  const busy = entry.status === "preparing" || entry.status === "analyzing";
  const analyzedReady = entries.filter((e) => e.status === "ready" && e.values.ai_analyzed).length;

  return (
    <div className="mx-auto max-w-5xl">
      {inputs}
      <PageHeader
        back
        eyebrow={pending.length > 1 ? `Capo ${position} di ${pending.length}` : "Nuovo capo"}
        title="Controlla e conferma"
        actions={
          <Button variant="secondary" size="sm" onClick={() => galleryRef.current?.click()}>
            <ImagePlus className="size-4" /> Altre foto
          </Button>
        }
      />

      {entries.length > 1 ? (
        <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Foto da rivedere">
          {entries.map((e, i) => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={i === current}
              disabled={e.status === "saved"}
              onClick={() => setCurrent(i)}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-2xl bg-surface-2 ring-2 transition-all",
                i === current ? "ring-ink" : "ring-transparent",
                e.status === "saved" && "opacity-40",
              )}
            >
              {e.prepared ? (
                // eslint-disable-next-line @next/next/no-img-element -- anteprima locale (blob URL)
                <img src={e.prepared.previewUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
              <span className="absolute inset-0 grid place-items-center">
                {e.status === "saved" ? (
                  <Check className="size-5 rounded-full bg-olive p-0.5 text-white" />
                ) : e.status === "preparing" || e.status === "analyzing" ? (
                  <Loader2 className="size-5 animate-spin text-ink" />
                ) : e.status === "error" ? (
                  <AlertCircle className="size-5 text-danger" />
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-surface-2 shadow-soft">
            {entry.prepared ? (
              // eslint-disable-next-line @next/next/no-img-element -- anteprima locale (blob URL)
              <img src={entry.prepared.previewUrl} alt="Anteprima del capo" className="h-full w-full object-contain" />
            ) : (
              <div className="skeleton absolute inset-0" />
            )}
            {busy ? (
              <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-2xl bg-surface/90 px-4 py-3 text-[13px] font-semibold backdrop-blur" role="status">
                <Loader2 className="size-4 animate-spin" />
                {entry.status === "preparing" ? "Ottimizzo la foto…" : "L'AI sta riconoscendo il capo…"}
              </div>
            ) : entry.values.ai_analyzed ? (
              <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1.5 text-[12px] font-semibold text-olive backdrop-blur">
                <Sparkles className="size-3.5" /> Riconosciuto dall&apos;AI
              </div>
            ) : null}
          </div>
          {entry.status === "error" ? (
            <p className="mt-4 rounded-2xl bg-danger/10 p-4 text-[13.5px] text-danger" role="alert">
              {entry.error}
            </p>
          ) : null}
          {entry.aiError ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-surface-2 p-4 text-[13px] text-ink-soft" role="status">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-brown" />
              <div className="flex-1">
                <p>{entry.aiError}</p>
                <p className="mt-1 text-muted">Puoi compilare i dati manualmente.</p>
              </div>
            </div>
          ) : null}
          {aiEnabled && entry.prepared && !busy ? (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => analyze(entry.id, entry.prepared!.dataUrl)}>
              <Sparkles className="size-4" /> {entry.values.ai_analyzed ? "Analizza di nuovo" : "Riconosci con l'AI"}
            </Button>
          ) : null}
        </div>

        <div className={cn("transition-opacity", busy && "pointer-events-none opacity-50")} aria-busy={busy}>
          {entry.status !== "error" ? (
            <ItemForm
              values={entry.values}
              onChange={(values) => patch(entry.id, { values })}
              errors={{ name: formError ?? undefined }}
            />
          ) : null}
        </div>
      </div>

      <StickyActions>
        <Button variant="secondary" onClick={() => skip(entry.id)} aria-label="Scarta questa foto">
          <X className="size-4" /> <span className="hidden sm:inline">Scarta</span>
        </Button>
        {analyzedReady > 1 ? (
          <Button variant="secondary" onClick={saveAllAnalyzed} aria-label={`Salva tutti i ${analyzedReady} capi riconosciuti`}>
            <span className="sm:hidden">Tutti ({analyzedReady})</span>
            <span className="hidden sm:inline">Salva tutti i riconosciuti ({analyzedReady})</span>
          </Button>
        ) : null}
        <Button
          className="flex-1"
          size="lg"
          disabled={busy || entry.status === "error"}
          loading={entry.status === "saving"}
          onClick={() => {
            if (!entry.values.name.trim()) {
              patch(entry.id, {
                values: {
                  ...entry.values,
                  name: `${SINGULAR[entry.values.category]} ${label.color(entry.values.primary_color).toLowerCase()}`,
                },
              });
              setFormError("Ti ho suggerito un nome: modificalo se vuoi, poi salva.");
              return;
            }
            saveCurrent();
          }}
        >
          {pending.length > 1 ? "Salva e continua" : "Salva nel guardaroba"}
        </Button>
      </StickyActions>
    </div>
  );
}

function StickyActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-30 -mx-4 mt-10 flex gap-2 border-t border-line bg-bg/90 px-4 py-3 backdrop-blur-xl pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:mx-0 sm:rounded-full sm:border sm:px-3 lg:bottom-6">
      {children}
    </div>
  );
}
