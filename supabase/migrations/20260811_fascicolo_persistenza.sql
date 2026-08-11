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
-- Sta in una funzione sola perché serve a tre policy: le due tabelle e la policy di Storage.
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
  to authenticated
  using (public.can_access_fascicolo(request_id))
  with check (public.can_access_fascicolo(request_id));

-- 'for all' include la cancellazione: decisione del committente, non svista. Su
-- dm329_technical_data la cancellazione è riservata agli admin, ma qui chi può modificare
-- la scheda deve poter gestire anche i suoi documenti — rimuovere un file caricato per
-- sbaglio è lavoro ordinario, e la nota di scadenza va ripulita al nuovo caricamento.
drop policy if exists "Lettura delle scadenze del fascicolo" on public.fascicolo_scadenze;
drop policy if exists "Accesso alle scadenze del fascicolo" on public.fascicolo_scadenze;
create policy "Accesso alle scadenze del fascicolo"
  on public.fascicolo_scadenze for all
  to authenticated
  using (public.can_access_fascicolo(request_id))
  with check (public.can_access_fascicolo(request_id));

-- Bucket privato, distinto da `attachments`: i due hanno regole di visibilità diverse.
insert into storage.buckets (id, name, public)
values ('fascicoli', 'fascicoli', false)
on conflict (id) do nothing;

-- Il request_id è il primo segmento del percorso: {request_id}/{codice}/{file}
-- storage.objects è condivisa fra bucket: quelli di `attachments` cominciano con
-- 'requests/', non un uuid. Postgres non garantisce l'ordine di valutazione degli
-- operandi di un AND, quindi il cast a uuid va dentro un CASE — la sola forma la cui
-- valutazione in ordine è garantita — per non rischiare di rompere gli allegati
-- se il pianificatore valuta il cast prima del filtro su bucket_id.
drop policy if exists "Accesso agli oggetti del fascicolo" on storage.objects;
create policy "Accesso agli oggetti del fascicolo"
  on storage.objects for all
  to authenticated
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
