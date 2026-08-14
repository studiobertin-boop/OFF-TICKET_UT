import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import type { QuoteInstradamento } from '@/services/schemaImpianto/tratti'
import type { SchemaNodo, SchemaSegnoTubo } from '@/services/schemaImpianto/types'
import type { CapiArco } from '../conversioneFlow'
import type { SchemaEdgeData } from '../SchemaEdgeTubazione'
import { useInserimentoTee } from '../useInserimentoTee'
import { useSchemaHistory } from '../useSchemaHistory'

/**
 * Un impianto ridotto all'osso: due nodi qualunque collegati da un tubo `standard`, più un TEE
 * libero. I capi dell'arco sono passati espliciti (come fa `SchemaEditor` con `capiDegliArchi`),
 * quindi la geometria dei due nodi di estremità non conta: conta solo la polilinea che ne esce,
 * `rottaLinea` fra (0,0) e (300,100) — la stessa ROTTA dei test di `inserimentoTee`.
 */
interface Stato {
  nodes: Node[]
  edges: Edge[]
}

const QUOTE: QuoteInstradamento = { yCollettore: -100, yCorsiaCondense: 400 }
const CAPI = new Map<string, CapiArco>([['std-1', { da: { x: 0, y: 0 }, a: { x: 300, y: 100 } }]])

function nodoDati(id: string, tipo: SchemaNodo['tipo']): { nodo: SchemaNodo } {
  return {
    nodo: { id, tipo, etichetta: id, gruppo: 'LINEA_DISTRIBUZIONE', valvoleSicurezza: [], origine: 'manuale' },
  }
}

/**
 * Il TEE parte lontano dal tubo: `position` è l'angolo del riquadro, il centro è +12/+12. `C` è
 * un quarto nodo — non una giunzione, non collegato all'unico arco — che serve solo al test J:
 * a differenza di `A` (capo dell'arco), il filtro `source`/`target` di `candidati` non lo
 * esclude, quindi è l'unico modo di provare la guardia `eUnaGiunzione` in isolamento.
 */
function statoIniziale(segni?: SchemaSegnoTubo[]): Stato {
  return {
    nodes: [
      { id: 'A', type: 'simbolo', position: { x: 0, y: 0 }, data: nodoDati('A', 'compressore') },
      { id: 'B', type: 'simbolo', position: { x: 300, y: 100 }, data: nodoDati('B', 'serbatoio') },
      { id: 'M-G1', type: 'simbolo', position: { x: 600, y: 600 }, data: nodoDati('M-G1', 'giunzione') },
      { id: 'C', type: 'simbolo', position: { x: 900, y: 900 }, data: nodoDati('C', 'serbatoio') },
    ],
    edges: [
      {
        id: 'std-1',
        source: 'A',
        target: 'B',
        sourceHandle: 'alto-out',
        targetHandle: 'sx',
        type: 'tubazione',
        data: { stile: 'standard', segni } satisfies SchemaEdgeData,
      },
    ],
  }
}

function monta(iniziale: Stato) {
  return renderHook(() => {
    const storia = useSchemaHistory<Stato>(iniziale)
    const inserimento = useInserimentoTee(
      storia.stato,
      storia.applica,
      storia.aggiornaSenzaCronologia,
      QUOTE,
      CAPI
    )
    return { ...storia, ...inserimento }
  })
}

type Hook = ReturnType<typeof monta>

/**
 * Sposta il TEE (come farebbe `applyNodeChanges` durante il trascinamento) e notifica l'hook.
 * Il primo movimento del gesto entra in cronologia con `applica`, non con
 * `aggiornaSenzaCronologia`: è ciò che fa davvero `onNodesChange` (SchemaEditor.tsx) al primo
 * evento di posizione di un trascinamento. Riprodurlo qui rende la dipendenza dell'hook da
 * quella regola una proprietà guardata da un test (il test E, sotto), non un'assunzione
 * nascosta nel banco.
 */
function trascina(hook: Hook, verso: { x: number; y: number }) {
  act(() => {
    const tee = hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!
    hook.result.current.iniziaTrascinamento(tee)
    hook.result.current.applica((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === 'M-G1' ? { ...n, position: verso } : n)),
    }))
  })
  act(() => {
    const tee = hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!
    hook.result.current.seguiTrascinamento(tee, [tee])
  })
}

function rilascia(hook: Hook) {
  act(() => {
    const tee = hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!
    hook.result.current.concludiTrascinamento(tee, [tee])
  })
}

function archi(hook: Hook): Edge[] {
  return hook.result.current.stato.edges
}

