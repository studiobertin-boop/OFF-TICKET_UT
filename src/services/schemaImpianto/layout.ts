/**
 * Disposizione automatica dei nodi, in coordinate SVG (origine in alto a sinistra).
 *
 * La geometria ricalca gli schemi reali (`DOCUMENTAZIONE/relazione/*_RELAZIONE_TECNICA_*.pdf`):
 * compressori in riga in basso a sinistra, serbatoi sopra e a destra, catena di trattamento
 * aria (essiccatori/filtri) in riga verso destra, pozzo di raccolta condense in basso a
 * destra. Funzione pura: nessun DOM, testabile in Node.
 */
import { ordinaCatenaTrattamento } from './buildSchemaModel'
import type { SchemaLayout, SchemaModel, SchemaNodo, SchemaNodoPosizionato } from './types'

/**
 * Vero se il nodo riceve esclusivamente linee condense: è il segno che fa da pozzo di
 * raccolta e non da stadio di trattamento dell'aria. Si legge dagli archi invece di
 * ripetere qui la regola su `raccolta_condense`, che vive già in `buildSchemaModel`.
 */
export function riceveSoloCondensa(id: string, model: Pick<SchemaModel, 'archi'>): boolean {
  const entranti = model.archi.filter((a) => a.a === id)
  return entranti.length > 0 && entranti.every((a) => a.stile === 'condensa')
}

/**
 * Il nodo che fa da pozzo di raccolta condense. È una tanica, oppure il separatore quando è
 * lui a raccogliere: in entrambi i casi non è uno stadio della linea aria, e chi disegna deve
 * saperlo per non farne partire l'uscita verso le utenze.
 */
export function pozzoCondense<T extends SchemaNodo>(
  nodi: T[],
  archi: Pick<SchemaModel, 'archi'>
): T | null {
  return (
    nodi.find((n) => n.tipo === 'tanica' || (n.tipo === 'separatore' && riceveSoloCondensa(n.id, archi))) ??
    null
  )
}

/** Ingombri nominali per tipo, in unità SVG. Il render disegna dentro questi riquadri. */
export const DIMENSIONI_NODO: Record<SchemaNodo['tipo'], { larghezza: number; altezza: number }> = {
  compressore: { larghezza: 160, altezza: 150 },
  serbatoio: { larghezza: 150, altezza: 260 },
  essiccatore: { larghezza: 110, altezza: 110 },
  filtro: { larghezza: 110, altezza: 110 },
  separatore: { larghezza: 110, altezza: 110 },
  tanica: { larghezza: 80, altezza: 70 },
  pacco_bombole: { larghezza: 120, altezza: 100 },
}

const MARGINE = 40
/** Spazio sopra le apparecchiature: ci passano il collettore di mandata e la freccia verso le utenze. */
const MARGINE_SUPERIORE = 110
const PASSO_ORIZZONTALE = 60
/** Distanza verticale fra la riga dei compressori e quella dei serbatoi. */
const PASSO_VERTICALE = 80
/** Corsia in basso riservata alla rete di linee condense e al pozzo di raccolta. */
const CORSIA_CONDENSE = 120

function posiziona(nodo: SchemaNodo, x: number, y: number): SchemaNodoPosizionato {
  return { ...nodo, x, y }
}

/**
 * Dispone i nodi di una riga da sinistra a destra a partire da `xIniziale`, allineandoli
 * per centro verticale su `yCentro`. Ritorna i nodi posizionati e la x raggiunta.
 */
function disponiInRiga(
  nodi: SchemaNodo[],
  xIniziale: number,
  yCentro: number
): { posizionati: SchemaNodoPosizionato[]; xFinale: number } {
  let x = xIniziale
  const posizionati = nodi.map((nodo) => {
    const dim = DIMENSIONI_NODO[nodo.tipo]
    const collocato = posiziona(nodo, x, yCentro - dim.altezza / 2)
    x += dim.larghezza + PASSO_ORIZZONTALE
    return collocato
  })
  return { posizionati, xFinale: x }
}

