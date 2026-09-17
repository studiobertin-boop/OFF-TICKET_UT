/**
 * Copia-incolla dell'editor, in forma pura. L'appunto vive in memoria nell'editor (`useAppunti.ts`),
 * non negli appunti di sistema: nessuna copia fra pratiche diverse, per scelta.
 *
 * Si copiano soltanto terminali «alle utenze», TEE, testi, aree e frecce di direzione. Le
 * apparecchiature no: sono dati di scheda, e una copia sarebbe un doppione senza marca né valvole
 * in tabella. I tubi no: si incollano oggetti scollegati (deciso col committente il 17-09-2026).
 */
import { codiceManualeLibero } from './codici'
import type { SchemaArea, SchemaNodoPosizionato, SchemaNodoTipo, SchemaSegnoTubo, SchemaTestoLibero } from './types'

/** Due passi di griglia: la copia si vede subito accanto all'originale, senza coprirlo. */
export const SCARTO_INCOLLA = 20

/** Tipi di nodo copiabili e il prefisso del loro codice manuale. `G` è già quello della palette. */
const PREFISSO_COPIA: Partial<Record<SchemaNodoTipo, string>> = { utenze: 'U', giunzione: 'G' }

export interface Appunto {
  nodi: SchemaNodoPosizionato[]
  testi: SchemaTestoLibero[]
  aree: SchemaArea[]
  frecce: SchemaSegnoTubo[]
}

/** Filtra ciò che si può copiare. `null` se non resta nulla: chi chiama tiene l'appunto di prima. */
export function appuntoDa(sorgente: Appunto): Appunto | null {
  const appunto: Appunto = structuredClone({
    nodi: sorgente.nodi.filter((n) => PREFISSO_COPIA[n.tipo] !== undefined),
    testi: sorgente.testi,
    aree: sorgente.aree,
    frecce: sorgente.frecce.filter((f) => f.tipo === 'freccia_direzione'),
  })
  const quanti = appunto.nodi.length + appunto.testi.length + appunto.aree.length + appunto.frecce.length
  return quanti > 0 ? appunto : null
}

export interface ContestoIncolla {
  idNodi: Set<string>
  idTesti: Set<string>
  idAree: Set<string>
  /** I segni del tubo selezionato, o `null` se non ce n'è esattamente uno. */
  segniBersaglio: SchemaSegnoTubo[] | null
}

export interface EsitoIncolla {
  nodi: SchemaNodoPosizionato[]
  testi: SchemaTestoLibero[]
  aree: SchemaArea[]
  /** Le frecce da aggiungere al tubo bersaglio, con `t` già distribuite. */
  frecce: SchemaSegnoTubo[]
  /** Vero se l'appunto aveva frecce ma non c'era un tubo su cui posarle. */
  frecceSaltate: boolean
}

function idLibero(prefisso: string, usati: Set<string>): string {
  for (let i = 1; ; i++) {
    const id = `${prefisso}${i}`
    if (!usati.has(id)) {
      usati.add(id)
      return id
    }
  }
}

/**
 * `ripetizione` parte da 1 al primo incolla dello stesso appunto e cresce a ogni Ctrl+V: le copie
 * scendono in diagonale invece di impilarsi sullo stesso punto.
 */
export function incollaAppunto(appunto: Appunto, contesto: ContestoIncolla, ripetizione: number): EsitoIncolla {
  const s = SCARTO_INCOLLA * ripetizione
  const idNodi = new Set(contesto.idNodi)
  const idTesti = new Set(contesto.idTesti)
  const idAree = new Set(contesto.idAree)

  const nodi = appunto.nodi.map((n) => {
    // Il codice scritto a mano resta dell'originale: la copia non lo eredita, e mostra il proprio
    // identificativo (M-U…/M-G…) finché non la si rinomina.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { codice: _codice, ...resto } = structuredClone(n)
    const id = codiceManualeLibero(PREFISSO_COPIA[n.tipo]!, idNodi)
    idNodi.add(id)
    return { ...resto, id, origine: 'manuale' as const, x: n.x + s, y: n.y + s }
  })
  const testi = appunto.testi.map((t) => ({ ...structuredClone(t), id: idLibero('T', idTesti), x: t.x + s, y: t.y + s }))
  const aree = appunto.aree.map((a) => ({ ...structuredClone(a), id: idLibero('A', idAree), x: a.x + s, y: a.y + s }))

  if (contesto.segniBersaglio === null) {
    return { nodi, testi, aree, frecce: [], frecceSaltate: appunto.frecce.length > 0 }
  }
  const idSegni = new Set(contesto.segniBersaglio.map((g) => g.id))
  const n = appunto.frecce.length
  // Solo tipo e posizione: `stileAValle` non vale per la freccia (types.ts) e un `ancoraggio`
  // parlerebbe dei vertici del tubo d'origine, non di questo.
  const frecce = appunto.frecce.map((_, i): SchemaSegnoTubo => ({
    id: idLibero('freccia-', idSegni),
    tipo: 'freccia_direzione',
    t: (i + 1) / (n + 1),
  }))
  return { nodi, testi, aree, frecce, frecceSaltate: false }
}

export function esitoVuoto(e: EsitoIncolla): boolean {
  return e.nodi.length + e.testi.length + e.aree.length + e.frecce.length === 0
}
