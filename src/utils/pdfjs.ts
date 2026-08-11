import * as pdfjsLib from 'pdfjs-dist'

/**
 * pdfjs configurato, in un modulo solo.
 *
 * Il worker va indicato una volta per applicazione e prima di qualunque `getDocument`: tenerlo
 * qui evita che ogni modulo che apre un PDF debba ripetere — e tenere allineata — la stessa riga.
 * Il file sta nei node_modules e Vite lo serve come asset statico.
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).href

export { pdfjsLib }
