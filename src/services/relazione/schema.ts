/**
 * Schema Zod per additional_info (dati raccolti nello step "Dati relazione").
 * Usato dal RelazioneDataDialog per validare prima del salvataggio.
 */
import { z } from 'zod'

export const tipoGiriSchema = z.enum(['fissi', 'variabili'])

export const additionalInfoSchema = z.object({
  descrizioneAttivita: z.string().min(1, "La descrizione dell'attività è obbligatoria"),
  // Data in forma ISO, come la produce il campo data del browser. Vuota è ammessa: la
  // cella della tabella delle revisioni resta da compilare a mano.
  dataEmissione: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La data di emissione non è una data valida')
    .or(z.literal(''))
    .default(''),
  compressoriGiri: z.record(z.string(), tipoGiriSchema).default({}),
  spessimetrica: z.array(z.string()).default([]),
  collegamentiCompressoriSerbatoi: z.record(z.string(), z.array(z.string())).default({}),
  /**
   * Layout dello schema d'impianto ritoccato a mano. Struttura libera per Zod: la validazione
   * vera la fa `deserializzaLayout`, che sa riconoscere una versione che non capisce.
   */
  schemaLayout: z.any().optional(),
  /**
   * Scelte dell'operatore sulla forma dello schema. Struttura libera per Zod, come `schemaLayout`
   * qui sopra e per la stessa ragione: la validazione vera la fa `risolviPreferenze`, che sa
   * scartare un riferimento a un'apparecchiatura sparita senza far fallire l'intero salvataggio.
   * Un `z.object` severo qui bloccherebbe la generazione della relazione per un dato storto in un
   * campo che non la riguarda.
   *
   * DEVE restare dichiarato: questo schema è un `z.object` senza `passthrough`, e `handleGenera`
   * salva `parsed.data` — una chiave non dichiarata viene cancellata in silenzio.
   */
  schemaPreferenze: z.any().optional(),
})

export type AdditionalInfoParsed = z.infer<typeof additionalInfoSchema>
