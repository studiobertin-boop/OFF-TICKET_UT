# Aggiornamento Completo Sistema Permessi

**Data**: 2025-11-02
**Versione**: 3.0 - Sistema Blocchi + Permessi Rivisti

## Nuova Matrice Permessi

### Panoramica Ruoli

| Ruolo | Tipi Richieste | Blocco | Sblocco | Cambio Stato |
|-------|---------------|--------|---------|--------------|
| **admin** | Tutte | ✅ Tutte | ✅ Tutte | ✅ Tutti gli stati |
| **tecnico** | Solo GENERALI (no DM329) | ❌ No | ✅ Sì | ✅ Stati workflow standard |
| **userdm329** | Solo DM329 | ✅ Solo DM329 | ✅ Solo DM329 | ✅ Stati workflow DM329 |
| **utente** | Solo GENERALI (no DM329) | ❌ No | ✅ Sì | ❌ No |

### Dettagli per Ruolo

#### Admin
- **Richieste visibili**: Tutte (generali + DM329)
- **Creazione richieste**: Tutte
- **Blocco**: Può bloccare qualsiasi richiesta
- **Sblocco**: Può sbloccare qualsiasi richiesta
- **Cambio stato**: Può cambiare qualsiasi stato, anche su richieste bloccate
- **Note**: Controllo totale del sistema

#### Tecnico
- **Richieste visibili**: Solo richieste GENERALI (escluso DM329) assegnate a lui
- **Creazione richieste**: Non previsto (i tecnici non creano richieste)
- **Blocco**: ❌ NON può bloccare richieste
- **Sblocco**: ✅ Può sbloccare richieste generali
- **Cambio stato**: ✅ Può cambiare stato su richieste generali assegnate (workflow standard)
- **Note**: Focus su lavorazione richieste assegnate, non su DM329

#### Userdm329
- **Richieste visibili**: Solo richieste DM329
- **Creazione richieste**: Solo DM329
- **Blocco**: ✅ Può bloccare richieste DM329
- **Sblocco**: ✅ Può sbloccare richieste DM329
- **Cambio stato**: ✅ Può cambiare stato su richieste DM329 (workflow sequenziale DM329)
- **Note**: Gestione completa del workflow DM329, completamente separato dalle richieste generali

#### Utente
- **Richieste visibili**: Solo proprie richieste GENERALI (escluso DM329)
- **Creazione richieste**: Solo GENERALI (no DM329)
- **Blocco**: ❌ NON può bloccare richieste
- **Sblocco**: ✅ Può sbloccare le proprie richieste generali quando bloccate
- **Cambio stato**: ❌ NON può cambiare stato
- **Note**: Può solo creare richieste e rispondere a blocchi caricando file/note

## Modifiche Implementate

### 1. Database - Migration `20251102000003_update_permissions_logic.sql`

#### A. RLS Policies Request Blocks

**Rimosse**:
- `Tecnico can block assigned requests` - i tecnici NON possono più bloccare

**Aggiunte**:
- `Tecnico can unblock general requests` - unblock solo su richieste generali (non DM329)
- `userdm329 can unblock DM329 requests` - unblock su DM329

#### B. Funzione `validate_status_transition`

**Logica aggiornata**:
```sql
1. Admin → sempre permesso (anche se bloccato)
2. Utente → SEMPRE negato (non può mai cambiare stato)
3. Bloccata? → negato per tutti tranne admin
4. DM329?
   - Solo userdm329 può modificare (+ admin già gestito)
   - Workflow sequenziale DM329
5. Generale?
   - Solo tecnico può modificare (+ admin già gestito)
   - Workflow standard
```

#### C. RLS Policies Requests

**Rimosse** (sostituiscono policies vecchie senza filtro tipo):
- `Tecnico can view assigned requests`
- `Tecnico can update assigned requests`
- `Utente can view own requests`
- `Utente can create requests`
- `Utente can update own requests`

**Aggiunte con filtro tipo**:
- `Tecnico can view assigned general requests` - `WHERE request_type_id NOT IN (DM329)`
- `Tecnico can update assigned general requests` - `WHERE request_type_id NOT IN (DM329)`
- `Utente can view own general requests` - `WHERE request_type_id NOT IN (DM329)`
- `Utente can create general requests` - `WHERE request_type_id NOT IN (DM329)`
- `Utente can update own general requests` - `WHERE request_type_id NOT IN (DM329)`

### 2. Frontend - `RequestDetail.tsx`

**Prima**:
```typescript
const canBlock =
  user?.role === 'admin' ||
  (user?.role === 'tecnico' && request.assigned_to === user.id) ||  // ❌ Sbagliato
  (user?.role === 'userdm329' && request.request_type?.name === 'DM329')

const canUnblock =
  user?.id === request.created_by || user?.id === activeBlock?.blocked_by  // ❌ Troppo generico
```

**Dopo**:
```typescript
const canBlock =
  user?.role === 'admin' ||
  (user?.role === 'userdm329' && request.request_type?.name === 'DM329')  // ✅ Solo admin e userdm329

const isDM329 = request.request_type?.name === 'DM329'
const canUnblock =
  user?.role === 'admin' ||
  (user?.role === 'tecnico' && !isDM329) ||        // ✅ Solo generali
  (user?.role === 'userdm329' && isDM329) ||       // ✅ Solo DM329
  (user?.role === 'utente' && !isDM329)            // ✅ Solo generali
```

## Workflow Blocco/Sblocco

### Scenario 1: Richiesta Generale Bloccata

