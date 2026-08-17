/**
 * Pannello delle scelte sulla forma dello schema: ordine delle apparecchiature, chi scarica
 * condensa, quali stanno sotto lo stesso by-pass.
 *
 * Non tocca il disegno. Scrive solo `additional_info.schemaPreferenze`, e l'effetto si vede
 * premendo «Rigenera da capo»: decisione del committente, perché il disegno può essere già stato
 * rifinito a mano e nessun gesto in questo pannello deve poter buttare via quel lavoro.
 *
 * Tre liste separate per famiglia, non una sola: la contiguità che un by-pass richiede ha senso
 * solo dentro la linea di trattamento, e una lista unica permetterebbe di trascinare un
 * compressore in mezzo ai filtri — un gesto che il disegno non sa rendere.
 *
 * Nessuna logica qui: ordine di default, contiguità e id dei gruppi vengono da
 * `services/schemaImpianto/preferenze.ts`, che è provabile senza DOM (il progetto non scrive test
 * di interfaccia). Questo file impagina e basta.
 */
import { useMemo, useState } from 'react'
import { Alert, Box, Checkbox, Chip, IconButton, Stack, Tooltip, Typography, Button } from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import CloseIcon from '@mui/icons-material/Close'
import CallSplitIcon from '@mui/icons-material/CallSplit'
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
  risolviPreferenze,
} from '@/services/schemaImpianto/preferenze'
import type { SchemaNodo } from '@/services/schemaImpianto/types'

export interface PannelloPreferenzeSchemaProps {
  scheda: SchedaDatiCompleta
  preferenze: SchemaPreferenze
  onChange: (preferenze: SchemaPreferenze) => void
}

/** Quale gruppo by-pass tocca una riga, e se ne è la prima o l'ultima: serve solo a disegnare la
 *  parentesi a lato, che deve chiudersi in cima e in fondo al gruppo. */
interface AppartenenzaBypass {
  id: string
  primo: boolean
}

interface RigaProps {
  nodo: SchemaNodo
  condensa: boolean
  onCondensa: (acceso: boolean) => void
  trascinabile: boolean
  selezione?: { scelto: boolean; onScelto: (scelto: boolean) => void }
  bypass?: AppartenenzaBypass
  onSciogliBypass?: () => void
}

function Riga({ nodo, condensa, onCondensa, trascinabile, selezione, bypass, onSciogliBypass }: RigaProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: nodo.id,
    disabled: !trascinabile,
  })

  return (
    <Box
      ref={setNodeRef}
      sx={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        bgcolor: 'action.hover',
        // La banda a sinistra è la parentesi del gruppo by-pass: c'è su tutte le righe del
        // gruppo, così l'occhio ne vede l'estensione senza doverla dedurre dai chip.
        borderLeft: bypass ? '3px solid' : '3px solid transparent',
        borderLeftColor: bypass ? 'primary.main' : 'transparent',
      }}
    >
      {selezione && (
        <Checkbox
          size="small"
          checked={selezione.scelto}
          onChange={(e) => selezione.onScelto(e.target.checked)}
          inputProps={{ 'aria-label': `Seleziona ${nodo.id}` }}
        />
      )}

      {trascinabile ? (
        <IconButton
          size="small"
          {...attributes}
          {...listeners}
          sx={{ cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
          aria-label={`Sposta ${nodo.id}`}
        >
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
      ) : (
        <Box sx={{ width: 34 }} />
      )}

      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 48 }}>
        {nodo.id}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }} noWrap>
        {nodo.etichetta}
      </Typography>

      {bypass?.primo && onSciogliBypass && (
        <Chip
          size="small"
          color="primary"
          variant="outlined"
          label={`by-pass ${bypass.id}`}
          onDelete={onSciogliBypass}
          deleteIcon={
            <Tooltip title="Sciogli il by-pass">
              <CloseIcon />
            </Tooltip>
          }
        />
      )}

      <Tooltip title="Collega alla linea di raccolta condense">
        <Checkbox
          size="small"
          checked={condensa}
          onChange={(e) => onCondensa(e.target.checked)}
          inputProps={{ 'aria-label': `Condense di ${nodo.id}` }}
        />
      </Tooltip>
    </Box>
  )
}

export default function PannelloPreferenzeSchema({
  scheda,
  preferenze,
  onChange,
}: PannelloPreferenzeSchemaProps) {
  const famiglie = useMemo(() => famiglieDaScheda(scheda), [scheda])
  // `() => true` come regola di default: il pannello mostra spuntata ogni apparecchiatura che PUÒ
  // scaricare condensa. Dal Blocco 2 questa dev'essere la stessa funzione che usa il generatore
  // (`scaricaCondensa`), o la spunta mostrata qui mentirebbe sul disegno che uscirà.
  const risolte = useMemo(() => risolviPreferenze(preferenze, famiglie, () => true), [preferenze, famiglie])

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
        { id: prossimoIdBypass(risolte.bypass), stadi: [...selezionati] },
      ],
    })
    setSelezionati([])
  }

  const sciogli = (id: string) =>
    onChange({ ...preferenze, bypass: risolte.bypass.filter((g) => g.id !== id) })

  const lista = (
    titolo: string,
    spiegazione: string,
    ordine: string[],
    chiave: 'ordineCompressori' | 'ordineSerbatoi' | 'ordineStadi',
    conBypass = false
  ) =>
    ordine.length === 0 ? null : (
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
          {titolo}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
          {spiegazione}
        </Typography>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={riordina(chiave, ordine)}>
          <SortableContext items={ordine} strategy={verticalListSortingStrategy}>
            <Stack spacing={0.5}>
              {ordine.map((id) => {
                const nodo = perId.get(id)
                if (!nodo) return null
                return (
                  <Riga
                    key={id}
                    nodo={nodo}
                    condensa={risolte.condense.has(id)}
                    onCondensa={(acceso) => setCondensa(id, acceso)}
                    trascinabile
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
            </Stack>
          </SortableContext>
        </DndContext>
      </Box>
    )

  return (
    <Stack spacing={2}>
      {risolte.bypassScartati.length > 0 && (
        <Alert severity="warning">
          {risolte.bypassScartati.length === 1 ? 'Un by-pass è stato sciolto' : 'Alcuni by-pass sono stati sciolti'}{' '}
          perché le apparecchiature che scavalcavano non sono più una alla fine dell’altra:{' '}
          {risolte.bypassScartati.join(', ')}.
        </Alert>
      )}

      {lista(
        'Compressori',
        'Ordine in sala, da sinistra a destra. La spunta a destra collega alla linea condense.',
        risolte.ordineCompressori,
        'ordineCompressori'
      )}

      {lista(
        'Serbatoi',
        'Il primo apre la linea di distribuzione.',
        risolte.ordineSerbatoi,
        'ordineSerbatoi'
      )}

      {lista(
        'Linea di trattamento',
        'Ordine da sinistra a destra. Spunta a sinistra più «Crea by-pass» per raggruppare apparecchiature attaccate sotto un solo by-pass.',
        risolte.ordineStadi,
        'ordineStadi',
        true
      )}

      {risolte.ordineStadi.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
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
    </Stack>
  )
}
