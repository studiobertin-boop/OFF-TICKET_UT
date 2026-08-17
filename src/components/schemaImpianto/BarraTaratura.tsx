/**
 * Il modo taratura sulla tela (Task 12): il pulsante che lo accende/spegne e il gruppo di
 * comandi che compare mentre è acceso (in `BarraTaratura`, destinato alla barra strumenti
 * dell'editor), le maniglie trascinabili che disegnano ancore e sagoma sopra il simbolo scelto
 * (`ManiglieTaratura`, dentro `<ViewportPortal>` come `MuroSeparazione`/`TestiLiberi`), e il
 * dialogo a tre vie che chiude il modo (`DialogoUscitaTaratura`).
 *
 * Nessuna logica di dominio qui dentro: i gesti (spostare/aggiungere/togliere un'ancora,
 * traslare/deformare la sagoma) restano quelli di `useTaratura.ts`, già provati per mutazione
 * (CLAUDE.md, «no UI test» — qui non c'è nulla di puro da isolare, solo la resa e la cattura
 * del puntatore).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { Tune as TaraturaIcon, Undo as UndoIcon } from '@mui/icons-material'
import toast from 'react-hot-toast'
import type { TaraturaSimbolo } from '@/services/schemaImpianto/libreria'
import type { SchemaAncora, SchemaTipoAggancio } from '@/services/schemaImpianto/types'
import { useGestoPuntatore } from './useGestoPuntatore'
import { fattoreDeforma } from './useTaratura'

/* ------------------------------------------------------------------------------------------ *
 * Il pulsante e il gruppo di comandi della barra strumenti
 * ------------------------------------------------------------------------------------------ */

const TIPI_AGGANCIO: { valore: SchemaTipoAggancio; etichetta: string }[] = [
  { valore: 'aria', etichetta: 'Aria' },
  { valore: 'condensa', etichetta: 'Condensa' },
  { valore: 'valvola_sicurezza', etichetta: 'Valvola sicurezza' },
]

export interface BarraTaraturaProps {
  attivo: boolean
  /** Esattamente un nodo selezionato: l'unica condizione per poter ENTRARE nel modo (il
   *  brief: «tarare senza sapere quale simbolo non vuol dire nulla»). Non serve per USCIRNE. */
  puoAttivare: boolean
  onAttiva: () => void
  /** Non spegne il modo da sé: apre il dialogo a tre vie (nessuna uscita implicita). */
  onEsci: () => void
  taratura: TaraturaSimbolo
  puoAnnullare: boolean
  onAnnulla: () => void
  ancoraSelezionata: string | null
  onCambiaAccetta: (accetta: SchemaTipoAggancio[]) => void
}

/**
 * Il gruppo di comandi della taratura, destinato alla STESSA barra strumenti dell'editor: non un
 * pannello a sé, perché il committente deve vedere a colpo d'occhio che è la stessa tela, solo
 * in un modo diverso — gli stessi comandi dell'impianto restano lì, spenti (vedi SchemaEditor.tsx,
 * dove ogni pulsante che agisce sull'impianto riceve `|| modoTaratura`).
 */
