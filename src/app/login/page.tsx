"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Brand } from "@/components/layout/brand";
import { SetupNotice } from "@/components/layout/setup-notice";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { getSupabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/utils";

type Mode = "login" | "signup";

function translateAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "Email o password non corretti.";
  if (/email not confirmed/i.test(message)) return "Conferma prima l'indirizzo email: controlla la posta.";
  if (/already registered/i.test(message)) return "Esiste già un account con questa email. Accedi.";
  if (/password should be at least/i.test(message)) return "La password deve avere almeno 6 caratteri.";
  if (/rate limit/i.test(message)) return "Troppi tentativi. Attendi qualche minuto e riprova.";
  return message;
}

function LoginForm() {
  const { user, configured } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") && params.get("next")!.startsWith("/") ? params.get("next")! : "/";
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  if (!configured) return <SetupNotice />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabase();
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        if (!data.session) setSent(true);
      }
    } catch (err) {
      setError(translateAuthError(errorMessage(err)));
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!email) {
      setError("Inserisci la tua email per ricevere il link di recupero.");
      return;
    }
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/settings?reset=1`,
    });
    if (error) setError(translateAuthError(error.message));
    else toast.success("Ti abbiamo inviato un'email per reimpostare la password.");
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-surface-2 lg:block">
        <div className="absolute inset-0 grid grid-cols-3 gap-3 p-10 opacity-90" aria-hidden>
          {["#d6c3a1", "#1f2a44", "#efe6d2", "#5f6236", "#b08a5a", "#3b3b3d"].map((c, i) => (
            <div
              key={c}
              className="animate-fade-up rounded-[28px]"
              style={{ background: c, animationDelay: `${i * 80}ms`, gridRow: i % 2 ? "span 2" : undefined }}
            />
          ))}
        </div>
        <div className="absolute inset-x-10 bottom-10 rounded-[28px] bg-surface/90 p-8 backdrop-blur">
          <p className="eyebrow">Il tuo stylist personale</p>
          <p className="mt-3 font-display text-[40px] leading-[1.05]">
            Tutto il tuo guardaroba, <em>infinite combinazioni.</em>
          </p>
        </div>
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm animate-fade-up">
          <Brand />
          <h1 className="mt-10 font-display text-[44px] leading-[1.02]">
            {mode === "login" ? "Bentornato." : "Crea il tuo guardaroba."}
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
            Fotografa i tuoi capi, lascia che l&apos;AI li riconosca e ricevi ogni giorno outfit creati con ciò che
            possiedi davvero.
          </p>

          {sent ? (
            <div className="mt-8 rounded-[24px] border border-line bg-surface p-6" role="status">
              <p className="font-display text-[24px]">Controlla la tua email</p>
              <p className="mt-2 text-[14px] text-muted">
                Abbiamo inviato un link di conferma a <strong className="text-ink">{email}</strong>. Aprilo per attivare
                l&apos;account, poi accedi.
              </p>
              <Button
                variant="secondary"
                className="mt-5"
                onClick={() => {
                  setSent(false);
                  setMode("login");
                }}
              >
                Torna all&apos;accesso
              </Button>
            </div>
          ) : (
            <>
              <Segmented
                className="mt-8"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  setError(null);
                }}
                options={[
                  { value: "login", label: "Accedi" },
                  { value: "signup", label: "Registrati" },
                ]}
              />
              <form onSubmit={submit} className="mt-6 space-y-4">
                {mode === "signup" ? (
                  <Field label="Come ti chiami?" htmlFor="name">
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={60} />
                  </Field>
                ) : null}
                <Field label="Email" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    inputMode="email"
                  />
                </Field>
                <Field label="Password" htmlFor="password" hint={mode === "signup" ? "Almeno 6 caratteri." : undefined}>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                </Field>
                {error ? (
                  <p className="rounded-2xl bg-danger/10 px-4 py-3 text-[13.5px] text-danger" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" size="lg" className="w-full" loading={loading}>
                  {mode === "login" ? "Accedi" : "Crea account"}
                </Button>
                {mode === "login" ? (
                  <button
                    type="button"
                    onClick={resetPassword}
                    className="w-full py-2 text-center text-[13px] font-semibold text-muted hover:text-ink"
                  >
                    Password dimenticata?
                  </button>
                ) : null}
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
