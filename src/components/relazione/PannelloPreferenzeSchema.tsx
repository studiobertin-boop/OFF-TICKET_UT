/**
 * Pannello delle scelte sulla forma dello schema: ordine delle apparecchiature, chi scarica
 * condensa, quali stanno sotto lo stesso by-pass.
 *
 * Non tocca il disegno. Scrive solo `additional_info.schemaPreferenze`, e l'effetto si vede
 * premendo «Rigenera da capo»: decisione del committente, perché il disegno può essere già stato
 * rifinito a mano e nessun gesto in questo pannello deve poter buttare via quel lavoro.
 *
 * Un'unica tabella, non tre elenchi separati: le intestazioni di colonna restano fisse mentre
 * le tre famiglie (compressori/serbatoi/linea di trattamento) restano sotto-sezioni distinte —
 * ciascuna col proprio `DndContext`, perché la contiguità che un by-pass richiede ha senso solo
 * dentro la linea di trattamento, e mescolare le righe in un solo trascinamento permetterebbe di
 * infilare un compressore in mezzo ai filtri, un gesto che il disegno non sa rendere. I testi
 * esplicativi, prima sempre visibili sotto ogni titolo, sono finiti in tooltip: la tabella
 * compatta si legge a colpo d'occhio, la spiegazione resta a un passaggio del mouse.
 *
 * Nessuna logica qui: ordine di default, contiguità e id dei gruppi vengono da
 * `services/schemaImpianto/preferenze.ts`, che è provabile senza DOM (il progetto non scrive test
 * di interfaccia). Questo file impagina e basta.
 */
import { Fragment, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  Button,
} from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import CloseIcon from '@mui/icons-material/Close'
import CallSplitIcon from '@mui/icons-material/CallSplit'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import type { SchemaPreferenze } from '@/services/relazione/types'
import {
  contigui,
  famiglieDaScheda,
  prossimoIdBypass,
  preferenzeRisolteDaScheda,
} from '@/services/schemaImpianto/preferenze'
import type { SchemaNodo } from '@/services/schemaImpianto/types'

export interface PannelloPreferenzeSchemaProps {
  scheda: SchedaDatiCompleta
  preferenze: SchemaPreferenze
  onChange: (preferenze: SchemaPreferenze) => void
}

/** Quale gruppo by-pass tocca una riga, e se ne è la prima o l'ultima: serve solo a disegnare la
 *  banda a lato, che deve restare colorata dalla prima all'ultima riga del gruppo. */
interface AppartenenzaBypass {
  id: string
  primo: boolean
}

interface RigaProps {
  nodo: SchemaNodo
  condensa: boolean
  onCondensa: (acceso: boolean) => void
  conBypass: boolean
  selezione?: { scelto: boolean; onScelto: (scelto: boolean) => void }
  bypass?: AppartenenzaBypass
  onSciogliBypass?: () => void
}

function Riga({ nodo, condensa, onCondensa, conBypass, selezione, bypass, onSciogliBypass }: RigaProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: nodo.id,
  })

  return (
    <TableRow
      ref={setNodeRef}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        bgcolor: isDragging ? 'action.hover' : undefined,
      }}
    >
      <TableCell
        padding="none"
        sx={{
          width: 34,
          pl: 1,
          // La banda a sinistra è l'indicatore del gruppo by-pass: c'è su tutte le righe del
          // gruppo, così l'occhio ne vede l'estensione senza doverla dedurre dai chip.
          borderLeft: bypass ? '3px solid' : '3px solid transparent',
          borderLeftColor: bypass ? 'primary.main' : 'transparent',
        }}
      >
        <IconButton
          size="small"
          {...attributes}
          {...listeners}
          sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
          aria-label={`Sposta ${nodo.id}`}
        >
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
      </TableCell>

      <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{nodo.id}</TableCell>

      <TableCell sx={{ color: 'text.secondary', maxWidth: 320 }}>
        <Typography variant="body2" color="text.secondary" noWrap>
          {nodo.etichetta}
        </Typography>
      </TableCell>

      <TableCell align="center">
        {conBypass && selezione && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <Checkbox
              size="small"
              checked={selezione.scelto}
              onChange={(e) => selezione.onScelto(e.target.checked)}
              inputProps={{ 'aria-label': `Seleziona ${nodo.id}` }}
            />
            {bypass?.primo && onSciogliBypass && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={bypass.id}
                onDelete={onSciogliBypass}
                deleteIcon={
                  <Tooltip title="Sciogli il by-pass">
                    <CloseIcon />
                  </Tooltip>
                }
              />
            )}
          </Box>
        )}
      </TableCell>

      <TableCell align="center">
        <Tooltip title="Collega alla linea di raccolta condense">
          <Checkbox
            size="small"
            checked={condensa}
            onChange={(e) => onCondensa(e.target.checked)}
            inputProps={{ 'aria-label': `Condense di ${nodo.id}` }}
          />
        </Tooltip>
      </TableCell>
    </TableRow>
  )
}

