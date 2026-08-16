import { normalizzaMarcaFamiglia } from './normalizzazione'

export interface Famiglia {
  /** Nome di comodo, usato solo nei messaggi e nei test. */
  famiglia: string
  /** Ragioni sociali, scritte **esattamente** come stanno a catalogo. */
  marche: string[]
}

/**
 * Ragioni sociali che appartengono allo stesso produttore.
 *
 * Un'azienda che cambia forma o denominazione lascia a catalogo righe sotto entrambi i
 * nomi, e lo stesso modello può stare sotto l'uno o sotto l'altro a seconda dell'anno di
 * fabbricazione. Per SICC la successione è leggibile dal nome; per CECCATO no —
 * `CECCATO ARIA COMPRESSA` e `A.ARIA C` non hanno un carattere in comune, e nessuna misura
 * di somiglianza potrà mai collegarle. Per questo la mappa è scritta a mano.
 *
 * Aggiungere una famiglia significa modificare questo file: è un evento raro, e passando
 * da qui resta tracciato in git accanto al test che ne verifica la coerenza col catalogo.
 */
export const FAMIGLIE_MARCHE: Famiglia[] = [
  { famiglia: 'SICC',    marche: ['SICC S.p.A.', 'SICC S.r.L.', 'SICC TECH s.r.l.', 'SICC TECH'] },
  { famiglia: 'CECCATO', marche: ['CECCATO ARIA COMPRESSA S.R.L.', 'A.ARIA C S.r.l. (ABAC)'] },
  { famiglia: 'FIAC',    marche: ['FIAC', 'FIAC AIR COMPRESSORS S.p.A.'] },
]

/**
 * Le ragioni sociali della famiglia cui appartiene `marca`, oppure `null`.
 *
 * Il confronto è al livello famiglia (forma societaria rimossa) e accetta il contenimento:
 * una targhetta che dice solo `SICC` risolve la famiglia perché `SICC` è il nome di
 * `SICC S.p.A.` ed è contenuto in `SICC TECH`. Si preferisce sempre la corrispondenza
 * esatta, così `FIAC` non viene attratto da una famiglia il cui nome lo contenga.
 *
 * Il contenimento vale però solo da tre caratteri in su. Sotto quella soglia il confine di
 * parola non basta a rendere significativo il prefisso: `A` è l'inizio legittimo di
 * `A ARIA C` (cioè `A.ARIA C S.r.l. (ABAC)`), e una targhetta ASTRA letta male come `A`
 * risolveva la famiglia CECCATO — con esito «certo» sul costruttore sbagliato, perché
 * decine di modelli ASTRA esistono identici anche sotto ABAC, stesse specs comprese, e
 * nessuna divergenza tecnica intercettava lo scambio. Le marche corte davvero in mappa
 * (`SICC`, `FIAC`) sono tutte di quattro caratteri e restano coperte.
 */
export function risolviFamiglia(marca: string): string[] | null {
  const cercata = normalizzaMarcaFamiglia(marca)
  if (!cercata) return null

  const normalizzate = FAMIGLIE_MARCHE.map((f) => ({
    marche: f.marche,
    nomi: f.marche.map(normalizzaMarcaFamiglia),
  }))

  const esatta = normalizzate.find((f) => f.nomi.includes(cercata))
  if (esatta) return esatta.marche

  const perContenimento = cercata.length >= 3
    ? normalizzate.find((f) =>
        f.nomi.some((n) => n.startsWith(`${cercata} `) || cercata.startsWith(`${n} `))
      )
    : undefined
  return perContenimento ? perContenimento.marche : null
}
