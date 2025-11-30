import { useState, useMemo } from 'react'
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
  Select,
  MenuItem,
  Checkbox,
  FormControl,
  ListItemText,
  OutlinedInput,
  Button,
} from '@mui/material'
import {
  Clear as ClearIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Print as PrintIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material'
import { Request, DM329Status, StatoFattura, STATO_FATTURA_OPTIONS, STATO_FATTURA_LABELS } from '@/types'
import { getStatusColor, getStatusLabel } from '@/utils/workflow'
import { usePersistedState } from '@/hooks/usePersistedState'
import { useAuth } from '@/hooks/useAuth'
import { BlockIndicator } from './BlockIndicator'
import { UrgentIndicator } from './UrgentIndicator'
import { TimerAlertIndicator } from './TimerAlertIndicator'
import { EditableSelectCell } from './EditableSelectCell'
import { requestsApi } from '@/services/api/requests'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
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
}

type OrderDirection = 'asc' | 'desc'
type OrderBy = 'updated_at' | 'cliente' | 'status' | 'no_civa' | 'note' | 'is_urgent' | 'is_blocked' | 'has_timer_alert' | 'stato_fattura'

const DM329_STATUSES: DM329Status[] = [
  '1-INCARICO_RICEVUTO',
  '2-SCHEDA_DATI_PRONTA',
  '3-MAIL_CLIENTE_INVIATA',
  '4-DOCUMENTI_PRONTI',
  '5-ATTESA_FIRMA',
  '6-PRONTA_PER_CIVA',
  '7-CHIUSA',
]

// Validation function for stato_fattura
const validateStatoFattura = (
  value: StatoFattura,
  status: string
): { valid: boolean; error?: string } => {
  if (value === 'SI') {
    if (status !== '7-CHIUSA' && status !== 'ARCHIVIATA NON FINITA') {
      return {
        valid: false,
        error: 'Stato "Sì" impostabile solo su richieste CHIUSE o ARCHIVIATE NON FINITE'
      }
    }
  }
  return { valid: true }
}