```
1. Admin blocca richiesta generale
2. Notifica inviata al creator (utente)
3. Utente vede triangolo warning, non può cambiare stato
4. Utente clicca "Sblocca Richiesta", carica file e note
5. Blocco risolto, notifica inviata al tecnico
6. Tecnico può continuare workflow
```

### Scenario 2: Richiesta DM329 Bloccata

```
1. Userdm329 blocca richiesta DM329
2. Notifica inviata al creator (userdm329 stesso o altro)
3. Creator vede triangolo warning, non può cambiare stato
4. Creator sblocca con note/file
5. Workflow DM329 continua
```

### Scenario 3: Tecnico Tenta di Bloccare

```
1. Tecnico non vede pulsante "Blocca Richiesta"
2. Se tenta via API → Backend blocca con error 42501
3. Tecnico può solo sbloccare richieste generali
```

## Ordine di Applicazione Migrazioni

```bash
# 1. Blocco base (già applicato)
20251102000001_add_request_blocks.sql

# 2. Prevenzione cambio stato bloccato - SOSTITUITA DA 3
# 20251102000002_prevent_status_change_when_blocked.sql  # ⚠️ NON applicare

# 3. Aggiornamento completo permessi - APPLICARE QUESTA
20251102000003_update_permissions_logic.sql
```

**IMPORTANTE**: La migrazione `20251102000003` **sostituisce completamente** la `20251102000002`.
Se hai già applicato la 002, la 003 la sovrascrive correttamente.

## Test di Verifica

### Test 1: Tecnico non vede DM329
```
1. Login come tecnico
2. Verificare che lista richieste non mostri DM329
3. Tentare di aprire URL diretto di richiesta DM329
4. ✅ Deve risultare "Richiesta non trovata" (RLS blocca)
```

### Test 2: Utente non vede DM329
```
1. Login come utente
2. Verificare che in creazione nuova richiesta NON ci sia opzione DM329
3. Verificare che lista richieste non mostri DM329
4. ✅ Solo richieste generali visibili
```

### Test 3: Userdm329 vede solo DM329
```
1. Login come userdm329
2. Verificare che lista mostri SOLO richieste DM329
3. Verificare che in creazione ci sia SOLO opzione DM329
4. ✅ Totale separazione dai workflow generali
```

### Test 4: Utente non può cambiare stato
```
1. Login come utente (creator di richiesta)
2. Aprire una propria richiesta generale
3. Sezione "Cambia Stato" deve essere vuota o mostrare:
   "Gli utenti non possono modificare lo stato delle richieste"
4. ✅ Nessun pulsante visibile
```

### Test 5: Tecnico non può bloccare
```
1. Login come tecnico
2. Aprire richiesta generale assegnata
3. Verificare che NON ci sia pulsante "Blocca Richiesta"
4. ✅ Solo "Sblocca Richiesta" se bloccata
```

### Test 6: Userdm329 può bloccare/sbloccare
```
1. Login come userdm329
2. Aprire richiesta DM329
3. Verificare presenza pulsante "Blocca Richiesta"
4. Bloccare richiesta
5. Verificare presenza pulsante "Sblocca Richiesta"
6. ✅ Entrambe azioni disponibili
```

### Test 7: Admin controlla tutto
```
1. Login come admin
2. Verificare visibilità di TUTTE le richieste (generali + DM329)
3. Bloccare una richiesta qualsiasi
4. Cambiare stato anche se bloccata (deve funzionare)
5. Sbloccare richiesta
6. ✅ Nessuna restrizione
```

## Impatti su Funzionalità Esistenti

### ✅ Nessun Impatto
- Dashboard analytics (admin vede tutto)
- Notifiche (continuano a funzionare)
- Upload allegati (permessi invariati)
- Storico richieste (visibilità basata su RLS requests)

### ⚠️ Impatti da Verificare
- **Assegnazione richieste**: Verificare che admin possa assegnare richieste generali solo a tecnici
- **Creazione nuove richieste**: Form deve filtrare request_types per ruolo
- **Export dati**: Admin può esportare tutto, altri solo ciò che vedono

## Rollback

Se necessario tornare indietro:

```sql
-- Ripristinare validate_status_transition dalla versione precedente
-- (usare backup o migration 20250101000000_initial_schema.sql)

-- Rimuovere policies nuove
DROP POLICY "Tecnico can view assigned general requests" ON requests;
DROP POLICY "Tecnico can update assigned general requests" ON requests;
-- ...etc

-- Ricreare policies vecchie
-- (da 20250101000001_rls_policies.sql)
```

## Note Tecniche

1. **Perché DROP + CREATE invece di ALTER?**
   - Le RLS policies non supportano ALTER
   - DROP IF EXISTS + CREATE è idempotente

2. **Performance delle subquery nelle policies**
   - `request_type_id NOT IN (SELECT...)` eseguita per ogni row
   - Con poche request_types (< 100) performance OK
   - Alternative: cache materializzata o hardcode UUID DM329

3. **Tecnico può vedere richieste non assegnate?**
   - NO, policy richiede `assigned_to = auth.uid()`
   - Solo admin vede richieste non assegnate

4. **Utente può riassegnarsi richiesta?**
   - NO, policy impedisce modifica `assigned_to`

## Prossimi Sviluppi

- [ ] Aggiungere policy per INSERT richieste DM329 (userdm329)
- [ ] Log audit per azioni sensibili (block/unblock)
- [ ] Dashboard separata per userdm329 con metriche DM329
- [ ] Email notifications per blocchi (attualmente solo in-app)
