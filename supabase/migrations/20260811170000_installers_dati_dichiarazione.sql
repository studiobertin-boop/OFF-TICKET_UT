-- Dati dell'installatore che servono al testo della dichiarazione installatore (parte 4 delle
-- "dichiarazioni" DM329), non presenti nell'anagrafica esistente:
--
-- - legale_rappresentante: chi firma la "dichiarazione sostitutiva dell'atto di notorietà".
--   Non deducibile da `nome`, che è la ragione sociale della ditta installatrice, non la
--   persona fisica che dichiara.
-- - predefinito: quale installatore ha gli asset statici di default (template della parte 4 +
--   documento d'identità della parte 5) in public/templates/dichiarazioni/. Un solo
--   installatore può essere predefinito alla volta — vincolato dall'indice parziale unico,
--   non da un semplice check, perché il vincolo attraversa più righe.

alter table public.installers
  add column if not exists legale_rappresentante text,
  add column if not exists predefinito boolean not null default false;

create unique index if not exists installers_un_solo_predefinito
  on public.installers (predefinito)
  where predefinito = true;

update public.installers
set legale_rappresentante = 'Vedelago Hubert',
    predefinito = true
where nome = 'OFFICINA DEL COMPRESSORE S.R.L.';

comment on column public.installers.legale_rappresentante is
  'Persona fisica che firma la dichiarazione sostitutiva dell''atto di notorietà per conto della ditta installatrice';
comment on column public.installers.predefinito is
  'Vero per l''installatore i cui asset statici (template dichiarazione + documento identità) sono il default in public/templates/dichiarazioni/. Un solo predefinito alla volta.';
