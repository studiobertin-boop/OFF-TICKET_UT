/**
 * Inserire un TEE su un tubo esistente: le due funzioni pure sotto il gesto (osservazione 5
 * del committente). Il gesto vero — trascinare il simbolo, evidenziare il tubo sotto,
 * rilasciare — sta in `useInserimentoTee.ts`, fra i componenti; qui c'è solo la geometria,
 * che si collauda senza DOM.
 *
 * Sta fra i servizi e non fra i componenti per la stessa ragione di `griglia.ts`: un calcolo
 * dentro un componente è un calcolo che nessuno prova.
 */
import { puntoSuTratto, quoteDeiVertici, tSuTratto, type Punto } from './tratti'
import type { SchemaSegnoTubo } from './types'

/**
 * Quanto lontano dal tubo può cadere il centro del TEE perché il rilascio lo spezzi, in unità
 * del disegno. Senza soglia, QUALUNQUE rilascio spezzerebbe il tubo meno lontano della tela,
 * anche a mezzo disegno di distanza; e il tubo candidato si evidenzia mentre lo si sorvola,
 * quindi l'utente sa già in anticipo che cosa succederà.
 */
export const TOLLERANZA_INSERIMENTO = 20

/**
 * L'arco più vicino a `punto`, se ce n'è uno entro `tolleranza`; `null` altrimenti. A parità
 * di distanza vince il primo dell'elenco: un pareggio esatto fra due tubi è una coincidenza
 * senza una risposta migliore dell'altra, e sceglierne una qualunque è meglio che non
 * spezzare nulla.
 *
 * La distanza si ricava da `tSuTratto` + `puntoSuTratto` (tratti.ts) invece che da una formula
 * scritta qui: la proiezione punto-segmento esiste già in due copie nel repo, e una terza
 * sarebbe la terza definizione della stessa cosa in un modulo che ha già pagato per averne
 * avute due.
 */
export function arcoPiuVicino(
  archi: { id: string; polilinea: Punto[] }[],
  punto: Punto,
  tolleranza: number = TOLLERANZA_INSERIMENTO
): string | null {
  let migliore: { id: string; distanza: number } | null = null
  for (const arco of archi) {
    if (arco.polilinea.length < 2) continue
    const proiezione = puntoSuTratto(arco.polilinea, tSuTratto(arco.polilinea, punto)).punto
    const distanza = Math.hypot(punto.x - proiezione.x, punto.y - proiezione.y)
    if (!migliore || distanza < migliore.distanza) migliore = { id: arco.id, distanza }
  }
  return migliore && migliore.distanza <= tolleranza ? migliore.id : null
}

/** Una delle due metà di un arco spezzato: la sua rotta e i segni che le sono toccati. */
export interface MetaArco {
  /**
   * Gomiti che fissano la forma della metà, in coordinate assolute. **Mai vuoto**: vedi
   * `fissaLaForma` qui sotto.
   */
  punti: Punto[]
  segni: SchemaSegnoTubo[]
}

/**
 * Spezza un arco nel punto della sua polilinea più vicino a `puntoLibero` — dove il committente
 * ha rilasciato il TEE. Restituisce anche quel punto (`centro`): è lì che va ricentrata la
 * giunzione, così le due metà si incontrano esattamente sul tubo. E restituisce l'asse del
 * tratto tagliato (`orizzontale`, la stessa proiezione di `puntoSuTratto` che ha già calcolato
 * `centro`): decide da che lato le due metà imboccano la giunzione (`useInserimentoTee.ts`).
 *
 * Conserva ciò che è stato fatto a mano: i gomiti e i segni vanno alla metà su cui cadono
 * geometricamente. Lo stile non compare qui perché non si divide — il chiamante lo copia
 * identico su entrambe.
 */
export function spezzaArco(
  polilinea: Punto[],
  segni: SchemaSegnoTubo[],
  puntoLibero: Punto
): { centro: Punto; orizzontale: boolean; primo: MetaArco; secondo: MetaArco } {
  const tTaglio = tSuTratto(polilinea, puntoLibero)
  const { punto: centro, orizzontale } = puntoSuTratto(polilinea, tTaglio)
  const ts = quoteDeiVertici(polilinea)
  const interni = polilinea.slice(1, -1).map((p, i) => ({ p, t: ts[i + 1] }))

  return {
    centro,
    orizzontale,
    primo: {
      punti: fissaLaForma(polilinea[0], interni.filter((v) => v.t < tTaglio).map((v) => v.p), centro),
      segni: tTaglio <= 0 ? [] : segni.filter((s) => s.t <= tTaglio).map((s) => ({ ...s, t: s.t / tTaglio })),
    },
    secondo: {
      punti: fissaLaForma(centro, interni.filter((v) => v.t > tTaglio).map((v) => v.p), polilinea[polilinea.length - 1]),
      segni:
        tTaglio <= 0
          ? segni.map((s) => ({ ...s }))
          : tTaglio >= 1
            ? []
            : segni.filter((s) => s.t > tTaglio).map((s) => ({ ...s, t: (s.t - tTaglio) / (1 - tTaglio) })),
    },
  }
}

/**
 * I gomiti che fissano la forma di una metà. **Mai vuoti**: `instrada` (tratti.ts) ignora la
 * rotta nativa dello stile solo quando i gomiti non lo sono, ma ogni metà ha una giunzione a un
 * capo — quindi un lato sempre imposto — e con `punti: []` prenderebbe comunque la rotta
 * IMBOCCATA (`rottaImboccata`, tratti.ts), mai quella nativa: una forma diversa, in generale, da
 * quella su cui il committente ha appena posato il TEE.
 *
 * Quando fra i due capi non cade nessun vertice il tratto è dritto per costruzione — il taglio
 * è caduto dentro un segmento — e basta un gomito nel punto medio: sta esattamente sulla
 * linea, quindi la forma disegnata non cambia, e la fissa.
 */
function fissaLaForma(da: Punto, gomiti: Punto[], a: Punto): Punto[] {
  if (gomiti.length > 0) return gomiti
  return [{ x: (da.x + a.x) / 2, y: (da.y + a.y) / 2 }]
}

/**
 * I due identificativi per le metà di `base`, scelti fra quelli non ancora presi. Parlanti
 * come quelli che sostituiscono (`std-3` → `std-3-a`, `std-3-b`), e unici: due archi con lo
 * stesso id sulla tela ne farebbero rendere uno solo a react-flow, e il layout salvato
 * perderebbe l'altro in silenzio.
 */
export function idDelleMeta(base: string, esistenti: Set<string>): [string, string] {
  const presi = new Set(esistenti)
  const libero = (suffisso: string): string => {
    let candidato = `${base}-${suffisso}`
    for (let i = 2; presi.has(candidato); i++) candidato = `${base}-${suffisso}${i}`
    presi.add(candidato)
    return candidato
  }
  return [libero('a'), libero('b')]
}
