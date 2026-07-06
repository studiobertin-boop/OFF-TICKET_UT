/**
 * Genera la relazione tecnica DM329 e ne avvia il download come .docx.
 * Carica il template Word "muto" da /public, inietta il RelazioneModel e salva.
 */
import { saveAs } from 'file-saver'
import type { Customer } from '@/types'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import { buildRelazioneModel } from './buildRelazioneModel'
import { renderRelazioneDocx } from './renderRelazione'
import type { AdditionalInfo } from './types'

/** Percorso del template nel folder public (autorato in Word, vedi TEMPLATE_TAGS.md). */
export const TEMPLATE_URL = '/templates/relazione-dm329.docx'

export interface GenerateRelazioneParams {
  scheda: SchedaDatiCompleta
  additionalInfo: AdditionalInfo
  customer: Customer
  fileName?: string
}

export async function generateAndDownloadRelazione(
  params: GenerateRelazioneParams
): Promise<void> {
  const { scheda, additionalInfo, customer, fileName } = params

  const res = await fetch(TEMPLATE_URL)
  if (!res.ok) {
    throw new Error(
      `Template della relazione non trovato in ${TEMPLATE_URL}. ` +
        'Caricare il file .docx in public/templates/ (vedi TEMPLATE_TAGS.md).'
    )
  }
  const templateBuffer = await res.arrayBuffer()

  const model = buildRelazioneModel({ scheda, additionalInfo, customer })
  const bytes = renderRelazioneDocx(templateBuffer, model)

  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  saveAs(blob, fileName ?? 'Relazione_DM329.docx')
}
