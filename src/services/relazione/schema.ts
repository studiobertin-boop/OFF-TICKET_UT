/**
 * Schema Zod per additional_info (dati raccolti nello step "Dati relazione").
 * Usato dal RelazioneDataDialog per validare prima del salvataggio.
 */
import { z } from 'zod'

export const tipoGiriSchema = z.enum(['fissi', 'variabili'])

export const additionalInfoSchema = z.object({
  descrizioneAttivita: z.string().min(1, "La descrizione dell'attività è obbligatoria"),
  compressoriGiri: z.record(z.string(), tipoGiriSchema).default({}),
  spessimetrica: z.array(z.string()).default([]),
  collegamentiCompressoriSerbatoi: z.record(z.string(), z.array(z.string())).default({}),
  motivoRevisione: z.string().optional(),
})

export type AdditionalInfoParsed = z.infer<typeof additionalInfoSchema>
