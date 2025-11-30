import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { ExportRequestData } from '../types'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

/**
 * Genera e scarica un file Excel con i dati delle richieste esportate
 */
export function exportRequestsToExcel(
  data: ExportRequestData[],
  requestType: 'DM329' | 'GENERALE',
  filters: { dateFrom: string; dateTo: string; statuses: string[] }
): void {
  if (data.length === 0) {
    throw new Error('Nessun dato da esportare')
  }

  // Prepara i dati per Excel
  const excelData = data.map((row) => {
    const baseRow = {
      'NOME CLIENTE': row.nomeCliente,
      'DATA IMPOSTAZIONE STATO': row.dataImpostazioneStato,
      'STATO IMPOSTATO': row.statoImpostato,
      'TIPO DI RICHIESTA': row.tipoRichiesta,
    }

    // Aggiungi colonne specifiche per DM329
    if (requestType === 'DM329') {
      return {
        ...baseRow,
        'NO CIVA': row.noCiva ? 'Sì' : 'No',
        'OFF/CAC': row.offCac || '-',
        'NOTE': row.note || '-',
      }
    }

    // Per richieste generali, aggiungi solo NOTE
    return {
      ...baseRow,
      'NOTE': row.note || '-',
    }
  })

  // Crea il worksheet
  const worksheet = XLSX.utils.json_to_sheet(excelData)

  // Imposta larghezza colonne
  const columnWidths = [
    { wch: 35 }, // NOME CLIENTE
    { wch: 20 }, // DATA IMPOSTAZIONE STATO
    { wch: 30 }, // STATO IMPOSTATO
    { wch: 25 }, // TIPO DI RICHIESTA
  ]

  if (requestType === 'DM329') {
    columnWidths.push(
      { wch: 10 }, // NO CIVA
      { wch: 10 }, // OFF/CAC
      { wch: 40 }  // NOTE
    )
  } else {
    columnWidths.push({ wch: 40 }) // NOTE
  }

  worksheet['!cols'] = columnWidths

  // Crea il workbook
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Richieste')

  // Genera il file Excel
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  // Genera nome file con data e filtri
  const today = format(new Date(), 'yyyy-MM-dd', { locale: it })
  const statusesStr = filters.statuses.length > 3
    ? `${filters.statuses.length}_stati`
    : filters.statuses.join('_').replace(/[^a-zA-Z0-9_-]/g, '_')

  const fileName = `Export_${requestType}_${filters.dateFrom}_${filters.dateTo}_${statusesStr}_${today}.xlsx`

  // Scarica il file
  saveAs(blob, fileName)
}

/**
 * Formatta una data ISO per visualizzazione in Excel
 */
export function formatDateForExcel(isoDate: string | null): string {
  if (!isoDate) return '-'

  try {
    return format(new Date(isoDate), 'dd/MM/yyyy HH:mm', { locale: it })
  } catch {
    return '-'
  }
}
