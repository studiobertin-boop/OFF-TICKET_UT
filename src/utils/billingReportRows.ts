import { isDM329Family } from './workflow'

export type BillingReportGroup = 'ALTRO' | 'DM329_OFF' | 'DM329_CAC'

export interface BillingReportRow {
  id: string
  requestTypeName: string
  codicePratica: string
  customerName: string
  closedDate: string
  xFattura: number
  offCacDisplay: string
  group: BillingReportGroup
}

/**
 * Da dove va fatturata la pratica: non-DM329 e DM329-OFF (incluse le DM329 senza
 * off_cac valorizzato, mostrate con "???") vanno prima, le DM329-CAC per ultime.
 */
const GROUP_RANK: Record<BillingReportGroup, number> = {
  ALTRO: 0,
  DM329_OFF: 1,
  DM329_CAC: 2,
}

export interface BillingReportRowInput {
  id: string
  requestTypeName: string
  codicePratica: string
  customerName: string
  closedDate: string
  xFattura?: number | null
  offCac?: string | null
}

export function classifyBillingReportGroup(
  requestTypeName: string,
  offCac?: string | null
): { group: BillingReportGroup; offCacDisplay: string } {
  if (!isDM329Family(requestTypeName)) {
    return { group: 'ALTRO', offCacDisplay: '' }
  }
  if (offCac === 'cac') {
    return { group: 'DM329_CAC', offCacDisplay: 'CAC' }
  }
  if (offCac === 'off') {
    return { group: 'DM329_OFF', offCacDisplay: 'OFF' }
  }
  return { group: 'DM329_OFF', offCacDisplay: '???' }
}

export function buildBillingReportRow(input: BillingReportRowInput): BillingReportRow {
  const { group, offCacDisplay } = classifyBillingReportGroup(input.requestTypeName, input.offCac)
  return {
    id: input.id,
    requestTypeName: input.requestTypeName,
    codicePratica: input.codicePratica,
    customerName: input.customerName,
    closedDate: input.closedDate,
    xFattura: input.xFattura ?? 1,
    offCacDisplay,
    group,
  }
}

/**
 * Ordine di lettura del report: prima i tipi non-DM329, poi le DM329-OFF, infine
 * le DM329-CAC; dentro ogni blocco, per tipo pratica e poi per cliente (A→Z).
 */
export function sortBillingReportRows(rows: BillingReportRow[]): BillingReportRow[] {
  return [...rows].sort((a, b) =>
    GROUP_RANK[a.group] - GROUP_RANK[b.group] ||
    a.requestTypeName.localeCompare(b.requestTypeName, 'it') ||
    a.customerName.localeCompare(b.customerName, 'it')
  )
}
