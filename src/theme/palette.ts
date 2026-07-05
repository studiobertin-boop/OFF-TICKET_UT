import type { PaletteMode, PaletteOptions } from '@mui/material'

/**
 * Palette per modalità. Neutrali con leggera dominante fredda (scelti, non ereditati)
 * per superfici più definite, e chiavi `lighter` aggiunte (vedi augmentation.d.ts)
 * per gli sfondi tenui usati nell'app (es. evidenziazione righe).
 */
export function buildPalette(mode: PaletteMode): PaletteOptions {
  if (mode === 'dark') {
    return {
      mode,
      primary: { main: '#6fb0ef', light: '#a6d0f7', dark: '#4a90d9', contrastText: '#0f141b' },
      secondary: { main: '#ce93d8', light: '#f3e5f5', dark: '#ab47bc' },
      background: { default: '#0f141b', paper: '#171d26' },
      divider: '#2a333f',
      text: { primary: '#e6edf5', secondary: '#b3bfce' },
      error: { main: '#ef6b6b', light: '#f28e8e', dark: '#cf3f3f', lighter: '#351919' },
      warning: { main: '#eaa73c', light: '#f0bd6b', dark: '#c9770f', lighter: '#33280f' },
      success: { main: '#4fc07e', light: '#79d29c', dark: '#2b8a54', lighter: '#12301f' },
      info: { main: '#58a6e6', light: '#8ac3ef', dark: '#2f7fc9', lighter: '#14263a' },
    }
  }
  return {
    mode,
    primary: { main: '#1565c0', light: '#4285d0', dark: '#0d4a92', contrastText: '#ffffff' },
    secondary: { main: '#9c27b0', light: '#ba68c8', dark: '#7b1fa2' },
    background: { default: '#eef1f5', paper: '#ffffff' },
    divider: '#dfe4ec',
    text: { primary: '#1a2230', secondary: '#46536a' },
    error: { main: '#cf3f3f', light: '#e07373', dark: '#a52a2a', lighter: '#fbe6e6' },
    warning: { main: '#c9770f', light: '#e0a04a', dark: '#9a5a06', lighter: '#fbefd9' },
    success: { main: '#2b8a54', light: '#5aa87c', dark: '#1e6b3f', lighter: '#e2f3e9' },
    info: { main: '#2f7fc9', light: '#5fa0d9', dark: '#215f9a', lighter: '#e6f0fa' },
  }
}
