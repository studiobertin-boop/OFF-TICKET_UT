import type { UserRole } from '@/types'

/**
 * Ruoli che hanno davvero una policy di SELECT su `request_history`.
 *
 * Serve perché una lettura negata non si distingue da una tabella vuota: `authenticated` ha
 * comunque il GRANT di tabella, quindi Postgres applica l'RLS filtrando le righe in silenzio e
 * la query torna `data: null, error: null`. Chi si limita a controllare `error` crede di avere
 * letto «nessun cambio di stato» e ne ricava una data sbagliata.
 *
 * È un elenco di ammessi e non di esclusi apposta. Il difetto da evitare non è quello di oggi —
 * `tecnicoDM329`, l'unico ruolo senza policy — ma quello di domani: un ruolo nuovo introdotto
 * senza la sua policy passerebbe inosservato in un elenco di esclusi, mentre qui cade fuori da
 * solo e il chiamante non mostra alcuna data invece di mostrarne una falsa.
 *
 * Policy corrispondenti in produzione (verificate 11-08-2026):
 * `Admin can view all history`, `Tecnico can view assigned request history`,
 * `Utente can view own request history`, `userdm329 can view DM329 request history`,
 * `userdm329 can view DM329-Integrazioni request history`.
 *
 * Ogni ruolo aggiunto qui va aggiunto anche là, e viceversa.
 */
const RUOLI_CON_POLICY_SU_STORIA: readonly UserRole[] = ['admin', 'tecnico', 'utente', 'userdm329']

/**
 * Dice se per questo ruolo una lettura di `request_history` è interpretabile.
 *
 * «Interpretabile» non vuol dire «vede tutto»: un tecnico legge solo le pratiche che gli sono
 * assegnate. Vuol dire che un risultato vuoto significa davvero «nessuna riga» e non «righe che
 * non ti sono state mostrate», e quindi ci si può ragionare sopra.
 */
export const puoLeggereStoriaPratica = (ruolo: UserRole | null | undefined): boolean =>
  Boolean(ruolo) && RUOLI_CON_POLICY_SU_STORIA.includes(ruolo as UserRole)
