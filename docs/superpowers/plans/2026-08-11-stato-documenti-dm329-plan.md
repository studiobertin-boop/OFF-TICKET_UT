# Stato colorato documenti DM329 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colorare di verde "Genera relazione"/"Genera dichiarazioni" quando il documento è già salvato, aggiungere le pillole fascicolo per apparecchiatura sopra la tabella, un pulsante "Scarica documentazione completa", e fondere visivamente "Scheda dati" con il suo stato nel dettaglio pratica.

**Architecture:** Nuova tabella `relazione_documenti`/`relazione_scadenze` (bucket `relazioni`, cron gemello) replica 1:1 lo schema già in produzione per `fascicolo_documenti`/`dichiarazioni_documenti`. Un helper puro (`calcolaEsitiPerCodice`) estrae dal motore di classificazione esistente la sola decisione "questo codice richiede un adempimento INAIL", riusata sia per le pillole sia per il pulsante di scarico completo. `AzioneIcona` guadagna una variante piena per segnalare "pronto".

**Tech Stack:** Vite/React 18/TypeScript, MUI 6, TanStack Query, React Hook Form, Supabase (Postgres + Storage + Edge Functions Deno), Vitest.

## Global Constraints

- **Prerequisito non incluso in questo piano:** il branch `worktree-dichiarazioni-dm329` deve essere già unito a `main` prima di eseguire i Task 5 e 9 (che leggono `dichiarazioni_documenti`/usano `onDichiarazioni`, oggi assenti da `main`). Se non lo è ancora, è una decisione dell'utente da prendere prima, non durante questo piano — vedi il documento di design, sezione «Dipendenze da chiarire».
- Migrazioni SQL applicate in produzione via Management API (`curl` con `SUPABASE_ACCESS_TOKEN`), non tramite dashboard — per istruzioni vedi `CLAUDE.md` del repo.
- Convenzioni di stile del repo: nomi di funzioni/variabili in italiano, commenti solo dove il "perché" non è ovvio, test in `__tests__/` accanto al file, nessun test di UI (solo logica).
- Colore "pronto/verde" = `color="success"` + variante piena, stessa convenzione di `StatusChip`/`SchedaStatoMark` già in uso.

---

## Task 1: Persistenza della relazione — tabelle, bucket, cron

**Files:**
- Create: `supabase/migrations/20260811200000_relazione_persistenza.sql`
- Create: `supabase/migrations/20260811210000_relazione_cron.sql`

**Interfaces:**
- Produce: tabelle `public.relazione_documenti` (`id, request_id, file_name, file_path, file_size, mime_type, uploaded_by, created_at`), `public.relazione_scadenze` (`request_id pk, purgato_il, n_file`), bucket storage privato `relazioni`, vista `public.relazione_movimenti`, job cron `pulisci-relazioni-scadute` (03:05 giornaliero).
- Consuma: funzione `public.can_access_fascicolo(request_id)` già in produzione (da `20260811100000_fascicolo_persistenza.sql`), secret Vault `service_role_key`/`fascicolo_cron_secret` già presenti (nessun nuovo secret).

- [ ] **Step 1: Scrivi la migrazione di persistenza**

`supabase/migrations/20260811200000_relazione_persistenza.sql`:
```sql
-- Persistenza della relazione tecnica DM329, sullo stesso modello del fascicolo
-- apparecchiatura e delle dichiarazioni. Qui la granularità è la pratica intera (un solo
-- .docx): non esiste un concetto di "sorgenti", perché la relazione si genera dai dati
-- della scheda, non si compone da file caricati.

create table if not exists public.relazione_documenti (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  file_size bigint not null,
  mime_type text,
  uploaded_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists relazione_documenti_pratica
  on public.relazione_documenti (request_id);

-- Riga unica «relazione scaduta il …»: una per pratica, come per le dichiarazioni.
create table if not exists public.relazione_scadenze (
  request_id uuid primary key references public.requests(id) on delete cascade,
  purgato_il timestamptz not null default now(),
  n_file integer not null default 0
);

alter table public.relazione_documenti enable row level security;
alter table public.relazione_scadenze enable row level security;

drop policy if exists "Accesso ai documenti della relazione" on public.relazione_documenti;
create policy "Accesso ai documenti della relazione"
  on public.relazione_documenti for all
  to authenticated
  using (public.can_access_fascicolo(request_id))
  with check (public.can_access_fascicolo(request_id));

drop policy if exists "Accesso alle scadenze della relazione" on public.relazione_scadenze;
create policy "Accesso alle scadenze della relazione"
  on public.relazione_scadenze for all
  to authenticated
  using (public.can_access_fascicolo(request_id))
  with check (public.can_access_fascicolo(request_id));

-- Bucket privato, distinto da `fascicoli`/`dichiarazioni`/`attachments`.
insert into storage.buckets (id, name, public)
values ('relazioni', 'relazioni', false)
on conflict (id) do nothing;

-- Stesso schema delle policy Storage del fascicolo: il cast a uuid dentro un CASE, non un
-- AND, perché l'ordine di valutazione di AND non è garantito e romperebbe gli allegati del
-- bucket `attachments` (path che non cominciano con un uuid).
drop policy if exists "Accesso agli oggetti della relazione" on storage.objects;
create policy "Accesso agli oggetti della relazione"
  on storage.objects for all
  to authenticated
  using (
    case when bucket_id = 'relazioni'
         then public.can_access_fascicolo(((storage.foldername(name))[1])::uuid)
         else false end
  )
  with check (
    case when bucket_id = 'relazioni'
         then public.can_access_fascicolo(((storage.foldername(name))[1])::uuid)
         else false end
  );

create or replace view public.relazione_movimenti
with (security_invoker = on) as
select
  r.id as request_id,
  r.status as stato,
  r.updated_at as aggiornata_il,
  r.created_at as creata_il,
  (select max(h.created_at) from public.request_history h where h.request_id = r.id)
    as ultimo_cambio_stato
from public.requests r
where exists (select 1 from public.relazione_documenti d where d.request_id = r.id);
```

- [ ] **Step 2: Scrivi la migrazione del cron**

