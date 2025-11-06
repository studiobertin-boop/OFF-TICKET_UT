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

export function useGeneralByRequester(filters: GeneralAnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'general', 'requester', filters],
    queryFn: () => generalAnalyticsApi.getByRequester(filters),
    staleTime: 30000,
  });
}

export function useGeneralAvgCompletionTime(filters: GeneralAnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'general', 'avgCompletionTime', filters],
    queryFn: () => generalAnalyticsApi.getAvgCompletionTime(filters),
    staleTime: 30000,
  });
}

export function useGeneralCompletionTimeTrend(
  range: 'day' | 'week' | 'month' | 'year',
  filters: GeneralAnalyticsFilters = {}
) {
  return useQuery({
    queryKey: ['analytics', 'general', 'completionTimeTrend', range, filters],
    queryFn: () => generalAnalyticsApi.getCompletionTimeTrend(range, filters),
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

export function useDM329AvgCompletionTime(filters: DM329AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'dm329', 'avgCompletionTime', filters],
    queryFn: () => dm329AnalyticsApi.getAvgCompletionTime(filters),
    staleTime: 30000,
  });
}

export function useDM329CompletionTimeTrend(
  range: 'day' | 'week' | 'month' | 'year',
  filters: DM329AnalyticsFilters = {}
) {
  return useQuery({
    queryKey: ['analytics', 'dm329', 'completionTimeTrend', range, filters],
    queryFn: () => dm329AnalyticsApi.getCompletionTimeTrend(range, filters),
    staleTime: 30000,
  });
}

export function useDM329TransitionTimes(filters: DM329AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'dm329', 'transitionTimes', filters],
    queryFn: () => dm329AnalyticsApi.getTransitionTimes(filters),
    staleTime: 30000,
  });
}
