import '@mui/material/styles'

/**
 * Aggiunge la chiave `lighter` alla palette dei colori.
 * Serve perché il codice (es. RequestsTableView, riga bloccata) usa
 * `warning.lighter` / `success.lighter`, che NON esistono di default in MUI
 * e finora si risolvevano a `undefined`.
 */
declare module '@mui/material/styles' {
  interface PaletteColor {
    lighter: string
  }
  interface SimplePaletteColorOptions {
    lighter?: string
  }
}