`supabase/migrations/20260811210000_relazione_cron.sql`:
```sql
-- Schedula la passata notturna della relazione, gemella di quella del fascicolo (03:00) e
-- delle dichiarazioni (03:10). Riusa gli stessi due secret del Vault: sono un'autorizzazione
-- di progetto, non specifica al fascicolo, e le Edge Function condividono già lo stesso
-- CRON_SECRET d'ambiente — non serve crearne di nuovi. Orario 03:05 per non accavallare le
-- altre due passate.

select cron.unschedule('pulisci-relazioni-scadute')
where exists (select 1 from cron.job where jobname = 'pulisci-relazioni-scadute');

select cron.schedule(
  'pulisci-relazioni-scadute',
  '5 3 * * *',
  $$
  select net.http_post(
    url := 'https://uphftgpwisdiubuhohnc.supabase.co/functions/v1/pulisci-relazioni-scadute',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'service_role_key'),
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets
                     where name = 'fascicolo_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 3: Applica entrambe le migrazioni in produzione**

Via Management API (`curl` con `SUPABASE_ACCESS_TOKEN`, non urllib — vedi `CLAUDE.md`), nell'ordine: prima `20260811200000_relazione_persistenza.sql`, poi `20260811210000_relazione_cron.sql`.

- [ ] **Step 4: Verifica**

Query di verifica via Data API (`SUPABASE_SERVICE_ROLE_KEY`):
```
curl -s "$VITE_SUPABASE_URL/rest/v1/relazione_documenti?select=id&limit=1" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Expected: `[]` (tabella esiste, vuota) e non un errore 404/42P01. Verifica anche il job cron:
```sql
select jobid, jobname, schedule from cron.job where jobname = 'pulisci-relazioni-scadute';
```
Expected: una riga con `schedule = '5 3 * * *'`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260811200000_relazione_persistenza.sql supabase/migrations/20260811210000_relazione_cron.sql
git commit -m "feat(relazione): persistenza su storage con scadenza automatica, sul modello del fascicolo"
```

---

## Task 2: Edge Function di pulizia notturna

**Files:**
- Create: `supabase/functions/pulisci-relazioni-scadute/index.ts`

**Interfaces:**
- Consuma: `statoScadenza`, `GIORNI_PREAVVISO` da `src/services/fascicolo/scadenza.ts` (import relativo, Deno non risolve `@/`); tabelle/vista del Task 1.
- Produce: endpoint HTTP protetto da `x-cron-key`, invocato dal job schedulato nel Task 1.

- [ ] **Step 1: Scrivi la Edge Function**

`supabase/functions/pulisci-relazioni-scadute/index.ts`:
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { statoScadenza, GIORNI_PREAVVISO } from '../../../src/services/fascicolo/scadenza.ts'

/**
 * Edge Function: pulisci-relazioni-scadute
 *
 * Gemella di pulisci-dichiarazioni-scadute, stessa struttura e stesso cron giornaliero, ma
 * per relazione_documenti/relazione_scadenze/relazione_movimenti e il bucket relazioni. La
 * regola di scadenza è la stessa identica di src/services/fascicolo/scadenza.ts — non
 * duplicata.
 */

const BUCKET = 'relazioni'
const PAGINA = 1000

serve(async (req) => {
  const chiaveAttesa = Deno.env.get('CRON_SECRET')
  if (!chiaveAttesa || req.headers.get('x-cron-key') !== chiaveAttesa) {
    return new Response(JSON.stringify({ success: false, error: 'Non autorizzato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const adesso = new Date()
  const esito = { preavvisate: 0, purgate: 0, fileCancellati: 0 }
  const errori: string[] = []

  try {
    const movimenti = await leggiTutto<{
      request_id: string
      stato: string
      aggiornata_il: string | null
      creata_il: string
      ultimo_cambio_stato: string | null
    }>(supabase, 'relazione_movimenti', '*', 'request_id')

    for (const m of movimenti) {
      try {
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
          const { data: documenti, error: erroreLettura } = await supabase
            .from('relazione_documenti')
            .select('id, file_path')
            .eq('request_id', m.request_id)
          if (erroreLettura) throw erroreLettura
          if (!documenti?.length) continue

          const confermati = await rimuoviByte(
            supabase, documenti.map((d) => d.file_path), 'Rimozione dei file scaduti'
          )

          const { error: erroreScadenza } = await supabase.from('relazione_scadenze').upsert(
            { request_id: m.request_id, n_file: documenti.length, purgato_il: adesso.toISOString() },
            { onConflict: 'request_id' }
          )
          if (erroreScadenza) throw erroreScadenza

          const { error: erroreDelete } = await supabase
            .from('relazione_documenti')
            .delete()
            .eq('request_id', m.request_id)
          if (erroreDelete) throw erroreDelete

          esito.purgate++
          esito.fileCancellati += confermati
          continue
        }

        if (stato.inPreavviso) {
          const inviata = await preavvisaSeServe(supabase, m.request_id, stato.data, adesso)
          if (inviata) esito.preavvisate++
        }
      } catch (erroreMovimento) {
        errori.push(`pratica ${m.request_id}: ${String(erroreMovimento)}`)
      }
    }

    const success = errori.length === 0
    return new Response(
      JSON.stringify({ success, ...esito, ...(errori.length ? { errori } : {}) }),
      { status: success ? 200 : 500, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (erroreGenerale) {
    console.error('Pulizia non riuscita:', erroreGenerale)
    return new Response(
      JSON.stringify({ success: false, error: String(erroreGenerale), ...esito }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

async function leggiTutto<T>(
  supabase: ReturnType<typeof createClient>,
  tabella: string,
  colonne: string,
  ordinaPer: string
): Promise<T[]> {
  const righe: T[] = []
  let da = 0
  for (;;) {
    const { data, error } = await supabase
      .from(tabella)
      .select(colonne)
      .order(ordinaPer, { ascending: true })
      .range(da, da + PAGINA - 1)
    if (error) throw error
    if (!data?.length) break
    righe.push(...(data as T[]))
    if (data.length < PAGINA) break
    da += PAGINA
  }
  return righe
}

async function rimuoviByte(
  supabase: ReturnType<typeof createClient>,
  percorsi: string[],
  descrizione: string
): Promise<number> {
  const { data: rimossi, error } = await supabase.storage.from(BUCKET).remove(percorsi)
  if (error) throw new Error(`${descrizione} non riuscita: ${error.message}`)
  const confermati = rimossi?.length ?? 0
  if (confermati > 0 && confermati !== percorsi.length) {
    throw new Error(`${descrizione}: richiesti ${percorsi.length}, confermati ${confermati}`)
  }
  return confermati
}

async function preavvisaSeServe(
  supabase: ReturnType<typeof createClient>,
  requestId: string,
  quando: Date,
  adesso: Date
): Promise<boolean> {
  const da = new Date(adesso.getTime() - (GIORNI_PREAVVISO + 1) * 24 * 60 * 60 * 1000).toISOString()
  const { data: gia, error: erroreLettura } = await supabase
    .from('notifications')
    .select('id')
    .eq('request_id', requestId)
    .eq('type', 'relazione_in_scadenza')
    .gte('created_at', da)
    .limit(1)
  if (erroreLettura) throw erroreLettura
  if (gia?.length) return false

  const { data: pratica, error: erroreRichiesta } = await supabase
    .from('requests')
    .select('title')
    .eq('id', requestId)
    .single()
  if (erroreRichiesta) throw erroreRichiesta

  const { data: destinatariRuoli, error: erroreUtenti } = await supabase
    .from('users')
    .select('id')
    .in('role', ['admin', 'userdm329'])
  if (erroreUtenti) throw erroreUtenti

  const destinatari = new Set<string>((destinatariRuoli ?? []).map((u) => u.id))
  if (destinatari.size === 0) return false

  const giorno = quando.toLocaleDateString('it-IT')
  const { error: erroreInvio } = await supabase.from('notifications').insert(
    [...destinatari].map((user_id) => ({
      user_id,
      request_id: requestId,
      type: 'relazione_in_scadenza',
      event_type: 'relazione_in_scadenza',
      read: false,
      message: `La relazione tecnica di «${pratica?.title ?? 'una pratica'}» verrà cancellata il ${giorno}. Scaricala se ti serve.`,
    }))
  )
  if (erroreInvio) throw erroreInvio
  return true
}
```

- [ ] **Step 2: Deploy**

```bash
npx supabase functions deploy pulisci-relazioni-scadute --project-ref uphftgpwisdiubuhohnc
```

- [ ] **Step 3: Verifica la guardia di autorizzazione**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST "https://uphftgpwisdiubuhohnc.supabase.co/functions/v1/pulisci-relazioni-scadute"
```
Expected: `401` (nessun header `x-cron-key`).

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/pulisci-relazioni-scadute/index.ts
git commit -m "feat(relazione): edge function di pulizia notturna, gemella di quella del fascicolo"
```

---

## Task 3: Service `relazioneDocumentiApi`

**Files:**
- Create: `src/services/api/relazioneDocumenti.ts`
- Test: `src/services/api/__tests__/relazioneDocumenti.test.ts`

**Interfaces:**
- Produce: `relazioneDocumentiApi.{ultimoFinale, salvaFinale, scarica, scadenzaDi}`, tipo `DocumentoRelazione { id, nome, peso, mime, filePath }`. Usato dal Task 4 (`RelazioneDataDialog.tsx`) e dal Task 5 (`TechnicalDetails.tsx`, colore del pulsante).
- Consuma: client `supabase` da `../supabase`, tabelle/bucket del Task 1.

- [ ] **Step 1: Scrivi il test**

