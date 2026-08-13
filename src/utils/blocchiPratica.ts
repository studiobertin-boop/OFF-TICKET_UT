import type { RequestBlock } from '@/types'

/**
 * Lettura dei fermi di una pratica: quante volte si è fermata, quanto è durata ogni sosta,
 * e come disporle su una barra che copre la sua vita.
 *
 * Vive fuori dai componenti perché è la parte che si verifica sui casi veri — un blocco
 * aperto, due chiusi, uno aperto e chiuso lo stesso giorno — e perché la stessa lettura
 * serve al chip dell'intestazione e al nastro sotto lo stepper: se divergessero, i due
 * direbbero due cose diverse della stessa pratica.
 */

const MS_GIORNO = 24 * 60 * 60 * 1000

/** Un movimento nella storia dei fermi, come lo si racconta in elenco. */
export interface EventoBlocco {
  tipo: 'blocco' | 'sblocco'
  /** Momento del movimento, ISO. */
  quando: string
  chi?: string
  /** Motivo del blocco, o note di risoluzione dello sblocco. */
  nota?: string
}

/**
 * Un tratto della barra, in percentuale della vita della pratica.
 *
 * I fermi hanno una durata e occupano lo spazio che gli spetta; lo sblocco è un istante e
 * non ne occuperebbe nessuno — gli si dà una larghezza fissa, quel tanto che basta a
 * vederlo e a passarci sopra col mouse per leggerne le note.
 */
export interface SegmentoFermo {
  tipo: 'fermo' | 'sblocco'
  inizio: number
  larghezza: number
  /** Il fermo è ancora in corso: si disegna diverso, e non ha una fine da mostrare. */
  aperto: boolean
  /** Testo del suggerimento: date, durata e motivo. */
  descrizione: string
}

export interface RiassuntoBlocchi {
  /** Quante volte la pratica si è fermata, in tutto. */
  totale: number
  /** Il fermo in corso, se c'è. */
  attivo: RequestBlock | null
  /** Giorni interi dall'inizio del fermo in corso; `null` se la pratica non è ferma. */
  giorniFermaOra: number | null
  /** Giorni complessivamente passati ferma, il fermo in corso compreso. */
  giorniPersi: number
  /** Giorni di vita della pratica, dalla creazione a ora. */
  giorniVita: number
  /** Data dell'ultimo movimento (blocco o sblocco), ISO; `null` se non si è mai fermata. */
  ultimoMovimento: string | null
  /** Movimenti dal più recente al più vecchio. */
  eventi: EventoBlocco[]
  /** Periodi di fermo da disegnare, in ordine cronologico. */
  segmenti: SegmentoFermo[]
}

/**
 * Larghezza minima di un segmento, in percentuale.
 *
 * Un fermo di poche ore su una pratica di mesi vale una frazione di punto: disegnato in
 * scala sparirebbe, e la barra direbbe «mai ferma» di una pratica che si è fermata.
 */
const LARGHEZZA_MINIMA = 1.5

/**
 * Larghezza del segno di sblocco, in percentuale.
 *
 * Lo sblocco non dura: è il momento in cui la pratica riparte. Sulla barra vale come un
 * segno, non come un periodo — stretto perché non finga una durata, ma abbastanza largo da
 * poterci passare sopra col mouse e leggere perché è ripartita.
 */
const LARGHEZZA_SBLOCCO = 1.8

const giorniFra = (da: number, a: number) => Math.max(0, Math.floor((a - da) / MS_GIORNO))

/** Data breve come si legge in Italia: «28 lug». */
const dataBreve = (iso: string) =>
  new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })

/** Durata di un fermo, arrotondata al giorno: sotto la giornata si dice «meno di un giorno». */
export const durataInParole = (giorni: number): string => {
  if (giorni < 1) return 'meno di un giorno'
  return giorni === 1 ? '1 giorno' : `${giorni} giorni`
}

