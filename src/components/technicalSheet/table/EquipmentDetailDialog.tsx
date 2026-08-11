import { useWatch, type Control } from 'react-hook-form'
import type { ReactNode } from 'react'
import {
  Box, Button, Chip, Dialog, IconButton, Tooltip, Typography,
} from '@mui/material'
import {
  Close as CloseIcon, AddLink as AddLinkIcon, Delete as DeleteIcon,
  ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon,
} from '@mui/icons-material'
import { CompletenessBar } from '@/components/common'
import { radii } from '@/theme/tokens'
import { completezzaRiga, eCompleta } from '@/utils/schedaCompleteness'
import { CheckCell, NumberCell, SelectCell, TextCell } from './EquipmentCells'
import { ValvoleProtezioneCell } from './ValvoleProtezioneCell'
import { useCellePrincipali } from './useCellePrincipali'
import { useCampoExit } from './useCampoExit'
import type { EquipmentTypeDef, ExtraFieldDef } from './equipmentConfig'
import type { EquipmentCatalogItem } from '@/types'

/**
 * Riga di cui sono aperti i dettagli.
 *
 * Si tiene l'oggetto intero e non il solo percorso perché la finestra deve poter
 * eliminare e appendere come faceva la riga: le chiusure arrivano da chi ha in mano i
 * field array.
 */
export interface DettaglioRiga {
  def: EquipmentTypeDef
  base: string
  code: string
  color: string
  /** Applica al form i dati tecnici della voce scelta a catalogo. */
  onSelected: (specs: Record<string, any>, item?: EquipmentCatalogItem) => void
  /**
   * Chiamata a compilazione di un campo finita: verifica lo scostamento dai dati di catalogo.
   * È la stessa della riga di tabella — la domanda su un valore scostato non può dipendere da
   * dove lo si è digitato.
   */
  onExit: () => void
  onDelete: (() => void) | null
  append: { label: string; onClick: () => void } | null
}

interface EquipmentDetailDialogProps {
  control: Control<any>
  dettaglio: DettaglioRiga | null
  /** Colonne avanzate visibili: a `tecnicoDM329` alcune non si mostrano. */
  adv: boolean
  /** Posizione nella tabella, per scorrere senza chiudere. 1-based. */
  posizione: { indice: number; totale: number }
  onNaviga: (delta: number) => void
  onClose: () => void
}

/**
 * Campo etichettato a piena larghezza della propria colonna di griglia.
 *
 * `data-campo` marca il confine su cui `useCampoExit` dichiara finita la compilazione: è
 * l'equivalente della cella nella tabella.
 */
const Campo = ({ label, children, largo }: { label: ReactNode; children: ReactNode; largo?: boolean }) => (
  <Box data-campo sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0, ...(largo ? { gridColumn: '1 / -1' } : {}) }}>
    <Typography
      component="span"
      sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'text.disabled' }}
    >
      {label}
    </Typography>
    {/* Il controllo prende tutta la larghezza del campo. Senza `flex` sul figlio, un
        controllo che non dichiara una larghezza propria — il contenitore dei due
        autocomplete di marca e modello — collassa sul contenuto minimo dentro questo
        flex, e mostra tre lettere di un nome che ne ha venti. */}
    <Box
      sx={{
        border: 1, borderColor: 'divider', borderRadius: `${radii.control}px`,
        minHeight: 30, display: 'flex', alignItems: 'center',
        '& > *': { flex: '1 1 auto', minWidth: 0 },
      }}
    >
      {children}
    </Box>
  </Box>
)

/**
 * Contenuto della finestra. Componente a sé perché osserva i valori della riga per
 * tenere aggiornata la completezza, e gli hook non possono stare nel ramo condizionale
 * del genitore.
 */
