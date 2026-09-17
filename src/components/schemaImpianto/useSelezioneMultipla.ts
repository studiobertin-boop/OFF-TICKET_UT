/**
 * La selezione multipla dell'editor: quella di React Flow (nodi e archi, flag `selected` nello
 * stato) più quella propria di testi, aree, frecce di direzione e muro (`ElementoLibero[]`). Le due
 * restano separate — React Flow non conosce le annotazioni — ma agiscono come un gruppo solo:
 * si spostano insieme e si cancellano insieme, in UNA voce di cronologia.
 *
 * Gli helper puri in testa sono provati in `__tests__/useSelezioneMultipla.test.ts`; l'hook in
 * fondo è cablaggio (CLAUDE.md: niente test di interfaccia).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import {
  chiaveElemento,
  elementiNelRiquadro,
  gruppoVuoto,
  posizioniSpostate,
  riquadroDaPunti,
  selezioneDopoPressione,
  type ElementoLibero,
  type FrecciaPosata,
  type PosizioniGruppo,
} from '@/services/schemaImpianto/selezione'
import type { Punto } from '@/services/schemaImpianto/tratti'
import type { SchemaArea, SchemaTestoLibero } from '@/services/schemaImpianto/types'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'

export interface StatoSelezionabile {
  nodes: Node[]
  edges: Edge[]
  testi: SchemaTestoLibero[]
  aree: SchemaArea[]
  muroX: number | null
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

function idsLiberi(libere: ElementoLibero[], tipo: 'testo' | 'area'): Set<string> {
  return new Set(libere.flatMap((e) => (e.tipo === tipo ? [e.id] : [])))
}

export function originiDelGruppo(s: StatoSelezionabile, libere: ElementoLibero[]): PosizioniGruppo {
  const testi = idsLiberi(libere, 'testo')
  const aree = idsLiberi(libere, 'area')
  return {
    nodi: Object.fromEntries(s.nodes.filter((n) => n.selected).map((n) => [n.id, { ...n.position }])),
    testi: Object.fromEntries(s.testi.filter((t) => testi.has(t.id)).map((t) => [t.id, { x: t.x, y: t.y }])),
    aree: Object.fromEntries(s.aree.filter((a) => aree.has(a.id)).map((a) => [a.id, { x: a.x, y: a.y }])),
  }
}

/** Scrive le posizioni date; ciò che non compare in `p` resta lo stesso oggetto. */
export function statoConPosizioni<T extends StatoSelezionabile>(s: T, p: PosizioniGruppo): T {
  return {
    ...s,
    nodes: s.nodes.map((n) => (p.nodi[n.id] ? { ...n, position: p.nodi[n.id] } : n)),
    testi: s.testi.map((t) => (p.testi[t.id] ? { ...t, ...p.testi[t.id] } : t)),
    aree: s.aree.map((a) => (p.aree[a.id] ? { ...a, ...p.aree[a.id] } : a)),
  }
}

export function selezioneVuota(s: StatoSelezionabile, libere: ElementoLibero[]): boolean {
  return libere.length === 0 && !s.nodes.some((n) => n.selected) && !s.edges.some((e) => e.selected)
}

/**
 * Tutto il selezionato tolto in un solo stato — e quindi in una sola voce di cronologia. Fino al
 * 17-09-2026 il Canc passava da DUE strade (react-flow per nodi e archi, un listener su `window`
 * per muro e testi): con una selezione mista un Ctrl+Z ne annullava metà.
 */
export function statoSenzaSelezione<T extends StatoSelezionabile>(s: T, libere: ElementoLibero[]): T {
  const nodi = new Set(s.nodes.filter((n) => n.selected).map((n) => n.id))
  const archi = new Set(s.edges.filter((e) => e.selected).map((e) => e.id))
  const testi = idsLiberi(libere, 'testo')
  const aree = idsLiberi(libere, 'area')
  const frecce = new Map<string, Set<string>>()
  for (const e of libere) if (e.tipo === 'freccia') frecce.set(e.arco, new Set([...(frecce.get(e.arco) ?? []), e.segno]))
  const muro = libere.some((e) => e.tipo === 'muro')
  return {
    ...s,
    nodes: s.nodes.filter((n) => !nodi.has(n.id)),
    // Un'apparecchiatura rimossa si porta via le tubazioni che vi arrivavano (come `eliminaSelezione` di prima).
    edges: s.edges
      .filter((e) => !archi.has(e.id) && !nodi.has(e.source) && !nodi.has(e.target))
      .map((e) => {
        const via = frecce.get(e.id)
        if (!via) return e
        const data = e.data as SchemaEdgeData
        return { ...e, data: { ...data, segni: (data.segni ?? []).filter((g) => !via.has(g.id)) } satisfies SchemaEdgeData }
      }),
    testi: s.testi.filter((t) => !testi.has(t.id)),
    aree: s.aree.filter((a) => !aree.has(a.id)),
    muroX: muro ? null : s.muroX,
  }
}

