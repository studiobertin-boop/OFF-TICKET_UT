import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { BillingReportRow } from '@/utils/billingReportRows'

const COLUMN_HEADERS = ['OFF/CAC', 'TIPO PRATICA', 'CODICE PRATICA', 'CLIENTE', 'DATA CHIUSURA', 'X FATTURA'] as const

const formatClosedDate = (isoDate: string): string => {
  try {
    return format(new Date(isoDate), 'dd/MM/yyyy', { locale: it })
  } catch {
    return isoDate
  }
}

const toReportFileBaseName = (dateFrom: string, dateTo: string): string => {
  const today = format(new Date(), 'yyyy-MM-dd', { locale: it })
  return `Report_Fatturazione_${dateFrom}_${dateTo}_${today}`
}

/**
 * Genera e scarica un file Excel con le righe del report fatturazione, già
 * ordinate secondo le regole di raggruppamento (non-DM329, poi DM329-OFF,
 * poi DM329-CAC; per tipo pratica e cliente all'interno di ciascun blocco).
 */
export function exportBillingReportToExcel(rows: BillingReportRow[], dateFrom: string, dateTo: string): void {
  if (rows.length === 0) {
    throw new Error('Nessun dato da esportare')
  }

  const excelData = rows.map(row => ({
    'OFF/CAC': row.offCacDisplay,
    'TIPO PRATICA': row.requestTypeName,
    'CODICE PRATICA': row.codicePratica,
    'CLIENTE': row.customerName,
    'DATA CHIUSURA': formatClosedDate(row.closedDate),
    'X FATTURA': row.xFattura,
  }))

  const worksheet = XLSX.utils.json_to_sheet(excelData)
  worksheet['!cols'] = [
    { wch: 10 }, // OFF/CAC
    { wch: 25 }, // TIPO PRATICA
    { wch: 20 }, // CODICE PRATICA
    { wch: 35 }, // CLIENTE
    { wch: 16 }, // DATA CHIUSURA
    { wch: 10 }, // X FATTURA
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fatturazione')

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  saveAs(blob, `${toReportFileBaseName(dateFrom, dateTo)}.xlsx`)
}

/**
 * Genera e scarica un file Word con le righe del report fatturazione: una
 * tabella HTML con bordi, salvata con MIME "application/msword" ed estensione
 * .doc — Word la apre come documento nativo, bordi e struttura inclusi, senza
 * bisogno di una libreria OOXML dedicata.
 */
export function exportBillingReportToWord(rows: BillingReportRow[], dateFrom: string, dateTo: string): void {
  if (rows.length === 0) {
    throw new Error('Nessun dato da esportare')
  }

  const escapeHtml = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const headerCells = COLUMN_HEADERS.map(h => `<th>${h}</th>`).join('')
  const bodyRows = rows.map(row => {
    const cells = [
      row.offCacDisplay,
      row.requestTypeName,
      row.codicePratica,
      row.customerName,
      formatClosedDate(row.closedDate),
      String(row.xFattura),
    ]
    return `<tr>${cells.map(c => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>Report Fatturazione</title>
<style>
  table { border-collapse: collapse; width: 100%; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  th, td { border: 1px solid #000000; padding: 4px 8px; text-align: left; }
  th { background-color: #DDDDDD; font-weight: bold; }
</style>
</head>
<body>
<h2>Report Fatturazione</h2>
<p>Periodo: ${escapeHtml(formatClosedDate(dateFrom))} - ${escapeHtml(formatClosedDate(dateTo))}</p>
<table>
<thead><tr>${headerCells}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
</body>
</html>`

  const blob = new Blob(['﻿', html], { type: 'application/msword' })
  saveAs(blob, `${toReportFileBaseName(dateFrom, dateTo)}.doc`)
}