`src/services/api/__tests__/relazioneDocumenti.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const fromMock = vi.fn()
const storageFromMock = vi.fn()
const getSessionMock = vi.fn()

// Il percorso è relativo a QUESTO file (dentro __tests__/), non al servizio sotto test:
// da src/services/api/__tests__/ a src/services/supabase.ts sono due livelli, non uno.
vi.mock('../../supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    storage: { from: (...args: unknown[]) => storageFromMock(...args) },
    auth: { getSession: (...args: unknown[]) => getSessionMock(...args) },
  },
}))

import { relazioneDocumentiApi } from '../relazioneDocumenti'

const rigaEsistente = {
  id: 'doc-vecchio',
  request_id: 'r1',
  file_name: 'Relazione_DM329.docx',
  file_path: 'r1/1000_vecchia.docx',
  file_size: 100,
  mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  created_at: '2026-01-01T00:00:00Z',
}

describe('relazioneDocumentiApi.ultimoFinale', () => {
  it('restituisce null quando non esiste alcuna relazione salvata', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        }),
      }),
    })

    const risultato = await relazioneDocumentiApi.ultimoFinale('r1')
    expect(risultato).toBeNull()
  })

  it('mappa la riga più recente nel tipo DocumentoRelazione', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ maybeSingle: async () => ({ data: rigaEsistente, error: null }) }),
          }),
        }),
      }),
    })

    const risultato = await relazioneDocumentiApi.ultimoFinale('r1')
    expect(risultato).toEqual({
      id: 'doc-vecchio',
      nome: 'Relazione_DM329.docx',
      peso: 100,
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filePath: 'r1/1000_vecchia.docx',
    })
  })
})

describe('relazioneDocumentiApi.salvaFinale', () => {
  const nuovoFile = new File(['contenuto'], 'Relazione_DM329.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  beforeEach(() => {
    fromMock.mockReset()
    storageFromMock.mockReset()
    getSessionMock.mockReset()
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  })

  it('carica i byte, inserisce la riga, poi rimuove la relazione precedente', async () => {
    const upload = vi.fn(async () => ({ error: null }))
    const remove = vi.fn(async () => ({ error: null }))
    storageFromMock.mockReturnValue({ upload, remove })

    let chiamataUltimoFinale = 0
    const insertSingle = vi.fn(async () => ({
      data: { ...rigaEsistente, id: 'doc-nuovo', file_path: 'r1/2000_nuova.docx' },
      error: null,
    }))
    const deleteEq = vi.fn(async () => ({ error: null }))

    fromMock.mockImplementation((tabella: string) => {
      if (tabella === 'relazione_documenti') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => {
                    chiamataUltimoFinale++
                    // La prima volta (dentro salvaFinale, per leggere il precedente) trova la
                    // riga vecchia; non ci sono altre chiamate a select in questo test.
                    return { data: chiamataUltimoFinale === 1 ? rigaEsistente : null, error: null }
                  },
                }),
              }),
            }),
          }),
          insert: () => ({ select: () => ({ single: insertSingle }) }),
          delete: () => ({ eq: deleteEq }),
        }
      }
      if (tabella === 'relazione_scadenze') {
        return { delete: () => ({ eq: async () => ({ error: null }) }) }
      }
      throw new Error(`Tabella non attesa nel test: ${tabella}`)
    })

    const risultato = await relazioneDocumentiApi.salvaFinale('r1', nuovoFile)

    expect(upload).toHaveBeenCalledTimes(1)
    expect(insertSingle).toHaveBeenCalledTimes(1)
    // Rimuove i byte e la riga della relazione precedente, non quella appena creata.
    expect(remove).toHaveBeenCalledWith(['r1/1000_vecchia.docx'])
    expect(deleteEq).toHaveBeenCalledWith('id', 'doc-vecchio')
    expect(risultato.id).toBe('doc-nuovo')
  })
})
```

- [ ] **Step 2: Verifica che il test fallisca (il modulo non esiste ancora)**

Run: `npx vitest run src/services/api/__tests__/relazioneDocumenti.test.ts`
Expected: FAIL — `Cannot find module '../relazioneDocumenti'`

- [ ] **Step 3: Scrivi il service**

`src/services/api/relazioneDocumenti.ts`:
```typescript
import { supabase } from '../supabase'

/**
 * Documenti della relazione tecnica: bucket `relazioni` per i byte, `relazione_documenti`
 * per l'indice. Un solo file per pratica — a differenza del fascicolo/dichiarazioni non c'è
 * un concetto di "sorgenti": la relazione si genera dai dati della scheda.
 */

export const BUCKET_RELAZIONI = 'relazioni'

interface RigaDocumento {
  id: string
  request_id: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string | null
  created_at: string
}

export interface DocumentoRelazione {
  id: string
  nome: string
  peso: number
  mime: string | null
  filePath: string
}

const daRiga = (r: RigaDocumento): DocumentoRelazione => ({
  id: r.id,
  nome: r.file_name,
  peso: r.file_size,
  mime: r.mime_type,
  filePath: r.file_path,
})

const percorsoFile = (requestId: string, file: File): string => {
  const nomePulito = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${requestId}/${Date.now()}_${nomePulito}`
}

export const relazioneDocumentiApi = {
  /** L'ultima relazione salvata per questa pratica, se esiste. */
  ultimoFinale: async (requestId: string): Promise<DocumentoRelazione | null> => {
    const { data, error } = await supabase
      .from('relazione_documenti')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data ? daRiga(data as RigaDocumento) : null
  },

  /** Salva la relazione appena generata, caricando la nuova prima di eliminare la precedente. */
  salvaFinale: async (requestId: string, file: File): Promise<DocumentoRelazione> => {
    const { data: sessione } = await supabase.auth.getSession()
    if (!sessione.session) throw new Error('Non autenticato')

    const precedente = await relazioneDocumentiApi.ultimoFinale(requestId)

    const filePath = percorsoFile(requestId, file)
    const { error: erroreUpload } = await supabase.storage
      .from(BUCKET_RELAZIONI)
      .upload(filePath, file, { cacheControl: '3600', upsert: false })
    if (erroreUpload) throw new Error(`Errore nel caricamento: ${erroreUpload.message}`)

    const { data, error } = await supabase
      .from('relazione_documenti')
      .insert({
        request_id: requestId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type || null,
        uploaded_by: sessione.session.user.id,
      })
      .select('*')
      .single()

    if (error) {
      const { error: erroreRollback } = await supabase.storage.from(BUCKET_RELAZIONI).remove([filePath])
      if (erroreRollback) {
        console.error('Rimozione di rollback non riuscita, file orfano nello storage:', filePath, erroreRollback)
      }
      throw new Error(`Errore nel salvataggio della relazione: ${error.message}`)
    }

    // Il vecchio file si toglie solo dopo che il nuovo è al sicuro: se upload o insert fossero
    // falliti, la pratica resterebbe comunque con una relazione scaricabile invece che con
    // nessuna.
    if (precedente) {
      const { error: erroreStorage } = await supabase.storage.from(BUCKET_RELAZIONI).remove([precedente.filePath])
      if (erroreStorage) throw new Error(`Rimozione della relazione precedente non riuscita: ${erroreStorage.message}`)
      const { error: erroreDelete } = await supabase.from('relazione_documenti').delete().eq('id', precedente.id)
      if (erroreDelete) throw erroreDelete
    }
    await supabase.from('relazione_scadenze').delete().eq('request_id', requestId)

    return daRiga(data as RigaDocumento)
  },

  scarica: async (filePath: string): Promise<Blob> => {
    const { data, error } = await supabase.storage.from(BUCKET_RELAZIONI).download(filePath)
    if (error) throw new Error(`Errore nello scaricamento: ${error.message}`)
    return data
  },

  /** La nota «relazione scaduta il …», se il file è stato cancellato dalla passata notturna. */
  scadenzaDi: async (requestId: string): Promise<{ purgato_il: string; n_file: number } | null> => {
    const { data, error } = await supabase
      .from('relazione_scadenze')
      .select('purgato_il, n_file')
      .eq('request_id', requestId)
      .maybeSingle()

    if (error) throw error
    return data ?? null
  },
}
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run src/services/api/__tests__/relazioneDocumenti.test.ts`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add src/services/api/relazioneDocumenti.ts src/services/api/__tests__/relazioneDocumenti.test.ts
git commit -m "feat(relazione): service di persistenza, sul modello di dichiarazioniDocumentiApi"
```

---

## Task 4: Salvare la relazione dopo averla generata

**Files:**
- Modify: `src/services/relazione/generateRelazione.ts`
- Modify: `src/components/relazione/RelazioneDataDialog.tsx`

**Interfaces:**
- Consuma: `relazioneDocumentiApi.salvaFinale` (Task 3).
- Produce: `generateAndDownloadRelazione` ora restituisce `Promise<Blob>` invece di `Promise<void>` — chi lo chiama altrove va aggiornato se assume `void` (verificato al passo 3: nessun altro chiamante in `src/`, solo `RelazioneDataDialog.tsx` e i test di questo stesso modulo).

