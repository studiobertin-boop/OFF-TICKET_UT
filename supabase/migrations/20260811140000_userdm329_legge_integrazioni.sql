-- userdm329: lettura della storia e dei blocchi anche sulle DM329-Integrazioni.
--
-- Il codice dell'applicazione tratta `DM329` e `DM329-Integrazioni` come un'unica famiglia
-- (`isDM329Family` in src/utils/workflow.ts) e su `requests` esistono già le policy gemelle per
-- il tipo Integrazioni. Su `request_history` e `request_blocks`, invece, le policy di userdm329
-- filtrano `rt.name = 'DM329'` esatto: sulle 8 pratiche Integrazioni in produzione userdm329 —
-- che è la persona che le lavora — non legge nulla di quelle due tabelle.
--
-- Il caso peggiore è silenzioso: `authenticated` ha comunque il GRANT di tabella, quindi l'RLS
-- filtra le righe senza errore e la query torna vuota. Indistinguibile da «non c'è storia»: la
-- sezione fascicolo ne ricava una data di cancellazione calcolata sulla data di creazione della
-- pratica invece che sull'ultimo cambio di stato — una data falsa su pratiche chiuse da mesi.
--
-- Policy nuove e additive, non modifiche a quelle esistenti: le policy PERMISSIVE si sommano in
-- OR, quindi il percorso DM329 già funzionante non viene toccato. Stessa forma già adottata su
-- `requests` per lo stesso problema.
--
-- Fuori da questa migrazione, per scelta: i permessi di scrittura (UPDATE/DELETE su `requests`,
-- INSERT su `request_history`, INSERT/UPDATE su `request_blocks`) restano ristretti a `DM329`.

-- Idempotente: eseguibile più volte senza effetti collaterali.
drop policy if exists "userdm329 can view DM329-Integrazioni request history" on public.request_history;

create policy "userdm329 can view DM329-Integrazioni request history"
  on public.request_history
  for select
  to authenticated
  using (
    public.get_user_role() = 'userdm329'::user_role
    and exists (
      select 1
      from public.requests r
      join public.request_types rt on rt.id = r.request_type_id
      where r.id = request_history.request_id
        and rt.name = 'DM329-Integrazioni'
    )
  );

drop policy if exists "userdm329 can view blocks on DM329-Integrazioni requests" on public.request_blocks;

create policy "userdm329 can view blocks on DM329-Integrazioni requests"
  on public.request_blocks
  for select
  to authenticated
  using (
    public.get_user_role() = 'userdm329'::user_role
    and exists (
      select 1
      from public.requests r
      join public.request_types rt on rt.id = r.request_type_id
      where r.id = request_blocks.request_id
        and rt.name = 'DM329-Integrazioni'
    )
  );
