import { supabase } from '@/services/supabase'
import { BillingReportData, BillingRequestItem } from '@/types/billingReport'
import { StatoFattura } from '@/types'

// Helper function to get customer name
const getCustomerName = (customer: any): string => {
  if (!customer) return 'N/A'
  if (customer.company_name) return customer.company_name
  if (customer.first_name || customer.last_name) {
    return [customer.first_name, customer.last_name].filter(Boolean).join(' ')
  }
  return 'N/A'
}

export const billingReportsApi = {
  /**
   * Fetch richieste chiuse non fatturate nel periodo specificato
   * @param dateFrom - Data inizio periodo (formato YYYY-MM-DD)
   * @param dateTo - Data fine periodo (formato YYYY-MM-DD)
   * @returns BillingReportData - Richieste raggruppate per tipo
   */
  getUnbilledClosedRequests: async (
    dateFrom: string,
    dateTo: string
  ): Promise<BillingReportData> => {
    // Query Supabase per richieste chiuse nel periodo
    const { data, error } = await supabase
      .from('requests')
      .select(`
        id,
        title,
        status,
        custom_fields,
        updated_at,
        request_type:request_types(id, name)
      `)
      .or('status.eq.COMPLETATA,status.eq.ABORTITA,status.eq.7-CHIUSA,status.eq.ARCHIVIATA NON FINITA')
      .gte('updated_at', `${dateFrom}T00:00:00`)
      .lte('updated_at', `${dateTo}T23:59:59`)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching billing report:', error)
      throw new Error(`Errore nel caricamento del report: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return {}
    }

    // Filter by stato_fattura in custom_fields (client-side filter)
    const unbilled = data.filter(r => {
      const statoFattura = (r.custom_fields?.stato_fattura as StatoFattura) || 'NO'
      return statoFattura === 'NO' || statoFattura === 'AVVISO'
    })

    if (unbilled.length === 0) {
      return {}
    }

    // Transform to BillingRequestItem[]
    const items: BillingRequestItem[] = unbilled.map(r => {
      // Extract customer info from custom_fields
      const cliente = r.custom_fields?.cliente
      let customerInfo: any = {}

      if (typeof cliente === 'string') {
        customerInfo = { company_name: cliente }
      } else if (cliente && typeof cliente === 'object') {
        customerInfo = {
          company_name: (cliente as any).ragione_sociale || (cliente as any).company_name,
          first_name: (cliente as any).first_name,
          last_name: (cliente as any).last_name,
        }
      }

      return {
        id: r.id,
        title: r.title,
        status: r.status,
        stato_fattura: (r.custom_fields?.stato_fattura as StatoFattura) || 'NO',
        closed_date: r.updated_at,
        customer: customerInfo,
        request_type: {
          name: r.request_type?.name || 'N/A',
        },
      }
    })

    // Group by request_type
    const grouped: BillingReportData = {}
    items.forEach(item => {
      const typeName = item.request_type.name
      if (!grouped[typeName]) {
        grouped[typeName] = []
      }
      grouped[typeName].push(item)
    })

    // Sort alphabetically by customer within each group
    Object.keys(grouped).forEach(type => {
      grouped[type].sort((a, b) => {
        const customerA = getCustomerName(a.customer)
        const customerB = getCustomerName(b.customer)
        return customerA.localeCompare(customerB, 'it')
      })
    })

    return grouped
  },
}
