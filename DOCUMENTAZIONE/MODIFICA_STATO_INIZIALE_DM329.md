# Modifica Stato Iniziale DM329

## Data: 12 Novembre 2025

## Problema
Le pratiche DM329 alla creazione venivano impostate con stato "APERTA" come tutte le altre richieste. Questo creava confusione perché lo stato "APERTA" non fa parte del workflow DM329.

## Soluzione Implementata

### Modifiche al codice

**File modificato: `src/services/api/requests.ts`**

- Aggiunta logica per determinare il tipo di richiesta prima dell'inserimento
- Query al database per recuperare il nome del tipo di richiesta
- Impostazione dello stato iniziale in base al tipo:
  - **DM329**: stato iniziale = `'1-INCARICO_RICEVUTO'`
  - **Altri tipi**: stato iniziale = `'APERTA'`

### Comportamento

#### Prima della modifica
```typescript
status: 'APERTA' // Per tutte le richieste
```

#### Dopo la modifica
```typescript
// Determina il tipo di richiesta
const { data: requestType } = await supabase
  .from('request_types')
  .select('name')
  .eq('id', input.request_type_id)
  .single()

// Imposta lo stato iniziale corretto
const initialStatus = requestType?.name === 'DM329' ? '1-INCARICO_RICEVUTO' : 'APERTA'
```

## Workflow DM329

Gli stati del workflow DM329 sono:
1. **1-INCARICO_RICEVUTO** ← Stato iniziale
2. 2-SCHEDA_DATI_PRONTA
3. 3-MAIL_CLIENTE_INVIATA
4. 4-DOCUMENTI_PRONTI
5. 5-ATTESA_FIRMA
6. 6-PRONTA_PER_CIVA
7. 7-CHIUSA
8. ARCHIVIATA NON FINITA

## Impatto

- ✅ Le nuove pratiche DM329 verranno create con lo stato corretto "1-INCARICO_RICEVUTO"
- ✅ Le altre tipologie di richieste continueranno a usare "APERTA" come stato iniziale
- ✅ Non è necessaria migrazione dei dati esistenti
- ✅ Nessun impatto sulla dashboard e analytics
- ✅ Compatibile con le RLS policies esistenti

## Test

- ✅ Build TypeScript completata senza errori
- ✅ Build Vite completata con successo
- ⚠️ Testare manualmente la creazione di una nuova pratica DM329 per verificare lo stato iniziale

## Note

Questa modifica elimina la confusione dello stato "APERTA" per le pratiche DM329, rendendo il workflow più chiaro e coerente fin dalla creazione della pratica.
