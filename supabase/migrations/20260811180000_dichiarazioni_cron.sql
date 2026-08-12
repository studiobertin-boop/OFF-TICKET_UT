-- Schedula la passata notturna per le dichiarazioni, gemella di quella del fascicolo
-- apparecchiatura (20260811110000_fascicolo_cron.sql). Riusa gli STESSI due secret del Vault
-- (service_role_key, fascicolo_cron_secret): sono un'autorizzazione interna al progetto, non
-- specifica al fascicolo — e i secret delle Edge Function sono condivisi a livello di
-- progetto — quindi non serve crearne di nuovi né ridistribuire un nuovo CRON_SECRET alla
-- funzione `pulisci-dichiarazioni-scadute` quando verrà distribuita.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('pulisci-dichiarazioni-scadute')
where exists (select 1 from cron.job where jobname = 'pulisci-dichiarazioni-scadute');

select cron.schedule(
  'pulisci-dichiarazioni-scadute',
  '10 3 * * *',
  $$
  select net.http_post(
    url := 'https://uphftgpwisdiubuhohnc.supabase.co/functions/v1/pulisci-dichiarazioni-scadute',
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
