/**
 * Design tokens — unica fonte di verità per raggi, densità e dimensioni ricorrenti.
 * Consumati dal tema (components.ts) e dai componenti condivisi.
 */

/** Raggi di bordo (px) */
export const radii = {
  card: 12,
  control: 8,
  chip: 6,
  paper: 8,
} as const

/** Altezze standard dei grafici (px) — sostituiscono i valori sparsi (500/300) */
export const chartHeights = {
  pie: 320,
  bar: 300,
  line: 300,
  compact: 220,
} as const

/**
 * Scala di densità semantica, in unità di spacing MUI (base 8px).
 * Usare questi valori invece di numeri magici (spacing={3}, p:2, ...).
 */
export const density = {
  pagePy: 3, // padding verticale del contenuto pagina
  pagePx: { xs: 1.5, sm: 2, md: 3 },
  sectionGap: 2, // gap tra card/sezioni
  cardPadding: 2, // padding interno delle card
  fieldGap: 1.5, // gap tra campi form
} as const
