/**
 * Editor dello schema d'impianto: corregge la proposta generata automaticamente prima che
 * finisca in relazione. Copre ciò che i dati della scheda non sanno — dove stanno bypass e
 * valvole aggiuntive, quali tratti sono flessibili o linee condense, e la sistemazione fine
 * del layout. Per i casi fuori portata resta l'upload del disegno AutoCAD.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Box, Button, Divider, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import { Undo as UndoIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material'
import { DIMENSIONI_NODO } from '@/services/schemaImpianto/layout'
import type { SchemaArcoStile, SchemaLayout, SchemaNodoTipo } from '@/services/schemaImpianto/types'
import { SchemaEdgeTubazione, type SchemaEdgeData } from './SchemaEdgeTubazione'
import { SchemaNodeSymbol, type SchemaNodeData } from './SchemaNodeSymbol'
import { TIPO_ARCO_FLOW, TIPO_NODO_FLOW, attacchiPerStile, flowALayout, layoutAFlow } from './conversioneFlow'
import { useSchemaHistory } from './useSchemaHistory'

const tipiNodo = { [TIPO_NODO_FLOW]: SchemaNodeSymbol }
const tipiArco = { [TIPO_ARCO_FLOW]: SchemaEdgeTubazione }

/** Apparecchiature aggiungibili a mano: quelle che la scheda dati non può dedurre da sola. */
const PALETTE: { tipo: SchemaNodoTipo; etichetta: string; prefisso: string }[] = [
  { tipo: 'serbatoio', etichetta: 'Serbatoio', prefisso: 'S' },
  { tipo: 'filtro', etichetta: 'Filtro', prefisso: 'F' },
  { tipo: 'essiccatore', etichetta: 'Essiccatore', prefisso: 'E' },
  { tipo: 'separatore', etichetta: 'Separatore', prefisso: 'SEP' },
  { tipo: 'tanica', etichetta: 'Raccolta condense', prefisso: 'T' },
  { tipo: 'pacco_bombole', etichetta: 'Pacco bombole', prefisso: 'PB' },
]

const STILI: { valore: SchemaArcoStile; etichetta: string }[] = [
  { valore: 'standard', etichetta: 'Rigida' },
  { valore: 'flessibile', etichetta: 'Flessibile' },
  { valore: 'condensa', etichetta: 'Condense' },
]

interface StatoEditor {
  nodes: Node[]
  edges: Edge[]
}

export interface SchemaEditorProps {
  layout: SchemaLayout
  onConferma: (layout: SchemaLayout) => void
  onAnnulla: () => void
}

/** Quota più bassa occupata dal disegno: sotto di essa c'è spazio libero. */
function piedeDelDisegno(nodes: Node[]): number {
  if (nodes.length === 0) return 0
  return Math.max(
    ...nodes.map((n) => n.position.y + DIMENSIONI_NODO[(n.data as SchemaNodeData).nodo.tipo].altezza)
  )
}

/** Primo codice libero per un nuovo nodo, es. S1/S2/S3 già presenti → S4. */
function codiceLibero(prefisso: string, nodes: Node[]): string {
  const usati = new Set(nodes.map((n) => n.id))
  for (let i = 1; ; i++) {
    const codice = `${prefisso}${i}`
    if (!usati.has(codice)) return codice
  }
}