export function BarraTaratura({
  attivo,
  puoAttivare,
  onAttiva,
  onEsci,
  taratura,
  puoAnnullare,
  onAnnulla,
  ancoraSelezionata,
  onCambiaAccetta,
}: BarraTaraturaProps) {
  const accettaCorrente = taratura.ancore.find((a) => a.id === ancoraSelezionata)?.accetta ?? []

  return (
    <>
      <Divider orientation="vertical" flexItem />
      <Tooltip
        title={
          attivo
            ? 'Chiudi il modo taratura'
            : puoAttivare
              ? 'Modifica ancore e sagoma del simbolo selezionato'
              : 'Seleziona un solo simbolo per tararlo'
        }
      >
        <span>
          <ToggleButton
            size="small"
            value="taratura"
            selected={attivo}
            onChange={() => (attivo ? onEsci() : onAttiva())}
            disabled={!attivo && !puoAttivare}
          >
            <TaraturaIcon fontSize="small" sx={{ mr: 0.5 }} />
            Taratura
          </ToggleButton>
        </span>
      </Tooltip>
      {attivo && (
        <>
          <Tooltip title="Annulla l'ultimo gesto della taratura">
            <span>
              <Button size="small" startIcon={<UndoIcon />} onClick={onAnnulla} disabled={!puoAnnullare}>
                Annulla
              </Button>
            </span>
          </Tooltip>
          <Typography variant="caption" color="text.secondary">
            Ancora accetta:
          </Typography>
          <ToggleButtonGroup
            size="small"
            value={accettaCorrente}
            onChange={(_, valori: SchemaTipoAggancio[]) => {
              // Un'ancora senza alcun tipo accettato non serve a nessuna tubazione: non si
              // scende sotto uno (Step 3 del brief). Il rifiuto va DETTO, come già si fa per
              // l'ultima ancora rimasta (`togliAncoraSelezionata`, SchemaEditor.tsx): un
              // interruttore che si riaccende da solo senza spiegazione si legge come un guasto.
              if (valori.length === 0) {
                toast.error('Un’ancora deve accettare almeno un tipo: per toglierla del tutto usa il tasto Canc.')
                return
              }
              onCambiaAccetta(valori)
            }}
            disabled={!ancoraSelezionata}
          >
            {TIPI_AGGANCIO.map((t) => (
              <ToggleButton key={t.valore} value={t.valore}>
                {t.etichetta}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary">
            Doppio clic sulla sagoma per aggiungere un’ancora, Canc per togliere quella selezionata.
          </Typography>
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------------------------------ *
 * Le maniglie sulla tela
 * ------------------------------------------------------------------------------------------ */

/**
 * Cattura del puntatore per un gesto che consegna un DELTA a ogni evento, non un valore assoluto
 * "riconsegnabile" all'annullamento come fa `useGestoPuntatore`: `trasla`/`deforma` compongono
 * sommando/moltiplicando ogni evento a quello prima (vedi useTaratura.ts), quindi qui non esiste
 * un "ultimo valore" da rigiocare — l'annullamento del puntatore chiude semplicemente il gesto
 * dove si trova, senza spostarlo oltre.
 */
function useTrascinamentoDelta(suEvento: (dx: number, dy: number, concluso: boolean) => void) {
  const { screenToFlowPosition } = useReactFlow()
  const ultimaRef = useRef({ x: 0, y: 0 })
  const mossoRef = useRef(false)

  const suPointerDown = useCallback(
    (e: React.PointerEvent<Element>) => {
      e.stopPropagation()
      mossoRef.current = false
      ultimaRef.current = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [screenToFlowPosition]
  )

  const suPointerMove = useCallback(
    (e: React.PointerEvent<Element>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      e.stopPropagation()
      const corrente = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const dx = corrente.x - ultimaRef.current.x
      const dy = corrente.y - ultimaRef.current.y
      ultimaRef.current = corrente
      if (dx === 0 && dy === 0) return
      mossoRef.current = true
      suEvento(dx, dy, false)
    },
    [screenToFlowPosition, suEvento]
  )

  const suPointerUp = useCallback(
    (e: React.PointerEvent<Element>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      e.stopPropagation()
      if (!mossoRef.current) return
      mossoRef.current = false
      // Delta finale dalle coordinate vere del rilascio, non zero: fra l'ultimo pointermove e
      // il rilascio il puntatore può aver ancora percorso un tratto (stessa cautela di
      // MuroSeparazione.tsx, che rilegge la posizione anche qui invece di fidarsi dell'ultimo
      // pointermove visto).
      const corrente = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      suEvento(corrente.x - ultimaRef.current.x, corrente.y - ultimaRef.current.y, true)
    },
    [screenToFlowPosition, suEvento]
  )

  const suPointerCancel = useCallback(
    (e: React.PointerEvent<Element>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
      e.stopPropagation()
      if (!mossoRef.current) return
      mossoRef.current = false
      // Nessun delta dalle coordinate dell'evento di annullamento: non è un movimento e può
      // portarne di qualsiasi (stessa cautela di `useGestoPuntatore.ts`). Chiude il gesto sul
      // punto già raggiunto dagli eventi precedenti, senza spostarlo oltre.
      suEvento(0, 0, true)
    },
    [suEvento]
  )

  return { suPointerDown, suPointerMove, suPointerUp, suPointerCancel }
}

/** Lato delle maniglie quadrate di deforma, in unità del disegno. */
const LATO_MANIGLIA = 9
/** Raggio dei pallini delle ancore, in unità del disegno. */
const RAGGIO_ANCORA = 7

interface PallinoAncoraProps {
  ancora: SchemaAncora
  /** Origine del nodo (`Node.position`): le ancore vivono in coordinate locali al nodo. */
  origine: { x: number; y: number }
  selezionata: boolean
  onSeleziona: (id: string) => void
  onSposta: (id: string, x: number, y: number, concluso: boolean) => void
}

/**
 * Un'ancora, trascinabile SOLO sulla griglia — non è questo componente a imporlo, ci pensa già
 * `spostaAncora` (useTaratura.ts) a valle di ogni evento. Stesso pattern di `MuroSeparazione`:
 * uno scostamento congelato al pointerdown, così l'ancora non salta col centro sotto il cursore
 * al primo pixel di movimento.
 */
function PallinoAncora({ ancora, origine, selezionata, onSeleziona, onSposta }: PallinoAncoraProps) {
  const { screenToFlowPosition } = useReactFlow()
  const { suInizio, suMovimento, suFine, suAnnullamento } = useGestoPuntatore<SVGCircleElement, { x: number; y: number }>()
  const scostamentoRef = useRef({ x: 0, y: 0 })

  const localeDa = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      return { x: p.x - origine.x - scostamentoRef.current.x, y: p.y - origine.y - scostamentoRef.current.y }
    },
    [screenToFlowPosition, origine.x, origine.y]
  )

  const suPointerDown = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => {
      // Al pointerdown e non al click: il click lo mangia il trascinamento (stesso motivo di
      // MuroSeparazione.tsx/TestiLiberi.tsx).
      onSeleziona(ancora.id)
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      scostamentoRef.current = { x: p.x - origine.x - ancora.x, y: p.y - origine.y - ancora.y }
      suInizio(e)
    },
    [ancora.id, ancora.x, ancora.y, onSeleziona, origine.x, origine.y, screenToFlowPosition, suInizio]
  )

  const suPointerMove = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => suMovimento(e, localeDa(e), (v) => onSposta(ancora.id, v.x, v.y, false)),
    [ancora.id, localeDa, onSposta, suMovimento]
  )

  const suPointerUp = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => suFine(e, localeDa(e), (v) => onSposta(ancora.id, v.x, v.y, true)),
    [ancora.id, localeDa, onSposta, suFine]
  )

  const suPointerCancel = useCallback(
    (e: React.PointerEvent<SVGCircleElement>) => suAnnullamento(e, (v) => onSposta(ancora.id, v.x, v.y, true)),
    [ancora.id, onSposta, suAnnullamento]
  )

  return (
    <circle
      className="nopan"
      cx={origine.x + ancora.x}
      cy={origine.y + ancora.y}
      r={RAGGIO_ANCORA}
      fill={selezionata ? '#e65100' : '#1976d2'}
      stroke="#fff"
      strokeWidth={1.5}
      style={{ cursor: 'grab', pointerEvents: 'all' }}
      onPointerDown={suPointerDown}
      onPointerMove={suPointerMove}
      onPointerUp={suPointerUp}
      onPointerCancel={suPointerCancel}
    />
  )
}

export interface ManiglieTaraturaProps {
  /** Origine del nodo in taratura (`Node.position`), in coordinate del disegno. */
  origine: { x: number; y: number }
  /** Ingombro di FABBRICA della sagoma, taratura esclusa (`dimensioniDi(nodo, {})`): è il
   *  riquadro su cui agiscono le maniglie di trasla/deforma, non l'inviluppo con le ancore —
   *  stessa separazione di `useTaratura.ts` fra ANCORE ferme e SAGOMA libera. */
  dimensioniBase: { larghezza: number; altezza: number }
  taratura: TaraturaSimbolo
  ancoraSelezionata: string | null
  onSelezionaAncora: (id: string | null) => void
  onSpostaAncora: (id: string, x: number, y: number, concluso: boolean) => void
  onAggiungiAncora: (x: number, y: number) => void
  onTrasla: (dx: number, dy: number, concluso: boolean) => void
  onDeforma: (sx: number, sy: number, concluso: boolean) => void
}

/**
 * Le maniglie della taratura in corso: il riquadro trascinabile della sagoma (trasla, doppio
 * clic per aggiungere un'ancora), tre maniglie di deforma ed i pallini delle ancore.
 *
 * Solo EST/SUD/SUD-EST deformano: `sx`/`sy` scalano sempre a partire dall'origine locale (0,0)
 * della sagoma (vedi `simboloTrasformato`, symbols/index.ts), quindi un bordo NORD/OVEST che
 * "tenga fermo il lato opposto" richiederebbe anche una trasla insieme alla deforma — un gesto
 * composto che il brief non chiede. Il riquadro trascinabile resta la via per riposizionare la
 * sagoma in qualunque altra direzione.
 *
 * Dentro `<ViewportPortal>` come `MuroSeparazione`/`TestiLiberi`: le coordinate sono già quelle
 * del disegno, senza conversioni.
 */
export function ManiglieTaratura({
  origine,
  dimensioniBase,
  taratura,
  ancoraSelezionata,
  onSelezionaAncora,
  onSpostaAncora,
  onAggiungiAncora,
  onTrasla,
  onDeforma,
}: ManiglieTaraturaProps) {
  const { screenToFlowPosition } = useReactFlow()

  const sagomaX = origine.x + taratura.dx
  const sagomaY = origine.y + taratura.dy
  const sagomaLarghezza = dimensioniBase.larghezza * taratura.sx
  const sagomaAltezza = dimensioniBase.altezza * taratura.sy

  const corpoGesto = useTrascinamentoDelta(onTrasla)
  const suPointerDownCorpo = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      onSelezionaAncora(null)
      corpoGesto.suPointerDown(e)
    },
    [corpoGesto, onSelezionaAncora]
  )

  // La conversione delta→fattore e la guardia contro le dimensioni degeneri stanno in
  // `fattoreDeforma` (useTaratura.ts), accanto a `deforma` e sotto test: qui resta solo il
  // cablaggio dei tre gesti. `null` significa «gesto rifiutato», e si esce senza toccare nulla.
  const onDeformaEst = useCallback(
    (dx: number, _dy: number, concluso: boolean) => {
      const fx = fattoreDeforma(sagomaLarghezza, dx)
      if (fx === null) return
      onDeforma(fx, 1, concluso)
    },
    [sagomaLarghezza, onDeforma]
  )
  const estGesto = useTrascinamentoDelta(onDeformaEst)

  const onDeformaSud = useCallback(
    (_dx: number, dy: number, concluso: boolean) => {
      const fy = fattoreDeforma(sagomaAltezza, dy)
      if (fy === null) return
      onDeforma(1, fy, concluso)
    },
    [sagomaAltezza, onDeforma]
  )
  const sudGesto = useTrascinamentoDelta(onDeformaSud)

  // Sud-est deforma i due assi INSIEME: se uno solo dei due degenera si rifiuta tutto il gesto,
  // non la sola componente rifiutata — deformare in una sola direzione non è quello che il
  // committente ha afferrato, e vederselo fare a metà si legge come un difetto.
  const onDeformaSudEst = useCallback(
    (dx: number, dy: number, concluso: boolean) => {
      const fx = fattoreDeforma(sagomaLarghezza, dx)
      const fy = fattoreDeforma(sagomaAltezza, dy)
      if (fx === null || fy === null) return
      onDeforma(fx, fy, concluso)
    },
    [sagomaLarghezza, sagomaAltezza, onDeforma]
  )
  const sudEstGesto = useTrascinamentoDelta(onDeformaSudEst)

  const suDoppioClic = useCallback(
    (e: React.MouseEvent<SVGRectElement>) => {
      // Si ferma qui: senza, il doppio clic risalirebbe alla tela come per le annotazioni
      // (TestiLiberi.tsx).
      e.stopPropagation()
      const p = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      onAggiungiAncora(p.x - origine.x, p.y - origine.y)
    },
    [screenToFlowPosition, origine.x, origine.y, onAggiungiAncora]
  )

  return (
    <svg
      // Stesso principio di MuroSeparazione.tsx/TestiLiberi.tsx: il portale della viewport ha
      // `pointer-events: none`, riacceso qui solo sugli elementi che devono rispondere al
      // puntatore.
      //
      // `zIndex: 1001`, non lasciato ad `auto`: react-flow porta il nodo SELEZIONATO — il nodo
      // in taratura lo è ancora, la selezione che l'ha acceso non decade da sé (vedi
      // `elementsSelectable={!modoTaratura}`, SchemaEditor.tsx) — a `z-index: 1000` con uno
      // stile inline sul proprio wrapper (`.react-flow__node`), che crea un contesto di
      // impilamento sopra al portale della viewport (`z-index: auto`) NONOSTANTE il portale sia
      // l'ultimo nel DOM: l'ordine nel markup non basta a decidere chi sta sopra quando un
      // fratello dichiara uno z-index esplicito. Misurato in pagina: senza questo valore, il
      // riquadro del corpo — `fill="none"`, ma dentro un `<svg>` a `pointer-events: all` (vedi
      // SchemaNodeSymbol.tsx) — intercettava ogni clic anche sui pallini disegnati sopra di lui,
      // `document.elementFromPoint` restituiva il rettangolo del nodo, mai il pallino.
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 1001 }}
      width={1}
      height={1}
    >
      {/* Il riquadro della sagoma: trascina per traslare, doppio clic per aggiungere un'ancora
          nel punto agganciato alla griglia (Step 3 del brief). */}
      <rect
        className="nopan"
        x={sagomaX}
        y={sagomaY}
        width={sagomaLarghezza}
        height={sagomaAltezza}
        fill="rgba(156, 39, 176, 0.08)"
        stroke="#9c27b0"
        strokeWidth={1.5}
        strokeDasharray="6 4"
        style={{ cursor: 'move', pointerEvents: 'all' }}
        onPointerDown={suPointerDownCorpo}
        onPointerMove={corpoGesto.suPointerMove}
        onPointerUp={corpoGesto.suPointerUp}
        onPointerCancel={corpoGesto.suPointerCancel}
        onDoubleClick={suDoppioClic}
      />

      <rect
        className="nopan"
        x={sagomaX + sagomaLarghezza - LATO_MANIGLIA / 2}
        y={sagomaY + sagomaAltezza / 2 - LATO_MANIGLIA / 2}
        width={LATO_MANIGLIA}
        height={LATO_MANIGLIA}
        fill="#9c27b0"
        style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
        onPointerDown={estGesto.suPointerDown}
        onPointerMove={estGesto.suPointerMove}
        onPointerUp={estGesto.suPointerUp}
        onPointerCancel={estGesto.suPointerCancel}
      />
      <rect
        className="nopan"
        x={sagomaX + sagomaLarghezza / 2 - LATO_MANIGLIA / 2}
        y={sagomaY + sagomaAltezza - LATO_MANIGLIA / 2}
        width={LATO_MANIGLIA}
        height={LATO_MANIGLIA}
        fill="#9c27b0"
        style={{ cursor: 'ns-resize', pointerEvents: 'all' }}
        onPointerDown={sudGesto.suPointerDown}
        onPointerMove={sudGesto.suPointerMove}
        onPointerUp={sudGesto.suPointerUp}
        onPointerCancel={sudGesto.suPointerCancel}
      />
      <rect
        className="nopan"
        x={sagomaX + sagomaLarghezza - LATO_MANIGLIA / 2}
        y={sagomaY + sagomaAltezza - LATO_MANIGLIA / 2}
        width={LATO_MANIGLIA}
        height={LATO_MANIGLIA}
        fill="#9c27b0"
        style={{ cursor: 'nwse-resize', pointerEvents: 'all' }}
        onPointerDown={sudEstGesto.suPointerDown}
        onPointerMove={sudEstGesto.suPointerMove}
        onPointerUp={sudEstGesto.suPointerUp}
        onPointerCancel={sudEstGesto.suPointerCancel}
      />

      {taratura.ancore.map((ancora) => (
        <PallinoAncora
          key={ancora.id}
          ancora={ancora}
          origine={origine}
          selezionata={ancora.id === ancoraSelezionata}
          onSeleziona={onSelezionaAncora}
          onSposta={onSpostaAncora}
        />
      ))}
    </svg>
  )
}

