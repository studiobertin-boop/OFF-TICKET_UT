import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  IconButton,
  TextField,
  Checkbox,
  ListItemText,
  Button,
  Typography,
  Popover,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  Divider,
  Tooltip,
} from '@mui/material'
import {
  Clear as ClearIcon,
  Print as PrintIcon,
  FileDownload as FileDownloadIcon,
  FilterList as FilterListIcon,
  PriorityHigh as PriorityHighIcon,
  Warning as WarningIcon,
  AccessTime as AccessTimeIcon,
  Block as BlockIcon,
} from '@mui/icons-material'
import { Request, DM329Status, StatoFattura, STATO_FATTURA_OPTIONS, STATO_FATTURA_LABELS } from '@/types'
import { getStatusColor, getStatusLabel, ALL_DM329_STATUSES, DM329_STATUS_LABELS } from '@/utils/workflow'
import { StatusChip } from '@/components/common'
import { getStatusChipColors } from '@/theme/statusColors'
import { useThemeMode } from '@/theme'
import { usePersistedState } from '@/hooks/usePersistedState'
import { useAuth } from '@/hooks/useAuth'
import { EditableSelectCell } from './EditableSelectCell'
import { requestsApi } from '@/services/api/requests'
import { updateRequestStatus } from '@/services/requestService'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { computeClientSalaCounts, codiceForRequest } from '@/utils/practiceCode'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import {
  generatePrintHTML,
  printHTML,
  formatClienteField,
  formatDateField,
  formatBooleanField,
  createFilterDescription,
} from '@/utils/print'
import ExportRequestsDialog from './ExportRequestsDialog'

interface DM329TableViewProps {
  requests: Request[]
  selectedRequests?: Set<string>
  onSelectRequest?: (id: string) => void
  onSelectAll?: (selected: boolean) => void
  selectionEnabled?: boolean
  showPrintButton?: boolean
  // Stato da preselezionare nel filtro (deep-link da tile dashboard)
  initialStatoFilter?: string
}

type OrderDirection = 'asc' | 'desc'
type OrderBy =
  | 'codice'
  | 'cliente'
  | 'sala'
  | 'status'
  | 'updated_at'
  | 'note'
  | 'is_urgent'
  | 'is_blocked'
  | 'has_timer_alert'
  | 'no_civa'
  | 'stato_fattura'

// Colonna filtrabile → chiave del popover
type FilterCol = 'cliente' | 'tipo' | 'stato' | 'segnal' | 'note' | 'fattura'

type TriState = 'all' | 'true' | 'false'

const DM329_STATUSES: DM329Status[] = [
  '1-INCARICO_RICEVUTO',
  '2-SCHEDA_DATI_PRONTA',
  '3-MAIL_CLIENTE_INVIATA',
  '4-DOCUMENTI_PRONTI',
  '5-ATTESA_FIRMA',
  '6-PRONTA_PER_CIVA',
  '7-CHIUSA',
]

// Icone/colori degli allarmi (coerenti con gli indicatori usati altrove)
const SEGNAL_META: { key: OrderBy; label: string; Icon: typeof PriorityHighIcon; color: string }[] = [
  { key: 'is_urgent', label: 'Urgente', Icon: PriorityHighIcon, color: 'error.main' },
  { key: 'is_blocked', label: 'Bloccata', Icon: WarningIcon, color: 'warning.main' },
  { key: 'has_timer_alert', label: 'Scaduta', Icon: AccessTimeIcon, color: 'error.main' },
  { key: 'no_civa', label: 'No CIVA', Icon: BlockIcon, color: 'primary.main' },
]

// Larghezze fisse (px) delle colonne compatte; Cliente resta flessibile (assorbe lo spazio)
const W = {
  select: 44,
  codice: 120,
  sala: 130,
  tipo: 92,
  stato: 170,
  data: 104,
  segnal: 134,
  note: 240,
  fattura: 120,
}

