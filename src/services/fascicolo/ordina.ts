import {
  ORDINE_RUOLI, RUOLI_PRINCIPALE, RUOLI_VALVOLA, indiceRuolo,
  type ContestoFascicolo, type RuoloDocumento,
} from './types'

/** Quel tanto di un documento che basta a collocarlo: il resto lo guarda solo chi compone il PDF. */
export interface DocumentoOrdinabile {
  id: string
  ruoli: RuoloDocumento[]
  valvola?: string | null
}

export interface EsitoOrdinamento<T> {
  /** I documenti nell'ordine in cui vanno rilegati. */
  sequenza: T[]
  /** Caricati ma senza ruolo: restano fuori dal fascicolo finché non gliene si assegna uno. */
  esclusi: T[]
  /** Ruoli previsti per questa apparecchiatura di cui non è arrivato alcun documento. */
  mancanti: RuoloDocumento[]
}

const eDiValvola = (r: RuoloDocumento) => (RUOLI_VALVOLA as readonly RuoloDocumento[]).includes(r)
const eDiPrincipale = (r: RuoloDocumento) => (RUOLI_PRINCIPALE as readonly RuoloDocumento[]).includes(r)

/**
 * Ruoli che questa apparecchiatura può avere.
 *
 * Un compressore non ha una valvola propria e un serbatoio non sta dentro nulla: chiedere loro
 * quei documenti sarebbe segnalare come mancante qualcosa che non esiste.
 */
export const ruoliPrevisti = (contesto: ContestoFascicolo): RuoloDocumento[] =>
  ORDINE_RUOLI.filter((r) => {
    if (eDiValvola(r)) return contesto.valvole.length > 0
    if (eDiPrincipale(r)) return contesto.principale !== null
    return true
  })

/**
 * Il documento entra nel fascicolo al primo dei posti che gli competono: un file che contiene
 * sia il certificato sia le istruzioni sta al posto del certificato, e le istruzioni si leggono
 * nelle sue pagine successive. Spezzarlo darebbe lo stesso ordine al prezzo di dover indovinare
 * dove finisce l'uno e cominciano le altre.
 */
const ruoloPrimario = (d: DocumentoOrdinabile): RuoloDocumento =>
  [...d.ruoli].sort((a, b) => indiceRuolo(a) - indiceRuolo(b))[0]

/**
 * Dispone i documenti classificati nell'ordine del fascicolo.
 *
 * L'ordine è: certificato e istruzioni dell'apparecchiatura, poi certificato e istruzioni di
 * ciascuna valvola, poi la foto della targhetta, infine certificato e targhetta
 * dell'apparecchiatura principale. I ruoli mancanti si saltano senza lasciare posti vuoti.
 *
 * I documenti delle valvole non si ordinano per ruolo ma per valvola: con due valvole si vuole
 * leggere certificato e istruzioni della prima, poi certificato e istruzioni della seconda, non
 * i due certificati di fila. Quando la classificazione non ha saputo dire a quale valvola un
 * documento appartenga — caso normale con una valvola sola — si distribuiscono nell'ordine di
 * caricamento.
 *
 * Nulla di ciò che ha un ruolo viene scartato, nemmeno se quel ruolo la scheda non lo prevede:
 * se il tecnico carica il certificato di un'apparecchiatura principale che la scheda non
 * dichiara, la scheda può essere indietro rispetto all'impianto, e perdere il documento sarebbe
 * il danno peggiore.
 */
export const ordinaFascicolo = <T extends DocumentoOrdinabile>(
  documenti: T[],
  contesto: ContestoFascicolo
): EsitoOrdinamento<T> => {
  const esclusi = documenti.filter((d) => d.ruoli.length === 0)
  const classificati = documenti.filter((d) => d.ruoli.length > 0)

  const ordineValvola = new Map(contesto.valvole.map((v, i) => [v.codice, i]))
  /** Contatore per ruolo delle valvole non attribuite: la n-esima va alla n-esima valvola. */
  const senzaAttribuzione = new Map<RuoloDocumento, number>()

  const chiavi = classificati.map((d, caricamento) => {
    const ruolo = ruoloPrimario(d)
    let valvola = 0
    if (eDiValvola(ruolo)) {
      const dichiarata = d.valvola ? ordineValvola.get(d.valvola) : undefined
      if (dichiarata !== undefined) {
        valvola = dichiarata
      } else {
        valvola = senzaAttribuzione.get(ruolo) ?? 0
        senzaAttribuzione.set(ruolo, valvola + 1)
      }
    }
    // I documenti della valvola formano un blocco a sé: dentro il blocco comanda la valvola,
    // fuori comanda il ruolo.
    const blocco = eDiValvola(ruolo) ? 1 : indiceRuolo(ruolo) < indiceRuolo('CERT_VALVOLA') ? 0 : 2
    return { d, blocco, valvola, ruolo: indiceRuolo(ruolo), caricamento }
  })

  chiavi.sort((a, b) =>
    a.blocco - b.blocco || a.valvola - b.valvola || a.ruolo - b.ruolo || a.caricamento - b.caricamento
  )

  const coperti = new Set(classificati.flatMap((d) => d.ruoli))

  return {
    sequenza: chiavi.map((k) => k.d),
    esclusi,
    mancanti: ruoliPrevisti(contesto).filter((r) => !coperti.has(r)),
  }
}
