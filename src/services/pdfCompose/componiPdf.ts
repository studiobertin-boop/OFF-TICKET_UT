import { PDFDocument, degrees, type PDFPage } from 'pdf-lib'
import { rasterizzaPdf, ricomprimiImmagine, type Riduzione } from './raster'

/**
 * Composizione del PDF finale: tutto sullo stesso foglio, tutto entro il limite di peso.
 *
 * L'ordine dei documenti arriva già deciso da chi chiama: qui si decide solo *come*
 * ogni pagina si posa sul foglio e *quanto* si può ridurre prima di consegnare.
 */

/** Un formato di foglio in punti tipografici, l'unità di misura del PDF. */
export interface Foglio {
  larghezza: number
  altezza: number
}

/** A4 verticale in punti tipografici. */
export const A4: Foglio = { larghezza: 595.28, altezza: 841.89 } as const

/** A4 orizzontale: stesso foglio, lati scambiati. */
export const A4_ORIZZONTALE: Foglio = { larghezza: 841.89, altezza: 595.28 } as const

/** Il fascicolo non deve superare i 4,95 MB. */
export const LIMITE_BYTE = Math.round(4.95 * 1024 * 1024)

/** Documento da rilegare, nell'ordine in cui va rilegato. */
export interface SorgenteFascicolo {
  file: File
  /** Nome da mostrare negli avvisi. */
  etichetta: string
  /**
   * Vero per le foto delle targhette. La compressione le aggredisce per prime e le lascia
   * ridurre di più: una targhetta resta leggibile a risoluzioni a cui un manuale non lo è.
   */
  foto: boolean
}

export interface EsitoComposizione {
  blob: Blob
  pagine: number
  byte: number
  /** Falso se nemmeno la compressione più aggressiva ha fatto rientrare il fascicolo. */
  sottoLimite: boolean
  /** Documenti che hanno perso qualità, e quanto in breve. */
  ridotti: string[]
  /** File che non si è riusciti ad aprire: il fascicolo esce senza, e l'interfaccia lo dice. */
  scartati: { etichetta: string; motivo: string }[]
}

export interface OpzioniComposizione {
  limiteByte?: number
  /** Formato del foglio finale. Default: A4 verticale. */
  foglio?: Foglio
  /** Riferisce a che punto è, per la barra di avanzamento. */
  onProgresso?: (messaggio: string) => void
}

/** Posa di un contenuto dentro il foglio, nel sistema di riferimento di pdf-lib. */
export interface Inquadratura {
  x: number
  y: number
  /** Dimensioni del contenuto *prima* dell'eventuale rotazione: è ciò che pdf-lib disegna. */
  larghezza: number
  altezza: number
  ruotato: boolean
}

/**
 * Colloca un contenuto di `w × h` dentro un foglio, sfruttandolo il più possibile.
 *
 * Ciò il cui orientamento non combacia con quello del foglio viene ruotato di 90°: una targhetta
 * fotografata in orizzontale, posata senza ruotare su un foglio verticale, occuperebbe una
 * striscia alta un terzo di pagina e si leggerebbe con la lente. Ruotata riempie il foglio.
 *
 * La rotazione di pdf-lib avviene attorno al punto di ancoraggio, in senso antiorario: dopo un
 * quarto di giro la larghezza del contenuto cresce verso l'alto e l'altezza verso sinistra,
 * quindi l'ancora va nell'angolo in alto a destra dell'area occupata, non in basso a sinistra.
 */
export const inquadraInFoglio = (w: number, h: number, foglio: Foglio): Inquadratura => {
  const { larghezza: W, altezza: H } = foglio
  // Si ruota solo se l'orientamento del contenuto non combacia con quello del foglio: un
  // contenuto orizzontale su un foglio orizzontale resta dritto, uno stesso contenuto su un
  // foglio verticale va ruotato — e viceversa.
  const ruotato = (w > h) !== (W > H)

  const scala = ruotato ? Math.min(W / h, H / w) : Math.min(W / w, H / h)
  const larghezza = w * scala
  const altezza = h * scala

  return ruotato
    ? { x: (W + altezza) / 2, y: (H - larghezza) / 2, larghezza, altezza, ruotato }
    : { x: (W - larghezza) / 2, y: (H - altezza) / 2, larghezza, altezza, ruotato }
}

/** Scorciatoia storica: inquadra su un A4 verticale. */
export const inquadraInA4 = (w: number, h: number): Inquadratura => inquadraInFoglio(w, h, A4)

