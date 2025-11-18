/**
 * Hook per gestire la visibilità condizionale dei campi tecnici avanzati
 * nella SCHEDA DATI DM329 in base al ruolo utente.
 *
 * LOGICA:
 * - tecnicoDM329: NON vede campi tecnici avanzati (PS, TS, Categoria PED, Volume, Modello serbatoi, etc.)
 * - admin, userdm329: VEDONO tutti i campi
 *
 * CAMPI NASCOSTI A tecnicoDM329:
 * - Serbatoi: modello, ps_pressione_max, ts_temperatura, categoria_ped
 * - Compressori: volume_aria_prodotto
 * - Disoleatori: ps_pressione_max, ts_temperatura, categoria_ped
 * - Valvole Sicurezza: ts_temperatura, volume_aria_scaricato, categoria_ped
 * - Essiccatori: ps_pressione_max, volume_aria_trattata
 * - Scambiatori: ps_pressione_max, ts_temperatura, volume
 * - Recipienti Filtro: TUTTI i campi (intera sezione nascosta)
 */

import { useAuth } from './useAuth'

export interface TecnicoDM329Visibility {
  /**
   * Se true, mostra campi avanzati (PS, TS, Categoria PED, Volume, etc.)
   * Se false, nasconde campi (utente tecnicoDM329)
   */
  showAdvancedFields: boolean

  /**
   * Se true, mostra l'intera sezione Recipiente Filtro
   * Se false, nasconde completamente la sezione (utente tecnicoDM329)
   */
  showRecipienteFiltro: boolean

  /**
   * Flag diretto per verificare se l'utente è tecnicoDM329
   */
  isTecnicoDM329: boolean
}

/**
 * Hook che determina quali campi mostrare/nascondere in base al ruolo utente
 *
 * @returns {TecnicoDM329Visibility} Oggetto con flag di visibilità
 *
 * @example
 * ```tsx
 * const { showAdvancedFields, showRecipienteFiltro } = useTecnicoDM329Visibility()
 *
 * return (
 *   <>
 *     <TextField label="Marca" {...} /> // Sempre visibile
 *
 *     {showAdvancedFields && (
 *       <TextField label="PS (bar)" {...} /> // Nascosto a tecnicoDM329
 *     )}
 *
 *     {showRecipienteFiltro && (
 *       <RecipienteFiltroFields {...} /> // Intera sezione nascosta a tecnicoDM329
 *     )}
 *   </>
 * )
 * ```
 */
export const useTecnicoDM329Visibility = (): TecnicoDM329Visibility => {
  const { isTecnicoDM329 } = useAuth()

  return {
    // tecnicoDM329 NON vede campi avanzati
    showAdvancedFields: !isTecnicoDM329,

    // tecnicoDM329 NON vede recipienti filtro
    showRecipienteFiltro: !isTecnicoDM329,

    // Flag diretto
    isTecnicoDM329,
  }
}
