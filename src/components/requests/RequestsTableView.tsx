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
} from '@mui/material'
import {
  Clear as ClearIcon,
} from '@mui/icons-material'
import { Request, RequestStatus } from '@/types'
import { getStatusColor, getStatusLabel } from '@/utils/workflow'
import { BlockIndicator } from './BlockIndicator'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

interface RequestsTableViewProps {
  requests: Request[]
  selectedRequests?: Set<string>
  onSelectRequest?: (id: string) => void
  onSelectAll?: (selected: boolean) => void
  selectionEnabled?: boolean
}

type OrderDirection = 'asc' | 'desc'
type OrderBy = 'updated_at' | 'request_type' | 'cliente' | 'status' | 'created_by'

const GENERAL_STATUSES: RequestStatus[] = [
  'APERTA',
  'ASSEGNATA',
  'IN_LAVORAZIONE',
  'INFO_NECESSARIE',
  'INFO_TRASMESSE',
  'COMPLETATA',
  'SOSPESA',
  'ABORTITA',
]

export const RequestsTableView = ({
  requests,
  selectedRequests = new Set(),
  onSelectRequest,
  onSelectAll,
  selectionEnabled = false,
}: RequestsTableViewProps) => {
  const navigate = useNavigate()
  const [orderBy, setOrderBy] = useState<OrderBy>('updated_at')
  const [order, setOrder] = useState<OrderDirection>('desc')

  // Filtri per colonna
  const [tipoFilter, setTipoFilter] = useState<string[]>([])
  const [clienteFilter, setClienteFilter] = useState<string[]>([])
  const [clienteSearchText, setClienteSearchText] = useState('')
  const [statoFilter, setStatoFilter] = useState<RequestStatus[]>([])
  const [creatorFilter, setCreatorFilter] = useState<string[]>([])

  const handleSort = (property: OrderBy) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  // Estrai valori unici per i filtri
  const uniqueTypes = useMemo(() => {
    const types = requests
      .map(r => r.request_type?.name)
      .filter(Boolean)
    return Array.from(new Set(types)).sort()
  }, [requests])

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

  const uniqueCreators = useMemo(() => {
    const creators = requests
      .map(r => r.creator?.full_name)
      .filter(Boolean)
    return Array.from(new Set(creators)).sort()
  }, [requests])

  // Filtraggio e ordinamento
  const filteredAndSortedRequests = useMemo(() => {
    let filtered = [...requests]

    // Applica filtri
    if (tipoFilter.length > 0) {
      filtered = filtered.filter(req =>
        tipoFilter.includes(req.request_type?.name || '')
      )
    }
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
        statoFilter.includes(req.status as RequestStatus)
      )
    }
    if (creatorFilter.length > 0) {
      filtered = filtered.filter(req =>
        creatorFilter.includes(req.creator?.full_name || '')
      )
    }

    // Applica ordinamento
    filtered.sort((a, b) => {
      // ALWAYS show blocked requests first
      if (a.is_blocked && !b.is_blocked) return -1
      if (!a.is_blocked && b.is_blocked) return 1

      // Then sort by selected column
      let aValue: any
      let bValue: any

      switch (orderBy) {
        case 'updated_at':
          aValue = new Date(a.updated_at).getTime()
          bValue = new Date(b.updated_at).getTime()
          break
        case 'request_type':
          aValue = a.request_type?.name || ''
          bValue = b.request_type?.name || ''
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
        case 'created_by':
          aValue = a.creator?.full_name || ''
          bValue = b.creator?.full_name || ''
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
  }, [requests, orderBy, order, tipoFilter, clienteFilter, statoFilter, creatorFilter])

  const clearFilters = () => {
    setTipoFilter([])
    setClienteFilter([])
    setClienteSearchText('')
    setStatoFilter([])
    setCreatorFilter([])
  }

  const hasActiveFilters = tipoFilter.length > 0 || clienteFilter.length > 0 || statoFilter.length > 0 || creatorFilter.length > 0

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

  return (
    <Box>
      {hasActiveFilters && (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {tipoFilter.length > 0 && (
              <Chip label={`Tipi: ${tipoFilter.length}`} size="small" onDelete={() => setTipoFilter([])} />
            )}
            {clienteFilter.length > 0 && (
              <Chip label={`Clienti: ${clienteFilter.length}`} size="small" onDelete={() => setClienteFilter([])} />
            )}
            {statoFilter.length > 0 && (
              <Chip label={`Stati: ${statoFilter.length}`} size="small" onDelete={() => setStatoFilter([])} />
            )}
            {creatorFilter.length > 0 && (
              <Chip label={`Creatori: ${creatorFilter.length}`} size="small" onDelete={() => setCreatorFilter([])} />
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

              {/* Tipo */}
              <TableCell sx={{ minWidth: 180 }}>
                <TableSortLabel
                  active={orderBy === 'request_type'}
                  direction={orderBy === 'request_type' ? order : 'asc'}
                  onClick={() => handleSort('request_type')}
                >
                  Tipo
                </TableSortLabel>
                <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                  <Select
                    multiple
                    displayEmpty
                    value={tipoFilter}
                    onChange={(e) => setTipoFilter(e.target.value as string[])}
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
                    {uniqueTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        <Checkbox checked={tipoFilter.indexOf(type) > -1} />
                        <ListItemText primary={type} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
                    onChange={(e) => setStatoFilter(e.target.value as RequestStatus[])}
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
                    {GENERAL_STATUSES.map((status) => (
                      <MenuItem key={status} value={status}>
                        <Checkbox checked={statoFilter.indexOf(status) > -1} />
                        <ListItemText primary={getStatusLabel(status)} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </TableCell>

              {/* Creata da */}
              <TableCell sx={{ minWidth: 180 }}>
                <TableSortLabel
                  active={orderBy === 'created_by'}
                  direction={orderBy === 'created_by' ? order : 'asc'}
                  onClick={() => handleSort('created_by')}
                >
                  Creata da
                </TableSortLabel>
                <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                  <Select
                    multiple
                    displayEmpty
                    value={creatorFilter}
                    onChange={(e) => setCreatorFilter(e.target.value as string[])}
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
                    {uniqueCreators.map((creator) => (
                      <MenuItem key={creator} value={creator}>
                        <Checkbox checked={creatorFilter.indexOf(creator) > -1} />
                        <ListItemText primary={creator} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
                  // Highlight blocked requests
                  ...(request.is_blocked && {
                    backgroundColor: 'warning.lighter',
                    '&:hover': { backgroundColor: 'warning.light' },
                  }),
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

                <TableCell sx={{ padding: 1 }}>
                  {request.is_blocked && <BlockIndicator isBlocked={true} />}
                </TableCell>
                <TableCell>
                  {format(new Date(request.updated_at), 'dd/MM/yyyy HH:mm', { locale: it })}
                </TableCell>
                <TableCell>{request.request_type?.name || 'N/A'}</TableCell>
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
                <TableCell>{request.creator?.full_name || 'N/A'}</TableCell>
              </TableRow>
            ))}

            {filteredAndSortedRequests.length === 0 && (
              <TableRow>
                <TableCell colSpan={selectionEnabled ? 7 : 6} align="center" sx={{ py: 3 }}>
                  Nessuna richiesta trovata
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}
