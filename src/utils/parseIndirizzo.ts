/**
 * Scomposizione di un indirizzo impianto nei campi richiesti dalla scheda CIVA
 * (Indirizzo / Numero civico / CAP / Comune / Provincia).
 *
 * Gli indirizzi in `requests.indirizzo_impianto` arrivano da fonti diverse e non hanno
 * un formato unico: alcuni sono stringhe di Google Places (segmenti separati da virgola
 * che terminano con "Italia"), altri sono stati digitati nel formato usato storicamente
 * per il CIVA ("VIA X, 12, 31100 COMUNE, (TV)"), altri ancora sono forme abbreviate.
 *
 * REGOLA DI SICUREZZA: questi valori vengono ritrascritti a mano nel portale CIVA, quindi
 * un dato sbagliato è peggio di un dato assente. Quando un pezzo non è riconoscibile con
 * certezza dalla struttura della stringa, il campo resta vuoto; se non è riconoscibile
 * l'indirizzo nel suo insieme, l'intera stringa finisce nel campo "via" (che sulla scheda
 * è etichettato "Indirizzo"), come faceva il vecchio fallback.
 *
 * Il parser lavora solo sulla struttura: nessun elenco di comuni o province.
 */

export interface IndirizzoScomposto {
  via: string
  numero_civico: string
  cap: string
  comune: string
  provincia: string
}

const VUOTO: IndirizzoScomposto = { via: '', numero_civico: '', cap: '', comune: '', provincia: '' }

/** Prefissi che identificano un odonimo. Volutamente stretto: "Borgo", "Zona", "Case",
 *  "Parco" compaiono nei corpus come frazioni o zone, non come vie. */
const PREFISSI_STRADA =
  /^(?:via|viale|v\.?le|vicolo|piazz(?:a|etta|ale)|p\.?zz?a|corso|c\.?so|strad(?:a|ella)|largo|contrada|c\.?da|calle|riviera|lungomare|circonvallazione|salita|traversa|galleria)\.?(?=\s)/i

/** Suddivisioni amministrative interne a un comune: non sono un comune. */
const SUDDIVISIONI = /^(?:circoscrizione|municipio|quartiere|zona|frazione|localit[àa])\b/i

/** Segmento composto dal solo civico: "30", "11/A", "2 / A". */
const CIVICO_PURO = /^\d{1,4}(?:\s*[/-]\s*[A-Za-z0-9]{1,3})?$/

/** Civico in testa a un segmento seguito da altro testo: "78 San Floriano". */
const CIVICO_INIZIALE = /^(\d{1,4}(?:\s*[/-]\s*[A-Za-z0-9]{1,3})?)\s+(.+)$/

/**
 * Civico in coda al nome della via: "Via Bianchi 7", "VIA DELLA LIBERTA' 2".
 * Il gruppo del nome deve chiudersi con una lettera (o apostrofo/punto): così
 * "VIA INTERNATI 1943 - 1945" non viene scambiato per via + civico 1945.
 */
