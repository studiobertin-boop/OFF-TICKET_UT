/**
 * Il by-pass: dove vanno le giunzioni sulla linea di processo, e quali ponti le uniscono.
 *
 * Sta in un modulo suo e non dentro `buildArchi` perché è una trasformazione di SEQUENZA con
 * invarianti proprie — contiguità, id stabili, un TEE per confine, corsie che non si accavallano —
 * che si collauda senza costruire un impianto intero. La geometria non c'è: qui si decide *chi* sta
 * *dove nell'ordine*, non a quale ascissa (`layout.ts`) né con che forma (`tratti.ts`).
 *
 * Il modulo non si fida del chiamante. `risolviPreferenze` (preferenze.ts) scarta già i gruppi non
 * contigui, ma la contiguità è la condizione che rende un by-pass DISEGNABILE con due soli TEE:
 * chi la viola qui non ottiene un disegno approssimato, non ottiene nulla.
 *
 * Stessa ragione per l'annidamento e la sovrapposizione fra gruppi, di cui le corsie qui sotto si
 * occupano: **dal pannello non si ottengono** — `selezioneLibera` (PannelloPreferenzeSchema.tsx)
 * spegne «Crea by-pass» appena una riga selezionata appartiene già a un gruppo. Ci si arriva solo
 * scrivendo a mano in `additional_info`, e da lì deve uscire un disegno leggibile invece che un
 * ponte appeso sopra a quello che lo contiene.
 */
import type { SchemaNodo } from './types'

/** Il ponte di un gruppo: i due capi e la corsia orizzontale su cui corre. */
export interface PonteBypass {
  /** L'id del gruppo nelle preferenze (`bp1`). */
  gruppo: string
  /** Id del nodo giunzione di monte (`BP1-IN`). */
  inizio: string
  /** Id del nodo giunzione di valle (`BP1-OUT`). */
  fine: string
  /** 0 = la corsia più bassa, subito sopra la linea di processo. Sale solo per non accavallarsi. */
  corsia: number
}

/**
 * Gli id dei due TEE di un gruppo. Si ricavano dall'**id del gruppo**, non dagli stadi scavalcati:
 * quelli sarebbero instabili — riordinare le righe in finestra cambierebbe l'id, e il layout
 * salvato perderebbe il TEE al primo riordino.
 *
 * `BP` non collide con i prefissi dei codici di scheda (`S`, `C`, `E`, `F`, `SEP`), con gli id
 * riservati (`UTENZE`, `T`, `RC`) né col `M-` dei nodi manuali. Un test lo fissa, così il giorno
 * che nasce un prefisso `B` in scheda qualcuno se ne accorge.
 */
export function idTeeBypass(gruppo: string): { inizio: string; fine: string } {
  const numero = /^bp(\d+)$/.exec(gruppo)?.[1] ?? gruppo.toUpperCase()
  return { inizio: `BP${numero}-IN`, fine: `BP${numero}-OUT` }
}

/** Vero per gli id che `idTeeBypass` produce: serve a chi deve riconoscere un TEE senza avere in
 *  mano le preferenze (gli avvisi della riconciliazione). */
export function eTeeBypass(id: string): boolean {
  return /^BP\d+-(IN|OUT)$/.test(id)
}

/** Vero per il capo di MONTE di un by-pass (`BP1-IN`). Dal Blocco 5 i due capi non stanno piu'
 *  alla stessa quota — quello di monte sale a quella dell'uscita del serbatoio, quello di valle
 *  resta sulla linea — e chi dispone la sequenza deve distinguerli avendo in mano il solo id. */
export function eCapoDiMonte(id: string): boolean {
  return /^BP\d+-IN$/.test(id)
}

/** Il capo di valle che fa coppia con un capo di monte: `BP1-IN` → `BP1-OUT`. Serve ad accoppiarli
 *  nella sequenza per sapere quale intervallo scavalca il ponte, cioe' su che corsia corre. */
export function capoDiValleDi(idMonte: string): string {
  return idMonte.replace(/-IN$/, '-OUT')
}

/**
 * Il nodo giunzione di un TEE di by-pass.
 *
 * **Origine `'scheda'`**, come il terminale `UTENZE`: viene da una decisione registrata nelle
 * preferenze e ricostruibile da lì. `'manuale'` lo renderebbe indistruttibile — la riconciliazione
 * non tocca i nodi manuali — e sciogliere un gruppo lascerebbe due TEE orfani su ogni disegno
 * riaperto.
 */
export function nodoGiunzioneBypass(id: string): SchemaNodo {
  return {
    id,
    tipo: 'giunzione',
    // Non compare da nessuna parte (la giunzione non entra né in lista né in legenda), ma il
    // campo è obbligatorio e un'etichetta vuota si legge male in un dump di debug.
    etichetta: id,
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    origine: 'scheda',
  }
}

/**
 * Le corsie di una serie di intervalli, in modo che due che si sovrappongono non finiscano sulla
 * stessa. Gli intervalli sono estremi compresi, in qualunque unità: posizioni della catena quando
 * si linearizza, ascisse del disegno quando si tracciano i ponti sul layout.
 *
 * La corsia si **riusa** appena si libera invece di crescere con l'indice del gruppo: nel caso
 * normale i gruppi sono disgiunti, e impilare i ponti a quote diverse sarebbe uno scalino nel
 * disegno che nulla giustifica.
 */
