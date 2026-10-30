# AI Wardrobe — il tuo guardaroba intelligente

Applicazione web, pensata prima di tutto per smartphone, che digitalizza il guardaroba e crea outfit
personalizzati usando **soltanto i capi che possiedi**. Combina un motore di stile deterministico con un
modello AI multimodale (facoltativo) per riconoscere i capi dalle foto e comporre abbinamenti spiegati.

## Funzionalità

| Area | Cosa fa |
| --- | --- |
| **Home** | Saluto, riepilogo del guardaroba, meteo locale (su consenso), outfit consigliati per oggi, preferiti, "nuovi abbinamenti" con capi poco usati, outfit pianificato per oggi, consiglio di stagione. Stato iniziale dedicato quando il guardaroba è vuoto. |
| **Guardaroba** | Griglia fotografica, ricerca testuale, filtri per categoria, colore, stagione, stile, frequenza d'uso e preferiti, ordinamento. Dettaglio con modifica, cambio foto, duplicazione, eliminazione (con conferma), preferito, statistiche d'uso e outfit che lo contengono. |
| **Aggiungi capo** | Foto da fotocamera o galleria (anche 20 alla volta), ottimizzazione nel browser, riconoscimento AI di categoria, colori, materiale, fantasia, stile, stagione, vestibilità e formalità; in alternativa estrazione locale dei colori. Revisione e conferma di ogni capo, inserimento manuale senza foto. |
| **Stylist (generatore)** | Occasione, stile (anche personalizzato), stagione, temperatura e meteo, formalità, colori preferiti/da evitare, capi obbligatori/esclusi, modalità "capi dimenticati". Proposte con collage delle foto reali, nome, descrizione, perché funziona, consigli, punteggio di armonia, salvataggio, preferito, valutazione, rigenera, sostituzione del singolo capo, "altre combinazioni". |
| **Dettaglio outfit** | Sostituzione e aggiunta di capi, preferito, valutazione, "segna come indossato" (aggiorna cronologia e ultimo utilizzo dei capi), pianificazione nel calendario, note, condivisione come immagine (Web Share API o download), rinomina, duplica e modifica, eliminazione. |
| **Outfit** | Preferiti, salvati, indossati e statistiche: capi più usati, capi usati raramente, ultimo utilizzo, outfit creati di recente. |
| **Calendario** | Vista settimanale per assegnare, cambiare o rimuovere l'outfit di ogni giorno e segnarlo come indossato. |
| **Preferenze** | Nome, stili preferiti, palette preferita e colori da evitare, stagioni e vestibilità, tema chiaro/scuro/sistema, cambio password, uscita. |

È installabile sulla schermata Home del telefono (manifest PWA): da Safari *Condividi → Aggiungi a Home*,
da Chrome *Menu → Installa app*.

## Architettura

```
src/
  app/                    Pagine (App Router) e API route
    (app)/                Sezioni protette da login: home, wardrobe, generate, outfits, calendar, settings
    login/                Accesso e registrazione
    api/ai/analyze        POST: analisi AI di una foto (autenticata, con limite giornaliero)
    api/ai/status         GET: indica se l'AI è configurata
    api/outfits/generate  POST: generazione outfit (motore di regole + AI, validazione sul database)
  components/             UI riutilizzabile (ui/, layout/, wardrobe/, outfit/, generator/, home/)
  lib/
    domain.ts             Vocabolario condiviso: categorie, colori, stili, occasioni…
    schemas.ts            Schemi Zod e tipi condivisi (input, richieste, output AI)
    engine/               Motore di abbinamento deterministico, eseguibile su server e browser
    data/                 Accesso ai dati (Supabase), hook SWR, elaborazione immagini
    weather.ts, share.ts  Meteo Open-Meteo e condivisione
  server/
    ai/                   Servizio AI separato: interfaccia AIProvider + provider Anthropic
    outfits.ts            Orchestrazione della generazione
    supabase.ts, usage.ts Autenticazione delle API e limite di utilizzo AI
supabase/migrations/      Schema SQL, vincoli, indici, trigger, RLS e storage
tests/                    Test del motore (Vitest)
```

**Scelte principali**

- **Next.js 16 + TypeScript + Tailwind CSS 4.** Componenti UI propri in stile shadcn (Radix Dialog per i
  pannelli accessibili), icone Lucide, notifiche Sonner, cache dati con SWR.
- **Supabase** per database Postgres, autenticazione email/password e archiviazione delle foto. Il browser
  usa la chiave pubblica: ogni tabella ha la **Row Level Security** attiva e ogni utente vede solo i propri
  dati. Le foto stanno in un bucket **privato** (`wardrobe/<user_id>/…`) e vengono mostrate con URL firmati.
- **Motore di stile deterministico** (`src/lib/engine`): beam search sulle combinazioni con punteggio su
  armonia dei colori (neutri, accento singolo, analoghi, complementari, fantasie), coerenza di formalità,
  stile, stagione e temperatura, struttura (scarpe, capospalla, strati), proporzioni, preferenze
  dell'utente, feedback (valutazioni e preferiti), frequenza d'uso e novità; selezione finale con diversità
  (MMR). Funziona anche senza AI e serve da rete di sicurezza.
