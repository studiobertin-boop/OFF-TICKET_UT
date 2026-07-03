# Notifiche — Modello unico broadcast a iscritti — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificare tutte le notifiche (creazione, cambio stato per-transizione, blocco, sblocco, urgente) in un unico modello broadcast a iscritti, configurabile toggle-per-toggle dal pannello notifiche, con esclusione dell'autore dell'azione.

**Architecture:** La scelta dei destinatari è centralizzata in un'unica funzione Postgres `notify_event_subscribers`, che seleziona gli utenti iscritti a un evento (escluso l'attore) e delega il recapito per-utente a `create_notification` (che applica canale in-app/email ed eventuale email). I trigger su `requests` e `request_blocks` chiamano solo il broadcast. Il frontend aggiunge quattro toggle booleani e rimuove il percorso email duplicato.

**Tech Stack:** Supabase Postgres (plpgsql, SECURITY DEFINER, trigger), Supabase Management API per applicare SQL in produzione, React 18 + TypeScript + MUI 6, TanStack Query.

## Global Constraints

- Progetto Supabase produzione: ref `uphftgpwisdiubuhohnc`. SQL applicato via Management API (`POST https://api.supabase.com/v1/projects/{ref}/database/query`, header `Authorization: Bearer $SUPABASE_ACCESS_TOKEN`, token `sbp_` in `.env.local`). Usare `curl --data-binary @file`, non urllib.
- Ogni funzione DB modificata è `SECURITY DEFINER` e nello schema `public`.
- La produzione è divergente dai file di migration del repo: verificare sempre lo stato live e salvare comunque il file di migration in `supabase/migrations/` per allineare il repo.
- Frontend: `strict=false`, ESLint con `--max-warnings 0` (un import inutilizzato fa fallire la build). Verifica con `npx tsc --noEmit` (ignorare errori preesistenti non correlati in `AddInstallerDialog.tsx`, `BillingReport.tsx`, `billingReports.ts`).
- Deploy frontend: push su `main` → Vercel rideploya la produzione automaticamente.
- Messaggi notifica in italiano, testo esistente preservato dove indicato.
- Il flag `is_blocked` (`update_request_blocked_status`) e il workflow degli stati NON vengono toccati.

---

### Task 1: Migration file — schema colonne + reset preferenze

**Files:**
- Create: `supabase/migrations/20260703100000_notifiche_broadcast.sql`

**Interfaces:**
- Produces: colonne `notify_request_created`, `notify_request_blocked`, `notify_block_resolved`, `notify_request_urgent` (boolean NOT NULL default false) su `user_notification_preferences`.

- [ ] **Step 1: Creare il file di migration con la sezione schema**

Creare `supabase/migrations/20260703100000_notifiche_broadcast.sql` con questo contenuto iniziale:

```sql
-- Notifiche: modello unico broadcast a iscritti
-- Spec: docs/superpowers/specs/2026-07-03-notifiche-eventi-pratica-design.md
BEGIN;

-- 1) Nuove colonne toggle (opt-in, default false)
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS notify_request_created boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_request_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_block_resolved  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_request_urgent  boolean NOT NULL DEFAULT false;

-- 2) Reset preferenze esistenti a "eventi tutti spenti" (canali in_app/email invariati)
UPDATE user_notification_preferences
SET status_transitions = '{}'::jsonb,
    notify_request_created = false,
    notify_request_blocked = false,
    notify_block_resolved  = false,
    notify_request_urgent  = false;

COMMIT;
```

