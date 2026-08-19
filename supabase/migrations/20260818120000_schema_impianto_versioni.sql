-- Cronologia delle versioni salvate a mano dello schema d'impianto: fino a 5 istantanee PNG
-- per pratica, utili per recuperare un disegno prima di premere «Rigenera da capo». Stesso
-- schema di `relazione_documenti`/bucket `relazioni`, ma senza tabella di scadenza: qui non
-- c'è una passata notturna che purga, il limite di 5 lo applica il servizio all'inserimento.

create table if not exists public.schema_impianto_versioni (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  file_path text not null unique,
  file_size bigint not null,
  larghezza_px integer not null,
  altezza_px integer not null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

create index if not exists schema_impianto_versioni_pratica
  on public.schema_impianto_versioni (request_id, created_at);

alter table public.schema_impianto_versioni enable row level security;

drop policy if exists "Accesso alle versioni dello schema impianto" on public.schema_impianto_versioni;
create policy "Accesso alle versioni dello schema impianto"
  on public.schema_impianto_versioni for all
  to authenticated
  using (public.can_access_fascicolo(request_id))
  with check (public.can_access_fascicolo(request_id));

-- Bucket privato, distinto da `relazioni`/`fascicoli`/`dichiarazioni`/`attachments`.
insert into storage.buckets (id, name, public)
values ('schema-impianto-versioni', 'schema-impianto-versioni', false)
on conflict (id) do nothing;

drop policy if exists "Accesso agli oggetti delle versioni schema impianto" on storage.objects;
create policy "Accesso agli oggetti delle versioni schema impianto"
  on storage.objects for all
  to authenticated
  using (
    case when bucket_id = 'schema-impianto-versioni'
         then public.can_access_fascicolo(((storage.foldername(name))[1])::uuid)
         else false end
  )
  with check (
    case when bucket_id = 'schema-impianto-versioni'
         then public.can_access_fascicolo(((storage.foldername(name))[1])::uuid)
         else false end
  );