const eUnPdf = (file: File) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

/** Aggiunge un foglio al documento e restituisce foglio e inquadratura del contenuto. */
const nuovoFoglio = (out: PDFDocument, w: number, h: number, foglio: Foglio): [PDFPage, Inquadratura] => {
  const pagina = out.addPage([foglio.larghezza, foglio.altezza])
  return [pagina, inquadraInFoglio(w, h, foglio)]
}

const posa = (
  pagina: PDFPage,
  q: Inquadratura,
  disegna: (opzioni: { x: number; y: number; width: number; height: number; rotate?: ReturnType<typeof degrees> }) => void
) => {
  disegna({
    x: q.x,
    y: q.y,
    width: q.larghezza,
    height: q.altezza,
    ...(q.ruotato ? { rotate: degrees(90) } : {}),
  })
}

/**
 * Pagine di un PDF ricopiate come sono: restano vettoriali, quindi nitide e leggere.
 *
 * Si incorporano una per una e non tutte insieme perché una pagina che pdf-lib rifiuta — una
 * pagina bianca senza flusso di contenuto, che le scansioni producono spesso — farebbe cadere
 * l'intero documento. Meglio perdere quella pagina che il certificato.
 */
const aggiungiPaginePdf = async (out: PDFDocument, file: File, foglio: Foglio) => {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const sorgente = await PDFDocument.load(bytes, { ignoreEncryption: true })

  for (const indice of sorgente.getPageIndices()) {
    let incorporata
    try {
      [incorporata] = await out.embedPdf(sorgente, [indice])
    } catch {
      continue
    }
    const [pagina, q] = nuovoFoglio(out, incorporata.width, incorporata.height, foglio)
    posa(pagina, q, (o) => pagina.drawPage(incorporata, o))
  }
}

/** Un'immagine — o una pagina già rasterizzata — posata su un foglio. */
const aggiungiImmagine = async (
  out: PDFDocument,
  immagine: { bytes: Uint8Array; larghezza: number; altezza: number; tipo: 'jpeg' | 'png' },
  foglio: Foglio
) => {
  const incorporata = immagine.tipo === 'png'
    ? await out.embedPng(immagine.bytes)
    : await out.embedJpg(immagine.bytes)

  const [pagina, q] = nuovoFoglio(out, immagine.larghezza, immagine.altezza, foglio)
  posa(pagina, q, (o) => pagina.drawImage(incorporata, o))
}

/** Incorpora un'immagine originale senza ridisegnarla, quando il formato lo consente. */
const immagineIntatta = async (file: File) => {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const png = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
  const jpeg = /^image\/jpe?g$/.test(file.type) || /\.jpe?g$/i.test(file.name)
  if (!png && !jpeg) return null

  // Le dimensioni le sa pdf-lib dopo l'incorporazione: si incorpora in un documento di scarto
  // solo per misurarle sarebbe uno spreco, quindi si passano i byte e si misura in posa.
  return { bytes, tipo: (png ? 'png' : 'jpeg') as 'png' | 'jpeg' }
}

/** Una passata di composizione con un dato grado di riduzione. */
const componiUnaVolta = async (
  sorgenti: SorgenteFascicolo[],
  riduzioni: { foto: Riduzione | null; documenti: Riduzione | null },
  foglio: Foglio
): Promise<{ bytes: Uint8Array; pagine: number; scartati: EsitoComposizione['scartati'] }> => {
  const out = await PDFDocument.create()
  const scartati: EsitoComposizione['scartati'] = []

  for (const s of sorgenti) {
    const riduzione = s.foto ? riduzioni.foto : riduzioni.documenti

    try {
      if (eUnPdf(s.file)) {
        if (!riduzione) {
          await aggiungiPaginePdf(out, s.file, foglio)
        } else {
          for (const pagina of await rasterizzaPdf(s.file, riduzione)) {
            await aggiungiImmagine(out, pagina, foglio)
          }
        }
        continue
      }

      const intatta = riduzione ? null : await immagineIntatta(s.file)
      if (intatta) {
        const incorporata = intatta.tipo === 'png'
          ? await out.embedPng(intatta.bytes)
          : await out.embedJpg(intatta.bytes)
        const [pagina, q] = nuovoFoglio(out, incorporata.width, incorporata.height, foglio)
        posa(pagina, q, (o) => pagina.drawImage(incorporata, o))
      } else {
        await aggiungiImmagine(out, await ricomprimiImmagine(s.file, riduzione ?? undefined), foglio)
      }
    } catch (errore) {
      scartati.push({
        etichetta: s.etichetta,
        motivo: errore instanceof Error ? errore.message : 'file illeggibile',
      })
    }
  }

  // Il conteggio si legge prima di salvare: `save` su un documento vuoto ne aggiusta la
  // struttura, e il numero letto dopo non sarebbe più quello dei fogli composti.
  const pagine = out.getPageCount()
  return { bytes: await out.save(), pagine, scartati }
}

