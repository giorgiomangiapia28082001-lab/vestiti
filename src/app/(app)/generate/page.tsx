"use client";

import { ChevronDown, LocateFixed, Plus, Sparkles, Wand2, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { GeneratedCard } from "@/components/generator/generated-card";
import { ItemPicker } from "@/components/generator/item-picker";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Chip, ChipGroup } from "@/components/ui/chip";
import { ColorDot } from "@/components/ui/color-dot";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input } from "@/components/ui/field";
import { ItemImage } from "@/components/ui/item-image";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { generateOutfits } from "@/lib/data/api";
import { useAiStatus, useItems } from "@/lib/data/hooks";
import { useTasteAndFeedback } from "@/lib/data/use-engine";
import {
  COLORS,
  FORMALITY_LABELS,
  OCCASIONS,
  SEASONS,
  STYLES,
  currentSeason,
  type ColorName,
  type Occasion,
  type Season,
  type Style,
} from "@/lib/domain";
import { targetFormality } from "@/lib/engine";
import { generateRequestSchema, type GeneratedOutfit, type GenerateRequest } from "@/lib/schemas";
import { errorMessage } from "@/lib/utils";
import { useWeather, type WeatherKind } from "@/lib/weather";

const WEATHER = [
  { value: "clear", label: "Sereno" },
  { value: "cloudy", label: "Nuvoloso" },
  { value: "rain", label: "Pioggia" },
  { value: "snow", label: "Neve" },
  { value: "wind", label: "Vento" },
] as const;

/** Seme casuale a ogni richiesta: varia le combinazioni proposte. */
const newSeed = () => Math.floor(Math.random() * 1e9);

const SEASON_OPTIONS = SEASONS.map((s) => ({ value: s.value, label: s.label }));