- **AI come servizio separato** (`src/server/ai`): l'interfaccia `AIProvider` espone `analyzeGarment` e
  `composeOutfits`, con due provider e prompt condivisi (`providers/prompts.ts`):
  - **Google Gemini** (predefinito, come nelle app Garage): API REST, sceglie da solo un modello "flash"
    disponibile e passa al successivo se uno è sovraccarico; la risposta JSON viene normalizzata e validata
    con Zod.
  - **Claude** (alternativa): SDK ufficiale con output strutturati.
  Per cambiare fornitore si implementa l'interfaccia e la si registra in `src/server/ai/index.ts`.
- **Mai capi inventati**: il modello riceve solo i capi ammessi con i loro identificativi; ogni proposta
  viene validata (`validateItemIds`) contro i capi reali dell'utente letti dal database e contro regole di
  struttura. Le proposte non valide sono scartate e sostituite da quelle del motore.
- **Nessuna immagine generata**: gli outfit sono collage delle fotografie reali caricate.
- **Costi e limiti AI**: chiavi solo lato server, limite giornaliero per utente (`AI_DAILY_LIMIT`, tabella
  `ai_usage`), foto ridimensionate a 1280 px prima dell'invio, prompt di sistema stabili con prompt caching,
  livello di effort ridotto per l'analisi delle foto, fallback automatico al motore di regole.
- **Apprendimento delle preferenze**: valutazioni e preferiti alimentano affinità per capo e per coppia di
  capi; le combinazioni già viste o valutate male vengono penalizzate; i capi poco usati possono essere
  valorizzati.

## Configurazione

### 1. Supabase

1. Crea un progetto su [supabase.com](https://supabase.com).
2. Applica la migrazione `supabase/migrations/20261029000000_init.sql` (SQL Editor → incolla ed esegui,
   oppure `npx supabase link --project-ref <ref>` e `npx supabase db push`). Crea tabelle, RLS, trigger e il
   bucket privato `wardrobe`.
3. In *Authentication → URL Configuration* imposta come **Site URL** l'indirizzo dell'app (es.
   `https://tuo-progetto.vercel.app`) e aggiungilo ai *Redirect URLs* (serve per conferma email e recupero
   password). Se vuoi accedere subito dopo la registrazione, disattiva *Confirm email* in
   *Authentication → Providers → Email*.
4. Copia URL e chiave pubblicabile da *Project Settings → API*.

### 2. Variabili d'ambiente

Copia `.env.example` in `.env.local` e compila i valori:

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | sì | URL del progetto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | sì | Chiave pubblicabile (accettata anche `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `GEMINI_API_KEY` | no | Attiva riconoscimento foto e stylist AI con Google Gemini. Solo server. |
| `ANTHROPIC_API_KEY` | no | Alternativa: Claude. Usata se manca la chiave Gemini o con `AI_PROVIDER=anthropic`. |
| `AI_PROVIDER` | no | `gemini`, `anthropic` oppure `none`; se vuoto si sceglie in base alle chiavi presenti |
| `AI_MODEL` | no | Modello specifico; con Gemini viene scelto in automatico, con Claude è `claude-opus-5-5` |
| `AI_DAILY_LIMIT` | no | Chiamate AI per utente ogni 24 ore, predefinito 60 |

### 3. Avvio

```bash
npm install
npm run dev        # http://localhost:3000
```

Per provarlo dal telefono sulla stessa rete: `npm run dev -- -H 0.0.0.0` e apri `http://<ip-del-pc>:3000`
(la fotocamera e la geolocalizzazione richiedono HTTPS fuori da localhost: per l'uso quotidiano conviene il
deploy).

### 4. Deploy (consigliato per l'uso da telefono)

Su [Vercel](https://vercel.com): importa il repository, aggiungi le variabili d'ambiente e pubblica. Poi
aggiorna *Site URL* e *Redirect URLs* in Supabase con il dominio ottenuto.

### Sviluppo locale con Supabase CLI (facoltativo)

Con Docker attivo: `npx supabase start` avvia database, auth e storage in locale applicando le migrazioni;
usa URL e chiave stampati dal comando in `.env.local`.

## Controlli di qualità

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # test del motore di abbinamento
npm run build       # build di produzione
```

## Stato e prossimi passi

Implementato e funzionante: tutto quanto descritto sopra. Limitazioni note e possibili evoluzioni:

- La geolocalizzazione serve solo per il meteo; il nome della città non viene mostrato.
- Le foto HEIC vengono lette nativamente da Safari; su altri browser conviene caricarle in JPG.
- Rimuovere una voce dalla cronologia non è previsto: il contatore di utilizzo dei capi si aggiorna solo
  in aumento.
- L'eliminazione dell'account richiede un'operazione con chiave di servizio: per ora si fa dalla dashboard
  Supabase (*Authentication → Users*), e i dati collegati vengono eliminati a cascata.
- Evoluzioni previste: statistiche avanzate (costo per utilizzo, grafici), pianificazione mensile,
  suggerimenti d'acquisto basati sui capi mancanti, rimozione automatica dello sfondo dalle foto.
