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
