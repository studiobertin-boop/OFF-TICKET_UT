/**
 * L'aritmetica della griglia dell'EDITOR. Il documento non aggancia nulla: le sue quote
 * nascono dall'auto-layout e dalle ancore dei simboli, e restano quelle. Qui si decide
 * soltanto dove finisce ciò che il committente piazza a mano.
 *
 * Sta fra i servizi e non fra i componenti perché il modulo non monta componenti React nei
 * test: un calcolo dentro un componente è un calcolo che nessuno prova.
 */

/** Stesso passo della griglia visibile e dello `snapGrid` di react-flow. */
export const PASSO_GRIGLIA = 10

export function allineaAllaGriglia(valore: number): number {
  return Math.round(valore / PASSO_GRIGLIA) * PASSO_GRIGLIA
}

/**
 * Porta `valore` sulla posizione buona più vicina, dove le posizioni buone sono i punti
 * della griglia PIÙ le `quotePreferite` — tipicamente le quote dei due capi di un tubo.
 *
 * Serve perché le ancore dei simboli sono ancora fuori griglia: un tubo che parte da quota
 * 260 e arriva a quota 234 non può essere raccordato da alcun punto della griglia, e
 * agganciare solo alla griglia peggiora il disegno invece di migliorarlo (produce uno
 * scalino in più invece di uno). Quando il committente porterà le ancore sui punti giusti,
 * le due famiglie di candidati coincideranno e questa funzione diventerà indistinguibile da
 * `allineaAllaGriglia`: non è un debito da disfare.
 *
 * Nessun raggio di tolleranza da tarare, e non è una svista: col passo a 10 la distanza dal
 * punto di griglia più vicino non supera mai 5, quindi una quota preferita vince se e solo
 * se dista meno di 5 — la soglia esiste già, implicita nella geometria. A parità vince la
 * quota preferita, perché il punto di griglia lì non aggiunge nulla mentre lei tiene dritta
 * la linea.
 */
export function agganciaQuota(valore: number, quotePreferite: number[]): number {
  let migliore = allineaAllaGriglia(valore)
  let distanzaMigliore = Math.abs(valore - migliore)
  for (const quota of quotePreferite) {
    const distanza = Math.abs(valore - quota)
    if (distanza <= distanzaMigliore) {
      migliore = quota
      distanzaMigliore = distanza
    }
  }
  return migliore
}
