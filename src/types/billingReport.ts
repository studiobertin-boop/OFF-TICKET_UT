import { BillingReportRow } from '@/utils/billingReportRows'

export type BillingReportData = BillingReportRow[]

export interface BillingReportFilters {
  dateFrom: string
  dateTo: string
}
