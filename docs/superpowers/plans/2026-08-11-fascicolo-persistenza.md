# Persistenza e ciclo di vita del fascicolo — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** i documenti caricati per il fascicolo e il fascicolo generato restano salvati e agganciati alla singola apparecchiatura, e si cancellano da soli 30 giorni dopo la chiusura della pratica o comunque dopo 180 giorni di immobilità.

**Architecture:** i file vanno in un bucket Supabase Storage nuovo (`fascicoli`), indicizzati da una tabella `fascicolo_documenti` con chiave logica `(request_id, codice apparecchiatura)`. La regola di scadenza è una funzione pura in TypeScript, usata sia dall'interfaccia — che mostra la data — sia da una Edge Function che ogni notte preavvisa, cancella e ripulisce gli orfani, chiamata da `pg_cron` via `pg_net`.

**Tech Stack:** React 18 + TypeScript + Material UI 6 + TanStack Query (frontend); Supabase Postgres + Storage + Edge Functions (Deno) + `pg_cron` + `pg_net` (backend); Vitest per i test.

Spec di riferimento: `docs/superpowers/specs/2026-08-10-fascicolo-apparecchiatura-design.md`, sezione «Persistenza e ciclo di vita».

## Global Constraints

- **Lingua:** codice, commenti, messaggi d'errore e testi d'interfaccia in italiano. I commenti spiegano il *perché*, non il *cosa*.
- **Stati che avviano il conto dei 30 giorni:** esattamente `7-CHIUSA` e `ARCHIVIATA NON FINITA`. La seconda ha **spazi**, non trattini bassi. `COMPLETATA` è fuori.
- **Finestre:** 30 giorni dopo la chiusura, 180 giorni dall'ultimo movimento, 7 giorni di preavviso. Sempre da costanti esportate, mai da numeri sparsi nel codice.
- **Tetto di peso:** 50 MB di documenti per apparecchiatura.
- **Bucket:** `fascicoli`, privato. Percorso oggetto: `{request_id}/{codice}/{timestamp}_{nome sanificato}`.
- **Progetto Supabase:** ref `uphftgpwisdiubuhohnc`. Le migrations si applicano **direttamente in produzione** via Management API con `SUPABASE_ACCESS_TOKEN` da `.env.local` (già presente nel worktree), usando `curl` e non `urllib` — vedi `CLAUDE.md`. Non stampare mai i valori delle chiavi.
- **Test:** Vitest, `npx vitest run`. Alla base di questo lavoro ne passano 556: nessuno deve rompersi.
- **Commit:** Conventional Commits, in italiano, uno per task.
- **Rifinitura estetica alla fine, in blocco:** durante i task si scrive interfaccia funzionante e ordinata, senza passaggi di sola estetica.

---

### Task 1: La regola di scadenza

Calcolo puro, senza database e senza React. È il cuore del lavoro e l'unica parte che merita copertura a test.

**Files:**
- Create: `src/services/fascicolo/scadenza.ts`
- Test: `src/services/fascicolo/__tests__/scadenza.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces:
  - `STATI_CHIUSI: readonly string[]`
  - `GIORNI_DOPO_CHIUSURA = 30`, `GIORNI_SENZA_MOVIMENTO = 180`, `GIORNI_PREAVVISO = 7`
  - `interface MovimentoPratica { stato: string; ultimoCambioStato: string | null; aggiornataIl: string | null; creataIl: string }`
  - `dataCancellazione(p: MovimentoPratica): Date`
  - `interface StatoScadenza { data: Date; giorniMancanti: number; scaduta: boolean; inPreavviso: boolean }`
  - `statoScadenza(p: MovimentoPratica, adesso: Date): StatoScadenza`

- [ ] **Step 1: Scrivere il test che fallisce**

Crea `src/services/fascicolo/__tests__/scadenza.test.ts`:

```ts
import { describe, test, expect } from 'vitest'
import {
  dataCancellazione, statoScadenza,
  GIORNI_DOPO_CHIUSURA, GIORNI_SENZA_MOVIMENTO, GIORNI_PREAVVISO,
  type MovimentoPratica,
} from '../scadenza'

const ADESSO = new Date('2026-08-11T12:00:00Z')