const CIVICO_FINALE = /^(.*[A-Za-z'’.])\s+(\d{1,4}(?:\s*[/-]\s*[A-Za-z0-9]{1,3})?)$/

/** Provincia siglata fra parentesi come segmento a sé: "(TV)". */
const PROVINCIA_SEGMENTO = /^\(([A-Za-z]{2})\)$/

/** Provincia siglata in coda a un segmento: "Paese (TV)". */
const PROVINCIA_IN_CODA = /^(.*?)\s*\(([A-Za-z]{2})\)$/

/** "[civico ]CAP COMUNE": "30029 SAN STINO DI LIVENZA", "14 31038 Paese". */
const CAP_E_COMUNE = /^(?:(\d{1,4}(?:\s*[/-]\s*[A-Za-z0-9]{1,3})?)\s+)?(\d{5})\s+(.+)$/

/** Le 20 regioni, normalizzate. Servono solo a riconoscere il formato Google Places
 *  (dove il penultimo livello prima del CAP è la regione), mai come dato in uscita. */
const REGIONI = [
  'abruzzo', 'basilicata', 'calabria', 'campania', 'emilia romagna', 'friuli venezia giulia',
  'lazio', 'liguria', 'lombardia', 'marche', 'molise', 'piemonte', 'puglia', 'sardegna',
  'sicilia', 'toscana', 'trentino alto adige', 'umbria', 'valle d aosta', 'veneto',
]

const normalizza = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const isRegione = (s: string): boolean => {
  const n = normalizza(s)
  // Le varianti bilingui ("Trentino-Alto Adige/Südtirol") aggiungono testo in coda.
  return REGIONI.some(r => n === r || n.startsWith(`${r} `))
}

const isStrada = (s: string): boolean => PREFISSI_STRADA.test(s)

/** "Provincia di Treviso" / "Città Metropolitana di Torino" → "Treviso" / "Torino". */
const nomeProvincia = (s: string): string =>
  s.replace(/^(?:provincia|citt[àa'] ?metropolitana|libero consorzio comunale)\s+di\s+/i, '').trim()

/** Individua via e civico fra i segmenti che precedono comune/CAP/provincia. */
function estraiViaECivico(segmenti: string[], civicoGiaNoto: string): { via: string; civico: string } {
  let civico = civicoGiaNoto

  let idx = -1
  for (let i = segmenti.length - 1; i >= 0; i--) {
    if (isStrada(segmenti[i])) {
      idx = i
      break
    }
  }
  if (idx === -1) return { via: '', civico }

  let via = segmenti[idx]

  if (!civico) {
    const precedente = idx > 0 ? segmenti[idx - 1] : ''
    const successivo = idx + 1 < segmenti.length ? segmenti[idx + 1] : ''
    const inizialeSuccessivo = successivo.match(CIVICO_INIZIALE)
    const finaleVia = via.match(CIVICO_FINALE)

    if (CIVICO_PURO.test(precedente)) {
      // Google Places mette il civico prima della via: "17, Via Sile, …"
      civico = precedente
    } else if (CIVICO_PURO.test(successivo)) {
      // Formato CIVA: "VIA DOSA, 30, …"
      civico = successivo
    } else if (inizialeSuccessivo) {
      // "Via Postumia Ovest, 78 San Floriano, …"
      civico = inizialeSuccessivo[1]
    } else if (finaleVia) {
      // "Via Bianchi 7"
      via = finaleVia[1]
      civico = finaleVia[2]
    }
  }

  return { via, civico }
}

/**
 * Formato Google Places: "[luogo, ][civico, ]via[, frazioni…], comune, provincia, regione, CAP, Italia".
 * Il numero di segmenti intermedi è variabile, quindi i campi si contano dalla coda.
 * Se la coda non ha la forma attesa (CAP + regione) il formato non è riconosciuto.
 */
function parseGooglePlaces(segmenti: string[]): IndirizzoScomposto | null {
  const resto = segmenti.slice(0, -1) // via "Italia"

  const capSeg = resto[resto.length - 1]
  if (!capSeg || !/^\d{5}$/.test(capSeg)) return null
  const cap = capSeg
  resto.pop()

  const regioneSeg = resto[resto.length - 1]
  if (!regioneSeg || !isRegione(regioneSeg)) return null
  resto.pop()

  if (resto.length === 0) return null
  const provincia = nomeProvincia(resto.pop() as string)

  let comune = ''
  let civico = ''
  const candidato = resto[resto.length - 1]
  if (candidato && !isStrada(candidato)) {
    resto.pop()
    const conCivico = candidato.match(CIVICO_INIZIALE)
    // "Via G. La Pira, 14 Camposampiero, …": il civico è appiccicato al comune.
    const nome = conCivico ? conCivico[2] : candidato
    if (conCivico) civico = conCivico[1]
    // Nelle città metropolitane Google inserisce la circoscrizione al posto del comune:
    // il comune non è determinabile dalla struttura, meglio lasciarlo vuoto.
    if (!SUDDIVISIONI.test(nome) && !/^\d+$/.test(nome)) comune = nome
  }

  const { via, civico: civicoFinale } = estraiViaECivico(resto, civico)

  if (!via && !comune) return null
  return { via, numero_civico: civicoFinale, cap, comune, provincia }
}

/**
 * Formato CIVA e varianti digitate a mano: "VIA X[, civico], [CAP ]COMUNE[, (PR)]".
 * Serve almeno un ancoraggio (CAP o sigla di provincia) per fidarsi della scomposizione:
 * senza, il testo dopo la via può essere tanto un comune quanto un'indicazione interna.
 */
function parseFormatoCiva(segmenti: string[]): IndirizzoScomposto | null {
  const resto = [...segmenti]
  let provincia = ''
  let comune = ''
  let cap = ''
  let civico = ''

  const ultimo = resto[resto.length - 1]
  const soloSigla = ultimo.match(PROVINCIA_SEGMENTO)
  const siglaInCoda = ultimo.match(PROVINCIA_IN_CODA)
  if (soloSigla) {
    provincia = soloSigla[1].toUpperCase()
    resto.pop()
  } else if (siglaInCoda) {
    provincia = siglaInCoda[2].toUpperCase()
    if (siglaInCoda[1]) resto[resto.length - 1] = siglaInCoda[1]
    else resto.pop()
  }

  const coda = resto[resto.length - 1]
  const conCap = coda?.match(CAP_E_COMUNE)
  if (conCap) {
    civico = conCap[1] || ''
    cap = conCap[2]
    comune = conCap[3]
    resto.pop()
  } else if (provincia && resto.length > 1 && coda && !isStrada(coda) && !/\d/.test(coda)) {
    // "Via Toscana 14, Paese (TV)": senza CAP, ma la sigla di provincia identifica il comune.
    comune = coda
    resto.pop()
  }

  if (!cap && !provincia) return null

  const { via, civico: civicoFinale } = estraiViaECivico(resto, civico)

  // Se nessun segmento residuo somiglia a una via, non si scarta il testo: finisce
  // integralmente nel campo "Indirizzo" così l'operatore lo vede.
  const viaFinale = via || resto.join(', ')

  return { via: viaFinale, numero_civico: civicoFinale, cap, comune, provincia }
}

/**
 * Scompone un indirizzo libero nei campi della scheda CIVA.
 * Se il formato non è riconosciuto restituisce l'indirizzo integrale in `via`.
 */
export function parseIndirizzo(indirizzo: string | null | undefined): IndirizzoScomposto {
  if (!indirizzo || !indirizzo.trim()) return { ...VUOTO }

  const normalizzato = indirizzo.replace(/\s+/g, ' ').trim()
  const segmenti = normalizzato.split(',').map(s => s.trim()).filter(Boolean)

  const fallback: IndirizzoScomposto = { ...VUOTO, via: normalizzato }
  if (segmenti.length === 0) return { ...VUOTO }

  const esito = /^ital(?:ia|y)$/i.test(segmenti[segmenti.length - 1])
    ? parseGooglePlaces(segmenti)
    : parseFormatoCiva(segmenti)

  return esito ?? fallback
}
