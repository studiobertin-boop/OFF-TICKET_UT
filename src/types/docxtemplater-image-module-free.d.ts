/**
 * Il pacchetto `docxtemplater-image-module-free` (MIT) non porta tipi propri.
 * Qui si dichiara la sola superficie che usiamo: costruttore con `getImage`/`getSize`.
 *
 * Nota sul contratto del modulo: il valore del tag `{%tag}` deve essere un **primitivo**.
 * Un oggetto viene interpretato come risultato già risolto (`{rId, sizePixel}`) e manda
 * in errore il render; un valore falsy produce un paragrafo vuoto, che è come il modulo
 * gestisce l'immagine assente.
 */
declare module 'docxtemplater-image-module-free' {
  export interface ImageModuleOptions {
    /** Centra l'immagine nel paragrafo. */
    centered?: boolean
    fileType?: 'docx' | 'pptx'
    /** Restituisce i byte dell'immagine a partire dal valore del tag. */
    getImage(tagValue: string, tagName: string): Uint8Array | ArrayBuffer
    /** Restituisce [larghezza, altezza] in pixel; il modulo li converte in EMU. */
    getSize(
      img: Uint8Array | ArrayBuffer,
      tagValue: string,
      tagName: string
    ): [number, number]
  }

  export default class ImageModule {
    constructor(options: ImageModuleOptions)
  }
}
