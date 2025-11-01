import { useQuery } from '@tanstack/react-query';
import {
  generalAnalyticsApi,
  dm329AnalyticsApi,
  type GeneralAnalyticsFilters,
  type DM329AnalyticsFilters,
} from '../services/api/analytics';

// ============================================
// HOOKS ANALYTICS GENERALE (ESCLUSO DM329)
// ============================================

export function useGeneralOverview(filters: GeneralAnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'general', 'overview', filters],
    queryFn: () => generalAnalyticsApi.getOverview(filters),
    staleTime: 30000, // 30 secondi
  });
}

export function useGeneralByStatus(filters: GeneralAnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'general', 'status', filters],
    queryFn: () => generalAnalyticsApi.getByStatus(filters),
    staleTime: 30000,
  });
}

export function useGeneralByType(filters: GeneralAnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'general', 'type', filters],
    queryFn: () => generalAnalyticsApi.getByType(filters),
    staleTime: 30000,
  });
}

export function useGeneralByTecnico(filters: GeneralAnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'general', 'tecnico', filters],
    queryFn: () => generalAnalyticsApi.getByTecnico(filters),
    staleTime: 30000,
  });
}

export function useGeneralTrend(
  range: 'week' | 'month' | 'year',
  filters: GeneralAnalyticsFilters = {}
) {
  return useQuery({
    queryKey: ['analytics', 'general', 'trend', range, filters],
    queryFn: () => generalAnalyticsApi.getTrend(range, filters),
    staleTime: 30000,
  });
}

// ============================================
// HOOKS ANALYTICS DM329 (SOLO DM329)
// ============================================

export function useDM329Overview(filters: DM329AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'dm329', 'overview', filters],
    queryFn: () => dm329AnalyticsApi.getOverview(filters),
    staleTime: 30000,
  });
}

export function useDM329ByStatus(filters: DM329AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'dm329', 'status', filters],
    queryFn: () => dm329AnalyticsApi.getByStatus(filters),
    staleTime: 30000,
  });
}

export function useDM329ByTecnico(filters: DM329AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'dm329', 'tecnico', filters],
    queryFn: () => dm329AnalyticsApi.getByTecnico(filters),
    staleTime: 30000,
  });
}

export function useDM329Trend(
  range: 'week' | 'month' | 'year',
  filters: DM329AnalyticsFilters = {}
) {
  return useQuery({
    queryKey: ['analytics', 'dm329', 'trend', range, filters],
    queryFn: () => dm329AnalyticsApi.getTrend(range, filters),
    staleTime: 30000,
  });
}

export function useDM329TopClients(filters: DM329AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'dm329', 'clients', filters],
    queryFn: () => dm329AnalyticsApi.getTopClients(filters),
    staleTime: 30000,
  });
}
