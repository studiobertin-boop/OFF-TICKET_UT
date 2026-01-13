import { StatoFattura } from './index'

export interface BillingReportData {
  [requestType: string]: BillingRequestItem[]
}

export interface BillingRequestItem {
  id: string
  title: string
  status: string
  stato_fattura: StatoFattura
  closed_date: string // Data chiusura effettiva (updated_at o da history)
  customer: {
    company_name?: string
    first_name?: string
    last_name?: string
  }
  request_type: {
    name: string
  }
  off_cac?: string // Per pratiche DM329: 'off' o 'cac'
}

export interface BillingReportFilters {
  dateFrom: string
  dateTo: string
}