/** La selezione libera ripulita da ciò che non esiste più (Ctrl+Z, eliminazione dal dialogo). */
export function libereEsistenti(s: StatoSelezionabile, libere: ElementoLibero[]): ElementoLibero[] {
  return libere.filter((e) => {
    switch (e.tipo) {
      case 'muro':
        return s.muroX !== null
      case 'testo':
        return s.testi.some((t) => t.id === e.id)
      case 'area':
        return s.aree.some((a) => a.id === e.id)
      case 'freccia': {
        const arco = s.edges.find((a) => a.id === e.arco)
        return ((arco?.data as SchemaEdgeData | undefined)?.segni ?? []).some((g) => g.id === e.segno && g.tipo === 'freccia_direzione')
      }
    }
  })
}

/**
 * Cosa era selezionato in react-flow nell'istante in cui il puntatore è sceso sulla tela, e se Ctrl
 * era premuto. Lo registra l'editor in `onPointerDownCapture` sul contenitore della tela, cioè PRIMA
 * che react-flow cambi la selezione per conto suo: dopo non si potrebbe più sapere se il nodo
 * afferrato faceva già parte del gruppo.
 */
export interface PressioneSullaTela {
  nodi: Set<string>
  archi: Set<string>
  aggiungi: boolean
}

export function useSelezioneMultipla<T extends StatoSelezionabile>(
  stato: T,
  applica: Aggiorna<T>,
  aggiornaSenzaCronologia: Aggiorna<T>
) {
  const [libere, setLibere] = useState<ElementoLibero[]>([])
  // I gestori dei gesti leggono selezione e stato da qui, non dalla chiusura del render: un gesto
  // comincia fra due render, e l'istantanea catturata può essere di quello prima.
  const libereRef = useRef(libere)
  const statoRef = useRef(stato)
  statoRef.current = stato

  const impostaLibere = useCallback((nuove: ElementoLibero[]) => {
    libereRef.current = nuove
    setLibere(nuove)
  }, [])

  const svuotaLibere = useCallback(() => {
    if (libereRef.current.length > 0) impostaLibere([])
  }, [impostaLibere])

  // Stesso gesto di prima (`deselezionaReactFlow` in SchemaEditor.tsx), ma con la guardia DENTRO
  // l'updater: restituire lo stato identico quando nulla è selezionato evita il giro a vuoto con
  // `onSelectionChange` senza dover leggere una `selezione` catturata.
  const deselezionaReactFlow = useCallback(() => {
    aggiornaSenzaCronologia((s) =>
      s.nodes.some((n) => n.selected) || s.edges.some((e) => e.selected)
        ? {
            ...s,
            nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
            edges: s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
          }
        : s
    )
  }, [aggiornaSenzaCronologia])

  /** Pressione su un testo, un'area, una freccia o il muro. */
  const premiLibero = useCallback(
    (elemento: ElementoLibero, aggiungi: boolean) => {
      const prima = libereRef.current
      const giaDentro = prima.some((e) => chiaveElemento(e) === chiaveElemento(elemento))
      // Un elemento nuovo senza Ctrl ricomincia la selezione da capo, anche quella di react-flow;
      // uno già selezionato tiene il gruppo intero, perché premere è l'inizio del trascinamento.
      if (!aggiungi && !giaDentro) deselezionaReactFlow()
      impostaLibere(selezioneDopoPressione(prima, elemento, aggiungi))
    },
    [deselezionaReactFlow, impostaLibere]
  )

  /** Clic (senza trascinamento) su un nodo o un arco: stessa regola di `premiLibero`, lato react-flow. */
  const clicSuReactFlow = useCallback(
    (id: string, tipo: 'nodo' | 'arco', pressione: PressioneSullaTela | null) => {
      if (pressione?.aggiungi) return
      const giaDentro = tipo === 'nodo' ? pressione?.nodi.has(id) : pressione?.archi.has(id)
      if (!giaDentro) svuotaLibere()
    },
    [svuotaLibere]
  )

  // Gesto di gruppo partito da un testo o da un'area. Il PRIMO evento entra in cronologia, gli altri
  // no — lo stesso principio di `spostaTesto` (useTestiLiberi.ts). Le origini si congelano lì.
  const gestoLibero = useRef<{ origini: PosizioniGruppo; afferrato: Punto } | null>(null)

  const spostaGruppoDa = useCallback(
    (afferrato: { tipo: 'testo' | 'area'; id: string }, posizione: Punto, concluso: boolean) => {
      const primo = gestoLibero.current === null
      if (primo) {
        const s = statoRef.current
        const proprio = afferrato.tipo === 'testo' ? s.testi.find((t) => t.id === afferrato.id) : s.aree.find((a) => a.id === afferrato.id)
        if (!proprio) return
        const origini = originiDelGruppo(s, libereRef.current)
        // L'afferrato si muove anche se, per una corsa fra render, non risultasse selezionato.
        ;(afferrato.tipo === 'testo' ? origini.testi : origini.aree)[afferrato.id] = { x: proprio.x, y: proprio.y }
        gestoLibero.current = { origini, afferrato: { x: proprio.x, y: proprio.y } }
      }
      const { origini, afferrato: o } = gestoLibero.current!
      const posizioni = posizioniSpostate(origini, posizione.x - o.x, posizione.y - o.y)
      if (concluso) gestoLibero.current = null
      const aggiorna = primo ? applica : aggiornaSenzaCronologia
      aggiorna((s) => statoConPosizioni(s, posizioni))
    },
    [applica, aggiornaSenzaCronologia]
  )

  // Gesto di gruppo partito da un nodo: i nodi li muove react-flow (e `onNodesChange` scrive la voce
  // di cronologia al primo evento, PRIMA di `onNodeDrag` — ordine verificato in XYDrag), qui si
  // accodano testi e aree selezionati, sempre senza cronologia: stanno nella stessa voce.
  const gestoNodi = useRef<{ origini: PosizioniGruppo; partenza: Punto } | null>(null)

  const iniziaTrascinamentoNodi = useCallback(
    (nodo: Node, pressione: PressioneSullaTela | null) => {
      gestoNodi.current = null
      if (!pressione?.aggiungi && !pressione?.nodi.has(nodo.id)) {
        // Un nodo che non era nel gruppo ricomincia la selezione: react-flow ha già tenuto solo lui.
        svuotaLibere()
        return
      }
      const { testi, aree } = originiDelGruppo(statoRef.current, libereRef.current)
      const origini = { nodi: {}, testi, aree }
      if (gruppoVuoto(origini)) return
      gestoNodi.current = { origini, partenza: { ...nodo.position } }
    },
    [svuotaLibere]
  )

  const seguiTrascinamentoNodi = useCallback(
    (nodo: Node) => {
      const g = gestoNodi.current
      if (!g) return
      const posizioni = posizioniSpostate(g.origini, nodo.position.x - g.partenza.x, nodo.position.y - g.partenza.y)
      aggiornaSenzaCronologia((s) => statoConPosizioni(s, posizioni))
    },
    [aggiornaSenzaCronologia]
  )

  const concludiTrascinamentoNodi = useCallback(
    (nodo: Node) => {
      seguiTrascinamentoNodi(nodo)
      gestoNodi.current = null
    },
    [seguiTrascinamentoNodi]
  )

  /** Frecce della tastiera: solo la prima pressione entra in cronologia (vedi il vecchio `sposta`). */
  const spostaConTastiera = useCallback(
    (dx: number, dy: number, ripetuto: boolean) => {
      if (gruppoVuoto(originiDelGruppo(statoRef.current, libereRef.current))) return
      const libereOra = libereRef.current
      const aggiorna = ripetuto ? aggiornaSenzaCronologia : applica
      aggiorna((s) => statoConPosizioni(s, posizioniSpostate(originiDelGruppo(s, libereOra), dx, dy)))
    },
    [applica, aggiornaSenzaCronologia]
  )

  const eliminaSelezione = useCallback(() => {
    const libereOra = libereRef.current
    if (selezioneVuota(statoRef.current, libereOra)) return
    applica((s) => statoSenzaSelezione(s, libereOra))
    impostaLibere([])
  }, [applica, impostaLibere])

  // Il riquadro: react-flow sceglie i suoi oggetti da sé; qui si raccolgono gli altri a fine gesto.
  const inizioRiquadro = useRef<Punto | null>(null)

  const iniziaRiquadro = useCallback(
    (punto: Punto) => {
      inizioRiquadro.current = punto
      svuotaLibere()
    },
    [svuotaLibere]
  )

  const concludiRiquadro = useCallback(
    (punto: Punto, frecce: FrecciaPosata[]) => {
      const inizio = inizioRiquadro.current
      inizioRiquadro.current = null
      if (!inizio) return
      const s = statoRef.current
      impostaLibere(elementiNelRiquadro(riquadroDaPunti(inizio, punto), { testi: s.testi, aree: s.aree, frecce }))
    },
    [impostaLibere]
  )

  // Una selezione che punta a qualcosa sparito (Ctrl+Z, «Elimina» nel dialogo del testo) si ripulisce
  // da sé: un Canc dopo consumerebbe una voce di cronologia a vuoto.
  useEffect(() => {
    const valide = libereEsistenti(stato, libere)
    if (valide.length !== libere.length) impostaLibere(valide)
  }, [stato, libere, impostaLibere])

  return {
    libere,
    impostaLibere,
    svuotaLibere,
    deselezionaReactFlow,
    premiLibero,
    clicSuReactFlow,
    spostaGruppoDa,
    iniziaTrascinamentoNodi,
    seguiTrascinamentoNodi,
    concludiTrascinamentoNodi,
    spostaConTastiera,
    eliminaSelezione,
    iniziaRiquadro,
    concludiRiquadro,
  }
}
