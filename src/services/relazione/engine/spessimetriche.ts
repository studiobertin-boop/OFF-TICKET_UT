/**
 * Engine — §7.2 CAPOVERSO SULLE VERIFICHE DI INTEGRITÀ GIÀ EFFETTUATE.
 *
 * Chiude la sezione della riqualificazione periodica nominando le apparecchiature che
 * hanno già superato il controllo ultrasonoro spessimetrico. §1 lo annuncia in generale;
 * qui il documento dice di chi si tratta, e senza nessuno da nominare il capoverso non
 * viene stampato affatto.
 *
 * Le posizioni sono quelle dichiarate nel form, ristrette a quelle che compaiono in §5.2:
 * è lì che il lettore le ritrova, con la spunta nella colonna «Verifica Integrità». La
 * spunta è consolidata sul capogruppo e la cella è fusa sull'intero gruppo, quindi copre
 * anche il recipiente che la verifica l'ha effettivamente subìta — ed è quello che si
 * nomina qui, non il compressore che lo porta.
 */
import type { AdditionalInfo, EsitoRow, SpessimetricheModel } from '../types'
import { joinConLaE } from '../helpers'

export function buildSpessimetriche(
  esiti: EsitoRow[],
  additionalInfo: AdditionalInfo
): SpessimetricheModel {
  const dichiarate = new Set(additionalInfo.spessimetrica ?? [])

  // Si filtra sugli esiti invece di riportare la selezione così com'è: una posizione che
  // in §5.2 non c'è non ha spunta da nessuna parte, e il rimando alla tabella sarebbe
  // falso. L'ordine è quello della tabella — due elenchi delle stesse apparecchiature
  // in ordine diverso si leggono come due elenchi diversi.
  const posizioni = esiti.filter((e) => dichiarate.has(e.pos)).map((e) => e.pos)

  if (posizioni.length === 0) return { presenti: false, clausola: '' }

  return {
    presenti: true,
    clausola:
      posizioni.length === 1
        ? `l’apparecchiatura ${posizioni[0]} è stata sottoposta`
        : `le apparecchiature ${joinConLaE(posizioni)} sono state sottoposte`,
  }
}