Nota: il `COMMIT` qui è temporaneo per rendere la sezione auto-consistente durante l'authoring. Nel Task 4 l'intero file verrà racchiuso in un'unica transazione; questo `BEGIN;`/`COMMIT;` verranno spostati agli estremi del file quando si aggiungono le altre sezioni. Per ora lasciare così.

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260703100000_notifiche_broadcast.sql
git commit -m "feat(db): schema toggle notifiche broadcast + reset preferenze"
```

---

### Task 2: Migration file — `create_notification` esteso + `notify_event_subscribers`

**Files:**
- Modify: `supabase/migrations/20260703100000_notifiche_broadcast.sql`

**Interfaces:**
- Consumes: colonne toggle del Task 1.
- Produces:
  - `create_notification(p_user_id uuid, p_request_id uuid, p_event_type text, p_message text, p_status_from text, p_status_to text, p_metadata jsonb) → void` — recapito per-utente, gating su toggle+canale.
  - `notify_event_subscribers(p_event_type text, p_request_id uuid, p_message text, p_actor_id uuid, p_status_from text DEFAULT NULL, p_status_to text DEFAULT NULL, p_metadata jsonb DEFAULT '{}') → void` — broadcast agli iscritti, escluso l'attore.

- [ ] **Step 1: Rimuovere il `COMMIT;` finale temporaneo**

Nel file, cancellare la riga `COMMIT;` aggiunta nel Task 1 (resterà solo il `BEGIN;` in testa; il `COMMIT;` andrà in fondo al file nel Task 6). Aggiungere le sezioni seguenti in coda al file.

- [ ] **Step 2: Aggiungere `create_notification` esteso**

Appendere al file:

```sql
-- 3) create_notification: aggiunge i rami request_created/blocked/resolved/urgent,
--    rimuove request_suspended/request_unsuspended. Resta il punto unico di recapito.
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid, p_request_id uuid, p_event_type text, p_message text,
  p_status_from text DEFAULT NULL, p_status_to text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_preferences RECORD;
  v_should_notify_in_app BOOLEAN := false;
  v_should_notify_email BOOLEAN := false;
  v_user_email TEXT;
  v_user_name TEXT;
  v_request_data RECORD;
  v_email_payload JSONB;
  v_supabase_url TEXT;
  v_supabase_anon_key TEXT;
  v_transition_key TEXT;
  v_transition_enabled BOOLEAN;
BEGIN
  SELECT * INTO v_preferences FROM user_notification_preferences WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO user_notification_preferences (user_id, in_app, email, status_transitions)
    VALUES (p_user_id, true, false, '{}')
    RETURNING * INTO v_preferences;
  END IF;

  IF p_event_type = 'request_created' THEN
    v_should_notify_in_app := v_preferences.notify_request_created AND v_preferences.in_app;
    v_should_notify_email  := v_preferences.notify_request_created AND v_preferences.email;
  ELSIF p_event_type = 'request_blocked' THEN
    v_should_notify_in_app := v_preferences.notify_request_blocked AND v_preferences.in_app;
    v_should_notify_email  := v_preferences.notify_request_blocked AND v_preferences.email;
  ELSIF p_event_type = 'block_resolved' THEN
    v_should_notify_in_app := v_preferences.notify_block_resolved AND v_preferences.in_app;
    v_should_notify_email  := v_preferences.notify_block_resolved AND v_preferences.email;
  ELSIF p_event_type = 'request_urgent' THEN
    v_should_notify_in_app := v_preferences.notify_request_urgent AND v_preferences.in_app;
    v_should_notify_email  := v_preferences.notify_request_urgent AND v_preferences.email;
  ELSIF p_event_type = 'status_change' AND p_status_from IS NOT NULL AND p_status_to IS NOT NULL THEN
    v_transition_key := p_status_from || '_' || p_status_to;
    v_transition_enabled := COALESCE((v_preferences.status_transitions->>v_transition_key)::boolean, false);
    v_should_notify_in_app := v_transition_enabled AND v_preferences.in_app;
    v_should_notify_email  := v_transition_enabled AND v_preferences.email;
  ELSE
    RETURN;
  END IF;

  IF v_should_notify_in_app THEN
    INSERT INTO notifications (user_id, request_id, type, message, status_from, status_to, event_type, metadata, read)
    VALUES (p_user_id, p_request_id, p_event_type, p_message, p_status_from, p_status_to, p_event_type, p_metadata, false);
  END IF;

  IF v_should_notify_email THEN
    BEGIN
      SELECT COALESCE(u.email, au.email) AS email, COALESCE(u.full_name, au.email) AS full_name
      INTO v_user_email, v_user_name
      FROM auth.users au LEFT JOIN users u ON u.id = au.id WHERE au.id = p_user_id;

      SELECT r.title, r.status, rt.name AS request_type_name, c.ragione_sociale AS customer_name,
             u_assigned.full_name AS assigned_to_name,
             CASE WHEN rt.name LIKE '%DM329%' THEN true ELSE false END AS is_dm329
      INTO v_request_data
      FROM requests r
      LEFT JOIN request_types rt ON r.request_type_id = rt.id
      LEFT JOIN customers c ON r.customer_id = c.id
      LEFT JOIN users u_assigned ON r.assigned_to = u_assigned.id
      WHERE r.id = p_request_id;

      v_email_payload := jsonb_build_object(
        'to', v_user_email, 'user_name', v_user_name, 'event_type', p_event_type,
        'message', p_message, 'request_id', p_request_id,
        'metadata', jsonb_build_object(
          'request_title', v_request_data.title, 'request_type_name', v_request_data.request_type_name,
          'customer_name', v_request_data.customer_name, 'current_status', v_request_data.status,
          'assigned_to_name', v_request_data.assigned_to_name, 'is_dm329', v_request_data.is_dm329
        ) || p_metadata
      );

      v_supabase_url := current_setting('app.settings.supabase_url', true);
      v_supabase_anon_key := current_setting('app.settings.supabase_anon_key', true);
      IF v_supabase_url IS NOT NULL AND v_supabase_anon_key IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-notification-email',
          headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || v_supabase_anon_key),
          body := v_email_payload
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to send email notification to user %: %', p_user_id, SQLERRM;
    END;
  END IF;
