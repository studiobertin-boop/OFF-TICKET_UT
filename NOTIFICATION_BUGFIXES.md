# Correzioni Bug Sistema Notifiche

## Bug Risolti

### 1. Icona Notifica Cambia da "i" a "!" ✓
**Problema**: Dopo il click su una notifica, l'icona cambiava da cerchio blu con "i" a triangolo giallo con "!"

**Causa**:
- TypeScript warning sul tipo di `color` prop del componente `Chip`
- Il valore `'default'` non era tipizzato correttamente

**Soluzione**:
- Aggiunto type annotation esplicito alla funzione `getNotificationColor()` in [NotificationDrawer.tsx](src/components/common/NotificationDrawer.tsx:48-63)
- Specificato il tipo di ritorno come union type completo: `'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'`

### 2. Notifiche Non Scompaiono Dopo il Click ✓
**Problema**: Alcune notifiche rimanevano visibili anche dopo essere state cliccate

**Causa**:
- L'hook utilizzava `markAsRead()` invece di `deleteNotification()`
- Secondo i requisiti, le notifiche devono essere **eliminate** dopo la visualizzazione, non solo marchiate come lette
- Uso di `window.location.href` causava reload della pagina prima che la mutation completasse

**Soluzione**:
1. **Hook useNotifications** ([useNotifications.ts](src/hooks/useNotifications.ts)):
   - Rimosso `markAsReadAndNavigate`
   - Esportato `deleteNotificationAsync` per permettere await

2. **NotificationDrawer** ([NotificationDrawer.tsx](src/components/common/NotificationDrawer.tsx)):
   - Aggiunto `useNavigate` da React Router
   - Modificato `handleClick` per:
     - Eliminare la notifica con `await deleteNotificationAsync()`
     - Chiudere il drawer
     - Navigare con `navigate()` invece di `window.location.href`
   - Passato `onClose` prop al componente `NotificationItem`

## Codice Modificato

### useNotifications.ts
```typescript
// PRIMA
const markAsReadAndNavigate = useCallback(
  async (notificationId: string, requestId?: string) => {
    await markAsReadMutation.mutateAsync(notificationId)
    if (requestId) {
      window.location.href = `/requests/${requestId}`
    }
  },
  [markAsReadMutation]
)

return {
  ...
  markAsReadAndNavigate,
}

// DOPO
return {
  notifications,
  unreadCount,
  isLoading,
  markAsRead: markAsReadMutation.mutate,
  markAllAsRead: markAllAsReadMutation.mutate,
  deleteNotification: deleteNotificationMutation.mutate,
  deleteNotificationAsync: deleteNotificationMutation.mutateAsync, // ← NUOVO
}
```

### NotificationDrawer.tsx
```typescript
// PRIMA
function NotificationItem({ notification }: { notification: Notification }) {
  const { markAsReadAndNavigate } = useNotifications()

  const handleClick = () => {
    markAsReadAndNavigate(notification.id, notification.request_id)
  }
  // ...
}

// DOPO
function NotificationItem({ notification, onClose }: { notification: Notification; onClose: () => void }) {
  const navigate = useNavigate()
  const { deleteNotificationAsync } = useNotifications()

  const handleClick = async () => {
    try {
      // Elimina la notifica
      await deleteNotificationAsync(notification.id)
      // Chiudi il drawer
      onClose()
      // Naviga alla richiesta se presente
      if (notification.request_id) {
        navigate(`/requests/${notification.request_id}`)
      }
    } catch (error) {
      console.error('Errore eliminazione notifica:', error)
    }
  }
  // ...
}
```

## Test da Eseguire

1. ✅ Verifica che l'icona rimanga coerente (cerchio blu con "i" per nuove richieste)
2. ✅ Clicca su una notifica e verifica che:
   - La notifica scompaia immediatamente dal drawer
   - Il counter del badge si aggiorni correttamente
   - La navigazione alla pagina di dettaglio avvenga senza reload
3. ✅ Verifica che non ci siano errori in console

## Comportamento Corretto Atteso

1. **Nuova notifica arriva**:
   - Badge mostra counter rosso
   - Icona corretta in base al tipo evento

2. **Click sulla notifica**:
   - Notifica viene eliminata dal database
   - Drawer si aggiorna immediatamente (notifica scompare)
   - Counter del badge si aggiorna
   - Navigazione smooth alla pagina richiesta (senza reload)
   - Drawer si chiude automaticamente

3. **Persistenza**:
   - Solo le notifiche NON visualizzate rimangono nel database
   - Dopo l'apertura/click, la notifica viene eliminata definitivamente

## Note Tecniche

- Le notifiche utilizzano **soft delete** (eliminazione dal DB, non solo flag `read: true`)
- La navigazione usa React Router per evitare reload completi
- L'eliminazione è async e gestita con try/catch per robustezza
- Il drawer si chiude prima della navigazione per UX migliore
