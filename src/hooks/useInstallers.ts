/**
 * React Query Hooks for Installers
 *
 * Custom hooks per gestione stato installers con TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { installersApi } from '@/services/api/installers'
import type {
  Installer,
  InstallerFilters,
  CreateInstallerInput,
  UpdateInstallerInput,
} from '@/types/installer'

// ================================================
// QUERY KEYS
// ================================================

export const INSTALLERS_QUERY_KEY = ['installers']

// ================================================
// QUERY HOOKS
// ================================================

/**
 * Hook per ottenere lista installers con filtri
 */
export const useInstallers = (filters?: InstallerFilters) => {
  return useQuery({
    queryKey: [...INSTALLERS_QUERY_KEY, filters],
    queryFn: () => installersApi.getAll(filters),
    staleTime: 5 * 60 * 1000, // 5 minuti
    gcTime: 10 * 60 * 1000, // 10 minuti (ex cacheTime)
  })
}

/**
 * Hook per ottenere singolo installer by ID
 */
export const useInstaller = (id: string) => {
  return useQuery({
    queryKey: [...INSTALLERS_QUERY_KEY, id],
    queryFn: () => installersApi.getById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook per ricerca installers by nome (per autocomplete)
 */
export const useInstallersByNome = (nome: string) => {
  return useQuery({
    queryKey: [...INSTALLERS_QUERY_KEY, 'search', nome],
    queryFn: () => installersApi.getByNome(nome),
    enabled: nome.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minuti
  })
}

/**
 * Hook per controllare completezza installer
 */
export const useInstallerCompleteness = (id: string) => {
  return useQuery({
    queryKey: [...INSTALLERS_QUERY_KEY, id, 'completeness'],
    queryFn: () => installersApi.checkCompleteness(id),
    enabled: !!id,
    staleTime: 1 * 60 * 1000, // 1 minuto
  })
}

// ================================================
// MUTATION HOOKS
// ================================================

/**
 * Hook per creare nuovo installer
 */
export const useCreateInstaller = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateInstallerInput) => installersApi.create(input),
    onSuccess: () => {
      // Invalida tutte le query installers per forzare refetch
      queryClient.invalidateQueries({ queryKey: INSTALLERS_QUERY_KEY })
    },
  })
}

/**
 * Hook per aggiornare installer esistente
 */
export const useUpdateInstaller = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateInstallerInput }) =>
      installersApi.update(id, updates),
    onSuccess: (data) => {
      // Invalida tutte le query installers
      queryClient.invalidateQueries({ queryKey: INSTALLERS_QUERY_KEY })
      // Aggiorna cache per questo specific installer
      queryClient.setQueryData([...INSTALLERS_QUERY_KEY, data.id], data)
    },
  })
}

/**
 * Hook per eliminare installer (soft delete)
 */
export const useDeleteInstaller = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => installersApi.delete(id),
    onSuccess: () => {
      // Invalida tutte le query installers
      queryClient.invalidateQueries({ queryKey: INSTALLERS_QUERY_KEY })
    },
  })
}

/**
 * Hook per hard delete installer (con cautela!)
 */
export const useHardDeleteInstaller = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => installersApi.hardDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INSTALLERS_QUERY_KEY })
    },
  })
}