END;
$function$;
```

- [ ] **Step 3: Aggiungere `notify_event_subscribers`**

Appendere al file:

```sql
-- 4) notify_event_subscribers: unico punto che sceglie i destinatari (broadcast a iscritti)
CREATE OR REPLACE FUNCTION public.notify_event_subscribers(
  p_event_type text, p_request_id uuid, p_message text, p_actor_id uuid,
  p_status_from text DEFAULT NULL, p_status_to text DEFAULT NULL, p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_uid uuid;
BEGIN
  FOR v_uid IN
    SELECT p.user_id FROM user_notification_preferences p
    WHERE p.user_id IS DISTINCT FROM p_actor_id
      AND CASE p_event_type
            WHEN 'request_created' THEN p.notify_request_created
            WHEN 'request_blocked' THEN p.notify_request_blocked
            WHEN 'block_resolved'  THEN p.notify_block_resolved
            WHEN 'request_urgent'  THEN p.notify_request_urgent
            WHEN 'status_change'   THEN COALESCE((p.status_transitions->>(p_status_from||'_'||p_status_to))::boolean, false)
            ELSE false
          END
  LOOP
    PERFORM create_notification(v_uid, p_request_id, p_event_type, p_message, p_status_from, p_status_to, p_metadata);
  END LOOP;
END;
$function$;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260703100000_notifiche_broadcast.sql
git commit -m "feat(db): create_notification esteso + broadcast notify_event_subscribers"
```

---

### Task 3: Migration file — trigger stato/blocco/sblocco riscritti + trigger urgente

**Files:**
- Modify: `supabase/migrations/20260703100000_notifiche_broadcast.sql`

**Interfaces:**
- Consumes: `notify_event_subscribers` (Task 2).
- Produces: trigger function riscritte (`notify_request_status_change`, `notify_on_request_blocked`, `notify_on_block_resolved`) + nuova `notify_on_request_urgent` con trigger `trigger_notify_request_urgent`.

- [ ] **Step 1: Aggiungere `notify_request_status_change` riscritto**

Appendere al file:

```sql
-- 5) notify_request_status_change: broadcast, niente piu' get_notification_recipients ne' SOSPESA
CREATE OR REPLACE FUNCTION public.notify_request_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_message TEXT;
  v_request_title TEXT;
  v_request_type_name TEXT;
  v_customer_name TEXT;
  v_event_type TEXT;
  v_is_dm329 BOOLEAN := false;
  v_actor UUID;
  v_prefix TEXT;
  v_action TEXT;
