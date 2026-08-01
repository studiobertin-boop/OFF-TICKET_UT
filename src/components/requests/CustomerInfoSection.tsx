import { useState } from 'react'
import { Box, Typography, IconButton, Tooltip, Divider } from '@mui/material'
import { Edit as EditIcon } from '@mui/icons-material'
import { CustomerEditDialog } from '@/components/customers/CustomerEditDialog'
import type { Customer } from '@/types'

/** Valori da mostrare: già risolti dal chiamante con la sua catena di fallback. */
export interface InfoCliente {
  ragione_sociale: string
  identificativo: string | null
  telefono: string
  pec: string
  descrizione_attivita: string
  sede_legale: string
}

export interface CustomerInfoSectionProps {
  info: InfoCliente
  /**
   * Record anagrafico vero. È null sulle pratiche importate senza cliente a DB:
   * la vista funziona lo stesso, la matita no perché manca l'id da aggiornare.
   */
  customer: Customer | null
  canEdit: boolean
  onSaved: () => void
}

const Campo = ({ label, value }: { label: string; value: string }) => (
  <Box>
    <Typography variant="subtitle2" color="text.secondary">{label}</Typography>
    <Typography variant="body1" gutterBottom>{value || 'N/A'}</Typography>
  </Box>
)

export const CustomerInfoSection = ({ info, customer, canEdit, onSaved }: CustomerInfoSectionProps) => {
  const [editOpen, setEditOpen] = useState(false)
  const modificabile = canEdit && !!customer

  return (
    <>
      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">Cliente</Typography>
        {canEdit && (
          <Tooltip title={modificabile ? 'Modifica dati cliente' : 'Pratica senza anagrafica cliente collegata'}>
            <span>
              <IconButton size="small" color="primary" disabled={!modificabile} onClick={() => setEditOpen(true)}>
                <EditIcon />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        <Campo
          label="Ragione sociale"
          value={info.identificativo ? `${info.identificativo} — ${info.ragione_sociale}` : info.ragione_sociale}
        />
        <Campo label="Sede legale" value={info.sede_legale} />
        <Campo label="Telefono" value={info.telefono} />
        <Campo label="PEC" value={info.pec} />
        <Campo label="Descrizione attività" value={info.descrizione_attivita} />
      </Box>

      {editOpen && customer && (
        <CustomerEditDialog customer={customer} onClose={() => setEditOpen(false)} onSaved={onSaved} />
      )}
    </>
  )
}