- [ ] **Step 1: Modifica `generateAndDownloadRelazione` per restituire il blob generato**

In `src/services/relazione/generateRelazione.ts`, cambia la firma e l'ultima riga:
```typescript
export async function generateAndDownloadRelazione(
  params: GenerateRelazioneParams
): Promise<Blob> {
  const { scheda, additionalInfo, customer, pratica, schemaImpianto, fileName } = params

  const res = await fetch(TEMPLATE_URL)
  if (!res.ok) {
    throw new Error(
      `Template della relazione non trovato in ${TEMPLATE_URL}. ` +
        'Caricare il file .docx in public/templates/ (vedi TEMPLATE_TAGS.md).'
    )
  }
  const templateBuffer = await res.arrayBuffer()

  const model = buildRelazioneModel({ scheda, additionalInfo, customer, pratica, schemaImpianto })
  const bytes = renderRelazioneDocx(templateBuffer, model)

  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  saveAs(blob, fileName ?? 'Relazione_DM329.docx')
  return blob
}
```
(Unica differenza rispetto all'originale: tipo di ritorno `Promise<Blob>` invece di `Promise<void>`, e `return blob` in fondo. Il download resta invariato — avviene comunque prima del `return`.)

- [ ] **Step 2: Cerca altri chiamanti che assumano `void`**

Run: `grep -rn "generateAndDownloadRelazione" src/ --include="*.ts" --include="*.tsx"`
Expected: solo `src/services/relazione/generateRelazione.ts` (definizione) e `src/components/relazione/RelazioneDataDialog.tsx` (unico chiamante in produzione). Se emergono test che asseriscono `undefined` come valore di ritorno, aggiornali per accettare un `Blob`.

- [ ] **Step 3: Aggiorna `RelazioneDataDialog.tsx` per salvare dopo aver generato**

In `src/components/relazione/RelazioneDataDialog.tsx`:

Aggiungi l'import:
```typescript
import { relazioneDocumentiApi } from '@/services/api/relazioneDocumenti'
```

Nel corpo di `handleGenera`, sostituisci:
```typescript
      await generateAndDownloadRelazione({
        scheda,
        additionalInfo: parsed.data,
        customer,
        pratica,
        schemaImpianto: schema ?? undefined,
        fileName,
      })
```
con:
```typescript
      const blob = await generateAndDownloadRelazione({
        scheda,
        additionalInfo: parsed.data,
        customer,
        pratica,
        schemaImpianto: schema ?? undefined,
        fileName,
      })
      // Non bloccante, come riportaDescrizioneInAnagrafica/riportaGiriACatalogo qui sotto: la
      // relazione è già stata scaricata con successo, un errore di salvataggio non deve far
      // sembrare fallita l'intera generazione.
      try {
        await relazioneDocumentiApi.salvaFinale(
          requestId,
          new File([blob], fileName ?? 'Relazione_DM329.docx', { type: blob.type })
        )
      } catch (err) {
        console.warn('[relazione] non salvata nell\'app, resta solo scaricata', err)
      }
```

- [ ] **Step 4: Esegui la suite di test della relazione**

Run: `npx vitest run src/services/relazione`
Expected: PASS — nessuna regressione sui test esistenti di `generateRelazione`/`preflight`/`buildRelazioneModel`.

- [ ] **Step 5: Commit**

```bash
git add src/services/relazione/generateRelazione.ts src/components/relazione/RelazioneDataDialog.tsx
git commit -m "feat(relazione): salva il documento generato, stessa sequenza genera-scarica-salva delle dichiarazioni"
```

---

## Task 5: Colore di stato su "Genera relazione"/"Genera dichiarazioni"

**Files:**
- Modify: `src/components/common/AzioneIcona.tsx`
- Modify: `src/components/technicalSheet/TechnicalSheetHeader.tsx`
- Modify: `src/pages/TechnicalDetails.tsx`

**Interfaces:**
- Produce: `AzioneIconaProps.pieno?: boolean` (variante a sfondo pieno); `AzioneIconaProps.onClick` ora tipizzato `(event: React.MouseEvent<HTMLButtonElement>) => void` (compatibile con tutti i chiamanti esistenti, che passano funzioni a zero argomenti).
- Consuma: `relazioneDocumentiApi.ultimoFinale`/`.scarica` (Task 3), `dichiarazioniDocumentiApi.ultimoFinale`/`.scarica` (già in `main` dopo il merge di `dichiarazioni-dm329`, vedi Global Constraints).

- [ ] **Step 1: Estendi `AzioneIcona` con la variante piena**

In `src/components/common/AzioneIcona.tsx`, sostituisci il file intero:
```tsx
import type { ReactElement } from 'react'
import { Box, Button, Tooltip } from '@mui/material'

export interface AzioneIconaProps {
  icona: ReactElement
  /** Nome dell'azione: è l'etichetta che si apre, il tooltip e il nome accessibile. */
  testo: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  /**
   * `error` per le azioni che non si tornano indietro: in una fila di icone tutte uguali
   * niente distingue più la routine dall'irreversibile, e il colore è ciò che resta a
   * dirlo quando la parola è chiusa.
   */
  colore?: 'primary' | 'error' | 'warning' | 'success'
  /** Sfondo pieno invece del solo contorno: segnala che l'azione ha già un risultato pronto. */
  pieno?: boolean
}

/**
 * Azione di una barra: icona sempre in vista, parola che si apre al passaggio del mouse.
 *
 * Le parole in fila occupano tutta la barra e la mandano a capo sulle finestre strette, ma
 * nasconderle dietro tre puntini le rende introvabili — è lo stesso equivoco della freccina
 * dei dettagli nella tabella apparecchiature. Così le icone restano tutte visibili e la
 * parola arriva a chiedere.
 *
 * L'apertura è una griglia da `0fr` a `1fr` e non una larghezza in pixel: la parola detta la
 * propria misura, quindi «Visualizza dati CIVA» e «Elimina» si aprono ciascuna per quel che
 * è lunga, senza numeri da tenere allineati a mano.
 *
 * Dove il passaggio del mouse non esiste — un tablet in cantiere — la parola sta sempre
 * aperta: `@media (hover: none)`. E `aria-label` porta comunque il nome dell'azione a chi
 * naviga con la tastiera o con un lettore di schermo, che l'animazione non la vede.
 */
export const AzioneIcona = ({
  icona, testo, onClick, disabled, colore = 'primary', pieno = false,
}: AzioneIconaProps) => (
  <Tooltip title={testo} placement="bottom">
    <span>
      <Button
        size="small"
        variant={pieno ? 'contained' : 'outlined'}
        color={colore}
        onClick={onClick}
        disabled={disabled}
        aria-label={testo}
        // Bordo a piena opacità: il 50% di default di MUI su fondo scuro sparisce.
        sx={{
          minWidth: 0, px: 0.9, whiteSpace: 'nowrap',
          ...(pieno ? {} : { borderColor: `${colore}.main` }),
          '& .etichetta': {
            display: 'grid', gridTemplateColumns: '0fr', ml: 0, opacity: 0,
            transition: 'grid-template-columns .18s ease, opacity .18s ease, margin-left .18s ease',
          },
          '& .etichetta > span': { overflow: 'hidden', minWidth: 0 },
          '&:hover .etichetta, &:focus-visible .etichetta': {
            gridTemplateColumns: '1fr', ml: 0.75, opacity: 1,
          },
          '@media (hover: none)': {
            '& .etichetta': { gridTemplateColumns: '1fr', ml: 0.75, opacity: 1 },
          },
        }}
      >
        {icona}
        <Box component="span" className="etichetta"><span>{testo}</span></Box>
      </Button>
    </span>
  </Tooltip>
)
```

- [ ] **Step 2: Esegui i test esistenti che usano `AzioneIcona`**

Run: `npx vitest run src/components/requests src/components/technicalSheet/__tests__`
Expected: PASS — nessuna regressione (la modifica è additiva: `pieno` di default `false` riproduce esattamente il comportamento precedente, e l'allargamento del tipo di `onClick` accetta ancora tutte le funzioni a zero argomenti già passate).

- [ ] **Step 3: Estendi le props di `TechnicalSheetHeader`**

In `src/components/technicalSheet/TechnicalSheetHeader.tsx`, aggiungi import e props:
```tsx
import {
  ArrowBack as ArrowBackIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
  Gavel as GavelIcon,
  Inventory2 as Inventory2Icon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Share as ShareIcon,
} from '@mui/icons-material'
```
Aggiungi all'interfaccia `TechnicalSheetHeaderProps`:
```tsx
  /** Presente quando la relazione è già stata generata e salvata. */
  relazionePronta: boolean
  /** Presente quando le dichiarazioni sono già state generate e salvate. */
  dichiarazioniPronte: boolean
  onScaricaRelazione: () => void
  onScaricaDichiarazioni: () => void
```
Sostituisci i due `AzioneIcona` esistenti (Genera relazione, Genera dichiarazioni) con:
```tsx
          {canGenerateDocs && (
            relazionePronta ? (
              <>
                <AzioneIcona
                  icona={<DownloadIcon fontSize="small" />}
                  testo="Relazione pronta — scarica"
                  onClick={onScaricaRelazione}
                  colore="success"
                  pieno
                />
                <AzioneIcona
                  icona={<RefreshIcon fontSize="small" />}
                  testo="Rigenera relazione"
                  onClick={onRelazione}
                />
              </>
            ) : (
              <AzioneIcona icona={<DescriptionIcon fontSize="small" />} testo="Genera relazione" onClick={onRelazione} />
            )
          )}

          {canGenerateDocs && (
            dichiarazioniPronte ? (
              <>
                <AzioneIcona
                  icona={<DownloadIcon fontSize="small" />}
                  testo="Dichiarazioni pronte — scarica"
                  onClick={onScaricaDichiarazioni}
                  colore="success"
                  pieno
                />
                <AzioneIcona
                  icona={<RefreshIcon fontSize="small" />}
                  testo="Rigenera dichiarazioni"
                  onClick={onDichiarazioni}
                />
              </>
            ) : (
              <AzioneIcona icona={<GavelIcon fontSize="small" />} testo="Genera dichiarazioni" onClick={onDichiarazioni} />
            )
          )}
```
`Inventory2Icon` (icona di "Scarica documentazione completa") è già incluso nell'import del passo precedente: serve al Task 9, aggiunto qui per evitare un secondo giro di modifiche allo stesso blocco di import. `DownloadIcon` è invece già usato sopra, in questo stesso passo.

- [ ] **Step 4: Calcola lo stato "pronto" e i download diretti in `TechnicalDetails.tsx`**

In `src/pages/TechnicalDetails.tsx`, aggiungi import:
```tsx
import { useQuery } from '@tanstack/react-query'
import { saveAs } from 'file-saver'
import { relazioneDocumentiApi } from '@/services/api/relazioneDocumenti'
import { dichiarazioniDocumentiApi } from '@/services/api/dichiarazioniDocumenti'
```
(`useQuery` è già importato da `@tanstack/react-query` nel file esistente insieme a `useQueryClient` — verificane la riga e aggiungi solo ciò che manca senza duplicare l'import.)

Aggiungi, vicino alla definizione di `canGenerateDocs`:
```tsx
  const { data: relazioneSalvata } = useQuery({
    queryKey: ['relazione-documento', id],
    queryFn: () => relazioneDocumentiApi.ultimoFinale(id!),
    enabled: !!id && canGenerateDocs,
  })
  const { data: dichiarazioniSalvate } = useQuery({
    queryKey: ['dichiarazioni-documento', id],
    queryFn: () => dichiarazioniDocumentiApi.ultimoFinale(id!),
    enabled: !!id && canGenerateDocs,
  })

  const handleScaricaRelazione = async () => {
    if (!relazioneSalvata) return
    const blob = await relazioneDocumentiApi.scarica(relazioneSalvata.filePath)
    saveAs(blob, relazioneSalvata.nome)
  }
  const handleScaricaDichiarazioni = async () => {
    if (!dichiarazioniSalvate) return
    const blob = await dichiarazioniDocumentiApi.scarica(dichiarazioniSalvate.filePath)
    saveAs(blob, dichiarazioniSalvate.nome)
  }
```
Nel montaggio di `TechnicalSheetHeader` (dentro `header={(completezza) => (...)}`), aggiungi le nuove prop:
```tsx
                relazionePronta={!!relazioneSalvata}
                dichiarazioniPronte={!!dichiarazioniSalvate}
                onScaricaRelazione={handleScaricaRelazione}
                onScaricaDichiarazioni={handleScaricaDichiarazioni}
```
Dopo la chiusura con successo dei due dialog (`RelazioneDataDialog`'s `onClose`, `DichiarazioniDialog`'s equivalente), invalida le due query per far ricomparire subito il pulsante verde:
```tsx
        onClose={() => {
          setRelazioneDialogOpen(false)
          riaggiornaAdditionalInfo()
          queryClient.invalidateQueries({ queryKey: ['relazione-documento', id] })
        }}
```
(e lo stesso `queryClient.invalidateQueries({ queryKey: ['dichiarazioni-documento', id] })` nell'`onClose` di `DichiarazioniDialog`).

- [ ] **Step 5: Esegui la suite dei test della scheda tecnica**

Run: `npx vitest run src/pages src/components/technicalSheet`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/common/AzioneIcona.tsx src/components/technicalSheet/TechnicalSheetHeader.tsx src/pages/TechnicalDetails.tsx
git commit -m "feat(scheda-dati): relazione e dichiarazioni diventano verdi quando sono già salvate"
```

---

## Task 6: Helper puro `calcolaEsitiPerCodice`

**Files:**
- Modify: `src/utils/dm329Classification.ts`
- Modify: `src/utils/__tests__/dm329Classification.test.ts`

**Interfaces:**
- Produce: `calcolaEsitiPerCodice(scheda): RigaConEsito[]` e `codiciConAdempimento(righe: RigaConEsito[]): string[]`, tipo `RigaConEsito { codice: string; esito: EsitoDM329 | null; giaDenunciato: boolean }`. Consumato dal Task 7 (pillole) e dal Task 9 (scarico completo).
- Consuma: `classificaRecipiente`, `comportaAdempimento` (già definite nello stesso file), tipi `Serbatoio`/`Disoleatore`/`Scambiatore`/`RecipienteFiltro` da `@/types/technicalSheet`.

- [ ] **Step 1: Scrivi i test**

Aggiungi a `src/utils/__tests__/dm329Classification.test.ts` (in coda al file, stesso stile dei describe esistenti):
```typescript
describe('calcolaEsitiPerCodice', () => {
  it('classifica un serbatoio, un disoleatore, uno scambiatore e un recipiente filtro', () => {
    const righe = calcolaEsitiPerCodice({
      // ps_pressione_max: 15, non 10 — a 10 bar (volume 100, ps<=12) l'esito sarebbe
      // 'DICHIARAZIONE' (ps×vol=1000<=8000), non 'VERIFICA' come atteso sotto.
      serbatoi: [{ codice: 'S1', volume: 100, ps_pressione_max: 15 } as any],
      disoleatori: [{ codice: 'C1.1', volume: 10, ps_pressione_max: 10 } as any],
      scambiatori: [{ codice: 'E1.1', volume: 200, ps_pressione_max: 15 } as any],
      recipienti_filtro: [{ codice: 'F1.1', volume: 5, ps_pressione_max: 5 } as any],
    })

    expect(righe).toEqual([
      { codice: 'S1', esito: 'VERIFICA', giaDenunciato: false },
      { codice: 'C1.1', esito: 'ESCLUSO_VOLUME', giaDenunciato: false },
      { codice: 'E1.1', esito: 'VERIFICA', giaDenunciato: false },
      { codice: 'F1.1', esito: 'ESCLUSO_VOLUME', giaDenunciato: false },
    ])
  })

  it('riporta gia_denunciato quando marcato sulla riga', () => {
    const righe = calcolaEsitiPerCodice({
      serbatoi: [{ codice: 'S1', volume: 100, ps_pressione_max: 15, gia_denunciato: true } as any],
    })
    expect(righe).toEqual([{ codice: 'S1', esito: 'VERIFICA', giaDenunciato: true }])
  })

  it('array assenti o vuoti non producono righe', () => {
    expect(calcolaEsitiPerCodice({})).toEqual([])
  })
})

describe('codiciConAdempimento', () => {
  it('esclude gli esiti che non comportano adempimento', () => {
    const codici = codiciConAdempimento([
      { codice: 'S1', esito: 'VERIFICA', giaDenunciato: false },
      { codice: 'S2', esito: 'SOTTO_SOGLIA', giaDenunciato: false },
      { codice: 'S3', esito: 'DICHIARAZIONE', giaDenunciato: false },
    ])
    expect(codici).toEqual(['S1', 'S3'])
  })

  it('esclude i codici già marcati come denunciati, anche se comportano adempimento', () => {
    const codici = codiciConAdempimento([
      { codice: 'S1', esito: 'VERIFICA', giaDenunciato: true },
      { codice: 'S2', esito: 'VERIFICA', giaDenunciato: false },
    ])
    expect(codici).toEqual(['S2'])
  })
})
```
Aggiungi l'import in cima al file di test (accanto a quelli già presenti per le altre funzioni di `dm329Classification.ts`):
```typescript
import { calcolaEsitiPerCodice, codiciConAdempimento } from '../dm329Classification'
```

- [ ] **Step 2: Verifica che i nuovi test falliscano**

Run: `npx vitest run src/utils/__tests__/dm329Classification.test.ts`
Expected: FAIL — `calcolaEsitiPerCodice is not a function`

- [ ] **Step 3: Implementa l'helper**

In `src/utils/dm329Classification.ts`, aggiungi l'import e le due funzioni in coda al file:
```typescript
import type { CategoriaPED, Disoleatore, RecipienteFiltro, Scambiatore, Serbatoio } from '@/types/technicalSheet'
import type { TipoPraticaCIVA } from '@/types/civa'
```
(sostituisce la riga d'import esistente `import type { CategoriaPED } from '@/types/technicalSheet'`, aggiungendo i tre tipi in più).

```typescript
export interface RigaConEsito {
  codice: string
  esito: EsitoDM329 | null
  giaDenunciato: boolean
}

/**
 * Esito DM329 per ogni codice apparecchiatura della scheda, senza passare per tutto
 * l'apparato di formattazione della relazione (celle, gruppi, etichette italiane).
 *
 * Solo i quattro tipi che possono essere recipienti in pressione: compressori, essiccatori
 * e filtri non hanno mai un esito che comporti adempimento in quanto tali (vedi
 * `classificaCompressore`, sempre esclusa, e i tipi senza recipiente associato in
 * `esiti.ts`), quindi non serve includerli qui.
 */
export function calcolaEsitiPerCodice(scheda: {
  serbatoi?: Pick<Serbatoio, 'codice' | 'volume' | 'ps_pressione_max' | 'gia_denunciato'>[]
  disoleatori?: Pick<Disoleatore, 'codice' | 'volume' | 'ps_pressione_max' | 'gia_denunciato'>[]
  scambiatori?: Pick<Scambiatore, 'codice' | 'volume' | 'ps_pressione_max' | 'gia_denunciato'>[]
  recipienti_filtro?: Pick<RecipienteFiltro, 'codice' | 'volume' | 'ps_pressione_max' | 'gia_denunciato'>[]
}): RigaConEsito[] {
  const righe: RigaConEsito[] = []
  const aggiungi = (elementi: { codice: string; volume?: number; ps_pressione_max?: number; gia_denunciato?: boolean }[] | undefined) => {
    for (const el of elementi ?? []) {
      righe.push({
        codice: el.codice,
        esito: classificaRecipiente(el.volume, el.ps_pressione_max),
        giaDenunciato: !!el.gia_denunciato,
      })
    }
  }
  aggiungi(scheda.serbatoi)
  aggiungi(scheda.disoleatori)
  aggiungi(scheda.scambiatori)
  aggiungi(scheda.recipienti_filtro)
  return righe
}

/** Codici che richiedono un fascicolo INAIL: comportano adempimento e non sono già denunciati. */
export function codiciConAdempimento(righe: RigaConEsito[]): string[] {
  return righe.filter((r) => comportaAdempimento(r.esito) && !r.giaDenunciato).map((r) => r.codice)
}
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run src/utils/__tests__/dm329Classification.test.ts`
Expected: PASS (tutti i test, esistenti e nuovi)

- [ ] **Step 5: Commit**

```bash
git add src/utils/dm329Classification.ts src/utils/__tests__/dm329Classification.test.ts
git commit -m "feat(dm329): estrae calcolaEsitiPerCodice, per sapere quali apparecchiature richiedono un fascicolo"
```

---

## Task 7: Pillole fascicolo per apparecchiatura

**Files:**
- Modify: `src/services/api/fascicoloDocumenti.ts`
- Modify: `src/components/technicalSheet/table/UnifiedEquipmentTable.tsx`
- Test: `src/services/api/__tests__/fascicoloDocumenti.test.ts` (nuovo blocco `describe`, se il file esiste già — altrimenti crealo seguendo lo schema del Task 3)

**Interfaces:**
- Produce: `fascicoloDocumentiApi.codiciConFascicolo(requestId): Promise<Set<string>>`.
- Consuma: `calcolaEsitiPerCodice`/`codiciConAdempimento` (Task 6).

- [ ] **Step 1: Scrivi il test del nuovo metodo**

Se `src/services/api/__tests__/fascicoloDocumenti.test.ts` non esiste, crealo con lo stesso schema di mock del Task 3 (`vi.mock('../../supabase', ...)` — il percorso relativo è due livelli sopra `__tests__/`, non uno); se esiste, aggiungi questo blocco:
```typescript
describe('fascicoloDocumentiApi.codiciConFascicolo', () => {
  it('restituisce i soli codici con un fascicolo composto (tipo=fascicolo)', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: async () => ({
            data: [{ codice: 'S1' }, { codice: 'C2.1' }],
            error: null,
          }),
        }),
      }),
    })

    const codici = await fascicoloDocumentiApi.codiciConFascicolo('r1')
    expect(codici).toEqual(new Set(['S1', 'C2.1']))
  })
})
```

- [ ] **Step 2: Verifica che fallisca**

Run: `npx vitest run src/services/api/__tests__/fascicoloDocumenti.test.ts`
Expected: FAIL — `fascicoloDocumentiApi.codiciConFascicolo is not a function`

- [ ] **Step 3: Aggiungi il metodo**

In `src/services/api/fascicoloDocumenti.ts`, aggiungi dentro l'oggetto `fascicoloDocumentiApi` (dopo `elenca`):
```typescript
  /** Codici che hanno già un fascicolo composto (tipo='fascicolo'), per l'intera pratica. */
  codiciConFascicolo: async (requestId: string): Promise<Set<string>> => {
    const { data, error } = await supabase
      .from('fascicolo_documenti')
      .select('codice')
      .eq('request_id', requestId)
      .eq('tipo', 'fascicolo')

    if (error) throw error
    return new Set((data ?? []).map((r: { codice: string }) => r.codice))
  },
