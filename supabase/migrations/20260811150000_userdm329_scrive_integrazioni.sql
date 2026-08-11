-- userdm329: scrittura anche sulle DM329-Integrazioni.
--
-- Completa la migrazione 20260811140000, che aveva sistemato la sola lettura. Il codice
-- dell'applicazione tratta `DM329` e `DM329-Integrazioni` come un'unica famiglia
-- (`isDM329Family` in src/utils/workflow.ts) e su quella base decide cosa mostrare: `canBlock` in
-- RequestDetail.tsx accende il pulsante «blocca» su tutta la famiglia. Le policy di scrittura,
-- invece, filtravano `rt.name = 'DM329'` esatto — quindi su un'Integrazione il pulsante compariva
-- e restituiva un errore di permessi.
--
-- Policy nuove e additive, non modifiche a quelle esistenti: le PERMISSIVE si sommano in OR,
-- quindi il percorso DM329 già funzionante non viene toccato. Stessa forma delle gemelle che
-- esistevano già su `requests` per SELECT e INSERT.
--
-- Effetto voluto oltre a quello ovvio: con le due UPDATE su `requests` che si sommano, userdm329
-- può finalmente convertire una pratica da DM329 a DM329-Integrazioni e viceversa. La USING
-- guarda la riga vecchia e la WITH CHECK quella nuova: con una sola delle due policy la
-- conversione falliva sempre, da qualunque verso. L'interfaccia quella conversione la offre già
-- (RequestDetail.tsx riscrive il titolo al cambio di tipo).

-- Idempotente: eseguibile piu' volte senza effetti collaterali.

-- ---------------------------------------------------------------- requests: UPDATE e DELETE

drop policy if exists "userdm329 can update DM329-Integrazioni requests" on public.requests;

create policy "userdm329 can update DM329-Integrazioni requests"
  on public.requests
  for update
  to authenticated
  using (
    public.get_user_role() = 'userdm329'::user_role
    and request_type_id in (select id from public.request_types where name = 'DM329-Integrazioni')
  )
  with check (
    public.get_user_role() = 'userdm329'::user_role
    and request_type_id in (select id from public.request_types where name = 'DM329-Integrazioni')
  );

drop policy if exists "Userdm329 can delete DM329-Integrazioni requests" on public.requests;

create policy "Userdm329 can delete DM329-Integrazioni requests"
  on public.requests
  for delete
  to authenticated
  using (
    exists (select 1 from public.users where id = auth.uid() and role = 'userdm329'::user_role)
    and request_type_id in (select id from public.request_types where name = 'DM329-Integrazioni')
  );

-- ---------------------------------------------------------------- request_history: INSERT

drop policy if exists "userdm329 can insert history for DM329-Integrazioni requests" on public.request_history;

create policy "userdm329 can insert history for DM329-Integrazioni requests"
  on public.request_history
  for insert
  to authenticated
  with check (
    public.get_user_role() = 'userdm329'::user_role
    and changed_by = auth.uid()
    and exists (
      select 1
      from public.requests r
      join public.request_types rt on rt.id = r.request_type_id
      where r.id = request_history.request_id
        and rt.name = 'DM329-Integrazioni'
    )
  );

-- ---------------------------------------------------------------- request_blocks: INSERT e UPDATE

drop policy if exists "userdm329 can block DM329-Integrazioni requests" on public.request_blocks;

create policy "userdm329 can block DM329-Integrazioni requests"
  on public.request_blocks
  for insert
  to authenticated
  with check (
    public.get_user_role() = 'userdm329'::user_role
    and blocked_by = auth.uid()
    and exists (
      select 1
      from public.requests r
      join public.request_types rt on rt.id = r.request_type_id
      where r.id = request_blocks.request_id
        and rt.name = 'DM329-Integrazioni'
    )
  );

drop policy if exists "userdm329 can unblock DM329-Integrazioni requests" on public.request_blocks;

create policy "userdm329 can unblock DM329-Integrazioni requests"
  on public.request_blocks
  for update
  to authenticated
  using (
    public.get_user_role() = 'userdm329'::user_role
    and is_active = true
    and exists (
      select 1
      from public.requests r
      join public.request_types rt on rt.id = r.request_type_id
      where r.id = request_blocks.request_id
        and rt.name = 'DM329-Integrazioni'
    )
  )
  with check (unblocked_by = auth.uid() and is_active = false);

-- Gemella di «userdm329 can resolve blocks on DM329 requests»: piu' stretta della precedente,
-- perche' richiede anche di essere chi ha creato la pratica o chi ha messo il blocco. Le due si
-- sommano in OR come sulle DM329, dove convivono da sempre.
drop policy if exists "userdm329 can resolve blocks on DM329-Integrazioni requests" on public.request_blocks;

create policy "userdm329 can resolve blocks on DM329-Integrazioni requests"
  on public.request_blocks
  for update
  to authenticated
  using (
    public.get_user_role() = 'userdm329'::user_role
    and is_active = true
    and exists (
      select 1
      from public.requests r
      join public.request_types rt on rt.id = r.request_type_id
      where r.id = request_blocks.request_id
        and rt.name = 'DM329-Integrazioni'
        and (r.created_by = auth.uid() or request_blocks.blocked_by = auth.uid())
    )
  )
  with check (unblocked_by = auth.uid() and is_active = false);