export function layoutSchema(model: SchemaModel): SchemaLayout {
  const compressori = model.nodi.filter((n) => n.tipo === 'compressore')
  const serbatoi = model.nodi.filter((n) => n.tipo === 'serbatoio')
  // Il pozzo di raccolta condense sta nella corsia bassa: è la tanica, oppure il separatore
  // quando è lui a raccogliere (in quel caso resta fuori dalla catena di trattamento).
  const pozzo = pozzoCondense(model.nodi, model)
  const raccolta = pozzo ? [pozzo] : []
  const catena = ordinaCatenaTrattamento(model.nodi, pozzo)

  const altezzaCompressore = DIMENSIONI_NODO.compressore.altezza
  const altezzaSerbatoio = DIMENSIONI_NODO.serbatoio.altezza

  // I compressori stanno in basso a sinistra; i serbatoi, più alti, sono allineati in modo
  // che la loro base resti sulla stessa quota della base dei compressori.
  const yBase = MARGINE_SUPERIORE + altezzaSerbatoio
  const yCentroCompressori = yBase - altezzaCompressore / 2
  const yCentroSerbatoi = yBase - altezzaSerbatoio / 2

  const rigaCompressori = disponiInRiga(compressori, MARGINE, yCentroCompressori)
  const rigaSerbatoi = disponiInRiga(
    serbatoi,
    rigaCompressori.xFinale + PASSO_VERTICALE,
    yCentroSerbatoi
  )
  // La catena di trattamento sta a valle dei serbatoi, sulla stessa fascia orizzontale.
  const rigaCatena = disponiInRiga(catena, rigaSerbatoi.xFinale, yCentroSerbatoi)

  const yCondense = yBase + CORSIA_CONDENSE
  const rigaRaccolta = disponiInRiga(raccolta, Math.max(rigaCatena.xFinale, MARGINE), yCondense)

  const nodi = [
    ...rigaCompressori.posizionati,
    ...rigaSerbatoi.posizionati,
    ...rigaCatena.posizionati,
    ...rigaRaccolta.posizionati,
  ]

  // Il muro separa fisicamente la sala compressori dal resto dello stabilimento: si disegna
  // solo se esistono davvero apparecchiature da entrambe le parti.
  const inSala = nodi.filter((n) => n.gruppo === 'SALA_COMPRESSORI')
  const inLinea = nodi.filter((n) => n.gruppo === 'LINEA_DISTRIBUZIONE')
  const muro =
    inSala.length > 0 && inLinea.length > 0
      ? {
          x:
            Math.max(...inSala.map((n) => n.x + DIMENSIONI_NODO[n.tipo].larghezza)) +
            PASSO_ORIZZONTALE / 2,
          yMin: MARGINE_SUPERIORE / 2,
          yMax: yCondense + DIMENSIONI_NODO.tanica.altezza,
        }
      : null

  return { nodi, archi: model.archi, muro }
}

/**
 * Riquadro del corpo effettivamente disegnato, che nella maggior parte dei simboli è più
 * piccolo del riquadro di ingombro (che comprende etichette, valvole di sicurezza sopra e
 * valvola di scarico sotto). Le tubazioni si attaccano a questo, non all'ingombro, o
 * resterebbero staccate dal simbolo.
 */
export function corpoNodo(nodo: SchemaNodoPosizionato): {
  x: number
  y: number
  larghezza: number
  altezza: number
} {
  const dim = DIMENSIONI_NODO[nodo.tipo]

  if (nodo.tipo === 'serbatoio') {
    const orizzontale = nodo.orientamento === 'ORIZZONTALE'
    const w = orizzontale ? dim.larghezza : 84
    const h = orizzontale ? 84 : dim.altezza - 40
    return {
      x: nodo.x + (dim.larghezza - w) / 2,
      y: nodo.y + (orizzontale ? (dim.altezza - h) / 2 : 40),
      larghezza: w,
      altezza: h,
    }
  }

  if (nodo.tipo === 'essiccatore' || nodo.tipo === 'filtro' || nodo.tipo === 'separatore') {
    const semiL = dim.larghezza / 2 - 6
    const semiH = dim.altezza / 2 - 16
    return {
      x: nodo.x + dim.larghezza / 2 - semiL,
      y: nodo.y + dim.altezza / 2 - 6 - semiH,
      larghezza: semiL * 2,
      altezza: semiH * 2,
    }
  }

  if (nodo.tipo === 'tanica') {
    return { x: nodo.x + 6, y: nodo.y + 6, larghezza: dim.larghezza - 12, altezza: dim.altezza - 12 }
  }

  return { x: nodo.x, y: nodo.y, larghezza: dim.larghezza, altezza: dim.altezza }
}

/** Riquadro complessivo del disegno, usato da `renderSvg` per la viewBox. */
export function dimensioniLayout(layout: SchemaLayout): { larghezza: number; altezza: number } {
  if (layout.nodi.length === 0) return { larghezza: MARGINE * 2, altezza: MARGINE * 2 }
  const maxX = Math.max(...layout.nodi.map((n) => n.x + DIMENSIONI_NODO[n.tipo].larghezza))
  const maxY = Math.max(...layout.nodi.map((n) => n.y + DIMENSIONI_NODO[n.tipo].altezza))
  return { larghezza: maxX + MARGINE, altezza: maxY + MARGINE }
}
