# Notifiche eventi pratica — blocco, sblocco, urgente (modello broadcast a iscritti)

Data: 2026-07-03
Stato: approvato (design), in attesa di piano di implementazione

## Contesto e problema

Il sistema di notifiche ha oggi due percorsi paralleli che scrivono nella tabella `notifications`:

1. **Percorso che rispetta le preferenze** — la funzione Postgres `create_notification()`, chiamata dal trigger `notify_request_status_change()` su `requests`. Gestisce gli event_type `request_created`, `request_suspended`, `request_unsuspended`, `status_change` e consulta `user_notification_preferences`.
2. **Percorsi che bypassano le preferenze** — i trigger `notify_on_request_blocked()` e `notify_on_block_resolved()` sulla tabella `request_blocks`, che fanno `INSERT INTO notifications` diretto **senza** alcun controllo delle preferenze.

Conseguenza: le notifiche di **blocco** e **sblocco** arrivano sempre (al creatore della pratica e al tecnico assegnato), anche se l'utente ha disattivato tutto, e non esiste alcun interruttore nell'interfaccia per spegnerle.

Inoltre esiste il flag `requests.is_urgent` (boolean, default false), attivabile dal pulsante "SEGNA URGENTE" in `RequestDetail.tsx`, ma **non genera alcuna notifica** oggi.

## Obiettivo

1. Far sì che le notifiche di **blocco** e **sblocco** rispettino le preferenze utente (fine del bypass).
2. Aggiungere una nuova notifica **"pratica urgente"** quando `is_urgent` passa da false a true.
3. Rendere tutte e tre configurabili (on/off) dall'interfaccia Impostazioni Notifiche.

## Decisioni di design (confermate con l'utente)

- **Modello destinatari: broadcast a iscritti.** Per tutti e tre gli eventi, la notifica va a **tutti gli utenti che hanno attivato quel toggle** nelle impostazioni, **per qualsiasi pratica**, **escluso chi ha compiuto l'azione**. Questo sostituisce, per blocco/sblocco, il precedente modello legato a creatore + tecnico assegnato.
- **Default: opt-in.** I tre nuovi toggle sono `false` di default: nessuno riceve nulla finché non li attiva. Nessun impatto sugli utenti esistenti.
- **Urgente: solo attivazione.** Notifica solo su `is_urgent` false→true. Nessuna notifica quando l'urgenza viene rimossa.
- **Canali in-app/email confermati.** Il toggle dell'evento decide *se* notificare; i canali `in_app`/`email` decidono *come*. Una notifica in-app viene creata se (toggle evento ON) AND (`in_app` ON); l'email viene inviata se (toggle evento ON) AND (`email` ON). Coerente con la logica esistente di `status_change`.
- **Caveat accettato (opzione a):** il broadcast va a *tutti* gli utenti iscritti, incluso il ruolo `utente` semplice. Un `utente` che attivasse un toggle riceverebbe notifiche anche per pratiche non sue, ma cliccandole non potrebbe aprire la pratica (bloccato da RLS su `requests`). Accettato: in pratica questi toggle hanno senso per admin/tecnici. Nessuna restrizione di ruolo sui toggle.

## Modello dati

### Modifica schema: `user_notification_preferences`

Aggiungere tre colonne booleane, tutte `DEFAULT false`:

| Colonna | Evento | Default |
|---|---|---|
| `notify_request_blocked` | pratica bloccata | `false` |
| `notify_block_resolved` | pratica sbloccata | `false` |
| `notify_request_urgent` | pratica segnata urgente | `false` |

Scelta di colonne booleane (non JSONB) perché il broadcast le interroga direttamente e indicizzabilmente:
`SELECT user_id FROM user_notification_preferences WHERE notify_request_urgent AND in_app`.

### Valori `event_type` / `type` in `notifications`

| event_type | type | note |
|---|---|---|
| `request_blocked` | `request_blocked` | già usato oggi dai trigger legacy |
| `block_resolved` | `block_resolved` | già usato oggi dai trigger legacy |
| `request_urgent` | `request_urgent` | nuovo |

Nota: per coerenza le nuove notifiche popoleranno correttamente sia `type` sia `event_type` (i trigger legacy attuali lasciavano `event_type` al default `status_change`).

## Logica database

### `create_notification()` — esteso

Aggiungere tre rami per i nuovi event_type. Non hanno transizione di stato (`status_from`/`status_to` nulli), quindi il gating è: colonna booleana dell'evento AND canale.

```
ELSIF p_event_type = 'request_blocked' THEN
  v_should_notify_in_app := v_preferences.notify_request_blocked AND v_preferences.in_app;
  v_should_notify_email  := v_preferences.notify_request_blocked AND v_preferences.email;
ELSIF p_event_type = 'block_resolved' THEN
  v_should_notify_in_app := v_preferences.notify_block_resolved AND v_preferences.in_app;
  v_should_notify_email  := v_preferences.notify_block_resolved AND v_preferences.email;
ELSIF p_event_type = 'request_urgent' THEN
  v_should_notify_in_app := v_preferences.notify_request_urgent AND v_preferences.in_app;
  v_should_notify_email  := v_preferences.notify_request_urgent AND v_preferences.email;
```

Il resto della funzione (INSERT in-app + invio email via `net.http_post`) resta invariato e viene riusato.

### Nuova funzione broadcast: `notify_event_subscribers()`

```
notify_event_subscribers(p_event_type text, p_request_id uuid, p_message text, p_actor_id uuid)
```

Cicla sugli utenti iscritti all'evento (colonna booleana relativa = true), esclude l'attore, e chiama `create_notification` per ciascuno. `create_notification` applica poi il gating per-utente (canale) e l'eventuale email.

