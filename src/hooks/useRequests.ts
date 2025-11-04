import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requestsApi, UpdateRequestInput, RequestFilters } from '@/services/api/requests'
import { RequestStatus, DM329Status } from '@/types'

export const REQUESTS_QUERY_KEY = ['requests']

export const useRequests = (filters?: RequestFilters) => {
  return useQuery({
    queryKey: [...REQUESTS_QUERY_KEY, filters],
    queryFn: () => requestsApi.getAll(filters),
  })
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