```

- [ ] **Step 4: Esegui i test**

Run: `npx vitest run src/services/api/__tests__/fascicoloDocumenti.test.ts`
Expected: PASS

- [ ] **Step 5: Aggiungi le pillole in `UnifiedEquipmentTable.tsx`**

Aggiungi gli import:
```tsx
import { Folder as FolderIcon } from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { calcolaEsitiPerCodice, codiciConAdempimento } from '@/utils/dm329Classification'
```
Dentro il componente, prima del `return` (vicino agli altri `useWatch`/`useQuery` già presenti), aggiungi:
```tsx
  const perAdempimento = useWatch({
    control,
    name: ['serbatoi', 'disoleatori', 'scambiatori', 'recipienti_filtro'],
  })
  const codiciRichiesti = useMemo(
    () =>
      codiciConAdempimento(
        calcolaEsitiPerCodice({
          serbatoi: perAdempimento[0] ?? [],
          disoleatori: perAdempimento[1] ?? [],
          scambiatori: perAdempimento[2] ?? [],
          recipienti_filtro: perAdempimento[3] ?? [],
        })
      ),
    [perAdempimento]
  )
  const { data: codiciConFascicoloPronto } = useQuery({
    queryKey: ['fascicolo-codici-pronti', requestId],
    queryFn: () => fascicoloDocumentiApi.codiciConFascicolo(requestId),
    enabled: !!requestId,
  })