export default function PannelloPreferenzeSchema({
  scheda,
  preferenze,
  onChange,
}: PannelloPreferenzeSchemaProps) {
  const famiglie = useMemo(() => famiglieDaScheda(scheda), [scheda])
  // `preferenzeRisolteDaScheda`, non una risoluzione propria: e' l'unico ingresso, e la regola di
  // default delle condense che applica e' la stessa del generatore (`scaricaCondensa`). Fino al
  // 18-08-2026 qui passava `() => true` e la spunta mostrata mentiva sul disegno che sarebbe
  // uscito.
  const risolte = useMemo(() => preferenzeRisolteDaScheda(scheda, preferenze), [scheda, preferenze])

  const [selezionati, setSelezionati] = useState<string[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const perId = useMemo(() => {
    const mappa = new Map<string, SchemaNodo>()
    for (const n of [...famiglie.compressori, ...famiglie.serbatoi, ...famiglie.stadi]) mappa.set(n.id, n)
    return mappa
  }, [famiglie])

  const setCondensa = (id: string, acceso: boolean) =>
    // Si scrive il valore esplicito e non si toglie la chiave: togliendola tornerebbe il default,
    // e la spunta si rimetterebbe da sola sotto le dita dell'operatore.
    onChange({ ...preferenze, condense: { ...(preferenze.condense ?? {}), [id]: acceso } })

  const riordina =
    (chiave: 'ordineCompressori' | 'ordineSerbatoi' | 'ordineStadi', ordineCorrente: string[]) =>
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return
      const da = ordineCorrente.indexOf(String(active.id))
      const a = ordineCorrente.indexOf(String(over.id))
      if (da < 0 || a < 0) return
      // Si salva l'ordine COMPLETO, non solo le righe mosse: così ciò che si vede è ciò che è
      // salvato, e non dipende da quali righe sono state trascinate in passato.
      onChange({ ...preferenze, [chiave]: arrayMove(ordineCorrente, da, a) })
    }

  const appartenenza = useMemo(() => {
    const mappa = new Map<string, AppartenenzaBypass>()
    for (const gruppo of risolte.bypass) {
      gruppo.stadi.forEach((id, i) => mappa.set(id, { id: gruppo.id, primo: i === 0 }))
    }
    return mappa
  }, [risolte.bypass])

  const selezioneContigua = contigui(selezionati, risolte.ordineStadi)
  const selezioneLibera = selezionati.every((id) => !appartenenza.has(id))

  const creaBypass = () => {
    onChange({
      ...preferenze,
      bypass: [
        ...risolte.bypass,
        {
          id: prossimoIdBypass(risolte.bypass),
          // Nell'ordine del disegno, non in quello in cui l'operatore ha spuntato le caselle:
          // `risolviPreferenze` li rimetterebbe comunque in fila leggendoli, ma quel che finisce
          // in banca dati dev'essere leggibile da sé, non un elenco da riordinare per capirlo.
          stadi: risolte.ordineStadi.filter((id) => selezionati.includes(id)),
        },
      ],
    })
    setSelezionati([])
  }

  const sciogli = (id: string) =>
    onChange({ ...preferenze, bypass: risolte.bypass.filter((g) => g.id !== id) })

  const gruppo = (
    titolo: string,
    spiegazione: string,
    ordine: string[],
    chiave: 'ordineCompressori' | 'ordineSerbatoi' | 'ordineStadi',
    conBypass = false
  ) =>
    ordine.length === 0 ? null : (
      <Fragment key={chiave}>
        <TableRow>
          <TableCell colSpan={5} sx={{ bgcolor: 'action.hover', py: 0.5, border: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="subtitle2">{titolo}</Typography>
              <Tooltip title={spiegazione}>
                <InfoOutlinedIcon fontSize="inherit" sx={{ color: 'text.secondary' }} />
              </Tooltip>
            </Box>
          </TableCell>
        </TableRow>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={riordina(chiave, ordine)}>
          <SortableContext items={ordine} strategy={verticalListSortingStrategy}>
            {ordine.map((id) => {
              const nodo = perId.get(id)
              if (!nodo) return null
              return (
                <Riga
                  key={id}
                  nodo={nodo}
                  condensa={risolte.condense.has(id)}
                  onCondensa={(acceso) => setCondensa(id, acceso)}
                  conBypass={conBypass}
                  selezione={
                    conBypass
                      ? {
                          scelto: selezionati.includes(id),
                          onScelto: (scelto) =>
                            setSelezionati((prima) =>
                              scelto ? [...prima, id] : prima.filter((x) => x !== id)
                            ),
                        }
                      : undefined
                  }
                  bypass={conBypass ? appartenenza.get(id) : undefined}
                  onSciogliBypass={() => sciogli(appartenenza.get(id)?.id ?? '')}
                />
              )
            })}
          </SortableContext>
        </DndContext>
      </Fragment>
    )

  return (
    <Box>
      {risolte.bypassScartati.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {/* Il soggetto di «scavalcava» è il by-pass, non le apparecchiature: al singolare la
              concordanza cambia, e scriverne una sola per i due casi suona sbagliata in uno. */}
          {risolte.bypassScartati.length === 1
            ? 'Un by-pass è stato sciolto perché le apparecchiature che scavalcava non sono più una alla fine dell’altra: '
            : 'Alcuni by-pass sono stati sciolti perché le apparecchiature che scavalcavano non sono più una alla fine dell’altra: '}
          {risolte.bypassScartati.join(', ')}.
        </Alert>
      )}

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="none" sx={{ width: 34 }} />
              <TableCell>Codice</TableCell>
              <TableCell>Descrizione</TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  By-pass
                  <Tooltip title="Seleziona una o più apparecchiature attaccate fra loro, poi premi «Crea by-pass» sotto la tabella per raggrupparle.">
                    <InfoOutlinedIcon fontSize="inherit" sx={{ color: 'text.secondary' }} />
                  </Tooltip>
                </Box>
              </TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  Condense
                  <Tooltip title="Collega alla linea di raccolta condense.">
                    <InfoOutlinedIcon fontSize="inherit" sx={{ color: 'text.secondary' }} />
                  </Tooltip>
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {gruppo('Compressori', 'Ordine in sala, da sinistra a destra.', risolte.ordineCompressori, 'ordineCompressori')}
            {gruppo('Serbatoi', 'Il primo apre la linea di distribuzione.', risolte.ordineSerbatoi, 'ordineSerbatoi')}
            {gruppo(
              'Linea di trattamento',
              'Ordine da sinistra a destra.',
              risolte.ordineStadi,
              'ordineStadi',
              true
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {risolte.ordineStadi.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CallSplitIcon />}
            disabled={selezionati.length === 0 || !selezioneContigua || !selezioneLibera}
            onClick={creaBypass}
          >
            Crea by-pass
          </Button>
          <Typography variant="caption" color="text.secondary">
            {selezionati.length === 0
              ? 'Seleziona una o più apparecchiature attaccate fra loro.'
              : !selezioneLibera
                ? 'Una delle apparecchiature scelte sta già sotto un by-pass.'
                : !selezioneContigua
                  ? 'Le apparecchiature scelte non sono una alla fine dell’altra.'
                  : `Verranno scavalcate: ${selezionati.join(', ')}.`}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
