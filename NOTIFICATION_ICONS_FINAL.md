# Codifica Icone Notifiche - Versione Finale

## Mappa Completa Icone ✅

### 1. **Informazione** (Cerchio blu con "i")
**Icona**: `InfoIcon` blu
**Utilizzo**:
- ✅ Creazione nuove richieste
- ✅ Cambi stato intermedi (es. APERTA → ASSEGNATA, IN_LAVORAZIONE → ecc.)

**Codice**:
```typescript
case 'request_created':
  return <InfoIcon color="info" />
case 'status_change':
  return <InfoIcon color="info" />
```

### 2. **Avviso** (Triangolo arancione con "!")
**Icona**: `WarningIcon` arancione
**Utilizzo**:
- ✅ Richiesta bloccata (→ SOSPESA)

**Codice**:
```typescript
case 'request_suspended':
  return <WarningIcon color="warning" />
```

### 3. **Via Libera** (Cerchio verde con flag completato)
**Icona**: `CheckCircleIcon` verde
**Utilizzo**:
- ✅ Richiesta sbloccata (SOSPESA → altro stato)

**Codice**:
```typescript
case 'request_unsuspended':
  return <CheckCircleIcon color="success" />
```

### 4. **Stop** (Cerchio rosso con "X")
**Icona**: `CancelIcon` rosso
**Utilizzo**:
- ✅ Richiesta abortita (→ ABORTITA)
- ✅ Richiesta eliminata

**Codice**:
```typescript
if (status_to === 'ABORTITA') {
  return <CancelIcon color="error" />
}
```

### 5. **Completata** (Cerchio grigio)
**Icona**: `RemoveCircleIcon` grigio
**Utilizzo**:
- ✅ Richiesta completata (→ COMPLETATA)
- ✅ Richiesta DM329 chiusa (→ 7-CHIUSA)

**Codice**:
```typescript
if (status_to === 'COMPLETATA' || status_to === '7-CHIUSA') {
  return <RemoveCircleIcon sx={{ color: 'grey.500' }} />
}
```

## Tabella Riepilogativa

| Tipo Notifica | Icona | Colore | Stato |
|---------------|-------|--------|-------|
| Creazione richiesta | ⓘ Info | Blu | - |
| Cambio stato intermedio | ⓘ Info | Blu | - |
| Richiesta bloccata | ⚠ Warning | Arancione | SOSPESA |
| Richiesta sbloccata | ✓ CheckCircle | Verde | da SOSPESA |
| Richiesta abortita | ⊗ Cancel | Rosso | ABORTITA |
| Richiesta completata | ⊖ RemoveCircle | Grigio | COMPLETATA / 7-CHIUSA |

## Logica di Selezione Icona

```typescript
function getNotificationIcon(notification: Notification) {
  const { event_type, status_to } = notification

  // PRIORITÀ 1: Controlla stato finale specifico
  if (status_to === 'ABORTITA') {
    return <CancelIcon color="error" />  // STOP rosso
  }

  if (status_to === 'COMPLETATA' || status_to === '7-CHIUSA') {
    return <RemoveCircleIcon sx={{ color: 'grey.500' }} />  // Grigio
  }

  // PRIORITÀ 2: Controlla tipo evento
  switch (event_type) {
    case 'request_created':
      return <InfoIcon color="info" />  // Info blu
    case 'request_suspended':
      return <WarningIcon color="warning" />  // Avviso arancio
    case 'request_unsuspended':
      return <CheckCircleIcon color="success" />  // Via libera verde
    case 'status_change':
      return <InfoIcon color="info" />  // Info blu
    default:
      return <InfoIcon />
  }
}
```

## Esempi Pratici

### Esempio 1: Flusso Richiesta Standard
1. **Creazione**: ⓘ Blu - "Acme Corp - Allacciamento - richiesta creata"
2. **Assegnazione**: ⓘ Blu - "Acme Corp - Allacciamento - cambiata da APERTA a ASSEGNATA"
3. **Blocco**: ⚠ Arancio - "Acme Corp - Allacciamento - richiesta bloccata"
4. **Sblocco**: ✓ Verde - "Acme Corp - Allacciamento - richiesta sbloccata"
5. **Completamento**: ⊖ Grigio - "Acme Corp - Allacciamento - richiesta completata"

### Esempio 2: Flusso DM329
1. **Creazione**: ⓘ Blu - "Studio Bertin - DM329 DARA - richiesta creata"
2. **Progressione**: ⓘ Blu - "Studio Bertin - DM329 DARA - cambiata da 1-INCARICO_RICEVUTO a 2-SCHEDA_DATI_PRONTA"
3. **Chiusura**: ⊖ Grigio - "Studio Bertin - DM329 DARA - cambiata da 6-PRONTA_PER_CIVA a 7-CHIUSA"

### Esempio 3: Richiesta Abortita
1. **Creazione**: ⓘ Blu - "Cliente XYZ - Sopralluogo - richiesta creata"
2. **Abort**: ⊗ Rosso - "Cliente XYZ - Sopralluogo - richiesta abortita"

## Colori Chip Stato

I chip dello stato nella notifica seguono la stessa logica:

```typescript
function getNotificationColor(notification: Notification) {
  if (status_to === 'ABORTITA') return 'error'        // Rosso
  if (status_to === 'COMPLETATA' || status_to === '7-CHIUSA') return 'default'  // Grigio

  switch (event_type) {
    case 'request_created': return 'info'      // Blu
    case 'request_suspended': return 'warning'  // Arancione
    case 'request_unsuspended': return 'success' // Verde
    case 'status_change': return 'info'        // Blu
    default: return 'default'
  }
}
```

## Files Modificati

- ✅ [src/components/common/NotificationDrawer.tsx](src/components/common/NotificationDrawer.tsx)
  - Aggiornate funzioni `getNotificationIcon()` e `getNotificationColor()`
  - Importate nuove icone: `CheckCircleIcon`, `RemoveCircleIcon`
  - Rimossi import non utilizzati: `BlockIcon`, `PlayArrowIcon`

## Compilazione
✅ TypeScript compila senza errori
✅ Tutte le icone sono correttamente tipizzate
✅ Logica condizionale ottimizzata con priorità

## Note Implementative

### Priorità Icone
1. **Prima** controlla lo stato finale (`status_to`)
2. **Poi** controlla il tipo evento (`event_type`)

Questo garantisce che stati come ABORTITA e COMPLETATA abbiano sempre l'icona corretta, indipendentemente dal tipo di evento che li ha generati.

### Gestione Grigio
Per il colore grigio si usa `sx={{ color: 'grey.500' }}` invece di `color="disabled"` per avere più controllo sulla tonalità.

### Retrocompatibilità
Le vecchie notifiche continueranno a funzionare con il fallback di default (`InfoIcon`).
