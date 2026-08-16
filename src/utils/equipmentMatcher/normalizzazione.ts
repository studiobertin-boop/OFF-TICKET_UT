/**
 * Forme societarie riconosciute, nella grafia canonica con cui vengono riscritte.
 *
 * Il confronto avviene sul token già ripulito dai punti: «S.p.A.», «SPA» e «S.P.A.»
 * arrivano tutte qui come `SPA`.
 */
const FORME_SOCIETARIE = new Set([
  'SPA', 'SRL', 'SRLS', 'SAS', 'SNC', 'SS',
  'GMBH', 'SE', 'NV', 'BV', 'AG', 'LTD', 'LTDA', 'INC', 'CO', 'KG', 'AB', 'OY',
])

/** Toglie i caratteri invisibili dell'OCR e uniforma spazi/maiuscole, senza toccare i punti. */
const normalizzaBase = (valore: string): string =>
  valore
    .toUpperCase()
    .replace(/[​-‍﻿]/g, '')   // zero-width dell'OCR
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Una "parola" (delimitata da spazi) fatta solo di lettere singole separate da punti:
 * `S.R.L`, `S.R.L.`, `A.S.T.R.A.`. È la sagoma di una sigla puntata.
 */
const RE_SIGLA_PUNTATA = /^[A-Z](\.[A-Z])+\.?$/

/**
 * Marca canonicalizzata **conservando** la forma societaria.
 *
 * È il livello con cui si decide se la targhetta indica una ragione sociale precisa:
 * `SICC S.p.A.` e `SICC S.r.L.` restano diverse, come devono.
 *
 * La ricomposizione delle sigle lavora parola per parola, cioè sui token separati da
 * spazi **nel testo originale** — non su un flusso di token ottenuto dopo aver già
 * trasformato i punti in spazi. È una distinzione che conta: se si scorressero i token
 * post-trasformazione, in `A.ARIA C S.r.l. (ABAC)` i token `C`, `S`, `R`, `L` risulterebbero
 * tutti adiacenti (nessuno spazio li separava più) e si fonderebbero insieme in `CSRL`,
 * inglobando la `C` di `ARIA C` che invece è un'iniziale a sé stante. Restando sulle parole
 * originali, `S.r.l.` è un'unica parola (sigla puntata) e si fonde in `SRL`, mentre `C` è
 * una parola diversa e resta isolata.
 *
 * Una parola si fonde quando è **interamente** una sigla puntata (`RE_SIGLA_PUNTATA`):
 * il risultato non deve necessariamente essere una forma societaria nota — la targhetta
 * scrive spesso `ASTRA` senza punti mentre il catalogo ha `A.S.T.R.A.`, e le due grafie
 * devono convergere sulla stessa stringa a prescindere da `FORME_SOCIETARIE`.
 * `A.ARIA` non è una sigla puntata (il secondo pezzo, `ARIA`, non è una lettera singola)
 * e si limita a perdere il punto: `A ARIA`, due parole distinte.
 */
export function normalizzaMarcaStretta(marca: string): string {
  if (!marca) return ''
  const parole = normalizzaBase(marca).split(' ')
  const fuse = parole.map((parola) =>
    RE_SIGLA_PUNTATA.test(parola) ? parola.replace(/\./g, '') : parola.replace(/\./g, ' '),
  )
  return fuse.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Marca ridotta al solo nome commerciale: forma societaria e parentetiche rimosse.
 *
 * Serve unicamente a risolvere la famiglia produttore. Non è un criterio di scarto:
 * `SICC S.p.A.` e `SICC S.r.L.` collassano qui sulla stessa stringa, ed è intenzionale.
 */
export function normalizzaMarcaFamiglia(marca: string): string {
  if (!marca) return ''
  const senzaParentesi = marca.replace(/\([^)]*\)/g, ' ')
  return normalizzaMarcaStretta(senzaParentesi)
    .split(' ')
    .filter((t) => t && !FORME_SOCIETARIE.has(t))
    .join(' ')
    .trim()
}

/**
 * Modello canonicalizzato.
 *
 * A catalogo lo stesso serbatoio compare come `500 - 12783`, `500-12783` e `725/12783`:
 * il separatore non porta informazione e va tolto di mezzo, o due grafie della stessa
 * voce si leggono come modelli diversi.
 */
export function normalizzaModello(modello: string): string {
  if (!modello) return ''
  return modello
    .toUpperCase()
    .replace(/[​-‍﻿]/g, '')
    .replace(/[-–—/_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Trigrammi di una stringa, con imbottitura ai bordi come fa `pg_trgm`. */
const trigrammi = (valore: string): Set<string> => {
  const insieme = new Set<string>()
  if (!valore) return insieme
  const imbottito = `  ${valore} `
  for (let i = 0; i < imbottito.length - 2; i++) insieme.add(imbottito.slice(i, i + 3))
  return insieme
}

/**
 * Somiglianza fra due stringhe: coefficiente di Dice sui trigrammi, 0..1.
 *
 * È la stessa misura di `pg_trgm`, qui in TypeScript perché la decisione vive nel
 * browser e dev'essere testabile senza database.
 */
export function similarita(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const ta = trigrammi(a)
  const tb = trigrammi(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let comuni = 0
  for (const t of ta) if (tb.has(t)) comuni++
  return (2 * comuni) / (ta.size + tb.size)
}
