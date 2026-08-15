import { supabase } from '@/services/supabase'
import { BillingReportData } from '@/types/billingReport'
import { StatoFattura, Request } from '@/types'
import { composeCodicePratica, computeClientSalaCounts } from '@/utils/practiceCode'
import { buildBillingReportRow, sortBillingReportRows } from '@/utils/billingReportRows'

// Helper: nome cliente. Priorità al cliente collegato (customers.ragione_sociale);
// custom_fields.cliente resta il ripiego per le pratiche non collegate (import CSV).
const getCustomerName = (
  customer: { ragione_sociale?: string | null } | null | undefined,
  customFieldsCliente: unknown
): string => {
  if (customer?.ragione_sociale) return customer.ragione_sociale
  if (typeof customFieldsCliente === 'string' && customFieldsCliente) return customFieldsCliente
  if (customFieldsCliente && typeof customFieldsCliente === 'object') {
    const c = customFieldsCliente as Record<string, string | undefined>
    const nome = c.ragione_sociale || c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ')
    if (nome) return nome
  }
  return 'N/A'
}

export const billingReportsApi = {
  /**
   * Fetch richieste chiuse non fatturate (stato fattura "NO") nel periodo specificato,
   * già raggruppate e ordinate secondo le regole del report fatturazione.
   */
  getUnbilledClosedRequests: async (
    dateFrom: string,
    dateTo: string
  ): Promise<BillingReportData> => {
    // NOTA: escluso "ARCHIVIATA NON FINITA" dal report
    const { data, error } = await supabase
      .from('requests')
      .select(`
        id,
        title,
        status,
        custom_fields,
        updated_at,
        customer_id,
        sala_lettera,
        progressivo,
        anno,
        customer:customers(id, ragione_sociale, identificativo),
        request_type:request_types(id, name)
      `)
      .or('status.eq.COMPLETATA,status.eq.ABORTITA,status.eq.7-CHIUSA')
      .gte('updated_at', `${dateFrom}T00:00:00`)
      .lte('updated_at', `${dateTo}T23:59:59`)
      // requests.request_type_id è una FK NOT NULL verso request_types (relazione
      // many-to-one), e requests.customer_id verso customers (many-to-one, nullable).
      // Il client Supabase è creato senza i tipi generati del Database, perciò non
      // può dedurre la cardinalità degli embed e li inferisce come array: qui
      // allineiamo il tipo alla forma effettiva della risposta.
      .overrideTypes<{
        request_type: { id: string; name: string } | null
        customer: { id: string; ragione_sociale: string; identificativo: string | null } | null
      }[]>()

    if (error) {
      console.error('Error fetching billing report:', error)
      throw new Error(`Errore nel caricamento del report: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return []
    }

    // Filtra per stato_fattura "NO" (client-side, dentro custom_fields)
    const unbilled = data.filter(r => {
      const statoFattura = (r.custom_fields?.stato_fattura as StatoFattura) || 'NO'
      return statoFattura === 'NO'
    })

    if (unbilled.length === 0) {
      return []
    }

    // Conteggio sale per cliente, necessario per comporre il codice pratica DM329:
    // interroga solo le pratiche primarie dei clienti coinvolti nel report.
    const customerIds = [...new Set(unbilled.map(r => r.customer_id).filter((id): id is string => !!id))]
    let salaCounts = new Map<string, number>()
    if (customerIds.length > 0) {
      const { data: salaRows, error: salaError } = await supabase
        .from('requests')
        .select('customer_id, sala_lettera, pratica_padre_id')
        .in('customer_id', customerIds)
        .is('pratica_padre_id', null)

      if (salaError) {
        console.error('Error fetching sala counts for billing report:', salaError)
      } else {
        salaCounts = computeClientSalaCounts((salaRows || []) as Request[])
      }
    }

    const rows = unbilled.map(r => {
      const codicePratica = composeCodicePratica({
        clientCode: r.customer?.identificativo,
        sala_lettera: r.sala_lettera,
        progressivo: r.progressivo,
        anno: r.anno,
        clientSalaCount: salaCounts.get(r.customer_id || '') || 0,
      })

      return buildBillingReportRow({
        id: r.id,
        requestTypeName: r.request_type?.name || 'N/A',
        codicePratica,
        customerName: getCustomerName(r.customer, r.custom_fields?.cliente),
        closedDate: r.updated_at,
        xFattura: r.custom_fields?.x_fattura as number | undefined,
        offCac: r.custom_fields?.off_cac as string | undefined,
      })
    })

    return sortBillingReportRows(rows)
  },
}
