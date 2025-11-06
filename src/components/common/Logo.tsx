import { Box } from '@mui/material'

interface LogoProps {
  height?: number
  width?: number
  onClick?: () => void
}

export const Logo = ({ height = 40, width, onClick }: LogoProps) => {
  return (
    <Box
      component="img"
      src="/Logo-Officomp.png"
      alt="Officomp Logo"
      sx={{
        height,
        width: width || 'auto',
        cursor: onClick ? 'pointer' : 'default',
        mr: 2,
        objectFit: 'contain',
      }}
      onClick={onClick}
    />
  )
}
