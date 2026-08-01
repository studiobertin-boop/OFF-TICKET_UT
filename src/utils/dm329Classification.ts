/**
 * Classificazione DM 329/2004 — sorgente di verità unica per le soglie.
 *
 * Tutta la combinatoria di prosa delle vecchie relazioni nasceva dal fatto che lo
 * stesso verdetto giuridico veniva riscritto a parole in ogni sezione. Qui il verdetto
 * si calcola una volta sola e diventa un dato: la tabella degli esiti, i riferimenti
 * normativi e le scadenze di riqualificazione derivano tutti da `EsitoDM329`.
 *
 * `determineTipoPratica` (CIVA) è un adattatore su questa logica: il comportamento
 * osservabile per i chiamanti CIVA è invariato.
 */
import type { CategoriaPED } from '@/types/technicalSheet'
import type { TipoPraticaCIVA } from '@/types/civa'

export type EsitoDM329 =
  /** V < 25 l — escluso ex art. 2 comma i */
  | 'ESCLUSO_VOLUME'
  /** Compressore privo di recipienti in pressione (tipicamente a pistoni) — art. 2 comma i */
  | 'ESCLUSO_NO_RECIPIENTE'
  /** 25 ≤ V < 50 l con PS < 12 bar — nessun adempimento */
  | 'SOTTO_SOGLIA'
  /** V ≥ 50 l, PS ≤ 12 bar, PS×V ≤ 8000 — art. 5 comma 1 lettera c */
  | 'DICHIARAZIONE'
  /** PS×V > 8000, oppure V > 25 l con PS > 12 bar — artt. 4 e 5 */
  | 'VERIFICA'
  /** Compressore in quanto tale — art. 1 comma 3 lettera L D.lgs. 93/2000 */
  | 'ESCLUSO_COMPRESSORE'
  /** Tubazione con DN ≤ 80 mm — art. 3 comma bb */
  | 'ESCLUSO_TUBAZIONE'

/** Diametro nominale oltre il quale le tubazioni rientrano nel campo di applicazione. */
export const DN_SOGLIA_ESCLUSIONE = 80

/** Prodotto PS×V oltre il quale scatta la verifica di messa in servizio. */
export const PSV_SOGLIA_VERIFICA = 8000

/**
 * Classifica un recipiente in pressione a partire da volume e pressione massima
 * ammissibile.
 *
 * Restituisce `null` quando i dati non bastano a decidere: chi consuma il risultato
 * deve distinguere "non classificabile" da "escluso", altrimenti un recipiente con
 * dati mancanti finirebbe silenziosamente fra gli esclusi.
 */
export function classificaRecipiente(
  volume: number | undefined | null,
  ps: number | undefined | null
): EsitoDM329 | null {
  if (!volume || !ps || volume <= 0 || ps <= 0) {
    return null
  }
  if (volume < 25) {
    return 'ESCLUSO_VOLUME'
  }
  if (volume < 50 && ps < 12) {
    return 'SOTTO_SOGLIA'
  }
  if (volume >= 50 && ps <= 12) {
    return ps * volume <= PSV_SOGLIA_VERIFICA ? 'DICHIARAZIONE' : 'VERIFICA'
  }
  if (volume > 25 && ps > 12) {
    return 'VERIFICA'
  }
  // Residuo: 25 ≤ V < 50 con PS ≥ 12 (es. V=30, PS=12). Nessun adempimento previsto.
  return 'SOTTO_SOGLIA'
}

/**
 * Classifica il compressore in quanto apparecchiatura. I compressori sono sempre
 * esclusi dal DM 329/2004; cambia il motivo — e quindi il riferimento normativo —
 * a seconda che abbiano o meno un recipiente in pressione a servizio.
 *
 * I compressori a pistoni non hanno serbatoio disoleatore: sono privi di recipienti.
 * Quelli a vite possono avere un disoleatore, classificato a parte.
 */
export function classificaCompressore(haRecipienteInPressione: boolean): EsitoDM329 {
  return haRecipienteInPressione ? 'ESCLUSO_COMPRESSORE' : 'ESCLUSO_NO_RECIPIENTE'
}

/**
 * Classifica le tubazioni in base al diametro nominale massimo dichiarato (in mm).
 * Oltre la soglia le tubazioni rientrano nel campo di applicazione e vanno denunciate.
 */
export function classificaTubazioni(dnMassimo: number | undefined | null): EsitoDM329 | null {
  if (dnMassimo === undefined || dnMassimo === null || dnMassimo <= 0) {
    return null
  }
  return dnMassimo <= DN_SOGLIA_ESCLUSIONE ? 'ESCLUSO_TUBAZIONE' : 'VERIFICA'
}

/** True se l'esito comporta un adempimento verso INAIL/ASL. */
export function comportaAdempimento(esito: EsitoDM329 | null): boolean {
  return esito === 'DICHIARAZIONE' || esito === 'VERIFICA'
}

/**
 * Frequenze di riqualificazione periodica (Allegato B, recipienti per gas del gruppo 2).
 * La verifica di integrità è decennale per tutte le categorie.
 *
 * Nessuna eccezione per i recipienti zincati: la deroga suggerita dalle guide dei
 * fabbricanti non ha base nel testo del decreto.
 */
export function frequenzeRiqualificazione(
  categoria: CategoriaPED | undefined
): { funzionamentoAnni: number; integritaAnni: number } | null {
  if (!categoria) return null
  const funzionamentoAnni = categoria === 'III' || categoria === 'IV' ? 3 : 4
  return { funzionamentoAnni, integritaAnni: 10 }
}

/** Adattatore per i chiamanti CIVA: mappa l'esito sui tre valori storici. */
export function esitoToTipoPratica(esito: EsitoDM329 | null): TipoPraticaCIVA {
  if (esito === 'DICHIARAZIONE') return 'DICHIARAZIONE'
  if (esito === 'VERIFICA') return 'VERIFICA'
  return 'NESSUNA'
}
