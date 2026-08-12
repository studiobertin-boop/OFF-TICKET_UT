-- Dati aggiuntivi dell'installatore/legale rappresentante richiesti dal testo reale della
-- "dichiarazione sostitutiva dell'atto di notorietà" (parte 4 delle dichiarazioni DM329),
-- emerso confrontando due dichiarazioni reali con il primo tentativo di template: mancavano
-- luogo/data di nascita e residenza del legale rappresentante, e posizione INAIL/telefono/PEC
-- della ditta installatrice (tutti citati nel paragrafo introduttivo della dichiarazione).
--
-- Luogo/data di nascita e residenza sono del legale rappresentante (persona fisica), non
-- della ditta: da qui il prefisso `legale_rappresentante_`. Posizione INAIL, telefono e PEC
-- sono invece della ditta installatrice.

alter table public.installers
  add column if not exists legale_rappresentante_nascita_luogo text,
  add column if not exists legale_rappresentante_nascita_data text,
  add column if not exists legale_rappresentante_residenza_via text,
  add column if not exists legale_rappresentante_residenza_comune text,
  add column if not exists legale_rappresentante_residenza_provincia text,
  add column if not exists posizione_inail text,
  add column if not exists telefono text,
  add column if not exists pec text;

comment on column public.installers.legale_rappresentante_nascita_luogo is
  'Luogo di nascita del legale rappresentante, per il paragrafo introduttivo della dichiarazione sostitutiva';
comment on column public.installers.legale_rappresentante_nascita_data is
  'Data di nascita del legale rappresentante, testo libero nel formato in cui va stampata (es. "21.08.1970")';
comment on column public.installers.legale_rappresentante_residenza_via is
  'Via e numero civico di residenza del legale rappresentante';
comment on column public.installers.legale_rappresentante_residenza_comune is
  'Comune di residenza del legale rappresentante';
comment on column public.installers.legale_rappresentante_residenza_provincia is
  'Provincia di residenza del legale rappresentante (sigla)';
comment on column public.installers.posizione_inail is
  'Posizione INAIL della ditta installatrice';
comment on column public.installers.telefono is
  'Telefono della ditta installatrice, per il paragrafo introduttivo della dichiarazione';
comment on column public.installers.pec is
  'Indirizzo PEC della ditta installatrice';
