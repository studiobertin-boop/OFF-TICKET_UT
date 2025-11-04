# Bugfix: Visualizzazione Tabelle Richieste Nascoste

## Problema
Quando l'utente admin cliccava sui tab "Nascoste Generali" o "Nascoste DM329", non succedeva niente e le tabelle non venivano visualizzate.

## Causa Root
Il problema era causato dall'uso di un Fragment React (`<>...</>`) per wrappare i tab condizionali per l'admin nel componente `Tabs` di Material-UI:

```typescript
<Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
  <Tab label="Richieste Generali" />
  <Tab label="Richieste DM329" />
  {user?.role === 'admin' && (
    <>
      <Tab label="Nascoste Generali" />
      <Tab label="Nascoste DM329" />
    </>
  )}
</Tabs>
```

Material-UI Tabs non gestisce correttamente i Fragment come figli diretti, causando il mancato riconoscimento degli ultimi due tab. Di conseguenza:
1. I tab venivano renderizzati visivamente
2. Ma il click non attivava l'handler `onChange`
3. Lo stato `activeTab` rimaneva sempre a 0

## Soluzione Implementata

### 1. Rimozione dei Fragment dai Tab
La soluzione principale è stata rimuovere il Fragment `<>...</>` e renderizzare i tab condizionalmente in modo diretto:

```typescript
<Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
  <Tab label={`Richieste Generali (${otherRequests.length})`} />
  <Tab label={`Richieste DM329 (${dm329Requests.length})`} />
  {user?.role === 'admin' && <Tab label={`Nascoste Generali (${hiddenOtherRequests.length})`} />}
  {user?.role === 'admin' && <Tab label={`Nascoste DM329 (${hiddenDM329Requests.length})`} />}
</Tabs>
```

Questo permette a Material-UI di riconoscere correttamente tutti i tab come figli diretti del componente `Tabs`.

### 2. Aggiornamento della logica `displayRequests`
Modificata la variabile `displayRequests` per includere anche le richieste nascoste in base al tab attivo:

```typescript
const displayRequests = useMemo(() => {
  if (!canViewGeneralTab) return dm329Requests

  switch (activeTab) {
    case 0: return otherRequests        // Richieste Generali
    case 1: return dm329Requests         // Richieste DM329
    case 2: return hiddenOtherRequests   // Nascoste Generali
    case 3: return hiddenDM329Requests   // Nascoste DM329
    default: return otherRequests
  }
}, [canViewGeneralTab, activeTab, otherRequests, dm329Requests, hiddenOtherRequests, hiddenDM329Requests])
```

### 3. Forzare la vista tabella per richieste nascoste
Aggiunto un `useEffect` per forzare automaticamente la vista tabella quando si accede ai tab delle richieste nascoste:

```typescript
useEffect(() => {
  if (activeTab >= 2 && viewMode !== 'table') {
    setViewMode('table')
  }
}, [activeTab, viewMode])
```

**Motivazione**: La vista griglia non ha il supporto per le azioni bulk (unhide/delete) necessarie per gestire le richieste nascoste.

### 4. Disabilitare il toggle vista
Il pulsante di toggle tra vista griglia e tabella viene disabilitato quando si visualizzano richieste nascoste:

```typescript
<ToggleButtonGroup
  value={viewMode}
  exclusive
  onChange={(_, newMode) => newMode && setViewMode(newMode)}
  size="small"
  disabled={activeTab >= 2}  // Disabilita per tab nascoste
>
```

### 5. Pulizia codice
- Rimossa la variabile non utilizzata `loadingHidden` in [Requests.tsx](../src/pages/Requests.tsx)
- Rimosso il parametro non utilizzato `requestId` nella funzione `useUnblockRequest` in [useRequestBlocks.ts](../src/hooks/useRequestBlocks.ts)
- Rimossi tutti i log di debug aggiunti durante l'investigazione

## File Modificati
- [src/pages/Requests.tsx](../src/pages/Requests.tsx):
  - Aggiunto import `useEffect`
  - Rimosso Fragment `<>...</>` dai tab condizionali admin (fix principale)
  - Modificata logica `displayRequests` per includere richieste nascoste in base al tab attivo
  - Aggiunto `useEffect` per forzare vista tabella quando activeTab >= 2
  - Disabilitato toggle vista quando si visualizzano richieste nascoste (activeTab >= 2)
  - Rimossa variabile `loadingHidden` non utilizzata
  - Rimossi log di debug

- [src/hooks/useRequestBlocks.ts](../src/hooks/useRequestBlocks.ts):
  - Rimosso parametro `requestId` non utilizzato nella funzione `useUnblockRequest`

## Testing
✅ Build TypeScript completata senza errori
✅ Build produzione completata con successo
✅ Test manuale: click sui tab "Nascoste Generali" e "Nascoste DM329" funzionanti
✅ Cambio automatico a vista tabella verificato
✅ Toggle vista disabilitato correttamente sui tab nascoste

## Risultato
Ora quando l'admin clicca sui tab "Nascoste Generali" o "Nascoste DM329":
1. L'evento `onChange` viene correttamente attivato e lo stato `activeTab` viene aggiornato
2. La vista viene automaticamente commutata su "tabella" se era su "griglia"
3. Il toggle vista viene disabilitato per evitare confusione
4. Le tabelle delle richieste nascoste vengono correttamente visualizzate
5. Le azioni bulk (unhide/delete) sono disponibili tramite il componente `HiddenRequestsView`

## Lezione Appresa
**Material-UI Tabs non supporta Fragment come figli diretti**. Quando si ha necessità di renderizzare condizionalmente dei `Tab` components, usare direttamente l'operatore condizionale `&&` senza wrappare in Fragment:

```typescript
// ❌ NON FUNZIONA
{condition && (
  <>
    <Tab ... />
    <Tab ... />
  </>
)}

// ✅ FUNZIONA
{condition && <Tab ... />}
{condition && <Tab ... />}
```

## Data
2025-11-04
