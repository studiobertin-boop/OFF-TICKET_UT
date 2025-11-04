import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Request, RequestHistory } from '../types'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

interface RequestWithHistory extends Request {
  history: RequestHistory[]
}

/**
 * Generates a PDF report of deleted requests with their status history
 * @param requests Array of requests with their history
 * @param deletionDate Date of deletion
 * @returns PDF blob
 */
export async function generateDeletionArchivePDF(
  requests: RequestWithHistory[],
  deletionDate: Date = new Date()
): Promise<Blob> {
  // Create PDF in landscape A4 format
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  })

  // Format deletion date
  const formattedDate = format(deletionDate, 'dd.MM.yyyy', { locale: it })

  // Add header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`PRATICHE ELIMINATE IL ${formattedDate}`, 148.5, 20, { align: 'center' })

  // Prepare table data
  const tableData = requests.map((request) => {
    // Get request type name
    const requestType = request.request_type?.name || 'N/A'

    // Format creation date
    const creationDate = format(new Date(request.created_at), 'dd/MM/yyyy HH:mm', { locale: it })

    // Find completion date from history (last status change to COMPLETATA or 7-CHIUSA)
    const completionHistory = request.history
      .filter(h => h.status_to === 'COMPLETATA' || h.status_to === '7-CHIUSA')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    const completionDate = completionHistory
      ? format(new Date(completionHistory.created_at), 'dd/MM/yyyy HH:mm', { locale: it })
      : 'N/A'

    // Build status history string
    const statusHistory = request.history
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(h => {
        const historyDate = format(new Date(h.created_at), 'dd/MM/yyyy HH:mm', { locale: it })
        const fromStatus = h.status_from || 'CREATA'
        const userName = h.changed_by_user?.full_name || 'Sistema'
        return `${historyDate}: ${fromStatus} → ${h.status_to} (${userName})`
      })
      .join('\n')

    return [
      request.id.substring(0, 8), // Shortened ID
      request.title,
      requestType,
      creationDate,
      completionDate,
      statusHistory || 'Nessuno storico'
    ]
  })

  // Add table
  autoTable(doc, {
    startY: 30,
    head: [['ID', 'Titolo', 'Tipo', 'Data Creazione', 'Data Completamento', 'Stati Attraversati']],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak',
      lineColor: [200, 200, 200],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [66, 66, 66],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' }, // ID
      1: { cellWidth: 50 }, // Titolo
      2: { cellWidth: 30, halign: 'center' }, // Tipo
      3: { cellWidth: 35, halign: 'center' }, // Data Creazione
      4: { cellWidth: 35, halign: 'center' }, // Data Completamento
      5: { cellWidth: 'auto' } // Stati Attraversati
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    margin: { left: 10, right: 10 },
    didDrawPage: () => {
      // Add page numbers
      const pageCount = doc.getNumberOfPages()
      const pageNumber = (doc as any).internal.getCurrentPageInfo().pageNumber
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `Pagina ${pageNumber} di ${pageCount}`,
        148.5,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }
  })

  // Add footer with total count
  const finalY = (doc as any).lastAutoTable.finalY || 30
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(
    `Totale pratiche eliminate: ${requests.length}`,
    10,
    finalY + 10
  )

  // Generate blob
  return doc.output('blob')
}

/**
 * Generates filename for deletion archive PDF
 * @param deletionDate Date of deletion
 * @returns Filename string
 */
export function generateDeletionArchiveFilename(deletionDate: Date = new Date()): string {
  const formattedDate = format(deletionDate, 'yyyyMMdd_HHmmss')
  return `pratiche_eliminate_${formattedDate}.pdf`
}
