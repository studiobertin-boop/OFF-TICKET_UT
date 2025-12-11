/**
 * React Query Hooks for Manufacturers
 *
 * Custom hooks per gestire lo stato dei costruttori con TanStack Query.
 * Pattern identico a useCustomers.ts
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { manufacturersApi } from '@/services/api/manufacturers'
import {
  CreateManufacturerInput,
  UpdateManufacturerInput,
  ManufacturerFilters,
} from '@/types/manufacturer'

export const MANUFACTURERS_QUERY_KEY = ['manufacturers']

/**
 * Get all manufacturers with optional filters
 * Supports pagination, search, tipo (italiano/estero), stato (attivo/inattivo)
 */
export const useManufacturers = (filters?: ManufacturerFilters) => {
  return useQuery({
    queryKey: [...MANUFACTURERS_QUERY_KEY, filters],
    queryFn: () => manufacturersApi.getAll(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes - manufacturers don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  })
}

/**
 * Get single manufacturer by ID
 */
export const useManufacturer = (id: string) => {
  return useQuery({
    queryKey: [...MANUFACTURERS_QUERY_KEY, id],
    queryFn: () => manufacturersApi.getById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Get manufacturers by nome (for autocomplete)
 */
export const useManufacturerByNome = (nome: string) => {
  return useQuery({
    queryKey: [...MANUFACTURERS_QUERY_KEY, 'search', nome],
    queryFn: () => manufacturersApi.getByNome(nome),
    enabled: !!nome && nome.trim().length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes for search results
  })
}

/**
 * Create new manufacturer
 * Invalidates all manufacturer queries on success
 */
export const useCreateManufacturer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateManufacturerInput) => manufacturersApi.create(input),
    onSuccess: () => {
      // Invalidate all manufacturer queries to refetch data
      queryClient.invalidateQueries({ queryKey: MANUFACTURERS_QUERY_KEY })
    },
  })
}

/**
 * Update manufacturer
 * Invalidates all manufacturer queries on success
 */
export const useUpdateManufacturer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateManufacturerInput }) =>
      manufacturersApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MANUFACTURERS_QUERY_KEY })
    },
  })
}

/**
 * Soft delete manufacturer (set is_active to false)
 * Invalidates all manufacturer queries on success
 */
export const useDeleteManufacturer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => manufacturersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MANUFACTURERS_QUERY_KEY })
    },
  })
}

/**
 * Check manufacturer completeness
 * Uses database function to verify if all required fields are populated
 */
export const useManufacturerCompleteness = (id: string) => {
  return useQuery({
    queryKey: [...MANUFACTURERS_QUERY_KEY, id, 'completeness'],
    queryFn: () => manufacturersApi.checkCompleteness(id),
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minute - completeness may change as user edits
  })
}

/**
 * Find potential duplicate manufacturers using fuzzy matching
 */
export const useFindDuplicateManufacturers = (manufacturerName: string, threshold?: number) => {
  return useQuery({
    queryKey: [...MANUFACTURERS_QUERY_KEY, 'duplicates', manufacturerName, threshold],
    queryFn: () => manufacturersApi.findDuplicates(manufacturerName, threshold),
    enabled: !!manufacturerName && manufacturerName.trim().length > 0,
    staleTime: 0, // Always fetch fresh duplicate data
  })
}
