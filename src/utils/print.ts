import { Request } from '@/types'
import { getStatusLabel } from './workflow'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

interface PrintTableColumn {
  header: string
  getValue: (request: Request) => string | number | boolean
  align?: 'left' | 'center' | 'right'
}

interface PrintTableOptions {
  title: string
  columns: PrintTableColumn[]
  data: Request[]
  metadata?: {
    totalRecords: number
    filteredRecords: number
    filters?: string[]
  }
}

/**
 * Generates HTML for printing a table
 */
export const generatePrintHTML = (options: PrintTableOptions): string => {
  const { title, columns, data, metadata } = options

  const metadataHTML = metadata
    ? `
    <div class="print-metadata">
      <p><strong>Data stampa:</strong> ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: it })}</p>
      <p><strong>Record totali:</strong> ${metadata.totalRecords} | <strong>Record visualizzati:</strong> ${metadata.filteredRecords}</p>
      ${metadata.filters && metadata.filters.length > 0 ? `<p><strong>Filtri attivi:</strong> ${metadata.filters.join(', ')}</p>` : ''}
    </div>
  `
    : ''

  const tableHeaders = columns
    .map(col => `<th style="text-align: ${col.align || 'left'}">${col.header}</th>`)
    .join('')

  const tableRows = data
    .map(
      request => `
    <tr class="${request.is_blocked ? 'blocked-row' : ''}">
      ${columns
        .map(col => {
          const value = col.getValue(request)
          return `<td style="text-align: ${col.align || 'left'}">${value !== null && value !== undefined ? value : '-'}</td>`
        })
        .join('')}
    </tr>
  `
    )
    .join('')

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 1cm;
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
          }
          h1 {
            font-size: 18pt;
            margin-bottom: 10px;
          }
          .print-metadata {
            margin-bottom: 15px;
            font-size: 10pt;
            color: #666;
          }
          .print-metadata p {
            margin: 5px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
          }
          th, td {
            border: 1px solid #333;
            padding: 4px 6px;
            text-align: left;
          }
          th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          .blocked-row {
            background-color: #fff3cd;
          }
          .chip {
            display: inline-block;
            padding: 2px 8px;
            border: 1px solid #333;
            border-radius: 12px;
            font-size: 8pt;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        ${metadataHTML}
        <table>
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
    </html>
  `
}

/**
 * Opens a new window with the provided HTML content and triggers print dialog
 */
export const printHTML = (html: string) => {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Per favore abilita i popup per stampare')
    return
  }

  printWindow.document.write(html)
  printWindow.document.close()

  // Wait for content to load before printing
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()

    // Close immediately after print() is called
    // The print dialog will stay open even if we close the window
    // This ensures the window closes regardless of user action (print or cancel)
    printWindow.close()
  }
}

/**
 * Helper to format cliente field
 */
export const formatClienteField = (request: Request): string => {
  const cliente = request.custom_fields?.cliente
  if (typeof cliente === 'string') return cliente
  if (cliente && typeof cliente === 'object' && 'ragione_sociale' in cliente) {
    return cliente.ragione_sociale
  }
  return '-'
}

/**
 * Helper to format date field
 */
export const formatDateField = (date: string): string => {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: it })
}

/**
 * Helper to format boolean as checkmark
 */
export const formatBooleanField = (value: boolean): string => {
  return value ? '✓' : ''
}

/**
 * Create filter description from active filters
 */
export const createFilterDescription = (filters: {
  tipoFilter?: string[]
  clienteFilter?: string[]
  statoFilter?: string[]
  creatorFilter?: string[]
  noCivaFilter?: 'all' | 'true' | 'false'
  noteFilter?: string
}): string[] => {
  const descriptions: string[] = []

  if (filters.tipoFilter && filters.tipoFilter.length > 0) {
    descriptions.push(`Tipi: ${filters.tipoFilter.join(', ')}`)
  }
  if (filters.clienteFilter && filters.clienteFilter.length > 0) {
    descriptions.push(`Clienti: ${filters.clienteFilter.length} selezionati`)
  }
  if (filters.statoFilter && filters.statoFilter.length > 0) {
    descriptions.push(`Stati: ${filters.statoFilter.map(s => getStatusLabel(s as any)).join(', ')}`)
  }
  if (filters.creatorFilter && filters.creatorFilter.length > 0) {
    descriptions.push(`Creatori: ${filters.creatorFilter.join(', ')}`)
  }
  if (filters.noCivaFilter && filters.noCivaFilter !== 'all') {
    descriptions.push(`No CIVA: ${filters.noCivaFilter === 'true' ? 'Sì' : 'No'}`)
  }
  if (filters.noteFilter) {
    descriptions.push(`Note: "${filters.noteFilter}"`)
  }

  return descriptions
}
