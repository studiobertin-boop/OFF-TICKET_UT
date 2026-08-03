import type { EquipmentCatalogItem, EquipmentCatalogType } from '@/types'
import {
  CANONICAL_SPECS,
  capacityKey,
  missingCanonicalSpecs,
  readNumericSpec,
  readSheetPressure,
  readVariantValue,
} from '@/services/equipmentAudit'

/**
 * Le varianti di un modello a catalogo: come si raggruppano e come si presentano.
 *
 * Logica pura, senza Supabase: `getVarianti` le passa le righe già caricate. È qui e non
 * nel servizio API perché è la parte che va verificata sui casi reali, e perché la stessa
 * presentazione serve al menu della colonna PS e all'avviso del pulsante «+».
 */

/** Una riga di catalogo come la vede la scheda dati. */
export interface VarianteCatalogo {
  /** Pressione che la scheda dichiara nella colonna PS/Ptar: la massima di targa. */
  value: number
  /** Valore che distingue la riga dalle sue sorelle — la chiave dell'indice unico. */
  variante: number
  item: EquipmentCatalogItem
}

/**
 * Raggruppa le righe di un modello in varianti, ordinate per pressione crescente.
 *
 * Il raggruppamento avviene sulla chiave di variante — `COALESCE(pressione_esercizio,
 * pressione_max)` sui compressori — la stessa dell'indice unico a database. Indicizzare
 * per la sola pressione di targa era più grossolano dell'indice: su KAESER SK 19, dove la
 * variante da 7,5 bar e quella da 10 dichiarano entrambe 11 di massima, una delle due
 * spariva e chi scriveva 11 nella colonna PS si prendeva 1855 o 1680 l/min a seconda
 * dell'ordine con cui il database restituiva le righe.
 *
 * Il catalogo contiene righe quasi-duplicate — stesso modello e stessa pressione, una con
 * la pressione di esercizio valorizzata e una senza — che condividono la chiave di
 * variante e continuano quindi a collassare: a parità si tiene quella con più dati tecnici
 * completi, così l'autocompilazione non ripiega su una riga monca.
 */
export function raggruppaVarianti(
  tipo: EquipmentCatalogType,
  rows: EquipmentCatalogItem[]
): VarianteCatalogo[] {
  const perVariante = new Map<number, VarianteCatalogo>()

  for (const item of rows) {
    const variante = readVariantValue(tipo, item.specs)
    const value = readSheetPressure(tipo, item.specs)
    if (variante === null || value === null) continue

    const presente = perVariante.get(variante)
    if (
      !presente ||
      missingCanonicalSpecs(tipo, item.specs).length <
        missingCanonicalSpecs(tipo, presente.item.specs).length
    ) {
      perVariante.set(variante, { value, variante, item })
    }
  }

  return [...perVariante.values()].sort((a, b) => a.value - b.value || a.variante - b.variante)
}

/**
 * Come la variante si presenta nel menu della colonna PS: pressione e capacità.
 *
 * La capacità non è decorazione: è ciò che distingue due varianti che dichiarano la stessa
 * pressione, e senza di essa il menu di SK 19 mostrerebbe due voci identiche.
 */
export function etichettaVariante(tipo: EquipmentCatalogType, v: VarianteCatalogo): string {
  const pressione = `${numeroIT(v.value)} bar`

  const chiave = capacityKey(tipo)
  const capacita = readNumericSpec(tipo, v.item.specs, chiave)
  if (capacita === null) return pressione

  const unita = (CANONICAL_SPECS[tipo] ?? []).find(d => d.key === chiave)?.unit
  return `${pressione} · ${numeroIT(capacita)}${unita ? ` ${unita}` : ''}`
}

export interface AvvisoVariante {
  titolo: string
  corpo: string
}

/**
 * Avviso da mostrare prima di aggiungere a catalogo una variante di un modello che c'è già.
 *
 * Il pulsante «+» compare in due casi che si somigliano ma non sono la stessa cosa: il
 * modello manca del tutto, e allora non c'è niente da segnalare, oppure c'è ad altre
 * pressioni, e allora chi sta per aggiungerne una deve sapere quali. Restituisce `null` nel
 * primo caso.
 */
export function testoAvvisoVariante(params: {
  marca: string
  modello: string
  /** Pressioni che le righe già a catalogo dichiarano alla scheda dati. */
  pressioniEsistenti: number[]
  /** Pressione della variante che si sta per creare; `null` se la colonna PS è vuota. */
  nuova: number | null
}): AvvisoVariante | null {
  const { marca, modello, pressioniEsistenti, nuova } = params
  if (pressioniEsistenti.length === 0) return null

  const elenco = [...pressioniEsistenti].sort((a, b) => a - b).map(numeroIT)
  const esistenti =
    elenco.length === 1
      ? `esiste già a ${elenco[0]} bar`
      : `esiste già in ${elenco.length} varianti: ${elenco.slice(0, -1).join(', ')} e ${elenco[elenco.length - 1]} bar`

  const coda =
    nuova === null ? "Stai per aggiungerne un'altra." : `Stai per aggiungerne una a ${numeroIT(nuova)} bar.`

  return {
    titolo: 'Variante nuova di un modello già a catalogo',
    corpo: `A catalogo ${marca} ${modello} ${esistenti}. ${coda}`,
  }
}

/**
 * Virgola decimale, come si scrive in italiano.
 *
 * Non si importa `formatNumberIT` dal motore della relazione: quello serve i documenti
 * generati e non deve diventare una dipendenza dell'interfaccia.
 */
function numeroIT(n: number): string {
  return String(Number(n.toFixed(2))).replace('.', ',')
}
