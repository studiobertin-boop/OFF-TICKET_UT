import type { Apparecchiatura, ContestoFascicolo, RuoloDocumento } from './types'

/**
 * Classificazione di ripiego, dal solo nome del file.
 *
 * Si usa quando la classificazione con l'AI non è disponibile — credito esaurito, rete assente,
 * funzione non ancora installata. Non è brava quanto quella: su `scan0001.pdf` non ha niente da
 * dire. Ma tiene la funzione in piedi, perché il ruolo si può sempre correggere a mano, e nel
 * caso comune — i file che il tecnico ha già nominato per quello che sono — ci prende.
 */

export interface DocumentoDaClassificare {
  id: string
  nome: string
  /** Vero per i formati immagine: un JPEG non è mai un certificato. */
  immagine: boolean
}

export interface RisultatoClassificazione {
  id: string
  ruoli: RuoloDocumento[]
  valvola: string | null
  /** 0-1. Zero significa «non riconosciuto»: il documento resta fuori finché non lo si assegna. */
  confidenza: number
  motivazione: string
  origine: 'ai' | 'euristica'
}

/** Toglie accenti e punteggiatura: `Conformità_CE (1).pdf` e `conformita ce` devono combaciare. */
const normalizza = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const CERTIFICATO = /\b(dichiarazione|conformit|certificat|attestat)/
const ISTRUZIONI = /\b(manuale|manual|istruzion|libretto|uso e manutenzione|user guide)/
const TARGHETTA = /\b(targhet|targa|foto|photo|img|dsc|immagine)/
const VALVOLA = /\b(valvol|taratura|safety valve)/

/**
 * Il nome del file parla di questa apparecchiatura?
 *
 * Il codice si cerca come parola intera — `C1` è lungo due caratteri e come sottostringa
 * comparirebbe dentro mezzo alfabeto di sigle — mentre marca, modello e numero di fabbrica si
 * cercano come sottostringa, perché nei nomi dei file arrivano attaccati a tutto il resto.
 */
const nomina = (testo: string, a: Apparecchiatura | null) => {
  if (!a) return false

  const codice = normalizza(a.codice)
  if (codice && ` ${testo} `.includes(` ${codice} `)) return true

  return [a.marca, a.modello, a.n_fabbrica]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 2)
    .map(normalizza)
    .some((termine) => termine.length > 2 && testo.includes(termine))
}

/**
 * Ruolo di un documento dedotto dal suo nome.
 *
 * L'attribuzione va dal più specifico al più generico: prima si guarda se il nome parla della
 * valvola, poi se porta i dati dell'apparecchiatura principale, e solo alla fine si assume che
 * riguardi l'apparecchiatura di cui si sta componendo il fascicolo. È l'ordine giusto perché
 * l'ultimo caso è quello che il nome non dichiara mai: nessuno chiama un file
 * «certificato del disoleatore» quando sta compilando la scheda del disoleatore.
 */
export const classificaDaNome = (
  documento: DocumentoDaClassificare,
  contesto: ContestoFascicolo
): RisultatoClassificazione => {
  const testo = normalizza(documento.nome)
  const base = { id: documento.id, valvola: null, origine: 'euristica' as const }

  const diValvola = VALVOLA.test(testo)
  const valvola = diValvola ? (contesto.valvole.find((v) => testo.includes(normalizza(v.codice).trim())) ?? contesto.valvole[0]) : null
  // Un documento che nomina la principale le appartiene, a meno che non nomini anche questa
  // apparecchiatura: allora il riferimento è al contesto, non al soggetto.
  const diPrincipale = !diValvola && nomina(testo, contesto.principale) && !nomina(testo, contesto.apparecchiatura)

  const certificato = CERTIFICATO.test(testo)
  const istruzioni = ISTRUZIONI.test(testo)
  // La targhetta vince sul certificato: «foto targhetta» contiene entrambe le tracce, ma è
  // una foto. Un'immagine non può essere altro.
  const targhetta = documento.immagine || (TARGHETTA.test(testo) && !certificato && !istruzioni)

  if (targhetta) {
    return {
      ...base,
      ruoli: [diPrincipale ? 'FOTO_TARGHETTA_PRINCIPALE' : 'FOTO_TARGHETTA'],
      confidenza: documento.immagine && !TARGHETTA.test(testo) ? 0.4 : 0.6,
      motivazione: documento.immagine
        ? 'È un’immagine: nel fascicolo le immagini sono le foto delle targhette.'
        : 'Il nome del file parla di una targhetta.',
    }
  }

  const ruoli: RuoloDocumento[] = []
  if (certificato) ruoli.push(diValvola ? 'CERT_VALVOLA' : diPrincipale ? 'CERT_PRINCIPALE' : 'CERT_APPARECCHIATURA')
  if (istruzioni) ruoli.push(diValvola ? 'ISTR_VALVOLA' : diPrincipale ? 'ISTR_APPARECCHIATURA' : 'ISTR_APPARECCHIATURA')

  if (ruoli.length === 0) {
    return {
      ...base,
      ruoli: [],
      confidenza: 0,
      motivazione: 'Il nome del file non dice di che documento si tratta.',
    }
  }

  return {
    ...base,
    ruoli,
    valvola: valvola?.codice ?? null,
    confidenza: 0.6,
    motivazione: diValvola
      ? 'Il nome del file parla della valvola di sicurezza.'
      : diPrincipale
        ? `Il nome del file porta i dati ${contesto.principale?.tipo ?? 'dell’apparecchiatura principale'}.`
        : 'Dedotto dal nome del file.',
  }
}

/** La stessa deduzione su tutti i file caricati. */
export const classificaDaiNomi = (
  documenti: DocumentoDaClassificare[],
  contesto: ContestoFascicolo
): RisultatoClassificazione[] => documenti.map((d) => classificaDaNome(d, contesto))
