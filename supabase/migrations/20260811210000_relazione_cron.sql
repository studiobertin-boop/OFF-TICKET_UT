-- Schedula la passata notturna della relazione, gemella di quella del fascicolo (03:00) e
-- delle dichiarazioni (03:10). Riusa gli stessi due secret del Vault: sono un'autorizzazione
-- di progetto, non specifica al fascicolo, e le Edge Function condividono già lo stesso
-- CRON_SECRET d'ambiente — non serve crearne di nuovi. Orario 03:05 per non accavallare le
-- altre due passate.

select cron.unschedule('pulisci-relazioni-scadute')
where exists (select 1 from cron.job where jobname = 'pulisci-relazioni-scadute');

select cron.schedule(
  'pulisci-relazioni-scadute',
  '5 3 * * *',
  $$
  select net.http_post(
    url := 'https://uphftgpwisdiubuhohnc.supabase.co/functions/v1/pulisci-relazioni-scadute',
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
