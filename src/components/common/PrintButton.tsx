import { Button } from '@mui/material'
import { Print as PrintIcon } from '@mui/icons-material'

interface PrintButtonProps {
  onClick: () => void
  disabled?: boolean
}

export const PrintButton = ({ onClick, disabled = false }: PrintButtonProps) => {
  return (
    <Button
      variant="outlined"
      startIcon={<PrintIcon />}
      onClick={onClick}
      disabled={disabled}
    >
      Stampa
    </Button>
  )
}
