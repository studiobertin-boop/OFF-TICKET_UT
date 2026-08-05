import { useState } from 'react'
import { Box, IconButton, Tooltip } from '@mui/material'
import { Edit as EditIcon } from '@mui/icons-material'
import { CustomerEditDialog } from '@/components/customers/CustomerEditDialog'
import { FieldValue, SectionLabel } from '@/components/common'
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

export const CustomerInfoSection = ({ info, customer, canEdit, onSaved }: CustomerInfoSectionProps) => {
  const [editOpen, setEditOpen] = useState(false)
  const modificabile = canEdit && !!customer

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <SectionLabel>Cliente</SectionLabel>
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

      {/* Colonne a riempimento: i campi corti (telefono, PEC) si affiancano invece
          di occupare una riga intera a testa, come faceva la griglia fissa a due. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          columnGap: 3,
          rowGap: 1.5,
        }}
      >
        <FieldValue
          label="Ragione sociale"
          value={info.identificativo ? `${info.identificativo} — ${info.ragione_sociale}` : info.ragione_sociale}
        />
        <FieldValue label="Sede legale" value={info.sede_legale} />
        <FieldValue label="Descrizione attività" value={info.descrizione_attivita} />
        {/* I due recapiti restano vicini: separarli su righe diverse li farebbe
            leggere come campi slegati fra loro. */}
        <FieldValue label="Telefono" value={info.telefono} />
        <FieldValue label="PEC" value={info.pec} />
      </Box>

      {editOpen && customer && (
        <CustomerEditDialog customer={customer} onClose={() => setEditOpen(false)} onSaved={onSaved} />
      )}
    </>
  )
}
