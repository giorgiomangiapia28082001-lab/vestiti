# CLAUDE.md – istruzioni per Claude su questo progetto (AI Wardrobe)

Questo file viene letto automaticamente da Claude Code all'inizio di ogni sessione.
Il contesto completo (account, servizi, funzioni fatte, cose da fare) è in `RIASSUNTO.md`:
leggilo sempre prima di iniziare. Le note tecniche di Next.js sono in `AGENTS.md`.

> **Domande o inserimenti sul guardaroba** (capi, outfit, preferiti, cronologia, calendario):
> usa **subito** il connettore Supabase (`execute_sql`, progetto `kopbioghepugymwgukzn`,
> solo righe di Giorgio `e48cbe19-bf5d-4c5d-aeca-0016bd15022a`), senza aspettare che
> l'utente lo chieda. Dettagli in "Leggere o correggere dati direttamente" più sotto.

## Come lavorare qui
- Rispondi all'utente in **italiano**, in modo semplice: non è un programmatore. Usa
  soprattutto lo smartphone.
- App online: **https://ai-wardrobe-hazel.vercel.app** (progetto Vercel `ai-wardrobe`,
  id `prj_g66cOmoRERdwutWzCebBzouOHfvg`, team `team_bPbaCNNcGjiMWDGHUm9bowUd`).
- Il ramo principale del repository è `claude/ai-wardrobe-app-rmk08k`. Per pubblicare:
  commit e push su quel ramo, poi crea un deploy di produzione con il connettore Vercel
  (`create_deployment` con `gitSource` sul ramo e `target: production`), oppure chiedi
  all'utente di fare "Redeploy" su vercel.com.
- **Regola di pubblicazione:** riassumi in poche righe cosa cambia e chiedi
  "Posso pubblicare?" prima di mandare online modifiche importanti.
- L'utente vuole **solo servizi AI gratuiti**: l'AI predefinita è **Google Gemini**
  (`GEMINI_API_KEY` su Vercel, stessa logica di `lib/ia.js` dell'app Garage). Claude
  (`ANTHROPIC_API_KEY`) resta come alternativa ma a pagamento: non attivarlo senza chiedere.
- Non puoi leggere le chiavi API (su Vercel sono "sensibili"): le inserisce l'utente su
  vercel.com → ai-wardrobe → Settings → Environment Variables. Dopo un cambio di variabili
  serve una nuova pubblicazione.
- Prima di pubblicare: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- Il database è **condiviso con l'app Garage** (stesso progetto Supabase, stessi account).
  Non toccare le tabelle `garage_*` da questo progetto e **non cambiare il "Site URL"**
  in Supabase (serve all'app Garage); per Wardrobe si usano i "Redirect URLs".

## Leggere o correggere dati direttamente (senza passare dall'app)
L'utente può chiedere, anche dal telefono: "quanti capi ho?", "quali capi non metto da
mesi?", "segna come indossato l'outfit di ieri", "aggiungi una nota al cappotto".
Lavora con il connettore Supabase (`execute_sql`) sul progetto `kopbioghepugymwgukzn`.
Se il connettore non è disponibile nella sessione, dillo all'utente e chiedigli di
attivarlo (claude.ai → Impostazioni → Connettori).

**Solo** righe con `user_id = 'e48cbe19-bf5d-4c5d-aeca-0016bd15022a'` (Giorgio,
`giorgio.mangiapia.28082001@gmail.com`). Mai toccare gli altri utenti.

**Tabelle** (schema in `supabase/migrations/`, valori ammessi in `src/lib/domain.ts`):
- `clothing_items`: name, category (`tshirt_polo`, `shirt`, `knitwear`, `outerwear`,
  `trousers`, `shorts`, `shoes`, `accessories`, `sportswear`, `other`), slot (`top`,
  `bottom`, `one_piece`, `outer`, `shoes`, `accessory`), primary_color, secondary_colors[],
  material, pattern, seasons[] (`spring`, `summer`, `autumn`, `winter`), styles[], fit,
  formality 1-5, brand, tags[], notes, is_favorite, wear_count, last_worn_at, image_path
  (foto nel bucket privato `wardrobe`, cartella = user_id).
- `outfits`: name, description, occasion, style, season, color_story, tips[], rating 1-5,
  is_favorite, source (`ai` | `rules` | `manual`), notes.
- `outfit_items`: outfit_id, item_id, role (`top`, `mid`, `bottom`, `one_piece`, `outer`,
  `shoes`, `accessory`), position.
- `outfit_history`: outfit_id, worn_on (data), notes. Un insert aggiorna da solo (trigger)
  `wear_count` e `last_worn_at` dei capi dell'outfit.
- `planned_outfits`: outfit_id, planned_for (un outfit per giorno).
- `profiles` (id = user_id): display_name, style_preferences[], favorite_colors[],
  avoid_colors[], season_preferences[], fit_preferences[].
- `ai_usage`: registro delle chiamate AI (limite giornaliero), non modificarlo.

**Come scrivere:** passa sempre `user_id` esplicito negli insert (con `execute_sql` non c'è
un utente collegato). Prima di scrivere riassumi in una riga cosa farai e chiedi conferma;
per cancellazioni o modifiche multiple mostra prima l'elenco. Dopo aver scritto, rileggi e
conferma. Le foto si aggiungono solo dall'app.
