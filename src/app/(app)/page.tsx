"use client";

import { ArrowRight, Camera, CalendarDays, Leaf, Sparkles, UserRound, Wand2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { SuggestionCard } from "@/components/home/suggestion-card";
import { WeatherCard } from "@/components/home/weather-card";
import { Brand } from "@/components/layout/brand";
import { OutfitCard } from "@/components/outfit/outfit-card";
import { OutfitCollage } from "@/components/outfit/outfit-collage";
import { Skeleton } from "@/components/ui/skeleton";
import { useItems, useOutfits, usePlanned, useProfile } from "@/lib/data/hooks";
import { candidateToGenerated, useTasteAndFeedback } from "@/lib/data/use-engine";
import { currentSeason, label, type Season } from "@/lib/domain";
import { generateCandidates } from "@/lib/engine";
import { generateRequestSchema } from "@/lib/schemas";
import { isoDate } from "@/lib/utils";
import { useWeather } from "@/lib/weather";

const SEASON_TIPS: Record<Season, { title: string; text: string }> = {
  spring: {
    title: "Primavera: gioca con gli strati leggeri",
    text: "Una camicia aperta su una t-shirt o un trench sottile ti accompagnano dal mattino fresco al pomeriggio tiepido.",
  },
  summer: {
    title: "Estate: tessuti che respirano",
    text: "Lino, cotone leggero e colori chiari. Tieni la palette semplice e lascia che sia un accessorio a fare la differenza.",
  },
  autumn: {
    title: "Autunno: texture e toni caldi",
    text: "Maglia, velluto e scamosciato con cammello, oliva e marrone. Stratifica camicia, maglione e giacca leggera.",
  },
  winter: {
    title: "Inverno: il cappotto è il protagonista",
    text: "Un buon cappotto in un colore neutro valorizza tutto ciò che indossi sotto. Punta su lana e tonalità profonde.",
  },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Buonanotte";
  if (h < 13) return "Buongiorno";
  if (h < 18) return "Buon pomeriggio";
  return "Buonasera";
}

export default function HomePage() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { data: items, isLoading } = useItems();
  const { data: outfits } = useOutfits();
  const today = isoDate();
  const { data: planned } = usePlanned(today, today);
  const { weather, status, enable } = useWeather();
  const { taste, feedback } = useTasteAndFeedback();

  const name = profile?.display_name || (user?.user_metadata?.display_name as string | undefined) || "";
  const season = currentSeason();
  const byId = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);

  const suggestions = useMemo(() => {
    if (!items?.length) return { today: [], rediscover: [] };
    const base = {
      occasion: "everyday",
      season,
      temperature: weather?.apparent ?? null,
      weather: weather?.kind ?? null,
      seed: Number(today.replaceAll("-", "")),
    };
    const reqToday = generateRequestSchema.parse({ ...base, count: 3 });
    const reqNew = generateRequestSchema.parse({ ...base, count: 3, rediscover: true, seed: base.seed + 7 });
    const todayRes = generateCandidates(items, { request: reqToday, taste, feedback });
    const shown = todayRes.candidates.map((c) => c.pieces.map((p) => p.item_id));
    const newRes = generateCandidates(items, {
      request: { ...reqNew, avoid_combos: shown },
      taste,
      feedback,
    });
    return {
      today: todayRes.candidates.map((c, i) => candidateToGenerated(c, byId, reqToday, `t${i}`)),
      rediscover: newRes.candidates.map((c, i) => candidateToGenerated(c, byId, reqNew, `n${i}`)),
    };
  }, [items, season, weather, today, taste, feedback, byId]);

  const favorites = (outfits ?? []).filter((o) => o.is_favorite).slice(0, 8);
  const plannedToday = planned?.[0] ? (outfits ?? []).find((o) => o.id === planned[0].outfit_id) : null;
  const counts = {
    total: items?.length ?? 0,
    top: items?.filter((i) => i.slot === "top" || i.slot === "one_piece").length ?? 0,
    bottom: items?.filter((i) => i.slot === "bottom").length ?? 0,
    shoes: items?.filter((i) => i.slot === "shoes").length ?? 0,
  };
  const tip = SEASON_TIPS[season];
  const generateHref = `/generate?season=${season}${weather ? `&temp=${weather.apparent}&weather=${weather.kind}` : ""}`;

  return (
    <div className="space-y-12">
      <header className="animate-fade-up pt-2">
        <div className="mb-8 flex items-center justify-between lg:hidden">
          <Brand />
          <div className="flex gap-2">
            <Link href="/calendar" className="grid size-10 place-items-center rounded-full border border-line bg-surface" aria-label="Calendario">
              <CalendarDays className="size-[18px]" />
            </Link>
            <Link href="/settings" className="grid size-10 place-items-center rounded-full border border-line bg-surface" aria-label="Profilo e preferenze">
              <UserRound className="size-[18px]" />
            </Link>
          </div>
        </div>
        <p className="eyebrow">
          {new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
        </p>
        <h1 className="mt-2 font-display text-[44px] leading-[1] sm:text-[60px]">
          {greeting()}
          {name ? <span className="italic">, {name}</span> : null}.
        </h1>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
          {counts.total
            ? "Ecco cosa ti propone il tuo stylist per oggi, con i capi che possiedi già."
            : "Il tuo stylist personale è pronto. Iniziamo dal tuo guardaroba."}
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-[28px]" />
          <div className="flex gap-3">
            <Skeleton className="aspect-[4/5] w-1/2 rounded-[24px]" />
            <Skeleton className="aspect-[4/5] w-1/2 rounded-[24px]" />
          </div>
        </div>
      ) : counts.total === 0 ? (
        <Onboarding />
      ) : (
        <>
          <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Link
              href={generateHref}
              className="group relative overflow-hidden rounded-[28px] bg-ink p-7 text-bg shadow-lift transition-transform active:scale-[0.99]"
            >
              <div className="absolute -right-10 -top-10 size-48 rounded-full bg-olive/40 blur-3xl" aria-hidden />
              <Wand2 className="size-6 opacity-80" strokeWidth={1.5} />
              <p className="mt-10 font-display text-[36px] leading-[1.02]">Crea un outfit</p>
              <p className="mt-2 max-w-xs text-[13.5px] opacity-70">
                Scegli occasione e stile: lo stylist combina i tuoi capi e ti spiega perché funzionano.
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold">
                Inizia <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
            <div className="space-y-4">
              <WeatherCard weather={weather} status={status} onEnable={enable} />
              <Link href="/wardrobe" className="block rounded-[24px] border border-line bg-surface p-5 shadow-soft">
                <div className="flex items-center justify-between">
                  <p className="eyebrow">Il tuo guardaroba</p>
                  <ArrowRight className="size-4 text-muted" />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    [counts.total, "capi"],
                    [counts.top, "sopra"],
                    [counts.bottom, "sotto"],
                    [counts.shoes, "scarpe"],
                  ].map(([n, l]) => (
                    <div key={l}>
                      <p className="font-display text-[30px] leading-none">{n}</p>
                      <p className="mt-1 text-[11.5px] text-muted">{l}</p>
                    </div>
                  ))}
                </div>
              </Link>
            </div>
          </section>

          {plannedToday ? (
            <section className="animate-fade-up">
              <SectionTitle eyebrow="In programma" title="Oggi indossi" href="/calendar" />
              <Link href={`/outfits/${plannedToday.id}`} className="flex items-center gap-4 rounded-[24px] border border-line bg-surface p-3 shadow-soft">
                <OutfitCollage pieces={plannedToday.outfit_items} items={byId} className="w-24 shrink-0 rounded-[18px]" />
                <div className="min-w-0">
                  <p className="truncate font-display text-[24px] leading-tight">{plannedToday.name}</p>
                  <p className="text-[12.5px] text-muted">{label.occasion(plannedToday.occasion)}</p>
                </div>
              </Link>
            </section>
          ) : null}

          {suggestions.today.length ? (
            <section>
              <SectionTitle eyebrow={`${label.season(season)}${weather ? ` · ${weather.apparent}°` : ""}`} title="Consigliati per oggi" href={generateHref} linkLabel="Altre idee" />
              <Rail>
                {suggestions.today.map((o, i) => (
                  <SuggestionCard key={o.key} outfit={o} items={byId} index={i} caption={o.description} />
                ))}
              </Rail>
            </section>
          ) : (
            <p className="rounded-[24px] bg-surface-2 p-5 text-[14px] text-muted">
              Aggiungi almeno una parte superiore e una inferiore adatte alla stagione per ricevere i primi consigli.
            </p>
          )}

          <section>
            <SectionTitle eyebrow="Salvati" title="I tuoi preferiti" href="/outfits" />
            {favorites.length ? (
              <Rail>
                {favorites.map((o, i) => (
                  <div key={o.id} className="w-[58vw] max-w-[240px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                    <OutfitCard outfit={o} items={byId} index={i} />
                  </div>
                ))}
              </Rail>
            ) : (
              <p className="rounded-[24px] bg-surface-2 p-5 text-[14px] text-muted">
                Tocca il cuore su un outfit per ritrovarlo qui.
              </p>
            )}
          </section>

          {suggestions.rediscover.length ? (
            <section>
              <SectionTitle eyebrow="Riscopri il guardaroba" title="Nuovi abbinamenti da provare" />
              <Rail>
                {suggestions.rediscover.map((o, i) => (
                  <SuggestionCard key={o.key} outfit={o} items={byId} index={i} caption="Valorizza capi che indossi poco" />
                ))}
              </Rail>
            </section>
          ) : null}

          <section className="flex gap-4 rounded-[28px] bg-olive-soft p-6">
            <Leaf className="mt-1 size-5 shrink-0 text-olive" />
            <div>
              <p className="eyebrow !text-olive">Consiglio di stagione</p>
              <p className="mt-2 font-display text-[24px] leading-tight">{tip.title}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{tip.text}</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SectionTitle({ eyebrow, title, href, linkLabel = "Vedi tutti" }: { eyebrow?: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
        <h2 className="font-display text-[30px] leading-none">{title}</h2>
      </div>
      {href ? (
        <Link href={href} className="shrink-0 text-[13px] font-semibold text-muted hover:text-ink">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {children}
    </div>
  );
}

function Onboarding() {
  const steps = [
    { icon: Camera, title: "Fotografa i tuoi capi", text: "Scatta o carica le foto, anche più di una alla volta." },
    { icon: Sparkles, title: "L'AI li riconosce", text: "Categoria, colori, materiale e stagione vengono proposti in automatico." },
    { icon: Wand2, title: "Ricevi i tuoi outfit", text: "Combinazioni create solo con ciò che possiedi, con il perché funzionano." },
  ];
  return (
    <section className="animate-fade-up overflow-hidden rounded-[32px] border border-line bg-surface shadow-soft">
      <div className="grid gap-0 lg:grid-cols-[1fr_1.1fr]">
        <div className="relative min-h-56 bg-surface-2">
          <div className="absolute inset-6 grid grid-cols-3 grid-rows-2 gap-2.5" aria-hidden>
            {["#d6c3a1", "#1f2a44", "#efe6d2", "#5f6236", "#3b3b3d", "#b08a5a"].map((c, i) => (
              <div key={c} className="animate-fade-up rounded-[18px]" style={{ background: c, animationDelay: `${i * 70}ms` }} />
            ))}
          </div>
        </div>
        <div className="p-7 sm:p-10">
          <p className="eyebrow">Benvenuto</p>
          <h2 className="mt-2 font-display text-[36px] leading-[1.04]">Il tuo guardaroba è ancora vuoto.</h2>
          <ol className="mt-6 space-y-5">
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-olive-soft text-olive">
                  <Icon className="size-[18px]" />
                </span>
                <div>
                  <p className="text-[14.5px] font-semibold">
                    {i + 1}. {title}
                  </p>
                  <p className="text-[13.5px] text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href="/wardrobe/new"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-bg shadow-soft transition-transform active:scale-[0.98]"
          >
            <Camera className="size-4" /> Aggiungi il primo capo
          </Link>
        </div>
      </div>
    </section>
  );
}