const Contenuto = ({
  control, dettaglio, adv, posizione, onNaviga, onClose,
}: EquipmentDetailDialogProps & { dettaglio: DettaglioRiga }) => {
  const { def, base, code, color, onSelected, onExit, onDelete, append } = dettaglio
  const valori = useWatch({ control, name: base })
  const completezza = completezzaRiga(def, valori)
  const pieno = eCompleta(completezza)
  const celle = useCellePrincipali({ control, def, base, adv, onSelected })
  /**
   * Gli stessi confini della tabella: finito un campo si verifica lo scostamento dal catalogo.
   * Sta sul corpo e non sull'intera finestra perché testata e piede non portano campi, e i
   * loro pulsanti — «successiva», «chiudi» — devono contare come uscita, non come rientro.
   */
  const campoExit = useCampoExit(onExit, '[data-campo]')

  /**
   * I campi extra del tipo, filtrati dalla propria condizione di visibilità. Il filtro sta
   * qui e non in un componente per campo — come faceva il pannello laterale — perché la
   * griglia deve sapere quanti campi mostra prima di disporli: un campo che si toglie di
   * mezzo da solo lascerebbe un buco nella riga.
   */
  const extraVisibili = def.extra.filter((f: ExtraFieldDef) => {
    if (!f.showIf) return true
    const dip = (valori ?? {})[f.showIf.field]
    return dip === f.showIf.equals
  })

  return (
    <>
      {/* Testata: identità della riga, avanzamento e navigazione. La banda del colore del
          tipo sta sul bordo alto della finestra, come le bande delle due sezioni. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ width: 11, height: 11, borderRadius: '3px', bgcolor: color, flex: 'none' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{code}</Typography>
        <Typography variant="body2" color="text.secondary">{def.label.toLowerCase()}</Typography>

        <Box sx={{ ml: 1.5 }}>
          <CompletenessBar completezza={completezza} larghezza={110} />
        </Box>

        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <Tooltip title="Apparecchiatura precedente">
            <IconButton size="small" onClick={() => onNaviga(-1)} aria-label="Apparecchiatura precedente">
              <ChevronLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography component="span" sx={{ fontSize: '0.72rem', color: 'text.disabled', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {posizione.indice} di {posizione.totale}
          </Typography>
          <Tooltip title="Apparecchiatura successiva">
            <IconButton size="small" onClick={() => onNaviga(1)} aria-label="Apparecchiatura successiva">
              <ChevronRightIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onClose} aria-label="Chiudi i dettagli" sx={{ ml: 0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Corpo: tutti i campi dell'apparecchiatura in una griglia densa. Niente titoli di
          gruppo — costavano una riga intera ciascuno e mandavano la finestra sotto la
          piega proprio sui tipi che hanno più campi. */}
      <Box {...campoExit} sx={{ px: 2, py: 1.75, overflowY: 'auto' }}>
        {!pieno && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {completezza.mancanti.map((m) => (
              <Chip key={m} label={m} size="small" variant="outlined" color="warning" sx={{ height: 20, fontSize: '0.68rem' }} />
            ))}
          </Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1.25, alignItems: 'end' }}>
          {/* Marca e modello sono i due campi da cui dipende tutto il resto — è la voce di
              catalogo che poi autocompila pressione, capacità, TS e categoria — e portano i
              valori più lunghi della scheda. Qui prendono una riga intera e la resa piena
              del componente, con le etichette proprie: la resa compatta della tabella li
              stringeva a tre lettere. */}
          <Box
            data-campo
            sx={{
              gridColumn: '1 / -1',
              '& > div': { display: 'flex', gap: 1.5 },
              '& > div > .MuiAutocomplete-root': { flex: '1 1 0', minWidth: 0 },
            }}
          >
            {celle.marcaModello(false)}
          </Box>

          {celle.ps && <Campo label={def.kind === 'valvola' ? 'Ptar (bar)' : 'PS (bar)'}>{celle.ps}</Campo>}
          {celle.capacita && <Campo label={etichettaCapacita(def)}>{celle.capacita}</Campo>}
          {celle.ts && <Campo label="TS (°C)">{celle.ts}</Campo>}
          {celle.cat && <Campo label="Categoria PED">{celle.cat}</Campo>}
          <Campo label="Anno">{celle.anno}</Campo>
          <Campo label="N° fabbrica">{celle.nf}</Campo>

          {extraVisibili.map((f) => (
            <Campo key={f.name} label={f.label} largo={f.name === 'note'}>
              <ExtraControl control={control} base={base} f={f} />
            </Campo>
          ))}
        </Box>
      </Box>

      {/* Piede: le azioni che riguardano l'apparecchiatura intera, e il promemoria sul
          denominatore — senza, una riga mezza vuota che risulta completa sembra un errore
          di conteggio. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
        {append && (
          <Button size="small" variant="outlined" color="primary" startIcon={<AddLinkIcon />}
            onClick={append.onClick} sx={{ borderColor: 'primary.main' }}>
            Appendi {append.label.toLowerCase()}
          </Button>
        )}
        {onDelete && (
          <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={onDelete}>
            Elimina
          </Button>
        )}
        <Typography variant="caption" color="text.disabled" sx={{ minWidth: 0 }}>
          {completezza.previsti} campi previsti per {def.label.toLowerCase()}: gli altri non si applicano a questo tipo.
        </Typography>
        <Button size="small" variant="contained" onClick={onClose} sx={{ ml: 'auto' }}>
          Chiudi
        </Button>
      </Box>
    </>
  )
}

/** Nome della capacità: cambia col tipo, ed è l'unica colonna che lo fa. */
const etichettaCapacita = (def: EquipmentTypeDef) => {
  switch (def.kind) {
    case 'compressore': return 'FAD (l/min)'
    case 'essiccatore': return 'Portata trattata (l/min)'
    case 'valvola':     return 'Qmax (l/min)'
    default:            return 'Volume (l)'
  }
}

/**
 * Controllo di un campo extra. È un componente e non una chiamata perché alcuni tipi di
 * campo montano hook propri.
 */
const ExtraControl = ({ control, base, f }: { control: Control<any>; base: string; f: ExtraFieldDef }) => {
  const name = `${base}.${f.name}`
  if (f.kind === 'multi') return <ValvoleProtezioneCell control={control} name={name} />
  if (f.kind === 'select') {
    return <SelectCell control={control} name={name} options={[...(f.options || [])]} display={f.display} labels={f.labels} emptyLabel={f.emptyLabel} />
  }
  if (f.kind === 'check') return <CheckCell control={control} name={name} />
  if (f.kind === 'number') return <NumberCell control={control} name={name} min={f.min} max={f.max} step={f.step} />
  return <TextCell control={control} name={name} placeholder={f.label} />
}

/**
 * Tutti i dati di un'apparecchiatura in una finestra, al posto della colonna che prima
 * affiancava la tabella.
 *
 * La colonna mostrava i soli campi extra e si portava via metà larghezza della tabella:
 * per vedere il resto della riga bisognava chiuderla. Qui i campi ci sono tutti e la
 * tabella resta intera dietro, quindi la finestra si può aprire e chiudere senza perdere
 * il posto in cui si stava compilando.
 */
export const EquipmentDetailDialog = (props: EquipmentDetailDialogProps) => {
  const { dettaglio, onClose } = props

  return (
    <Dialog
      open={!!dettaglio}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: `${radii.card}px`,
          borderTop: '3px solid',
          borderTopColor: dettaglio?.color ?? 'divider',
        },
      }}
    >
      {/* `key` sul percorso della riga: passando all'apparecchiatura successiva il contenuto
          si rimonta invece di riusare i controlli già in pagina.
          I campi cambiano nome ma restano gli stessi componenti, e sia react-hook-form —
          che serve il valore letto alla registrazione finché un evento non lo smuove — sia
          MUI — che tiene un proprio `inputValue` — continuavano a mostrare l'apparecchiatura
          lasciata. Non è solo un errore di lettura: alla prima modifica quei valori
          finivano davvero nella riga di arrivo. */}
      {dettaglio && <Contenuto key={dettaglio.base} {...props} dettaglio={dettaglio} />}
    </Dialog>
  )
}
