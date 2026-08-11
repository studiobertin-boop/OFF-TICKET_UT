-- Schedula la passata notturna che preavvisa, cancella i documenti scaduti e rimuove gli orfani.
-- La regola di scadenza vive in src/services/fascicolo/scadenza.ts (Task 1); qui si schedula
-- solo la chiamata alla Edge Function che quella regola la applica davvero (Task 7).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Due segreti nel Vault, non nel comando del job: cron.job è leggibile, un segreto in chiaro
-- lì dentro sarebbe un segreto in meno.
-- `service_role_key`: autentica la chiamata (bypassa RLS, come fa il client con l'utente loggato).
-- `fascicolo_cron_secret`: header applicativo x-cron-key che la funzione confronta col proprio
-- secret d'ambiente. Serve perché la sola verifica del JWT non basta: la anon key è pubblica,
-- finisce nel bundle del frontend, e chiunque la legga potrebbe far partire a comando un job che
-- cancella file. Senza questo secondo segreto la firma valida del JWT sarebbe l'unica barriera.
--
-- Entrambi i blocchi sono rieseguibili con una guardia in più rispetto al pattern minimo: se il
-- valore da scrivere ha ancora la forma testuale del segnaposto (perché la migration è stata
-- riapplicata dal repo senza sostituirlo), il blocco esce con un `raise notice` e non tocca il
-- secret esistente. Senza questa guardia, riapplicare il file così com'è spegnerebbe in silenzio
-- la passata notturna: il job continuerebbe a chiamare la funzione, ma con un'intestazione
-- Authorization letterale, la funzione risponderebbe 401, e la risposta di net.http_post finisce
-- in net._http_response — che nessuno legge di routine. Il segnaposto letterale compare una sola
-- volta per blocco (nella dichiarazione), così sostituirlo con lo strumento che applica la
-- migration (cercare-e-sostituire sul valore vero) non lo lascia scritto altrove nel file.
do $$
declare
  v_valore text := '<service role key>';
begin
  if v_valore ~ '^<.*>$' then
    raise notice 'Segnaposto non sostituito: service_role_key non viene toccato. Sostituire il valore prima di applicare la migration.';
  elsif exists (select 1 from vault.secrets where name = 'service_role_key') then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'service_role_key'),
      v_valore
    );
  else
    perform vault.create_secret(
      v_valore,
      'service_role_key',
      'Chiave usata dai job notturni per chiamare le Edge Function'
    );
  end if;
end $$;

do $$
declare
  v_valore text := '<cron secret key>';
begin
  if v_valore ~ '^<.*>$' then
    raise notice 'Segnaposto non sostituito: fascicolo_cron_secret non viene toccato. Sostituire il valore (lo stesso impostato come secret CRON_SECRET della funzione) prima di applicare la migration.';
  elsif exists (select 1 from vault.secrets where name = 'fascicolo_cron_secret') then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'fascicolo_cron_secret'),
      v_valore
    );
  else
    perform vault.create_secret(
      v_valore,
      'fascicolo_cron_secret',
      'Header x-cron-key che autorizza pulisci-fascicoli-scaduti: deve combaciare col secret CRON_SECRET della funzione'
    );
  end if;
end $$;

select cron.unschedule('pulisci-fascicoli-scaduti')
where exists (select 1 from cron.job where jobname = 'pulisci-fascicoli-scaduti');

select cron.schedule(
  'pulisci-fascicoli-scaduti',
  '0 3 * * *',
  $$
  select net.http_post(
    url := 'https://uphftgpwisdiubuhohnc.supabase.co/functions/v1/pulisci-fascicoli-scaduti',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'service_role_key'),
      'x-cron-key', (select decrypted_secret from vault.decrypted_secrets
                     where name = 'fascicolo_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
