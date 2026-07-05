import type { Components, Theme } from '@mui/material/styles'
import { radii } from './tokens'

/**
 * Override e default globali dei componenti.
 *
 * La compattezza arriva quasi tutta da qui (defaultProps size/margin),
 * così la maggior parte delle pagine diventa più densa SENZA modifiche per-pagina.
 * NB: i prop espliciti nel JSX vincono sui defaultProps — vedi DynamicFormField.
 */
export const components: Components<Theme> = {
  MuiButton: {
    defaultProps: { size: 'small', disableElevation: true },
    styleOverrides: {
      root: { textTransform: 'none', borderRadius: radii.control },
    },
  },
  MuiCard: {
    styleOverrides: {
      root: ({ theme }) => ({
        borderRadius: radii.card,
        border: `1px solid ${theme.palette.divider}`,
        backgroundImage: 'none',
      }),
    },
  },
  MuiPaper: {
    styleOverrides: {
      root: { borderRadius: radii.paper, backgroundImage: 'none' },
    },
  },
  MuiChip: {
    defaultProps: { size: 'small' },
    styleOverrides: {
      root: { borderRadius: radii.chip, fontWeight: 600 },
    },
  },
  MuiTextField: {
    defaultProps: { size: 'small', margin: 'dense' },
  },
  MuiFormControl: {
    defaultProps: { size: 'small', margin: 'dense' },
  },
  MuiSelect: {
    defaultProps: { size: 'small' },
  },
  MuiTable: {
    defaultProps: { size: 'small' },
  },
  MuiTableCell: {
    styleOverrides: {
      root: { paddingTop: 8, paddingBottom: 8 },
      head: { fontWeight: 700, lineHeight: 1.3 },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: { fontSize: '0.75rem' },
    },
  },
}