/**
 * Gradi di riduzione, dal più conservativo al più aggressivo.
 *
 * Prima si toccano solo le foto, e a lungo: sono la parte pesante del fascicolo e quella che
 * regge meglio il degrado. I certificati e i manuali entrano in gioco solo quando le foto non
 * bastano più, perché rasterizzarli significa perderne il testo.
 */
const GRADI: { foto: Riduzione | null; documenti: Riduzione | null }[] = [
  { foto: null, documenti: null },
  { foto: { dpi: 150, qualita: 0.82 }, documenti: null },
  { foto: { dpi: 120, qualita: 0.72 }, documenti: null },
  { foto: { dpi: 100, qualita: 0.62 }, documenti: null },
  { foto: { dpi: 85, qualita: 0.52 }, documenti: null },
  { foto: { dpi: 85, qualita: 0.5 }, documenti: { dpi: 150, qualita: 0.75 } },
  { foto: { dpi: 72, qualita: 0.45 }, documenti: { dpi: 120, qualita: 0.65 } },
  { foto: { dpi: 60, qualita: 0.4 }, documenti: { dpi: 100, qualita: 0.55 } },
]

/** Oltre i gradi previsti si continua a scendere: il limite di peso va rispettato comunque. */
const gradoOltre = (n: number) => {
  const fattore = 0.8 ** (n + 1)
  return {
    foto: { dpi: Math.max(24, Math.round(60 * fattore)), qualita: Math.max(0.2, 0.4 * fattore) },
    documenti: { dpi: Math.max(36, Math.round(100 * fattore)), qualita: Math.max(0.25, 0.55 * fattore) },
  }
}

/** Sotto questa risoluzione non si scende: un foglio più povero non è più un documento. */
const GRADI_OLTRE = 6

const descriviRiduzione = (r: Riduzione) => `${r.dpi} dpi`

/**
 * Rilega i documenti in un unico PDF che sta sotto il limite di peso.
 *
 * Si prova prima senza toccare nulla: quasi sempre basta, e il documento esce con i certificati
 * ancora vettoriali. Solo se sfora si riduce, un grado alla volta, fermandosi al primo che
 * rientra — così il documento perde il minimo indispensabile e non il massimo consentito.
 */
export const componiFascicolo = async (
  sorgenti: SorgenteFascicolo[],
  { limiteByte = LIMITE_BYTE, foglio = A4, onProgresso }: OpzioniComposizione = {}
): Promise<EsitoComposizione> => {
  let ultimo: { bytes: Uint8Array; pagine: number; scartati: EsitoComposizione['scartati'] } | null = null
  let ridotti: string[] = []

  const gradi = [...GRADI, ...Array.from({ length: GRADI_OLTRE }, (_, i) => gradoOltre(i))]

  for (let i = 0; i < gradi.length; i++) {
    const grado = gradi[i]
    onProgresso?.(
      i === 0
        ? 'Composizione del fascicolo…'
        : `Riduzione del peso: ${grado.documenti ? 'documenti e foto' : 'foto'} a ${descriviRiduzione(grado.foto!)}…`
    )

    ultimo = await componiUnaVolta(sorgenti, grado, foglio)
    ridotti = i === 0
      ? []
      : sorgenti
        .filter((s) => (s.foto ? grado.foto : grado.documenti))
        .map((s) => `${s.etichetta} (${descriviRiduzione((s.foto ? grado.foto : grado.documenti)!)})`)

    if (ultimo.bytes.byteLength <= limiteByte) break
  }

  const esito = ultimo!
  return {
    // `slice` su un `Uint8Array` dà una copia con un buffer proprio: senza, TypeScript rifiuta
    // il `SharedArrayBuffer` che il tipo generico ammette.
    blob: new Blob([esito.bytes.slice()], { type: 'application/pdf' }),
    pagine: esito.pagine,
    byte: esito.bytes.byteLength,
    sottoLimite: esito.bytes.byteLength <= limiteByte,
    ridotti,
    scartati: esito.scartati,
  }
}