```
(`useMemo` è già importato nel file — verificane la presenza nell'import di `react`; se manca, aggiungilo).

Nella `Box` header (quella che oggi contiene solo `{righeComplete.complete} di {righeComplete.totali} complete` e `CompletenessBar`, righe 853-861 del file attuale), aggiungi le pillole subito dopo `<CompletenessBar .../>` e prima della `Box` con `{azioni}`:
```tsx
          {codiciRichiesti.map((codice) => {
            const pronto = codiciConFascicoloPronto?.has(codice) ?? false
            return (
              <Button
                key={codice}
                size="small"
                variant={pronto ? 'contained' : 'outlined'}
                color={pronto ? 'success' : 'primary'}
                startIcon={<FolderIcon fontSize="small" />}
                onClick={() => {
                  const indice = voci.findIndex((v) => v.code === codice)
                  if (indice >= 0) setAperta(indice)
                }}
                sx={{
                  minWidth: 0, px: 1.25, borderRadius: 10,
                  ...(pronto ? {} : { borderColor: 'primary.main' }),
                }}
              >
                {codice}
              </Button>
            )
          })}
```

- [ ] **Step 6: Esegui la suite dei test della tabella apparecchiature**

Run: `npx vitest run src/components/technicalSheet/table`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/api/fascicoloDocumenti.ts src/services/api/__tests__/fascicoloDocumenti.test.ts src/components/technicalSheet/table/UnifiedEquipmentTable.tsx
git commit -m "feat(fascicolo): pillole per apparecchiatura sopra la tabella, blu da fare / verde pronto"
```