```
FOR v_uid IN
  SELECT user_id FROM user_notification_preferences
  WHERE user_id <> p_actor_id
    AND CASE p_event_type
          WHEN 'request_blocked' THEN notify_request_blocked
          WHEN 'block_resolved'  THEN notify_block_resolved
          WHEN 'request_urgent'  THEN notify_request_urgent
          ELSE false
        END
LOOP
  PERFORM create_notification(v_uid, p_request_id, p_event_type, p_message, NULL, NULL, '{}'::jsonb);
END LOOP;
```

Con 20 utenti il ciclo è trascurabile. `SECURITY DEFINER`.

### Trigger riscritti

- **`notify_on_request_blocked()`**: invece dell'INSERT diretto (creatore + tecnico), chiama
  `notify_event_subscribers('request_blocked', NEW.request_id, <messaggio>, NEW.blocked_by)`.
  Condizione di attivazione invariata: `NEW.is_active = true AND (TG_OP='INSERT' OR OLD.is_active=false)`.
- **`notify_on_block_resolved()`**: chiama
  `notify_event_subscribers('block_resolved', NEW.request_id, <messaggio>, NEW.unblocked_by)`.
  Condizione invariata: `OLD.is_active=true AND NEW.is_active=false AND NEW.unblocked_by IS NOT NULL`.
- Il messaggio testuale (titolo pratica + autore + motivo/note) resta come oggi.
- Il flag `is_blocked` (trigger `update_request_blocked_status`) e il workflow degli stati **non vengono toccati**.

### Nuovo trigger urgente

- Funzione `notify_on_request_urgent()` + trigger `AFTER UPDATE OF is_urgent ON requests`.
- Attiva solo su `NEW.is_urgent = true AND COALESCE(OLD.is_urgent, false) = false`.
- Attore = `auth.uid()` (disponibile anche in SECURITY DEFINER, letto dai claim JWT di sessione).
- Chiama `notify_event_subscribers('request_urgent', NEW.id, <messaggio>, auth.uid())`.
- Messaggio: `La richiesta "<titolo>" è stata segnata come URGENTE`.

## Interfaccia utente

### `src/pages/NotificationSettings.tsx`

- Dalla sezione statica "Notifiche Automatiche" rimuovere i chip non cliccabili di blocco/sblocco (`Blocco richieste`, `Sblocco richieste`). Mantenere il chip "Creazione nuove richieste" (comportamento invariato, sempre attivo se canale on).
- Aggiungere una sezione **"Notifiche eventi pratica"** con tre `Switch` reali:
  - *Pratica bloccata* → `notify_request_blocked`
  - *Pratica sbloccata* → `notify_block_resolved`
  - *Pratica urgente* → `notify_request_urgent`
- Salvataggio come le preferenze generali: `updatePreferences({ notify_request_blocked, notify_block_resolved, notify_request_urgent })` (upsert esistente).
- Caricamento iniziale dei valori da `preferences` nell'`useEffect` esistente.

### `src/types/index.ts`

- `UserNotificationPreferences`: aggiungere `notify_request_blocked?: boolean`, `notify_block_resolved?: boolean`, `notify_request_urgent?: boolean`.
- `NotificationEventType`: aggiungere `'block_resolved'` e `'request_urgent'` (oltre agli esistenti, incluso `'request_blocked'` già presente).

### Livello API / hook

- `notificationsApi.upsertNotificationPreferences` accetta già `Partial<UserNotificationPreferences>` → supporta i nuovi campi senza modifiche.
- `getNotificationPreferences` fa `select('*')` → restituisce le nuove colonne automaticamente.
- `useNotificationPreferences` espone già `updatePreferences` → riusabile.

## Migrazione e rollout

1. Migrazione additiva SQL:
   - `ALTER TABLE user_notification_preferences ADD COLUMN ... DEFAULT false` (×3).
   - `CREATE OR REPLACE FUNCTION create_notification(...)` con i tre rami nuovi.
   - `CREATE OR REPLACE FUNCTION notify_event_subscribers(...)`.
   - `CREATE OR REPLACE FUNCTION notify_on_request_blocked(...)` e `notify_on_block_resolved(...)` (corpo aggiornato).
   - `CREATE OR REPLACE FUNCTION notify_on_request_urgent(...)` + `CREATE TRIGGER` su `requests`.
2. Applicazione in produzione via Supabase Management API (token `sbp_`), **e** salvataggio del file in `supabase/migrations/` per allineare il repo (vista la storia di drift DB↔repo).
3. Modifiche frontend (tipi, UI) via commit + push → deploy Vercel.
4. Nessuna migrazione dati: le colonne default `false` implicano zero notifiche finché gli utenti non attivano i toggle.

## Verifica

- **DB**: dopo l'applicazione, test in transazione con `ROLLBACK` simulando: (a) blocco pratica con un utente iscritto e uno non iscritto → solo l'iscritto (≠ attore) riceve; (b) attore escluso; (c) urgente false→true genera notifica, true→false no.
- **UI**: attivare i tre toggle, ricaricare la pagina e verificare che lo stato persista; verificare che disattivandoli non arrivino più notifiche per i nuovi eventi.
- **Non regressione**: `request_created` e `status_change` continuano a funzionare come prima; il flag `is_blocked` e gli stati restano invariati.

## Fuori scope

- Toggle per-transizione o per-tipo-pratica per i tre nuovi eventi (usano un singolo interruttore ciascuno).
- Notifica di rimozione urgenza (true→false).
- Restrizione dei toggle per ruolo (caveat accettato: broadcast a tutti).
- Modifiche al comportamento di `request_created` / `request_suspended` / `request_unsuspended`.
