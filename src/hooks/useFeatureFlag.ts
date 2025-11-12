import { useQuery } from '@tanstack/react-query'
import { featureFlagsApi } from '../services/api/featureFlags'

/**
 * Hook per verificare lo stato di un feature flag
 * @param flagName Nome del feature flag
 * @returns Oggetto con isEnabled e loading state
 */
export const useFeatureFlag = (flagName: string) => {
  const {
    data: isEnabled = false,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['featureFlag', flagName],
    queryFn: () => featureFlagsApi.isEnabled(flagName),
    staleTime: 5 * 60 * 1000, // Cache per 5 minuti
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 1, // Riprova 1 volta in caso di errore
  })

  return {
    isEnabled,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook per ottenere tutti i feature flags (per admin panel)
 * @returns Array di FeatureFlag con loading/error states
 */
export const useAllFeatureFlags = () => {
  const {
    data: flags = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['featureFlags'],
    queryFn: () => featureFlagsApi.getAll(),
    staleTime: 2 * 60 * 1000, // Cache per 2 minuti
    gcTime: 5 * 60 * 1000,
  })

  return {
    flags,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook per ottenere mappa di feature flags
 * Utile quando si devono controllare più feature flags contemporaneamente
 * @returns Map<flagName, isEnabled> con loading/error states
 */
export const useFeatureFlagsMap = () => {
  const {
    data: flagsMap = new Map(),
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['featureFlagsMap'],
    queryFn: () => featureFlagsApi.getAllAsMap(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  return {
    flagsMap,
    isEnabled: (flagName: string) => flagsMap.get(flagName) ?? false,
    isLoading,
    error,
    refetch,
  }
}
