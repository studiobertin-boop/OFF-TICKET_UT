/**
 * Segni che vivono sulla tubazione (valvole di intercettazione, riduttori di pressione):
 * aggiungerli da un pulsante di barra, trascinarli lungo il tratto (cambia solo `t`),
 * toglierli con un doppio clic. Isolato dall'editor per lo stesso motivo di useGomiti.ts.
 */
import { useCallback, useMemo, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import type { SchemaArcoStile, SchemaSegnoTubo, SchemaSegnoTuboTipo } from '@/services/schemaImpianto/types'
import { cambioTipoTratto } from './tipoTratto'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'

interface StatoConNodiEdArchi {
  nodes: Node[]
  edges: Edge[]
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

let contatoreSegni = 0

/** Segno nuovo a metà del tratto: punto di partenza pratico, l'utente lo trascina da lì. */
export function segnoAggiunto(esistenti: SchemaSegnoTubo[] | undefined, tipo: SchemaSegnoTuboTipo): SchemaSegnoTubo[] {
  return [...(esistenti ?? []), { id: `segno-editor-${++contatoreSegni}`, tipo, t: 0.5 }]
}

export function segniSenzaIndice(segni: SchemaSegnoTubo[], indice: number): SchemaSegnoTubo[] {
  return segni.filter((_, i) => i !== indice)
}

export function useSegniTubo<T extends StatoConNodiEdArchi>(
  stato: T,
  applica: Aggiorna<T>,
  aggiornaSenzaCronologia: Aggiorna<T>
) {
  // Un gesto solo (un clic sul pulsante): sempre in cronologia, come creare un gomito.
  const aggiungiSegno = useCallback(
    (arcoId: string, tipo: SchemaSegnoTuboTipo) => {
      applica((s) => ({
        ...s,
        edges: s.edges.map((e) =>
          e.id !== arcoId
            ? e
            : {
                ...e,
                data: {
                  ...(e.data as SchemaEdgeData),
                  segni: segnoAggiunto((e.data as SchemaEdgeData).segni, tipo),
                } satisfies SchemaEdgeData,
              }
        ),
      }))
    },
    [applica]
  )

  // Stesso principio del trascinamento del gomito: il PRIMO evento del gesto entra in
  // cronologia, i successivi no (vedi useGomiti.ts, spostaGomito).
  const trascinamentoSegnoAvviato = useRef(false)

  const spostaSegno = useCallback(
    (arcoId: string, indice: number, nuovaT: number, concluso: boolean) => {
      const primoEventoDelGesto = !trascinamentoSegnoAvviato.current
      trascinamentoSegnoAvviato.current = !concluso
      const aggiorna = primoEventoDelGesto ? applica : aggiornaSenzaCronologia
      aggiorna((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const segni = [...((e.data as SchemaEdgeData).segni ?? [])]
          if (!segni[indice]) return e
          segni[indice] = { ...segni[indice], t: Math.max(0, Math.min(1, nuovaT)) }
          return { ...e, data: { ...(e.data as SchemaEdgeData), segni } satisfies SchemaEdgeData }
        }),
      }))
    },
    [applica, aggiornaSenzaCronologia]
  )

  const rimuoviSegno = useCallback(
    (arcoId: string, indice: number) => {
      applica((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const segni = segniSenzaIndice((e.data as SchemaEdgeData).segni ?? [], indice)
          return { ...e, data: { ...(e.data as SchemaEdgeData), segni } satisfies SchemaEdgeData }
        }),
      }))
    },
    [applica]
  )

  // Un gesto solo (una voce di menu): sempre in cronologia, come aggiungere o togliere un segno.
  // DOVE va scritto il tipo lo decide `cambioTipoTratto` (tipoTratto.ts), che è provabile: qui
  // resta solo l'applicazione allo stato.
  const cambiaTipoTratto = useCallback(
    (arcoId: string, indice: number, lato: 'da' | 'a', stile: SchemaArcoStile) => {
      applica((s) => ({
        ...s,
        edges: s.edges.map((e) => {
          if (e.id !== arcoId) return e
          const dati = e.data as SchemaEdgeData
          const esito = cambioTipoTratto(dati.stile, dati.segni ?? [], indice, lato, stile)
          return {
            ...e,
            data: { ...dati, stile: esito.stileArco, segni: esito.segni } satisfies SchemaEdgeData,
          }
        }),
      }))
    },
    [applica]
  )

  // Gli archi passati alla tela portano anche le callback dei segni, legate al proprio id:
  // `SchemaEdgeTubazione` non conosce la cronologia, sa solo chiamare "sposta questo" o
  // "togli questo". La conversione punto->t la fa SchemaEdgeTubazione (conosce la polilinea
  // resa, con gomiti e ancore): qui arriva già la `t`, non un punto schermo.
  const edgesConSegni = useMemo(
    () =>
      stato.edges.map((e) => ({
        ...e,
        data: {
          ...(e.data as SchemaEdgeData),
          onSpostaSegno: (indice: number, t: number, concluso: boolean) => spostaSegno(e.id, indice, t, concluso),
          onRimuoviSegno: (indice: number) => rimuoviSegno(e.id, indice),
          onCambiaTipoTratto: (indice: number, lato: 'da' | 'a', stile: SchemaArcoStile) =>
            cambiaTipoTratto(e.id, indice, lato, stile),
        } satisfies SchemaEdgeData,
      })),
    [stato.edges, spostaSegno, rimuoviSegno, cambiaTipoTratto]
  )

  return { aggiungiSegno, cambiaTipoTratto, edgesConSegni }
}
