import { Database } from "lucide-react";
import { Brand } from "./brand";

/** Mostrato quando mancano le variabili d'ambiente di Supabase. */
export function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <Brand />
      <div className="mt-10 rounded-[28px] border border-line bg-surface p-7 shadow-soft">
        <div className="mb-4 grid size-12 place-items-center rounded-full bg-olive-soft text-olive">
          <Database className="size-5" />
        </div>
        <h1 className="font-display text-[32px] leading-tight">Manca la configurazione del database</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-muted">
          Per salvare guardaroba e outfit l&apos;app usa Supabase. Imposta queste variabili d&apos;ambiente e riavvia
          l&apos;app:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-surface-2 p-4 text-[12.5px] leading-relaxed">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
GEMINI_API_KEY=...             # facoltativa, per l'AI`}
        </pre>
        <p className="mt-4 text-[13px] text-muted">Le istruzioni complete sono nel file README.md del progetto.</p>
      </div>
    </main>
  );
}