/** Data ISO di N giorni fa rispetto ad ADESSO. */
const giorniFa = (n: number) => new Date(ADESSO.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

/** Pratica con lo stato dato, ferma da `fermaDa` giorni sia di stato sia di modifiche. */
const pratica = (stato: string, fermaDa: number, modificataDa = fermaDa): MovimentoPratica => ({
  stato,
  ultimoCambioStato: giorniFa(fermaDa),
  aggiornataIl: giorniFa(modificataDa),
  creataIl: giorniFa(fermaDa + 400),
})

/** Giorni che mancano alla cancellazione, arrotondati come fa statoScadenza. */
const mancano = (p: MovimentoPratica) => statoScadenza(p, ADESSO).giorniMancanti

describe('dataCancellazione', () => {
  test('una pratica chiusa scade 30 giorni dopo il passaggio in 7-CHIUSA', () => {
    expect(mancano(pratica('7-CHIUSA', 29))).toBe(1)
    expect(mancano(pratica('7-CHIUSA', 30))).toBe(0)
    expect(mancano(pratica('7-CHIUSA', 31))).toBe(-1)
  })

  test('«ARCHIVIATA NON FINITA» conta come chiusa, spazi compresi', () => {
    expect(statoScadenza(pratica('ARCHIVIATA NON FINITA', 31), ADESSO).scaduta).toBe(true)
    expect(statoScadenza(pratica('ARCHIVIATA NON FINITA', 29), ADESSO).scaduta).toBe(false)
  })

  test('COMPLETATA non avvia il conto dei 30 giorni: resta sotto i soli 180', () => {
    expect(statoScadenza(pratica('COMPLETATA', 31), ADESSO).scaduta).toBe(false)
    expect(mancano(pratica('COMPLETATA', 31))).toBe(GIORNI_SENZA_MOVIMENTO - 31)
  })

  test('una pratica viva scade dopo 180 giorni di immobilità', () => {
    expect(mancano(pratica('3-MAIL_CLIENTE_INVIATA', 179))).toBe(1)
    expect(mancano(pratica('3-MAIL_CLIENTE_INVIATA', 180))).toBe(0)
    expect(mancano(pratica('3-MAIL_CLIENTE_INVIATA', 181))).toBe(-1)
  })

  test('una modifica senza cambio di stato sposta in avanti i 180 giorni', () => {
    // Ferma di stato da 179 giorni ma ritoccata ieri: il conto riparte da ieri.
    expect(mancano(pratica('4-DOCUMENTI_PRONTI', 179, 1))).toBe(GIORNI_SENZA_MOVIMENTO - 1)
  })

  test('su una pratica chiusa vince il minimo: ritoccarla non allunga i 30 giorni', () => {
    expect(mancano(pratica('7-CHIUSA', 29, 0))).toBe(1)
  })

  test('riaperta, torna sotto i soli 180 giorni', () => {
    expect(statoScadenza(pratica('1-INCARICO_RICEVUTO', 0), ADESSO).scaduta).toBe(false)
    expect(mancano(pratica('1-INCARICO_RICEVUTO', 0))).toBe(GIORNI_SENZA_MOVIMENTO)
  })

  test('senza righe di storia si ripiega sulla data di creazione', () => {
    const senzaStoria: MovimentoPratica = {
      stato: '7-CHIUSA',
      ultimoCambioStato: null,
      aggiornataIl: null,
      creataIl: giorniFa(45),
    }
    expect(statoScadenza(senzaStoria, ADESSO).scaduta).toBe(true)
    expect(mancano(senzaStoria)).toBe(GIORNI_DOPO_CHIUSURA - 45)
  })

  test('il preavviso si accende negli ultimi 7 giorni e non dopo la scadenza', () => {
    expect(statoScadenza(pratica('7-CHIUSA', 22), ADESSO).inPreavviso).toBe(false)
    expect(statoScadenza(pratica('7-CHIUSA', 23), ADESSO).inPreavviso).toBe(true)
    expect(statoScadenza(pratica('7-CHIUSA', 30), ADESSO).inPreavviso).toBe(true)
    expect(statoScadenza(pratica('7-CHIUSA', 31), ADESSO).inPreavviso).toBe(false)
  })

  test('GIORNI_PREAVVISO è la soglia dichiarata, non un numero scritto altrove', () => {
    const alLimite = pratica('7-CHIUSA', GIORNI_DOPO_CHIUSURA - GIORNI_PREAVVISO)
    expect(statoScadenza(alLimite, ADESSO).giorniMancanti).toBe(GIORNI_PREAVVISO)
    expect(statoScadenza(alLimite, ADESSO).inPreavviso).toBe(true)
  })

  test('dataCancellazione ritorna una data, non solo un conteggio', () => {
    const p = pratica('7-CHIUSA', 10)
    const attesa = new Date(Date.parse(p.ultimoCambioStato!) + GIORNI_DOPO_CHIUSURA * 24 * 60 * 60 * 1000)
    expect(dataCancellazione(p).toISOString()).toBe(attesa.toISOString())
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/services/fascicolo/__tests__/scadenza.test.ts`
Expected: FAIL — `Failed to resolve import "../scadenza"`.

- [ ] **Step 3: Scrivere l'implementazione minima**

Crea `src/services/fascicolo/scadenza.ts`. **Nessun import**: il modulo deve restare digeribile anche da Deno, che lo importerà nella Edge Function di pulizia (Task 7).

```ts
/**
 * Quando scadono i documenti di un fascicolo.
 *
 * I file caricati non restano per sempre: un archivio che cresce e non si svuota diventa un
 * costo e un rischio. La data di cancellazione si legge dallo stato della pratica, e questa è
 * l'unica dichiarazione della regola — la usano sia l'interfaccia, che mostra la data al
 * tecnico, sia la Edge Function che di notte cancella davvero.
 *
 * Il modulo non importa nulla apposta: viene caricato anche da Deno, dove `@/` non esiste.
 */

/**
 * Stati che avviano il conto dei 30 giorni. Solo il vocabolario DM329: `COMPLETATA`, del
 * vocabolario vecchio, non ospita schede tecniche e quindi nemmeno fascicoli.
 *
 * `ARCHIVIATA NON FINITA` ha spazi, non trattini bassi: è la stringa esatta che sta a database.
 */
export const STATI_CHIUSI: readonly string[] = ['7-CHIUSA', 'ARCHIVIATA NON FINITA']

/** Giorni dopo il passaggio in uno stato chiuso. */
export const GIORNI_DOPO_CHIUSURA = 30

/** Tetto: giorni senza alcun movimento, qualunque sia lo stato. */
export const GIORNI_SENZA_MOVIMENTO = 180

/** Con meno giorni di questi alla cancellazione si preavvisa. */
export const GIORNI_PREAVVISO = 7

const GIORNO = 24 * 60 * 60 * 1000

/** Ciò che della pratica serve a datare la scadenza. */
export interface MovimentoPratica {
  stato: string
  /** Ultimo cambio di stato, da `request_history`. Null per le pratiche senza storia. */
  ultimoCambioStato: string | null
  /** Ultima modifica qualsiasi: `requests.updated_at`. */
  aggiornataIl: string | null
  /** Ripiego quando la storia manca. */
  creataIl: string
}

/** Millisecondi di una data ISO, o NaN se assente o illeggibile. */
const istante = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : NaN)

/**
 * Data in cui i documenti della pratica vanno cancellati.
 *
 * È il **minimo** fra le due scadenze, e il minimo è ciò che rende i 180 giorni un tetto vero:
 * una pratica chiusa scade a 30 giorni anche se la si continua a ritoccare.
 */
export const dataCancellazione = (p: MovimentoPratica): Date => {
  const creata = istante(p.creataIl)
  const cambio = Number.isNaN(istante(p.ultimoCambioStato)) ? creata : istante(p.ultimoCambioStato)
  const modifica = Number.isNaN(istante(p.aggiornataIl)) ? cambio : istante(p.aggiornataIl)

  const perImmobilita = Math.max(cambio, modifica) + GIORNI_SENZA_MOVIMENTO * GIORNO
  const perChiusura = STATI_CHIUSI.includes(p.stato)
    ? cambio + GIORNI_DOPO_CHIUSURA * GIORNO
    : Number.POSITIVE_INFINITY

  return new Date(Math.min(perChiusura, perImmobilita))
}

/** La scadenza vista da un certo momento. */
export interface StatoScadenza {
  data: Date
  /** Negativi quando la data è passata. */
  giorniMancanti: number
  scaduta: boolean
  /** Dentro la finestra di preavviso e non ancora scaduta. */
  inPreavviso: boolean
}

export const statoScadenza = (p: MovimentoPratica, adesso: Date): StatoScadenza => {
  const data = dataCancellazione(p)
  const giorniMancanti = Math.round((data.getTime() - adesso.getTime()) / GIORNO)
  const scaduta = data.getTime() <= adesso.getTime()
  return { data, giorniMancanti, scaduta, inPreavviso: !scaduta && giorniMancanti <= GIORNI_PREAVVISO }
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/services/fascicolo/__tests__/scadenza.test.ts`
Expected: PASS, 11 test.

Poi la suite intera, per essere certi di non aver rotto nulla: `npx vitest run` → 567 test passati.

- [ ] **Step 5: Commit**

```bash
git add src/services/fascicolo/scadenza.ts src/services/fascicolo/__tests__/scadenza.test.ts
git commit -m "feat(fascicolo): la data di cancellazione si legge dallo stato della pratica"
```

---

### Task 2: Schema, bucket e permessi in produzione

Nessun test automatico: si verifica interrogando il database vero, subito dopo averlo modificato.

**Files:**
- Create: `supabase/migrations/20260811_fascicolo_persistenza.sql` (traccia nel repo di ciò che è stato applicato)

**Interfaces:**
- Consumes: niente.
- Produces: tabelle `fascicolo_documenti` e `fascicolo_scadenze`, vista `fascicolo_movimenti`, funzione `can_access_fascicolo(uuid)`, bucket `fascicoli`.

- [ ] **Step 1: Scrivere la migration**

Crea `supabase/migrations/20260811_fascicolo_persistenza.sql`:

```sql
-- Persistenza dei documenti del fascicolo apparecchiatura.
-- Il legame con l'apparecchiatura è il codice di scheda (C1.1, S1…): le apparecchiature non
-- hanno identità propria a database, vivono dentro dm329_technical_data.equipment_data.

create table if not exists public.fascicolo_documenti (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  -- Codice dell'apparecchiatura nella scheda. Non è una FK: non esiste una tabella da puntare.
  codice text not null,
  -- 'sorgente' = file caricato dal tecnico; 'fascicolo' = il PDF composto.
  tipo text not null default 'sorgente' check (tipo in ('sorgente', 'fascicolo')),
  -- Ruoli coperti dal documento. Più d'uno per i file misti certificato+istruzioni.
  ruoli text[] not null default '{}',
  -- Codice della valvola a cui il documento si riferisce, quando le valvole sono più d'una.
  valvola text,
  confidenza numeric,
  motivazione text,
  origine text check (origine in ('ai', 'euristica', 'manuale')),
  file_name text not null,
  file_path text not null unique,
  file_size bigint not null,
  mime_type text,
  uploaded_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists fascicolo_documenti_pratica_codice
  on public.fascicolo_documenti (request_id, codice);

-- Riga unica «fascicolo scaduto il …»: una per apparecchiatura, non una per file.
create table if not exists public.fascicolo_scadenze (
  request_id uuid not null references public.requests(id) on delete cascade,
  codice text not null,
  purgato_il timestamptz not null default now(),
  n_file integer not null default 0,
  primary key (request_id, codice)
);

-- Chi vede la scheda tecnica vede il fascicolo, condivisione compresa.
-- Sta in una funzione sola perché serve a cinque policy: due tabelle e tre operazioni di Storage.
create or replace function public.can_access_fascicolo(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dm329_technical_data t
    where t.request_id = p_request_id
      and (
        exists (select 1 from public.users u
                where u.id = auth.uid() and u.role in ('admin', 'userdm329'))
        or public.is_tecnico_assigned_to_request(t.request_id)
        or public.has_shared_access_to_technical_data(t.id)
      )
  );
$$;

alter table public.fascicolo_documenti enable row level security;
alter table public.fascicolo_scadenze enable row level security;

drop policy if exists "Accesso ai documenti del fascicolo" on public.fascicolo_documenti;
create policy "Accesso ai documenti del fascicolo"
  on public.fascicolo_documenti for all
  using (public.can_access_fascicolo(request_id))
  with check (public.can_access_fascicolo(request_id));

-- Concede anche la cancellazione a chi modifica la scheda, mentre sulla scheda stessa è
-- riservata agli admin: togliere un file caricato per sbaglio è lavoro ordinario, e la nota di
-- scadenza dev'essere ripulibile al primo nuovo caricamento.
drop policy if exists "Accesso alle scadenze del fascicolo" on public.fascicolo_scadenze;
create policy "Accesso alle scadenze del fascicolo"
  on public.fascicolo_scadenze for all
  using (public.can_access_fascicolo(request_id))
  with check (public.can_access_fascicolo(request_id));

-- Bucket privato, distinto da `attachments`: i due hanno regole di visibilità diverse.
insert into storage.buckets (id, name, public)
values ('fascicoli', 'fascicoli', false)
on conflict (id) do nothing;

-- Il request_id è il primo segmento del percorso: {request_id}/{codice}/{file}
-- `case` e non `and`: `storage.objects` è condivisa fra i bucket, e quelli di `attachments`
-- hanno percorsi che cominciano con `requests/`. Postgres non garantisce l'ordine di
-- valutazione dei termini di un `and`, quindi `'requests'::uuid` potrebbe essere valutato
-- prima del filtro sul bucket e far fallire le query sugli allegati; nel `case` l'ordine è
-- garantito.
drop policy if exists "Accesso agli oggetti del fascicolo" on storage.objects;
create policy "Accesso agli oggetti del fascicolo"
  on storage.objects for all
  using (
    case when bucket_id = 'fascicoli'
         then public.can_access_fascicolo(((storage.foldername(name))[1])::uuid)
         else false end
  )
  with check (
    case when bucket_id = 'fascicoli'
         then public.can_access_fascicolo(((storage.foldername(name))[1])::uuid)
         else false end
  );

-- Ciò che serve a datare la scadenza, per le sole pratiche che hanno documenti.
-- security_invoker: la vista non deve diventare una scorciatoia per leggere le pratiche altrui.
create or replace view public.fascicolo_movimenti
with (security_invoker = on) as
select
  r.id as request_id,
  r.status as stato,
  r.updated_at as aggiornata_il,
  r.created_at as creata_il,
  (select max(h.created_at) from public.request_history h where h.request_id = r.id)
    as ultimo_cambio_stato
from public.requests r
where exists (select 1 from public.fascicolo_documenti d where d.request_id = r.id);
```

- [ ] **Step 2: Applicare la migration in produzione**

Le credenziali sono in `.env.local` nel worktree. Da `bash`, uno script che legge il file SQL e lo manda alla Management API — `curl`, non `urllib`, che Cloudflare blocca:

```bash
set -a; . ./.env.local; set +a
python -c "import json,sys;print(json.dumps({'query':open(sys.argv[1],encoding='utf-8').read()}))" \
  supabase/migrations/20260811_fascicolo_persistenza.sql > /tmp/mig.json
curl -s -X POST "https://api.supabase.com/v1/projects/uphftgpwisdiubuhohnc/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" --data-binary @/tmp/mig.json
```

Expected: `[]` — nessun errore. Se torna un messaggio d'errore, correggere l'SQL e riapplicare: la migration è scritta per essere rieseguibile (`if not exists`, `or replace`, `drop policy if exists`).

- [ ] **Step 3: Verificare che ciò che serve esista davvero**

Stessa via, con questa query:

```sql
select
  (select count(*) from information_schema.tables
     where table_name in ('fascicolo_documenti','fascicolo_scadenze')) as tabelle,
  (select count(*) from pg_policies
     where tablename in ('fascicolo_documenti','fascicolo_scadenze')) as policy_tabelle,
  (select count(*) from pg_policies
     where tablename = 'objects' and policyname = 'Accesso agli oggetti del fascicolo') as policy_storage,
  (select count(*) from storage.buckets where id = 'fascicoli') as bucket,
  (select count(*) from pg_proc where proname = 'can_access_fascicolo') as funzione,
  (select count(*) from information_schema.views where table_name = 'fascicolo_movimenti') as vista;
```

Expected: `tabelle 2, policy_tabelle 2, policy_storage 1, bucket 1, funzione 1, vista 1`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260811_fascicolo_persistenza.sql
git commit -m "feat(fascicolo): tabelle, bucket e permessi per i documenti conservati"
```

---

### Task 3: Il servizio che parla con database e Storage

**Files:**
- Create: `src/services/api/fascicoloDocumenti.ts`
- Modify: `src/services/fascicolo/types.ts` (il documento non porta più per forza un `File`)
- Create: `src/services/fascicolo/sorgente.ts`
- Test: `src/services/fascicolo/__tests__/sorgente.test.ts`

**Interfaces:**
- Consumes: `RuoloDocumento` da `types.ts`.
- Produces:
  - `DocumentoFascicolo` con `nome`, `peso`, `file?`, `filePath?`, `tipo?`
  - `fascicoloDocumentiApi.elenca(requestId, codice) => Promise<DocumentoFascicolo[]>`
  - `fascicoloDocumentiApi.carica({ requestId, codice, file, tipo }) => Promise<DocumentoFascicolo>`
  - `fascicoloDocumentiApi.aggiornaClassificazione(id, patch) => Promise<void>`
  - `fascicoloDocumentiApi.elimina(id) => Promise<void>`
  - `fascicoloDocumentiApi.eliminaOrfani(requestId, codiciValidi) => Promise<number>`
  - `fascicoloDocumentiApi.scadenzaDi(requestId, codice) => Promise<{ purgato_il: string; n_file: number } | null>`
  - `apriDocumento(doc) => Promise<File>` e `eUnImmagine(doc) => boolean` da `sorgente.ts`
  - `TETTO_BYTE_APPARECCHIATURA = 50 * 1024 * 1024`

- [ ] **Step 1: Cambiare la forma del documento**

In `src/services/fascicolo/types.ts`, sostituire l'interfaccia `DocumentoFascicolo` (righe 100-118) con:

```ts
/** Un documento del fascicolo: caricato ora, o già salvato e riletto dal database. */
export interface DocumentoFascicolo {
  id: string
  nome: string
  /** Byte. Si tiene a parte perché per i documenti salvati il file non è in memoria. */
  peso: number
  mime?: string | null
  /** Presente per ciò che si è appena trascinato, prima che il caricamento finisca. */
  file?: File
  /** Presente per ciò che sta nel bucket `fascicoli`. Almeno uno dei due c'è sempre. */
  filePath?: string
  /** `fascicolo` è il PDF composto, che convive con i suoi sorgenti. */
  tipo?: 'sorgente' | 'fascicolo'
  /**
   * Ruoli che il documento ricopre. Sono più d'uno quando un file contiene sia il certificato
   * sia le istruzioni: in quel caso entra nel fascicolo una volta sola, al primo dei suoi posti.
   * Vuoto = non riconosciuto, e resta fuori finché non gliene si assegna uno a mano.
   */
  ruoli: RuoloDocumento[]
  /** Codice della valvola a cui il documento si riferisce, quando le valvole sono più d'una. */
  valvola?: string | null
  /** 0-1. Sotto la soglia di fiducia la classificazione si mostra come da verificare. */
  confidenza?: number
  /** Una riga sul perché di quel ruolo, mostrata accanto al file. */
  motivazione?: string
  /** `euristica` quando la classificazione è un ripiego senza AI. */
  origine?: 'ai' | 'euristica' | 'manuale'
}
```

- [ ] **Step 2: Scrivere il test che fallisce**

Crea `src/services/fascicolo/__tests__/sorgente.test.ts`. Verifica solo il riconoscimento immagine/PDF, che è puro; lo scaricamento dallo Storage non lo è e si prova in produzione.

```ts
import { describe, test, expect } from 'vitest'
import { eUnImmagine } from '../sorgente'
import type { DocumentoFascicolo } from '../types'

const doc = (nome: string, mime?: string): DocumentoFascicolo =>
  ({ id: 'x', nome, peso: 1, mime, ruoli: [] })

describe('eUnImmagine', () => {
  test('riconosce le immagini dal tipo MIME', () => {
    expect(eUnImmagine(doc('targhetta', 'image/jpeg'))).toBe(true)
    expect(eUnImmagine(doc('certificato', 'application/pdf'))).toBe(false)
  })

  test('senza tipo MIME ripiega sull’estensione, maiuscole comprese', () => {
    expect(eUnImmagine(doc('TARGHETTA.JPG'))).toBe(true)
    expect(eUnImmagine(doc('foto.heic'))).toBe(true)
    expect(eUnImmagine(doc('certificato.pdf'))).toBe(false)
  })

  test('un nome senza estensione non è un’immagine', () => {
    expect(eUnImmagine(doc('scansione'))).toBe(false)
  })
})
```

- [ ] **Step 3: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/services/fascicolo/__tests__/sorgente.test.ts`
Expected: FAIL — `Failed to resolve import "../sorgente"`.

- [ ] **Step 4: Scrivere `sorgente.ts`**

```ts
import { fascicoloDocumentiApi } from '@/services/api/fascicoloDocumenti'
import type { DocumentoFascicolo } from './types'

/**
 * Da dove prendere i byte di un documento.
 *
 * Un documento appena trascinato ha il `File` in memoria; uno riletto dal database ha solo il
 * percorso nel bucket. Chi compone il PDF non deve sapere quale dei due ha davanti.
 */

export const eUnImmagine = (doc: DocumentoFascicolo): boolean => {
  if (doc.mime) return doc.mime.startsWith('image/')
  return /\.(jpe?g|png|gif|webp|bmp|heic|tiff?)$/i.test(doc.nome)
}

/** I byte del documento, scaricandoli dallo Storage se non sono già in memoria. */
export const apriDocumento = async (doc: DocumentoFascicolo): Promise<File> => {
  if (doc.file) return doc.file
  if (!doc.filePath) throw new Error(`Il documento «${doc.nome}» non ha né file né percorso`)
  const blob = await fascicoloDocumentiApi.scarica(doc.filePath)
  return new File([blob], doc.nome, { type: doc.mime ?? blob.type })
}
```

- [ ] **Step 5: Scrivere il servizio**

Crea `src/services/api/fascicoloDocumenti.ts`:

```ts
import { supabase } from '../supabase'
import type { DocumentoFascicolo, RuoloDocumento } from '@/services/fascicolo/types'

/**
 * Documenti del fascicolo: bucket `fascicoli` per i byte, `fascicolo_documenti` per l'indice.
 *
 * Il legame con l'apparecchiatura è il suo codice di scheda. I codici non si rinumerano, ma un
 * numero liberato si riassegna: per questo `eliminaOrfani` esiste, ed è chiamata sia quando si
 * elimina una riga della scheda sia dalla passata notturna.
 */

export const BUCKET_FASCICOLI = 'fascicoli'

/** Tetto di peso per apparecchiatura: sette documenti fra certificati, manuali e foto ci stanno. */
export const TETTO_BYTE_APPARECCHIATURA = 50 * 1024 * 1024

interface RigaDocumento {
  id: string
  request_id: string
  codice: string
  tipo: 'sorgente' | 'fascicolo'
  ruoli: string[] | null
  valvola: string | null
  confidenza: number | null
  motivazione: string | null
  origine: 'ai' | 'euristica' | 'manuale' | null
  file_name: string
  file_path: string
  file_size: number
  mime_type: string | null
  created_at: string
}

const daRiga = (r: RigaDocumento): DocumentoFascicolo => ({
  id: r.id,
  nome: r.file_name,
  peso: r.file_size,
  mime: r.mime_type,
  filePath: r.file_path,
  tipo: r.tipo,
  ruoli: (r.ruoli ?? []) as RuoloDocumento[],
  valvola: r.valvola,
  confidenza: r.confidenza ?? undefined,
  motivazione: r.motivazione ?? undefined,
  origine: r.origine ?? undefined,
})

export interface CaricaDocumentoInput {
  requestId: string
  codice: string
  file: File
  tipo?: 'sorgente' | 'fascicolo'
}

export interface PatchClassificazione {
  ruoli: RuoloDocumento[]
  valvola?: string | null
  confidenza?: number
  motivazione?: string
  origine?: 'ai' | 'euristica' | 'manuale'
}

export const fascicoloDocumentiApi = {
  /** Documenti di un'apparecchiatura, nell'ordine in cui sono stati caricati. */
  elenca: async (requestId: string, codice: string): Promise<DocumentoFascicolo[]> => {
    const { data, error } = await supabase
      .from('fascicolo_documenti')
      .select('*')
      .eq('request_id', requestId)
      .eq('codice', codice)
      .order('created_at', { ascending: true })

    if (error) throw error
    return (data ?? []).map(daRiga)
  },

  carica: async ({ requestId, codice, file, tipo = 'sorgente' }: CaricaDocumentoInput): Promise<DocumentoFascicolo> => {
    const { data: sessione } = await supabase.auth.getSession()
    if (!sessione.session) throw new Error('Non autenticato')

    // Il tetto è per apparecchiatura: il limite scatta dove il tecnico sta lavorando.
    const gia = await fascicoloDocumentiApi.pesoDi(requestId, codice)
    if (gia + file.size > TETTO_BYTE_APPARECCHIATURA) {
      const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`
      throw new Error(
        `L'apparecchiatura ${codice} arriverebbe a ${mb(gia + file.size)}, oltre il tetto di ${mb(TETTO_BYTE_APPARECCHIATURA)}.`
      )
    }

    const nomePulito = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `${requestId}/${codice}/${Date.now()}_${nomePulito}`

    const { error: erroreUpload } = await supabase.storage
      .from(BUCKET_FASCICOLI)
      .upload(filePath, file, { cacheControl: '3600', upsert: false })
    if (erroreUpload) throw new Error(`Errore nel caricamento: ${erroreUpload.message}`)

    const { data, error } = await supabase
      .from('fascicolo_documenti')
      .insert({
        request_id: requestId,
        codice,
        tipo,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: sessione.session.user.id,
      })
      .select('*')
      .single()

    if (error) {
      // Senza la riga il file sarebbe un peso invisibile: si toglie subito.
      await supabase.storage.from(BUCKET_FASCICOLI).remove([filePath])
      throw new Error(`Errore nel salvataggio del documento: ${error.message}`)
    }

    // La riga di scadenza vale finché non si ricarica: ora non è più vera.
    await supabase.from('fascicolo_scadenze').delete().eq('request_id', requestId).eq('codice', codice)

    return daRiga(data as RigaDocumento)
  },

  /** Byte già occupati da un'apparecchiatura, fascicolo generato compreso. */
  pesoDi: async (requestId: string, codice: string): Promise<number> => {
    const { data, error } = await supabase
      .from('fascicolo_documenti')
      .select('file_size')
      .eq('request_id', requestId)
      .eq('codice', codice)

    if (error) throw error
    return (data ?? []).reduce((somma, r: { file_size: number }) => somma + r.file_size, 0)
  },

  aggiornaClassificazione: async (id: string, patch: PatchClassificazione): Promise<void> => {
    const { error } = await supabase
      .from('fascicolo_documenti')
      .update({
        ruoli: patch.ruoli,
        valvola: patch.valvola ?? null,
        confidenza: patch.confidenza ?? null,
        motivazione: patch.motivazione ?? null,
        origine: patch.origine ?? null,
      })
      .eq('id', id)

    if (error) throw error
  },

  elimina: async (id: string): Promise<void> => {
    const { data, error: erroreLettura } = await supabase
      .from('fascicolo_documenti')
      .select('file_path')
      .eq('id', id)
      .single()
    if (erroreLettura) throw erroreLettura

    // Prima i byte, poi la riga: al contrario un errore lascerebbe un file senza indice.
    const { error: erroreStorage } = await supabase.storage
      .from(BUCKET_FASCICOLI)
      .remove([(data as { file_path: string }).file_path])
    if (erroreStorage) console.error('Rimozione del file non riuscita:', erroreStorage)

    const { error } = await supabase.from('fascicolo_documenti').delete().eq('id', id)
    if (error) throw error
  },

  /**
   * Cancella i documenti agganciati a codici che la scheda non contiene più.
   *
   * Serve perché un numero liberato si riassegna: senza questa passata un serbatoio nuovo
   * chiamato `S2` erediterebbe i documenti del vecchio `S2`.
   */
  eliminaOrfani: async (requestId: string, codiciValidi: string[]): Promise<number> => {
    const { data, error } = await supabase
      .from('fascicolo_documenti')
      .select('id, codice, file_path')
      .eq('request_id', requestId)

    if (error) throw error
    const validi = new Set(codiciValidi)
    const orfani = (data ?? []).filter((r: { codice: string }) => !validi.has(r.codice))
    if (orfani.length === 0) return 0

    await supabase.storage
      .from(BUCKET_FASCICOLI)
      .remove(orfani.map((r: { file_path: string }) => r.file_path))
    const { error: erroreDelete } = await supabase
      .from('fascicolo_documenti')
      .delete()
      .in('id', orfani.map((r: { id: string }) => r.id))
    if (erroreDelete) throw erroreDelete

    return orfani.length
  },

  scarica: async (filePath: string): Promise<Blob> => {
    const { data, error } = await supabase.storage.from(BUCKET_FASCICOLI).download(filePath)
    if (error) throw new Error(`Errore nello scaricamento: ${error.message}`)
    return data
  },

  /** La nota «fascicolo scaduto il …», se i documenti sono stati cancellati. */
  scadenzaDi: async (
    requestId: string,
    codice: string
  ): Promise<{ purgato_il: string; n_file: number } | null> => {
    const { data, error } = await supabase
      .from('fascicolo_scadenze')
      .select('purgato_il, n_file')
      .eq('request_id', requestId)
      .eq('codice', codice)
      .maybeSingle()

    if (error) throw error
    return data ?? null
  },
}
```

- [ ] **Step 6: Eseguire i test e verificare che passino**

Run: `npx vitest run src/services/fascicolo/__tests__/sorgente.test.ts`
Expected: PASS, 3 test.

I test esistenti che costruivano documenti con `file:` vanno adeguati alla forma nuova — `ordina.test.ts` usa già solo `{ id, ruoli, valvola }` e non è toccato. Verifica: `npx vitest run` → tutto verde. Se `componiPdf.test.ts` o `euristica.test.ts` si rompono, adegua i costruttori dei documenti nel test, non l'implementazione.

- [ ] **Step 7: Commit**

```bash
git add src/services/api/fascicoloDocumenti.ts src/services/fascicolo/sorgente.ts \
        src/services/fascicolo/types.ts src/services/fascicolo/__tests__/sorgente.test.ts
git commit -m "feat(fascicolo): i documenti si salvano nel bucket e nella loro tabella"
```

---

### Task 4: La sezione legge e scrive dal database

**Files:**
- Modify: `src/components/technicalSheet/fascicolo/FascicoloSection.tsx`
- Modify: `src/components/technicalSheet/table/UnifiedEquipmentTable.tsx:421-432` (lo stato in memoria diventa superfluo), `:388-403` (nuova prop `requestId`)
- Modify: `src/components/technicalSheet/TechnicalSheetForm.tsx:30-45, 520-535` (far scendere `requestId`)
- Modify: `src/pages/TechnicalDetails.tsx:375-390` (passare `request.id`)
- Modify: `src/components/technicalSheet/table/EquipmentDetailDialog.tsx:36-60, 246-280` (la riga porta `requestId` e `codice`)

**Interfaces:**
- Consumes: `fascicoloDocumentiApi`, `apriDocumento`, `eUnImmagine` dal Task 3.
- Produces: `FascicoloSection` con prop `{ contesto, nomeFile, requestId, codice }` — non più `documenti` e `onCambia`.

- [ ] **Step 1: Far scendere `requestId` fino alla tabella**

In `TechnicalDetails.tsx`, dove si rende `<TechnicalSheetForm>` (riga ~375), aggiungere `requestId={request.id}` accanto a `codicePratica`.

In `TechnicalSheetForm.tsx`, aggiungere alla `interface TechnicalSheetFormProps`, sotto `codicePratica`:

```ts
  /** Pratica a cui appartengono i fascicoli: serve a salvarne i documenti. */
  requestId?: string
```

destrutturarlo con `requestId = ''` accanto a `codicePratica = ''` (riga ~133) e passarlo a `<UnifiedEquipmentTable requestId={requestId} …>` (riga ~528).

In `UnifiedEquipmentTable.tsx`, aggiungere alla props la stessa riga e destrutturarla.

- [ ] **Step 2: Togliere lo stato in memoria**

In `UnifiedEquipmentTable.tsx` cancellare il blocco `fascicoli`/`documentiDi`/`cambiaDocumenti` (righe 421-432) e l'import di `DocumentoFascicolo` (riga 17): i documenti non passano più di qui. In `fascicoloDi` (riga ~590) sostituire i campi `documenti` e `onCambia` con `requestId` e `codice`; `codice` è già l'argomento `code` che la funzione riceve.

In `EquipmentDetailDialog.tsx`, l'interfaccia `RigaFascicolo` (righe ~45-55) perde `documenti` e `onCambia` e guadagna:

```ts
  /** Pratica e codice: insieme individuano i documenti salvati di questa apparecchiatura. */
  requestId: string
  codice: string
```

e `<FascicoloSection>` (riga ~272) passa `requestId={fascicolo.requestId} codice={fascicolo.codice}` al posto di `documenti` e `onCambia`.

- [ ] **Step 3: Riscrivere il corpo di `FascicoloSection`**

Le props diventano:

```ts
export interface FascicoloSectionProps {
  contesto: ContestoFascicolo
  /** Nome del file da scaricare, già composto dal codice pratica. */
  nomeFile: string
  requestId: string
  codice: string
}
```

Lo stato dei documenti arriva da TanStack Query. Sostituire l'intestazione del componente (righe 56-67) con:

```ts
export const FascicoloSection = ({ contesto, nomeFile, requestId, codice }: FascicoloSectionProps) => {
  const queryClient = useQueryClient()
  const chiave = ['fascicolo-documenti', requestId, codice]

  const { data: documenti = [], isLoading } = useQuery({
    queryKey: chiave,
    queryFn: () => fascicoloDocumentiApi.elenca(requestId, codice),
    enabled: Boolean(requestId && codice),
  })

  const { data: scadenza } = useQuery({
    queryKey: ['fascicolo-scadenza', requestId, codice],
    queryFn: () => fascicoloDocumentiApi.scadenzaDi(requestId, codice),
    enabled: Boolean(requestId && codice),
  })

  const ricarica = () => {
    queryClient.invalidateQueries({ queryKey: chiave })
    queryClient.invalidateQueries({ queryKey: ['fascicolo-scadenza', requestId, codice] })
  }
  …
```

`aggiungi` (righe 68-108) diventa: carica ogni file, poi classifica **solo i nuovi**, poi salva i ruoli.

```ts
  const aggiungi = async (files: FileList | File[]) => {
    const accettati = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf' || /\.(pdf|jpe?g|png|gif|webp|bmp|heic|tiff?)$/i.test(f.name)
    )
    if (accettati.length === 0) {
      setErrore('Si possono caricare solo PDF e immagini.')
      return
    }

    setErrore(null)
    setEsito(null)
    setStato('analisi')
    setAvanzamento('Caricamento dei documenti…')

    try {
      const caricati = []
      for (const file of accettati) {
        caricati.push(await fascicoloDocumentiApi.carica({ requestId, codice, file }))
      }
      ricarica()

      // Si classificano solo i file nuovi: rianalizzare l'insieme cancellerebbe le correzioni
      // fatte a mano sui documenti già salvati, oltre a riscaricarli e ripagare l'analisi.
      setAvanzamento('Riconoscimento dei documenti…')
      const { risultati, avviso: nota } = await classificaDocumenti(
        caricati.map((d, i) => ({ id: d.id, file: accettati[i] })),
        contesto,
        documenti
          .filter((d) => d.ruoli.length > 0)
          .map((d) => ({ nome: d.nome, ruoli: d.ruoli, valvola: d.valvola ?? null }))
      )

      for (const r of risultati) {
        await fascicoloDocumentiApi.aggiornaClassificazione(r.id, {
          ruoli: r.ruoli, valvola: r.valvola, confidenza: r.confidenza,
          motivazione: r.motivazione, origine: r.origine,
        })
      }
      setAvviso(nota ?? null)
      ricarica()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Caricamento non riuscito')
    } finally {
      setStato('pronto')
      setAvanzamento('')
    }
  }
```

`rimuovi` e `assegna` (righe 110-118) passano dal servizio:

```ts
  const rimuovi = async (id: string) => {
    setEsito(null)
    await fascicoloDocumentiApi.elimina(id)
    ricarica()
  }

  const assegna = async (id: string, ruoli: RuoloDocumento[]) => {
    setEsito(null)
    const doc = documenti.find((d) => d.id === id)
    await fascicoloDocumentiApi.aggiornaClassificazione(id, {
      ruoli, valvola: doc?.valvola, confidenza: doc?.confidenza,
      motivazione: doc?.motivazione, origine: 'manuale',
    })
    ricarica()
  }
```

`genera` (righe 120-142) risolve i byte e salva il prodotto accanto ai sorgenti:

```ts
  const genera = async () => {
    setErrore(null)
    setStato('generazione')
    try {
      const sorgenti = documenti.filter((d) => d.tipo !== 'fascicolo')
      const { sequenza, mancanti } = ordinaFascicolo(sorgenti, contesto)

      setAvanzamento('Lettura dei documenti…')
      const pagine = await Promise.all(
        sequenza.map(async (d) => ({
          file: await apriDocumento(d),
          etichetta: d.nome,
          foto: d.ruoli.some((r) => r === 'FOTO_TARGHETTA' || r === 'FOTO_TARGHETTA_PRINCIPALE'),
        }))
      )

      const composto = await componiFascicolo(pagine, { onProgresso: setAvanzamento })
      saveAs(composto.blob, nomeFile)

      // Il fascicolo precedente non serve più: ne esiste uno solo per apparecchiatura.
      const vecchio = documenti.find((d) => d.tipo === 'fascicolo')
      if (vecchio) await fascicoloDocumentiApi.elimina(vecchio.id)
      await fascicoloDocumentiApi.carica({
        requestId, codice, tipo: 'fascicolo',
        file: new File([composto.blob], nomeFile, { type: 'application/pdf' }),
      })
      ricarica()

      setEsito({ ...composto, mancanti })
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Generazione non riuscita')
    } finally {
      setStato('pronto')
      setAvanzamento('')
    }
  }
```

Nel corpo reso: `d.file.name` diventa `d.nome`, `d.file.size` diventa `d.peso`, `eUnImmagine(d.file)` diventa `eUnImmagine(d)`; il fascicolo generato si mostra in fondo all'elenco come voce a sé, con l'icona PDF e un pulsante di scaricamento che chiama `apriDocumento` e `saveAs`; `classificati` conta solo i sorgenti. Mentre `isLoading` è vero, al posto dell'elenco va una riga «Lettura dei documenti salvati…», altrimenti l'area sembra vuota per un istante e induce a ricaricare file già presenti.

Togliere la riga «I file restano solo per questa sessione» (riga 319) e sostituirla con il peso occupato, sommato dai documenti già in mano — non serve interrogare il database, l'elenco è già completo:

```ts
  const occupati = documenti.reduce((somma, d) => somma + d.peso, 0)
```

reso come `` `${peso(occupati)} di ${peso(TETTO_BYTE_APPARECCHIATURA)}` ``, in `warning.main` sopra l'80% del tetto.

Import da aggiungere in testa al file:

```ts
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fascicoloDocumentiApi, TETTO_BYTE_APPARECCHIATURA } from '@/services/api/fascicoloDocumenti'
import { apriDocumento, eUnImmagine } from '@/services/fascicolo/sorgente'
```

- [ ] **Step 4: Verificare che compili e che i test tengano**

Run: `npm run build`
Expected: build completata senza errori TypeScript.

Run: `npx vitest run`
Expected: tutti i test passati.

- [ ] **Step 5: Provare nel browser**

`npm run dev`, aprire una scheda tecnica DM329, aprire un'apparecchiatura, trascinare due documenti, **ricaricare la pagina**: i documenti devono essere ancora lì, coi ruoli assegnati. Generare il fascicolo: il PDF si scarica e compare in elenco come voce propria. Correggere un ruolo a mano, aggiungere un terzo file: la correzione precedente deve restare.

- [ ] **Step 6: Commit**

```bash
git add src/components/technicalSheet src/pages/TechnicalDetails.tsx
git commit -m "feat(fascicolo): i documenti sopravvivono al ricaricamento della pagina"
```

---

### Task 5: Classificare solo i file nuovi

**Files:**
- Modify: `src/services/fascicolo/classifica.ts:35-60`
- Modify: `supabase/functions/classifica-documenti-fascicolo/index.ts` (prompt e corpo della richiesta)

**Interfaces:**
- Consumes: `ContestoFascicolo`, `RisultatoClassificazione`.
- Produces: `classificaDocumenti(documenti, contesto, giaCoperti?)` dove
  `giaCoperti: { nome: string; ruoli: RuoloDocumento[]; valvola: string | null }[]`.

- [ ] **Step 1: Allargare la firma nel client**

In `classifica.ts`, cambiare la firma e il corpo della richiesta:

```ts
/** Documento già salvato e già classificato: al modello si dice che quel posto è occupato. */
export interface RuoloGiaCoperto {
  nome: string
  ruoli: RuoloDocumento[]
  valvola: string | null
}

export const classificaDocumenti = async (
  documenti: { id: string; file: File }[],
  contesto: ContestoFascicolo,
  giaCoperti: RuoloGiaCoperto[] = []
): Promise<EsitoClassificazione> => {
```

e nel `body` della `fetch`: `JSON.stringify({ contesto, documenti: documentiConProve, giaCoperti })`.

- [ ] **Step 2: Usarlo nella Edge Function**

In `supabase/functions/classifica-documenti-fascicolo/index.ts`, leggere `giaCoperti` dal corpo della richiesta e, quando l'array non è vuoto, aggiungere al prompt un paragrafo prima dell'elenco dei documenti da classificare:

```ts
const giaCopertiTesto = (giaCoperti: { nome: string; ruoli: string[]; valvola: string | null }[]) =>
  giaCoperti.length === 0
    ? ''
    : `\n\nQuesti posti del fascicolo sono già occupati da documenti caricati in precedenza, che NON devi riclassificare:\n` +
      giaCoperti.map((d) => `- «${d.nome}» → ${d.ruoli.join(' + ')}${d.valvola ? ` (valvola ${d.valvola})` : ''}`).join('\n') +
      `\nTienine conto: se un posto è già occupato, è meno probabile che un documento nuovo lo ricopra di nuovo — ma non è impossibile, perché un caricamento può correggere un errore precedente.`
```

- [ ] **Step 3: Deploy e prova in produzione**

```bash
npx supabase functions deploy classifica-documenti-fascicolo --project-ref uphftgpwisdiubuhohnc
```

Nel browser: su un'apparecchiatura che ha già certificato e istruzioni riconosciuti, aggiungere la foto della targhetta. Attesa: la foto viene riconosciuta come `FOTO_TARGHETTA` e i due documenti precedenti non cambiano ruolo né perdono l'eventuale correzione manuale.

- [ ] **Step 4: Verificare i test**

Run: `npx vitest run`
Expected: tutti passati. `euristica.test.ts` non è toccato: il ripiego senza AI continua a guardare solo i nomi.

- [ ] **Step 5: Commit**

```bash
git add src/services/fascicolo/classifica.ts supabase/functions/classifica-documenti-fascicolo/index.ts
git commit -m "feat(fascicolo): si riconoscono i file nuovi senza rifare quelli già salvati"
```

---

### Task 6: Eliminare una riga porta via i suoi documenti

**Files:**
- Modify: `src/components/technicalSheet/table/UnifiedEquipmentTable.tsx:461-482` (`dopoEliminazione`)

**Interfaces:**
- Consumes: `fascicoloDocumentiApi.eliminaOrfani`, `collectCodes` da `@/utils/equipmentCodes`.
- Produces: niente per i task successivi.

- [ ] **Step 1: Cancellare i documenti dei codici spariti**

In `dopoEliminazione`, dopo il `pruneSchedaRefs` e il `replace` degli array, aggiungere la potatura dei documenti. `collectCodes` è già esportata da `equipmentCodes.ts` e ritorna tutti i codici validi della scheda; le valvole aggiuntive non hanno fascicolo proprio e non entrano nel confronto.

```ts
  const dopoEliminazione = () => {
    setAperta(null)

    const attuale = getValues() as Record<string, any>
    const { scheda, changed } = pruneSchedaRefs(attuale)
    if (changed) {
      for (const [nome, fa] of Object.entries(fieldArrays)) {
        if (scheda[nome] !== attuale[nome]) fa.replace(scheda[nome] ?? [])
      }
    }

    // I codici si riassegnano: senza questa potatura un'apparecchiatura nuova che eredita il
    // numero di una eliminata si ritroverebbe in casa i documenti di quella vecchia.
    if (requestId) {
      const validi = [...collectCodes(scheda)]
      fascicoloDocumentiApi
        .eliminaOrfani(requestId, validi)
        .then((n) => { if (n > 0) queryClient.invalidateQueries({ queryKey: ['fascicolo-documenti'] }) })
        .catch((e) => console.error('Pulizia dei documenti orfani non riuscita:', e))
    }
  }
```

Import da aggiungere: `collectCodes` alla riga 30 (accanto a `compareCodes`, `nextFreeCode`, `pruneSchedaRefs`), `fascicoloDocumentiApi` dal servizio, e `useQueryClient` da `@tanstack/react-query` con `const queryClient = useQueryClient()` fra gli hook in testa al componente.

- [ ] **Step 2: Verificare che compili**

Run: `npm run build`
Expected: nessun errore.

- [ ] **Step 3: Provare nel browser**

Caricare un documento su `S2`, poi eliminare `S2` dalla tabella e confermare. Creare un nuovo serbatoio: riprende il codice `S2` e la sua sezione fascicolo deve essere **vuota**. Verificare anche a database che la riga sia sparita:

```sql
select count(*) from fascicolo_documenti where codice = 'S2' and request_id = '<id della pratica>';
```

Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add src/components/technicalSheet/table/UnifiedEquipmentTable.tsx
git commit -m "fix(fascicolo): eliminare un'apparecchiatura porta via i suoi documenti"
```

---

### Task 7: La passata notturna

**Files:**
- Create: `supabase/functions/pulisci-fascicoli-scaduti/index.ts`
- Create: `supabase/migrations/20260811_fascicolo_cron.sql`
- Modify: `src/types/index.ts:188-194` (`NotificationEventType`), `src/utils/eventIcons.tsx` (icona ed etichetta del tipo nuovo)

**Interfaces:**
- Consumes: `statoScadenza`, `GIORNI_PREAVVISO` da `src/services/fascicolo/scadenza.ts` (Task 1); vista `fascicolo_movimenti` (Task 2).
- Produces: Edge Function `pulisci-fascicoli-scaduti`, job `pulisci-fascicoli-scaduti` in `cron.job`, tipo di notifica `fascicolo_in_scadenza`.

- [ ] **Step 1: Scrivere la Edge Function**

Crea `supabase/functions/pulisci-fascicoli-scaduti/index.ts`. La regola non si riscrive: si importa quella già testata.

```ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { statoScadenza, GIORNI_PREAVVISO } from '../../../src/services/fascicolo/scadenza.ts'

/**
 * Edge Function: pulisci-fascicoli-scaduti
 *
 * Gira una volta al giorno, chiamata da pg_cron via pg_net. Fa tre cose: preavvisa chi ha
 * documenti in scadenza, cancella quelli scaduti, rimuove quelli agganciati a codici che la
 * scheda non contiene più.
 *
 * La regola di scadenza non è dichiarata qui: arriva da src/services/fascicolo/scadenza.ts,
 * la stessa che l'interfaccia usa per mostrare la data. Due copie divergerebbero.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKET = 'fascicoli'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const adesso = new Date()
  const esito = { preavvisate: 0, purgate: 0, fileCancellati: 0, orfaniRimossi: 0 }

  try {
    const { data: movimenti, error } = await supabase.from('fascicolo_movimenti').select('*')
    if (error) throw error

    for (const m of movimenti ?? []) {
      const stato = statoScadenza(
        {
          stato: m.stato,
          ultimoCambioStato: m.ultimo_cambio_stato,
          aggiornataIl: m.aggiornata_il,
          creataIl: m.creata_il,
        },
        adesso
      )

      if (stato.scaduta) {
        const { data: documenti } = await supabase
          .from('fascicolo_documenti')
          .select('id, codice, file_path')
          .eq('request_id', m.request_id)
        if (!documenti?.length) continue

        await supabase.storage.from(BUCKET).remove(documenti.map((d) => d.file_path))
        await supabase.from('fascicolo_documenti').delete().eq('request_id', m.request_id)

        // Una riga di scadenza per apparecchiatura, col numero di file che portava via.
        const perCodice = new Map<string, number>()
        for (const d of documenti) perCodice.set(d.codice, (perCodice.get(d.codice) ?? 0) + 1)
        await supabase.from('fascicolo_scadenze').upsert(
          [...perCodice].map(([codice, n_file]) => ({
            request_id: m.request_id, codice, n_file, purgato_il: adesso.toISOString(),
          })),
          { onConflict: 'request_id,codice' }
        )

        esito.purgate++
        esito.fileCancellati += documenti.length
        continue
      }

      if (stato.inPreavviso) {
        const inviata = await preavvisaSeServe(supabase, m.request_id, stato.data, adesso)
        if (inviata) esito.preavvisate++
      }
    }

    esito.orfaniRimossi = await rimuoviOrfani(supabase)

    return new Response(JSON.stringify({ success: true, ...esito }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (errore) {
    console.error('Pulizia non riuscita:', errore)
    return new Response(
      JSON.stringify({ success: false, error: String(errore), ...esito }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/** Avvisa tecnico assegnato e admin, una volta sola per finestra di preavviso. */
async function preavvisaSeServe(
  supabase: ReturnType<typeof createClient>,
  requestId: string,
  quando: Date,
  adesso: Date
): Promise<boolean> {
  const da = new Date(adesso.getTime() - GIORNI_PREAVVISO * 24 * 60 * 60 * 1000).toISOString()
  const { data: gia } = await supabase
    .from('notifications')
    .select('id')
    .eq('request_id', requestId)
    .eq('type', 'fascicolo_in_scadenza')
    .gte('created_at', da)
    .limit(1)
  if (gia?.length) return false

  const { data: pratica } = await supabase
    .from('requests')
    .select('assigned_to, title')
    .eq('id', requestId)
    .single()
  const { data: admin } = await supabase.from('users').select('id').eq('role', 'admin')

  const destinatari = new Set<string>((admin ?? []).map((u) => u.id))
  if (pratica?.assigned_to) destinatari.add(pratica.assigned_to)
  if (destinatari.size === 0) return false

  const giorno = quando.toLocaleDateString('it-IT')
  await supabase.from('notifications').insert(
    [...destinatari].map((user_id) => ({
      user_id,
      request_id: requestId,
      type: 'fascicolo_in_scadenza',
      event_type: 'fascicolo_in_scadenza',
      read: false,
      message: `I documenti del fascicolo di «${pratica?.title ?? 'una pratica'}» verranno cancellati il ${giorno}. Scaricali se ti servono.`,
    }))
  )
  return true
}

/**
 * Documenti agganciati a codici che la scheda non contiene più.
 *
 * L'interfaccia già li toglie quando si elimina una riga; questa è la rete per ciò che le
 * sfugge: importazioni Excel, retro-coding, modifiche fatte da un'altra sessione.
 */
async function rimuoviOrfani(supabase: ReturnType<typeof createClient>): Promise<number> {
  const { data: documenti } = await supabase
    .from('fascicolo_documenti')
    .select('id, request_id, codice, file_path')
  if (!documenti?.length) return 0

  const pratiche = [...new Set(documenti.map((d) => d.request_id))]
  const { data: schede, error } = await supabase
    .from('dm329_technical_data')
    .select('request_id, equipment_data')
    .in('request_id', pratiche)

  // Senza le schede ogni documento sembrerebbe orfano: meglio non cancellare niente che
  // cancellare tutto per una lettura fallita.
  if (error) throw error

  const codiciDi = new Map<string, Set<string>>()
  for (const s of schede ?? []) {
    const codici = new Set<string>()
    for (const valore of Object.values(s.equipment_data ?? {})) {
      if (!Array.isArray(valore)) continue
      for (const riga of valore) {
        if (riga && typeof riga.codice === 'string') codici.add(riga.codice.trim())
      }
    }
    codiciDi.set(s.request_id, codici)
  }

  // Una pratica di cui non è tornata la scheda si salta: è un'assenza di informazione, non la
  // prova che i codici non esistano più. 333 schede su 359 hanno equipment_data vuoto — sono
  // pratiche vecchie senza apparecchiature, e infatti non hanno documenti da rimuovere.
  const orfani = documenti.filter((d) => {
    const codici = codiciDi.get(d.request_id)
    return codici ? !codici.has(d.codice) : false
  })
  if (orfani.length === 0) return 0

  await supabase.storage.from(BUCKET).remove(orfani.map((d) => d.file_path))
  await supabase.from('fascicolo_documenti').delete().in('id', orfani.map((d) => d.id))
  return orfani.length
}
```

- [ ] **Step 2: Deploy e prova a mano, prima di schedularla**

```bash
npx supabase functions deploy pulisci-fascicoli-scaduti --project-ref uphftgpwisdiubuhohnc
```

Se il deploy si lamenta dell'import fuori dalla cartella della funzione, copiare `src/services/fascicolo/scadenza.ts` in `supabase/functions/_shared/scadenza.ts`, importarlo da lì, e aggiungere `src/services/fascicolo/__tests__/scadenza-copia.test.ts` che legge i due file con `readFileSync` e asserisce che il contenuto coincida — così la divergenza si scopre a test, non in produzione.

Prova manuale, con la service role key da `.env.local`:

```bash
set -a; . ./.env.local; set +a
curl -s -X POST "$VITE_SUPABASE_URL/functions/v1/pulisci-fascicoli-scaduti" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{}'
```

Expected: `{"success":true,"preavvisate":0,"purgate":0,"fileCancellati":0,"orfaniRimossi":0}` su un database appena popolato. Verificare che i documenti caricati nei task precedenti **non** siano stati toccati: la pratica di prova è viva e recente, quindi non deve scadere.

- [ ] **Step 3: Provare che cancelli davvero**

Su una pratica di prova con documenti caricati, retrodatare la storia per simulare una chiusura vecchia, eseguire la funzione, poi verificare e rimettere le cose a posto. Da fare su una pratica di prova, non su una vera:

```sql
-- 1. simula una chiusura di 40 giorni fa
update requests set status = '7-CHIUSA', updated_at = now() - interval '40 days'
  where id = '<id della pratica di prova>';
insert into request_history (request_id, status_from, status_to, changed_by, created_at)
  values ('<id>', '4-DOCUMENTI_PRONTI', '7-CHIUSA', '<id utente>', now() - interval '40 days');
```

Poi rieseguire la `curl` del passo precedente. Expected: `purgate: 1` e `fileCancellati` pari al numero di documenti caricati. Verificare:

```sql
select (select count(*) from fascicolo_documenti where request_id = '<id>') as documenti,
       (select count(*) from fascicolo_scadenze where request_id = '<id>') as scadenze;
```

Expected: `documenti 0`, `scadenze` pari al numero di apparecchiature che avevano file.

- [ ] **Step 4: Schedulare la passata**

Crea `supabase/migrations/20260811_fascicolo_cron.sql` e applicalo come nel Task 2:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- La chiave sta nel Vault e non nel comando del job: cron.job è leggibile, un segreto in chiaro
-- lì dentro sarebbe un segreto in meno.
-- `create_secret` fallisce se il nome esiste già: la migration deve restare rieseguibile.
do $$
begin
  if exists (select 1 from vault.secrets where name = 'service_role_key') then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'service_role_key'),
      '<service role key>'
    );
  else
    perform vault.create_secret(
      '<service role key>',
      'service_role_key',
      'Chiave usata dai job notturni per chiamare le Edge Function'
    );
  end if;
end $$;

select cron.unschedule('pulisci-fascicoli-scaduti')
where exists (select 1 from cron.job where jobname = 'pulisci-fascicoli-scaduti');

select cron.schedule(
  'pulisci-fascicoli-scaduti',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://uphftgpwisdiubuhohnc.supabase.co/functions/v1/pulisci-fascicoli-scaduti',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Il valore della chiave si legge da `.env.local` e si sostituisce nel file **solo al momento di applicarlo**: non va committato. Nel file che resta nel repo lasciare il segnaposto `<service role key>` e un commento che dica dove trovarla.

Verifica:

```sql
select jobname, schedule, active from cron.job where jobname = 'pulisci-fascicoli-scaduti';
```

Expected: una riga, `0 3 * * *`, `active = true`.

- [ ] **Step 5: Far conoscere il tipo di notifica all'interfaccia**

In `src/types/index.ts`, aggiungere `| 'fascicolo_in_scadenza'` a `NotificationEventType` (righe 188-194).

In `src/utils/eventIcons.tsx`, aggiungere il caso a `EventType` e ai due `switch` che mappano icona e colore: icona `Schedule` da `@mui/icons-material`, colore `warning`, etichetta «Fascicolo in scadenza».

Run: `npm run build` → nessun errore.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/pulisci-fascicoli-scaduti supabase/migrations/20260811_fascicolo_cron.sql \
        src/types/index.ts src/utils/eventIcons.tsx
git commit -m "feat(fascicolo): una passata notturna preavvisa e cancella i documenti scaduti"
```

---

### Task 8: La scadenza si vede

L'ultimo pezzo d'interfaccia: la data di cancellazione, la nota di ciò che è già sparito, e la rifinitura estetica in blocco.

**Files:**
- Modify: `src/components/technicalSheet/fascicolo/FascicoloSection.tsx`
- Modify: `src/components/technicalSheet/table/EquipmentDetailDialog.tsx` (la riga porta i movimenti della pratica)
- Modify: `src/components/technicalSheet/table/UnifiedEquipmentTable.tsx`, `src/components/technicalSheet/TechnicalSheetForm.tsx`, `src/pages/TechnicalDetails.tsx` (far scendere stato e date della pratica)

**Interfaces:**
- Consumes: `statoScadenza`, `MovimentoPratica` (Task 1); `fascicoloDocumentiApi.scadenzaDi` (Task 3).
- Produces: niente per i task successivi.

- [ ] **Step 1: Far scendere i movimenti della pratica**

`TechnicalDetails.tsx` ha già `request`. Passare a `TechnicalSheetForm` una prop nuova:

```tsx
movimenti={{
  stato: request.status,
  ultimoCambioStato: ultimoCambioStato,   // vedi passo 2
  aggiornataIl: request.updated_at,
  creataIl: request.created_at,
}}
```

Dichiararla come `movimenti?: MovimentoPratica` in `TechnicalSheetFormProps` e in `UnifiedEquipmentTableProps`, infilarla in `RigaFascicolo` accanto a `requestId` e `codice`, e aggiungerla alle props della sezione — che nel Task 4 non la conosceva ancora:

```ts
export interface FascicoloSectionProps {
  contesto: ContestoFascicolo
  nomeFile: string
  requestId: string
  codice: string
  /** Stato e date della pratica: da qui si ricava quando i documenti verranno cancellati. */
  movimenti?: MovimentoPratica
}
```

con `import { statoScadenza, type MovimentoPratica } from '@/services/fascicolo/scadenza'`.

- [ ] **Step 2: Leggere l'ultimo cambio di stato**

In `TechnicalDetails.tsx`, accanto alle altre query, aggiungere:

```ts
const { data: ultimoCambioStato } = useQuery({
  queryKey: ['ultimo-cambio-stato', id],
  queryFn: async () => {
    const { data } = await supabase
      .from('request_history')
      .select('created_at')
      .eq('request_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data?.created_at ?? null
  },
  enabled: Boolean(id),
})
```

- [ ] **Step 3: Mostrarla nella sezione**

In `FascicoloSection`, sotto l'elenco dei documenti:

```tsx
{movimenti && documenti.length > 0 && (() => {
  const s = statoScadenza(movimenti, new Date())
  return (
    <Typography
      variant="caption"
      color={s.inPreavviso ? 'warning.main' : 'text.disabled'}
      sx={{ fontWeight: s.inPreavviso ? 600 : 400 }}
    >
      {s.inPreavviso
        ? `Attenzione: questi documenti verranno cancellati fra ${s.giorniMancanti} giorni, il ${s.data.toLocaleDateString('it-IT')}.`
        : `I documenti verranno cancellati il ${s.data.toLocaleDateString('it-IT')}.`}
    </Typography>
  )
})()}
```

E, quando i documenti non ci sono più ma la nota di scadenza esiste — la sezione resta caricabile, perché il tecnico deve poter ricominciare:

```tsx
{documenti.length === 0 && scadenza && (
  <Alert severity="info" sx={{ py: 0.25 }}>
    Fascicolo scaduto il {new Date(scadenza.purgato_il).toLocaleDateString('it-IT')}:
    {' '}{scadenza.n_file} file cancellati. Ricaricali per ricomporlo.
  </Alert>
)}
```

- [ ] **Step 4: Provare nel browser**

`npm run dev`. Su una pratica viva: la sezione dice la data a 180 giorni. Retrodatare una pratica di prova a 25 giorni dalla chiusura (query del Task 7, con `interval '25 days'`): la riga diventa ambrata e dice quanti giorni mancano. Eseguire a mano la funzione di pulizia su una pratica scaduta e ricaricare: al posto dell'elenco compare la nota «Fascicolo scaduto il …» e l'area di trascinamento resta attiva. Trascinare un file: la nota sparisce.

- [ ] **Step 5: Rifinitura estetica, in blocco**

Ora che la sezione ha tutti i suoi elementi — elenco, fascicolo generato, peso occupato, data di scadenza, nota di scaduto — sistemare spaziature, allineamenti e gerarchia dei caratteri in un passaggio solo, coerente con le altre sezioni della finestra dei dettagli.

- [ ] **Step 6: Verifica finale**

Run: `npx vitest run`
Expected: tutti i test passati, i 556 di partenza più i 14 nuovi.

Run: `npm run build`
Expected: build pulita.

- [ ] **Step 7: Commit**

```bash
git add src/components/technicalSheet src/pages/TechnicalDetails.tsx
git commit -m "feat(fascicolo): la data di cancellazione e la nota di scaduto si vedono nella sezione"
```

---

## Verifica finale del lavoro

Prima di considerare chiuso il branch:

- [ ] `npx vitest run` — tutti verdi
- [ ] `npm run build` — nessun errore
- [ ] Nel browser, ciclo completo: carico tre documenti su un'apparecchiatura, ricarico la pagina, li ritrovo; genero il fascicolo e lo ritrovo in elenco; correggo un ruolo e aggiungo un file, la correzione resta; elimino l'apparecchiatura e i documenti spariscono
- [ ] `select jobname, active from cron.job where jobname = 'pulisci-fascicoli-scaduti'` — attivo
- [ ] Chiamata manuale alla funzione di pulizia su database vero — risponde `success: true`
- [ ] Nessuna chiave stampata nei log né committata: `git log -p | grep -i "eyJ\|sbp_"` non trova nulla
