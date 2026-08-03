import {
  Box,
  Checkbox,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  VisibilityOff as DisattivaIcon,
  Visibility as RiattivaIcon,
} from '@mui/icons-material'
import type { EquipmentCatalogItem } from '@/types'
import { missingCanonicalSpecs, readSpec } from '@/services/equipmentAudit'
import { specsFieldsFor } from '@/utils/equipmentCatalogValidation'

interface EquipmentCatalogTableProps {
  righe: EquipmentCatalogItem[]
  totale: number
  page: number
  rowsPerPage: number
  onPageChange: (page: number) => void
  onRowsPerPageChange: (n: number) => void
  onEdit: (item: EquipmentCatalogItem) => void
  onDelete: (item: EquipmentCatalogItem) => void
  onToggleActive: (item: EquipmentCatalogItem) => void
  /** Id delle righe selezionate, condivise con la pagina che le raccoglie. */
  selezionate: Set<string>
  onToggleRiga: (id: string) => void
  /** Seleziona o deseleziona tutte le righe della pagina corrente. */
  onTogglePagina: (seleziona: boolean) => void
}

/** Dati tecnici della riga, compattati: al massimo tre, quelli che identificano la voce. */
function chipsSpecs(item: EquipmentCatalogItem) {
  const tipo = item.tipo_apparecchiatura ?? null

  return specsFieldsFor(tipo, item.specs)
    .map(def => {
      const v = readSpec(tipo, item.specs, def.key)
      if (v === null) return null
      const nome = def.label.split('—')[0].trim()
      return { key: def.key, testo: `${nome} ${v}${def.unit ? ` ${def.unit}` : ''}` }
    })
    .filter((x): x is { key: string; testo: string } => x !== null)
    .slice(0, 3)
}

export const EquipmentCatalogTable = ({
  righe,
  totale,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  onEdit,
  onDelete,
  onToggleActive,
  selezionate,
  onToggleRiga,
  onTogglePagina,
}: EquipmentCatalogTableProps) => (
  <TableContainer component={Paper}>
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell padding="checkbox">
            <Checkbox
              size="small"
              checked={righe.length > 0 && righe.every(r => selezionate.has(r.id))}
              indeterminate={righe.some(r => selezionate.has(r.id)) && !righe.every(r => selezionate.has(r.id))}
              onChange={e => onTogglePagina(e.target.checked)}
              inputProps={{ 'aria-label': 'Seleziona tutte le righe della pagina' }}
            />
          </TableCell>
          <TableCell>Tipo</TableCell>
          <TableCell>Marca</TableCell>
          <TableCell>Modello</TableCell>
          <TableCell>Dati tecnici</TableCell>
          <TableCell align="right">Utilizzi</TableCell>
          <TableCell align="right">Azioni</TableCell>
        </TableRow>
      </TableHead>

      <TableBody>
        {righe.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} align="center">
              <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                Nessuna apparecchiatura corrisponde ai filtri
              </Typography>
            </TableCell>
          </TableRow>
        ) : (
          righe.map(item => {
            const mancanti = missingCanonicalSpecs(item.tipo_apparecchiatura ?? null, item.specs)

            return (
              <TableRow key={item.id} hover sx={{ opacity: item.is_active ? 1 : 0.55 }}>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={selezionate.has(item.id)}
                    onChange={() => onToggleRiga(item.id)}
                    inputProps={{ 'aria-label': `Seleziona ${item.marca} ${item.modello}` }}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{item.tipo_apparecchiatura ?? '—'}</Typography>
                </TableCell>

                <TableCell>{item.marca}</TableCell>

                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{item.modello}</span>
                    {!item.is_active && <Chip label="disattivata" size="small" />}
                  </Stack>
                </TableCell>

                <TableCell>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {chipsSpecs(item).map(c => (
                      <Chip key={c.key} label={c.testo} size="small" variant="outlined" />
                    ))}
                    {mancanti.length > 0 && (
                      <Tooltip title={`Mancano: ${mancanti.map(d => d.label).join(', ')}`}>
                        <Chip label="incompleta" size="small" color="warning" variant="outlined" />
                      </Tooltip>
                    )}
                  </Box>
                </TableCell>

                <TableCell align="right">{item.usage_count ?? 0}</TableCell>

                <TableCell align="right">
                  <Tooltip title="Modifica">
                    <IconButton size="small" onClick={() => onEdit(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={item.is_active ? 'Disattiva' : 'Riattiva'}>
                    <IconButton size="small" onClick={() => onToggleActive(item)}>
                      {item.is_active ? (
                        <DisattivaIcon fontSize="small" />
                      ) : (
                        <RiattivaIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Elimina definitivamente">
                    <IconButton size="small" color="error" onClick={() => onDelete(item)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>

    <TablePagination
      component="div"
      count={totale}
      page={page}
      onPageChange={(_e, p) => onPageChange(p)}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={e => onRowsPerPageChange(parseInt(e.target.value, 10))}
      rowsPerPageOptions={[25, 50, 100]}
      labelRowsPerPage="Righe per pagina"
      labelDisplayedRows={({ from, to, count }) => `${from}–${to} di ${count}`}
    />
  </TableContainer>
)
