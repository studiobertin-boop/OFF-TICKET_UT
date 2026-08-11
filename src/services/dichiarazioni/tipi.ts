/**
 * Vocabolario delle "dichiarazioni": i tre ruoli assegnabili manualmente alle pagine
 * caricate dall'utente (parti 1-3), nell'ordine in cui compaiono nel PDF finale.
 */
export type RuoloDichiarazione = 'BOLLO' | 'ATTESTAZIONE' | 'DOC_IDENTITA_UTILIZZATORE'

export const ORDINE_RUOLI: RuoloDichiarazione[] = ['BOLLO', 'ATTESTAZIONE', 'DOC_IDENTITA_UTILIZZATORE']

export const RUOLO_LABELS: Record<RuoloDichiarazione, string> = {
  BOLLO: 'Dichiarazione marca da bollo',
  ATTESTAZIONE: 'Attestazione',
  DOC_IDENTITA_UTILIZZATORE: 'Documento d’identità dell’utilizzatore',
}

/** Assegnazione di una pagina di un file sorgente a un ruolo, con la sua posizione nel ruolo. */
export interface AssegnazionePagina {
  pagina: number
  ruolo: RuoloDichiarazione | null
  ordine: number
}

/** Un file sorgente caricato dall'utente: una o più pagine, ciascuna assegnabile a un ruolo. */
export interface DocumentoSorgenteDichiarazione {
  id: string
  nome: string
  peso: number
  mime?: string | null
  filePath: string
  nPagine: number | null
  assegnazioni: AssegnazionePagina[]
}

/** Il documento d'identità dell'installatore quando sostituisce il predefinito per la pratica. */
export interface DocumentoOverrideInstallatore {
  id: string
  nome: string
  peso: number
  mime?: string | null
  filePath: string
}

/** Il PDF a 5 parti già composto e salvato. */
export interface DocumentoFinaleDichiarazioni {
  id: string
  nome: string
  peso: number
  mime?: string | null
  filePath: string
}
