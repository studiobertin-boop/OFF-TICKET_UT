import type { ReactNode } from 'react'
import { Box, Button, Chip, Divider, IconButton, Typography } from '@mui/material'
import { Close as CloseIcon, AddLink as AddLinkIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { CompletenessBar } from '@/components/common'
import { eCompleta, type Completezza } from '@/utils/schedaCompleteness'
import type { EquipmentTypeDef } from './equipmentConfig'

export interface RowDetailPanelProps {
  def: EquipmentTypeDef
  code: string
  color: string
  completezza: Completezza
  /** Campi extra del tipo, già montati dal chiamante (osservano il form). */
  campi: ReactNode
  onClose: () => void
  onDelete: (() => void) | null
  append: { label: string; onClick: () => void } | null
}

/**
 * Dettagli di una riga della tabella apparecchiature.
 *
 * Prima erano una riga espansa a piena larghezza: spingeva via le righe sotto, e i
 * campi si disponevano in fila indiana in un flex che andava a capo dove capitava.
 * Qui hanno una colonna propria, quindi le etichette stanno per esteso e la tabella
 * non si muove mentre li si compila.
 */
export const RowDetailPanel = ({
  def, code, color, completezza, campi, onClose, onDelete, append,
}: RowDetailPanelProps) => {
  const pieno = eCompleta(completezza)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: color, flex: 'none' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{code}</Typography>
        <Typography variant="body2" color="text.secondary">{def.label.toLowerCase()}</Typography>
        <IconButton size="small" onClick={onClose} sx={{ ml: 'auto' }} aria-label="Chiudi i dettagli">
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ px: 1.75, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <CompletenessBar completezza={completezza} larghezza={130} />
        {!pieno && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {completezza.mancanti.map((m) => (
              <Chip key={m} label={m} size="small" variant="outlined" color="warning" sx={{ height: 20, fontSize: '0.68rem' }} />
            ))}
          </Box>
        )}
        {/* Il denominatore cambia col tipo: senza dirlo, una riga mezza vuota che
            risulta completa sembra un errore di conteggio. */}
        <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 1 }}>
          {completezza.previsti} campi previsti per {def.label.toLowerCase()}: gli altri non si applicano a questo tipo.
        </Typography>
      </Box>

      <Box sx={{ px: 1.75, py: 1.5, flex: 1, overflowY: 'auto' }}>
        {def.extra.length > 0 ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 1.5, alignItems: 'end' }}>
            {campi}
          </Box>
        ) : (
          <Typography variant="body2" color="text.disabled">
            Questo tipo non ha campi oltre a quelli in tabella.
          </Typography>
        )}
      </Box>

      {(append || onDelete) && (
        <>
          <Divider />
          <Box sx={{ display: 'flex', gap: 1, px: 1.75, py: 1.25 }}>
            {append && (
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={<AddLinkIcon />}
                onClick={append.onClick}
                sx={{ flex: 1, borderColor: 'primary.main' }}
              >
                Appendi {append.label.toLowerCase()}
              </Button>
            )}
            {onDelete && (
              <IconButton size="small" color="error" onClick={onDelete} aria-label={`Elimina ${code}`}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </>
      )}
    </Box>
  )
}
