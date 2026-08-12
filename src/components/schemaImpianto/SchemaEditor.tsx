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
  ViewportPortal,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Box,
  Button,
  Divider,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Undo as UndoIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Visibility as AnteprimaIcon,
  AlignHorizontalLeft as AllineaSinistraIcon,
  AlignHorizontalCenter as AllineaCentroXIcon,
  AlignHorizontalRight as AllineaDestraIcon,
  AlignVerticalTop as AllineaAltoIcon,
  AlignVerticalCenter as AllineaCentroYIcon,
  AlignVerticalBottom as AllineaBassoIcon,
} from '@mui/icons-material'
import toast from 'react-hot-toast'
import { capoValido } from '@/services/schemaImpianto/agganci'
import type { Asse, Bordo } from '@/services/schemaImpianto/allineamento'
import { DIMENSIONI_NODO } from '@/services/schemaImpianto/layout'
import { renderSvg } from '@/services/schemaImpianto/renderSvg'
import type { SchemaArcoStile, SchemaLayout, SchemaNodoTipo } from '@/services/schemaImpianto/types'
import { SchemaEdgeTubazione, type SchemaEdgeData } from './SchemaEdgeTubazione'
import { SchemaNodeSymbol, type SchemaNodeData } from './SchemaNodeSymbol'
import { TIPO_ARCO_FLOW, TIPO_NODO_FLOW, flowALayout, layoutAFlow } from './conversioneFlow'
import { GuideAllineamento } from './GuideAllineamento'
import { useAllineamentoSelezione } from './useAllineamentoSelezione'
import { useGomiti } from './useGomiti'
import { useGuideAllineamento } from './useGuideAllineamento'
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

/** Nome da mettere nel toast di rifiuto: la stessa dizione usata per le tubazioni nel disegno. */
const NOME_STILE: Record<SchemaArcoStile, string> = {
  standard: 'una tubazione rigida',
  flessibile: 'una tubazione flessibile',
  condensa: 'una linea condense',
}

/** I sei bordi/centri su cui si può allineare la selezione, con icona e dizione del tooltip. */
const ALLINEAMENTI: { bordo: Bordo; etichetta: string; Icona: typeof AllineaSinistraIcon }[] = [
  { bordo: 'sinistra', etichetta: 'Allinea a sinistra', Icona: AllineaSinistraIcon },
  { bordo: 'centroX', etichetta: 'Allinea al centro orizzontale', Icona: AllineaCentroXIcon },
  { bordo: 'destra', etichetta: 'Allinea a destra', Icona: AllineaDestraIcon },
  { bordo: 'alto', etichetta: 'Allinea in alto', Icona: AllineaAltoIcon },
  { bordo: 'centroY', etichetta: 'Allinea al centro verticale', Icona: AllineaCentroYIcon },
  { bordo: 'basso', etichetta: 'Allinea in basso', Icona: AllineaBassoIcon },
]

const DISTRIBUZIONI: { asse: Asse; etichetta: string }[] = [
  { asse: 'orizzontale', etichetta: 'Distribuisci orizzontalmente' },
  { asse: 'verticale', etichetta: 'Distribuisci verticalmente' },
]

/** Spostamento per una pressione di freccia, in pixel di griglia: coerente con `snapGrid`. */
const PASSI: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

interface StatoEditor {
  nodes: Node[]
  edges: Edge[]
}

