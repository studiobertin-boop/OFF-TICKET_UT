import { supabase } from '../supabase';
import type { RequestStatus, DM329Status } from '../../types';

// Filtri per analytics generale (ESCLUDE DM329)
export interface GeneralAnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: RequestStatus;
  requestTypeId?: string;
  assignedTo?: string;
  userId?: string; // Per filtro tecnico (solo assegnate)
}

// Filtri per analytics DM329 (SOLO DM329)
export interface DM329AnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: DM329Status;
  userId?: string; // Per filtro tecnico
}

// Response types
export interface StatusMetric {
  status: string;
  count: number;
  label: string;
}

export interface TypeMetric {
  type_id: string;
  type_name: string;
  count: number;
}

export interface TecnicoMetric {
  tecnico_id: string;
  tecnico_name: string;
  count: number;
}

export interface TrendDataPoint {
  date: string;
  count: number;
}

export interface OverviewMetrics {
  totalRequests: number;
  openRequests: number;
  inProgressRequests: number;
  completedRequests: number;
}

export interface ClientMetric {
  cliente: string;
  count: number;
}

// ============================================
// ANALYTICS GENERALE (ESCLUSO DM329)
// ============================================

export const generalAnalyticsApi = {
  /**
   * Metriche overview (totale, aperte, in lavorazione, completate)
   * ESCLUDE richieste DM329
   */
  async getOverview(filters: GeneralAnalyticsFilters = {}): Promise<OverviewMetrics> {
    let query = supabase
      .from('requests')
      .select('status, request_type:request_types!inner(name)', { count: 'exact' });

    // ESCLUDI DM329
    query = query.neq('request_type.name', 'DM329');

    // Filtri data
    if (filters.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('created_at', filters.dateTo);
    }

    // Filtro tipo
    if (filters.requestTypeId) {
      query = query.eq('request_type_id', filters.requestTypeId);
    }

    // Filtro assegnatario
    if (filters.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }

    // Filtro per tecnico (solo assegnate + create da lui)
    if (filters.userId) {
      query = query.or(`assigned_to.eq.${filters.userId},created_by.eq.${filters.userId}`);
    }

    const { data, count, error } = await query;

    if (error) throw error;

    const totalRequests = count || 0;
    const openRequests = data?.filter(r => r.status === 'APERTA').length || 0;
    const inProgressRequests = data?.filter(r =>
      r.status === 'ASSEGNATA' ||
      r.status === 'IN_LAVORAZIONE' ||
      r.status === 'INFO_NECESSARIE' ||
      r.status === 'INFO_TRASMESSE'
    ).length || 0;
    const completedRequests = data?.filter(r => r.status === 'COMPLETATA').length || 0;

    return {
      totalRequests,
      openRequests,
      inProgressRequests,
      completedRequests,
    };
  },

  /**
   * Distribuzione richieste per stato
   * ESCLUDE DM329
   */
  async getByStatus(filters: GeneralAnalyticsFilters = {}): Promise<StatusMetric[]> {
    let query = supabase
      .from('requests')
      .select('status, request_type:request_types!inner(name)');

    // ESCLUDI DM329
    query = query.neq('request_type.name', 'DM329');

    // Filtri
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
    if (filters.requestTypeId) query = query.eq('request_type_id', filters.requestTypeId);
    if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
    if (filters.userId) {
      query = query.or(`assigned_to.eq.${filters.userId},created_by.eq.${filters.userId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Aggregazione manuale
    const statusCounts = new Map<RequestStatus, number>();
    data?.forEach(req => {
      const current = statusCounts.get(req.status as RequestStatus) || 0;
      statusCounts.set(req.status as RequestStatus, current + 1);
    });

    return Array.from(statusCounts.entries()).map(([status, count]) => ({
      status,
      count,
      label: getStatusLabel(status),
    }));
  },

  /**
   * Distribuzione richieste per tipo
   * ESCLUDE DM329
   */
  async getByType(filters: GeneralAnalyticsFilters = {}): Promise<TypeMetric[]> {
    let query = supabase
      .from('requests')
      .select('request_type_id, request_type:request_types!inner(id, name)');

    // ESCLUDI DM329
    query = query.neq('request_type.name', 'DM329');

    // Filtri
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
    if (filters.userId) {
      query = query.or(`assigned_to.eq.${filters.userId},created_by.eq.${filters.userId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Aggregazione
    const typeCounts = new Map<string, { name: string; count: number }>();
    data?.forEach(req => {
      const typeId = req.request_type_id;
      const typeName = (req.request_type as any)?.name || 'Unknown';
      const current = typeCounts.get(typeId) || { name: typeName, count: 0 };
      typeCounts.set(typeId, { ...current, count: current.count + 1 });
    });

    return Array.from(typeCounts.entries()).map(([type_id, { name, count }]) => ({
      type_id,
      type_name: name,
      count,
    }));
  },

  /**
   * Distribuzione richieste per tecnico assegnato
   * ESCLUDE DM329
   */
  async getByTecnico(filters: GeneralAnalyticsFilters = {}): Promise<TecnicoMetric[]> {
    let query = supabase
      .from('requests')
      .select('assigned_to, assigned_user:users!requests_assigned_to_fkey(id, full_name), request_type:request_types!inner(name)')
      .not('assigned_to', 'is', null);

    // ESCLUDI DM329
    query = query.neq('request_type.name', 'DM329');

    // Filtri
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.requestTypeId) query = query.eq('request_type_id', filters.requestTypeId);
    if (filters.userId) {
      query = query.or(`assigned_to.eq.${filters.userId},created_by.eq.${filters.userId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Aggregazione
    const tecnicoCounts = new Map<string, { name: string; count: number }>();
    data?.forEach(req => {
      const tecnicoId = req.assigned_to!;
      const tecnicoName = (req.assigned_user as any)?.full_name || 'Unknown';
      const current = tecnicoCounts.get(tecnicoId) || { name: tecnicoName, count: 0 };
      tecnicoCounts.set(tecnicoId, { ...current, count: current.count + 1 });
    });

    return Array.from(tecnicoCounts.entries()).map(([tecnico_id, { name, count }]) => ({
      tecnico_id,
      tecnico_name: name,
      count,
    }));
  },

  /**
   * Trend richieste nel tempo (line chart)
   * ESCLUDE DM329
   */
  async getTrend(
    range: 'week' | 'month' | 'year',
    filters: GeneralAnalyticsFilters = {}
  ): Promise<TrendDataPoint[]> {
    let query = supabase
      .from('requests')
      .select('created_at, request_type:request_types!inner(name)');

    // ESCLUDI DM329
    query = query.neq('request_type.name', 'DM329');

    // Filtri
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.requestTypeId) query = query.eq('request_type_id', filters.requestTypeId);
    if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo);
    if (filters.userId) {
      query = query.or(`assigned_to.eq.${filters.userId},created_by.eq.${filters.userId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Aggregazione per range
    const trendMap = new Map<string, number>();
    data?.forEach(req => {
      const date = new Date(req.created_at);
      let key: string;

      switch (range) {
        case 'week':
          // Settimana ISO (lunedì)
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay() + 1);
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = String(date.getFullYear());
          break;
      }

      trendMap.set(key, (trendMap.get(key) || 0) + 1);
    });

    return Array.from(trendMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },
};

// ============================================
// ANALYTICS DM329 (SOLO DM329)
// ============================================

export const dm329AnalyticsApi = {
  /**
   * Metriche overview DM329
   * SOLO richieste DM329
   */
  async getOverview(filters: DM329AnalyticsFilters = {}): Promise<OverviewMetrics> {
    let query = supabase
      .from('requests')
      .select('status, request_type:request_types!inner(name)', { count: 'exact' })
      .eq('request_type.name', 'DM329'); // SOLO DM329

    // Filtri data
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
    if (filters.userId) {
      query = query.or(`assigned_to.eq.${filters.userId},created_by.eq.${filters.userId}`);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    const totalRequests = count || 0;
    const openRequests = data?.filter(r => r.status === '1-INCARICO_RICEVUTO').length || 0;
    const inProgressRequests = data?.filter(r =>
      ['2-SCHEDA_DATI_PRONTA', '3-MAIL_CLIENTE_INVIATA', '4-DOCUMENTI_PRONTI', '5-ATTESA_FIRMA'].includes(r.status)
    ).length || 0;
    const completedRequests = data?.filter(r => r.status === '7-CHIUSA').length || 0;

    return {
      totalRequests,
      openRequests,
      inProgressRequests,
      completedRequests,
    };
  },

  /**
   * Distribuzione per stato DM329
   */
  async getByStatus(filters: DM329AnalyticsFilters = {}): Promise<StatusMetric[]> {
    let query = supabase
      .from('requests')
      .select('status, request_type:request_types!inner(name)')
      .eq('request_type.name', 'DM329');

    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
    if (filters.userId) {
      query = query.or(`assigned_to.eq.${filters.userId},created_by.eq.${filters.userId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const statusCounts = new Map<DM329Status, number>();
    data?.forEach(req => {
      const current = statusCounts.get(req.status as DM329Status) || 0;
      statusCounts.set(req.status as DM329Status, current + 1);
    });

    return Array.from(statusCounts.entries()).map(([status, count]) => ({
      status,
      count,
      label: getDM329StatusLabel(status),
    }));
  },

  /**
   * Distribuzione per tecnico assegnato (DM329)
   */
  async getByTecnico(filters: DM329AnalyticsFilters = {}): Promise<TecnicoMetric[]> {
    let query = supabase
      .from('requests')
      .select('assigned_to, assigned_user:users!requests_assigned_to_fkey(id, full_name), request_type:request_types!inner(name)')
      .eq('request_type.name', 'DM329')
      .not('assigned_to', 'is', null);

    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
    if (filters.userId) {
      query = query.or(`assigned_to.eq.${filters.userId},created_by.eq.${filters.userId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const tecnicoCounts = new Map<string, { name: string; count: number }>();
    data?.forEach(req => {
      const tecnicoId = req.assigned_to!;
      const tecnicoName = (req.assigned_user as any)?.full_name || 'Unknown';
      const current = tecnicoCounts.get(tecnicoId) || { name: tecnicoName, count: 0 };
      tecnicoCounts.set(tecnicoId, { ...current, count: current.count + 1 });
    });

    return Array.from(tecnicoCounts.entries()).map(([tecnico_id, { name, count }]) => ({
      tecnico_id,
      tecnico_name: name,
      count,
    }));
  },

  /**
   * Trend DM329 nel tempo
   */
  async getTrend(
    range: 'week' | 'month' | 'year',
    filters: DM329AnalyticsFilters = {}
  ): Promise<TrendDataPoint[]> {
    let query = supabase
      .from('requests')
      .select('created_at, request_type:request_types!inner(name)')
      .eq('request_type.name', 'DM329');

    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
    if (filters.userId) {
      query = query.or(`assigned_to.eq.${filters.userId},created_by.eq.${filters.userId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const trendMap = new Map<string, number>();
    data?.forEach(req => {
      const date = new Date(req.created_at);
      let key: string;

      switch (range) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay() + 1);
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = String(date.getFullYear());
          break;
      }

      trendMap.set(key, (trendMap.get(key) || 0) + 1);
    });

    return Array.from(trendMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  /**
   * Top clienti DM329 (per numero richieste)
   */
  async getTopClients(filters: DM329AnalyticsFilters = {}): Promise<ClientMetric[]> {
    let query = supabase
      .from('requests')
      .select('custom_fields, request_type:request_types!inner(name)')
      .eq('request_type.name', 'DM329');

    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo);
    if (filters.userId) {
      query = query.or(`assigned_to.eq.${filters.userId},created_by.eq.${filters.userId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Estrai cliente da custom_fields
    const clientCounts = new Map<string, number>();
    data?.forEach(req => {
      const cliente = (req.custom_fields as any)?.cliente || 'Non specificato';
      clientCounts.set(cliente, (clientCounts.get(cliente) || 0) + 1);
    });

    return Array.from(clientCounts.entries())
      .map(([cliente, count]) => ({ cliente, count }))
      .sort((a, b) => b.count - a.count) // Ordina decrescente
      .slice(0, 10); // Top 10
  },
};

// ============================================
// HELPERS
// ============================================

function getStatusLabel(status: RequestStatus): string {
  const labels: Record<RequestStatus, string> = {
    APERTA: 'Aperta',
    ASSEGNATA: 'Assegnata',
    IN_LAVORAZIONE: 'In Lavorazione',
    INFO_NECESSARIE: 'Info Necessarie',
    INFO_TRASMESSE: 'Info Trasmesse',
    COMPLETATA: 'Completata',
    SOSPESA: 'Sospesa',
    ABORTITA: 'Abortita',
  };
  return labels[status] || status;
}

function getDM329StatusLabel(status: DM329Status): string {
  const labels: Record<DM329Status, string> = {
    '1-INCARICO_RICEVUTO': '1 - Incarico Ricevuto',
    '2-SCHEDA_DATI_PRONTA': '2 - Scheda Dati Pronta',
    '3-MAIL_CLIENTE_INVIATA': '3 - Mail Cliente Inviata',
    '4-DOCUMENTI_PRONTI': '4 - Documenti Pronti',
    '5-ATTESA_FIRMA': '5 - Attesa Firma',
    '6-PRONTA_PER_CIVA': '6 - Pronta per CIVA',
    '7-CHIUSA': '7 - Chiusa',
  };
  return labels[status] || status;
}
