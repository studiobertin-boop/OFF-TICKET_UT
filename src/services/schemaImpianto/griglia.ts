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
  const risultato = Math.round(valore / PASSO_GRIGLIA) * PASSO_GRIGLIA
  // Math.round(-0.4) è -0: per ogni valore in [-5, 0) il risultato "matematico" è -0, che
  // supera qualunque confronto numerico ma fallisce `toBe` (Object.is distingue -0 da 0).
  // -0 non ha senso per una coordinata dell'editor, quindi si normalizza qui una volta sola,
  // invece di lasciare che la trappola scatti in un chiamante lontano da questa causa.
  return risultato === 0 ? 0 : risultato
}

/**
 * Porta `valore` sulla posizione buona più vicina, dove le posizioni buone sono i punti
 * della griglia PIÙ le `quotePreferite` — tipicamente le quote dei due capi di un tubo.
 *
 * Serve perché una quota di capo può cadere fuori griglia: un tubo che parte da quota 260 e
 * arriva a quota 234 non può essere raccordato da alcun punto della griglia, e agganciare solo
 * alla griglia peggiora il disegno invece di migliorarlo — misurato in pagina su una tubazione
 * reale, produce tre scalini invece di uno.
 *
 * Dal Task 8 (Blocco 3) le ANCORE dei simboli sono tutte sui multipli del passo, e questa
 * funzione serve ancora lo stesso: la quota di un capo è la posizione del suo nodo PIÙ l'ancora,
 * e le posizioni dei nodi sulla tela non sono agganciate a nulla — l'auto-layout le calcola dalle
 * proporzioni dei simboli, il committente le trascina dove vuole. Non è quindi un ripiego in
 * attesa che qualcuno sistemi le ancore: le due famiglie di candidati non coincideranno mai
 * finché una posizione può stare fra due punti di griglia.
 *
 * Nessun raggio di tolleranza da tarare: una quota preferita vince sul punto di griglia se
 * e solo se non è più lontana di esso da `valore`. Poiché il punto di griglia più vicino
 * dista al più 5 (metà passo), una quota preferita a più di 5 non vince mai — quella soglia
 * non è un parametro scelto, è un tetto che discende dalla geometria della griglia. A
 * parità vince la quota preferita, perché in quel caso il punto di griglia non aggiunge
 * nulla mentre lei tiene dritta la linea; fra più quote preferite vince la più vicina.
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
