import { proveDi } from './estrazione'
import { classificaDaiNomi, type RisultatoClassificazione } from './euristica'
import { ORDINE_RUOLI, type ContestoFascicolo, type RuoloDocumento } from './types'

/**
 * Riconoscimento del ruolo dei documenti caricati.
 *
 * Chiama la Edge Function che interroga il modello; se non risponde — credito esaurito, rete
 * assente, funzione non installata — ripiega sulla deduzione dal nome del file. Il ripiego non è
 * un dettaglio: il fascicolo si deve poter comporre anche senza AI, perché il ruolo di ogni
 * documento resta comunque correggibile a mano prima di generare.
 */

export interface EsitoClassificazione {
  risultati: RisultatoClassificazione[]
  /** Presente quando si è ripiegato sull'euristica: l'interfaccia lo dice all'utente. */
  avviso?: string
}

const RUOLI_VALIDI = new Set<string>(ORDINE_RUOLI)

/** Tiene solo i ruoli che il vocabolario conosce: un modello può sempre inventarsi un'etichetta. */
const ruoliValidi = (ruoli: unknown): RuoloDocumento[] =>
  Array.isArray(ruoli) ? ruoli.filter((r): r is RuoloDocumento => typeof r === 'string' && RUOLI_VALIDI.has(r)) : []

const eUnImmagine = (file: File) =>
  file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|heic|tiff?)$/i.test(file.name)

/**
 * Classifica i documenti caricati per il fascicolo di un'apparecchiatura.
 *
 * @param documenti file caricati, nell'ordine di caricamento
 * @param contesto ciò che la scheda già sa dell'apparecchiatura, delle valvole e della principale
 */
export const classificaDocumenti = async (
  documenti: { id: string; file: File }[],
  contesto: ContestoFascicolo
): Promise<EsitoClassificazione> => {
  const perNome = () =>
    classificaDaiNomi(
      documenti.map((d) => ({ id: d.id, nome: d.file.name, immagine: eUnImmagine(d.file) })),
      contesto
    )

  if (documenti.length === 0) return { risultati: [] }

  try {
    const documentiConProve = await proveDi(documenti)

    const risposta = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/classifica-documenti-fascicolo`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ contesto, documenti: documentiConProve }),
      }
    )

    if (!risposta.ok) throw new Error(`La classificazione ha risposto ${risposta.status}`)

    const esito: {
      success: boolean
      error?: string
      /** Non tipizzato oltre l'id: quel che arriva da un modello si valida, non si dichiara. */
      risultati?: { id: string; ruoli?: unknown; valvola?: unknown; confidenza?: unknown; motivazione?: unknown }[]
    } = await risposta.json()

    if (!esito.success) throw new Error(esito.error || 'Classificazione fallita')

    const perId = new Map((esito.risultati ?? []).map((r) => [r.id, r]))

    // Un documento su cui il modello non si è pronunciato non resta scoperto: gli si applica
    // comunque la deduzione dal nome, che è meglio di niente.
    const ripiego = new Map(perNome().map((r) => [r.id, r]))

    return {
      risultati: documenti.map(({ id }) => {
        const r = perId.get(id)
        const ruoli = ruoliValidi(r?.ruoli)
        if (!r || ruoli.length === 0) return ripiego.get(id)!
        return {
          id,
          ruoli,
          valvola: typeof r.valvola === 'string' ? r.valvola : null,
          confidenza: typeof r.confidenza === 'number' ? r.confidenza : 0.5,
          motivazione: typeof r.motivazione === 'string' ? r.motivazione : '',
          origine: 'ai' as const,
        }
      }),
    }
  } catch (errore) {
    console.warn('Classificazione automatica non disponibile, si ripiega sul nome dei file:', errore)
    return {
      risultati: perNome(),
      avviso:
        'Il riconoscimento automatico non è disponibile: i ruoli sono stati dedotti dal nome dei file. Controllali prima di generare.',
    }
  }
}
