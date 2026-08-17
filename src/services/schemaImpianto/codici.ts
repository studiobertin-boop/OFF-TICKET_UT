/**
 * Il codice che l'utente vede sotto ogni apparecchiatura, e le regole per sceglierne uno a mano.
 *
 * Vive in un file di servizio e non dentro `SchemaEditor.tsx` per due ragioni che tirano nella
 * stessa direzione: è logica pura, quindi provabile, mentre il componente non si prova (CLAUDE.md:
 * nessun test di interfaccia); ed esportare una funzione da un file di componente fa scattare
 * `react-refresh` sul lint, che qui gira a zero warning. `codiceLibero` sta ancora in
 * SchemaEditor.tsx per ragioni storiche ed è l'eccezione, non il modello.
 */
import type { SchemaNodo } from './types'

/**
 * Quanti caratteri può avere un codice scritto a mano. Il codice è disegnato DENTRO il simbolo a
 * corpo fisso (24px sui simboli grandi, 14px sul pacco bombole): più lungo esce dal riquadro, e
 * nessun test se ne accorgerebbe — si vedrebbe solo nel documento consegnato. Sei è la lunghezza
 * del codice d'ufficio più lungo di oggi, `M-SEP1`, e il limite l'ha fissato il committente.
 *
 * Vale SOLO su ciò che si scrive a mano: l'identificativo generato da `codiceLibero` non passa di
 * qui, e un ipotetico `M-SEP10` resta legittimo com'era.
 */
export const LUNGHEZZA_MASSIMA_CODICE = 6

/**
 * Il codice da mostrare: quello scritto a mano se c'è, altrimenti l'identificativo — che per i
 * nodi di scheda È il codice di scheda (C1, S1, ...) e per i manuali è quello d'ufficio (M-S1).
 * Il ripiego non è una cortesia: ogni layout salvato prima del 17-08-2026 non ha il campo.
 */
export function codiceVisibile(nodo: Pick<SchemaNodo, 'id' | 'codice'>): string {
  return nodo.codice ?? nodo.id
}

/**
 * Tutto ciò che occupa già un codice sul disegno o in tabella. Non solo i nodi: `righeLista`
 * (renderSvg.ts) stampa una riga anche per l'accessorio dipendente e una per ogni valvola di
 * sicurezza — quelle del nodo e quelle dell'accessorio — e due righe con lo stesso codice sono
 * peggio del codice d'ufficio che questo fix esiste per sostituire.
 *
 * Di ogni nodo contano ENTRAMBI i codici, l'identificativo e quello a mano: restano visibili tutti
 * e due, il primo finché nessuno rinomina, il secondo da lì in poi.
 *
 * `escluso` è l'identificativo del nodo in modifica: senza, il suo stesso codice risulterebbe
 * occupato e non si potrebbe più confermare il dialogo lasciandolo com'è.
 */
export function codiciOccupati(nodi: SchemaNodo[], escluso?: string): Set<string> {
  const occupati = new Set<string>()
  for (const nodo of nodi) {
    if (nodo.id !== escluso) {
      occupati.add(nodo.id)
      if (nodo.codice) occupati.add(nodo.codice)
    }
    // Accessori e valvole restano occupati anche sul nodo in modifica: un'apparecchiatura non può
    // chiamarsi come la propria valvola di sicurezza.
    for (const v of nodo.valvoleSicurezza) occupati.add(v.codice)
    if (nodo.accessorio) {
      occupati.add(nodo.accessorio.codice)
      for (const v of nodo.accessorio.valvoleSicurezza) occupati.add(v.codice)
    }
  }
  return occupati
}

/**
 * Perché un codice scritto a mano non si può accettare, già in italiano e pronto da mostrare sotto
 * il campo — oppure `null` se va bene.
 *
 * Restituisce la frase e non un booleano perché i tre rifiuti sono guasti diversi, e dirne uno per
 * l'altro manda a correggere la cosa sbagliata: chi ha scritto troppo lungo non deve andare a
 * cercare quale altra apparecchiatura gli ruba il codice.
 */
export function motivoRifiutoCodice(codice: string, nodi: SchemaNodo[], idNodo: string): string | null {
  const pulito = codice.trim()
  if (!pulito) return 'Serve un codice.'
  if (pulito.length > LUNGHEZZA_MASSIMA_CODICE)
    return `Al massimo ${LUNGHEZZA_MASSIMA_CODICE} caratteri: più lungo esce dal simbolo sul disegno.`
  if (codiciOccupati(nodi, idNodo).has(pulito)) return 'Questo codice è già usato.'
  return null
}
