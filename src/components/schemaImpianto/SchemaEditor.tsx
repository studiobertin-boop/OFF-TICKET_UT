/**
 * Editor dello schema d'impianto: corregge la proposta generata automaticamente prima che
 * finisca in relazione. Copre ciò che i dati della scheda non sanno — dove stanno bypass e
 * valvole aggiuntive, quali tratti sono flessibili o linee condense, le annotazioni da posare
 * sul disegno e la sistemazione fine del layout. Per i casi fuori portata resta l'upload del
 * disegno AutoCAD.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
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
  Fullscreen as SchermoInteroIcon,
  FullscreenExit as SchermoInteroEsciIcon,
} from '@mui/icons-material'
import toast from 'react-hot-toast'
import { capoValido, connessioneAmmessa, stileIniziale } from '@/services/schemaImpianto/agganci'
import type { Asse, Bordo } from '@/services/schemaImpianto/allineamento'
import { PASSO_GRIGLIA, allineaAllaGriglia } from '@/services/schemaImpianto/griglia'
import { quoteInstradamento } from '@/services/schemaImpianto/layout'
import { TARATURA_NEUTRA, risolviLibreria, taraturaDi, type Tarature, type TaraturaSimbolo } from '@/services/schemaImpianto/libreria'
import { renderSvg, varchiDelMuro } from '@/services/schemaImpianto/renderSvg'
import { ancoreDi, dimensioniDi } from '@/services/schemaImpianto/symbols'
import type {
  ChiaveSimbolo,
  SchemaArcoStile,
  SchemaLayout,
  SchemaNodoPosizionato,
  SchemaNodoTipo,
  SchemaTestoLibero,
  SchemaTipoAggancio,
} from '@/services/schemaImpianto/types'
import { chiaveSimbolo } from '@/services/schemaImpianto/types'
import { BarraTaratura, DialogoUscitaTaratura, ManiglieTaratura } from './BarraTaratura'
import { DivisorioAnteprima } from './DivisorioAnteprima'
import { ManigliaRidimensiona } from './ManigliaRidimensiona'
import { MuroSeparazione } from './MuroSeparazione'
import { sopraIlBordoSinistro } from './posaNuoviOggetti'
import { LARGHEZZA_MINIMA_ANTEPRIMA, type PreferenzeEditor } from './preferenzeEditor'
import { SchemaEdgeTubazione, type SchemaEdgeData } from './SchemaEdgeTubazione'
import { SchemaNodeSymbol, type SchemaNodeData } from './SchemaNodeSymbol'
import { TIPO_ARCO_FLOW, TIPO_NODO_FLOW, capiDegliArchi, flowALayout, fondiDatiArchi, layoutAFlow } from './conversioneFlow'
import { GuideAllineamento } from './GuideAllineamento'
import { TestiLiberi } from './TestiLiberi'
import { useAllineamentoSelezione } from './useAllineamentoSelezione'
import { useGomiti } from './useGomiti'
import { useGuideAllineamento } from './useGuideAllineamento'
import { useInserimentoTee } from './useInserimentoTee'
import { ascissaProposta, useMuro } from './useMuro'
import { useSchemaHistory } from './useSchemaHistory'
import { useSegniTubo } from './useSegniTubo'
import { motivoNonTarabile, useTaratura } from './useTaratura'
import { useTestiLiberi } from './useTestiLiberi'
import { useTrascinamentoTratto } from './useTrascinamentoTratto'

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
  { tipo: 'giunzione', etichetta: 'Giunzione (TEE)', prefisso: 'G' },
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

/**
 * Direzione di una pressione di freccia: la lunghezza la mette `fattore` nel gestore `suTasto`
 * (`useEffect` qui sotto), un passo di griglia intero (cinque con Shift). Non si scende sotto
 * la griglia: il committente ha chiesto che il piazzamento sia consentito solo sui suoi punti,
 * e un passo da un'unità era il modo più rapido per uscirne senza accorgersene.
 */
const PASSI: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

/**
 * Muro e annotazioni non sono nodi di react-flow: la selezione della tela (`onSelectionChange`,
 * `selezione` qui sotto) non li vede, e serve una nozione loro. Un `id` per il testo — ce ne
 * possono essere più d'uno — nessun campo per il muro, che è unico.
 */
type SelezioneLibera = { tipo: 'muro' } | { tipo: 'testo'; id: string } | null

interface StatoEditor {
  nodes: Node[]
  edges: Edge[]
  // Le annotazioni libere non sono nodi di react-flow (nessuna ancora, nessuna tubazione può
  // attaccarcisi): vivono qui accanto a `nodes`/`edges`, si rendono nel portale della viewport
  // (TestiLiberi.tsx) e si maneggiano con `useTestiLiberi`. Stando nello stesso stato, la
  // cronologia le copre gratis, perché lavora sull'intero stato.
  testi: SchemaTestoLibero[]
  // Sola ascissa, non `SchemaMuroSeparazione`: l'altezza del muro non è un dato che l'utente
  // sceglie, si ricava dal disegno corrente (`muroDaAscissa`, layout.ts) a ogni ricostruzione
  // di `layoutCorrente`. Tenerla anche qui sarebbe una seconda fonte, destinata a divergere al
  // primo nodo spostato — stessa ragione per cui `SchemaLayout.muro` salva solo `x`.
  muroX: number | null
}

export interface SchemaEditorProps {
  layout: SchemaLayout
  /** Le stesse note che finiranno sotto il disegno: servono a rendere l'anteprima fedele. */
  noteTubazioni?: string[]
  /**
   * La libreria risolta di questa pratica (Task 5/9). Arriva come prop, non è l'editor a
   * risolverla: chi monta il dialog (`SchemaImpiantoSection`) ha già la sola `risolviLibreria`
   * della catena "generazione del documento" — se l'editor ne costruisse una propria, ci
   * sarebbero due punti di risoluzione per la stessa pratica, e un domani (Task 9, tarature di
   * pratica lette dal layout salvato che possiede la Section) potrebbero divergere in silenzio.
   * Default `{}`: nessun chiamante di produzione la passa vuota per scelta, solo perché oggi non
   * c'è altro da passare.
   */
  libreria?: Tarature
  /**
   * Il solo strato PERMANENTE della libreria (tabella `schema_simboli`), senza quello di pratica
   * che `libreria` qui sopra porta già fuso. Serve a una domanda sola, e non se ne inventi altre:
   * «se questa taratura di pratica sparisse, con quali ancore resterebbe il simbolo?» — la
   * risposta è lo strato permanente, o il registro di fabbrica se quello non ha una voce per la
   * chiave. È ciò che `tornaADefault` deve sapere PRIMA di cancellare, per non far sparire
   * un'ancora a cui è attaccata una tubazione (vedi lì).
   *
   * Non ricavabile da `libreria`: la fusione (`risolviLibreria`) è per intero e senza memoria di
   * quale strato ha vinto, quindi da fuori non si può più risalire a cosa c'era sotto.
   */
  libreriaPermanente?: Tarature
  /**
   * Vero per l'amministratore: decide se «rendi permanenti» compare nel dialogo a tre vie del
   * modo taratura, e se la spunta «cancella anche la taratura permanente» compare accanto a
   * «torna a default» — tocca ogni pratica dell'applicazione, comprese quelle già consegnate
   * (vedi `tarature.ts`). Passata come prop e non letta qui con `useAuth()`: quell'hook importa
   * `services/supabase.ts`, che senza le variabili d'ambiente lancia al solo caricamento del
   * modulo — e `codiceLibero`, funzione pura di questo stesso file, ha un test che lo importa da
   * solo, senza montare né un provider né un ambiente Supabase.
   */
  isAdmin: boolean
  /**
   * Registra l'esito del modo taratura (Task 12) sulla taratura di PRATICA: `taratura: null`
   * per «torna a default» (nessuna riga per questa chiave), altrimenti il valore scelto con
   * «rendi permanenti» (per non lasciarlo duplicato qui, vedi `rendiPermanenti` più sotto) o
   * «usa solo questa volta» (che invece lo tiene). Chi monta il dialog (`SchemaImpiantoSection`)
   * la fonde nella propria taratura di pratica e la fa arrivare fino a
   * `layoutDaPersistere`/`serializzaLayout` (persistenza.ts) al salvataggio — il filo lasciato
   * aperto dal Task 10.
   */
  onTaraturaPratica: (chiave: ChiaveSimbolo, taratura: TaraturaSimbolo | null) => void
  /**
   * Scrive (o cancella, con `taratura: null`) la taratura PERMANENTE — stessa firma di
   * `scriviTaraturaPermanente`, tarature.ts, passata qui come prop per la stessa ragione di
   * `isAdmin`: quel modulo importa anch'esso `services/supabase.ts`.
   */
  onScriviTaraturaPermanente: (chiave: ChiaveSimbolo, taratura: TaraturaSimbolo | null) => Promise<void>
  onConferma: (layout: SchemaLayout) => void
  onAnnulla: () => void
  /**
   * Le regolazioni della finestra. Le possiede chi monta il dialog (SchemaImpiantoSection),
   * perché il dialog e l'editor devono leggere gli stessi numeri: tenerne una copia qui
   * significherebbe due stati scollegati, con la finestra larga secondo l'uno e il divisorio
   * secondo l'altro.
   */
  preferenze: PreferenzeEditor
  onCambiaPreferenze: (parziale: Partial<PreferenzeEditor>) => void
}

/**
 * I nodi di react-flow ricondotti a `SchemaNodoPosizionato`, come fa già `flowALayout`
 * (conversioneFlow.ts) per l'intero layout: qui serve solo per proporre dove nasce un muro
 * nuovo (`ascissaProposta`, useMuro.ts), che lavora su quel tipo e non conosce react-flow.
 */
function nodiDi(s: { nodes: Node[] }): SchemaNodoPosizionato[] {
  return s.nodes.map((n) => ({ ...(n.data as SchemaNodeData).nodo, x: n.position.x, y: n.position.y }))
}

// I codici di scheda non hanno mai questo prefisso (S1, C1, SEP1, ...): senza, un nodo
// manuale "S2" collide con un vero S2 comparso più tardi in scheda, che la riconciliazione
// tratterebbe da lì in poi come il nodo manuale già presente — non entrerebbe mai fra gli
// `aggiunti`, e resterebbe "Serbatoio" per sempre, senza marca né valvole.
const PREFISSO_MANUALE = 'M-'

