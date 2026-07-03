# Notifiche: modello unico broadcast a iscritti

Data: 2026-07-03
Stato: approvato (design), in attesa di piano di implementazione

## Obiettivo

Sostituire l'attuale logica di notifica — frammentata e incoerente — con **un unico modello** valido per tutti i tipi di evento:

- notifiche di **cambio stato** (per singola transizione)
- notifica di **creazione richiesta**
- notifiche di **blocco** e **sblocco** pratica (flag `is_blocked`, non modificano lo stato)
- notifica di **pratica urgente** (flag `is_urgent`, non modifica lo stato)

## Principio unico (confermato con l'utente)

1. **Ogni evento ha un interruttore** nel pannello Impostazioni Notifiche, liberamente attivabile/disattivabile.
2. **Destinatari = chi ha attivato quell'interruttore** (modello *broadcast a iscritti*): un utente riceve la notifica di un evento **solo se** ha acceso il relativo toggle, e la riceve **per qualsiasi pratica del sistema**, non solo per le proprie.
3. **L'autore dell'azione è sempre escluso**: chi cambia stato / crea / blocca / sblocca / segna urgente non riceve la propria notifica.
4. **Canali `in_app` / `email`** = il "come": la notifica in-app viene creata se (toggle evento ON) AND (`in_app` ON); l'email inviata se (toggle evento ON) AND (`email` ON).

> **Evoluzione futura (fuori scope ora):** quando la gestione utenti sarà più granulare, si passerà da broadcast a destinatari legati alla singola pratica (creatore/assegnatario). Il design attuale isola la scelta dei destinatari in un'unica funzione (`notify_event_subscribers`), così il passaggio futuro toccherà solo quella.

## Decisioni di rilascio (confermate)

- **Reset preferenze esistenti a "eventi tutti spenti".** Alla migrazione: `status_transitions = '{}'` e i quattro nuovi flag booleani = `false` per tutte le righe esistenti. I canali `in_app`/`email` restano invariati (quindi attivare un toggle ha effetto immediato). Motivo: con il broadcast, "transizione attiva" significa ora "per ogni pratica"; si riparte puliti e ognuno riattiva ciò che vuole.
- **`request_created` parte spenta** (opt-in, come gli altri).
- **Eliminare il caso speciale SOSPESA.** I vecchi event_type `request_suspended` / `request_unsuspended` (legati allo stato `SOSPESA`, di fatto non usato — il blocco reale passa dal flag `is_blocked`) vengono rimossi. Qualsiasi cambio di stato è trattato come normale `status_change` con il suo toggle per-transizione.
- **Caveat broadcast accettato (opzione a):** il broadcast raggiunge *tutti* gli iscritti, incluso il ruolo `utente` semplice; un `utente` iscritto riceverebbe notifiche anche per pratiche non sue ma, cliccandole, non potrebbe aprirle (RLS su `requests`). Accettato: nessuna restrizione di ruolo sui toggle.

## Modello dati

### `user_notification_preferences` — modifica schema

Aggiungere quattro colonne booleane, tutte `DEFAULT false`:

| Colonna | Evento |
|---|---|
| `notify_request_created` | creazione nuova richiesta |
| `notify_request_blocked` | pratica bloccata |
| `notify_block_resolved` | pratica sbloccata |
| `notify_request_urgent` | pratica segnata urgente |

Le transizioni di stato continuano a usare la colonna esistente `status_transitions` (JSONB, chiavi `"FROM_TO" -> bool`). Colonne booleane per gli eventi singoli perché il broadcast le interroga direttamente.

Reset dati alla migrazione:
```sql
UPDATE user_notification_preferences
SET status_transitions = '{}'::jsonb,
    notify_request_created = false,
    notify_request_blocked = false,
    notify_block_resolved  = false,
    notify_request_urgent  = false;
```

### Event type in `notifications` (colonne `type` / `event_type`)

| event_type | quando |
|---|---|
| `request_created` | INSERT richiesta (OLD.status IS NULL) |
| `status_change` | qualsiasi cambio di stato successivo |
| `request_blocked` | `request_blocks` attivato |
| `block_resolved` | `request_blocks` risolto |
| `request_urgent` | `requests.is_urgent` false→true |

Rimossi: `request_suspended`, `request_unsuspended`.

## Logica database

### Chi è "l'autore" da escludere

| Evento | Attore escluso |
|---|---|
| request_created | `NEW.created_by` |
| status_change | `auth.uid()` (utente che esegue l'update), fallback `NEW.created_by` |
| request_blocked | `NEW.blocked_by` |
| block_resolved | `NEW.unblocked_by` |
| request_urgent | `auth.uid()` |

`auth.uid()` è leggibile anche in funzioni `SECURITY DEFINER` (claim JWT di sessione). Se null (es. azione via service role), l'esclusione semplicemente non si applica.

### `create_notification()` — esteso, resta il punto unico di recapito per-utente

Firma invariata: `(p_user_id, p_request_id, p_event_type, p_message, p_status_from, p_status_to, p_metadata)`.
Gating per-utente aggiornato:

- `request_created` → `notify_request_created` AND canale
- `status_change` → `status_transitions[from_to]` AND canale (logica esistente)
- `request_blocked` → `notify_request_blocked` AND canale
- `block_resolved` → `notify_block_resolved` AND canale
- `request_urgent` → `notify_request_urgent` AND canale
- rami `request_suspended` / `request_unsuspended` **rimossi**

Restano invariati: creazione preferenze default se mancanti, INSERT in-app, invio email via `net.http_post`.

### `notify_event_subscribers()` — nuova funzione broadcast (unico punto che sceglie i destinatari)

```
notify_event_subscribers(p_event_type, p_request_id, p_message, p_actor_id,
                         p_status_from default null, p_status_to default null,
                         p_metadata default '{}')
```
Seleziona gli iscritti all'evento (escluso l'attore) e delega il recapito a `create_notification`:
```sql
FOR v_uid IN
  SELECT user_id FROM user_notification_preferences p
  WHERE user_id IS DISTINCT FROM p_actor_id
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
```
`SECURITY DEFINER`. Con ~20 utenti il ciclo è trascurabile. È l'unico punto da cambiare per la futura logica "destinatari legati alla pratica".

