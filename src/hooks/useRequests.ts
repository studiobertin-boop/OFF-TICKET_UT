import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { requestsApi, UpdateRequestInput, RequestFilters } from '@/services/api/requests'
import { RequestStatus, DM329Status } from '@/types'
import { useAuth } from './useAuth'
import { supabase } from '@/services/supabase'

export const REQUESTS_QUERY_KEY = ['requests']

export const useRequests = (filters?: RequestFilters) => {
  const { user, loading: authLoading } = useAuth()
  const queryClient = useQueryClient()

  // Attendi che l'autenticazione sia completata prima di eseguire la query
  const query = useQuery({
    queryKey: [...REQUESTS_QUERY_KEY, filters],
    queryFn: () => requestsApi.getAll(filters),
    enabled: !authLoading && !!user, // Esegui solo quando l'utente è caricato
  })

  // Subscription real-time per aggiornamenti richieste
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('requests-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
        },
        (payload) => {
          console.log('Request change detected:', payload)
          // Invalida la cache per ricaricare i dati
          queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, queryClient])

  return query
}

export const useRequest = (id: string) => {
  return useQuery({
    queryKey: [...REQUESTS_QUERY_KEY, id],
    queryFn: () => requestsApi.getById(id),
    enabled: !!id,
  })
}

export const useCreateRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
    },
  })
}

export const useUpdateRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateRequestInput }) =>
      requestsApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
    },
  })
}

export const useDeleteRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
    },
  })
}

export const useAssignRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ requestId, tecnicoId }: { requestId: string; tecnicoId: string }) =>
      requestsApi.assign(requestId, tecnicoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
    },
  })
}

export const useUpdateRequestStatus = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      requestId,
      newStatus,
    }: {
      requestId: string
      newStatus: RequestStatus | DM329Status
    }) => requestsApi.updateStatus(requestId, newStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
    },
  })
}

export const useHideRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestsApi.hide,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
    },
  })
}

export const useUnhideRequest = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestsApi.unhide,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
    },
  })
}

export const useBulkHideRequests = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestsApi.bulkHide,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
    },
  })
}

export const useBulkUnhideRequests = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestsApi.bulkUnhide,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
    },
  })
}

export const useBulkDeleteRequests = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestsApi.bulkDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
    },
  })
}