/** Primo codice libero per un nuovo nodo, es. S1/S2/S3 già presenti → M-S4. */
export function codiceLibero(prefisso: string, nodes: Node[]): string {
  const usati = new Set(nodes.map((n) => n.id))
  for (let i = 1; ; i++) {
    const codice = `${PREFISSO_MANUALE}${prefisso}${i}`
    if (!usati.has(codice)) return codice
  }
}

/**
 * Default di `SchemaEditorProps.libreria` quando il chiamante la omette. Costante di modulo, non
 * `{}` inline nella destrutturazione: un `{}` lì produrrebbe un oggetto nuovo a ogni render, e
 * gli `useMemo` che tengono `libreria` fra le dipendenze (`iniziale`, `layoutCorrente`,
 * `varchiMuro`, `quote`, `capi`, `anteprima`) la vedrebbero cambiata a ogni giro — invalidandosi
 * sempre, anche a schema fermo. Oggi non morde perché l'unico chiamante di produzione
 * (`SchemaImpiantoSection`) passa un valore già memoizzato, ma resta una trappola per il
 * prossimo che non lo facesse.
 */
const LIBRERIA_VUOTA: Tarature = {}

function SchemaEditorInterno({
  layout,
  noteTubazioni,
  libreria = LIBRERIA_VUOTA,
  libreriaPermanente = LIBRERIA_VUOTA,
  isAdmin,
  onTaraturaPratica,
  onScriviTaraturaPermanente,
  onConferma,
  onAnnulla,
  preferenze,
  onCambiaPreferenze,
}: SchemaEditorProps) {
  // `layout.muro?.x ?? null`, non `layout.muro`: lo stato porta la sola ascissa (vedi il commento
  // su `StatoEditor.muroX`), e senza questa lettura una pratica riaperta perderebbe in silenzio
  // il muro salvato — tornerebbe sempre a `null`, come prima che questo stato esistesse.
  const iniziale = useMemo(
    () => ({ ...layoutAFlow(layout, libreria), muroX: layout.muro?.x ?? null }),
    [layout, libreria]
  )
  const storia = useSchemaHistory<StatoEditor>(iniziale)
  const { stato, applica, aggiornaSenzaCronologia, annulla, puoAnnullare } = storia
  const [selezione, setSelezione] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })
  // Muro e annotazioni non sono nodi di react-flow, quindi `deleteKeyCode` non li vede e la
  // selezione della tela non li comprende: qui accanto vive la loro. In `useState` e non in
  // `StatoEditor`, che e' cio' su cui lavora la cronologia — selezionare non deve diventare un
  // passo di Ctrl+Z.
  const [selezioneLibera, setSelezioneLibera] = useState<SelezioneLibera>(null)
  const [anteprimaAperta, setAnteprimaAperta] = useState(true)

  // Il modo taratura (Task 12): id e chiave del simbolo congelati all'ENTRATA, non ricavati a
  // ogni render dalla selezione corrente — la selezione di react-flow può cambiare sotto (un
  // clic altrove, vedi `elementsSelectable={!modoTaratura}` più sotto, che comunque lo impedisce)
  // ma il bersaglio della taratura in corso non deve inseguirla: si esce sempre dal dialogo a tre
  // vie, mai perché la selezione si è spostata da sola.
  const [modoTaratura, setModoTaratura] = useState(false)
  const [nodoTaraturaId, setNodoTaraturaId] = useState<string | null>(null)
  const [chiaveTaratura, setChiaveTaratura] = useState<ChiaveSimbolo | null>(null)
  const [ancoraSelezionata, setAncoraSelezionata] = useState<string | null>(null)
  const [dialogoUscitaAperto, setDialogoUscitaAperto] = useState(false)
  // Vero mentre `rendiPermanenti`/`tornaADefault` (con la spunta admin) attendono la scrittura a
  // database: il dialogo resta aperto e i suoi pulsanti disabilitati, così un secondo clic non
  // parte in mezzo al primo (vedi DialogoUscitaTaratura, BarraTaratura.tsx).
  const [salvandoTaratura, setSalvandoTaratura] = useState(false)
  // Cronologia PROPRIA della taratura, separata da quella dell'impianto (vedi la testata di
  // useTaratura.ts): un `annulla()` qui dentro non deve disfare uno spostamento di
  // apparecchiatura fatto nel frattempo, e viceversa. Seminata a `TARATURA_NEUTRA` e RI-seminata
  // a ogni ingresso nel modo (`reimposta`, in `attivaTaratura` più sotto): niente `key`/remount,
  // `useSchemaHistory` espone già il gesto giusto per questo.
  const taraturaHook = useTaratura(TARATURA_NEUTRA)

  // Il dialog di scrittura, uno solo per due bersagli.
  //
  // «terminale»: la scritta del terminale utenze, e solo quella — le etichette delle
  // apparecchiature vengono dalla scheda dati e la riconciliazione le riscrive alla riapertura
  // (è la regola che tiene la §2.3 aggiornata quando si corregge marca o modello), quindi
  // permettere di cambiarle qui sarebbe una modifica che si perde in silenzio.
  //
  // «testo»: un'annotazione libera. Con `id` a `null` è un'annotazione che ancora non esiste:
  // si scrive prima e si crea alla conferma (vedi `confermaScrittura`).
  const [scrittura, setScrittura] = useState<{
    bersaglio: 'terminale' | 'testo'
    id: string | null
    valore: string
  } | null>(null)

  // La libreria "vista" da tutto il resto dell'editor mentre il modo taratura è acceso: la
  // stessa `libreria` (la prop — resta invariata: il risultato definitivo lo decide il dialogo a
  // tre vie, non un render intermedio) con la sola voce del simbolo in lavorazione sovrascritta
  // dalla taratura ancora in corso. Senza, l'anteprima, le quote e i capi degli archi
  // disegnerebbero una geometria diversa da quella che i pallini mostrano sulla tela nello
  // stesso istante — la stessa divergenza tela/documento che questo Blocco ha chiuso altrove,
  // qui riaperta dal modo taratura se non se ne tenesse conto.
  const libreriaEffettiva = useMemo(() => {
    if (!modoTaratura || !chiaveTaratura) return libreria
    return risolviLibreria(libreria, { [chiaveTaratura]: taraturaHook.taratura })
  }, [modoTaratura, chiaveTaratura, taraturaHook.taratura, libreria])

  // Il modello dello schema come sta adesso sulla tela. Ricostruirlo qui una volta sola, invece
  // che dentro ognuno dei calcoli qui sotto, è quel che tiene quote, capi e anteprima sullo
  // STESSO layout: sono i tre ingressi della geometria condivisa con il documento.
  const layoutCorrente = useMemo(
    () => flowALayout(stato.nodes, stato.edges, stato.testi, stato.muroX, libreriaEffettiva),
    [stato.nodes, stato.edges, stato.testi, stato.muroX, libreriaEffettiva]
  )

  // Quote a cui le tubazioni attraversano il muro: la STESSA `renderArchi` che disegna il
  // documento (`varchiDelMuro`, renderSvg.ts), non una sua imitazione — è la ragione per cui il
  // varco si apre sulla tela dove si apre nel .docx. Vuoto senza muro: `varchiDelMuro` rifarebbe
  // comunque tutto l'instradamento per un risultato che poi non si disegna.
  const varchiMuro = useMemo(
    () => (layoutCorrente.muro ? varchiDelMuro(layoutCorrente, libreriaEffettiva) : []),
    [layoutCorrente, libreriaEffettiva]
  )

  // Quote di instradamento (collettore della mandata flessibile, corsia delle condense):
  // dipendono da dove stanno TUTTI i nodi, non dal singolo arco, quindi si calcolano qui una
  // volta per aggiornamento e viaggiano nei dati di ogni arco. È la stessa funzione che usa
  // renderSvg, sullo stesso layout ricostruito dallo stato: calcolarle a modo proprio qui
  // rimetterebbe in piedi la divergenza fra tela e documento che questo blocco ha chiuso.
  // Ricalcolarle a ogni spostamento è voluto: le linee si riassestano mentre si trascina un
  // nodo, esattamente come farà il documento.
  const quote = useMemo(() => quoteInstradamento(layoutCorrente, libreriaEffettiva), [layoutCorrente, libreriaEffettiva])

  // Capi di ogni arco, dalle ancore dei nodi e con la stessa `posizioneAncora` del documento
  // (vedi `capiDegliArchi`). Viaggiano nei dati dell'arco per lo stesso motivo delle quote: il
  // componente dell'arco non ha una vista sui nodi, e quel che react-flow gli passerebbe da sé
  // (`sourceX`/`sourceY`) è il bordo dell'handle, 5 unità fuori dal centro dell'ancora.
  const capi = useMemo(() => capiDegliArchi(layoutCorrente, libreriaEffettiva), [layoutCorrente, libreriaEffettiva])

  // La tela di react-flow mostra nodi e archi — terminale utenze compreso, che dal 12-08-2026
  // è un nodo come gli altri e si ritocca qui — più le annotazioni libere, che nodi non sono e
  // vivono nel portale della viewport; non mostra invece muro, nota e tabella. Dal Blocco C1 le
  // linee hanno la stessa forma del render statico in ogni caso, con o senza gomiti imposti a
  // mano (`instrada` condivisa, vedi SchemaEdgeTubazione.tsx). L'anteprima qui accanto resta
  // comunque il giudice dell'aspetto finale — è la stessa funzione che produce il PNG del
  // .docx — perché disegna anche ciò che la tela non mostra affatto.
  const anteprima = useMemo(() => {
    if (!anteprimaAperta) return null
    const svg = renderSvg(layoutCorrente, libreriaEffettiva, { noteTubazioni })
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }, [anteprimaAperta, layoutCorrente, libreriaEffettiva, noteTubazioni])

  // Se il trascinamento in corso ha già registrato in cronologia lo stato da cui è partito:
  // senza, l'evento conclusivo (`dragging: false`) sarebbe quello che chiama `applica`, ma a
  // quel punto gli eventi intermedi (molti al secondo, ognuno un render) hanno già portato
  // `stato` — e quindi ciò che `applica` legge come "precedente" — alla posizione pressoché
  // finale: la cronologia registrerebbe come "prima del gesto" uno stato che è già il suo
  // risultato, e Ctrl+Z non riporterebbe mai al punto di partenza (per un trascinamento
  // rapido, a nessun effetto visibile). Vedi giro di riparazione 1, causa B.
  const trascinamentoNodoAvviato = useRef(false)

  // Un Canc su un'apparecchiatura collegata fa chiamare a react-flow DUE gestori: `onNodesChange`
  // con un `remove` e `onEdgesChange` con un altro, in due chiamate distinte dello stesso giro di
  // eventi. Fino al 17-08-2026 ciascuno scriveva la propria voce di cronologia, e Ctrl+Z ne
  // annullava una sola: tornava l'apparecchiatura, non le sue tubazioni.
  //
  // Stesso rimedio del trascinamento qui sopra, per la stessa ragione: la PRIMA rimozione del
  // gesto registra, le altre no. Il segnale si azzera a fine giro di eventi (`queueMicrotask`) e
  // non a tempo, così due Canc consecutivi — o un Canc subito dopo un trascinamento — restano due
  // gesti distinti e due voci distinte.
  const rimozioneAvviata = useRef(false)

  const primaRimozioneDelGesto = useCallback(() => {
    if (rimozioneAvviata.current) return false
    rimozioneAvviata.current = true
    queueMicrotask(() => {
      rimozioneAvviata.current = false
    })
    return true
  }, [])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const haEventoDiPosizione = changes.some((c) => c.type === 'position')
      const finisceOra = changes.some((c) => (c.type === 'position' && c.dragging === false) || c.type === 'remove')
      // Il PRIMO evento di posizione di un gesto entra in cronologia — non l'ultimo — perché
      // solo lì `stato` è ancora quello di partenza, non uno già spostato dagli eventi
      // intermedi. Un gesto brevissimo (un solo evento, già con dragging:false) è comunque il
      // "primo" e finisce in cronologia correttamente. `remove` è sempre un gesto a sé.
      const primoEventoDelGesto = haEventoDiPosizione && !trascinamentoNodoAvviato.current
      if (haEventoDiPosizione) trascinamentoNodoAvviato.current = !finisceOra
      // `primaRimozioneDelGesto()` ha un effetto collaterale e sta DOPO il controllo sul tipo:
      // il `&&` corto garantisce che un trascinamento non consumi il segnale delle rimozioni.
      const registraInCronologia =
        primoEventoDelGesto || (changes.some((c) => c.type === 'remove') && primaRimozioneDelGesto())
      const aggiorna = registraInCronologia ? applica : aggiornaSenzaCronologia
      // Muro invisibile al bordo alto: `dimensioniLayout` (layout.ts) misura il disegno da zero in
      // giù, quindi un'apparecchiatura trascinata sopra quota zero spariva nel .docx. Difetto
      // preesistente ai blocchi D, chiuso il 17-08-2026 vincolando il gesto invece di allargare la
      // pagina verso l'alto: allargarla cambierebbe la geometria di ogni documento generato.
      //
      // Vincola le sole coordinate: chi decide la cronologia qui sopra continua a leggere
      // `changes`, perché guarda il TIPO degli eventi e non le loro posizioni.
      const vincolate = changes.map((c) =>
        c.type === 'position' && c.position && c.position.y < 0
          ? { ...c, position: { ...c.position, y: 0 } }
          : c
      )
      aggiorna((s) => ({ ...s, nodes: applyNodeChanges(vincolate, s.nodes) }))
    },
    [applica, aggiornaSenzaCronologia, primaRimozioneDelGesto]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const concludeUnGesto = changes.some((c) => c.type === 'remove') && primaRimozioneDelGesto()
      const aggiorna = concludeUnGesto ? applica : aggiornaSenzaCronologia
      aggiorna((s) => ({ ...s, edges: applyEdgeChanges(changes, s.edges) }))
    },
    [applica, aggiornaSenzaCronologia, primaRimozioneDelGesto]
  )

  // Creare, spostare e togliere un gomito: logica isolata in un hook suo (vedi
  // useGomiti.ts) per non far crescere ulteriormente questo file.
  const { creaGomito, edgesConGomiti: edgesConGomitiBase } = useGomiti(stato, applica, aggiornaSenzaCronologia)

  // Aggiungere, spostare e togliere un segno (valvola/riduttore) sulla tubazione: logica
  // isolata in un hook suo (vedi useSegniTubo.ts), stesso motivo di useGomiti.ts qui sopra.
  const { aggiungiSegno, edgesConSegni } = useSegniTubo(stato, applica, aggiornaSenzaCronologia)

  // Trascinare in blocco un tratto dritto: logica isolata in un hook suo (vedi
  // useTrascinamentoTratto.ts), stesso motivo di useGomiti.ts qui sopra. Riceve `quote`
  // perché deve ricostruire la STESSA polilinea che il componente disegna (`instrada`), non
  // una sua approssimazione: altrimenti l'indice del tratto afferrato non torna più con quello
  // che l'utente vede (giro di riparazione 1).
  const { edgesConTrascinamento } = useTrascinamentoTratto(stato, applica, aggiornaSenzaCronologia, quote)

  // Creare, spostare, riscrivere e togliere un'annotazione libera: logica isolata in un hook suo
  // (vedi useTestiLiberi.ts), stesso motivo di useGomiti.ts qui sopra. Non riceve `stato`
  // perché, a differenza degli altri tre, non deve derivarne nulla: le annotazioni si rendono
  // da `stato.testi` qui sotto, nel portale della viewport.
  const { aggiungiTesto, spostaTesto, modificaTesto, rimuoviTesto } = useTestiLiberi<StatoEditor>(
    applica,
    aggiornaSenzaCronologia
  )

  // Aggiungere e spostare il muro di separazione: logica isolata in un hook suo (vedi
  // useMuro.ts), stesso motivo di useGomiti.ts qui sopra. Come per le annotazioni, non riceve
  // `stato`: il muro si rende da `layoutCorrente.muro` qui sotto, nel portale della viewport.
  const { aggiungiMuro, spostaMuro, rimuoviMuro } = useMuro<StatoEditor>(applica, aggiornaSenzaCronologia)

  // `edgesConGomitiBase`, `edgesConSegni` ed `edgesConTrascinamento` derivano TUTTI e tre da
  // `stato.edges` con dati aggiuntivi diversi (rispettivamente `onSpostaGomito`/
  // `onRimuoviGomito`, `onSpostaSegno`/`onRimuoviSegno`, `onTrascinaTratto`): vanno fusi, non
  // passati tutti a `<ReactFlow edges={...}>`, o l'ultimo sovrascriverebbe i precedenti. La
  // fusione vera e propria vive in `fondiDatiArchi` (conversioneFlow.ts), funzione pura e non
  // qui dentro, perché è lì che si provano le invarianti «ogni arco porta `quote`» e «ogni arco
  // porta i propri `capi`».

  // Inserire un TEE su un tubo esistente: logica isolata in un hook suo (vedi
  // useInserimentoTee.ts), stesso motivo di useGomiti.ts. Riceve `quote` e `capi` perché deve
  // ricostruire la STESSA polilinea che la tela disegna: agganciarsi a una forma diversa
  // spezzerebbe il tubo dove l'utente non l'ha puntato.
  const {
    arcoEvidenziato,
    iniziaTrascinamento: iniziaTrascinamentoTee,
    seguiTrascinamento: seguiTrascinamentoTee,
    concludiTrascinamento: concludiTrascinamentoTee,
  } = useInserimentoTee(stato, applica, aggiornaSenzaCronologia, quote, capi, libreriaEffettiva)

  // `modoTaratura` viaggia fino a ogni arco come `bloccato`: i gesti che `SchemaEdgeTubazione`
  // monta da sé (l'area di presa del tratto, le maniglie dei gomiti, quelle dei segni) non li
  // spegne `nodesDraggable`/`elementsSelectable={false}` su `<ReactFlow>`, che valgono solo per
  // i gesti gestiti da react-flow. Vedi `SchemaEdgeData.bloccato`.
  const edgesConGomiti = useMemo(
    () => fondiDatiArchi(edgesConGomitiBase, edgesConSegni, edgesConTrascinamento, quote, capi, arcoEvidenziato, modoTaratura),
    [edgesConGomitiBase, edgesConSegni, edgesConTrascinamento, quote, capi, arcoEvidenziato, modoTaratura]
  )

  // Guide di allineamento durante il trascinamento: stato locale, non cronologia (vedi
  // useGuideAllineamento.ts), azzerate a fine gesto in onNodeDragStop qui sotto.
  const { guide, onNodeDrag, onNodeDragStop } = useGuideAllineamento(stato.nodes)

  // Guide di allineamento e inserimento del TEE guardano lo stesso trascinamento: i gestori si
  // compongono, non si sostituiscono. `onNodeDragStart` non c'era: serve all'inserimento per
  // sapere se il gesto ha mosso il nodo — e quindi se `onNodesChange` ha già scritto la voce di
  // cronologia su cui appoggiarsi (vedi useInserimentoTee.ts).
  const suInizioTrascinamentoNodo = useCallback(
    (_evento: MouseEvent | TouchEvent, nodo: Node) => iniziaTrascinamentoTee(nodo),
    [iniziaTrascinamentoTee]
  )
  const suTrascinamentoNodo = useCallback(
    (evento: MouseEvent | TouchEvent, nodo: Node, nodi: Node[]) => {
      onNodeDrag(evento, nodo, nodi)
      seguiTrascinamentoTee(nodo, nodi)
    },
    [onNodeDrag, seguiTrascinamentoTee]
  )
  const suFineTrascinamentoNodo = useCallback(
    (_evento: MouseEvent | TouchEvent, nodo: Node, nodi: Node[]) => {
      onNodeDragStop()
      concludiTrascinamentoTee(nodo, nodi)
    },
    [onNodeDragStop, concludiTrascinamentoTee]
  )

  // Rifiuta la connessione mentre la si sta ancora trascinando, non dopo: un capo posato su
  // un'ancora che non lo accetta non deve nemmeno agganciarsi. Ammessa se almeno uno stile
  // (aria o condensa) è accettato da entrambi i capi — non solo 'standard', o le linee condense
  // fra capi che l'aria non l'accettano non nascerebbero mai. `onConnect` deduce poi con quale
  // stile la tubazione nasce davvero.
  const isValidConnection = useCallback(
    (c: Connection | Edge) => {
      const partenza = stato.nodes.find((n) => n.id === c.source)
      const arrivo = stato.nodes.find((n) => n.id === c.target)
      if (!partenza || !arrivo) return false
      const nodoDa = (partenza.data as SchemaNodeData).nodo
      const nodoA = (arrivo.data as SchemaNodeData).nodo
      return connessioneAmmessa(nodoDa, c.sourceHandle ?? '', nodoA, c.targetHandle ?? '', libreriaEffettiva)
    },
    [stato.nodes, libreriaEffettiva]
  )

  const onConnect = useCallback(
    (connessione: Connection) => {
      applica((s) => {
        const partenza = s.nodes.find((n) => n.id === connessione.source)
        const arrivo = s.nodes.find((n) => n.id === connessione.target)
        // Se un capo non si trova più (caso di frontiera, non dovrebbe capitare perché
        // isValidConnection ha già verificato gli stessi nodi) si ripiega su 'standard',
        // il comportamento di sempre.
        const stile =
          partenza && arrivo
            ? stileIniziale(
                (partenza.data as SchemaNodeData).nodo,
                connessione.sourceHandle ?? '',
                (arrivo.data as SchemaNodeData).nodo,
                connessione.targetHandle ?? '',
                libreriaEffettiva
              )
            : 'standard'
        return {
          ...s,
          edges: addEdge(
            {
              ...connessione,
              id: `manuale-${s.edges.length + 1}-${connessione.source}-${connessione.target}`,
              type: TIPO_ARCO_FLOW,
              data: { stile } satisfies SchemaEdgeData,
            },
            s.edges
          ),
        }
      })
    },
    [applica, libreriaEffettiva]
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
        // Accanto al bordo sinistro del disegno e sopra la sua cima, dove l'utente sta già
        // guardando: un punto fisso finirebbe sopra un'apparecchiatura già disegnata. Se sopra
        // non c'è spazio ripiega a destra del disegno, e per sapere dove il disegno finisce le
        // serve la libreria: l'ingombro di un simbolo dipende dalla sua taratura.
        const posizione = sopraIlBordoSinistro(s.nodes, s.testi, libreriaEffettiva)
        const nodo = {
          id,
          tipo: voce.tipo,
          etichetta: voce.etichetta,
          gruppo: 'LINEA_DISTRIBUZIONE' as const,
          valvoleSicurezza: [],
          // Un'apparecchiatura presa dalla palette è una scelta deliberata dell'utente, non
          // qualcosa che la riconciliazione con la scheda deve poter cancellare.
          origine: 'manuale' as const,
        }
        return {
          ...s,
          nodes: [
            ...s.nodes,
            { id, type: TIPO_NODO_FLOW, position: posizione, data: { nodo, libreria: libreriaEffettiva } satisfies SchemaNodeData },
          ],
        }
      })
    },
    [applica, libreriaEffettiva]
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
      //
      // Un capo su un nodo che non esiste più (arco orfano, vedi il difetto di `applica` nel
      // lotto React) e un attacco che non accetta il nuovo fluido sono due guasti diversi:
      // il primo si ripara eliminando la tubazione, il secondo scegliendo un altro stile.
      // Confonderli in un solo messaggio manda l'utente a controllare gli attacchi quando il
      // problema vero è altrove.
      const orfana = stato.edges.find((e) => {
        if (!selezionati.has(e.id)) return false
        const partenza = stato.nodes.find((n) => n.id === e.source)
        const arrivo = stato.nodes.find((n) => n.id === e.target)
        return !partenza || !arrivo
      })

      if (orfana) {
        toast.error(
          'Questa tubazione ha un capo su un’apparecchiatura che non esiste più: eliminala, non serve cambiarne lo stile.'
        )
        return
      }

      const rifiutata = stato.edges.find((e) => {
        if (!selezionati.has(e.id)) return false
        const partenza = stato.nodes.find((n) => n.id === e.source)!
        const arrivo = stato.nodes.find((n) => n.id === e.target)!
        const nodoDa = (partenza.data as SchemaNodeData).nodo
        const nodoA = (arrivo.data as SchemaNodeData).nodo
        return !(
          capoValido(nodoDa, e.sourceHandle ?? '', stile, libreriaEffettiva) &&
          capoValido(nodoA, e.targetHandle ?? '', stile, libreriaEffettiva)
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
    [applica, libreriaEffettiva, selezione.edges, stato.edges, stato.nodes]
  )

  /**
   * `data.libreria` dei nodi insegue SEMPRE `libreriaEffettiva`: è l'unico punto che la scrive
   * dopo la costruzione dello stato, e vale sia dentro il modo taratura (dove `libreriaEffettiva`
   * porta la geometria in corso) sia fuori (dove è la prop `libreria`, che ora può cambiare a
   * metà sessione — le tarature permanenti rilette e la taratura di pratica decisa dal dialogo a
   * tre vie arrivano proprio così).
   *
   * `data.libreria` è la sola strada per far arrivare la libreria a `SchemaNodeSymbol` (react-flow
   * istanzia i nodi da `nodeTypes`, senza un canale per props extra) e la leggono anche
   * `useGomiti`/`useAllineamentoSelezione`/`useGuideAllineamento`: per questo si scrive qui e non
   * in un contesto React parallelo che solo il nodo vedrebbe.
   *
   * Dipende ANCHE da `stato.nodes`, non solo da `libreriaEffettiva`: un Ctrl+Z sull'impianto dopo
   * una taratura ripesca dallo stack nodi con la `data.libreria` di prima, e senza questo giro il
   * simbolo tornerebbe non tarato sulla tela mentre capi, quote e anteprima restano tarati — la
   * divergenza che questo blocco ha chiuso altrove. Il ciclo si chiude perché l'updater
   * restituisce lo STESSO oggetto di stato quando non c'è nulla da cambiare: `stato.nodes` non
   * cambia identità, le dipendenze qui sotto nemmeno, e l'effetto non riparte. Restituire un
   * oggetto nuovo «uguale» — anche solo `{...s}` — basterebbe invece a farlo girare all'infinito.
   *
   * `aggiornaSenzaCronologia` e non `applica`: non è un gesto dell'utente ma il riflesso di uno
   * stato che vive altrove, e non deve consumare un passo di Ctrl+Z.
   */
  useEffect(() => {
    aggiornaSenzaCronologia((s) => {
      const nodes = s.nodes.map((n) => {
        const dati = n.data as SchemaNodeData
        const taraturaAttiva = n.id === nodoTaraturaId
        if (dati.libreria === libreriaEffettiva && (dati.taraturaAttiva ?? false) === taraturaAttiva) return n
        return { ...n, data: { ...dati, libreria: libreriaEffettiva, taraturaAttiva } satisfies SchemaNodeData }
      })
      return nodes.every((n, i) => n === s.nodes[i]) ? s : { ...s, nodes }
    })
  }, [libreriaEffettiva, nodoTaraturaId, stato.nodes, aggiornaSenzaCronologia])

  /**
   * Gli id delle ancore della chiave in taratura a cui è attaccata almeno una tubazione. Non basta
   * guardare il nodo in taratura: la taratura vale per la CHIAVE, quindi ciò che si toglie qui si
   * toglie a tutti i simboli uguali, e un tubo appeso a uno qualunque di loro resterebbe orfano
   * allo stesso modo. Serve a due gesti diversi — il Canc su un'ancora e «torna a default» — che
   * possono entrambi far sparire un'ancora sotto un tubo: sta qui sopra perché il secondo è
   * definito prima del primo.
   */
  const ancoreOccupate = useCallback(() => {
    const diQuestaChiave = new Set(
      stato.nodes.filter((n) => chiaveSimbolo((n.data as SchemaNodeData).nodo) === chiaveTaratura).map((n) => n.id)
    )
    const occupate = new Set<string>()
    for (const e of stato.edges) {
      if (e.sourceHandle && diQuestaChiave.has(e.source)) occupate.add(e.sourceHandle)
      if (e.targetHandle && diQuestaChiave.has(e.target)) occupate.add(e.targetHandle)
    }
    return occupate
  }, [stato.nodes, stato.edges, chiaveTaratura])

  /**
   * Perché il simbolo selezionato non è tarabile, `null` quando lo è (o quando la selezione non è
   * di un solo nodo: lì il pulsante è spento per l'altra ragione, e il suo titolo lo dice già).
   * Il modo taratura resta chiuso su `utenze` e `giunzione`, dove degraderebbe: vedi
   * `motivoNonTarabile` (useTaratura.ts) per il perché di ciascuno.
   */
  const motivoTaratura =
    selezione.nodes.length === 1
      ? motivoNonTarabile((selezione.nodes[0].data as SchemaNodeData).nodo.tipo)
      : null

  // Entra nel modo: seminata la cronologia PROPRIA della taratura (vedi `taraturaHook`) dalla
  // taratura corrente per quella chiave. Senza una taratura preesistente si parte dalle ancore
  // DI FABBRICA (`ancoreDi(nodo, {})`), non da `TARATURA_NEUTRA` da sola: il suo `ancore: []` è
  // il seme neutro per le funzioni pure di useTaratura.ts (dove "nessuna taratura" e "nessuna
  // ancora" sono la stessa cosa, prima che ne arrivi una), ma qui il simbolo le ancore le ha
  // già — sono quelle del registro — e partire da zero le farebbe sparire tutte finché l'utente
  // non ne aggiunge una a mano.
  const attivaTaratura = useCallback(() => {
    if (selezione.nodes.length !== 1) return
    const nodoSelezionato = selezione.nodes[0]
    const nodo = (nodoSelezionato.data as SchemaNodeData).nodo
    // Ripetuto qui e non lasciato al solo pulsante spento (`puoAttivare` qui sotto), per la stessa
    // ragione per cui `rendiPermanenti` ripete il controllo su `isAdmin`: questa è la porta, e chi
    // la chiama non deve poterla aprire per distrazione.
    if (motivoNonTarabile(nodo.tipo)) return
    const chiave = chiaveSimbolo(nodo)
    const esistente = taraturaDi(libreria, chiave)
    taraturaHook.reimposta(esistente ?? { ...TARATURA_NEUTRA, ancore: ancoreDi(nodo, {}) })
    setNodoTaraturaId(nodoSelezionato.id)
    setChiaveTaratura(chiave)
    setAncoraSelezionata(null)
    setModoTaratura(true)
  }, [selezione.nodes, libreria, taraturaHook])

  /**
   * Chiude il modo taratura. Non scrive nulla sui nodi: la geometria finale arriva dalla prop
   * `libreria` — che le tre vie del dialogo aggiornano ciascuna a modo suo, e che l'effetto di
   * sincronizzazione qui sopra riversa poi su `data.libreria` di ogni nodo.
   *
   * Prima si scriveva qui `risolviLibreria(libreria, {chiave: finale})`, e per «torna a default»
   * `risolviLibreria(libreria, {})` — che è `{...libreria}`: la voce da cancellare RESTAVA, e su
   * una pratica riaperta con una taratura salvata il nodo continuava a disegnarsi tarato mentre
   * l'anteprima tornava corretta. Non era una svista del calcolo ma della fonte: `libreria`
   * catturata qui è ancora quella di PRIMA della decisione (`onTaraturaPratica` aggiorna lo stato
   * del genitore, che torna giù al render successivo), quindi nessuna espressione costruita su di
   * lei può dire il vero. La sola fonte che dice il vero è la prop quando arriva, ed è quella che
   * ora si aspetta.
   */
  const chiudiTaratura = useCallback(() => {
    setModoTaratura(false)
    setDialogoUscitaAperto(false)
    setNodoTaraturaId(null)
    setChiaveTaratura(null)
    setAncoraSelezionata(null)
  }, [])

  /**
   * «Torna a default»: cancella sempre la taratura di QUESTA pratica; solo se l'utente è
   * amministratore e ha spuntato la casella del dialogo, cancella anche quella permanente — la
   * riga della tabella, non solo il suo effetto qui (CLAUDE.md: Claude applica le migrazioni,
   * ma qui è l'amministratore a decidere riga per riga se scriverle).
   *
   * Prima di cancellare qualsiasi cosa, la stessa guardia del Canc su un'ancora: una taratura non
   * AGGIUNGE ancore al registro, le SOSTITUISCE per intero (vedi `TaraturaSimbolo.ancore`), quindi
   * tornare al default fa sparire ogni ancora che solo lei portava. Su una pratica riaperta con
   * una taratura salvata, se un tubo è attaccato a una di quelle, questa via produceva in silenzio
   * lo stato che il Canc guardato ha appena chiuso: Handle sparito, arco vivo in `stato.edges`, e
   * nel documento il tubo attaccato al centro del simbolo.
   */
  const tornaADefault = useCallback(
    async (cancellaPermanente: boolean) => {
      if (!chiaveTaratura) return
      const chiave = chiaveTaratura

      // Con quali ancore resterebbe il simbolo dopo la cancellazione: quelle dello strato
      // permanente, o quelle di fabbrica se anche la riga permanente se ne va (o se non c'è).
      const libreriaDopo = isAdmin && cancellaPermanente ? LIBRERIA_VUOTA : libreriaPermanente
      const nodoBersaglio = stato.nodes.find((n) => n.id === nodoTaraturaId)
      if (nodoBersaglio) {
        const superstiti = new Set(ancoreDi((nodoBersaglio.data as SchemaNodeData).nodo, libreriaDopo).map((a) => a.id))
        const perdute = [...ancoreOccupate()].filter((id) => !superstiti.has(id))
        if (perdute.length > 0) {
          toast.error(
            `Tornare al default toglierebbe ${perdute.length === 1 ? 'l’ancora' : 'le ancore'} ${perdute
              .map((id) => `«${id}»`)
              .join(', ')}, a cui ${perdute.length === 1 ? 'è attaccata una tubazione' : 'sono attaccate delle tubazioni'}: stacca prima ${perdute.length === 1 ? 'quel tubo' : 'quei tubi'}.`
          )
          return
        }
      }

      if (isAdmin && cancellaPermanente) {
        setSalvandoTaratura(true)
        try {
          await onScriviTaraturaPermanente(chiave, null)
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : `Cancellazione della taratura permanente di "${chiave}" non riuscita.`
          )
          setSalvandoTaratura(false)
          return
        }
        setSalvandoTaratura(false)
      }
      onTaraturaPratica(chiave, null)
      chiudiTaratura()
    },
    [
      chiaveTaratura,
      isAdmin,
      libreriaPermanente,
      stato.nodes,
      nodoTaraturaId,
      ancoreOccupate,
      onScriviTaraturaPermanente,
      onTaraturaPratica,
      chiudiTaratura,
    ]
  )

  /**
   * «Rendi permanenti»: scrive in tabella (vale per ogni pratica) e toglie l'eventuale voce di
   * pratica per la stessa chiave — altrimenti resterebbe a fare ombra al valore permanente
   * appena scritto, la prossima volta che qualcuno la cambiasse di nuovo senza toccare questa
   * pratica. La tela mostra comunque il risultato giusto: la scrittura permanente aggiorna anche
   * lo strato permanente in memoria (`SchemaImpiantoSection`), che torna qui dentro `libreria`.
   *
   * Il controllo su `isAdmin` è ripetuto qui e non lasciato al solo pulsante (che già non
   * compare, `DialogoUscitaTaratura`), per la stessa ragione per cui ce l'ha `tornaADefault`:
   * questa funzione è la porta verso una scrittura che vale per OGNI pratica dell'applicazione,
   * comprese quelle già consegnate, e chi la chiama non deve poterla aprire per distrazione. La
   * difesa vera resta la RLS della tabella (vedi `tarature.ts`); questa evita di andarci a
   * sbattere.
   */
  const rendiPermanenti = useCallback(async () => {
    if (!chiaveTaratura || !isAdmin) return
    const chiave = chiaveTaratura
    const taraturaFinale = taraturaHook.taratura
    setSalvandoTaratura(true)
    try {
      await onScriviTaraturaPermanente(chiave, taraturaFinale)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Salvataggio permanente di "${chiave}" non riuscito.`)
      setSalvandoTaratura(false)
      return
    }
    setSalvandoTaratura(false)
    onTaraturaPratica(chiave, null)
    chiudiTaratura()
  }, [chiaveTaratura, isAdmin, taraturaHook.taratura, onScriviTaraturaPermanente, onTaraturaPratica, chiudiTaratura])

  /** «Usa solo questa volta»: resta nel layout di questa sola pratica. Nessuna scrittura a
   *  database — la porta `onTaraturaPratica` fino a `layoutDaPersistere` al salvataggio. */
  const usaSoloQuestaVolta = useCallback(() => {
    if (!chiaveTaratura) return
    const chiave = chiaveTaratura
    onTaraturaPratica(chiave, taraturaHook.taratura)
    chiudiTaratura()
  }, [chiaveTaratura, taraturaHook.taratura, onTaraturaPratica, chiudiTaratura])

  /** Nuova ancora nel punto agganciato alla griglia (`aggiungiAncora` ci pensa già), doppio clic
   *  sulla sagoma in `ManiglieTaratura`. Accetta di default la sola aria: il committente regola
   *  gli altri due dal gruppo di interruttori una volta selezionata. */
  const aggiungiAncoraTaratura = useCallback(
    (x: number, y: number) => taraturaHook.aggiungiAncora(['aria'], x, y),
    [taraturaHook]
  )

  /** Cambia cosa accetta l'ancora SELEZIONATA: il gruppo di interruttori della barra non
   *  conosce l'id, solo il modo taratura sa quale pallino è attivo. */
  const impostaAccettaTaratura = useCallback(
    (accetta: SchemaTipoAggancio[]) => {
      if (ancoraSelezionata) taraturaHook.impostaAccetta(ancoraSelezionata, accetta)
    },
    [ancoraSelezionata, taraturaHook]
  )

  /** Canc in modo taratura: toglie l'ancora selezionata, mai l'ultima (Step 3 del brief — un
   *  simbolo senza ancore non si può più collegare) e mai una a cui è attaccato un tubo. */
  const togliAncoraSelezionata = useCallback(() => {
    if (!ancoraSelezionata) return
    if (taraturaHook.taratura.ancore.length <= 1) {
      toast.error('Deve restare almeno un’ancora: un simbolo senza ancore non si può più collegare.')
      return
    }
    // Togliere un'ancora OCCUPATA lascerebbe la tela in uno stato che nessun gesto ripara dentro
    // la sessione: l'Handle sparisce dal DOM (`ancoreDi` non restituisce più quell'id), react-flow
    // smette di disegnare l'arco — errore #008 — ma l'arco resta in `stato.edges`, finisce nel
    // layout confermato, e nel documento `posizioneAncora` ripiega sul centro del nodo: il tubo
    // esce attaccato in mezzo al simbolo. Il riattacco automatico esiste (`persistenza.ts`) ma
    // scatta solo alla RIAPERTURA della pratica. Meglio non entrarci affatto, dicendo perché.
    if (ancoreOccupate().has(ancoraSelezionata)) {
      toast.error(
        'A quest’ancora è attaccata una tubazione: spostala su un altro attacco (o eliminala) prima di togliere l’ancora.'
      )
      return
    }
    taraturaHook.togliAncora(ancoraSelezionata)
    setAncoraSelezionata(null)
  }, [ancoraSelezionata, ancoreOccupate, taraturaHook])

  // Direzione «react-flow spegne la libera»: clic su un nodo/arco (o selezione a rettangolo)
  // azzera `selezioneLibera`. L'altra direzione vive in `selezionaLibero`/`deselezionaReactFlow`
  // qui sotto — il pointerdown del muro/di un'annotazione ferma la propagazione (vedi lì), quindi
  // questo handler non li vede mai e non può essere lui a spegnerli.
  const onSelectionChange = useCallback((s: { nodes: Node[]; edges: Edge[] }) => {
    setSelezione(s)
    if (s.nodes.length > 0 || s.edges.length > 0) setSelezioneLibera(null)
  }, [])

  // Direzione «la libera spegne react-flow». Il pointerdown del muro e di un'annotazione ferma
  // la propagazione (useGestoPuntatore.ts, TestiLiberi.tsx): il click della pane di react-flow
  // non scatta e `onSelectionChange` sopra non si accorge di nulla, quindi selezionare il muro o
  // un testo NON fa decadere da sé una selezione di react-flow già accesa — senza questa
  // chiamata esplicita un Canc con l'ordine nodo→muro cancellava entrambi, perché due listener
  // diversi (questo su `window`, quello di react-flow su `document`) leggevano ciascuno la
  // propria selezione, non condivisa.
  //
  // `aggiornaSenzaCronologia`, non `applica`: deselezionare non deve diventare un passo di
  // Ctrl+Z, per lo stesso motivo per cui `selezioneLibera` sta fuori da `StatoEditor`.
  const deselezionaReactFlow = useCallback(() => {
    // Guardia contro la ricorsione con la direzione sopra: senza, ogni chiamata scriverebbe
    // comunque su `stato` (anche a selezione già vuota), `onSelectionChange` la vedrebbe come un
    // cambiamento e ripartirebbe un giro a vuoto a ogni clic sul muro/su un'annotazione.
    if (selezione.nodes.length === 0 && selezione.edges.length === 0) return
    aggiornaSenzaCronologia((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      edges: s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
    }))
  }, [aggiornaSenzaCronologia, selezione.edges.length, selezione.nodes.length])

  const selezionaLibero = useCallback(
    (nuova: SelezioneLibera) => {
      setSelezioneLibera(nuova)
      deselezionaReactFlow()
    },
    [deselezionaReactFlow]
  )

  // La selezione libera può restare stantia: l'annotazione selezionata sparisce dal suo dialogo
  // (`eliminaTestoAperto`) o il muro da un Ctrl+Z che disfa l'aggiunta, e senza questo effetto un
  // Canc successivo consumerebbe una voce di cronologia per un'operazione ormai a vuoto.
  useEffect(() => {
    if (!selezioneLibera) return
    const esiste =
      selezioneLibera.tipo === 'muro' ? stato.muroX !== null : stato.testi.some((t) => t.id === selezioneLibera.id)
    if (!esiste) setSelezioneLibera(null)
  }, [selezioneLibera, stato.muroX, stato.testi])

  const eliminaSelezione = useCallback(() => {
    const nodi = new Set(selezione.nodes.map((n) => n.id))
    const archi = new Set(selezione.edges.map((e) => e.id))
    if (nodi.size === 0 && archi.size === 0) return
    applica((s) => ({
      ...s,
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
          // Le coordinate vivono solo in position. Si allinea la posizione RISULTANTE e non
          // lo spostamento: un'apparecchiatura che partisse fuori griglia — l'auto-layout ne
          // produce, E1 e F1 nascono a y=185 — ci resterebbe a ogni passo, sommando multipli
          // di 10 a uno scarto che non se ne va. È lo stesso difetto del tratto trascinato.
          const x = allineaAllaGriglia(n.position.x + dx)
          const y = allineaAllaGriglia(n.position.y + dy)
          return { ...n, position: { x, y } }
        }),
      }))
    },
    [applica, aggiornaSenzaCronologia, selezione.nodes]
  )

  // `scrittura !== null`, non l'intero oggetto: cambia identità a ogni carattere digitato (il
  // valore del campo vive lì), e in dipendenza dell'effetto qui sotto sganciava e riagganciava
  // questo listener a ogni tasto premuto nel campo di scrittura.
  const scritturaAperta = scrittura !== null

  // Ctrl+Z e frecce sull'intera finestra: l'editor occupa tutto il dialog, e chiedere
  // all'utente di mettere prima a fuoco la tela per annullare o spostare sarebbe un tranello.
  useEffect(() => {
    const suTasto = (e: KeyboardEvent) => {
      // Ridondante oggi (il Dialog di scrittura più sotto ferma già ogni tasto, Esc compreso, sul
      // proprio root): resta per tenere l'invariante esplicito qui, non affidato in silenzio a un
      // dettaglio implementativo di un altro componente. Il dialogo a tre vie si aggiunge per lo
      // stesso motivo: mentre è aperto, Ctrl+Z/Canc/frecce non devono toccare né l'impianto né
      // una taratura che sta per essere decisa.
      if (scritturaAperta || dialogoUscitaAperto) return
      // Escape toglie la SELEZIONE, e nient'altro. Fino al 17-08-2026 chiudeva l'intero editor
      // scartando ogni modifica, senza chiedere niente: ora il Dialog che lo monta non ha più
      // `onClose` (SchemaImpiantoSection.tsx) e l'uscita senza salvare passa solo da «Annulla
      // modifiche».
      //
      // Sta QUI SOPRA il blocco `modoTaratura`, che chiude con un `return` incondizionato: scritto
      // sotto, in taratura non verrebbe mai raggiunto.
      if (e.key === 'Escape') {
        // In taratura la selezione è un'ancora, non un nodo. L'uscita dal MODO resta il dialogo a
        // tre vie: Escape non la avvia e non la scavalca.
        if (modoTaratura) togliAncoraSelezionata()
        else {
          // Due selezioni, non una: react-flow non conosce muro e annotazioni, che hanno la
          // propria (`selezioneLibera`). Nessuna delle due tocca la cronologia —
          // `deselezionaReactFlow` passa già da `aggiornaSenzaCronologia`.
          deselezionaReactFlow()
          setSelezioneLibera(null)
        }
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        // In modo taratura Ctrl+Z annulla il GESTO della taratura (cronologia propria, vedi
        // `taraturaHook`), non l'ultimo spostamento d'impianto: sono due cronologie distinte per
        // la stessa ragione per cui restano separate in useTaratura.ts.
        if (modoTaratura) taraturaHook.annulla()
        else annulla()
        return
      }
      if (modoTaratura) {
        // In modo taratura Canc toglie l'ancora selezionata (Step 3 del brief) — non l'impianto,
        // che qui è spento: aggiungi nodo/elimina/allinea non convivono con la taratura.
        if (e.key === 'Delete' || e.key === 'Backspace') togliAncoraSelezionata()
        // Le frecce restano un comando d'impianto (spostano l'apparecchiatura selezionata): la
        // condizione sotto (`selezione.nodes.length > 0`) sarebbe comunque vera — il modo si
        // attiva solo con un nodo selezionato — quindi qui vanno spente esplicitamente, o un
        // tocco di freccia sposterebbe il simbolo mentre si crede di star tarando le sue ancore.
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selezioneLibera) {
        if (selezioneLibera.tipo === 'muro') rimuoviMuro()
        else rimuoviTesto(selezioneLibera.id)
        setSelezioneLibera(null)
        return
      }
      const passo = PASSI[e.key]
      if (passo && selezione.nodes.length > 0) {
        e.preventDefault()
        const fattore = e.shiftKey ? PASSO_GRIGLIA * 5 : PASSO_GRIGLIA
        sposta(passo[0] * fattore, passo[1] * fattore, e.repeat)
      }
    }
    window.addEventListener('keydown', suTasto)
    return () => window.removeEventListener('keydown', suTasto)
  }, [
    annulla,
    deselezionaReactFlow,
    dialogoUscitaAperto,
    modoTaratura,
    rimuoviMuro,
    rimuoviTesto,
    scritturaAperta,
    selezione.nodes,
    selezioneLibera,
    sposta,
    taraturaHook,
    togliAncoraSelezionata,
  ])

  const stileSelezionato =
    selezione.edges.length > 0
      ? (((selezione.edges[0].data as SchemaEdgeData | undefined)?.stile ?? 'standard') as SchemaArcoStile)
      : null

  const conferma = useCallback(() => {
    onConferma(layoutCorrente)
  }, [layoutCorrente, onConferma])

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, nodo: Node) => {
      // Spento in modo taratura come ogni altro comando d'impianto: `elementsSelectable={false}`
      // non ferma questo gestore (react-flow lo chiama comunque), e riscrivere il terminale
      // scriverebbe nella cronologia dell'IMPIANTO, che lì non ha via di ritorno.
      if (modoTaratura) return
      const dati = (nodo.data as SchemaNodeData).nodo
      if (dati.tipo !== 'utenze') return
      setScrittura({ bersaglio: 'terminale', id: nodo.id, valore: dati.etichetta })
    },
    [modoTaratura]
  )

  /** Doppio clic su un'annotazione: la riapre in scrittura (di lì si può anche eliminare). */
  const apriTesto = useCallback(
    (id: string) => {
      const testo = stato.testi.find((t) => t.id === id)
      if (!testo) return
      setScrittura({ bersaglio: 'testo', id, valore: testo.contenuto })
    },
    [stato.testi]
  )

  // Una scritta vuota non è accettabile — il terminale resterebbe senza dicitura, e
  // un'annotazione senza contenuto non si vedrebbe sulla tela, quindi nessuno potrebbe più né
  // afferrarla né toglierla — e il rifiuto deve vedersi PRIMA: chi svuota il campo e conferma
  // crede di aver tolto la scritta, mentre il gesto veniva scartato in silenzio.
  const scrittaValida = Boolean(scrittura?.valore.trim())

  const confermaScrittura = useCallback(() => {
    if (!scrittura) return
    const { bersaglio, id } = scrittura
    const contenuto = scrittura.valore.trim()
    setScrittura(null)
    if (!contenuto) return
    // Tutti e tre i rami passano da `applica` (dentro l'hook, per le annotazioni) e non da
    // `aggiornaSenzaCronologia`: sono gesti come lo spostamento, e un solo Ctrl+Z deve
    // annullarli. Per un'annotazione nuova la voce di cronologia è UNA, non due, perché il
    // contenuto entra insieme alla posizione: annullare la toglie del tutto, invece di
    // riportarla al passo intermedio in cui era vuota — cioè invisibile.
    if (bersaglio === 'terminale') {
      applica((s) => ({
        ...s,
        nodes: s.nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...(n.data as SchemaNodeData),
                  nodo: { ...(n.data as SchemaNodeData).nodo, etichetta: contenuto },
                } satisfies SchemaNodeData,
              }
            : n
        ),
      }))
      return
    }
    if (id !== null) {
      modificaTesto(id, contenuto)
      return
    }
    // Annotazione nuova: nasce sotto tutto il disegno, come le apparecchiature della palette.
    // Un punto fisso, o il centro della tela, finirebbe sopra qualcosa di già disegnato.
    // La posizione si calcola DENTRO l'updater, su `s`, non da `stato` catturato in questa
    // chiusura: è la stessa cautela di `aggiungiNodo` e della generazione dell'id in
    // useTestiLiberi.ts — `stato` può essere l'istantanea di un render precedente a quello su
    // cui il reducer sta per applicare l'aggiunta, e l'annotazione nascerebbe sopra qualcosa.
    aggiungiTesto((s) => sopraIlBordoSinistro(s.nodes, s.testi, libreriaEffettiva), contenuto)
  }, [aggiungiTesto, applica, libreriaEffettiva, modificaTesto, scrittura])

  /** Elimina l'annotazione aperta nel dialog: la via più vecchia delle due che esistono — l'altra
   *  è selezionarla sulla tela e premere Canc (`selezioneLibera` qui sopra). Il pulsante «Elimina»
   *  della barra resta cieco a entrambe, perché lavora solo sulla selezione di react-flow e le
   *  annotazioni non sono nodi. */
  const eliminaTestoAperto = useCallback(() => {
    if (!scrittura || scrittura.bersaglio !== 'testo' || scrittura.id === null) return
    const { id } = scrittura
    setScrittura(null)
    rimuoviTesto(id)
  }, [rimuoviTesto, scrittura])

  // Il nodo che il modo taratura sta modificando, per posizionare `ManiglieTaratura` sopra di
  // lui: origine (`Node.position`) e ingombro di FABBRICA, non quello tarato — vedi il commento
  // su `ManiglieTaraturaProps.dimensioniBase`.
  const nodoInTaratura = modoTaratura ? stato.nodes.find((n) => n.id === nodoTaraturaId) : undefined

  return (
    <Stack sx={{ height: '100%' }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ p: 1 }}>
        <Tooltip title="Annulla l'ultima modifica (Ctrl+Z)">
          <span>
            <Button size="small" startIcon={<UndoIcon />} onClick={annulla} disabled={!puoAnnullare || modoTaratura}>
              Annulla
            </Button>
          </span>
        </Tooltip>
        <Button
          size="small"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={eliminaSelezione}
          disabled={(selezione.nodes.length === 0 && selezione.edges.length === 0) || modoTaratura}
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
          disabled={selezione.edges.length === 0 || modoTaratura}
        >
          {STILI.map((s) => (
            <ToggleButton key={s.valore} value={s.valore}>
              {s.etichetta}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Divider orientation="vertical" flexItem />

        <Typography variant="caption" color="text.secondary">
          Segni:
        </Typography>
        <Button
          size="small"
          onClick={() => selezione.edges[0] && aggiungiSegno(selezione.edges[0].id, 'valvola_intercettazione')}
          disabled={selezione.edges.length !== 1 || modoTaratura}
        >
          + Valvola
        </Button>
        <Button
          size="small"
          onClick={() => selezione.edges[0] && aggiungiSegno(selezione.edges[0].id, 'riduttore_pressione')}
          disabled={selezione.edges.length !== 1 || modoTaratura}
        >
          + Riduttore
        </Button>
        <Button
          size="small"
          onClick={() => selezione.edges[0] && aggiungiSegno(selezione.edges[0].id, 'freccia_direzione')}
          disabled={selezione.edges.length !== 1 || modoTaratura}
        >
          + Freccia
        </Button>

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
                disabled={selezione.nodes.length < 2 || modoTaratura}
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
                disabled={selezione.nodes.length < 3 || modoTaratura}
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
          <Button
            key={voce.tipo}
            size="small"
            startIcon={<AddIcon />}
            onClick={() => aggiungiNodo(voce)}
            disabled={modoTaratura}
          >
            {voce.etichetta}
          </Button>
        ))}
        {/* Il dialog si apre subito e l'annotazione nasce solo alla conferma: scritta e
            posizione entrano insieme, così sulla tela non compare mai un'annotazione vuota —
            invisibile, e quindi impossibile da riafferrare o togliere. */}
        <Tooltip title="Una scritta libera sul disegno: si trascina dove serve, si cancella col tasto Canc, doppio clic per riscriverla o eliminarla">
          <span>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setScrittura({ bersaglio: 'testo', id: null, valore: '' })}
              disabled={modoTaratura}
            >
              Testo
            </Button>
          </span>
        </Tooltip>
        {/* Disabilitato col muro già presente: è uno solo, e due sovrapposti sarebbero
            indistinguibili sulla tela (e sul documento, che li disegna con la stessa funzione). */}
        <Tooltip title="Il muro fra sala compressori e linea di distribuzione: si trascina in orizzontale, si cancella col tasto Canc">
          <span>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => aggiungiMuro((s) => ascissaProposta(nodiDi(s), libreriaEffettiva))}
              disabled={stato.muroX !== null || modoTaratura}
            >
              Muro
            </Button>
          </span>
        </Tooltip>

        {/* Il modo taratura: unico comando che resta acceso mentre tutti gli altri sopra si
            spengono — i comandi che agiscono sull'impianto non convivono con la taratura di un
            simbolo (Step 1 del brief). */}
        <BarraTaratura
          attivo={modoTaratura}
          puoAttivare={selezione.nodes.length === 1 && motivoTaratura === null}
          motivoNonTarabile={motivoTaratura}
          onAttiva={attivaTaratura}
          onEsci={() => setDialogoUscitaAperto(true)}
          taratura={taraturaHook.taratura}
          puoAnnullare={taraturaHook.puoAnnullare}
          onAnnulla={taraturaHook.annulla}
          ancoraSelezionata={ancoraSelezionata}
          onCambiaAccetta={impostaAccettaTaratura}
        />

        <Divider orientation="vertical" flexItem />

        <Button
          size="small"
          startIcon={<AnteprimaIcon />}
          onClick={() => setAnteprimaAperta((a) => !a)}
          variant={anteprimaAperta ? 'contained' : 'text'}
        >
          Anteprima
        </Button>

        <Tooltip title={preferenze.schermoIntero ? 'Riporta la finestra alle sue dimensioni' : 'Porta la finestra a tutto schermo'}>
          <IconButton size="small" onClick={() => onCambiaPreferenze({ schermoIntero: !preferenze.schermoIntero })}>
            {preferenze.schermoIntero ? <SchermoInteroEsciIcon fontSize="small" /> : <SchermoInteroIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack direction="row" sx={{ flex: 1, minHeight: 360 }}>
      {/* La tela è un foglio, non una finestra sul tema scuro. react-flow lascia trasparente la
          propria radice (`--xy-background-color-default`), quindi senza questo fondo si vedrebbe il
          Paper del dialog: bianco come l'anteprima qui accanto e come il documento consegnato, così
          ciò che si disegna e ciò che si stampa hanno lo stesso aspetto.
          I comandi di zoom di react-flow tengono `--xy-controls-button-color-default: inherit`
          (e altrettanto `-color-hover-default`) nel foglio di stile della libreria, e l'icona
          (`fill: currentColor`) eredita quindi il colore dal contesto attorno — qui il tema
          scuro del dialog MUI, non il foglio bianco: da lì un'icona quasi bianca su fondo quasi
          bianco, a riposo e ancora sotto il puntatore. Il bordo qui sotto ridà ai comandi un
          contorno leggibile. Il colore si dà valorizzando `--xy-controls-button-color` e
          `--xy-controls-button-color-hover`, le variabili che le regole della libreria (a
          riposo e su `:hover`) già leggono con `var()` — non impostando `color` di persona: un
          `color` qui avrebbe la stessa specificità (0,2,0) della regola `:hover` della libreria,
          e in parità decide l'ordine di iniezione nel documento, che in build non è garantito.
          Passando dalle variabili non si compete più sulla specificità: `color` resta dichiarato
          una sola volta, nel foglio della libreria, e legge sempre il nostro valore in entrambi
          gli stati. #37414f rende ~10,25:1 su #fefefe (fondo a riposo) e ~9,40:1 su #f4f4f4
          (fondo in hover): in entrambi i casi ben oltre la soglia leggibile. */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'common.white',
          '& .react-flow__controls': { boxShadow: '0 0 0 1px #c9ced6' },
          '& .react-flow__controls-button': {
            borderBottomColor: '#c9ced6',
            '--xy-controls-button-color': '#37414f',
            '--xy-controls-button-color-hover': '#37414f',
          },
        }}
      >
        <ReactFlow
          nodes={stato.nodes}
          edges={edgesConGomiti}
          nodeTypes={tipiNodo}
          edgeTypes={tipiArco}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onReconnect={onReconnect}
          // Non `creaGomito` nudo: in modo taratura un doppio clic su una tubazione creerebbe un
          // gomito — un gesto d'impianto, in cronologia d'impianto, mentre l'impianto è spento.
          onEdgeDoubleClick={modoTaratura ? undefined : creaGomito}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStart={suInizioTrascinamentoNodo}
          onNodeDrag={suTrascinamentoNodo}
          onNodeDragStop={suFineTrascinamentoNodo}
          isValidConnection={isValidConnection}
          onSelectionChange={onSelectionChange}
          onPaneClick={() => setSelezioneLibera(null)}
          // In modo taratura l'impianto è spento anche sulla tela, non solo in barra: senza,
          // trascinare dentro il riquadro delle maniglie (`ManiglieTaratura`, sotto) rischierebbe
          // di spostare l'apparecchiatura invece di tarare la sua sagoma, e un capo trascinato
          // da un handle creerebbe una tubazione che il committente non ha chiesto in questo
          // modo. La selezione resta bloccata sul simbolo congelato all'ingresso (vedi il
          // commento su `nodoTaraturaId`): un clic altrove non deve far credere di aver cambiato
          // bersaglio mentre il dialogo a tre vie non ha ancora deciso nulla.
          nodesDraggable={!modoTaratura}
          nodesConnectable={!modoTaratura}
          elementsSelectable={!modoTaratura}
          // `edgesReconnectable` va spento a parte: NON dipende da `elementsSelectable`, e le
          // ancore di riaggancio (`.react-flow__edgeupdater`) portano `pointer-events: all`, che
          // vince sull'`inactive` del gruppo dell'arco — la stessa ragione per cui l'area di presa
          // del tratto era rimasta viva. Senza, in modo taratura si può ancora staccare un capo e
          // posarlo altrove: `onReconnect` → `applica`, una voce nella cronologia dell'IMPIANTO
          // che lì non si può disfare.
          edgesReconnectable={!modoTaratura}
          onlyRenderVisibleElements
          fitView
          // Senza questo, `fitView` non inquadra affatto tutto il disegno: il minimo di
          // default di react-flow è 0.5, ma uno schema tipico (~1250 unità di larghezza) in un
          // riquadro che può scendere anche a ~530px — quanto resta accanto all'anteprima quando
          // il committente la allarga col divisorio, che quindi può restringere la tela anche
          // parecchio — richiede circa 0.36. Lo zoom resta bloccato a
          // 0.5, la tela mostra solo la fascia centrale e le prime ~95 unità a sinistra
          // diventano irraggiungibili: nessuna panoramica le riporta dentro, perché è «Fit
          // View» stesso a ricentrare lì.
          //
          // Insieme a `onlyRenderVisibleElements` questo cancellava dal DOM i nodi appena
          // aggiunti: `aggiungiNodo` li mette tutti a x=40, dentro quella fascia cieca, e
          // react-flow (correttamente) non disegna ciò che è fuori campo. Si salvavano solo i
          // tipi abbastanza larghi da sporgere oltre x=136 — serbatoio (150), pacco bombole
          // (120), filtro/essiccatore/separatore (110) — mentre giunzione (50 all'epoca, poi
          // rimpicciolita) e raccolta condense (80) restavano invisibili per sempre, senza
          // alcun errore in console.
          // Non era quindi un difetto del simbolo TEE: era la soglia di larghezza.
          minZoom={0.1}
          // react-flow ha una propria gestione delle frecce da tastiera sul nodo selezionato
          // (accessibilità): senza disattivarla, ogni pressione muove il nodo anche per
          // conto suo (di un passo pari a snapGrid) e lo mette a fuoco nel DOM al click,
          // in concorrenza con la nostra — due spostamenti e due voci di cronologia per un
          // solo tocco. Vedi giro di riparazione 1, causa A. `disableKeyboardA11y` spegne
          // anche altro (Enter/Escape per selezionare/deselezionare da tastiera, il
          // centraggio automatico sul nodo che riceve il focus, gli annunci per gli screen
          // reader): nessuna di queste funzioni è usata dall'editor, che seleziona sempre a
          // clic/shift+clic/rettangolo, quindi la perdita è accettata, non solo un
          // sottoprodotto trascurato.
          disableKeyboardA11y
          // Lo schema è un disegno tecnico: si trascina sulla griglia del CAD, non a piacere.
          // gap=10 sulla griglia visibile: stesso passo di snapGrid, altrimenti il disegno
          // mostrerebbe un reticolo diverso da quello a cui i nodi si agganciano davvero.
          snapToGrid
          snapGrid={[10, 10]}
          // `null` in modo taratura, non l'elenco: senza, il Canc premuto per togliere
          // un'ancora selezionata raggiunge ANCHE la gestione interna di react-flow (che non sa
          // nulla del modo taratura) e cancella il nodo selezionato — l'apparecchiatura intera,
          // non l'ancora — esattamente il pericolo che il brief mette in guardia («cancellare
          // un'apparecchiatura credendo di togliere un'ancora»). Misurato in pagina: senza
          // questa guardia, Canc su un'ancora toglieva il simbolo tarato dalla tela.
          deleteKeyCode={modoTaratura ? null : ['Delete', 'Backspace']}
          translateExtent={[
            [-500, -500],
            [4000, 4000],
          ]}
        >
          {/* Il grigio predefinito di xyflow (#91919a) è tarato su fondo chiaro ma compete col
              disegno: qui la griglia deve guidare l'occhio, non farsi leggere. Misurato in
              pagina: su fondo bianco #c9ced6 dava un contrasto di 1,58:1 (praticamente
              invisibile), #aeb6c2 sale a 2,04:1; e a size predefinita il puntino ha raggio 0,5
              (0,30px allo zoom ~0,6, a cui è stato misurato — sotto il pixel), size={1.6} lo
              porta a 0,8 (~2,5 volte l'area). Insieme danno una griglia che si vede senza
              competere col disegno. */}
          <Background gap={10} size={1.6} color="#aeb6c2" />
          {/* Niente lucchetto in modo taratura: quel comando scrive `nodesDraggable`/
              `nodesConnectable`/`elementsSelectable` DIRETTAMENTE nel negozio di react-flow, non
              nelle prop qui sopra — un clic lì riaccenderebbe trascinamento e selezione dei nodi
              fino al prossimo cambio di prop, riaprendo da solo tutto ciò che il modo taratura
              spegne. Zoom e «Fit View» restano: servono, e non toccano il disegno. */}
          <Controls showInteractive={!modoTaratura} />
          <ViewportPortal>
            <GuideAllineamento guide={guide} />
            <TestiLiberi
              testi={stato.testi}
              onSposta={spostaTesto}
              onModifica={apriTesto}
              selezionato={selezioneLibera?.tipo === 'testo' ? selezioneLibera.id : null}
              onSeleziona={(id) => selezionaLibero({ tipo: 'testo', id })}
              // Annotazioni e muro montano gestori PROPRI, che le prop di `<ReactFlow>` qui sotto
              // non toccano: senza questa guardia in modo taratura si potrebbero ancora spostare
              // o riaprire in scrittura, scrivendo nella cronologia dell'impianto (vedi
              // `TestiLiberiProps.bloccato`/`MuroSeparazioneProps.bloccato`).
              bloccato={modoTaratura}
            />
            {layoutCorrente.muro && (
              <MuroSeparazione
                muro={layoutCorrente.muro}
                varchi={varchiMuro}
                selezionato={selezioneLibera?.tipo === 'muro'}
                onSposta={spostaMuro}
                onSeleziona={() => selezionaLibero({ tipo: 'muro' })}
                bloccato={modoTaratura}
              />
            )}
            {/* Sopra il nodo tarato, nello stesso portale: le sue coordinate sono già quelle del
                disegno, come le annotazioni e il muro qui sopra. `dimensioniDi(nodo, {})`, non
                `libreriaEffettiva`: le maniglie di trasla/deforma agiscono sul riquadro di
                FABBRICA della sagoma, non sull'inviluppo che comprende anche le ancore (vedi il
                commento su `ManiglieTaraturaProps.dimensioniBase`). */}
            {modoTaratura && nodoInTaratura && (
              <ManiglieTaratura
                origine={nodoInTaratura.position}
                dimensioniBase={dimensioniDi((nodoInTaratura.data as SchemaNodeData).nodo, {})}
                taratura={taraturaHook.taratura}
                ancoraSelezionata={ancoraSelezionata}
                onSelezionaAncora={setAncoraSelezionata}
                onSpostaAncora={taraturaHook.spostaAncora}
                onAggiungiAncora={aggiungiAncoraTaratura}
                onTrasla={taraturaHook.trasla}
                onDeforma={taraturaHook.deforma}
              />
            )}
          </ViewportPortal>
        </ReactFlow>
      </Box>

      {anteprima && <DivisorioAnteprima onCambia={(quota) => onCambiaPreferenze({ anteprima: quota })} />}

      {anteprima && (
        <Stack
          sx={{
            width: `${preferenze.anteprima}%`,
            minWidth: LARGHEZZA_MINIMA_ANTEPRIMA,
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

      <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center" sx={{ p: 1 }}>
        {/* Disabilitati mentre il modo taratura è acceso: non esiste uscita implicita da lì
            (Step 4 del brief) — si esce sempre dal dialogo a tre vie, mai chiudendo l'intero
            editor sotto una taratura ancora indecisa. */}
        <Button onClick={onAnnulla} disabled={modoTaratura}>
          Annulla modifiche
        </Button>
        <Button variant="contained" onClick={conferma} disabled={modoTaratura}>
          Conferma schema
        </Button>
        {/* A tutto schermo non c'è nulla da ridimensionare, e una maniglia che non fa niente
            fa credere che il gesto sia rotto. */}
        {!preferenze.schermoIntero && (
          <ManigliaRidimensiona onCambia={onCambiaPreferenze} larghezza={preferenze.larghezza} altezza={preferenze.altezza} />
        )}
      </Stack>

      {/* Un dialog solo per due bersagli (la scritta del terminale e le annotazioni libere):
          sono lo stesso gesto — comporre un testo su più righe e confermarlo — e sdoppiarlo
          significherebbe tenere allineate a mano due copie delle stesse cautele su tasti,
          Esc e validazione qui sotto. Cambiano il titolo, l'esempio e le dizioni dei pulsanti.
          Annullare non lascia mai nulla dietro: un'annotazione nuova non è ancora stata creata,
          una esistente non è stata toccata. */}
      <Dialog
        open={scrittura !== null}
        onClose={() => setScrittura(null)}
        maxWidth="xs"
        fullWidth
        // I tasti si fermano qui, sul dialog, e non sul solo campo di testo. Lo stopPropagation
        // è indispensabile — l'editor ascolta frecce e Ctrl+Z sull'intera finestra, e senza di
        // esso scrivere nel campo sposterebbe il nodo selezionato — ma sul campo protegge il
        // campo, non il dialog: bastava un Tab per portare il fuoco su un pulsante, e da lì
        // frecce e Ctrl+Z risalivano al listener su `window` spostando il nodo selezionato o
        // annullando una modifica *mentre il dialog è aperto*.
        //
        // Esc va gestito esplicitamente e non lasciato a MUI: la chiusura da tastiera del Modal
        // è un `onKeyDown` sul suo root (node_modules/@mui/material/Modal/useModal.js), quindi
        // dentro l'albero React, dove lo stopPropagation qui sotto arriva.
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            setScrittura(null)
            return
          }
          e.stopPropagation()
          // Invio va a capo: il campo è multi-riga dal Blocco C2, e confermare su Invio
          // renderebbe impossibile comporre la seconda riga. Resta la scorciatoia da
          // tastiera, con il modificatore — la stessa convenzione dei campi di commento —
          // mentre la strada principale è il pulsante.
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && scrittaValida) confermaScrittura()
        }}
      >
        <DialogTitle>
          {scrittura?.bersaglio === 'testo' ? 'Testo sul disegno' : 'Scritta del terminale'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            maxRows={8}
            margin="dense"
            label="Testo"
            helperText={
              scrittura?.bersaglio === 'testo'
                ? 'Una scritta libera sul disegno, per esempio «Locale compressori». Invio va a capo, Ctrl+Invio conferma (oppure usa il pulsante qui sotto).'
                : 'Per esempio «Utenze aria», «Utenze azoto». Invio va a capo, Ctrl+Invio conferma (oppure usa il pulsante qui sotto).'
            }
            value={scrittura?.valore ?? ''}
            onChange={(e) => setScrittura((s) => (s ? { ...s, valore: e.target.value } : s))}
          />
        </DialogContent>
        <DialogActions>
          {scrittura?.bersaglio === 'testo' && scrittura.id !== null && (
            <Button color="error" startIcon={<DeleteIcon />} onClick={eliminaTestoAperto} sx={{ mr: 'auto' }}>
              Elimina
            </Button>
          )}
          <Button onClick={() => setScrittura(null)}>
            {scrittura?.id === null ? 'Annulla' : "Lascia com'è"}
          </Button>
          <Button variant="contained" onClick={confermaScrittura} disabled={!scrittaValida}>
            {scrittura?.bersaglio !== 'testo' ? 'Cambia scritta' : scrittura.id === null ? 'Aggiungi' : 'Salva'}
          </Button>
        </DialogActions>
      </Dialog>

      <DialogoUscitaTaratura
        open={dialogoUscitaAperto}
        isAdmin={isAdmin}
        salvando={salvandoTaratura}
        onTornaDefault={tornaADefault}
        onRendiPermanenti={rendiPermanenti}
        onUsaSoloQuestaVolta={usaSoloQuestaVolta}
      />
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