// Cella "Segnalazioni": 4 icone in posizione fissa, grigie quando non attive
function SegnalazioniCell({ request }: { request: Request }) {
  const active: Record<string, boolean> = {
    is_urgent: !!request.is_urgent,
    is_blocked: !!request.is_blocked,
    has_timer_alert: !!request.has_timer_alert,
    no_civa: !!request.custom_fields?.no_civa,
  }
  return (
    <Box sx={{ display: 'inline-flex', gap: 0.75, alignItems: 'center' }}>
      {SEGNAL_META.map(({ key, label, Icon, color }) =>
        active[key] ? (
          <Tooltip key={key} title={label} arrow>
            <Icon sx={{ fontSize: 19, color }} />
          </Tooltip>
        ) : (
          <Icon key={key} sx={{ fontSize: 19, color: 'text.disabled', opacity: 0.25 }} />
        )
      )}
    </Box>
  )
}

// Validation function for stato_fattura
const validateStatoFattura = (
  value: StatoFattura,
  status: string
): { valid: boolean; error?: string } => {
  if (value === 'SI') {
    if (status !== '7-CHIUSA' && status !== 'ARCHIVIATA NON FINITA') {
      return {
        valid: false,
        error: 'Stato "Sì" impostabile solo su richieste CHIUSE o ARCHIVIATE NON FINITE',
      }
    }
  }
  return { valid: true }
}

// Estrae la ragione sociale del cliente (senza prefisso codice)
function clienteNome(req: Request): string {
  if (req.customer?.ragione_sociale) return req.customer.ragione_sociale
  const cliente = req.custom_fields?.cliente
  if (typeof cliente === 'string') return cliente
  if (cliente && typeof cliente === 'object' && 'ragione_sociale' in cliente) {
    return cliente.ragione_sociale
  }
  return ''
}

