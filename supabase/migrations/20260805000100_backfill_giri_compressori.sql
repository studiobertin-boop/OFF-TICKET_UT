-- Regolazione dei giri dei compressori: da dato della relazione a proprietà del modello.
--
-- `specs.giri` ('fissi' | 'variabili') vive nel catalogo perché è una caratteristica costruttiva
-- del modello, non dell'esemplare installato: chiederla a ogni relazione significava riscrivere
-- ogni volta la stessa informazione, con il rischio di rispondere diversamente sulla stessa
-- macchina. In scheda dati il campo si legge soltanto; si modifica da Gestisci Apparecchiature.
--
-- Il backfill valorizza SOLO ciò di cui c'è prova positiva: il suffisso commerciale che i
-- costruttori usano per le macchine a velocità variabile. KAESER SFC (Sigma Frequency Control),
-- Ceccato IVR (Inverter Variable Regulation), Atlas Copco VSD, FINI VS.
--
-- Le righe restanti NON vengono marcate 'fissi'. L'assenza del suffisso non è prova di giri
-- fissi — esistono modelli a velocità variabile senza sigla, e la migration di normalizzazione
-- 20260804000000 ha già rimosso pezzi dai nomi. Il valore finisce in una frase asseverata di una
-- relazione tecnica firmata: un 'fissi' sbagliato è silenzioso e si propaga, un campo vuoto fa
-- ricomparire la domanda nel dialog «Genera Relazione», che poi riscrive la risposta a catalogo.
--
-- Ispezione preliminare eseguita il 2026-08-02: 61 modelli distinti, 141 righe. Nessun falso
-- positivo — tutte le occorrenze di VS e VSD sono macchine inverter dichiarate.
--   SELECT marca, modello, count(*) FROM equipment_catalog
--   WHERE tipo_apparecchiatura='Compressori' AND is_active
--     AND (specs->>'tipo_compressore' IS NULL OR specs->>'tipo_compressore'='VITE')
--     AND modello ~ '\m(SFC|IVR|VSD|VS)\M'
--   GROUP BY 1,2 ORDER BY 1,2;
--
-- Le delimitazioni di parola \m e \M sono indispensabili: senza, «VS» matcherebbe dentro
-- parole arbitrarie.

UPDATE equipment_catalog
SET specs = jsonb_set(COALESCE(specs, '{}'::jsonb), '{giri}', '"variabili"', true),
    updated_at = now()
WHERE tipo_apparecchiatura = 'Compressori'
  AND is_active
  AND specs ->> 'giri' IS NULL
  -- Il criterio è «rotativo a vite o tipo non dichiarato»: a produzione `tipo_compressore`
  -- non è valorizzato su nessuna riga, e la scheda dati tratta «rotativo a vite» come default.
  AND (specs ->> 'tipo_compressore' IS NULL OR specs ->> 'tipo_compressore' = 'VITE')
  AND modello ~ '\m(SFC|IVR|VSD|VS)\M';