export function corsieDeiPonti(intervalli: { inizio: number; fine: number }[]): number[] {
  const corsie: number[] = []
  for (const [i, corrente] of intervalli.entries()) {
    const occupate = new Set(
      intervalli
        .slice(0, i)
        .map((altro, j) => (altro.inizio <= corrente.fine && corrente.inizio <= altro.fine ? corsie[j] : -1))
        .filter((c) => c >= 0)
    )
    let corsia = 0
    while (occupate.has(corsia)) corsia++
    corsie.push(corsia)
  }
  return corsie
}

/**
 * Le corsie nell'ordine in cui gli intervalli arrivano, assegnandole però dal ponte più **corto**
 * al più lungo: con due gruppi annidati è quello interno a dover correre in basso, e quello
 * esterno a scavalcarlo. Assegnandole nell'ordine di arrivo vincerebbe il più a sinistra — e con
 * l'esterno che comincia prima si otterrebbe l'annidamento rovesciato, il ponte contenuto appeso
 * sopra a quello che lo contiene.
 *
 * La usano in due: `linearizzaConBypass` sulle posizioni della catena, e `risolviPonti`
 * (`segniAncorati.ts`) sulle ascisse del disegno. Devono dare la stessa risposta, e la danno
 * perché è la stessa funzione.
 */
export function assegnaCorsie(intervalli: { inizio: number; fine: number }[]): number[] {
  const perLarghezza = intervalli
    .map((intervallo, i) => ({ intervallo, i }))
    .sort(
      (a, b) =>
        a.intervallo.fine - a.intervallo.inizio - (b.intervallo.fine - b.intervallo.inizio) || a.i - b.i
    )
  const assegnate = corsieDeiPonti(perLarghezza.map((v) => v.intervallo))
  const corsie: number[] = []
  for (const [k, v] of perLarghezza.entries()) corsie[v.i] = assegnate[k]
  return corsie
}

/**
 * La catena di trattamento con le giunzioni al posto giusto, più i ponti da tracciare.
 *
 * I gruppi si trattano nell'ordine della CATENA, non in quello in cui sono salvati: l'operatore può
 * aver riordinato le righe dopo aver creato i gruppi, e il disegno segue l'ordine di adesso.
 *
 * Un gruppo cade — in silenzio, senza sequenza e senza ponte — se è vuoto, se nomina stadi che la
 * catena non contiene, o se i suoi membri non occupano posizioni **consecutive**. Vedi la nota in
 * testa al modulo sul perché non si aggiusta.
 */
export function linearizzaConBypass(
  catena: SchemaNodo[],
  gruppi: { id: string; stadi: string[] }[]
): { sequenza: SchemaNodo[]; ponti: PonteBypass[] } {
  const posizione = new Map(catena.map((n, i) => [n.id, i]))

  const validi = gruppi
    .map((gruppo) => {
      const posizioni = [...new Set(gruppo.stadi)].map((id) => posizione.get(id))
      if (posizioni.length === 0 || posizioni.some((p) => p === undefined)) return null
      const numeri = posizioni as number[]
      const inizio = Math.min(...numeri)
      const fine = Math.max(...numeri)
      // Contiguità: tante posizioni distinte quante ne copre l'intervallo che le contiene.
      if (fine - inizio + 1 !== numeri.length) return null
      return { gruppo: gruppo.id, inizio, fine }
    })
    .filter((g): g is { gruppo: string; inizio: number; fine: number } => g !== null)
    .sort((a, b) => a.inizio - b.inizio || a.fine - b.fine)

  const corsie = assegnaCorsie(validi)

  const ponti: PonteBypass[] = validi.map((g, i) => {
    const { inizio, fine } = idTeeBypass(g.gruppo)
    return { gruppo: g.gruppo, inizio, fine, corsia: corsie[i] }
  })

  // Le giunzioni si posano per POSIZIONE, non inserendole una alla volta in un array che si
  // allunga: inserire sposterebbe gli indici dei gruppi successivi, e con due gruppi il secondo
  // finirebbe di un posto più in là a ogni TEE già messo.
  const prima = new Map<number, string[]>()
  const dopo = new Map<number, string[]>()
  for (const [i, g] of validi.entries()) {
    prima.set(g.inizio, [...(prima.get(g.inizio) ?? []), ponti[i].inizio])
    dopo.set(g.fine, [...(dopo.get(g.fine) ?? []), ponti[i].fine])
  }

  const sequenza: SchemaNodo[] = []
  for (const [i, stadio] of catena.entries()) {
    for (const id of prima.get(i) ?? []) sequenza.push(nodoGiunzioneBypass(id))
    sequenza.push(stadio)
    // I TEE di valle si posano in ordine inverso rispetto a quelli di monte: con due gruppi
    // annidati sullo stesso stadio, il ponte interno si chiude prima di quello esterno.
    for (const id of [...(dopo.get(i) ?? [])].reverse()) sequenza.push(nodoGiunzioneBypass(id))
  }

  return { sequenza, ponti }
}
