/**
 * Ctrl+C / Ctrl+V dell'editor: il ponte fra lo stato di react-flow e le funzioni pure di
 * `appunti.ts`. L'appunto vive in un ref, non nello stato: non si disegna e non va in cronologia.
 */
import { useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { appuntoDa, esitoVuoto, incollaAppunto, type Appunto, type EsitoIncolla } from '@/services/schemaImpianto/appunti'
import type { Tarature } from '@/services/schemaImpianto/libreria'
import { chiaveElemento, type ElementoLibero } from '@/services/schemaImpianto/selezione'
import { TIPO_NODO_FLOW } from './conversioneFlow'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'
import type { SchemaNodeData } from './SchemaNodeSymbol'
import type { StatoSelezionabile } from './useSelezioneMultipla'

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

export function sorgenteDaStato(s: StatoSelezionabile, libere: ElementoLibero[]): Appunto {
  // Chiave comune a `libere` (selezione.ts) invece di una stringa rifatta a mano: le due
  // rappresentazioni restano equivalenti per costruzione, non per copia manuale sincronizzata.
  const chiavi = new Set(libere.map(chiaveElemento))
  return {
    nodi: s.nodes.filter((n) => n.selected).map((n) => ({ ...(n.data as SchemaNodeData).nodo, x: n.position.x, y: n.position.y })),
    testi: s.testi.filter((t) => chiavi.has(chiaveElemento({ tipo: 'testo', id: t.id }))),
    aree: s.aree.filter((a) => chiavi.has(chiaveElemento({ tipo: 'area', id: a.id }))),
    frecce: s.edges.flatMap((e) =>
      ((e.data as SchemaEdgeData).segni ?? []).filter((g) => chiavi.has(chiaveElemento({ tipo: 'freccia', arco: e.id, segno: g.id })))
    ),
  }
}

/**
 * Lo stato dopo l'incolla. Tutto ciò che c'era esce dalla selezione, archi compresi: il tubo
 * bersaglio resta NON selezionato, o il Canc subito dopo un incolla — per togliere ciò che si è
 * appena incollato — si porterebbe via anche il tubo.
 */
export function statoConIncollato<T extends StatoSelezionabile>(s: T, esito: EsitoIncolla, arcoBersaglio: string | null, libreria: Tarature): T {
  return {
    ...s,
    nodes: [
      ...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      ...esito.nodi.map(({ x, y, ...nodo }) => ({
        id: nodo.id,
        type: TIPO_NODO_FLOW,
        position: { x, y },
        selected: true,
        data: { nodo, libreria } satisfies SchemaNodeData,
      })),
    ],
    edges: s.edges.map((e) => {
      const deselezionato = e.selected ? { ...e, selected: false } : e
      if (e.id !== arcoBersaglio || esito.frecce.length === 0) return deselezionato
      const data = e.data as SchemaEdgeData
      return { ...deselezionato, data: { ...data, segni: [...(data.segni ?? []), ...esito.frecce] } satisfies SchemaEdgeData }
    }),
    testi: [...s.testi, ...esito.testi],
    aree: [...s.aree, ...esito.aree],
  }
}

export function selezioneIncollata(esito: EsitoIncolla, arcoBersaglio: string | null): ElementoLibero[] {
  return [
    ...esito.testi.map((t): ElementoLibero => ({ tipo: 'testo', id: t.id })),
    ...esito.aree.map((a): ElementoLibero => ({ tipo: 'area', id: a.id })),
    ...(arcoBersaglio ? esito.frecce.map((f): ElementoLibero => ({ tipo: 'freccia', arco: arcoBersaglio, segno: f.id })) : []),
  ]
}

export function useAppunti<T extends StatoSelezionabile>(
  stato: T,
  applica: Aggiorna<T>,
  libere: ElementoLibero[],
  impostaLibere: (libere: ElementoLibero[]) => void,
  libreria: Tarature
) {
  const appunto = useRef<Appunto | null>(null)
  const ripetizione = useRef(0)
  const statoRef = useRef(stato)
  statoRef.current = stato
  const libereRef = useRef(libere)
  libereRef.current = libere

  const copia = useCallback(() => {
    const nuovo = appuntoDa(sorgenteDaStato(statoRef.current, libereRef.current))
    // Niente di copiabile (solo apparecchiature o tubi): l'appunto di prima resta com'era.
    if (!nuovo) return
    appunto.current = nuovo
    ripetizione.current = 0
  }, [])

  const incolla = useCallback(() => {
    const a = appunto.current
    if (!a) return
    const s = statoRef.current
    const archiSelezionati = s.edges.filter((e) => e.selected)
    const bersaglio = archiSelezionati.length === 1 ? archiSelezionati[0] : null
    ripetizione.current += 1
    const esito = incollaAppunto(
      a,
      {
        idNodi: new Set(s.nodes.map((n) => n.id)),
        idTesti: new Set(s.testi.map((t) => t.id)),
        idAree: new Set(s.aree.map((x) => x.id)),
        segniBersaglio: bersaglio ? ((bersaglio.data as SchemaEdgeData).segni ?? []) : null,
      },
      ripetizione.current
    )
    if (esito.frecceSaltate) toast('Per incollare le frecce di direzione seleziona prima un solo tubo.')
    if (esitoVuoto(esito)) return
    const idBersaglio = bersaglio?.id ?? null
    applica((corrente) => statoConIncollato(corrente, esito, idBersaglio, libreria))
    impostaLibere(selezioneIncollata(esito, idBersaglio))
  }, [applica, impostaLibere, libreria])

  return { copia, incolla }
}