### Trigger

- **`notify_request_status_change()`** — riscritto: rimuove lo special-casing SOSPESA e il ciclo su `get_notification_recipients`. Determina `event_type` = `request_created` se `OLD.status IS NULL`, altrimenti `status_change`; costruisce il messaggio come oggi; chiama `notify_event_subscribers(event_type, NEW.id, message, attore, OLD.status, NEW.status, metadata)`. Trigger `AFTER INSERT OR UPDATE OF status ON requests` invariato.
- **`notify_on_request_blocked()`** — chiama `notify_event_subscribers('request_blocked', NEW.request_id, <msg>, NEW.blocked_by)`. Condizione di attivazione invariata.
- **`notify_on_block_resolved()`** — chiama `notify_event_subscribers('block_resolved', NEW.request_id, <msg>, NEW.unblocked_by)`. Condizione invariata.
- **`notify_on_request_urgent()`** (nuovo) + trigger `AFTER UPDATE OF is_urgent ON requests`: attiva solo su `NEW.is_urgent AND NOT COALESCE(OLD.is_urgent,false)`; chiama `notify_event_subscribers('request_urgent', NEW.id, <msg>, auth.uid())`. Messaggio: `<prefisso pratica> - segnata come URGENTE`.
- **`get_notification_recipients()`** diventa obsoleta (non più chiamata); si può lasciare in sede senza effetti.
- Il flag `is_blocked` (`update_request_blocked_status`) e il workflow degli stati **non vengono toccati**.

## Email (nota di coerenza)

Esistono oggi due percorsi email: (a) DB, dentro `create_notification`; (b) frontend, `emailNotifications.ts` chiamato da `requests.ts`, con destinatari relazionali (creatore/assegnatario/admin). Con il nuovo modello il percorso (b) sarebbe **incoerente** (destinatari diversi dal broadcast) e potenzialmente **duplicato**. Decisione: l'email segue lo stesso modello broadcast tramite il percorso (a); i due invii email dal frontend (`notifyRequestCreated`, `notifyStatusChange` in `requests.ts`) vengono **rimossi**. Impatto basso: il canale email è `false` di default. Da confermare in fase di piano.

## Interfaccia utente — `src/pages/NotificationSettings.tsx`

- **Rimuovere** la sezione statica "Notifiche Automatiche" (nulla è più sempre-attivo).
- **Nuova sezione "Eventi pratica"** con quattro `Switch` reali (salvati come le preferenze generali, upsert esistente):
  - *Creazione nuova richiesta* → `notify_request_created`
  - *Pratica bloccata* → `notify_request_blocked`
  - *Pratica sbloccata* → `notify_block_resolved`
  - *Pratica urgente* → `notify_request_urgent`
- **Mantenere** invariati gli accordion dei toggle **per singola transizione** (Richieste Standard + DM329).
- Caricamento iniziale dei quattro nuovi valori nell'`useEffect` esistente.

### Tipi e API

- `src/types/index.ts` → `UserNotificationPreferences`: aggiungere i quattro booleani. `NotificationEventType`: `'request_created' | 'status_change' | 'request_blocked' | 'block_resolved' | 'request_urgent'` (rimossi suspended/unsuspended).
- `notificationsApi.upsertNotificationPreferences` accetta già `Partial<...>` → nessuna modifica. `getNotificationPreferences` fa `select('*')` → nuove colonne automatiche. `useNotificationPreferences.updatePreferences` riusabile.

## Migrazione e rollout

1. Migrazione SQL unica:
   - `ALTER TABLE ... ADD COLUMN` (×4, default false).
   - `UPDATE` di reset preferenze esistenti (transizioni + 4 flag a spento).
   - `CREATE OR REPLACE` di `create_notification`, `notify_event_subscribers`, `notify_request_status_change`, `notify_on_request_blocked`, `notify_on_block_resolved`.
   - `CREATE OR REPLACE FUNCTION notify_on_request_urgent` + `CREATE TRIGGER` su `requests`.
2. Applicare in produzione via Supabase Management API (token `sbp_`) **e** salvare il file in `supabase/migrations/` (allineamento repo, vista la storia di drift DB↔repo).
3. Frontend (tipi + UI + rimozione email duplicata) via commit + push → deploy Vercel.

## Verifica

- **DB (transazione + ROLLBACK)** simulando gli attori: (a) cambio stato di una pratica → ricevono solo gli utenti con quella transizione attiva, escluso l'autore; (b) creazione → solo iscritti a `request_created`, escluso il creatore; (c) blocco/sblocco → solo iscritti, escluso chi blocca/sblocca; (d) `is_urgent` false→true → solo iscritti, escluso l'attore; true→false → nessuna notifica.
- **UI**: attivare/disattivare i quattro toggle e verificare persistenza dopo reload; verificare che una transizione disattivata non generi notifiche.
- **Non regressione**: il flag `is_blocked` e gli stati restano invariati; nessun errore sul "segna tutte come lette" (fix già in produzione).

## Fuori scope

- Destinatari legati alla singola pratica (evoluzione futura).
- Notifica di rimozione urgenza (`is_urgent` true→false).
- Toggle unico "tutti i cambi stato" (si mantiene la granularità per-transizione).
- Restrizione dei toggle per ruolo.