function GeneratorInner() {
  const params = useSearchParams();
  const { data: items, isLoading } = useItems();
  const { data: aiStatus } = useAiStatus();
  const { taste, feedback } = useTasteAndFeedback();
  const { weather, status: weatherStatus, enable: enableWeather } = useWeather();

  const initialSeason = (SEASONS.some((s) => s.value === params.get("season")) ? params.get("season") : currentSeason()) as Season;
  const initialTemp = params.get("temp");
  const [occasion, setOccasion] = useState<Occasion>("everyday");
  const [style, setStyle] = useState<Style | "custom" | null>(null);
  const [customStyle, setCustomStyle] = useState("");
  const [season, setSeason] = useState<Season>(initialSeason);
  const [temperature, setTemperature] = useState<string>(initialTemp ?? "");
  const [weatherKind, setWeatherKind] = useState<WeatherKind | null>((params.get("weather") as WeatherKind) ?? null);
  const [formality, setFormality] = useState<number | null>(null);
  const [preferred, setPreferred] = useState<ColorName[]>([]);
  const [avoid, setAvoid] = useState<ColorName[]>([]);
  const [include, setInclude] = useState<string[]>(params.get("include") ? [params.get("include")!] : []);
  const [exclude, setExclude] = useState<string[]>([]);
  const [rediscover, setRediscover] = useState(false);
  const [useAi, setUseAi] = useState(true);
  const [advanced, setAdvanced] = useState(Boolean(params.get("include")));
  const [picker, setPicker] = useState<"include" | "exclude" | null>(null);

  const [results, setResults] = useState<GeneratedOutfit[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [aiUsed, setAiUsed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<GenerateRequest | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);

  function buildRequest(extra: Partial<GenerateRequest> = {}): GenerateRequest {
    const seed = newSeed();
    const t = temperature.trim() === "" ? null : Number(temperature);
    return generateRequestSchema.parse({
      occasion,
      style: style && style !== "custom" ? style : null,
      custom_style: style === "custom" ? customStyle : null,
      season,
      temperature: t !== null && Number.isFinite(t) ? t : null,
      weather: weatherKind,
      formality,
      preferred_colors: preferred,
      avoid_colors: avoid,
      include_item_ids: include.filter((id) => byId.has(id)),
      exclude_item_ids: exclude.filter((id) => byId.has(id)),
      rediscover,
      count: 4,
      seed,
      use_ai: useAi && Boolean(aiStatus?.enabled),
      ...extra,
    });
  }

  // Contesto del motore usato per valutare le sostituzioni dei capi.
  const ctx = useMemo(
    () => ({ request: lastRequest ?? generateRequestSchema.parse({ season: currentSeason() }), taste, feedback }),
    [lastRequest, taste, feedback],
  );

  const combos = (list: GeneratedOutfit[]) => list.map((o) => o.pieces.map((p) => p.item_id));

  async function run() {
    const req = buildRequest();
    setLoading(true);
    setNotices([]);
    try {
      const res = await generateOutfits(req);
      setLastRequest(req);
      setResults(res.outfits);
      setNotices(res.notices);
      setAiUsed(res.ai.used);
      if (!res.outfits.length) toast.error("Nessun outfit possibile con questi parametri.");
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function more() {
    if (!lastRequest) return;
    setLoadingMore(true);
    try {
      const req = buildRequest({ avoid_combos: combos(results).slice(-40) });
      const res = await generateOutfits(req);
      if (!res.outfits.length) toast("Hai visto tutte le combinazioni migliori per questi parametri.");
      setResults((prev) => [...prev, ...res.outfits.map((o) => ({ ...o, key: `${o.key}-${req.seed}` }))]);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }

  async function regenerate(key: string) {
    if (!lastRequest) return;
    setRegenerating(key);
    try {
      const req = buildRequest({ count: 1, avoid_combos: combos(results).slice(-40) });
      const res = await generateOutfits(req);
      const next = res.outfits[0];
      if (!next) toast("Non ci sono altre combinazioni valide per questi parametri.");
      else setResults((prev) => prev.map((o) => (o.key === key ? { ...next, key: `${next.key}-${req.seed}` } : o)));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRegenerating(null);
    }
  }

  function applyWeather() {
    if (weather) {
      setTemperature(String(weather.apparent));
      setWeatherKind(weather.kind);
    } else enableWeather();
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-96 w-full rounded-[28px]" />
      </div>
    );
  }

  if (!items?.length) {
    return (
      <>
        <PageHeader eyebrow="Outfit generator" title="Il tuo stylist" />
        <EmptyState
          icon={<Wand2 className="size-7" strokeWidth={1.4} />}
          title="Prima servono i tuoi capi"
          action={
            <Link href="/wardrobe/new">
              <Button size="lg">
                <Plus className="size-4" /> Aggiungi capi
              </Button>
            </Link>
          }
        >
          Lo stylist usa solo vestiti che possiedi davvero. Aggiungi almeno una parte superiore, una inferiore e un paio
          di scarpe.
        </EmptyState>
      </>
    );
  }

  const autoFormality = targetFormality(
    generateRequestSchema.parse({ occasion, season, style: style && style !== "custom" ? style : null }),
  );

  return (
    <div>
      <PageHeader
        eyebrow="Outfit generator"
        title="Il tuo stylist"
        subtitle={
          aiStatus?.enabled
            ? "Combina i tuoi capi con l'AI e con regole di stile: colori, proporzioni, stagione e formalità."
            : "Il motore di stile combina i tuoi capi con regole su colori, proporzioni, stagione e formalità."
        }
      />

      <div className="grid gap-10 xl:grid-cols-[400px_minmax(0,1fr)]">
        <section aria-label="Preferenze" className="space-y-7 xl:sticky xl:top-8 xl:max-h-[calc(100dvh-4rem)] xl:self-start xl:overflow-y-auto xl:pr-2">
          <Field label="Occasione">
            <ChipGroup label="Occasione" multiple={false} options={OCCASIONS} value={[occasion]} onChange={(v) => v[0] && setOccasion(v[0])} size="sm" />
          </Field>

          <Field label="Stile">
            <ChipGroup
              label="Stile"
              multiple={false}
              size="sm"
              options={[...STYLES, { value: "custom" as const, label: "Personalizzato" }]}
              value={style ? [style] : []}
              onChange={(v) => setStyle((v[0] as Style | "custom") ?? null)}
            />
            {style === "custom" ? (
              <Input className="mt-2" placeholder="Es. parigino, preppy, workwear…" value={customStyle} maxLength={80} onChange={(e) => setCustomStyle(e.target.value)} />
            ) : null}
          </Field>

          <Field label="Stagione">
            <Segmented options={SEASON_OPTIONS} value={season} onChange={setSeason} />
          </Field>

          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <Field label="Temperatura (°C)" htmlFor="temp">
              <Input id="temp" inputMode="numeric" type="number" min={-30} max={50} value={temperature} placeholder="Facoltativa" onChange={(e) => setTemperature(e.target.value)} />
            </Field>
            <Button variant="secondary" className="h-12" onClick={applyWeather} loading={weatherStatus === "loading"} disabled={weatherStatus === "denied"}>
              <LocateFixed className="size-4" /> Meteo
            </Button>
          </div>

          <Field label="Condizioni">
            <ChipGroup label="Condizioni meteo" multiple={false} size="sm" options={WEATHER} value={weatherKind ? [weatherKind] : []} onChange={(v) => setWeatherKind(v[0] ?? null)} />
          </Field>

          <Field label={`Formalità · ${formality ? FORMALITY_LABELS[formality] : `automatica (${FORMALITY_LABELS[autoFormality].toLowerCase()})`}`} htmlFor="formality">
            <input
              id="formality"
              type="range"
              min={1}
              max={5}
              value={formality ?? autoFormality}
              onChange={(e) => setFormality(Number(e.target.value))}
              className="w-full accent-[var(--olive)]"
            />
            {formality ? (
              <button type="button" className="text-[12px] font-semibold text-muted hover:text-ink" onClick={() => setFormality(null)}>
                Torna automatica
              </button>
            ) : null}
          </Field>

          <button
            type="button"
            onClick={() => setAdvanced(!advanced)}
            aria-expanded={advanced}
            className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5 text-[14px] font-semibold"
          >
            Colori e capi specifici
            <ChevronDown className={`size-4 transition-transform ${advanced ? "rotate-180" : ""}`} />
          </button>

          {advanced ? (
            <div className="animate-fade-up space-y-7">
              <Field label="Colori preferiti">
                <ColorChips value={preferred} onChange={setPreferred} disabled={avoid} />
              </Field>
              <Field label="Colori da evitare">
                <ColorChips value={avoid} onChange={setAvoid} disabled={preferred} />
              </Field>
              <PickedItems title="Capi da includere" ids={include} byId={byId} onOpen={() => setPicker("include")} onRemove={(id) => setInclude(include.filter((x) => x !== id))} />
              <PickedItems title="Capi da escludere" ids={exclude} byId={byId} onOpen={() => setPicker("exclude")} onRemove={(id) => setExclude(exclude.filter((x) => x !== id))} />
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-4 py-3.5">
                <span>
                  <span className="block text-[14px] font-semibold">Valorizza capi dimenticati</span>
                  <span className="block text-[12.5px] text-muted">Dà priorità a ciò che indossi poco.</span>
                </span>
                <input type="checkbox" checked={rediscover} onChange={(e) => setRediscover(e.target.checked)} className="size-5 accent-[var(--olive)]" />
              </label>
            </div>
          ) : null}

          {aiStatus?.enabled ? (
            <label className="flex items-center justify-between gap-4 rounded-2xl bg-olive-soft px-4 py-3.5">
              <span className="flex items-center gap-2 text-[14px] font-semibold text-olive">
                <Sparkles className="size-4" /> Usa lo stylist AI
              </span>
              <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} className="size-5 accent-[var(--olive)]" />
            </label>
          ) : (
            <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[12.5px] text-muted">
              Stylist AI non configurato: le proposte sono create dal motore di stile deterministico.
            </p>
          )}

          <div className="sticky bottom-20 z-20 -mx-1 lg:bottom-4">
            <Button size="lg" className="h-14 w-full text-[15px]" onClick={run} loading={loading}>
              <Wand2 className="size-5" /> {results.length ? "Genera di nuovo" : "Genera outfit"}
            </Button>
          </div>
        </section>

        <section ref={resultsRef} aria-label="Proposte" aria-busy={loading} className="min-w-0 scroll-mt-4">
          {notices.length ? (
            <ul className="mb-5 space-y-2" role="status">
              {notices.map((n) => (
                <li key={n} className="rounded-2xl border border-sand bg-surface px-4 py-3 text-[13.5px] text-ink-soft">
                  {n}
                </li>
              ))}
            </ul>
          ) : null}

          {loading ? (
            <div className="space-y-5">
              {[0, 1].map((i) => (
                <div key={i} className="grid gap-5 rounded-[32px] border border-line bg-surface p-4 sm:grid-cols-2">
                  <Skeleton className="aspect-[4/5] w-full rounded-[24px]" />
                  <div className="space-y-3 py-2">
                    <Skeleton className="h-3 w-24 rounded-full" />
                    <Skeleton className="h-9 w-3/4" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                </div>
              ))}
              <p className="text-center text-[13px] text-muted">
                {useAi && aiStatus?.enabled ? "Lo stylist AI sta componendo i tuoi outfit…" : "Sto combinando i tuoi capi…"}
              </p>
            </div>
          ) : results.length ? (
            <div className="space-y-5">
              {aiUsed === false && useAi && aiStatus?.enabled ? (
                <p className="text-[12.5px] text-muted">Proposte create dal motore di stile.</p>
              ) : null}
              {results.map((o, i) => (
                <GeneratedCard
                  key={o.key}
                  outfit={o}
                  items={items}
                  byId={byId}
                  ctx={ctx}
                  index={i}
                  onRegenerate={() => regenerate(o.key)}
                  regenerating={regenerating === o.key}
                />
              ))}
              <Button variant="secondary" size="lg" className="w-full" onClick={more} loading={loadingMore}>
                Mostra altre combinazioni
              </Button>
            </div>
          ) : (
            <div className="hidden rounded-[32px] border border-dashed border-sand p-10 text-center xl:block">
              <Wand2 className="mx-auto size-8 text-sand" strokeWidth={1.3} />
              <p className="mt-4 font-display text-[28px]">Le tue proposte appariranno qui</p>
              <p className="mt-2 text-[14px] text-muted">Imposta le preferenze e tocca «Genera outfit».</p>
            </div>
          )}
        </section>
      </div>

      <ItemPicker
        open={picker === "include"}
        onOpenChange={(o) => !o && setPicker(null)}
        title="Capi da includere"
        description="Lo stylist li userà in ogni proposta (massimo 6)."
        items={items}
        selected={include}
        onChange={setInclude}
        max={6}
        disabledIds={exclude}
      />
      <ItemPicker
        open={picker === "exclude"}
        onOpenChange={(o) => !o && setPicker(null)}
        title="Capi da escludere"
        description="Non verranno usati nelle proposte."
        items={items}
        selected={exclude}
        onChange={setExclude}
        disabledIds={include}
      />
    </div>
  );
}

function ColorChips({ value, onChange, disabled }: { value: ColorName[]; onChange: (v: ColorName[]) => void; disabled: ColorName[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.filter((c) => !disabled.includes(c.value)).map((c) => (
        <Chip key={c.value} size="sm" selected={value.includes(c.value)} onClick={() => onChange(value.includes(c.value) ? value.filter((x) => x !== c.value) : [...value, c.value])}>
          <ColorDot color={c.value} /> {c.label}
        </Chip>
      ))}
    </div>
  );
}

function PickedItems({
  title,
  ids,
  byId,
  onOpen,
  onRemove,
}: {
  title: string;
  ids: string[];
  byId: Map<string, { name: string; image_path: string | null }>;
  onOpen: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Field label={title}>
      <div className="flex flex-wrap gap-2">
        {ids
          .filter((id) => byId.has(id))
          .map((id) => {
            const it = byId.get(id)!;
            return (
              <span key={id} className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface pl-1 pr-1.5">
                <ItemImage path={it.image_path} alt="" className="size-9 rounded-full" />
                <span className="max-w-32 truncate text-[12.5px] font-medium">{it.name}</span>
                <button type="button" onClick={() => onRemove(id)} aria-label={`Rimuovi ${it.name}`} className="grid size-7 place-items-center rounded-full hover:bg-surface-2">
                  <X className="size-3.5" />
                </button>
              </span>
            );
          })}
        <Button variant="secondary" size="sm" className="h-11" onClick={onOpen}>
          <Plus className="size-4" /> Scegli
        </Button>
      </div>
    </Field>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-[28px]" />}>
      <GeneratorInner />
    </Suspense>
  );
}