export const DM329TableView = ({
  requests,
  selectedRequests = new Set(),
  onSelectRequest,
  onSelectAll,
  selectionEnabled = false,
  showPrintButton = true,
  initialStatoFilter,
}: DM329TableViewProps) => {
  const navigate = useNavigate()
  const { user, isAdmin, isUserDM329 } = useAuth()
  const { mode } = useThemeMode()
  const queryClient = useQueryClient()

  // Chi può modificare lo stato direttamente dalla lista DM329
  const canEditStatus = isAdmin || isUserDM329

  // Stati persistiti nel sessionStorage
  const [orderBy, setOrderBy] = usePersistedState<OrderBy>('dm329Table_orderBy', 'updated_at')
  const [order, setOrder] = usePersistedState<OrderDirection>('dm329Table_order', 'desc')

  // Filtri per colonna (persistiti)
  const [clienteFilter, setClienteFilter] = usePersistedState<string[]>('dm329Table_clienteFilter', [])
  const [clienteSearchText, setClienteSearchText] = useState('')
  const [statoFilter, setStatoFilter] = usePersistedState<DM329Status[]>('dm329Table_statoFilter', [])
  const [noCivaFilter, setNoCivaFilter] = usePersistedState<TriState>('dm329Table_noCivaFilter', 'all')
  const [noteFilter, setNoteFilter] = usePersistedState<string>('dm329Table_noteFilter', '')
  const [urgentFilter, setUrgentFilter] = usePersistedState<TriState>('dm329Table_urgentFilter', 'all')
  const [blockedFilter, setBlockedFilter] = usePersistedState<TriState>('dm329Table_blockedFilter', 'all')
  const [timerAlertFilter, setTimerAlertFilter] = usePersistedState<TriState>('dm329Table_timerAlertFilter', 'all')
  const [statoFatturaFilter, setStatoFatturaFilter] = usePersistedState<StatoFattura[]>('dm329Table_statoFatturaFilter', [])
  const [tipoPraticaFilter, setTipoPraticaFilter] = usePersistedState<string>('dm329Table_tipoPraticaFilter', '')

  // Popover filtri: colonna attiva + elemento di ancoraggio
  const [filterCol, setFilterCol] = useState<FilterCol | null>(null)
  const [filterAnchor, setFilterAnchor] = useState<HTMLElement | null>(null)

  // State for export dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  // Applica il filtro stato in arrivo da deep-link (tile dashboard)
  useEffect(() => {
    if (initialStatoFilter === undefined) return
    setStatoFilter(initialStatoFilter ? [initialStatoFilter as DM329Status] : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStatoFilter])

  const openFilter = (col: FilterCol) => (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    setFilterAnchor(e.currentTarget)
    setFilterCol(col)
  }
  const closeFilter = () => {
    setFilterCol(null)
    setFilterAnchor(null)
  }

  const handleSort = (property: OrderBy) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const handleSaveStatoFattura = async (
    requestId: string,
    newValue: StatoFattura,
    requestStatus: string
  ) => {
    const validation = validateStatoFattura(newValue, requestStatus)
    if (!validation.valid) {
      throw new Error(validation.error)
    }
    await requestsApi.updateCustomField(requestId, 'stato_fattura', newValue)
    await queryClient.invalidateQueries({ queryKey: ['requests'] })
    toast.success('Stato fattura aggiornato')
  }

  // Handler per il cambio stato inline (validazione DB + storico via updateRequestStatus)
  const handleSaveStatus = async (requestId: string, newStatus: string) => {
    if (!user) throw new Error('Utente non autenticato')
    const result = await updateRequestStatus(requestId, newStatus, user.id, user.role)
    if (!result.success) {
      throw new Error(result.message)
    }
    await queryClient.invalidateQueries({ queryKey: ['requests'] })
    toast.success('Stato aggiornato')
  }

  // Clienti unici (per il filtro)
  const uniqueClients = useMemo(() => {
    const clients = requests.map(clienteNome).filter(Boolean)
    return Array.from(new Set(clients)).sort()
  }, [requests])

  const filteredUniqueClients = useMemo(() => {
    if (!clienteSearchText) return uniqueClients
    return uniqueClients.filter(c => c.toLowerCase().includes(clienteSearchText.toLowerCase()))
  }, [uniqueClients, clienteSearchText])

  // Conteggio sale per cliente (per omettere/mostrare la lettera nel codice pratica)
  const salaCounts = useMemo(() => computeClientSalaCounts(requests), [requests])

  const filteredAndSortedRequests = useMemo(() => {
    let filtered = [...requests]

    if (clienteFilter.length > 0) {
      filtered = filtered.filter(req => clienteFilter.includes(clienteNome(req)))
    }
    if (statoFilter.length > 0) {
      filtered = filtered.filter(req => statoFilter.includes(req.status as DM329Status))
    }
    if (noCivaFilter !== 'all') {
      filtered = filtered.filter(req => {
        const noCiva = req.custom_fields?.no_civa as boolean
        return noCivaFilter === 'true' ? noCiva === true : noCiva !== true
      })
    }
    if (noteFilter) {
      filtered = filtered.filter(req => {
        const note = req.custom_fields?.note as string
        return note?.toLowerCase().includes(noteFilter.toLowerCase())
      })
    }
    if (urgentFilter !== 'all') {
      filtered = filtered.filter(req => (urgentFilter === 'true' ? req.is_urgent === true : req.is_urgent !== true))
    }
    if (blockedFilter !== 'all') {
      filtered = filtered.filter(req => (blockedFilter === 'true' ? req.is_blocked === true : req.is_blocked !== true))
    }
    if (timerAlertFilter !== 'all') {
      filtered = filtered.filter(req => (timerAlertFilter === 'true' ? req.has_timer_alert === true : req.has_timer_alert !== true))
    }
    if (statoFatturaFilter.length > 0) {
      filtered = filtered.filter(req => {
        const statoFattura = (req.custom_fields?.stato_fattura as StatoFattura) || 'NO'
        return statoFatturaFilter.includes(statoFattura)
      })
    }
    if (tipoPraticaFilter) {
      filtered = filtered.filter(req => req.request_type?.name === tipoPraticaFilter)
    }

    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any
      switch (orderBy) {
        case 'is_urgent': aValue = a.is_urgent ? 1 : 0; bValue = b.is_urgent ? 1 : 0; break
        case 'is_blocked': aValue = a.is_blocked ? 1 : 0; bValue = b.is_blocked ? 1 : 0; break
        case 'has_timer_alert': aValue = a.has_timer_alert ? 1 : 0; bValue = b.has_timer_alert ? 1 : 0; break
        case 'no_civa': aValue = a.custom_fields?.no_civa ? 1 : 0; bValue = b.custom_fields?.no_civa ? 1 : 0; break
        case 'updated_at': aValue = new Date(a.updated_at).getTime(); bValue = new Date(b.updated_at).getTime(); break
        case 'codice':
          aValue = codiceForRequest(a, salaCounts.get(a.customer_id || '') || 0)
          bValue = codiceForRequest(b, salaCounts.get(b.customer_id || '') || 0)
          break
        case 'cliente': aValue = clienteNome(a); bValue = clienteNome(b); break
        case 'sala': aValue = a.denominazione_sala || ''; bValue = b.denominazione_sala || ''; break
        case 'status': aValue = getStatusLabel(a.status); bValue = getStatusLabel(b.status); break
        case 'note': aValue = (a.custom_fields?.note as string) || ''; bValue = (b.custom_fields?.note as string) || ''; break
        case 'stato_fattura': aValue = (a.custom_fields?.stato_fattura as string) || 'NO'; bValue = (b.custom_fields?.stato_fattura as string) || 'NO'; break
        default: return 0
      }
      if (typeof aValue === 'string') {
        return order === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }
      return order === 'asc' ? aValue - bValue : bValue - aValue
    })

    return filtered
  }, [requests, orderBy, order, clienteFilter, statoFilter, noCivaFilter, noteFilter, urgentFilter, blockedFilter, timerAlertFilter, statoFatturaFilter, tipoPraticaFilter, salaCounts])

  const clearFilters = () => {
    setClienteFilter([])
    setClienteSearchText('')
    setStatoFilter([])
    setNoCivaFilter('all')
    setNoteFilter('')
    setUrgentFilter('all')
    setBlockedFilter('all')
    setTimerAlertFilter('all')
    setStatoFatturaFilter([])
    setTipoPraticaFilter('')
  }

  const segnalFilterActive = urgentFilter !== 'all' || blockedFilter !== 'all' || timerAlertFilter !== 'all' || noCivaFilter !== 'all'
  const hasActiveFilters =
    clienteFilter.length > 0 ||
    statoFilter.length > 0 ||
    noteFilter ||
    segnalFilterActive ||
    statoFatturaFilter.length > 0 ||
    !!tipoPraticaFilter

  const allSelected = selectionEnabled && filteredAndSortedRequests.length > 0 && filteredAndSortedRequests.every(req => selectedRequests.has(req.id))
  const someSelected = selectionEnabled && selectedRequests.size > 0 && filteredAndSortedRequests.some(req => selectedRequests.has(req.id)) && !allSelected

  const handleSelectAll = () => {
    if (onSelectAll) onSelectAll(!allSelected)
  }

  const handleRowClick = (requestId: string, event: React.MouseEvent) => {
    if (selectionEnabled && (event.target as HTMLElement).closest('.MuiCheckbox-root')) {
      event.stopPropagation()
      if (onSelectRequest) onSelectRequest(requestId)
      return
    }
    if (!selectionEnabled || !(event.target as HTMLElement).closest('.MuiCheckbox-root')) {
      navigate(`/requests/${requestId}`)
    }
  }

  const handlePrint = () => {
    const filterDescriptions = createFilterDescription({ clienteFilter, statoFilter, noCivaFilter, noteFilter })
    const printColumns: any[] = [
      { header: 'Cliente', getValue: (req: Request) => formatClienteField(req) },
      { header: 'Stato', getValue: (req: Request) => getStatusLabel(req.status) },
      { header: 'Ultimo cambio', getValue: (req: Request) => formatDateField(req.updated_at) },
      { header: 'No CIVA', getValue: (req: Request) => formatBooleanField(req.custom_fields?.no_civa as boolean), align: 'center' as const },
      { header: 'Note', getValue: (req: Request) => (req.custom_fields?.note as string) || '-' },
    ]
    if (isAdmin || isUserDM329) {
      printColumns.push({
        header: 'Stato Fattura',
        getValue: (req: Request) => STATO_FATTURA_LABELS[(req.custom_fields?.stato_fattura as StatoFattura) || 'NO'],
      })
    }
    const html = generatePrintHTML({
      title: 'Richieste DM329',
      columns: printColumns,
      data: filteredAndSortedRequests,
      metadata: {
        totalRecords: requests.length,
        filteredRecords: filteredAndSortedRequests.length,
        filters: filterDescriptions,
      },
    })
    printHTML(html)
  }

  // Intestazione ordinabile riutilizzabile
  const sortLabel = (property: OrderBy, label: string) => (
    <TableSortLabel
      active={orderBy === property}
      direction={orderBy === property ? order : 'asc'}
      onClick={() => handleSort(property)}
    >
      {label}
    </TableSortLabel>
  )
  const funnel = (col: FilterCol, active: boolean) => (
    <IconButton size="small" onClick={openFilter(col)} sx={{ ml: 0.25, color: active ? 'primary.main' : 'action.active' }}>
      <FilterListIcon sx={{ fontSize: 16 }} />
    </IconButton>
  )
  const ellipsisSx = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } as const

  const colSpan = (selectionEnabled ? 1 : 0) + (isAdmin || isUserDM329 ? 9 : 8)
  const isFlagSort = ['is_urgent', 'is_blocked', 'has_timer_alert', 'no_civa'].includes(orderBy)
  const activeSegnal = SEGNAL_META.find(s => s.key === orderBy)

  // Contenuto del popover filtri
  const boolFilterRow = (label: string, value: TriState, setter: (v: TriState) => void, Icon?: typeof PriorityHighIcon) => (
    <Box sx={{ mb: 0.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {Icon && <Icon sx={{ fontSize: 16, color: 'text.secondary' }} />}
        <Typography variant="caption" sx={{ fontWeight: 600 }}>{label}</Typography>
      </Box>
      <RadioGroup row value={value} onChange={e => setter(e.target.value as TriState)} sx={{ ml: 0.5 }}>
        <FormControlLabel value="all" control={<Radio size="small" />} label="Tutti" />
        <FormControlLabel value="true" control={<Radio size="small" />} label="Sì" />
        <FormControlLabel value="false" control={<Radio size="small" />} label="No" />
      </RadioGroup>
    </Box>
  )

  const renderFilterContent = () => {
    switch (filterCol) {
      case 'cliente':
        return (
          <Box sx={{ p: 1, width: 280 }}>
            <TextField
              size="small"
              placeholder="Cerca cliente…"
              value={clienteSearchText}
              onChange={e => setClienteSearchText(e.target.value)}
              fullWidth
              autoFocus
              sx={{ mb: 1 }}
            />
            <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
              {filteredUniqueClients.length > 0 ? (
                filteredUniqueClients.map(cliente => (
                  <MenuItem
                    key={cliente}
                    dense
                    onClick={() =>
                      setClienteFilter(prev =>
                        prev.includes(cliente) ? prev.filter(c => c !== cliente) : [...prev, cliente]
                      )
                    }
                  >
                    <Checkbox size="small" checked={clienteFilter.includes(cliente)} />
                    <ListItemText primary={cliente} />
                  </MenuItem>
                ))
              ) : (
                <MenuItem disabled><em>Nessun cliente trovato</em></MenuItem>
              )}
            </Box>
          </Box>
        )
      case 'tipo':
        return (
          <Box sx={{ p: 1, minWidth: 180 }}>
            <RadioGroup value={tipoPraticaFilter} onChange={e => setTipoPraticaFilter(e.target.value)}>
              <FormControlLabel value="" control={<Radio size="small" />} label="Tutti" />
              <FormControlLabel value="DM329" control={<Radio size="small" />} label="DM329" />
              <FormControlLabel value="DM329-Integrazioni" control={<Radio size="small" />} label="Integrazioni" />
            </RadioGroup>
          </Box>
        )
      case 'stato':
        return (
          <Box sx={{ p: 1, minWidth: 220, maxHeight: 340, overflow: 'auto' }}>
            {DM329_STATUSES.map(status => (
              <MenuItem
                key={status}
                dense
                onClick={() =>
                  setStatoFilter(prev =>
                    prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
                  )
                }
              >
                <Checkbox size="small" checked={statoFilter.includes(status)} />
                <ListItemText primary={getStatusLabel(status)} />
              </MenuItem>
            ))}
          </Box>
        )
      case 'segnal':
        return (
          <Box sx={{ p: 1.5, minWidth: 230 }}>
            <Typography variant="overline" color="text.secondary">Ordina per</Typography>
            {SEGNAL_META.map(({ key, label, Icon }) => (
              <MenuItem key={key} dense selected={orderBy === key} onClick={() => handleSort(key)}>
                <Icon sx={{ fontSize: 18, mr: 1, color: 'text.secondary' }} />
                <ListItemText primary={label} />
                {orderBy === key && (
                  <Typography variant="caption" color="primary">{order === 'asc' ? '▲' : '▼'}</Typography>
                )}
              </MenuItem>
            ))}
            <Divider sx={{ my: 1 }} />
            <Typography variant="overline" color="text.secondary">Filtra per</Typography>
            {boolFilterRow('Urgente', urgentFilter, setUrgentFilter, PriorityHighIcon)}
            {boolFilterRow('Bloccata', blockedFilter, setBlockedFilter, WarningIcon)}
            {boolFilterRow('Scaduta', timerAlertFilter, setTimerAlertFilter, AccessTimeIcon)}
            {boolFilterRow('No CIVA', noCivaFilter, setNoCivaFilter, BlockIcon)}
          </Box>
        )
      case 'note':
        return (
          <Box sx={{ p: 1, width: 260 }}>
            <TextField
              size="small"
              placeholder="Cerca nelle note…"
              value={noteFilter}
              onChange={e => setNoteFilter(e.target.value)}
              fullWidth
              autoFocus
            />
          </Box>
        )
      case 'fattura':
        return (
          <Box sx={{ p: 1, minWidth: 200 }}>
            {STATO_FATTURA_OPTIONS.map(option => (
              <MenuItem
                key={option}
                dense
                onClick={() =>
                  setStatoFatturaFilter(prev =>
                    prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
                  )
                }
              >
                <Checkbox size="small" checked={statoFatturaFilter.includes(option)} />
                <ListItemText primary={STATO_FATTURA_LABELS[option]} />
              </MenuItem>
            ))}
          </Box>
        )
      default:
        return null
    }
  }

  return (
    <Box>
      {/* Print and Export buttons */}
      {showPrintButton && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={() => setExportDialogOpen(true)} size="small">
            Esporta
          </Button>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint} size="small">
            Stampa
          </Button>
        </Box>
      )}

      <ExportRequestsDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        requestType="DM329"
        requestTypeId={requests[0]?.request_type_id}
      />

      {hasActiveFilters && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {clienteFilter.length > 0 && <Chip label={`Clienti: ${clienteFilter.length}`} size="small" onDelete={() => setClienteFilter([])} />}
            {statoFilter.length > 0 && <Chip label={`Stati: ${statoFilter.length}`} size="small" onDelete={() => setStatoFilter([])} />}
            {tipoPraticaFilter && <Chip label={`Tipo: ${tipoPraticaFilter === 'DM329-Integrazioni' ? 'Integrazioni' : tipoPraticaFilter}`} size="small" onDelete={() => setTipoPraticaFilter('')} />}
            {urgentFilter !== 'all' && <Chip label={`Urgenti: ${urgentFilter === 'true' ? 'Sì' : 'No'}`} size="small" onDelete={() => setUrgentFilter('all')} />}
            {blockedFilter !== 'all' && <Chip label={`Bloccate: ${blockedFilter === 'true' ? 'Sì' : 'No'}`} size="small" onDelete={() => setBlockedFilter('all')} />}
            {timerAlertFilter !== 'all' && <Chip label={`Scadute: ${timerAlertFilter === 'true' ? 'Sì' : 'No'}`} size="small" onDelete={() => setTimerAlertFilter('all')} />}
            {noCivaFilter !== 'all' && <Chip label={`No CIVA: ${noCivaFilter === 'true' ? 'Sì' : 'No'}`} size="small" onDelete={() => setNoCivaFilter('all')} />}
            {noteFilter && <Chip label={`Note: "${noteFilter}"`} size="small" onDelete={() => setNoteFilter('')} />}
            {statoFatturaFilter.length > 0 && <Chip label={`Stato Fattura: ${statoFatturaFilter.length}`} size="small" onDelete={() => setStatoFatturaFilter([])} />}
          </Box>
          <IconButton size="small" onClick={clearFilters} color="primary" title="Cancella tutti i filtri">
            <ClearIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table size="small" sx={{ tableLayout: 'fixed', minWidth: 1160 }}>
          <TableHead>
            <TableRow>
              {selectionEnabled && (
                <TableCell sx={{ width: W.select, p: 1 }}>
                  <Checkbox indeterminate={someSelected} checked={allSelected} onChange={handleSelectAll} />
                </TableCell>
              )}
              <TableCell sx={{ width: W.codice }}>{sortLabel('codice', 'Codice')}</TableCell>
              <TableCell>
                {sortLabel('cliente', 'Cliente')}
                {funnel('cliente', clienteFilter.length > 0)}
              </TableCell>
              <TableCell sx={{ width: W.sala }}>{sortLabel('sala', 'Sala')}</TableCell>
              <TableCell sx={{ width: W.tipo }}>
                Tipo{funnel('tipo', !!tipoPraticaFilter)}
              </TableCell>
              <TableCell sx={{ width: W.stato }}>
                {sortLabel('status', 'Stato')}
                {funnel('stato', statoFilter.length > 0)}
              </TableCell>
              <TableCell sx={{ width: W.data }}>{sortLabel('updated_at', 'Ult. cambio')}</TableCell>
              <TableCell sx={{ width: W.segnal, textAlign: 'center' }}>
                <Box
                  onClick={openFilter('segnal')}
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', color: isFlagSort ? 'primary.main' : 'inherit' }}
                >
                  <span>Segnal.</span>
                  {activeSegnal && <activeSegnal.Icon sx={{ fontSize: 15 }} />}
                  {isFlagSort && <Typography variant="caption">{order === 'asc' ? '▲' : '▼'}</Typography>}
                  <FilterListIcon sx={{ fontSize: 15, color: segnalFilterActive ? 'primary.main' : 'action.active' }} />
                </Box>
              </TableCell>
              <TableCell sx={{ width: W.note }}>
                {sortLabel('note', 'Note')}
                {funnel('note', !!noteFilter)}
              </TableCell>
              {(isAdmin || isUserDM329) && (
                <TableCell sx={{ width: W.fattura }}>
                  {sortLabel('stato_fattura', 'Fatt.')}
                  {funnel('fattura', statoFatturaFilter.length > 0)}
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSortedRequests.map(request => {
              const codice = codiceForRequest(request, salaCounts.get(request.customer_id || '') || 0)
              const nome = clienteNome(request) || '-'
              const sala = request.denominazione_sala || (request.sala_lettera ? `Sala ${request.sala_lettera}` : '—')
              const note = (request.custom_fields?.note as string) || '-'
              return (
                <TableRow
                  key={request.id}
                  hover
                  onClick={e => handleRowClick(request.id, e)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'action.hover' },
                    ...(request.is_blocked && {
                      backgroundColor: 'warning.lighter',
                      '&:hover': { backgroundColor: 'warning.light' },
                    }),
                    ...(selectionEnabled && selectedRequests.has(request.id) && {
                      backgroundColor: 'action.selected',
                    }),
                  }}
                >
                  {selectionEnabled && (
                    <TableCell sx={{ p: 1 }} onClick={e => e.stopPropagation()}>
                      <Checkbox checked={selectedRequests.has(request.id)} onChange={() => onSelectRequest && onSelectRequest(request.id)} />
                    </TableCell>
                  )}
                  <TableCell sx={ellipsisSx}>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace', ...ellipsisSx }} title={codice || undefined}>
                      {codice || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ ...ellipsisSx, fontWeight: 600 }} title={nome}>{nome}</TableCell>
                  <TableCell sx={{ ...ellipsisSx, color: 'text.secondary' }} title={sala}>{sala}</TableCell>
                  <TableCell sx={{ ...ellipsisSx, fontSize: '0.8rem', color: 'text.secondary' }}>
                    {request.request_type?.name === 'DM329-Integrazioni' ? 'Integrazioni' : 'DM329'}
                  </TableCell>
                  <TableCell onClick={canEditStatus ? e => e.stopPropagation() : undefined}>
                    {canEditStatus ? (
                      <EditableSelectCell
                        value={request.status}
                        options={ALL_DM329_STATUSES}
                        optionLabels={DM329_STATUS_LABELS}
                        getColor={getStatusColor}
                        getChipColors={(v) => {
                          const c = getStatusChipColors(v, mode)
                          return { color: c.main, bgcolor: c.bg }
                        }}
                        onSave={newValue => handleSaveStatus(request.id, newValue)}
                      />
                    ) : (
                      <StatusChip status={request.status} />
                    )}
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                    {format(new Date(request.updated_at), 'dd/MM/yyyy', { locale: it })}
                  </TableCell>
                  <TableCell sx={{ textAlign: 'center' }}>
                    <SegnalazioniCell request={request} />
                  </TableCell>
                  <TableCell sx={ellipsisSx} title={note}>{note}</TableCell>
                  {(isAdmin || isUserDM329) && (
                    <TableCell onClick={e => e.stopPropagation()}>
                      <EditableSelectCell
                        value={(request.custom_fields?.stato_fattura as StatoFattura) || 'NO'}
                        options={STATO_FATTURA_OPTIONS}
                        optionLabels={STATO_FATTURA_LABELS}
                        onSave={newValue => handleSaveStatoFattura(request.id, newValue as StatoFattura, request.status)}
                        validate={value => validateStatoFattura(value as StatoFattura, request.status)}
                      />
                    </TableCell>
                  )}
                </TableRow>
              )
            })}

            {filteredAndSortedRequests.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} align="center" sx={{ py: 3 }}>
                  Nessuna richiesta DM329 trovata
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Popover filtri colonna */}
      <Popover
        open={Boolean(filterCol && filterAnchor)}
        anchorEl={filterAnchor}
        onClose={closeFilter}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {renderFilterContent()}
      </Popover>
    </Box>
  )
}
