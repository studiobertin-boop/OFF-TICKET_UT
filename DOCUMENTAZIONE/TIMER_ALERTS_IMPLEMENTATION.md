# Implementazione Timer Alerts per Pratiche DM329

## Panoramica
Sistema di avvisi automatici per pratiche DM329 che rimangono in determinati stati oltre una soglia temporale definita.

## Stati Monitorati e Soglie

| Stato | Soglia (giorni) | Descrizione |
|-------|----------------|-------------|
| 1-INCARICO_RICEVUTO | 30 | Pratica appena ricevuta |
| 3-MAIL_CLIENTE_INVIATA | 15 | Email inviata al cliente |
| 4-DOCUMENTI_PRONTI | 15 | Documentazione completa |
| 5-ATTESA_FIRMA | 10 | In attesa di firma cliente |
| 6-PRONTA_PER_CIVA | 7 | Pronta per invio CIVA |

## Funzionalità Implementate

### 1. Database
**File:** `supabase/migrations/20251111000001_add_dm329_timer_alerts.sql`

- **Campo `has_timer_alert`**: Flag booleano sulla tabella `requests`
- **Function `calculate_dm329_timer_alerts()`**: Calcola e aggiorna i timer alerts
  - Identifica pratiche DM329 negli stati monitorati
  - Calcola giorni trascorsi dall'ultima transizione (usando `request_history`)
  - Imposta `has_timer_alert = true` se soglia superata
- **Trigger `trigger_update_timer_alert`**: Reset automatico del flag al cambio stato
- **Indice**: `idx_requests_timer_alert` per query ottimizzate

### 2. Tipi TypeScript
**File:** `src/types/index.ts`

```typescript
export interface Request {
  // ... altri campi
  has_timer_alert?: boolean  // Flag timer scaduto
}
```

### 3. Utility Timer
**File:** `src/utils/timerUtils.ts`

**Costanti:**
- `DM329_TIMER_THRESHOLDS`: Mappa stato → soglia giorni
- `MONITORED_STATES`: Array stati monitorati

**Funzioni:**
- `calculateTimerStatus()`: Calcolo client-side stato timer
- `getStatusStartedAt()`: Trova timestamp ingresso nello stato
- `formatTimerAlertMessage()`: Formatta messaggio tooltip
- `canViewTimerAlerts()`: Check permessi visualizzazione

### 4. Componente UI
**File:** `src/components/requests/TimerAlertIndicator.tsx`

Indicatore visuale con:
- **Icona**: `AccessTimeIcon` (orologio) rosso
- **Colore**: `error.main` (rosso tema Material UI)
- **Tooltip**: Messaggio personalizzato con giorni di ritardo

### 5. Tabella DM329
**File:** `src/components/requests/DM329TableView.tsx`

**Modifiche:**
1. **Import**: Aggiunto `TimerAlertIndicator`
2. **Ordinamento** (righe 150-168):
   ```typescript
   // Priorità 1: Pratiche bloccate
   // Priorità 2: Timer alerts (solo non-bloccate)
   // Priorità 3: All'interno di ogni gruppo, più vecchie prima
   ```
3. **Rendering icona** (riga 544-547):
   - Colonna con `display: flex` per mostrare entrambe le icone
   - Blocco (triangolo giallo) + Timer (orologio rosso)
4. **Evidenziazione** (righe 519-537):
   - Bloccate: `backgroundColor: 'warning.lighter'` (giallo)
   - Timer alert: `backgroundColor: 'error.lighter'` (rosso chiaro)

## Ordinamento Lista Pratiche

```
┌─────────────────────────────────────┐
│ 1. PRATICHE BLOCCATE               │
│    (triangolo giallo)               │
│    ├─ Più vecchia                   │
│    ├─ ...                           │
│    └─ Più recente                   │
├─────────────────────────────────────┤
│ 2. TIMER ALERTS                     │
│    (orologio rosso)                 │
│    ├─ Più vecchia                   │
│    ├─ ...                           │
│    └─ Più recente                   │
├─────────────────────────────────────┤
│ 3. PRATICHE NORMALI                 │
│    ├─ Più vecchia                   │
│    ├─ ...                           │
│    └─ Più recente                   │
└─────────────────────────────────────┘
```

## Permessi
- **Visibilità**: Solo utenti `admin` e `userdm329`
- **Funzione check**: `canViewTimerAlerts(userRole)`

