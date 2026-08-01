-- Bonifica dei codici apparecchiatura mancanti nelle schede DM329.
--
-- Origine: il batch OCR costruiva i record senza il campo `codice` e riempiva i buchi con `{}`.
-- Al 2026-07-30 la situazione in produzione è: 44 apparecchiature in 15 schede, di cui 35 con
-- codice corretto, 9 con codice nullo in 2 schede, 0 fuori sequenza.
--
-- La migrazione NON rinumera nulla: i codici già validi restano dove sono, coerentemente con
-- l'identità stabile (eliminando S2 da S1/S2/S3 l'ex S3 resta S3). Assegna soltanto un codice a
-- chi non ne ha uno valido, in base alla posizione nell'array.
--
-- Entrambe le istruzioni sono idempotenti: rieseguirle non produce ulteriori modifiche.

-- 1. Codici mancanti negli array principali.
--
-- L'UPDATE è ristretto alle due sole schede da bonificare. Non è timidezza: è la restrizione che
-- rende sicura l'assegnazione posizionale. Su un array che contiene già codici validi, `prefix||ord`
-- ne conierebbe di duplicati (per [{codice:'S2'}, {}] l'ord 2 assegnerebbe un secondo 'S2'), e il
-- regex non limitato accetterebbe come valido un 'S99' che l'app invece riassegna. Su queste due
-- schede nessuno dei due casi esiste: la verifica in produzione ha mostrato solo codici nulli, senza
-- alcun codice valido con cui collidere. Fuori da qui la bonifica non serve, quindi non si applica.
with parents(arr, prefix) as (
  values ('serbatoi', 'S'), ('compressori', 'C'), ('essiccatori', 'E'),
         ('filtri', 'F'), ('separatori', 'SEP')
),
per_array as (
  select d.id,
         p.arr,
         (
           select jsonb_agg(
                    case
                      -- Un elemento scalare (es. un `null` nell'array) non ha un percorso da
                      -- impostare: `jsonb_set` solleverebbe "cannot set path in scalar" e farebbe
                      -- fallire l'intera migrazione. Lo si lascia passare intatto.
                      when jsonb_typeof(elem) <> 'object' then elem
                      when elem->>'codice' ~ ('^' || p.prefix || '[0-9]+$') then elem
                      else jsonb_set(elem, '{codice}', to_jsonb(p.prefix || ord::text))
                    end
                    order by ord
                  )
           from jsonb_array_elements(d.equipment_data->p.arr) with ordinality as t(elem, ord)
         ) as new_arr
  from dm329_technical_data d
  cross join parents p
  where d.request_id in (
          '81e04b73-2aa7-427d-b7e8-397f45660ba0',
          'e642f56e-5dd6-4b63-9788-57bfe2bef407'
        )
    and jsonb_typeof(d.equipment_data->p.arr) = 'array'
    and jsonb_array_length(d.equipment_data->p.arr) > 0
),
merged as (
  select id, jsonb_object_agg(arr, new_arr) as patch
  from per_array
  where new_arr is not null
  group by id
)
update dm329_technical_data d
set equipment_data = d.equipment_data || m.patch,
    updated_at = now()
from merged m
where d.id = m.id
  -- Idempotenza: aggiorna solo le righe che cambiano davvero.
  and (d.equipment_data || m.patch) <> d.equipment_data;

-- 2. Disoleatore orfano della richiesta 81e04b73: `codice: "undefined.1"` e riferimento nullo.
--    L'attribuzione è determinata, non indovinata: il terzo compressore (C3) è l'unico con
--    `ha_disoleatore` a true.
update dm329_technical_data
set equipment_data = jsonb_set(
      equipment_data,
      '{disoleatori,0}',
      (equipment_data->'disoleatori'->0)
        || jsonb_build_object('codice', 'C3.1', 'compressore_associato', 'C3')
    ),
    updated_at = now()
where request_id = '81e04b73-2aa7-427d-b7e8-397f45660ba0'
  and equipment_data->'disoleatori'->0->>'codice' = 'undefined.1';
