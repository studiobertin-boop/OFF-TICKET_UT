import { useEffect, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '../services/api/notifications'
import type { Notification } from '../types'

export function useNotifications() {
  const queryClient = useQueryClient()
  const [unreadCount, setUnreadCount] = useState(0)

  // Query notifiche non lette
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationsApi.getUnreadNotifications,
    refetchInterval: 5000, // Polling ogni 5 secondi (Realtime ha problemi WebSocket)
  })

  // Aggiorna count quando cambia la lista
  useEffect(() => {
    setUnreadCount(notifications.length)
  }, [notifications])

  // Mutation per marcare come letta
  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Mutation per marcare tutte come lette
  const markAllAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: async () => {
      // Resetta completamente la cache delle notifiche per forzare il refetch
      queryClient.setQueryData<Notification[]>(['notifications', 'unread'], [])
      // Poi invalida per ricaricare dal server (nel caso ci siano nuove notifiche nel frattempo)
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Mutation per eliminare notifica
  const deleteNotificationMutation = useMutation({
    mutationFn: notificationsApi.deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Callback per nuove notifiche
  const handleNewNotification = useCallback(
    (notification: Notification) => {
      // Aggiorna cache con la nuova notifica
      queryClient.setQueryData<Notification[]>(
        ['notifications', 'unread'],
        (old = []) => [notification, ...old]
      )

      // Mostra notifica browser (se permesso)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.message, {
          body: notification.metadata?.request_title || '',
          icon: '/favicon.ico',
          tag: notification.id,
        })
      }
    },
    [queryClient]
  )

  // Sottoscrizione Realtime (temporaneamente disabilitata causa errori WebSocket)
  useEffect(() => {
    // DISABILITATO: Realtime causa errori WebSocket continui
    // const unsubscribe = notificationsApi.subscribeToNotifications(handleNewNotification)

    // Richiedi permesso notifiche browser al primo caricamento
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // return unsubscribe
    return () => {} // No-op cleanup
  }, [handleNewNotification])

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead: markAsReadMutation.mutate,
    markAllAsRead: markAllAsReadMutation.mutate,
    markAllAsReadAsync: markAllAsReadMutation.mutateAsync,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    deleteNotification: deleteNotificationMutation.mutate,
    deleteNotificationAsync: deleteNotificationMutation.mutateAsync,
  }
}

// Hook per preferenze notifiche
export function useNotificationPreferences() {
  const queryClient = useQueryClient()

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationsApi.getNotificationPreferences,
  })

  const updatePreferencesMutation = useMutation({
    mutationFn: notificationsApi.upsertNotificationPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })

  const updateStatusTransitionMutation = useMutation({
    mutationFn: ({
      statusFrom,
      statusTo,
      enabled,
    }: {
      statusFrom: string
      statusTo: string
      enabled: boolean
    }) => notificationsApi.updateStatusTransitionPreference(statusFrom, statusTo, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })

  return {
    preferences,
    isLoading,
    updatePreferences: updatePreferencesMutation.mutate,
    updateStatusTransition: updateStatusTransitionMutation.mutate,
    isUpdating: updatePreferencesMutation.isPending || updateStatusTransitionMutation.isPending,
  }
}
