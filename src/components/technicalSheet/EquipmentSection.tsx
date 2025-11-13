import { ReactNode } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  Chip,
  Alert,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'

interface EquipmentSectionProps {
  title: string
  subtitle?: string
  items: any[]
  maxItems: number
  minItems?: number
  onAdd: () => void
  onRemove: (index: number) => void
  renderItem: (item: any, index: number) => ReactNode
  generateCode: (index: number) => string
  canRemove?: (item: any, index: number) => { can: boolean; reason?: string }
  itemTypeName?: string // Es: "serbatoio", "compressore"
}

/**
 * Componente generico per sezioni con apparecchiature ripetibili
 * Gestisce add/remove dinamico con validazione limiti
 */
export const EquipmentSection = ({
  title,
  subtitle,
  items,
  maxItems,
  minItems = 0,
  onAdd,
  onRemove,
  renderItem,
  generateCode,
  canRemove,
  itemTypeName = 'apparecchiatura',
}: EquipmentSectionProps) => {
  const canAddMore = items.length < maxItems
  const canRemoveItems = items.length > minItems

  const handleRemove = (index: number) => {
    if (!canRemoveItems) {
      alert(`Numero minimo di ${itemTypeName} richiesto: ${minItems}`)
      return
    }

    // Verifica se può essere rimosso (dipendenze)
    if (canRemove) {
      const result = canRemove(items[index], index)
      if (!result.can) {
        alert(result.reason || 'Impossibile rimuovere questa apparecchiatura')
        return
      }
    }

    const confirmed = window.confirm(
      `Confermi di voler eliminare ${itemTypeName} ${generateCode(index)}?`
    )
    if (confirmed) {
      onRemove(index)
    }
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">{title}</Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`${items.length}/${maxItems}`}
            size="small"
            color={items.length === 0 ? 'error' : 'primary'}
            variant="outlined"
          />
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={onAdd}
            disabled={!canAddMore}
          >
            Aggiungi
          </Button>
        </Box>
      </Box>

      {/* Lista apparecchiature */}
      {items.length === 0 ? (
        <Alert severity="info">
          Nessun {itemTypeName} aggiunto. Clicca "Aggiungi" per iniziare.
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item, index) => (
            <Card key={index} variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Chip
                    label={generateCode(index)}
                    color="primary"
                    size="small"
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleRemove(index)}
                    disabled={!canRemoveItems}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
                {renderItem(item, index)}
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      {/* Info limiti */}
      {!canAddMore && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Numero massimo di {itemTypeName} raggiunto ({maxItems})
        </Alert>
      )}
    </Box>
  )
}
