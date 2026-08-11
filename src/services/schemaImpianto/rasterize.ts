/**
 * Rasterizzazione dell'SVG in PNG, per consegnare al motore della relazione lo stesso
 * `SchemaImpianto` che produce l'upload manuale — nessuna modifica a `renderRelazione.ts`.
 *
 * Dipende dal DOM (canvas + Image), come `components/relazione/schemaImpiantoFile.ts`:
 * per questo la logica pura (modello, layout, SVG) vive nei moduli accanto, testabili in
 * Node, e qui resta solo il glue. Verifica in app, non con test unitari.
 */
import type { SchemaImpianto } from '@/services/relazione/types'

/**
 * Fattore di sovracampionamento rispetto alle unità dell'SVG: lo schema finisce stampato a
 * 640px di larghezza (`SCHEMA_LARGHEZZA_PX` in `renderRelazione.ts`), ma il .docx conserva
 * i pixel originali, quindi un rendering più fitto mantiene leggibili le etichette anche
 * quando il documento viene ingrandito o stampato.
 */
const SCALA = 2

/** Tetto di pixel del canvas, allineato al budget usato per gli schemi caricati a mano. */
const BUDGET_PX = 2_000_000

function caricaImmagine(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Rendering dello schema non riuscito.'))
    img.src = url
  })
}

function canvasABlobPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Conversione dello schema in immagine non riuscita.'))
    }, 'image/png')
  })
}

/** Dimensioni dichiarate nell'intestazione dell'SVG prodotto da `renderSvg`. */
function dimensioniSvg(svg: string): { larghezza: number; altezza: number } {
  const w = /width="(\d+(?:\.\d+)?)"/.exec(svg)
  const h = /height="(\d+(?:\.\d+)?)"/.exec(svg)
  if (!w || !h) throw new Error('SVG dello schema non valido.')
  return { larghezza: Number(w[1]), altezza: Number(h[1]) }
}

export async function rasterizzaSvg(svg: string, nomeFile = 'schema-generato.png'): Promise<SchemaImpianto> {
  const { larghezza, altezza } = dimensioniSvg(svg)

  const area = larghezza * altezza * SCALA * SCALA
  const scala = area > BUDGET_PX ? SCALA * Math.sqrt(BUDGET_PX / area) : SCALA
  const larghezzaPx = Math.max(1, Math.round(larghezza * scala))
  const altezzaPx = Math.max(1, Math.round(altezza * scala))

  // Il data URL evita di dover revocare un object URL in caso di errore di caricamento.
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const img = await caricaImmagine(url)

  const canvas = document.createElement('canvas')
  canvas.width = larghezzaPx
  canvas.height = altezzaPx
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Impossibile ottenere il contesto canvas.')
  // Lo schema entra nel documento su fondo bianco: senza riempimento il PNG resterebbe
  // trasparente e in Word apparirebbe sul grigio della pagina.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, larghezzaPx, altezzaPx)
  ctx.drawImage(img, 0, 0, larghezzaPx, altezzaPx)

  const blob = await canvasABlobPng(canvas)
  const buffer = await blob.arrayBuffer()

  return { dati: new Uint8Array(buffer), larghezzaPx, altezzaPx, nomeFile }
}
