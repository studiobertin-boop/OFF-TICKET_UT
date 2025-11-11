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
} from '@mui/icons-material'
import { Request, DM329Status } from '@/types'
import { getStatusColor, getStatusLabel } from '@/utils/workflow'
import { BlockIndicator } from './BlockIndicator'
import { TimerAlertIndicator } from './TimerAlertIndicator'
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

interface DM329TableViewProps {
  requests: Request[]
  selectedRequests?: Set<string>
  onSelectRequest?: (id: string) => void
  onSelectAll?: (selected: boolean) => void
  selectionEnabled?: boolean
  showPrintButton?: boolean
}

type OrderDirection = 'asc' | 'desc'
type OrderBy = 'updated_at' | 'cliente' | 'status' | 'no_civa' | 'note'

const DM329_STATUSES: DM329Status[] = [
  '1-INCARICO_RICEVUTO',
  '2-SCHEDA_DATI_PRONTA',
  '3-MAIL_CLIENTE_INVIATA',
  '4-DOCUMENTI_PRONTI',
  '5-ATTESA_FIRMA',
  '6-PRONTA_PER_CIVA',
  '7-CHIUSA',
]

export const DM329TableView = ({
  requests,
  selectedRequests = new Set(),
  onSelectRequest,
  onSelectAll,
  selectionEnabled = false,
  showPrintButton = true,
}: DM329TableViewProps) => {
  const navigate = useNavigate()
  const [orderBy, setOrderBy] = useState<OrderBy>('updated_at')
  const [order, setOrder] = useState<OrderDirection>('desc')

  // Filtri per colonna
  const [clienteFilter, setClienteFilter] = useState<string[]>([])
  const [clienteSearchText, setClienteSearchText] = useState('')
  const [statoFilter, setStatoFilter] = useState<DM329Status[]>([])
  const [noCivaFilter, setNoCivaFilter] = useState<'all' | 'true' | 'false'>('all')
  const [noteFilter, setNoteFilter] = useState('')

  const handleSort = (property: OrderBy) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
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

    // Applica ordinamento
    filtered.sort((a, b) => {
      // Priority 1: ALWAYS show blocked requests first
      if (a.is_blocked && !b.is_blocked) return -1
      if (!a.is_blocked && b.is_blocked) return 1

      // Priority 2: Show timer alerts second (only for non-blocked requests)
      if (!a.is_blocked && !b.is_blocked) {
        if (a.has_timer_alert && !b.has_timer_alert) return -1
        if (!a.has_timer_alert && b.has_timer_alert) return 1
      }

      // Priority 3: Within same category (blocked/timer/normal), sort by created_at (oldest first)
      // This ensures oldest requests appear first within each priority group
      if (a.is_blocked === b.is_blocked && a.has_timer_alert === b.has_timer_alert) {
        const aCreated = new Date(a.created_at).getTime()
        const bCreated = new Date(b.created_at).getTime()
        return aCreated - bCreated // Oldest first
      }

      // Then sort by selected column
      let aValue: any
      let bValue: any

      switch (orderBy) {
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
  }, [requests, orderBy, order, clienteFilter, statoFilter, noCivaFilter, noteFilter])

  const clearFilters = () => {
    setClienteFilter([])
    setClienteSearchText('')
    setStatoFilter([])
    setNoCivaFilter('all')
    setNoteFilter('')
  }

  const hasActiveFilters = clienteFilter.length > 0 || statoFilter.length > 0 || noCivaFilter !== 'all' || noteFilter

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

    const html = generatePrintHTML({
      title: 'Richieste DM329',
      columns: [
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
          align: 'center',
        },
        {
          header: 'Note',
          getValue: (req) => (req.custom_fields?.note as string) || '-',
        },
      ],
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
      {/* Print button */}
      {showPrintButton && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
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
          </Box>
          <IconButton size="small" onClick={clearFilters} color="primary" title="Cancella tutti i filtri">
            <ClearIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      <TableContainer component={Paper}>
        <Table size="small" sx={{ minWidth: 900 }}>
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

              {/* Block indicator column */}
              <TableCell sx={{ width: 50, padding: 1 }} />

              {/* Data ultimo cambio stato */}
              <TableCell sx={{ minWidth: 150 }}>
                <TableSortLabel
                  active={orderBy === 'updated_at'}
                  direction={orderBy === 'updated_at' ? order : 'asc'}
                  onClick={() => handleSort('updated_at')}
                >
                  Data Ultimo Cambio
                </TableSortLabel>
              </TableCell>

              {/* Cliente */}
              <TableCell sx={{ minWidth: 200 }}>
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
              <TableCell sx={{ minWidth: 200 }}>
                <TableSortLabel
                  active={orderBy === 'status'}
                  direction={orderBy === 'status' ? order : 'asc'}
                  onClick={() => handleSort('status')}
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
              <TableCell sx={{ minWidth: 120, textAlign: 'center' }}>
                <TableSortLabel
                  active={orderBy === 'no_civa'}
                  direction={orderBy === 'no_civa' ? order : 'asc'}
                  onClick={() => handleSort('no_civa')}
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
              <TableCell sx={{ minWidth: 300 }}>
                <TableSortLabel
                  active={orderBy === 'note'}
                  direction={orderBy === 'note' ? order : 'asc'}
                  onClick={() => handleSort('note')}
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
                  // Highlight blocked requests (priority 1)
                  ...(request.is_blocked && {
                    backgroundColor: 'warning.lighter',
                    '&:hover': { backgroundColor: 'warning.light' },
                  }),
                  // Highlight timer alert requests (priority 2, only if not blocked)
                  ...(!request.is_blocked && request.has_timer_alert && {
                    backgroundColor: 'error.lighter',
                    '&:hover': { backgroundColor: 'error.light' },
                  }),
                  // Highlight selected requests (overrides others)
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

                <TableCell sx={{ padding: 1 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {request.is_blocked && <BlockIndicator isBlocked={true} />}
                    {request.has_timer_alert && <TimerAlertIndicator hasAlert={true} />}
                  </Box>
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
                      maxWidth: 300,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {(request.custom_fields?.note as string) || '-'}
                  </Box>
                </TableCell>
              </TableRow>
            ))}

            {filteredAndSortedRequests.length === 0 && (
              <TableRow>
                <TableCell colSpan={selectionEnabled ? 7 : 6} align="center" sx={{ py: 3 }}>
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