BEGIN
  SELECT r.title, rt.name, c.ragione_sociale,
         CASE WHEN rt.name LIKE '%DM329%' THEN true ELSE false END
  INTO v_request_title, v_request_type_name, v_customer_name, v_is_dm329
  FROM requests r
  LEFT JOIN request_types rt ON r.request_type_id = rt.id
  LEFT JOIN customers c ON r.customer_id = c.id
  WHERE r.id = NEW.id;

  IF v_customer_name IS NOT NULL THEN
    v_prefix := v_customer_name || ' - ' || v_request_type_name;
  ELSE
    v_prefix := v_request_type_name;
  END IF;

  IF OLD.status IS NULL THEN
    v_event_type := 'request_created';
    v_action := 'richiesta creata';
    v_actor := NEW.created_by;
  ELSIF NEW.status = 'ABORTITA' THEN
    v_event_type := 'status_change';
    v_action := 'richiesta abortita';
    v_actor := COALESCE(auth.uid(), NEW.created_by);
  ELSIF NEW.status = 'COMPLETATA' THEN
    v_event_type := 'status_change';
    v_action := 'richiesta completata';
    v_actor := COALESCE(auth.uid(), NEW.created_by);
  ELSE
    v_event_type := 'status_change';
    v_action := 'cambiata da ' || OLD.status || ' a ' || NEW.status;
    v_actor := COALESCE(auth.uid(), NEW.created_by);
  END IF;

  v_message := v_prefix || ' - ' || v_action;

  PERFORM notify_event_subscribers(
    v_event_type, NEW.id, v_message, v_actor, OLD.status, NEW.status,
    jsonb_build_object('request_title', v_request_title, 'request_type_name', v_request_type_name,
                       'customer_name', v_customer_name, 'is_dm329', v_is_dm329)
  );
  RETURN NEW;
END;
$function$;
```

- [ ] **Step 2: Aggiungere `notify_on_request_blocked` e `notify_on_block_resolved` riscritti**

Appendere al file:

```sql
-- 6) Blocco/sblocco: broadcast invece di INSERT diretto (messaggi invariati)
CREATE OR REPLACE FUNCTION public.notify_on_request_blocked()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_request requests;
  v_blocked_by_user users;
  v_message TEXT;
BEGIN
  IF NEW.is_active = true AND (TG_OP = 'INSERT' OR OLD.is_active = false) THEN
    SELECT * INTO v_request FROM requests WHERE id = NEW.request_id;
    SELECT * INTO v_blocked_by_user FROM users WHERE id = NEW.blocked_by;
    v_message := 'La richiesta "' || v_request.title || '" è stata bloccata da ' ||
                 COALESCE(v_blocked_by_user.full_name, v_blocked_by_user.email) || ': ' || NEW.reason;
    PERFORM notify_event_subscribers('request_blocked', NEW.request_id, v_message, NEW.blocked_by);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_block_resolved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_request requests;
  v_unblocked_by_user users;
  v_message TEXT;
BEGIN
  IF OLD.is_active = true AND NEW.is_active = false AND NEW.unblocked_by IS NOT NULL THEN
    SELECT * INTO v_request FROM requests WHERE id = NEW.request_id;
    SELECT * INTO v_unblocked_by_user FROM users WHERE id = NEW.unblocked_by;
    v_message := 'Il blocco sulla richiesta "' || v_request.title || '" è stato risolto da ' ||
                 COALESCE(v_unblocked_by_user.full_name, v_unblocked_by_user.email) ||
                 CASE WHEN NEW.resolution_notes IS NOT NULL AND NEW.resolution_notes != ''
                      THEN ': ' || NEW.resolution_notes ELSE '' END;
    PERFORM notify_event_subscribers('block_resolved', NEW.request_id, v_message, NEW.unblocked_by);
  END IF;
  RETURN NEW;
