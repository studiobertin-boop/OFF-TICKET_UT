-- Chiude la segnalazione di sicurezza Supabase "rls_disabled_in_public" (17-08-2026).
--
-- Undici tabelle nello schema public avevano RLS disattivato pur avendo grant
-- completi a anon/authenticated: erano leggibili e scrivibili da chiunque
-- conoscesse l'URL del progetto, usando la sola chiave anon del bundle.
--
-- Dieci erano copie di backup o tabelle di lavoro delle migrazioni, senza
-- foreign key ne' viste dipendenti e senza riferimenti nel codice: si eliminano.
-- La undicesima, request_completions, e' letta dalla dashboard analytics e
-- viene messa in sicurezza con RLS + policy di sola lettura per gli autenticati.

-- 1. request_completions: RLS con lettura per gli utenti autenticati.
alter table public.request_completions enable row level security;

drop policy if exists "request_completions_select_authenticated" on public.request_completions;
create policy "request_completions_select_authenticated"
  on public.request_completions
  for select
  to authenticated
  using (true);

-- Nessuna policy di scrittura: la tabella e' alimentata dai trigger
-- SECURITY DEFINER e dal service_role, che ignorano RLS.
revoke insert, update, delete on public.request_completions from anon, authenticated;
revoke all on public.request_completions from anon;

-- 2. Backup e tabelle di lavoro: eliminate (dump JSON conservato fuori dal repo).
drop table if exists public.customer_users_backup_20260704;
drop table if exists public.customers_backup_20251120;
drop table if exists public.customers_backup_20260704;
drop table if exists public.customers_backup_pre_cleanup_20251120;
drop table if exists public.dedup_plan;
drop table if exists public.equipment_catalog_normalization_log;
drop table if exists public.requests_backup_20251120;
drop table if exists public.requests_backup_20260704;
drop table if exists public.requests_customer_backup_20251120;
drop table if exists public.requests_practicecode_backup_20260706;
