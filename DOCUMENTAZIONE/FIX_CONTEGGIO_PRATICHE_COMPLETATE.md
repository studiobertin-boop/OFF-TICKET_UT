# Fix: Conteggio Pratiche Completate/Chiuse Post-Eliminazione

## Data
12/11/2025

## Problema Rilevato

Il conteggio delle pratiche completate/chiuse nelle dashboard **non era persistente** dopo l'eliminazione massiva delle pratiche da parte dell'amministratore.

### Comportamento Atteso
- **Dashboard Richieste Generali**: La card "Completate" deve contare TUTTE le pratiche completate (escluse DM329), anche se successivamente eliminate dal database
- **Dashboard DM329**: La card "7 - CHIUSA" deve contare TUTTE le pratiche DM329 chiuse, anche se successivamente eliminate dal database

### Comportamento Precedente
- **Dashboard Richieste Generali**: ✅ CORRETTO - Utilizzava già la tabella `request_completions` per conteggio persistente
- **Dashboard DM329**: ❌ ERRATO - Contava solo le richieste ancora presenti nella tabella `requests` + offset fisso hardcoded (798)

## Causa Root

Nel file [src/services/api/analytics.ts](../src/services/api/analytics.ts), la funzione `dm329AnalyticsApi.getOverview()` utilizzava una query diretta sulla tabella `requests`:

```typescript
// VECCHIO CODICE (ERRATO)
const status7Raw = filteredData?.filter(r => r.status === '7-CHIUSA').length || 0;
const HISTORICAL_CLOSED_OFFSET = 798;
const status7 = status7Raw + HISTORICAL_CLOSED_OFFSET;
```

Questo approccio aveva due problemi:
1. **Non persistente**: Quando una pratica DM329 veniva eliminata dal database, non veniva più contata
2. **Offset statico**: L'offset di 798 era fisso e non si aggiornava automaticamente con nuove eliminazioni

## Soluzione Implementata

### Tabella `request_completions`

Il sistema dispone già della tabella `request_completions` creata con la migration [20251106000000_add_dashboard_analytics.sql](../supabase/migrations/20251106000000_add_dashboard_analytics.sql):

```sql
CREATE TABLE IF NOT EXISTS request_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL,
  request_type_id UUID NOT NULL,
  request_type_name TEXT NOT NULL,
  status TEXT NOT NULL, -- COMPLETATA or 7-CHIUSA
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Caratteristiche chiave:**
- Traccia TUTTE le richieste che raggiungono lo stato `COMPLETATA` o `7-CHIUSA`
- I record **NON vengono eliminati** quando le richieste vengono cancellate dal database
- Trigger automatico `track_request_completion()` popola la tabella in tempo reale
- Backfill iniziale dei dati storici già presente

### Modifica Codice

Modificato `dm329AnalyticsApi.getOverview()` per utilizzare `request_completions`:

```typescript
// NUOVO CODICE (CORRETTO)
// Get completed count from request_completions (includes deleted DM329)
let completedQuery = supabase
  .from('request_completions')
  .select('*', { count: 'exact', head: true })
  .eq('request_type_name', 'DM329')
  .eq('status', '7-CHIUSA');

if (filters.dateFrom) {
  completedQuery = completedQuery.gte('completed_at', filters.dateFrom);
}
if (filters.dateTo) {
  completedQuery = completedQuery.lte('completed_at', filters.dateTo);
}

const { count: status7Count } = await completedQuery;

// Offset fisso per pratiche chiuse storiche non importate nel database
const HISTORICAL_CLOSED_OFFSET = 798;
const status7 = (status7Count || 0) + HISTORICAL_CLOSED_OFFSET;
```

## Vantaggi della Soluzione

1. **Persistenza Garantita**: Le pratiche eliminate continuano ad essere conteggiate
2. **Coerenza tra Dashboard**: Entrambe le dashboard (Generale e DM329) ora usano lo stesso approccio
3. **Aggiornamento Automatico**: I conteggi si aggiornano automaticamente senza bisogno di modificare offset statici
4. **Supporto Filtri**: I filtri per data continuano a funzionare correttamente usando `completed_at`
5. **Performance**: Query ottimizzata con `count: 'exact', head: true` (non scarica dati, solo conteggio)

## Testing

### Test Case 1: Verifica Conteggio Pre-Eliminazione
1. Accedere alla Dashboard DM329
2. Annotare il valore della card "7 - CHIUSA"
3. Verificare che il conteggio includa offset fisso (798) + pratiche nel database

### Test Case 2: Verifica Persistenza Post-Eliminazione
1. Accedere come Admin alla pagina Richieste → Tab DM329
2. Selezionare alcune pratiche con stato "7-CHIUSA"
3. Eseguire eliminazione massiva
4. Tornare alla Dashboard DM329
5. **Verificare che il conteggio della card "7 - CHIUSA" NON sia diminuito**

### Test Case 3: Verifica Filtri Data
1. Applicare filtro date sulla Dashboard DM329
2. Verificare che il conteggio "7 - CHIUSA" venga filtrato correttamente in base a `completed_at`

## File Modificati

- [src/services/api/analytics.ts](../src/services/api/analytics.ts) - Linee 468-487

## Database Schema Utilizzato

### Tabella: `request_completions`
- **Scopo**: Tracking persistente delle richieste completate/chiuse
- **Trigger**: `track_request_completion()` - Eseguito automaticamente su INSERT/UPDATE della tabella `requests`
- **Indici**:
  - `idx_request_completions_type_date` - Per query filtrate per tipo e data
  - `idx_request_completions_status` - Per query filtrate per stato

### Trigger: `track_request_completion()`
```sql
-- Trigger function to track completions
CREATE OR REPLACE FUNCTION track_request_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Track when a request transitions to COMPLETATA or 7-CHIUSA
  IF NEW.status IN ('COMPLETATA', '7-CHIUSA') AND
     (TG_OP = 'INSERT' OR OLD.status != NEW.status) THEN
    -- Check if this completion is already tracked
    IF NOT EXISTS (
      SELECT 1 FROM request_completions
      WHERE request_id = NEW.id AND status = NEW.status
    ) THEN
      -- Insert completion record
      INSERT INTO request_completions (...)
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Note sull'Offset Fisso

L'offset di **798** pratiche storiche rimane nel codice perché rappresenta:
- Pratiche DM329 chiuse PRIMA dell'implementazione del sistema di tracking
- Pratiche mai importate nel database gestionale
- Numero storico fornito dall'ufficio (Target totale: 903, Database iniziale: 105)

Questo offset:
- ✅ È corretto mantenerlo
- ✅ Non cambia nel tempo (storiche fisse)
- ✅ Si somma al conteggio dinamico di `request_completions`

## Conclusione

Il fix garantisce che:
1. **Richieste Generali**: Conteggio "Completate" persistente anche post-eliminazione ✅ (già funzionante)
2. **DM329**: Conteggio "7 - CHIUSA" persistente anche post-eliminazione ✅ (FIXATO)
3. **Coerenza**: Entrambe le dashboard usano `request_completions` ✅
4. **Filtri**: I filtri data funzionano correttamente su `completed_at` ✅

**Status**: COMPLETO ✓
**Build TypeScript**: PASS ✓
**Migration Database**: Non richiesta (tabella già esistente) ✓
