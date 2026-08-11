/**
 * Anteprime pagina-per-pagina di un documento sorgente, generate localmente via pdf.js/canvas —
 * mai inviate altrove. Servono all'assegnazione manuale dei ruoli (bollo/attestazione/documento
 * d'identità): i dati che questi file contengono (carte d'identità, firme, codici fiscali) non
 * devono lasciare il browser, quindi qui non c'è alcuna classificazione automatica.
 */
import { eUnImmagineDichiarazione } from './sorgente'
import { rasterizzaPdf } from '@/services/pdfCompose/raster'

export interface AnteprimaPagina {
  url: string
}

export async function generaAnteprime(file: File): Promise<AnteprimaPagina[]> {
  if (eUnImmagineDichiarazione({ nome: file.name, mime: file.type })) {
    return [{ url: URL.createObjectURL(file) }]
  }

  const pagine = await rasterizzaPdf(file, { dpi: 72, qualita: 0.55 })
  return pagine.map((p) => ({ url: URL.createObjectURL(new Blob([p.bytes as BlobPart], { type: 'image/jpeg' })) }))
}