---

## Task 8: Compattare "Riconosci automaticamente" e "Nuova apparecchiatura"

**Files:**
- Modify: `src/components/technicalSheet/TechnicalSheetForm.tsx`
- Modify: `src/components/technicalSheet/table/UnifiedEquipmentTable.tsx`

**Interfaces:**
- Consuma: `AzioneIcona` con `onClick: (event) => void` (Task 5) — necessario perché "Nuova apparecchiatura" usa `event.currentTarget` per ancorare il menu.

- [ ] **Step 1: "Riconosci automaticamente" in `TechnicalSheetForm.tsx`**

Aggiungi l'import:
```tsx
import { AzioneIcona } from '@/components/common'
```
Sostituisci il blocco (righe ~539-550):
```tsx
              azioni={
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={<AutoFixHighIcon />}
                  onClick={() => setBatchOCRDialogOpen(true)}
                  sx={{ borderColor: 'primary.main' }}
                >
                  Riconosci automaticamente
                </Button>
              }
```
con:
```tsx
              azioni={
                <AzioneIcona
                  icona={<AutoFixHighIcon fontSize="small" />}
                  testo="Riconosci automaticamente"
                  onClick={() => setBatchOCRDialogOpen(true)}
                />
              }
```

- [ ] **Step 2: "Nuova apparecchiatura" in `UnifiedEquipmentTable.tsx`**

Aggiungi l'import (se `AzioneIcona` non è già stato importato al Task 7 — verifica prima di duplicare):
```tsx
import { AzioneIcona } from '@/components/common'
```
Sostituisci:
```tsx
            {/* Contornato: l'unica azione a fondo pieno della pagina è «Completa scheda». */}
            <Button size="small" variant="outlined" color="primary" startIcon={<AddIcon />} onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ borderColor: 'primary.main' }}>
              Nuova apparecchiatura
            </Button>
```
con:
```tsx
            <AzioneIcona
              icona={<AddIcon fontSize="small" />}
              testo="Nuova apparecchiatura"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
            />
```

- [ ] **Step 3: Esegui la suite completa della scheda tecnica**

Run: `npx vitest run src/components/technicalSheet`
Expected: PASS — nessuna regressione (i due pulsanti restano cliccabili con le stesse callback, cambia solo il markup).

- [ ] **Step 4: Commit**

```bash
git add src/components/technicalSheet/TechnicalSheetForm.tsx src/components/technicalSheet/table/UnifiedEquipmentTable.tsx
git commit -m "refactor(scheda-dati): Riconosci automaticamente e Nuova apparecchiatura come icone, spazio alle pillole fascicolo"
```

---

## Task 9: "Scarica documentazione completa"

**Files:**
- Modify: `src/components/technicalSheet/TechnicalSheetHeader.tsx`
- Modify: `src/pages/TechnicalDetails.tsx`

**Interfaces:**
- Consuma: `useFormContext`/`useWatch` (react-hook-form, disponibili perché `TechnicalSheetHeader` è renderizzato dentro `<FormProvider>` tramite il render-prop `header` di `TechnicalSheetForm.tsx:485`), `calcolaEsitiPerCodice`/`codiciConAdempimento` (Task 6), `fascicoloDocumentiApi.codiciConFascicolo` (Task 7), `relazioneSalvata`/`dichiarazioniSalvate` (Task 5), `relazioneDocumentiApi.scarica`/`dichiarazioniDocumentiApi.scarica`.

- [ ] **Step 1: Calcola la prontezza dei fascicoli dentro `TechnicalSheetHeader.tsx`**

Aggiungi gli import:
```tsx
import { useFormContext, useWatch } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { calcolaEsitiPerCodice, codiciConAdempimento } from '@/utils/dm329Classification'
import { fascicoloDocumentiApi } from '@/services/api/fascicoloDocumenti'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
```
Aggiungi alle props di `TechnicalSheetHeaderProps`:
```tsx
  requestId: string
  onScaricaCompleta: () => void
```
All'inizio del corpo del componente (dopo la destrutturazione delle props), aggiungi:
```tsx
  const { control } = useFormContext<SchedaDatiCompleta>()
  const perAdempimento = useWatch({
    control,
    name: ['serbatoi', 'disoleatori', 'scambiatori', 'recipienti_filtro'],
  })
  const codiciRichiesti = useMemo(
    () =>
      codiciConAdempimento(
        calcolaEsitiPerCodice({
          serbatoi: perAdempimento[0] ?? [],
          disoleatori: perAdempimento[1] ?? [],
          scambiatori: perAdempimento[2] ?? [],
          recipienti_filtro: perAdempimento[3] ?? [],
        })
      ),
    [perAdempimento]
  )
  const { data: codiciConFascicoloPronto } = useQuery({
    queryKey: ['fascicolo-codici-pronti', requestId],
    queryFn: () => fascicoloDocumentiApi.codiciConFascicolo(requestId),
    enabled: !!requestId,
  })
  const fascicoliMancanti = codiciRichiesti.filter((c) => !codiciConFascicoloPronto?.has(c))
  const mancano = [
    !relazionePronta && 'relazione',
    !dichiarazioniPronte && 'dichiarazioni',
    ...fascicoliMancanti.map((c) => `fascicolo di ${c}`),
  ].filter(Boolean) as string[]
  const tuttoPronto = mancano.length === 0
```
(Richiede `useMemo` da `react`, già presumibilmente importato nel file — verificane la presenza).

- [ ] **Step 2: Aggiungi il pulsante nel JSX**

Dopo il blocco "Genera dichiarazioni" del Task 5, aggiungi:
```tsx
          {canGenerateDocs && (
            <AzioneIcona
              icona={<Inventory2Icon fontSize="small" />}
              testo={tuttoPronto ? 'Scarica documentazione completa' : `Mancano: ${mancano.join(', ')}`}
              onClick={onScaricaCompleta}
              colore="success"
              pieno={tuttoPronto}
              disabled={!tuttoPronto}
            />
          )}
```

- [ ] **Step 3: Implementa lo scarico in `TechnicalDetails.tsx`**

`TechnicalDetails.tsx` non ha accesso diretto al `control` del form (sta dentro `TechnicalSheetForm`, non nella pagina — a differenza di `TechnicalSheetHeader` che ci è annidato tramite il render-prop): il calcolo dei codici che richiedono un fascicolo va quindi fatto sull'istantanea più recente della scheda, presa con `formRef.current?.getFormData()` (lo stesso meccanismo con cui `TechnicalDetails.tsx` popola `scheda` per `RelazioneDataDialog`/`DichiarazioniDialog`) **al momento del clic**, non in un `useMemo` esterno — altrimenti resterebbe fermo allo snapshot del primo render invece di riflettere le modifiche fatte medio tempore nella scheda.

