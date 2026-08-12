/**
 * Composizione finale delle "dichiarazioni": concatena le pagine assegnate manualmente (bollo,
 * attestazione, documento d'identità utilizzatore), la dichiarazione installatore generata e il
 * documento d'identità dell'installatore, in questo ordine fisso, su foglio A4 verticale — come
 * la carta intestata e il documento d'identità reali dell'installatore predefinito.
 */
import { componiFascicolo, type EsitoComposizione, type OpzioniComposizione, type SorgenteFascicolo } from '@/services/pdfCompose/componiPdf'
import { ORDINE_RUOLI, type RuoloDichiarazione } from './tipi'

export interface FontePagina {
  file: File
  etichetta: string
  ruolo: RuoloDichiarazione
  /** Posizione dentro il ruolo: permette di intercalare pagine di file diversi nello stesso ruolo. */
  ordine: number
}

/** Ordina le pagine sorgente per ruolo (bollo → attestazione → doc. identità) e poi per `ordine`. */
export function ordinaFontiSorgente(fonti: FontePagina[]): FontePagina[] {
  const indiceRuolo = (r: RuoloDichiarazione) => ORDINE_RUOLI.indexOf(r)
  return [...fonti].sort((a, b) => indiceRuolo(a.ruolo) - indiceRuolo(b.ruolo) || a.ordine - b.ordine)
}

export interface AssemblaInput {
  fontiSorgente: FontePagina[]
  dichiarazioneInstallatore: File
  documentoIdentitaInstallatore: File
}

export async function assemblaDichiarazioni(
  input: AssemblaInput,
  opzioni: OpzioniComposizione = {}
): Promise<EsitoComposizione> {
  const sorgenti: SorgenteFascicolo[] = [
    ...ordinaFontiSorgente(input.fontiSorgente).map((f) => ({
      file: f.file,
      etichetta: f.etichetta,
      // Il documento d'identità è spesso una foto: tollera meglio la compressione dei
      // documenti di testo (bollo, attestazione), che vanno preservati leggibili più a lungo.
      foto: f.ruolo === 'DOC_IDENTITA_UTILIZZATORE',
    })),
    { file: input.dichiarazioneInstallatore, etichetta: 'Dichiarazione installatore', foto: false },
    { file: input.documentoIdentitaInstallatore, etichetta: 'Documento identità installatore', foto: true },
  ]

  // Nessun `foglio` esplicito: il default di `componiFascicolo` è già A4 verticale.
  return componiFascicolo(sorgenti, opzioni)
}