## Comportamento Avvisi
1. **Attivazione**: Automatica quando soglia superata
2. **Reset**: Automatico al cambio stato (trigger DB)
3. **Persistenza**: Flag salvato in DB, aggiornato giornalmente
4. **Notifiche**: Nessuna (solo visualizzazione in lista)
5. **Dashboard**: Non compare in analytics/metriche

## Applicazione Migration

### Opzione 1: Supabase CLI
```bash
supabase db push
```

### Opzione 2: SQL Editor (Manuale)
1. Aprire Supabase Dashboard → SQL Editor
2. Copiare contenuto di `APPLY_TIMER_ALERTS.sql`
3. Eseguire script
4. Verificare risultati nella query finale

### Opzione 3: Script Update Periodico
```sql
-- Eseguire giornalmente (es. via pg_cron)
SELECT calculate_dm329_timer_alerts();
```

## Aggiornamento Timer

**Frequenza consigliata**: 1 volta al giorno (es. ore 2:00)

**Opzioni:**
1. **pg_cron** (scheduled job Supabase):
   ```sql
   SELECT cron.schedule(
     'dm329-timer-alerts-daily',
     '0 2 * * *',  -- Ogni giorno alle 2:00
     $$SELECT calculate_dm329_timer_alerts()$$
   );
   ```

2. **Manuale**: Eseguire `SELECT calculate_dm329_timer_alerts();`

3. **Trigger real-time**: Già implementato per reset al cambio stato

## Testing

### Test Calcolo Timer
```sql
-- Crea pratica test con data fittizia
INSERT INTO requests (request_type_id, title, status, created_by, created_at)
VALUES (
  (SELECT id FROM request_types WHERE name = 'DM329'),
  'TEST - Timer Alert',
  '1-INCARICO_RICEVUTO',
  (SELECT id FROM users LIMIT 1),
  NOW() - INTERVAL '35 days'
);

-- Esegui calcolo
SELECT calculate_dm329_timer_alerts();

-- Verifica flag attivato
SELECT id, title, status, has_timer_alert, created_at
FROM requests
WHERE title = 'TEST - Timer Alert';
```

### Test UI
1. Accedere come `admin` o `userdm329`
2. Navigare su pagina Richieste → Tab DM329
3. Verificare:
   - Pratiche con timer alert in alto (sotto bloccate)
   - Icona orologio rosso visibile
   - Background rosso chiaro
   - Tooltip con messaggio corretto

## File Modificati/Creati

```
supabase/
  migrations/
    ✅ 20251111000001_add_dm329_timer_alerts.sql (migration principale)
    ✅ APPLY_TIMER_ALERTS_UPDATE.sql (script update manuale)

src/
  types/
    ✅ index.ts (aggiunto has_timer_alert a Request)

  utils/
    ✅ timerUtils.ts (NUOVO - utilities calcolo timer)

  components/
    requests/
      ✅ TimerAlertIndicator.tsx (NUOVO - componente icona)
      ✅ DM329TableView.tsx (modificato - ordinamento + rendering)

DOCUMENTAZIONE/
  ✅ TIMER_ALERTS_IMPLEMENTATION.md (questo file)

✅ APPLY_TIMER_ALERTS.sql (script all-in-one per SQL Editor)
```

## Note Tecniche

### Performance
- Indice `idx_requests_timer_alert` per filtraggio rapido
- Query history ottimizzata con `ORDER BY created_at DESC LIMIT 1`
- Calcolo giornaliero evita overhead real-time

### Scalabilità
- Function PL/pgSQL con loop ottimizzato
- Trigger leggero (solo check tipo + reset flag)
- Denormalizzazione campo `has_timer_alert` per query veloci

### Compatibilità
- Non impatta pratiche esistenti (campo nullable)
- Retrocompatibile con codice esistente
- Fallback graceful se campo mancante

## Troubleshooting

### Timer non si attivano
1. Verificare migration applicata: `SELECT * FROM requests LIMIT 1` (deve avere colonna `has_timer_alert`)
2. Eseguire manualmente: `SELECT calculate_dm329_timer_alerts()`
3. Controllare `request_history` per timestamp corretti

### Icona non visibile
1. Verificare ruolo utente: deve essere `admin` o `userdm329`
2. Check console browser per errori import
3. Verificare campo `has_timer_alert` presente in query

### Ordinamento errato
1. Controllare logica sort in `DM329TableView.tsx:150-168`
2. Verificare valori `is_blocked` e `has_timer_alert` nel payload
3. Debug con `console.log(filteredAndSortedRequests)`

---

**Data implementazione**: 11 Novembre 2025
**Versione**: 1.0.0
**Autore**: Claude Code
