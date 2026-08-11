-- Schedula la passata notturna che preavvisa, cancella i documenti scaduti e rimuove gli orfani.
-- La regola di scadenza vive in src/services/fascicolo/scadenza.ts (Task 1); qui si schedula
-- solo la chiamata alla Edge Function che quella regola la applica davvero (Task 7).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- La chiave sta nel Vault e non nel comando del job: cron.job è leggibile, un segreto in chiaro
-- lì dentro sarebbe un segreto in meno.
-- `create_secret` fallisce se il nome esiste già: la migration deve restare rieseguibile.
-- Il segnaposto qui sotto si sostituisce col valore vero (da .env.local, SUPABASE_SERVICE_ROLE_KEY)
-- solo al momento di applicare la migration — non va mai committato in chiaro nel repo.
do $$
begin
  if exists (select 1 from vault.secrets where name = 'service_role_key') then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'service_role_key'),
      '<service role key>'
    );
  else
    perform vault.create_secret(
      '<service role key>',
      'service_role_key',
      'Chiave usata dai job notturni per chiamare le Edge Function'
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
                                     where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