END;
$function$;
```

- [ ] **Step 3: Aggiungere `notify_on_request_urgent` + trigger, e chiudere la transazione**

Appendere al file (il `COMMIT;` finale chiude il `BEGIN;` in testa):

```sql
-- 7) Urgente: nuovo trigger su is_urgent false->true
CREATE OR REPLACE FUNCTION public.notify_on_request_urgent()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_message TEXT;
BEGIN
  IF NEW.is_urgent = true AND COALESCE(OLD.is_urgent, false) = false THEN
    v_message := 'La richiesta "' || NEW.title || '" è stata segnata come URGENTE';
    PERFORM notify_event_subscribers('request_urgent', NEW.id, v_message, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_notify_request_urgent ON requests;
CREATE TRIGGER trigger_notify_request_urgent
  AFTER UPDATE OF is_urgent ON requests
  FOR EACH ROW EXECUTE FUNCTION notify_on_request_urgent();

COMMIT;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260703100000_notifiche_broadcast.sql
git commit -m "feat(db): trigger stato/blocco/sblocco su broadcast + trigger urgente"
```

---

### Task 4: Applicare la migration in produzione e verificarla

**Files:**
- Usa: `supabase/migrations/20260703100000_notifiche_broadcast.sql`, token in `.env.local`.

**Interfaces:**
- Consumes: l'intero file di migration.

- [ ] **Step 1: Applicare la migration via Management API**

Dalla root del repo, in Git Bash:

```bash
TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' .env.local | cut -d= -f2- | tr -d '\r\n')
REF=uphftgpwisdiubuhohnc
python -c "import json; print(json.dumps({'query': open('supabase/migrations/20260703100000_notifiche_broadcast.sql', encoding='utf-8').read()}))" > /tmp/mig.json
curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/mig.json
```

Expected: risposta `[]` (nessuna riga) o HTTP 201. Se compare un errore SQL, correggerlo nel file e riapplicare (le `CREATE OR REPLACE` / `ADD COLUMN IF NOT EXISTS` sono idempotenti).

- [ ] **Step 2: Verificare colonne e trigger presenti**

```bash
run_sql() { python -c "import json,sys; print(json.dumps({'query': sys.argv[1]}))" "$1" > /tmp/q.json && curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary @/tmp/q.json; }
run_sql "select column_name from information_schema.columns where table_name='user_notification_preferences' and column_name like 'notify_%' order by column_name;"
run_sql "select tgname from pg_trigger where tgname='trigger_notify_request_urgent';"
run_sql "select count(*) as non_azzerate from user_notification_preferences where status_transitions <> '{}'::jsonb or notify_request_created or notify_request_blocked or notify_block_resolved or notify_request_urgent;"
```

Expected: 4 colonne `notify_block_resolved, notify_request_blocked, notify_request_created, notify_request_urgent`; trigger `trigger_notify_request_urgent` presente; `non_azzerate = 0`.

- [ ] **Step 3: Test integrazione URGENTE (transazione + ROLLBACK)**

Sceglie due utenti reali e una pratica; abilita il toggle urgente solo per il primo; simula `is_urgent` false→true; verifica che solo l'iscritto riceva.

```bash
run_sql "begin;
  create temporary table _u on commit drop as
    select id, row_number() over (order by id) rn from users limit 2;
  update user_notification_preferences set notify_request_urgent = true
    where user_id = (select id from _u where rn=1);
  update user_notification_preferences set notify_request_urgent = false
    where user_id = (select id from _u where rn=2);
  update requests set is_urgent = false where id = (select id from requests limit 1);
  update requests set is_urgent = true  where id = (select id from requests limit 1);
  select
    (select count(*) from notifications n where n.event_type='request_urgent'
       and n.user_id=(select id from _u where rn=1)) as iscritto_riceve,
    (select count(*) from notifications n where n.event_type='request_urgent'
       and n.user_id=(select id from _u where rn=2)) as non_iscritto;
rollback;"
```

Expected: `iscritto_riceve >= 1`, `non_iscritto = 0`.

- [ ] **Step 4: Test integrazione CAMBIO STATO broadcast (transazione + ROLLBACK)**

```bash
run_sql "begin;
  create temporary table _u on commit drop as
    select id, row_number() over (order by id) rn from users limit 2;
  -- iscrivi utente 1 alla transizione della pratica scelta
  with r as (select id, status from requests where status is not null limit 1)
  update user_notification_preferences p
    set status_transitions = jsonb_build_object((select status from r) || '_' || 'COMPLETATA', true)
    where p.user_id = (select id from _u where rn=1);
  update requests set status = 'COMPLETATA' where id = (select id from requests where status is not null limit 1);
  select
    (select count(*) from notifications n where n.event_type='status_change'
       and n.status_to='COMPLETATA' and n.user_id=(select id from _u where rn=1)) as iscritto_riceve,
    (select count(*) from notifications n where n.event_type='status_change'
       and n.status_to='COMPLETATA' and n.user_id=(select id from _u where rn=2)) as non_iscritto;
rollback;"
```

Expected: `iscritto_riceve >= 1`, `non_iscritto = 0`. (Se la pratica scelta era già `COMPLETATA` il test è nullo: ripetere scegliendo una pratica con stato diverso.)

- [ ] **Step 5: Nessun commit** (nessun file cambiato in questo task).

---

### Task 5: Frontend — tipi

**Files:**
- Modify: `src/types/index.ts:179-184` (NotificationEventType), `src/types/index.ts:201-209` (UserNotificationPreferences)

**Interfaces:**
- Produces: campi `notify_request_created`, `notify_request_blocked`, `notify_block_resolved`, `notify_request_urgent: boolean` su `UserNotificationPreferences`; union `NotificationEventType` aggiornata.

- [ ] **Step 1: Aggiornare `NotificationEventType`**

Sostituire (`src/types/index.ts:179-184`):

```ts
export type NotificationEventType =
  | 'request_created'
  | 'request_suspended'
  | 'request_unsuspended'
  | 'request_blocked'
  | 'status_change'
```

con:

```ts
export type NotificationEventType =
  | 'request_created'
  | 'status_change'
  | 'request_blocked'
  | 'block_resolved'
  | 'request_urgent'
```

- [ ] **Step 2: Aggiungere i campi a `UserNotificationPreferences`**

Sostituire (`src/types/index.ts:201-209`):

```ts
export interface UserNotificationPreferences {
  id: string
  user_id: string
  in_app: boolean
  email: boolean
  status_transitions: Record<string, boolean> // "STATUS_FROM_STATUS_TO": boolean
  created_at: string
  updated_at: string
}
```

con:

```ts
export interface UserNotificationPreferences {
  id: string
  user_id: string
  in_app: boolean
  email: boolean
  status_transitions: Record<string, boolean> // "STATUS_FROM_STATUS_TO": boolean
  notify_request_created: boolean
  notify_request_blocked: boolean
  notify_block_resolved: boolean
  notify_request_urgent: boolean
  created_at: string
  updated_at: string
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "types/index|NotificationSettings|notifications"`
Expected: nessun output (nessun errore nei file toccati).

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): campi toggle notifiche + union event type aggiornata"
```

---

### Task 6: Frontend — quattro toggle nel pannello notifiche

**Files:**
- Modify: `src/pages/NotificationSettings.tsx`

**Interfaces:**
- Consumes: `UserNotificationPreferences` (Task 5), `useNotificationPreferences().updatePreferences` (già esistente, firma `updatePreferences(partial: Partial<UserNotificationPreferences>, options?: { onSuccess?, onError? })`).

- [ ] **Step 1: Aggiungere stato locale e caricamento**

In `src/pages/NotificationSettings.tsx`, dopo lo stato `statusTransitions` (riga ~64) aggiungere:

```tsx
  const [eventPrefs, setEventPrefs] = useState({
    notify_request_created: false,
    notify_request_blocked: false,
    notify_block_resolved: false,
    notify_request_urgent: false,
  })
```

Nell'`useEffect` di caricamento (righe ~70-76), dentro `if (preferences) { ... }`, aggiungere:

```tsx
      setEventPrefs({
        notify_request_created: preferences.notify_request_created ?? false,
        notify_request_blocked: preferences.notify_request_blocked ?? false,
        notify_block_resolved: preferences.notify_block_resolved ?? false,
        notify_request_urgent: preferences.notify_request_urgent ?? false,
      })
```

- [ ] **Step 2: Aggiungere l'handler di toggle (salvataggio immediato, ottimistico)**

Dopo `handleToggleTransition` (riga ~105) aggiungere:

```tsx
  const handleToggleEvent = (
    field:
      | 'notify_request_created'
      | 'notify_request_blocked'
      | 'notify_block_resolved'
      | 'notify_request_urgent',
    enabled: boolean
  ) => {
    setEventPrefs((prev) => ({ ...prev, [field]: enabled }))
    updatePreferences(
      { [field]: enabled },
      {
        onError: (error: unknown) => {
          console.error('Errore salvataggio preferenza evento:', error)
          setEventPrefs((prev) => ({ ...prev, [field]: !enabled }))
        },
      }
    )
  }
```

- [ ] **Step 3: Sostituire la sezione statica "Notifiche Automatiche" con i toggle reali**

Sostituire l'intero blocco `<Paper>` "Notifiche Automatiche" (righe ~255-268, dal `<Paper sx={{ p: 3, mb: 3 }}>` che contiene `Notifiche Automatiche` fino al suo `</Paper>`) con:

```tsx
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Eventi pratica
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Ricevi una notifica quando accade uno di questi eventi su una qualsiasi pratica
          (non ricevi la notifica per le azioni che compi tu).
        </Typography>

        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={eventPrefs.notify_request_created}
                onChange={(e) => handleToggleEvent('notify_request_created', e.target.checked)}
                disabled={isUpdating}
              />
            }
            label="Creazione nuova richiesta"
          />
          <FormControlLabel
            control={
              <Switch
                checked={eventPrefs.notify_request_blocked}
                onChange={(e) => handleToggleEvent('notify_request_blocked', e.target.checked)}
                disabled={isUpdating}
              />
            }
            label="Pratica bloccata"
          />
          <FormControlLabel
            control={
              <Switch
                checked={eventPrefs.notify_block_resolved}
                onChange={(e) => handleToggleEvent('notify_block_resolved', e.target.checked)}
                disabled={isUpdating}
              />
            }
            label="Pratica sbloccata"
          />
          <FormControlLabel
            control={
              <Switch
                checked={eventPrefs.notify_request_urgent}
                onChange={(e) => handleToggleEvent('notify_request_urgent', e.target.checked)}
                disabled={isUpdating}
              />
            }
            label="Pratica urgente"
          />
        </FormGroup>
      </Paper>
```

Nota: `Chip` non è più usato in questo file — rimuovere `Chip` dall'import MUI (riga ~15) per non far fallire il lint (`--max-warnings 0`).

- [ ] **Step 4: Typecheck + lint del file**

Run: `npx tsc --noEmit 2>&1 | grep NotificationSettings`
Expected: nessun output.
Run: `npx eslint src/pages/NotificationSettings.tsx`
Expected: nessun errore/warning.

- [ ] **Step 5: Commit**

```bash
git add src/pages/NotificationSettings.tsx
git commit -m "feat(ui): toggle Eventi pratica (creazione, blocco, sblocco, urgente)"
```

---

### Task 7: Frontend — rimuovere il percorso email duplicato

**Files:**
- Modify: `src/services/api/requests.ts:3` (import), `:139-160` (blocco email creazione), `:212-217` (email cambio stato)

**Interfaces:**
- Rimuove: uso di `emailNotificationsApi` in `requests.ts`. L'invio email resta gestito lato DB da `create_notification`.

- [ ] **Step 1: Rimuovere l'import**

Cancellare la riga `src/services/api/requests.ts:3`:

```ts
import { emailNotificationsApi } from './emailNotifications'
```

- [ ] **Step 2: Rimuovere il blocco email nella creazione**

Sostituire le righe ~139-162 (dal commento `// CRITICAL DEBUG: Log BEFORE email notification call` fino a subito prima di `return data`) con:

```tsx
    return data
  },
```

Cioè: eliminare i `console.log` di debug, il blocco `try { ... emailNotificationsApi.notifyRequestCreated ... }`, e lasciare solo il `return data` che chiude la funzione `create`.

- [ ] **Step 3: Rimuovere l'email nel cambio stato**

Sostituire le righe ~212-217:

```tsx
    // Invia notifiche email se lo stato è cambiato
    if (updates.status && oldStatus && oldStatus !== updates.status) {
      emailNotificationsApi.notifyStatusChange(id, oldStatus, updates.status).catch((err) => {
        console.error('Failed to send email notifications for status change:', err)
      })
    }

    return data
```

con:

```tsx
    return data
```

Se dopo la rimozione la variabile `oldStatus` (righe ~174-183) non è più usata altrove nella funzione `update`, rimuovere anche il blocco che la calcola per evitare warning di lint. Verificare con lint (Step 4); se `oldStatus` risulta inutilizzata, cancellare le righe che la dichiarano e la popolano.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit 2>&1 | grep requests`
Expected: nessun output.
Run: `npx eslint src/services/api/requests.ts`
Expected: nessun errore/warning (nessun import/variabile inutilizzata).

- [ ] **Step 5: Commit**

```bash
git add src/services/api/requests.ts
git commit -m "refactor(email): rimuovi invio email frontend, email ora solo via broadcast DB"
```

---

### Task 8: Deploy e verifica end-to-end

**Files:** nessuna modifica; push e verifica.

- [ ] **Step 1: Build check completa**

Run: `npx tsc --noEmit 2>&1 | grep -vE "AddInstallerDialog|BillingReport|billingReports"`
Expected: nessun output (solo gli errori preesistenti non correlati restano, e sono filtrati).

- [ ] **Step 2: Push (deploy Vercel)**

```bash
git push origin main
```

Expected: push accettato su `main`; Vercel avvia il deploy di produzione.

- [ ] **Step 3: Verifica manuale (dopo il deploy, refresh forzato Ctrl+Shift+R)**

1. Aprire Impostazioni Notifiche → sezione "Eventi pratica": i 4 toggle sono spenti (reset). Attivare "Pratica urgente", ricaricare la pagina: resta attivo.
2. Con un secondo utente, segnare urgente una pratica: il primo utente (iscritto) riceve la notifica nella campanella; l'autore no.
3. Verificare che "Segna tutte come lette" continui a funzionare (nessuna regressione).

- [ ] **Step 4: Aggiornare la memoria del drift DB**

Aggiungere alla nota `[[supabase-db-repo-drift]]` che la migration `20260703100000_notifiche_broadcast.sql` è stata applicata in produzione via Management API ed è allineata al repo.

---

## Self-Review

**Spec coverage:**
- Principio broadcast + esclusione autore → Task 2 (`notify_event_subscribers`), Task 3 (attori nei trigger). ✓
- Toggle per ogni evento + creazione disattivabile → Task 1 (colonne), Task 6 (UI). ✓
- Toggle per-transizione mantenuti → Task 6 non li tocca (restano gli accordion). ✓
- Reset preferenze a spento → Task 1 Step 1. ✓
- Rimozione caso SOSPESA → Task 2 (`create_notification` senza rami suspended), Task 3 (`notify_request_status_change` senza SOSPESA). ✓
- Urgente solo attivazione → Task 3 (`NEW.is_urgent AND NOT COALESCE(OLD.is_urgent,false)`). ✓
- Email broadcast + rimozione duplicato frontend → `create_notification` invariato lato email (Task 2) + Task 7. ✓
- Canali in_app/email come "come" → gating `AND v_preferences.in_app/email` in ogni ramo (Task 2). ✓
- Caveat broadcast a tutti i ruoli → nessuna restrizione di ruolo nei toggle né nel broadcast. ✓
- Migration applicata via Management API + file nel repo → Task 4 + Task 1-3. ✓

**Placeholder scan:** nessun TBD/TODO; ogni step di codice contiene codice completo. ✓

**Type consistency:** `notify_event_subscribers`/`create_notification` firme identiche tra Task 2 e le chiamate nei Task 3; nomi colonne `notify_request_created/blocked/block_resolved/request_urgent` identici tra Task 1, Task 2, Task 5, Task 6. Campo `notify_block_resolved` (non `notify_request_resolved`) usato ovunque. ✓
