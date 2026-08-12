-- Persistenza dei documenti delle "dichiarazioni" DM329 (dichiarazione marca da bollo,
-- attestazione, documento d'identità utilizzatore, dichiarazione installatore generata,
-- documento d'identità installatore).
--
-- A differenza del fascicolo apparecchiatura, qui la granularità è per pratica intera (non
-- per apparecchiatura) e per pagina (non per file): un utente può caricare un unico PDF con
-- pagine di ruoli diversi intercalate (bollo + attestazione + documento d'identità nello
-- stesso file, in un ordine qualsiasi), quindi l'assegnazione avviene pagina per pagina
-- dentro la colonna `assegnazioni`.

create table if not exists public.dichiarazioni_documenti (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  -- 'sorgente' = file caricato dall'utente (bollo/attestazione/doc. identità utilizzatore, da
  --   assegnare pagina per pagina); 'override_id_installatore' = documento d'identità
  --   dell'installatore diverso dal predefinito, solo per questa pratica; 'finale' = il PDF
  --   a 5 parti già composto.
  tipo text not null check (tipo in ('sorgente', 'override_id_installatore', 'finale')),
  -- Numero di pagine del file, calcolato una volta al caricamento: evita di riaprire il PDF
  -- con pdf.js solo per saperlo. Solo per tipo='sorgente'.
  n_pagine integer,
  -- [{ pagina: number, ruolo: 'BOLLO'|'ATTESTAZIONE'|'DOC_IDENTITA_UTILIZZATORE'|null, ordine: number }]
  -- Solo per tipo='sorgente'. 'ordine' è la posizione dentro il ruolo, non dentro il file:
  -- permette di intercalare pagine di file diversi nello stesso ruolo.
  assegnazioni jsonb not null default '[]',
  file_name text not null,
  file_path text not null unique,
  file_size bigint not null,
  mime_type text,
  uploaded_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists dichiarazioni_documenti_pratica
  on public.dichiarazioni_documenti (request_id);

-- Riga unica «dichiarazioni scadute il …»: una per pratica, non una per apparecchiatura —
-- qui non esiste il concetto di apparecchiatura singola come nel fascicolo.
create table if not exists public.dichiarazioni_scadenze (
  request_id uuid primary key references public.requests(id) on delete cascade,
  purgato_il timestamptz not null default now(),
  n_file integer not null default 0
);

-- Chi vede la scheda tecnica vede anche le dichiarazioni, condivisione compresa: stessa
-- regola del fascicolo apparecchiatura. Si riusa `can_access_fascicolo` invece di duplicarla
-- sotto un altro nome — nonostante il nome storico, la funzione non verifica nulla di
-- specifico al fascicolo, solo l'accesso alla scheda tecnica della pratica.
alter table public.dichiarazioni_documenti enable row level security;
alter table public.dichiarazioni_scadenze enable row level security;

drop policy if exists "Accesso ai documenti delle dichiarazioni" on public.dichiarazioni_documenti;
create policy "Accesso ai documenti delle dichiarazioni"
  on public.dichiarazioni_documenti for all
  to authenticated
  using (public.can_access_fascicolo(request_id))
  with check (public.can_access_fascicolo(request_id));

drop policy if exists "Accesso alle scadenze delle dichiarazioni" on public.dichiarazioni_scadenze;
create policy "Accesso alle scadenze delle dichiarazioni"
  on public.dichiarazioni_scadenze for all
  to authenticated
  using (public.can_access_fascicolo(request_id))
  with check (public.can_access_fascicolo(request_id));

-- Bucket privato, distinto da `fascicoli` e da `attachments`: contiene documenti d'identità
-- e firme, i più sensibili dei tre.
insert into storage.buckets (id, name, public)
values ('dichiarazioni', 'dichiarazioni', false)
on conflict (id) do nothing;

-- Il request_id è il primo segmento del percorso: {request_id}/{file}. Stesso schema del
-- fascicolo (case per garantire l'ordine di valutazione: bucket_id prima del cast a uuid).
drop policy if exists "Accesso agli oggetti delle dichiarazioni" on storage.objects;
create policy "Accesso agli oggetti delle dichiarazioni"
  on storage.objects for all
  to authenticated
  using (
    case when bucket_id = 'dichiarazioni'
         then public.can_access_fascicolo(((storage.foldername(name))[1])::uuid)
         else false end
  )
  with check (
    case when bucket_id = 'dichiarazioni'
         then public.can_access_fascicolo(((storage.foldername(name))[1])::uuid)
         else false end
  );

-- Ciò che serve a datare la scadenza, per le sole pratiche che hanno documenti.
create or replace view public.dichiarazioni_movimenti
with (security_invoker = on) as
select
  r.id as request_id,
  r.status as stato,
  r.updated_at as aggiornata_il,
  r.created_at as creata_il,
  (select max(h.created_at) from public.request_history h where h.request_id = r.id)
    as ultimo_cambio_stato
from public.requests r
where exists (select 1 from public.dichiarazioni_documenti d where d.request_id = r.id);
