/**
 * Geometria pura delle aree tratteggiate (`SchemaArea`): creazione, ridimensionamento dagli angoli,
 * scritta, ingombro. Sta fra i servizi e non nei componenti per la stessa ragione di `griglia.ts`:
 * il modulo non monta componenti nei test, e un calcolo dentro un componente non lo prova nessuno.
 *
 * Tutto ciò che si posa a mano si aggancia alla griglia sulla posizione ASSOLUTA (vedi
 * `testiConSpostamento`, useTestiLiberi.ts, per il difetto che questo evita) e non va sotto zero:
 * `renderSvg` taglia in silenzio ogni coordinata negativa.
 */
import { allineaAllaGriglia } from './griglia'
import { ingombroTesto } from './layout'
import type { SchemaArea } from './types'

export const LARGHEZZA_AREA_NUOVA = 300
export const ALTEZZA_AREA_NUOVA = 200
export const SCRITTA_AREA_NUOVA = 'AREA'
/** Dentro l'area, in alto a sinistra: una riga di scritta (corpo 20) sta sotto il bordo. */
export const SCARTO_SCRITTA_NUOVA = { dx: 10, dy: 30 }
/** Sotto questa misura le quattro maniglie degli angoli si sovrapporrebbero sulla tela. */
export const LATO_MINIMO_AREA = 40

export type AngoloArea = 'no' | 'ne' | 'so' | 'se'

function suGrigliaNonNegativo(valore: number): number {
  return Math.max(0, allineaAllaGriglia(valore))
}

/** Primo id libero, saltando quelli in uso (stesso principio di `idLibero` in useTestiLiberi.ts). */
export function idAreaLibero(aree: SchemaArea[]): string {
  const usati = new Set(aree.map((a) => a.id))
  for (let i = 1; ; i++) {
    const id = `A${i}`
    if (!usati.has(id)) return id
  }
}

/** L'id arriva da fuori: l'editor lo sceglie prima, per poter selezionare l'area appena nata. */
export function areaAggiunta(aree: SchemaArea[], id: string, posizione: { x: number; y: number }): SchemaArea[] {
  return [
    ...aree,
    {
      id,
      x: suGrigliaNonNegativo(posizione.x),
      y: suGrigliaNonNegativo(posizione.y),
      larghezza: LARGHEZZA_AREA_NUOVA,
      altezza: ALTEZZA_AREA_NUOVA,
      scritta: SCRITTA_AREA_NUOVA,
      scartoScritta: { ...SCARTO_SCRITTA_NUOVA },
    },
  ]
}

/**
 * L'angolo afferrato va sul punto (agganciato, mai negativo); l'angolo opposto resta fermo. Un
 * trascinamento oltre l'angolo opposto non ribalta il rettangolo: si ferma al lato minimo, che è
 * ciò che l'utente vede accadere sotto il puntatore.
 */
export function areaRidimensionata(area: SchemaArea, angolo: AngoloArea, punto: { x: number; y: number }): SchemaArea {
  const px = suGrigliaNonNegativo(punto.x)
  const py = suGrigliaNonNegativo(punto.y)
  let sinistra = area.x
  let alto = area.y
  let destra = area.x + area.larghezza
  let basso = area.y + area.altezza
  if (angolo === 'no' || angolo === 'so') sinistra = Math.min(px, destra - LATO_MINIMO_AREA)
  else destra = Math.max(px, sinistra + LATO_MINIMO_AREA)
  if (angolo === 'no' || angolo === 'ne') alto = Math.min(py, basso - LATO_MINIMO_AREA)
  else basso = Math.max(py, alto + LATO_MINIMO_AREA)
  return { ...area, x: sinistra, y: alto, larghezza: destra - sinistra, altezza: basso - alto }
}

export function puntoScritta(area: SchemaArea): { x: number; y: number } {
  return { x: area.x + area.scartoScritta.dx, y: area.y + area.scartoScritta.dy }
}

/** La scritta trascinata da sola: si riceve la posizione assoluta e si salva lo scarto. */
export function areeConScarto(aree: SchemaArea[], id: string, posizioneScritta: { x: number; y: number }): SchemaArea[] {
  return aree.map((a) =>
    a.id === id
      ? {
          ...a,
          scartoScritta: {
            dx: suGrigliaNonNegativo(posizioneScritta.x) - a.x,
            dy: suGrigliaNonNegativo(posizioneScritta.y) - a.y,
          },
        }
      : a
  )
}

export function areeConScritta(aree: SchemaArea[], id: string, scritta: string): SchemaArea[] {
  return aree.map((a) => (a.id === id ? { ...a, scritta } : a))
}

/**
 * Bordo destro e basso di ciò che l'area disegna, scritta compresa: serve a `renderSvg` per non
 * tagliare un'area posata oltre il disegno. La scritta si misura con `ingombroTesto`, la stessa
 * stima dei testi liberi, perché la disegna la stessa `testoMultiRiga`.
 */
export function ingombroArea(area: SchemaArea): { destra: number; basso: number } {
  const destra = area.x + area.larghezza
  const basso = area.y + area.altezza
  if (!area.scritta.trim()) return { destra, basso }
  const { x, y } = puntoScritta(area)
  const testo = ingombroTesto({ id: area.id, x, y, contenuto: area.scritta })
  return { destra: Math.max(destra, testo.destra), basso: Math.max(basso, testo.basso) }
}