export const DM329TableView = ({
  requests,
  selectedRequests = new Set(),
  onSelectRequest,
  onSelectAll,
  selectionEnabled = false,
  showPrintButton = true,
}: DM329TableViewProps) => {
  const navigate = useNavigate()
  const { isAdmin, isUserDM329 } = useAuth()
  const queryClient = useQueryClient()

  // Stati persistiti nel sessionStorage
  const [orderBy, setOrderBy] = usePersistedState<OrderBy>('dm329Table_orderBy', 'updated_at')
  const [order, setOrder] = usePersistedState<OrderDirection>('dm329Table_order', 'desc')

  // Filtri per colonna (persistiti)
  const [clienteFilter, setClienteFilter] = usePersistedState<string[]>('dm329Table_clienteFilter', [])
  const [clienteSearchText, setClienteSearchText] = useState('')
  const [statoFilter, setStatoFilter] = usePersistedState<DM329Status[]>('dm329Table_statoFilter', [])
  const [noCivaFilter, setNoCivaFilter] = usePersistedState<'all' | 'true' | 'false'>('dm329Table_noCivaFilter', 'all')
  const [noteFilter, setNoteFilter] = usePersistedState<string>('dm329Table_noteFilter', '')
  const [urgentFilter, setUrgentFilter] = usePersistedState<'all' | 'true' | 'false'>('dm329Table_urgentFilter', 'all')
  const [blockedFilter, setBlockedFilter] = usePersistedState<'all' | 'true' | 'false'>('dm329Table_blockedFilter', 'all')
  const [timerAlertFilter, setTimerAlertFilter] = usePersistedState<'all' | 'true' | 'false'>('dm329Table_timerAlertFilter', 'all')
  const [statoFatturaFilter, setStatoFatturaFilter] = usePersistedState<StatoFattura[]>('dm329Table_statoFatturaFilter', [])

  // State for export dialog
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

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

  // Estrai valori unici per i filtri
  const uniqueClients = useMemo(() => {
    const clients = requests
      .map(r => {
        const cliente = r.custom_fields?.cliente
        if (typeof cliente === 'string') return cliente
        if (cliente && typeof cliente === 'object' && 'ragione_sociale' in cliente) {
          return cliente.ragione_sociale
        }
        return null
      })
      .filter(Boolean) as string[]
    return Array.from(new Set(clients)).sort()
  }, [requests])

  // Filtra i clienti in base al testo di ricerca
  const filteredUniqueClients = useMemo(() => {
    if (!clienteSearchText) return uniqueClients
    return uniqueClients.filter(c =>
      c.toLowerCase().includes(clienteSearchText.toLowerCase())
    )
  }, [uniqueClients, clienteSearchText])

  // Filtraggio e ordinamento
  const filteredAndSortedRequests = useMemo(() => {
    let filtered = [...requests]

    // Applica filtri
    if (clienteFilter.length > 0) {
      filtered = filtered.filter(req => {
        const cliente = req.custom_fields?.cliente
        const clienteStr = typeof cliente === 'string'
          ? cliente
          : (cliente && typeof cliente === 'object' && 'ragione_sociale' in cliente)
            ? cliente.ragione_sociale
            : ''
        return clienteFilter.includes(clienteStr)
      })
    }
    if (statoFilter.length > 0) {
      filtered = filtered.filter(req =>
        statoFilter.includes(req.status as DM329Status)
      )
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
      filtered = filtered.filter(req => {
        const isUrgent = req.is_urgent === true
        return urgentFilter === 'true' ? isUrgent : !isUrgent
      })
    }
    if (blockedFilter !== 'all') {
      filtered = filtered.filter(req => {
        const isBlocked = req.is_blocked === true
        return blockedFilter === 'true' ? isBlocked : !isBlocked
      })
    }
    if (timerAlertFilter !== 'all') {
      filtered = filtered.filter(req => {
        const hasTimerAlert = req.has_timer_alert === true
        return timerAlertFilter === 'true' ? hasTimerAlert : !hasTimerAlert
      })
    }
    if (statoFatturaFilter.length > 0) {
      filtered = filtered.filter(req => {
        const statoFattura = (req.custom_fields?.stato_fattura as StatoFattura) || 'NO'
        return statoFatturaFilter.includes(statoFattura)
      })
    }

    // Applica ordinamento
    filtered.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (orderBy) {
        case 'is_urgent':
          aValue = a.is_urgent ? 1 : 0
          bValue = b.is_urgent ? 1 : 0
          break
        case 'is_blocked':
          aValue = a.is_blocked ? 1 : 0
          bValue = b.is_blocked ? 1 : 0
          break
        case 'has_timer_alert':
          aValue = a.has_timer_alert ? 1 : 0
          bValue = b.has_timer_alert ? 1 : 0
          break
        case 'updated_at':
          aValue = new Date(a.updated_at).getTime()
          bValue = new Date(b.updated_at).getTime()
          break
        case 'cliente':
          const aCliente = a.custom_fields?.cliente
          const bCliente = b.custom_fields?.cliente
          aValue = typeof aCliente === 'string'
            ? aCliente
            : (aCliente && typeof aCliente === 'object' && 'ragione_sociale' in aCliente)
              ? aCliente.ragione_sociale
              : ''
          bValue = typeof bCliente === 'string'
            ? bCliente
            : (bCliente && typeof bCliente === 'object' && 'ragione_sociale' in bCliente)
              ? bCliente.ragione_sociale
              : ''
          break
        case 'status':
          aValue = getStatusLabel(a.status)
          bValue = getStatusLabel(b.status)
          break
        case 'no_civa':
          aValue = a.custom_fields?.no_civa ? 1 : 0
          bValue = b.custom_fields?.no_civa ? 1 : 0
          break
        case 'note':
          aValue = (a.custom_fields?.note as string) || ''
          bValue = (b.custom_fields?.note as string) || ''
          break
        case 'stato_fattura':
          aValue = (a.custom_fields?.stato_fattura as string) || 'NO'
          bValue = (b.custom_fields?.stato_fattura as string) || 'NO'
          break
        default:
          return 0
      }

      if (typeof aValue === 'string') {
        return order === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return order === 'asc' ? aValue - bValue : bValue - aValue
    })

    return filtered
  }, [requests, orderBy, order, clienteFilter, statoFilter, noCivaFilter, noteFilter, urgentFilter, blockedFilter, timerAlertFilter, statoFatturaFilter])

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
  }

  const hasActiveFilters = clienteFilter.length > 0 || statoFilter.length > 0 || noCivaFilter !== 'all' || noteFilter || urgentFilter !== 'all' || blockedFilter !== 'all' || timerAlertFilter !== 'all' || statoFatturaFilter.length > 0

  // Check if all filteredAndSortedRequests are selected
  const allSelected = selectionEnabled &&
    filteredAndSortedRequests.length > 0 &&
    filteredAndSortedRequests.every(req => selectedRequests.has(req.id))

  const someSelected = selectionEnabled &&
    selectedRequests.size > 0 &&
    filteredAndSortedRequests.some(req => selectedRequests.has(req.id)) &&
    !allSelected

  const handleSelectAll = () => {
    if (onSelectAll) {
      onSelectAll(!allSelected)
    }
  }

  const handleRowClick = (requestId: string, event: React.MouseEvent) => {
    // If selection is enabled and clicking on checkbox column, don't navigate
    if (selectionEnabled && (event.target as HTMLElement).closest('.MuiCheckbox-root')) {
      event.stopPropagation()
      if (onSelectRequest) {
        onSelectRequest(requestId)
      }
      return
    }

    // Otherwise navigate to request detail
    if (!selectionEnabled || !(event.target as HTMLElement).closest('.MuiCheckbox-root')) {
      navigate(`/requests/${requestId}`)
    }
  }

  const handlePrint = () => {
    const filterDescriptions = createFilterDescription({
      clienteFilter,
      statoFilter,
      noCivaFilter,
      noteFilter,
    })

    const printColumns = [
      {
        header: 'Data Ultimo Cambio',
        getValue: (req) => formatDateField(req.updated_at),
      },
      {
        header: 'Cliente',
        getValue: (req) => formatClienteField(req),
      },
      {
        header: 'Stato',
        getValue: (req) => getStatusLabel(req.status),
      },
      {
        header: 'No CIVA',
        getValue: (req) => formatBooleanField(req.custom_fields?.no_civa as boolean),
        align: 'center' as const,
      },
      {
        header: 'Note',
        getValue: (req) => (req.custom_fields?.note as string) || '-',
      },
    ]

    // Add stato_fattura column only for admin/userdm329
    if (isAdmin || isUserDM329) {
      printColumns.push({
        header: 'Stato Fattura',
        getValue: (req) =>
          STATO_FATTURA_LABELS[(req.custom_fields?.stato_fattura as StatoFattura) || 'NO'],
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

  return (
    <Box>
      {/* Print and Export buttons */}
      {showPrintButton && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={() => setExportDialogOpen(true)}
            size="small"
          >
            Esporta
          </Button>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            size="small"
          >
            Stampa
          </Button>
        </Box>
      )}

      {/* Export Dialog */}
      <ExportRequestsDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        requestType="DM329"
        requestTypeId={requests[0]?.request_type_id}
      />

      {hasActiveFilters && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {clienteFilter.length > 0 && (
              <Chip label={`Clienti: ${clienteFilter.length}`} size="small" onDelete={() => setClienteFilter([])} />
            )}
            {statoFilter.length > 0 && (
              <Chip label={`Stati: ${statoFilter.length}`} size="small" onDelete={() => setStatoFilter([])} />
            )}
            {noCivaFilter !== 'all' && (
              <Chip label={`No CIVA: ${noCivaFilter === 'true' ? 'Sì' : 'No'}`} size="small" onDelete={() => setNoCivaFilter('all')} />
            )}
            {noteFilter && (
              <Chip label={`Note: "${noteFilter}"`} size="small" onDelete={() => setNoteFilter('')} />
            )}
            {urgentFilter !== 'all' && (
              <Chip label={`Urgenti: ${urgentFilter === 'true' ? 'Sì' : 'No'}`} size="small" onDelete={() => setUrgentFilter('all')} />
            )}
            {blockedFilter !== 'all' && (
              <Chip label={`Bloccate: ${blockedFilter === 'true' ? 'Sì' : 'No'}`} size="small" onDelete={() => setBlockedFilter('all')} />
            )}
            {timerAlertFilter !== 'all' && (
              <Chip label={`Timer scaduto: ${timerAlertFilter === 'true' ? 'Sì' : 'No'}`} size="small" onDelete={() => setTimerAlertFilter('all')} />
            )}
            {statoFatturaFilter.length > 0 && (
              <Chip label={`Stato Fattura: ${statoFatturaFilter.length}`} size="small" onDelete={() => setStatoFatturaFilter([])} />
            )}
          </Box>
          <IconButton size="small" onClick={clearFilters} color="primary" title="Cancella tutti i filtri">
            <ClearIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {/* Selection checkbox column */}
              {selectionEnabled && (
                <TableCell sx={{ width: 50, padding: 1 }}>
                  <Checkbox
                    indeterminate={someSelected}
                    checked={allSelected}
                    onChange={handleSelectAll}
                  />
                </TableCell>
              )}

              {/* Urgent indicator column */}
              <TableCell sx={{ width: 70, padding: 0.5 }}>
                <TableSortLabel
                  active={orderBy === 'is_urgent'}
                  direction={orderBy === 'is_urgent' ? order : 'asc'}
                  onClick={() => handleSort('is_urgent')}
                  sx={{ fontSize: '0.8rem' }}
                >
                  Urg.
                </TableSortLabel>
                <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                  <Select
                    value={urgentFilter}
                    onChange={(e) => setUrgentFilter(e.target.value as 'all' | 'true' | 'false')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    <MenuItem value="all">Tutti</MenuItem>
                    <MenuItem value="true">Sì</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
              </TableCell>

              {/* Blocked indicator column */}
              <TableCell sx={{ width: 70, padding: 0.5 }}>
                <TableSortLabel
                  active={orderBy === 'is_blocked'}
                  direction={orderBy === 'is_blocked' ? order : 'asc'}
                  onClick={() => handleSort('is_blocked')}
                  sx={{ fontSize: '0.8rem' }}
                >
                  Blocc.
                </TableSortLabel>
                <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                  <Select
                    value={blockedFilter}
                    onChange={(e) => setBlockedFilter(e.target.value as 'all' | 'true' | 'false')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    <MenuItem value="all">Tutti</MenuItem>
                    <MenuItem value="true">Sì</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
              </TableCell>

              {/* Timer alert indicator column */}
              <TableCell sx={{ width: 70, padding: 0.5 }}>
                <TableSortLabel
                  active={orderBy === 'has_timer_alert'}
                  direction={orderBy === 'has_timer_alert' ? order : 'asc'}
                  onClick={() => handleSort('has_timer_alert')}
                  sx={{ fontSize: '0.8rem' }}
                >
                  Scad.
                </TableSortLabel>
                <FormControl size="small" fullWidth sx={{ mt: 0.5 }}>
                  <Select
                    value={timerAlertFilter}
                    onChange={(e) => setTimerAlertFilter(e.target.value as 'all' | 'true' | 'false')}
                    sx={{ fontSize: '0.75rem' }}
                  >
                    <MenuItem value="all">Tutti</MenuItem>
                    <MenuItem value="true">Sì</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
              </TableCell>

              {/* Data ultimo cambio stato */}
              <TableCell sx={{ width: 130 }}>
                <TableSortLabel
                  active={orderBy === 'updated_at'}
                  direction={orderBy === 'updated_at' ? order : 'asc'}
                  onClick={() => handleSort('updated_at')}
                  sx={{ fontSize: '0.8rem' }}
                >
                  Ult. Cambio
                </TableSortLabel>
              </TableCell>

              {/* Cliente */}
              <TableCell sx={{ minWidth: 150 }}>
                <TableSortLabel
                  active={orderBy === 'cliente'}
                  direction={orderBy === 'cliente' ? order : 'asc'}
                  onClick={() => handleSort('cliente')}
                >
                  Cliente
                </TableSortLabel>
                <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                  <Select
                    multiple
                    displayEmpty
                    value={clienteFilter}
                    onChange={(e) => setClienteFilter(e.target.value as string[])}
                    input={<OutlinedInput />}
                    renderValue={(selected) => {
                      if (selected.length === 0) {
                        return <em>Filtra clienti...</em>
                      }
                      return `${selected.length} selezionati`
                    }}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 400,
                        },
                      },
                      autoFocus: false,
                    }}
                  >
                    <Box sx={{ px: 2, py: 1, position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1 }}>
                      <TextField
                        size="small"
                        placeholder="Cerca cliente..."
                        value={clienteSearchText}
                        onChange={(e) => setClienteSearchText(e.target.value)}
                        fullWidth
                        autoFocus
                        onKeyDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Box>
                    {filteredUniqueClients.length > 0 ? (
                      filteredUniqueClients.map((cliente) => (
                        <MenuItem key={cliente} value={cliente}>
                          <Checkbox checked={clienteFilter.indexOf(cliente) > -1} />
                          <ListItemText primary={cliente} />
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem disabled>
                        <em>Nessun cliente trovato</em>
                      </MenuItem>
                    )}
                  </Select>
                </FormControl>
              </TableCell>

              {/* Stato */}
              <TableCell sx={{ minWidth: 160 }}>
                <TableSortLabel
                  active={orderBy === 'status'}
                  direction={orderBy === 'status' ? order : 'asc'}
                  onClick={() => handleSort('status')}
                  sx={{ fontSize: '0.8rem' }}
                >
                  Stato
                </TableSortLabel>
                <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                  <Select
                    multiple
                    displayEmpty
                    value={statoFilter}
                    onChange={(e) => setStatoFilter(e.target.value as DM329Status[])}
                    input={<OutlinedInput />}
                    renderValue={(selected) => {
                      if (selected.length === 0) {
                        return <em>Tutti</em>
                      }
                      return `${selected.length} selezionati`
                    }}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 300,
                        },
                      },
                    }}
                  >
                    {DM329_STATUSES.map((status) => (
                      <MenuItem key={status} value={status}>
                        <Checkbox checked={statoFilter.indexOf(status) > -1} />
                        <ListItemText primary={getStatusLabel(status)} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </TableCell>

              {/* No CIVA */}
              <TableCell sx={{ width: 90, textAlign: 'center' }}>
                <TableSortLabel
                  active={orderBy === 'no_civa'}
                  direction={orderBy === 'no_civa' ? order : 'asc'}
                  onClick={() => handleSort('no_civa')}
                  sx={{ fontSize: '0.8rem' }}
                >
                  No CIVA
                </TableSortLabel>
                <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                  <Select
                    value={noCivaFilter}
                    onChange={(e) => setNoCivaFilter(e.target.value as 'all' | 'true' | 'false')}
                  >
                    <MenuItem value="all">Tutti</MenuItem>
                    <MenuItem value="true">Sì</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </Select>
                </FormControl>
              </TableCell>

              {/* Note */}
              <TableCell sx={{ minWidth: 200 }}>
                <TableSortLabel
                  active={orderBy === 'note'}
                  direction={orderBy === 'note' ? order : 'asc'}
                  onClick={() => handleSort('note')}
                  sx={{ fontSize: '0.8rem' }}
                >
                  Note
                </TableSortLabel>
                <TextField
                  size="small"
                  placeholder="Cerca nelle note..."
                  value={noteFilter}
                  onChange={(e) => setNoteFilter(e.target.value)}
                  fullWidth
                  sx={{ mt: 1 }}
                />
              </TableCell>

              {/* Stato Fattura - Solo per admin e userdm329 */}
              {(isAdmin || isUserDM329) && (
                <TableCell sx={{ minWidth: 140 }}>
                  <TableSortLabel
                    active={orderBy === 'stato_fattura'}
                    direction={orderBy === 'stato_fattura' ? order : 'asc'}
                    onClick={() => handleSort('stato_fattura')}
                    sx={{ fontSize: '0.8rem' }}
                  >
                    Stato Fattura
                  </TableSortLabel>
                  <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                    <Select
                      multiple
                      displayEmpty
                      value={statoFatturaFilter}
                      onChange={(e) => setStatoFatturaFilter(e.target.value as StatoFattura[])}
                      input={<OutlinedInput />}
                      renderValue={(selected) =>
                        selected.length === 0 ? <em>Tutti</em> : `${selected.length} selezionati`
                      }
                      MenuProps={{
                        PaperProps: {
                          style: {
                            maxHeight: 300,
                          },
                        },
                      }}
                    >
                      {STATO_FATTURA_OPTIONS.map((option) => (
                        <MenuItem key={option} value={option}>
                          <Checkbox checked={statoFatturaFilter.includes(option)} />
                          <ListItemText primary={STATO_FATTURA_LABELS[option]} />
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSortedRequests.map((request) => (
              <TableRow
                key={request.id}
                hover
                onClick={(e) => handleRowClick(request.id, e)}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: 'action.hover' },
                  // Highlight selected requests
                  ...(selectionEnabled && selectedRequests.has(request.id) && {
                    backgroundColor: 'primary.light',
                    '&:hover': { backgroundColor: 'primary.main' },
                  }),
                }}
              >
                {/* Selection checkbox */}
                {selectionEnabled && (
                  <TableCell sx={{ padding: 1 }} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedRequests.has(request.id)}
                      onChange={() => onSelectRequest && onSelectRequest(request.id)}
                    />
                  </TableCell>
                )}

                {/* Urgent indicator */}
                <TableCell sx={{ padding: 1, textAlign: 'center' }}>
                  {request.is_urgent && <UrgentIndicator isUrgent={true} />}
                </TableCell>

                {/* Blocked indicator */}
                <TableCell sx={{ padding: 1, textAlign: 'center' }}>
                  {request.is_blocked && <BlockIndicator isBlocked={true} />}
                </TableCell>

                {/* Timer alert indicator */}
                <TableCell sx={{ padding: 1, textAlign: 'center' }}>
                  {request.has_timer_alert && <TimerAlertIndicator hasAlert={true} />}
                </TableCell>
                <TableCell>
                  {format(new Date(request.updated_at), 'dd/MM/yyyy HH:mm', { locale: it })}
                </TableCell>
                <TableCell>
                  {(() => {
                    const cliente = request.custom_fields?.cliente
                    if (typeof cliente === 'string') return cliente
                    if (cliente && typeof cliente === 'object' && 'ragione_sociale' in cliente) {
                      return cliente.ragione_sociale
                    }
                    return '-'
                  })()}
                </TableCell>
                <TableCell>
                  <Chip
                    label={getStatusLabel(request.status)}
                    color={getStatusColor(request.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell sx={{ textAlign: 'center' }}>
                  {request.custom_fields?.no_civa ? (
                    <CheckBoxIcon color="primary" />
                  ) : (
                    <CheckBoxOutlineBlankIcon color="disabled" />
                  )}
                </TableCell>
                <TableCell>
                  <Box
                    sx={{
                      maxWidth: 200,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {(request.custom_fields?.note as string) || '-'}
                  </Box>
                </TableCell>

                {/* Stato Fattura - Solo per admin e userdm329 */}
                {(isAdmin || isUserDM329) && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <EditableSelectCell
                      value={(request.custom_fields?.stato_fattura as StatoFattura) || 'NO'}
                      options={STATO_FATTURA_OPTIONS}
                      optionLabels={STATO_FATTURA_LABELS}
                      onSave={(newValue) =>
                        handleSaveStatoFattura(request.id, newValue as StatoFattura, request.status)
                      }
                      validate={(value) => validateStatoFattura(value as StatoFattura, request.status)}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}

            {filteredAndSortedRequests.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={(isAdmin || isUserDM329) ? (selectionEnabled ? 10 : 9) : (selectionEnabled ? 9 : 8)}
                  align="center"
                  sx={{ py: 3 }}
                >
                  Nessuna richiesta DM329 trovata
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
