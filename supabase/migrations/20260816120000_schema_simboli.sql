-- Taratura permanente dei simboli dello schema d'impianto: una riga per chiave simbolo.
-- Il default di fabbrica resta nel codice (REGISTRO_SIMBOLI): l'assenza di riga significa
-- «non tarato», ed è ciò a cui torna il pulsante «torna a default».
create table if not exists public.schema_simboli (
  chiave text primary key,
  taratura jsonb not null,
  aggiornato_da uuid references public.users(id),
  aggiornato_il timestamptz not null default now()
);

alter table public.schema_simboli enable row level security;

-- Lettura a chiunque sia autenticato: il disegno serve a tutti.
drop policy if exists "Lettura delle tarature dei simboli" on public.schema_simboli;
create policy "Lettura delle tarature dei simboli"
  on public.schema_simboli for select
  to authenticated
  using (true);

-- Scrittura al solo amministratore: una taratura permanente tocca OGNI pratica, comprese
-- quelle già consegnate. Il ruolo si legge da public.users, non da un claim del JWT: è lo
-- stesso pattern usato dalle policy vere già in produzione su equipment_catalog e
-- dm329_technical_data (verificate su pg_policies prima di scrivere questa migrazione).
drop policy if exists "Scrittura delle tarature dei simboli riservata all'admin" on public.schema_simboli;
create policy "Scrittura delle tarature dei simboli riservata all'admin"
  on public.schema_simboli for all
  to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
