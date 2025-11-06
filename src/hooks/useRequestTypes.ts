import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requestTypesApi } from '@/services/api/requestTypes'
import { RequestType } from '@/types'

export const REQUEST_TYPES_QUERY_KEY = ['request-types']
export const ALL_REQUEST_TYPES_QUERY_KEY = ['request-types', 'all']

export const useRequestTypes = () => {
  return useQuery({
    queryKey: REQUEST_TYPES_QUERY_KEY,
    queryFn: requestTypesApi.getAll,
  })
}

export const useAllRequestTypes = () => {
  return useQuery({
    queryKey: ALL_REQUEST_TYPES_QUERY_KEY,
    queryFn: requestTypesApi.getAllForAdmin,
  })
}

export const useRequestType = (id: string) => {
  return useQuery({
    queryKey: [...REQUEST_TYPES_QUERY_KEY, id],
    queryFn: () => requestTypesApi.getById(id),
    enabled: !!id,
  })
}

export const useCreateRequestType = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestTypesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUEST_TYPES_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ALL_REQUEST_TYPES_QUERY_KEY })
    },
  })
}

export const useUpdateRequestType = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<RequestType> }) =>
      requestTypesApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUEST_TYPES_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ALL_REQUEST_TYPES_QUERY_KEY })
    },
  })
}

export const useDeactivateRequestType = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestTypesApi.deactivate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUEST_TYPES_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ALL_REQUEST_TYPES_QUERY_KEY })
    },
  })
}