Aggiungi, vicino a `handleScaricaRelazione`/`handleScaricaDichiarazioni` (Task 5):
```tsx
  const handleScaricaCompleta = async () => {
    if (relazioneSalvata) {
      const blob = await relazioneDocumentiApi.scarica(relazioneSalvata.filePath)
      saveAs(blob, relazioneSalvata.nome)
    }
    if (dichiarazioniSalvate) {
      const blob = await dichiarazioniDocumentiApi.scarica(dichiarazioniSalvate.filePath)
      saveAs(blob, dichiarazioniSalvate.nome)
    }
    // Un file per codice: il browser mette in coda i download consecutivi, non serve uno zip
    // lato client per un pugno di file — la scelta è deliberatamente la più semplice che
    // funzioni (vedi documento di design, sezione «Fuori scope»).
    const codici = codiciConAdempimento(calcolaEsitiPerCodice(formRef.current?.getFormData() ?? {}))
    for (const codice of codici) {
      const documenti = await fascicoloDocumentiApi.elenca(id!, codice)
      const fascicolo = documenti.find((d) => d.tipo === 'fascicolo')
      if (!fascicolo) continue
      const blob = await fascicoloDocumentiApi.scarica(fascicolo.filePath)
      saveAs(blob, fascicolo.nome)
    }
  }
```

Aggiungi gli import mancanti:
```tsx
import { calcolaEsitiPerCodice, codiciConAdempimento } from '@/utils/dm329Classification'
```
Nel montaggio di `TechnicalSheetHeader`, aggiungi:
```tsx
                requestId={id!}
                onScaricaCompleta={handleScaricaCompleta}
```

- [ ] **Step 4: Esegui la suite dei test della scheda tecnica**

Run: `npx vitest run src/pages src/components/technicalSheet`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/technicalSheet/TechnicalSheetHeader.tsx src/pages/TechnicalDetails.tsx
git commit -m "feat(scheda-dati): pulsante Scarica documentazione completa, verde solo a tutto pronto"
```

---

## Task 10: Gruppo unito "Scheda dati" + stato

**Files:**
- Modify: `src/components/requests/SchedaStatoToggle.tsx`
- Create: `src/components/requests/SchedaDatiStatoGroup.tsx`
- Modify: `src/pages/RequestDetail.tsx`

**Interfaces:**
- Produce: `SchedaDatiStatoGroup({ onApri, toggle })`, componente che monta `Button` "Scheda dati" (contained) + `SchedaStatoToggle` (variante `'raggruppato'`) dentro un unico contorno.
- Consuma: `SchedaStatoToggle` esistente, esteso con `variante?: 'autonomo' | 'raggruppato'`.

- [ ] **Step 1: Estendi `SchedaStatoToggle` con la variante raggruppata**

In `src/components/requests/SchedaStatoToggle.tsx`, aggiungi alla props interface:
```tsx
export interface SchedaStatoToggleProps {
  compilazione: CompilazioneScheda
  onScegli: (stato: StatoScheda | null) => void
  disabled?: boolean
  /**
   * 'raggruppato' toglie contorno e angoli propri: usato dentro SchedaDatiStatoGroup, che
   * fornisce già il bordo condiviso col pulsante "Scheda dati".
   */
  variante?: 'autonomo' | 'raggruppato'
}
```
Nella firma del componente, aggiungi il parametro con default:
```tsx
export const SchedaStatoToggle = ({ compilazione, onScegli, disabled, variante = 'autonomo' }: SchedaStatoToggleProps) => {
```
Nel `Button` interno, aggiungi al blocco `sx` esistente le regole condizionali per la variante raggruppata:
```tsx
            sx={{
              minWidth: 0, px: 0.75, '& .MuiButton-endIcon': { ml: 0.25 },
              ...(variante === 'raggruppato'
                ? { border: 'none', borderRadius: 0, borderLeft: '1px solid', borderColor: 'divider' }
                : {}),
            }}
```

- [ ] **Step 2: Crea `SchedaDatiStatoGroup.tsx`**

`src/components/requests/SchedaDatiStatoGroup.tsx`:
```tsx
import { Box, Button } from '@mui/material'
import { Assignment as AssignmentIcon } from '@mui/icons-material'
import { SchedaStatoToggle, type SchedaStatoToggleProps } from './SchedaStatoToggle'

export interface SchedaDatiStatoGroupProps {
  onApri: () => void
  toggle: Omit<SchedaStatoToggleProps, 'variante'>
}

/**
 * "Scheda dati" e il suo stato di compilazione fusi in un solo contorno: due zone
 * cliccabili — naviga a sinistra, apre il menu di stato a destra — che si leggono come un
 * unico controllo invece di due elementi slegati fianco a fianco.
 */
export const SchedaDatiStatoGroup = ({ onApri, toggle }: SchedaDatiStatoGroupProps) => (
  <Box sx={{ display: 'flex', border: 1, borderColor: 'primary.main', borderRadius: 1, overflow: 'hidden' }}>
    <Button
      size="small"
      variant="contained"
      color="primary"
      disableElevation
      startIcon={<AssignmentIcon />}
      onClick={onApri}
      sx={{ borderRadius: 0 }}
    >
      Scheda dati
    </Button>
    <SchedaStatoToggle {...toggle} variante="raggruppato" />
  </Box>
)
```

- [ ] **Step 3: Usa il gruppo in `RequestDetail.tsx`**

Aggiungi l'import:
```tsx
import { SchedaDatiStatoGroup } from '@/components/requests/SchedaDatiStatoGroup'
```
Sostituisci, dentro `primaryActions`:
```tsx
              {canAccessTechnicalDetails && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<AssignmentIcon />}
                  onClick={() => navigate(`/requests/${id}/technical-details`)}
                >
                  Scheda dati
                </Button>
              )}
              {canAccessTechnicalDetails && canToggleUrgent && (
                <SchedaStatoToggle
                  compilazione={compilazioneDiPratica(request)}
                  onScegli={handleStatoScheda}
                  disabled={salvandoStatoScheda}
                />
              )}
```
con:
```tsx
              {canAccessTechnicalDetails && canToggleUrgent && (
                <SchedaDatiStatoGroup
                  onApri={() => navigate(`/requests/${id}/technical-details`)}
                  toggle={{
                    compilazione: compilazioneDiPratica(request),
                    onScegli: handleStatoScheda,
                    disabled: salvandoStatoScheda,
                  }}
                />
              )}
              {canAccessTechnicalDetails && !canToggleUrgent && (
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  startIcon={<AssignmentIcon />}
                  onClick={() => navigate(`/requests/${id}/technical-details`)}
                >
                  Scheda dati
                </Button>
              )}
```
(Il ramo `!canToggleUrgent` preserva esattamente il comportamento di oggi per i ruoli che vedono "Scheda dati" ma non lo stato: nessuna regressione di permessi.)

L'import diretto di `SchedaStatoToggle` in questo file può restare (serve comunque al tipo `SchedaDatiStatoGroupProps['toggle']` se il file lo referenzia altrove) o essere rimosso se non più usato altrove nel file — verificalo con una ricerca su `SchedaStatoToggle` prima di toglierlo.

- [ ] **Step 4: Esegui la suite dei test del dettaglio pratica**

Run: `npx vitest run src/pages/__tests__ src/components/requests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/requests/SchedaStatoToggle.tsx src/components/requests/SchedaDatiStatoGroup.tsx src/pages/RequestDetail.tsx
git commit -m "feat(dettaglio-pratica): Scheda dati e il suo stato in un unico gruppo con bordo condiviso"
```

---

## Verifica finale

- [ ] `npx vitest run` — intera suite verde
- [ ] `npx tsc --noEmit` — nessun errore di tipo
- [ ] `npx eslint src` — nessun errore
- [ ] Avviare il dev server e verificare a mano, su una pratica DM329 reale: generare una relazione → il pulsante diventa verde e resta tale dopo un refresh della pagina; generare le dichiarazioni → stesso comportamento; le pillole delle apparecchiature soggette ad adempimento compaiono blu e diventano verdi dopo aver composto il fascicolo di una di esse; "Scarica documentazione completa" resta disabilitato finché manca anche un solo documento, poi diventa verde e scarica tutto; nel dettaglio pratica "Scheda dati" e lo stato si leggono come un unico controllo.