export function riassumiBlocchi(
  blocchi: RequestBlock[] | undefined | null,
  opzioni: { creataIl: string; adesso?: Date }
): RiassuntoBlocchi {
  const adesso = (opzioni.adesso ?? new Date()).getTime()
  const nascita = new Date(opzioni.creataIl).getTime()
  const vuoto: RiassuntoBlocchi = {
    totale: 0, attivo: null, giorniFermaOra: null, giorniPersi: 0,
    giorniVita: giorniFra(nascita, adesso), ultimoMovimento: null, eventi: [], segmenti: [],
  }

  if (!blocchi || blocchi.length === 0) return vuoto

  // In ordine cronologico: la query li restituisce dal più recente, ma la barra si legge
  // da sinistra a destra e i giorni si sommano nell'ordine in cui sono passati.
  const cronologici = [...blocchi].sort(
    (a, b) => new Date(a.blocked_at).getTime() - new Date(b.blocked_at).getTime()
  )

  const attivo = cronologici.find((b) => b.is_active || !b.unblocked_at) ?? null

  /**
   * Fondo della barra: dalla creazione a ora. Su una pratica appena creata i due estremi
   * coincidono e ogni divisione darebbe infinito, quindi la scala non scende sotto il giorno.
   */
  const fine = Math.max(adesso, ...cronologici.map((b) => new Date(b.unblocked_at ?? b.blocked_at).getTime()))
  const arco = Math.max(fine - nascita, MS_GIORNO)

  const segmenti: SegmentoFermo[] = []
  let giorniPersi = 0

  for (const b of cronologici) {
    const da = new Date(b.blocked_at).getTime()
    const a = b.unblocked_at ? new Date(b.unblocked_at).getTime() : adesso
    const giorni = giorniFra(da, a)
    giorniPersi += giorni

    const inizio = ((da - nascita) / arco) * 100
    const larghezza = Math.max(LARGHEZZA_MINIMA, ((a - da) / arco) * 100)
    const aperto = !b.unblocked_at

    segmenti.push({
      tipo: 'fermo',
      // Il segmento resta dentro la barra anche quando la larghezza minima lo allargherebbe oltre.
      inizio: Math.max(0, Math.min(inizio, 100 - larghezza)),
      larghezza,
      aperto,
      descrizione: aperto
        ? `Dal ${dataBreve(b.blocked_at)} · ${durataInParole(giorni)} · ${b.reason}`
        : `${dataBreve(b.blocked_at)} – ${dataBreve(b.unblocked_at!)} · ${durataInParole(giorni)} · ${b.reason}`,
    })

    // Il momento in cui è ripartita, subito dopo il fermo che chiude.
    if (b.unblocked_at) {
      const inizioSblocco = ((a - nascita) / arco) * 100
      const chi = b.unblocked_by_user?.full_name
      segmenti.push({
        tipo: 'sblocco',
        inizio: Math.max(0, Math.min(inizioSblocco, 100 - LARGHEZZA_SBLOCCO)),
        larghezza: LARGHEZZA_SBLOCCO,
        aperto: false,
        descrizione: [
          `Sbloccata il ${dataBreve(b.unblocked_at)}${chi ? ` da ${chi}` : ''}`,
          b.resolution_notes || 'nessuna nota di risoluzione',
        ].join(' · '),
      })
    }
  }

  // In ordine di posizione: il segno di sblocco è l'ultimo del suo fermo, e i fermi si
  // susseguono, ma ordinarli esplicitamente rende il disegno indipendente dall'inserimento.
  segmenti.sort((x, y) => x.inizio - y.inizio)

  const eventi: EventoBlocco[] = []
  for (const b of cronologici) {
    eventi.push({
      tipo: 'blocco',
      quando: b.blocked_at,
      chi: b.blocked_by_user?.full_name,
      nota: b.reason,
    })
    if (b.unblocked_at) {
      eventi.push({
        tipo: 'sblocco',
        quando: b.unblocked_at,
        chi: b.unblocked_by_user?.full_name,
        nota: b.resolution_notes ?? undefined,
      })
    }
  }
  eventi.sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime())

  return {
    totale: cronologici.length,
    attivo,
    giorniFermaOra: attivo ? giorniFra(new Date(attivo.blocked_at).getTime(), adesso) : null,
    giorniPersi,
    giorniVita: giorniFra(nascita, adesso),
    ultimoMovimento: eventi[0]?.quando ?? null,
    eventi,
    segmenti,
  }
}
