import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

/**
 * `Blob.arrayBuffer()` non c'è nel jsdom di questa versione, ma c'è in ogni browser da anni ed è
 * il modo in cui l'applicazione legge i file caricati (composizione del fascicolo, conversione
 * PDF). Senza questo innesto i test di quel codice fallirebbero per una mancanza
 * dell'ambiente di prova, non del codice.
 */
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function leggiComeArrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((risolvi, rifiuta) => {
      const lettore = new FileReader()
      lettore.onload = () => risolvi(lettore.result as ArrayBuffer)
      lettore.onerror = () => rifiuta(lettore.error)
      lettore.readAsArrayBuffer(this)
    })
  }
}

// Cleanup after each test case
afterEach(() => {
  cleanup()
})
