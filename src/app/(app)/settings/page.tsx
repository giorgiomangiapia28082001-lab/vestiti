"use client";

import { KeyRound, LogOut, Monitor, Moon, Sparkles, Sun } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/layout/page-header";
import { useTheme, type Theme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { ColorDot } from "@/components/ui/color-dot";
import { Field, Input } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { saveProfile } from "@/lib/data/api";
import { useAiStatus, useProfile } from "@/lib/data/hooks";
import { COLORS, FITS, SEASONS, STYLES } from "@/lib/domain";
import type { Profile } from "@/lib/schemas";
import { getSupabase } from "@/lib/supabase/client";
import { cn, errorMessage } from "@/lib/utils";

type Prefs = Omit<Profile, "id">;

function SettingsInner() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { data: profile, isLoading, mutate } = useProfile();
  const { data: ai } = useAiStatus();
  const { theme, setTheme } = useTheme();
  const [draft, setDraft] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const prefs: Prefs = draft ?? {
    display_name: profile?.display_name ?? "",
    style_preferences: profile?.style_preferences ?? [],
    favorite_colors: profile?.favorite_colors ?? [],
    avoid_colors: profile?.avoid_colors ?? [],
    season_preferences: profile?.season_preferences ?? [],
    fit_preferences: profile?.fit_preferences ?? [],
  };
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => setDraft({ ...prefs, [k]: v });

  async function save() {
    setSaving(true);
    try {
      await saveProfile(prefs);
      await mutate();
      setDraft(null);
      toast.success("Preferenze salvate: lo stylist ne terrà conto");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setSavingPassword(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      toast.success("Password aggiornata");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSavingPassword(false);
    }
  }

  async function logout() {
    await getSupabase().auth.signOut();
    router.replace("/login");
  }

  const colorRender = (o: { value: string; label: string }) => (
    <>
      <ColorDot color={o.value} /> {o.label}
    </>
  );

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Il tuo profilo" title="Preferenze" subtitle={user?.email} />

      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="space-y-12">
          <section className="space-y-7">
            <Field label="Nome" htmlFor="display_name">
              <Input id="display_name" value={prefs.display_name ?? ""} maxLength={60} onChange={(e) => set("display_name", e.target.value)} />
            </Field>
            <Field label="Stili che ami" hint="Lo stylist darà priorità a questi stili quando non ne scegli uno.">
              <ChipGroup label="Stili" size="sm" options={STYLES} value={prefs.style_preferences} onChange={(v) => set("style_preferences", v)} />
            </Field>
            <Field label="La tua palette preferita">
              <ChipGroup label="Colori preferiti" size="sm" options={COLORS.filter((c) => !prefs.avoid_colors.includes(c.value))} value={prefs.favorite_colors} onChange={(v) => set("favorite_colors", v)} render={colorRender} />
            </Field>
            <Field label="Colori che preferisci evitare">
              <ChipGroup label="Colori da evitare" size="sm" options={COLORS.filter((c) => !prefs.favorite_colors.includes(c.value))} value={prefs.avoid_colors} onChange={(v) => set("avoid_colors", v)} render={colorRender} />
            </Field>
            <Field label="Stagioni preferite">
              <ChipGroup label="Stagioni" size="sm" options={SEASONS} value={prefs.season_preferences} onChange={(v) => set("season_preferences", v)} />
            </Field>
            <Field label="Vestibilità preferite">
              <ChipGroup label="Vestibilità" size="sm" options={FITS} value={prefs.fit_preferences} onChange={(v) => set("fit_preferences", v)} />
            </Field>
            <Button size="lg" className="w-full" onClick={save} loading={saving} disabled={!draft}>
              Salva preferenze
            </Button>
          </section>

          <section>
            <h2 className="mb-4 font-display text-[28px]">Aspetto</h2>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
              {(
                [
                  ["light", "Chiaro", Sun],
                  ["dark", "Scuro", Moon],
                  ["system", "Sistema", Monitor],
                ] as [Theme, string, typeof Sun][]
              ).map(([value, text, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme === value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-[20px] border p-4 text-[13px] font-semibold transition-all",
                    theme === value ? "border-ink bg-surface shadow-soft" : "border-line text-muted",
                  )}
                >
                  <Icon className="size-5" /> {text}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[24px] border border-line bg-surface p-5">
            <div className="flex items-center gap-3">
              <span className={cn("grid size-10 place-items-center rounded-full", ai?.enabled ? "bg-olive-soft text-olive" : "bg-surface-2 text-muted")}>
                <Sparkles className="size-[18px]" />
              </span>
              <div>
                <p className="text-[14px] font-semibold">Stylist AI {ai?.enabled ? "attivo" : "non configurato"}</p>
                <p className="text-[12.5px] text-muted">
                  {ai?.enabled
                    ? "Riconoscimento delle foto e outfit generati con l'intelligenza artificiale."
                    : "Funzionano comunque il motore di stile e l'estrazione dei colori. Per attivarlo serve ANTHROPIC_API_KEY sul server."}
                </p>
              </div>
            </div>
          </section>

          <section className={cn("space-y-4", params.get("reset") && "rounded-[24px] bg-olive-soft p-5")}>
            <h2 className="font-display text-[28px]">{params.get("reset") ? "Imposta una nuova password" : "Sicurezza"}</h2>
            <Field label="Nuova password" htmlFor="new-password" hint="Almeno 6 caratteri.">
              <Input id="new-password" type="password" minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Button variant="secondary" onClick={changePassword} disabled={password.length < 6} loading={savingPassword}>
              <KeyRound className="size-4" /> Aggiorna password
            </Button>
          </section>

          <Button variant="danger" className="w-full" onClick={logout}>
            <LogOut className="size-4" /> Esci
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SettingsInner />
    </Suspense>
  );
}