function SchemaEditorInterno({ layout, onConferma, onAnnulla }: SchemaEditorProps) {
  const iniziale = useMemo(() => layoutAFlow(layout), [layout])
  const storia = useSchemaHistory<StatoEditor>(iniziale)
  const { stato, applica, aggiornaSenzaCronologia, annulla, puoAnnullare } = storia
  const [selezione, setSelezione] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Un trascinamento produce molti eventi: solo quello conclusivo entra in cronologia,
      // altrimenti un singolo spostamento consumerebbe tutti i livelli di annullamento.
      const concludeUnGesto = changes.some(
        (c) => (c.type === 'position' && c.dragging === false) || c.type === 'remove'
      )
      const aggiorna = concludeUnGesto ? applica : aggiornaSenzaCronologia
      aggiorna((s) => ({ ...s, nodes: applyNodeChanges(changes, s.nodes) }))
    },
    [applica, aggiornaSenzaCronologia]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const concludeUnGesto = changes.some((c) => c.type === 'remove')
      const aggiorna = concludeUnGesto ? applica : aggiornaSenzaCronologia
      aggiorna((s) => ({ ...s, edges: applyEdgeChanges(changes, s.edges) }))
    },
    [applica, aggiornaSenzaCronologia]
  )

  const onConnect = useCallback(
    (connessione: Connection) => {
      applica((s) => ({
        ...s,
        edges: addEdge(
          {
            ...connessione,
            id: `manuale-${s.edges.length + 1}-${connessione.source}-${connessione.target}`,
            type: TIPO_ARCO_FLOW,
            data: { stile: 'standard' } satisfies SchemaEdgeData,
          },
          s.edges
        ),
      }))
    },
    [applica]
  )

  const aggiungiNodo = useCallback(
    (voce: (typeof PALETTE)[number]) => {
      applica((s) => {
        const id = codiceLibero(voce.prefisso, s.nodes)
        // Sotto tutto il resto: un punto fisso finirebbe sopra un'apparecchiatura già
        // disegnata, nascondendola proprio mentre si lavora.
        const posizione = { x: 40, y: piedeDelDisegno(s.nodes) + 40 }
        const nodo = {
          id,
          tipo: voce.tipo,
          etichetta: voce.etichetta,
          gruppo: 'LINEA_DISTRIBUZIONE' as const,
          valvoleSicurezza: [],
          ...posizione,
        }
        return {
          ...s,
          nodes: [
            ...s.nodes,
            { id, type: TIPO_NODO_FLOW, position: posizione, data: { nodo } satisfies SchemaNodeData },
          ],
        }
      })
    },
    [applica]
  )

  const cambiaStile = useCallback(
    (stile: SchemaArcoStile) => {
      const selezionati = new Set(selezione.edges.map((e) => e.id))
      if (selezionati.size === 0) return
      const attacchi = attacchiPerStile(stile)
      applica((s) => ({
        ...s,
        edges: s.edges.map((e) =>
          selezionati.has(e.id)
            ? {
                ...e,
                // Gli attacchi seguono lo stile: una linea condense parte dal basso, una
                // mandata di compressore sale. Cambiare solo il tratteggio lascerebbe il
                // percorso di prima, che per il nuovo stile è quello sbagliato.
                sourceHandle: attacchi.source,
                targetHandle: attacchi.target,
                data: { ...e.data, stile } satisfies SchemaEdgeData,
              }
            : e
        ),
      }))
    },
    [applica, selezione.edges]
  )

  const eliminaSelezione = useCallback(() => {
    const nodi = new Set(selezione.nodes.map((n) => n.id))
    const archi = new Set(selezione.edges.map((e) => e.id))
    if (nodi.size === 0 && archi.size === 0) return
    applica((s) => ({
      nodes: s.nodes.filter((n) => !nodi.has(n.id)),
      // Un'apparecchiatura rimossa si porta via le tubazioni che vi arrivavano, o
      // resterebbero collegamenti verso un nodo inesistente.
      edges: s.edges.filter((e) => !archi.has(e.id) && !nodi.has(e.source) && !nodi.has(e.target)),
    }))
  }, [applica, selezione])

  // Ctrl+Z sull'intera finestra: l'editor occupa tutto il dialog, e chiedere all'utente di
  // mettere prima a fuoco la tela per annullare sarebbe un tranello.
  useEffect(() => {
    const suTasto = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        annulla()
      }
    }
    window.addEventListener('keydown', suTasto)
    return () => window.removeEventListener('keydown', suTasto)
  }, [annulla])

  const stileSelezionato =
    selezione.edges.length > 0
      ? (((selezione.edges[0].data as SchemaEdgeData | undefined)?.stile ?? 'standard') as SchemaArcoStile)
      : null

  const conferma = useCallback(() => {
    onConferma(flowALayout(stato.nodes, stato.edges, layout.muro))
  }, [layout.muro, onConferma, stato.edges, stato.nodes])

  return (
    <Stack sx={{ height: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ p: 1 }}>
        <Tooltip title="Annulla l'ultima modifica (Ctrl+Z)">
          <span>
            <Button size="small" startIcon={<UndoIcon />} onClick={annulla} disabled={!puoAnnullare}>
              Annulla
            </Button>
          </span>
        </Tooltip>
        <Button
          size="small"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={eliminaSelezione}
          disabled={selezione.nodes.length === 0 && selezione.edges.length === 0}
        >
          Elimina
        </Button>

        <Divider orientation="vertical" flexItem />

        <Typography variant="caption" color="text.secondary">
          Tubazione:
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={stileSelezionato}
          onChange={(_, valore) => valore && cambiaStile(valore as SchemaArcoStile)}
          disabled={selezione.edges.length === 0}
        >
          {STILI.map((s) => (
            <ToggleButton key={s.valore} value={s.valore}>
              {s.etichetta}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem />

        <Typography variant="caption" color="text.secondary">
          Aggiungi:
        </Typography>
        {PALETTE.map((voce) => (
          <Button key={voce.tipo} size="small" startIcon={<AddIcon />} onClick={() => aggiungiNodo(voce)}>
            {voce.etichetta}
          </Button>
        ))}
      </Stack>

      <Box sx={{ flex: 1, minHeight: 360, border: 1, borderColor: 'divider' }}>
        <ReactFlow
          nodes={stato.nodes}
          edges={stato.edges}
          nodeTypes={tipiNodo}
          edgeTypes={tipiArco}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={setSelezione}
          onlyRenderVisibleElements
          fitView
          // Lo schema è un disegno tecnico: si trascina sulla griglia del CAD, non a piacere.
          snapToGrid
          snapGrid={[10, 10]}
          deleteKeyCode={['Delete', 'Backspace']}
          translateExtent={[
            [-500, -500],
            [4000, 4000],
          ]}
        >
          <Background gap={20} />
          <Controls />
        </ReactFlow>
      </Box>

      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ p: 1 }}>
        <Button onClick={onAnnulla}>Annulla modifiche</Button>
        <Button variant="contained" onClick={conferma}>
          Conferma schema
        </Button>
      </Stack>
    </Stack>
  )
}

export function SchemaEditor(props: SchemaEditorProps) {
  return (
    <ReactFlowProvider>
      <SchemaEditorInterno {...props} />
    </ReactFlowProvider>
  )
}
