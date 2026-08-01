import { useState } from 'react'
import { Box, Typography, IconButton, Tooltip, Divider } from '@mui/material'
import { Edit as EditIcon } from '@mui/icons-material'
import { CodicePraticaDialog } from './CodicePraticaDialog'
import { customersApi } from '@/services/api/customers'
import type { Customer, Request } from '@/types'

export interface PlantLocationSectionProps {
  request: Request
  customer: Customer | null
  /** Già risolto dal chiamante con risolviIndirizzoImpianto. */
  indirizzoImpianto: string
  canEdit: boolean
  onSaved: () => void
}

/**
 * Ubicazione dell'impianto. La matita riapre CodicePraticaDialog invece di avere un
 * editor proprio: indirizzo e denominazione sala sono legati a sala_lettera,
 * progressivo e anno, che compongono il codice pratica; modificarne solo due
 * lascerebbe il codice disallineato dalla sala.
 */
export const PlantLocationSection = ({ request, customer, indirizzoImpianto, canEdit, onSaved }: PlantLocationSectionProps) => {
  const [editOpen, setEditOpen] = useState(false)
  const modificabile = canEdit && !!customer

  return (
    <>
      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">Ubicazione impianto</Typography>
        {canEdit && (
          <Tooltip title={modificabile ? 'Modifica ubicazione impianto' : 'Pratica senza anagrafica cliente collegata'}>
            <span>
              <IconButton size="small" color="primary" disabled={!modificabile} onClick={() => setEditOpen(true)}>
                <EditIcon />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Indirizzo impianto</Typography>
          <Typography variant="body1" gutterBottom>{indirizzoImpianto || 'N/A'}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Denominazione sala</Typography>
          <Typography variant="body1" gutterBottom>{request.denominazione_sala || 'N/A'}</Typography>
        </Box>
      </Box>

      {editOpen && customer && (
        <CodicePraticaDialog
          request={request}
          customer={customer}
          sedeLegale={customersApi.formatFullAddress(customer)}
          hasCode={!!request.sala_lettera}
          titolo="Modifica ubicazione impianto"
          onClose={() => setEditOpen(false)}
          onSaved={onSaved}
        />
      )}
    </>
  )
}
