# Riassunto del progetto – App "AI Wardrobe" (guardaroba e outfit)

Aggiornato al 30/10/2026. Da leggere all'inizio di ogni sessione (è anche citato in `CLAUDE.md`).

## Cos'è
Guardaroba digitale con stylist personale: si fotografano i capi, l'AI li riconosce e
propone outfit usando **solo i capi che l'utente possiede**. Pensata per lo smartphone,
installabile nella schermata Home.

## Account e accessi
- **App online**: https://ai-wardrobe-hazel.vercel.app
- **GitHub**: repo `giorgiomangiapia28082001-lab/vestiti`, ramo principale
  `claude/ai-wardrobe-app-rmk08k`.
- **Vercel**: progetto `ai-wardrobe` (`prj_g66cOmoRERdwutWzCebBzouOHfvg`), team
  `team_bPbaCNNcGjiMWDGHUm9bowUd` (slug `mp-g01`). Il 30/10/2026 l'utente ha autorizzato il
  connettore Vercel di Claude su questo team (prima dava errore 403).
  Protezione: standard (indirizzo di produzione pubblico, anteprime protette).
  Variabili: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
  da aggiungere a cura dell'utente: `GEMINI_API_KEY`.
- **Supabase**: progetto "garage giorgio" (`kopbioghepugymwgukzn`), lo stesso dell'app
  Garage (piano gratuito: max 2 progetti). Tabelle senza prefisso (`clothing_items`,
  `outfits`, …), funzioni con prefisso `wardrobe_`, bucket privato `wardrobe`.
  Account condivisi con Garage: Giorgio entra con la stessa email e password.
  Site URL = app Garage (non cambiarlo); per Wardrobe va aggiunto nei Redirect URLs
  `https://ai-wardrobe-hazel.vercel.app/**` (serve per il recupero password).
- **Utente**: Giorgio, `giorgio.mangiapia.28082001@gmail.com`,
  user_id `e48cbe19-bf5d-4c5d-aeca-0016bd15022a`.

## Tecnologia
Next.js 16 + TypeScript + Tailwind 4, Supabase (database, login, foto), SWR.
- `src/lib/engine/`: motore di abbinamento a regole (colori, formalità, stagione, stile,
  proporzioni, voti dell'utente). Funziona anche senza AI.
- `src/server/ai/`: servizio AI separato. Provider predefinito **Gemini** (API REST,
  sceglie un modello "flash" e passa al successivo se uno non risponde); alternativa Claude.
  Le proposte dell'AI vengono sempre controllate sui capi reali del database.
- `supabase/migrations/`: schema, vincoli, trigger e Row Level Security.

## Funzioni fatte
Home (consigli del giorno, preferiti, capi dimenticati, meteo su consenso, consiglio di
stagione), guardaroba con filtri e ricerca, aggiunta capi da foto (anche 20 insieme) con
riconoscimento AI o estrazione dei colori, dettaglio capo (modifica, duplica, elimina,
preferito, statistiche), stylist con occasione/stile/stagione/meteo/formalità/colori/capi
obbligatori o esclusi, sostituzione di un singolo capo, rigenera, voti, dettaglio outfit
(indossato, calendario, note, condivisione come immagine, duplica), archivio con
statistiche, calendario settimanale, preferenze, tema scuro.

## Da fare / idee
- L'utente deve inserire `GEMINI_API_KEY` su Vercel (poi ripubblicare) per attivare l'AI.
- Statistiche avanzate, pianificazione mensile, suggerimenti d'acquisto, rimozione sfondo
  dalle foto, eliminazione account dall'app.
