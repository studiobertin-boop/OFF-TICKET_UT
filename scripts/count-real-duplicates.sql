-- Query per trovare tutti i duplicati reali
-- Esegui questa query nell'SQL Editor di Supabase

SELECT
  LOWER(TRIM(ragione_sociale)) as nome_normalizzato,
  COUNT(*) as num_duplicati,
  ARRAY_AGG(id) as customer_ids,
  ARRAY_AGG(external_id) as external_ids,
  ARRAY_AGG(created_at ORDER BY created_at) as date_creazione
FROM customers
WHERE is_active = true
GROUP BY LOWER(TRIM(ragione_sociale))
HAVING COUNT(*) > 1
ORDER BY num_duplicati DESC, nome_normalizzato;