export interface SchemaEditorProps {
  layout: SchemaLayout
  /** Le stesse note che finiranno sotto il disegno: servono a rendere l'anteprima fedele. */
  noteTubazioni?: string[]
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

function SchemaEditorInterno({ layout, noteTubazioni, onConferma, onAnnulla }: SchemaEditorProps) {
  const iniziale = useMemo(() => layoutAFlow(layout), [layout])
  const storia = useSchemaHistory<StatoEditor>(iniziale)
  const { stato, applica, aggiornaSenzaCronologia, annulla, puoAnnullare } = storia
  const [selezione, setSelezione] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })
  const [anteprimaAperta, setAnteprimaAperta] = useState(true)

  // La tela di react-flow è un'approssimazione: mostra nodi e archi, non muro, uscita verso
  // le utenze, nota e tabella, e instrada le linee a modo suo. L'anteprima qui accanto è
  // invece il disegno vero — la stessa funzione che produce il PNG del .docx — così quello
  // che si vede mentre si ritocca è quello che verrà consegnato.
  const anteprima = useMemo(() => {
    if (!anteprimaAperta) return null
    const svg = renderSvg(flowALayout(stato.nodes, stato.edges), { noteTubazioni })
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }, [anteprimaAperta, noteTubazioni, stato.edges, stato.nodes])

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

  // Creare, spostare e togliere un gomito: logica isolata in un hook suo (vedi
  // useGomiti.ts) per non far crescere ulteriormente questo file.
  const { creaGomito, edgesConGomiti } = useGomiti(stato, applica, aggiornaSenzaCronologia)

  // Guide di allineamento durante il trascinamento: stato locale, non cronologia (vedi
  // useGuideAllineamento.ts), azzerate a fine gesto in onNodeDragStop qui sotto.
  const { guide, onNodeDrag, onNodeDragStop } = useGuideAllineamento(stato.nodes)

  // Rifiuta la connessione mentre la si sta ancora trascinando, non dopo: un capo posato su
  // un'ancora che non lo accetta non deve nemmeno agganciarsi. Una tubazione nuova nasce
  // rigida, ed è lo stile con cui `onConnect` la crea.
  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      const partenza = stato.nodes.find((n) => n.id === c.source)
      const arrivo = stato.nodes.find((n) => n.id === c.target)
      if (!partenza || !arrivo) return false
      const nodoDa = (partenza.data as SchemaNodeData).nodo
      const nodoA = (arrivo.data as SchemaNodeData).nodo
      return (
        capoValido(nodoDa, c.sourceHandle ?? '', 'standard') &&
        capoValido(nodoA, c.targetHandle ?? '', 'standard')
      )
    },
    [stato.nodes]
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

  // Riaggancio di una tubazione già disegnata a un altro attacco: senza, per spostare un
  // capo bisognava cancellare la linea e ritracciarla.
  const onReconnect = useCallback(
    (vecchia: Edge, nuova: Connection) => {
      // `shouldReplaceId: false`: la tubazione resta la stessa anche se cambia un capo, e
      // conserva il suo identificativo parlante (cond-8) invece di prenderne uno generato.
      applica((s) => ({
        ...s,
        edges: reconnectEdge(vecchia, nuova, s.edges, { shouldReplaceId: false }),
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
          // Un'apparecchiatura presa dalla palette è una scelta deliberata dell'utente, non
          // qualcosa che la riconciliazione con la scheda deve poter cancellare.
          origine: 'manuale' as const,
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

      // Gli attacchi non si spostano più col cambio di stile: sono le ancore vere su cui
      // l'utente ha tracciato la tubazione. Cambiare stile ha senso solo se quelle ancore
      // accettano il nuovo fluido — altrimenti si rifiuta tutta la selezione in blocco, un
      // solo toast, e nessuna tubazione cambia: un esito misto (alcune sì, altre no)
      // lascerebbe una selezione mista dietro a un click solo, più difficile da capire.
      const rifiutata = stato.edges.find((e) => {
        if (!selezionati.has(e.id)) return false
        const partenza = stato.nodes.find((n) => n.id === e.source)
        const arrivo = stato.nodes.find((n) => n.id === e.target)
        if (!partenza || !arrivo) return true
        const nodoDa = (partenza.data as SchemaNodeData).nodo
        const nodoA = (arrivo.data as SchemaNodeData).nodo
        return !(
          capoValido(nodoDa, e.sourceHandle ?? '', stile) && capoValido(nodoA, e.targetHandle ?? '', stile)
        )
      })

      if (rifiutata) {
        toast.error(
          `Questa tubazione non può diventare ${NOME_STILE[stile]}: gli attacchi a cui è collegata non la accettano.`
        )
        return
      }

      applica((s) => ({
        ...s,
        edges: s.edges.map((e) =>
          selezionati.has(e.id) ? { ...e, data: { ...e.data, stile } satisfies SchemaEdgeData } : e
        ),
      }))
    },
    [applica, selezione.edges, stato.edges, stato.nodes]
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

  // Allineamento e distribuzione della selezione: logica isolata in un hook suo (vedi
  // useAllineamentoSelezione.ts), stesso motivo di useGomiti.ts qui sopra.
  const { applicaAllineamento, applicaDistribuzione } = useAllineamentoSelezione(selezione, applica)

  // Spostamento con le frecce. `ripetuto` distingue la prima pressione dalla ripetizione
  // automatica del tasto tenuto premuto (KeyboardEvent.repeat): solo la prima entra in
  // cronologia, così un tocco singolo resta annullabile con un solo Ctrl+Z, e tenere
  // premuta una freccia — che genera molti eventi in un secondo — non svuota la
  // cronologia (profonda solo PROFONDITA_CRONOLOGIA) consumandola con ogni passo intermedio.
  // Le ripetizioni si accumulano senza toccare la cronologia, esattamente come i tanti
  // eventi di un trascinamento col mouse in onNodesChange qui sopra: un Ctrl+Z alla fine
  // di una pressione tenuta riporta all'inizio del gesto, non a un passo intermedio.
  const sposta = useCallback(
    (dx: number, dy: number, ripetuto: boolean) => {
      const selezionati = new Set(selezione.nodes.map((n) => n.id))
      if (selezionati.size === 0) return
      const aggiorna = ripetuto ? aggiornaSenzaCronologia : applica
      aggiorna((s) => ({
        ...s,
        nodes: s.nodes.map((n) => {
          if (!selezionati.has(n.id)) return n
          const nodo = (n.data as SchemaNodeData).nodo
          const x = nodo.x + dx
          const y = nodo.y + dy
          return { ...n, position: { x, y }, data: { nodo: { ...nodo, x, y } } }
        }),
      }))
    },
    [applica, aggiornaSenzaCronologia, selezione.nodes]
  )

  // Ctrl+Z e frecce sull'intera finestra: l'editor occupa tutto il dialog, e chiedere
  // all'utente di mettere prima a fuoco la tela per annullare o spostare sarebbe un tranello.
  useEffect(() => {
    const suTasto = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        annulla()
        return
      }
      const passo = PASSI[e.key]
      if (passo && selezione.nodes.length > 0) {
        e.preventDefault()
        const fattore = e.shiftKey ? 10 : 1
        sposta(passo[0] * fattore, passo[1] * fattore, e.repeat)
      }
    }
    window.addEventListener('keydown', suTasto)
    return () => window.removeEventListener('keydown', suTasto)
  }, [annulla, selezione.nodes, sposta])

  const stileSelezionato =
    selezione.edges.length > 0
      ? (((selezione.edges[0].data as SchemaEdgeData | undefined)?.stile ?? 'standard') as SchemaArcoStile)
      : null

  const conferma = useCallback(() => {
    onConferma(flowALayout(stato.nodes, stato.edges))
  }, [onConferma, stato.edges, stato.nodes])

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
          Allinea:
        </Typography>
        {ALLINEAMENTI.map(({ bordo, etichetta, Icona }) => (
          <Tooltip key={bordo} title={etichetta}>
            <span>
              <IconButton
                size="small"
                onClick={() => applicaAllineamento(bordo)}
                disabled={selezione.nodes.length < 2}
              >
                <Icona fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        ))}
        {DISTRIBUZIONI.map(({ asse, etichetta }) => (
          <Tooltip key={asse} title={etichetta}>
            <span>
              <Button
                size="small"
                onClick={() => applicaDistribuzione(asse)}
                disabled={selezione.nodes.length < 3}
              >
                {asse === 'orizzontale' ? 'Distrib. orizz.' : 'Distrib. vert.'}
              </Button>
            </span>
          </Tooltip>
        ))}

        <Divider orientation="vertical" flexItem />

        <Typography variant="caption" color="text.secondary">
          Aggiungi:
        </Typography>
        {PALETTE.map((voce) => (
          <Button key={voce.tipo} size="small" startIcon={<AddIcon />} onClick={() => aggiungiNodo(voce)}>
            {voce.etichetta}
          </Button>
        ))}

        <Divider orientation="vertical" flexItem />

        <Button
          size="small"
          startIcon={<AnteprimaIcon />}
          onClick={() => setAnteprimaAperta((a) => !a)}
          variant={anteprimaAperta ? 'contained' : 'text'}
        >
          Anteprima
        </Button>
      </Stack>

      <Stack direction="row" sx={{ flex: 1, minHeight: 360 }}>
      <Box sx={{ flex: 1, minWidth: 0, border: 1, borderColor: 'divider' }}>
        <ReactFlow
          nodes={stato.nodes}
          edges={edgesConGomiti}
          nodeTypes={tipiNodo}
          edgeTypes={tipiArco}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onEdgeDoubleClick={creaGomito}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          isValidConnection={isValidConnection}
          onSelectionChange={setSelezione}
          onlyRenderVisibleElements
          fitView
          // Lo schema è un disegno tecnico: si trascina sulla griglia del CAD, non a piacere.
          // gap=10 sulla griglia visibile: stesso passo di snapGrid, altrimenti il disegno
          // mostrerebbe un reticolo diverso da quello a cui i nodi si agganciano davvero.
          snapToGrid
          snapGrid={[10, 10]}
          deleteKeyCode={['Delete', 'Backspace']}
          translateExtent={[
            [-500, -500],
            [4000, 4000],
          ]}
        >
          <Background gap={10} />
          <Controls />
          <ViewportPortal>
            <GuideAllineamento guide={guide} />
          </ViewportPortal>
        </ReactFlow>
      </Box>

      {anteprima && (
        <Stack
          sx={{
            width: '38%',
            minWidth: 280,
            borderTop: 1,
            borderRight: 1,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'common.white',
            overflow: 'auto',
          }}
        >
          <Box
            component="img"
            src={anteprima}
            alt="Anteprima del disegno finale"
            sx={{ width: '100%', display: 'block' }}
          />
        </Stack>
      )}
      </Stack>

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