/* ------------------------------------------------------------------------------------------ *
 * Il dialogo a tre vie
 * ------------------------------------------------------------------------------------------ */

export interface DialogoUscitaTaraturaProps {
  open: boolean
  isAdmin: boolean
  /** Vero mentre una scrittura verso il database è in corso (permanente o sua cancellazione):
   *  i pulsanti restano disabilitati, per non lasciare che un secondo clic parta in mezzo al
   *  primo. */
  salvando: boolean
  onTornaDefault: (cancellaPermanente: boolean) => void
  onRendiPermanenti: () => void
  onUsaSoloQuestaVolta: () => void
}

/**
 * Le tre vie chieste dal committente, con le sue stesse parole. Nessun `onClose`: senza,
 * backdrop e Escape non chiudono nulla — non esiste uscita implicita dal modo taratura (Step 4
 * del brief), si passa sempre da uno dei tre pulsanti. Stessa ragione per cui non c'è una "X" in
 * alto.
 */
export function DialogoUscitaTaratura({
  open,
  isAdmin,
  salvando,
  onTornaDefault,
  onRendiPermanenti,
  onUsaSoloQuestaVolta,
}: DialogoUscitaTaraturaProps) {
  const [cancellaPermanente, setCancellaPermanente] = useState(false)

  // Si azzera a ogni RIAPERTURA, non quando resta chiuso: senza, una spunta lasciata accesa da
  // un'uscita precedente sopravvivrebbe silenziosa alla prossima.
  useEffect(() => {
    if (open) setCancellaPermanente(false)
  }, [open])

  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle>Uscita dal modo taratura</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Le modifiche alle ancore e alla sagoma di questo simbolo restano in sospeso: scegli come
          chiuderle.
        </DialogContentText>
        {isAdmin && (
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox
                checked={cancellaPermanente}
                onChange={(e) => setCancellaPermanente(e.target.checked)}
                disabled={salvando}
              />
            }
            label="«Torna a default» cancella anche la taratura permanente di questo simbolo"
          />
        )}
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap' }}>
        <Button onClick={() => onTornaDefault(cancellaPermanente)} disabled={salvando}>
          Torna a default
        </Button>
        {isAdmin && (
          <Tooltip title="Scrive in tabella: vale per ogni pratica dell'applicazione, comprese quelle già consegnate">
            <span>
              <Button onClick={onRendiPermanenti} disabled={salvando}>
                Rendi permanenti
              </Button>
            </span>
          </Tooltip>
        )}
        <Button variant="contained" onClick={onUsaSoloQuestaVolta} disabled={salvando}>
          Usa solo questa volta
        </Button>
      </DialogActions>
    </Dialog>
  )
}
