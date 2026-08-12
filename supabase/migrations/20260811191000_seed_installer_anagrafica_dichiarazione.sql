-- Popola i nuovi campi anagrafici per l'installatore predefinito, ricavati da due
-- dichiarazioni reali già emesse dallo studio per Officina del Compressore.

update public.installers
set
  legale_rappresentante_nascita_luogo = 'Treviso',
  legale_rappresentante_nascita_data = '21.08.1970',
  legale_rappresentante_residenza_via = 'via San Tommaso Moro nr. 23 int.4',
  legale_rappresentante_residenza_comune = 'Paese',
  legale_rappresentante_residenza_provincia = 'TV',
  posizione_inail = '4816045',
  telefono = '0422-959607',
  pec = 'officomp@pec.officomp.it'
where nome = 'OFFICINA DEL COMPRESSORE S.R.L.';
