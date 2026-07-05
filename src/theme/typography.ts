import type { TypographyOptions } from '@mui/material/styles/createTypography'

/**
 * Scala tipografica completa: titoli pagina più contenuti, testo dati più fitto.
 * Prima erano definiti solo h1–h6 (tutti weight 500) e il resto ereditava i default.
 */
export const typography: TypographyOptions = {
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  h1: { fontSize: '2.25rem', fontWeight: 600, letterSpacing: '-0.02em' },
  h2: { fontSize: '1.875rem', fontWeight: 600, letterSpacing: '-0.02em' },
  h3: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.01em' },
  h4: { fontSize: '1.375rem', fontWeight: 600, letterSpacing: '-0.01em' }, // titoli pagina
  h5: { fontSize: '1.125rem', fontWeight: 600 },
  h6: { fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.01em' }, // titoli sezione
  subtitle1: { fontSize: '0.95rem', fontWeight: 500 },
  subtitle2: { fontSize: '0.8125rem', fontWeight: 600 },
  body1: { fontSize: '0.9375rem', lineHeight: 1.5 },
  body2: { fontSize: '0.8125rem', lineHeight: 1.45 },
  button: { fontWeight: 600, letterSpacing: 0 },
  caption: { fontSize: '0.75rem' },
  overline: { fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em' },
}