describe('useInserimentoTee', () => {
  // Il TEE va portato col CENTRO sul montante verticale (x=150): position = centro − (12,12).
  const SUL_MONTANTE = { x: 138, y: 38 }

  it('A. il tubo sotto il TEE si evidenzia mentre lo si trascina, e si spegne quando ci si allontana', () => {
    const hook = monta(statoIniziale())
    trascina(hook, SUL_MONTANTE)
    expect(hook.result.current.arcoEvidenziato).toBe('std-1')

    trascina(hook, { x: 600, y: 600 })
    expect(hook.result.current.arcoEvidenziato).toBeNull()
  })

  it('B. al rilascio il tubo si spezza in due tratti collegati alla giunzione, che si ricentra sul tubo', () => {
    const hook = monta(statoIniziale())
    // Deliberatamente VICINO al montante ma non esattamente sopra (a differenza di
    // SUL_MONTANTE, il cui centro coincide col punto ricentrato): altrimenti "non ricentrare"
    // e "ricentrare" produrrebbero lo stesso risultato per coincidenza numerica, e questo test
    // non distinguerebbe più le due cose (verificato: con SUL_MONTANTE la mutazione 5 dello
    // Step 5 — nodo non ricentrato — non faceva cadere nessun test).
    trascina(hook, { x: 133, y: 33 }) // centro (145, 45), a 5 unità dal montante — entro tolleranza
    rilascia(hook)

    expect(archi(hook)).toHaveLength(2)
    expect(archi(hook).map((e) => e.id)).toEqual(['std-1-a', 'std-1-b'])
    // La prima metà arriva alla giunzione, la seconda ne riparte: il verso del tubo si conserva.
    expect(archi(hook)[0]).toMatchObject({ source: 'A', sourceHandle: 'alto-out', target: 'M-G1' })
    expect(archi(hook)[1]).toMatchObject({ source: 'M-G1', target: 'B', targetHandle: 'sx' })
    // Ricentrata SUL tubo: la proiezione di (145,45) sul montante è (150,45) (verificato
    // eseguendo `spezzaArco`), meno l'ancora (12, 12).
    const tee = hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!
    expect(tee.position).toEqual({ x: 138, y: 33 })
    expect(hook.result.current.arcoEvidenziato).toBeNull()
  })

  it('C. lo stile del tubo si conserva su entrambe le metà', () => {
    const hook = monta(statoIniziale())
    act(() => {
      hook.result.current.aggiornaSenzaCronologia((s) => ({
        ...s,
        edges: s.edges.map((e) => ({ ...e, data: { ...(e.data as SchemaEdgeData), stile: 'condensa' } })),
      }))
    })
    // Con lo stile 'condensa' la rotta cambia (`rottaCondensa`, non più `rottaLinea`): scende
    // dal capo A lungo x=0 fino a QUOTE.yCorsiaCondense, non più per il montante di SUL_MONTANTE
    // (che vale solo per 'standard'). Verificato eseguendo `instrada('condensa', ...)`: la rotta
    // è [(0,0),(0,400),(300,400),(300,100)], quindi il rilascio va su quel primo tratto.
    trascina(hook, { x: -12, y: 88 })
    rilascia(hook)

    expect(archi(hook).map((e) => (e.data as SchemaEdgeData).stile)).toEqual(['condensa', 'condensa'])
  })

  it('D. valvole e riduttori vanno alla metà su cui cadono', () => {
    const segni: SchemaSegnoTubo[] = [
      { id: 'v1', tipo: 'valvola_intercettazione', t: 0.25 },
      { id: 'r1', tipo: 'riduttore_pressione', t: 0.75 },
    ]
    const hook = monta(statoIniziale(segni))
    trascina(hook, SUL_MONTANTE)
    rilascia(hook)

    expect((archi(hook)[0].data as SchemaEdgeData).segni!.map((s) => s.id)).toEqual(['v1'])
    expect((archi(hook)[1].data as SchemaEdgeData).segni!.map((s) => s.id)).toEqual(['r1'])
  })

  it('E. un solo Ctrl+Z disfa tutto: il tubo torna intero e il TEE dov’era', () => {
    const hook = monta(statoIniziale())
    trascina(hook, SUL_MONTANTE)
    rilascia(hook)
    expect(archi(hook)).toHaveLength(2)

    act(() => hook.result.current.annulla())
    expect(archi(hook)).toHaveLength(1)
    expect(archi(hook)[0].id).toBe('std-1')
    expect(hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!.position).toEqual({ x: 600, y: 600 })
    expect(hook.result.current.puoAnnullare).toBe(false)
  })

  it('F. un trascinamento senza alcun evento di posizione scrive comunque una voce di cronologia', () => {
    // Il caso reale è un trascinamento che supera la soglia di clic ma resta nella stessa cella
    // di griglia — `onNodeDragStop` scatta comunque, ma nessun `onNodeDrag`/`onNodesChange` è
    // mai passato nel mezzo. Qui lo si riproduce non chiamando affatto `seguiTrascinamento`
    // prima di concludere: `aggiornaSenzaCronologia` da solo renderebbe lo spezzamento
    // irreversibile, perché non c'è alcuna voce su cui appoggiarsi.
    const iniziale = statoIniziale()
    iniziale.nodes = iniziale.nodes.map((n) => (n.id === 'M-G1' ? { ...n, position: { x: 138, y: 38 } } : n))
    const hook = monta(iniziale)

    act(() => {
      const tee = hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!
      hook.result.current.iniziaTrascinamento(tee)
      hook.result.current.concludiTrascinamento(tee, [tee])
    })

    expect(archi(hook)).toHaveLength(2)
    expect(hook.result.current.puoAnnullare).toBe(true)
    act(() => hook.result.current.annulla())
    expect(archi(hook)).toHaveLength(1)
  })

  it('G. un rilascio lontano da ogni tubo non spezza niente — resta un trascinamento normale', () => {
    const hook = monta(statoIniziale())
    trascina(hook, { x: 600, y: 300 })
    rilascia(hook)

    expect(archi(hook)).toHaveLength(1)
    // Il TEE SI È mosso (anche se non è atterrato su un tubo): è un trascinamento di nodo
    // ordinario, undoable come qualunque altro — `onNodesChange`, simulato da `trascina`, lo
    // scrive in cronologia al primo evento di posizione. `concludiTrascinamento` qui non ha
    // aggiunto nulla di suo (nessun candidato trovato): `puoAnnullare` è vero solo per il
    // movimento, e un solo Ctrl+Z lo disfa.
    expect(hook.result.current.puoAnnullare).toBe(true)
    act(() => hook.result.current.annulla())
    expect(hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!.position).toEqual({ x: 600, y: 600 })
    // Quella voce era del movimento, non di `concludiTrascinamento`: senza candidati l'hook non
    // ne aggiunge una propria, quindi dopo l'unico annulla() non ne resta più nessuna.
    expect(hook.result.current.puoAnnullare).toBe(false)
  })

  it('H. un tubo che ha già questo TEE per capo non è un candidato', () => {
    const iniziale = statoIniziale()
    iniziale.edges[0] = { ...iniziale.edges[0], target: 'M-G1', targetHandle: 'sx' }
    const hook = monta(iniziale)

    trascina(hook, SUL_MONTANTE)
    expect(hook.result.current.arcoEvidenziato).toBeNull()
    rilascia(hook)
    expect(archi(hook)).toHaveLength(1)
  })

  it('I. un trascinamento multiplo non inserisce nulla', () => {
    // Il TEE va portato SUL tubo prima della conclusione: altrimenti `arcoSotto` risponderebbe
    // `null` per la distanza (siamo lontani da qualunque tubo) anche senza il controllo su
    // `nodiTrascinati.length`, e il test non distinguerebbe più le due cause — verificato
    // vedendo questo test restare verde anche con quel controllo tolto, finché il TEE parte da
    // (600,600) invece che da sul montante.
    const hook = monta(statoIniziale())
    act(() => {
      const nodi = hook.result.current.stato.nodes.map((n) =>
        n.id === 'M-G1' ? { ...n, position: SUL_MONTANTE } : n
      )
      const tee = nodi.find((n) => n.id === 'M-G1')!
      hook.result.current.iniziaTrascinamento(tee)
      hook.result.current.concludiTrascinamento(tee, [tee, nodi[0]])
    })
    expect(archi(hook)).toHaveLength(1)
  })

  it('J. un nodo che non è una giunzione non spezza niente', () => {
    // `C` non è un capo dell'arco (a differenza di `A`, che il filtro source/target di
    // `candidati` escluderebbe comunque): isola davvero la guardia `eUnaGiunzione`, l'unica che
    // qui impedisce lo spezzamento — MA solo se la sua ancora 'sx' (quella che
    // `centroDellaGiunzione` legge per QUALUNQUE tipo di nodo) cade sul tubo. Un serbatoio non
    // ha il pallino al centro come una giunzione: la sua ancora 'sx' sta a (33,150) dal suo
    // angolo (verificato con `posizioneAncora`), non a (12,12). `SUL_MONTANTE` (calibrato sulla
    // giunzione) non basta: senza questa posizione dedicata la mutazione 6 non farebbe cadere
    // questo test, perché `arcoPiuVicino` scarterebbe già `C` per la distanza, guardia o no.
    const POSIZIONE_C_ANCORA_SX_SUL_MONTANTE = { x: 117, y: -100 }
    const hook = monta(statoIniziale())
    act(() => {
      const nodi = hook.result.current.stato.nodes.map((n) =>
        n.id === 'C' ? { ...n, position: POSIZIONE_C_ANCORA_SX_SUL_MONTANTE } : n
      )
      const serbatoio = nodi.find((n) => n.id === 'C')!
      hook.result.current.iniziaTrascinamento(serbatoio)
      hook.result.current.seguiTrascinamento(serbatoio, [serbatoio])
      hook.result.current.concludiTrascinamento(serbatoio, [serbatoio])
    })
    expect(hook.result.current.arcoEvidenziato).toBeNull()
    expect(archi(hook)).toHaveLength(1)
  })
})
