import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customersApi, CreateCustomerInput, UpdateCustomerInput, CustomerFilters } from '@/services/api/customers'

export const CUSTOMERS_QUERY_KEY = ['customers']

// Get all customers with optional search filter
export const useCustomers = (filters?: CustomerFilters) => {
  return useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, filters],
    queryFn: () => customersApi.getAll(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes - customers don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes cache (previously cacheTime)
  })
}

// Get single customer by ID
export const useCustomer = (id: string) => {
  return useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, id],
    queryFn: () => customersApi.getById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

// Create new customer
export const useCreateCustomer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateCustomerInput) => customersApi.create(input),
    onSuccess: () => {
      // Invalidate all customer queries to refetch data
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
    },
  })
}

// Update customer
export const useUpdateCustomer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateCustomerInput }) =>
      customersApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
    },
  })
}

// Soft delete customer
export const useDeleteCustomer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
    },
  })
}

// Find duplicate customers
export const useFindDuplicates = (customerName: string, threshold?: number) => {
  return useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, 'duplicates', customerName, threshold],
    queryFn: () => customersApi.findDuplicates(customerName, threshold),
    enabled: !!customerName && customerName.trim().length > 0,
    staleTime: 0, // Always fetch fresh duplicate data
  })
}

// Merge duplicate customers
export const useMergeCustomers = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ keepId, mergeIds }: { keepId: string; mergeIds: string[] }) =>
      customersApi.merge(keepId, mergeIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['requests'] }) // Also invalidate requests since they reference customers
    },
  })
}

// Sync customers from external Supabase project
export const useSyncCustomers = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => customersApi.syncFromExternal(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY })
    },
  })
}
