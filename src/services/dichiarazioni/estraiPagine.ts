/**
 * Estrazione di una singola pagina da un PDF sorgente come `File` standalone.
 *
 * Serve perché l'utente può caricare un unico PDF con pagine di ruoli diversi intercalate
 * (bollo, attestazione, documento d'identità): l'assegnazione manuale avviene a livello di
 * pagina, non di file, quindi la composizione finale ha bisogno di isolare ogni pagina prima
 * di rilegarla nell'ordine giusto.
 */
import { PDFDocument } from 'pdf-lib'

export async function estraiPagina(file: File, indicePagina: number): Promise<File> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const sorgente = await PDFDocument.load(bytes, { ignoreEncryption: true })

  const nuovo = await PDFDocument.create()
  const [copiata] = await nuovo.copyPages(sorgente, [indicePagina])
  nuovo.addPage(copiata)

  const estratti = await nuovo.save()
  return new File([estratti.slice()], `${file.name}#${indicePagina + 1}`, { type: 'application/pdf' })
}
