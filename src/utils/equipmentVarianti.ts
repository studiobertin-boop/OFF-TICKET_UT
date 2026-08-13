import type { EquipmentCatalogItem, EquipmentCatalogType } from '@/types'
import {
  CANONICAL_SPECS,
  capacityKey,
  missingCanonicalSpecs,
  normalizeKey,
  readNumericSpec,
  readSheetPressure,
  readSpec,
  readVariantKey,
  readVariantValue,
  variantKeyFields,
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
  /** Pressione che distingue la riga dalle sue sorelle: la parte primaria della chiave. */
  variante: number
  /**
   * Chiave completa dell'indice unico, in forma di stringa: la pressione, e sulle valvole
   * anche il diametro. È quella su cui le righe si raggruppano.
   */
  chiave: string
  item: EquipmentCatalogItem
}

/**
 * Raggruppa le righe di un modello in varianti, ordinate per pressione crescente.
 *
 * Il raggruppamento avviene sulla chiave di variante — `COALESCE(pressione_esercizio,
 * pressione_max)` sui compressori, taratura e diametro sulle valvole — la stessa dell'indice
 * unico a database. Indicizzare
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
  const perVariante = new Map<string, VarianteCatalogo>()

  for (const item of rows) {
    const chiave = readVariantKey(tipo, item.specs)
    const variante = readVariantValue(tipo, item.specs)
    const value = readSheetPressure(tipo, item.specs)
    if (chiave === null || variante === null || value === null) continue

    const presente = perVariante.get(chiave)
    if (
      !presente ||
      missingCanonicalSpecs(tipo, item.specs).length <
        missingCanonicalSpecs(tipo, presente.item.specs).length
    ) {
      perVariante.set(chiave, { value, variante, chiave, item })
    }
  }

  return [...perVariante.values()].sort(
    (a, b) => a.value - b.value || a.variante - b.variante || confrontaSecondarie(tipo, a, b)
  )
}

/**
 * Ordina le varianti che la pressione non distingue, sulle parti secondarie della chiave.
 *
 * I diametri seguono la scala commerciale dichiarata nel contratto, non l'alfabeto: per
 * stringa 3/4" verrebbe prima di 3/8", che a chi scorre il menu si legge come un elenco in
 * disordine.
 */
function confrontaSecondarie(
  tipo: EquipmentCatalogType,
  a: VarianteCatalogo,
  b: VarianteCatalogo
): number {
  for (const key of variantKeyFields(tipo).slice(1)) {
    const def = (CANONICAL_SPECS[tipo] ?? []).find(d => d.key === key)
    const va = String(readSpec(tipo, a.item.specs, key) ?? '')
    const vb = String(readSpec(tipo, b.item.specs, key) ?? '')
    if (va === vb) continue

    const scala = def?.options
    if (scala) {
      // I valori fuori scala — grafie vecchie non ancora normalizzate — vanno in fondo.
      const ia = scala.indexOf(va)
      const ib = scala.indexOf(vb)
      return (ia === -1 ? scala.length : ia) - (ib === -1 ? scala.length : ib) || va.localeCompare(vb)
    }
    return va.localeCompare(vb)
  }
  return 0
}

/** Dati di una riga di scheda già salvata, per quel poco che serve a ritrovarne l'origine. */
export interface RigaSalvata {
  /** Pressione della colonna PS/Ptar; `null` se il campo è vuoto. */
  pressione: number | null
  /** Capacità della riga — portata per i compressori, volume per i recipienti. */
  capacita: number | null
  /** Diametro della valvola: sui tipi che non ce l'hanno resta assente. */
  diametro?: string | null
}

/**
 * Sceglie, fra le righe di catalogo di un modello, quella da cui vengono i dati di una riga di
 * scheda già salvata.
 *
 * La pressione da sola non basta più: su KAESER SK 19 le due varianti dichiarano entrambe 11 bar
 * di massima, e prendere la prima che capita significa dare alla riga una provenienza sbagliata.
 * Le conseguenze non sono cosmetiche — `appliedSpecs` è il termine di paragone del confronto di
 * divergenza, quindi una portata salvata correttamente risulterebbe «modificata» rispetto a una
 * variante che non è quella scelta a suo tempo, e all'utente verrebbe proposto di riportare a
 * catalogo uno scostamento che non esiste.
 *
 * Dove la pressione non distingue, distingue la capacità: è appunto ciò che cambia fra due
 * varianti dello stesso modello. E dove non basta neanche quella si restituisce `null`: senza
 * provenienza il confronto di divergenza non parte per quella riga, che è molto meglio di un
 * confronto contro la riga sbagliata.
 */
export function scegliVarianteSalvata(
  tipo: EquipmentCatalogType,
  candidate: EquipmentCatalogItem[],
  riga: RigaSalvata
): EquipmentCatalogItem | null {
  // Una riga sola non ha sorelle da cui distinguersi: è quella, anche se il tecnico ne ha nel
  // frattempo scostato i valori — ed è proprio quello scostamento che si vuole poter rilevare.
  if (candidate.length <= 1) return candidate[0] ?? null

  let rimaste = candidate
  if (riga.pressione !== null) {
    rimaste = rimaste.filter(c => stessoNumero(readSheetPressure(tipo, c.specs), riga.pressione))
  }
  if (rimaste.length === 1) return rimaste[0]

  // Sulle valvole il diametro fa parte della chiave: viene prima della capacità, che da lui
  // dipende — a parità di taratura è l'attacco a dire quanta aria la valvola scarica.
  if (riga.diametro != null && riga.diametro !== '') {
    rimaste = rimaste.filter(c => String(readSpec(tipo, c.specs, 'diametro') ?? '') === riga.diametro)
  }
  if (rimaste.length === 1) return rimaste[0]

  if (riga.capacita !== null) {
    const chiave = capacityKey(tipo)
    rimaste = rimaste.filter(c => stessoNumero(readNumericSpec(tipo, c.specs, chiave), riga.capacita))
  }
  return rimaste.length === 1 ? rimaste[0] : null
}

/** Uguaglianza fra numeri letti da JSON, indulgente quanto basta al rumore in virgola mobile. */
function stessoNumero(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) < 1e-6
}

/**
 * Una voce di catalogo appartiene davvero a questa marca/modello di scheda?
 *
 * Serve a chi scrive per `catalogItemId`: l'id individua una riga senza passare da marca e
 * modello, e questo va bene finché la provenienza da cui l'id arriva è ancora quella della riga
 * di scheda che si sta salvando. Se nel frattempo il tecnico ha corretto marca o modello
 * dall'autocomplete, la provenienza può restare quella del modello precedente — la voce trovata
 * per id appartiene a un'altra apparecchiatura, e scriverci sopra scriverebbe FAD/PS/TS della
 * riga sbagliata su un'altra scheda macchina.
 *
 * Il confronto usa `normalizeKey`, la stessa normalizzazione con cui il motore di verifica
 * riconosce una marca o un modello scritti in una pratica con una grafia diversa da quella
 * canonica di catalogo (`schedeDati.ts`): qui la domanda è la stessa — "questa stringa di scheda
 * indica questa voce di catalogo?" — non l'uguaglianza esatta che usano le query dirette al
 * database (`.eq()` su `findVariants`), pensate per righe che arrivano già con la grafia del
 * catalogo perché scelte da un autocomplete che lo interroga.
 */
export function stessaVoceCatalogo(
  equipment: Pick<EquipmentCatalogItem, 'marca' | 'modello'>,
  marca: string,
  modello: string
): boolean {
  return (
    normalizeKey(equipment.marca) === normalizeKey(marca) &&
    normalizeKey(equipment.modello) === normalizeKey(modello)
  )
}

/**
 * Come la variante si presenta nel menu della colonna PS: pressione, diametro e capacità.
 *
 * La capacità non è decorazione: è ciò che distingue due varianti che dichiarano la stessa
 * pressione, e senza di essa il menu di SK 19 mostrerebbe due voci identiche. Sulle valvole
 * a distinguerle è prima ancora il diametro, che della portata scaricata è la causa.
 */
export function etichettaVariante(tipo: EquipmentCatalogType, v: VarianteCatalogo): string {
  const parti = [`${numeroIT(v.value)} bar`]

  // Le parti secondarie della chiave (il diametro delle valvole) stanno fra pressione e
  // capacità: sono ciò che distingue due varianti che la pressione non distingue.
  for (const key of variantKeyFields(tipo).slice(1)) {
    const v2 = readSpec(tipo, v.item.specs, key)
    if (v2 !== null && v2 !== '') parti.push(String(v2))
  }

  const chiave = capacityKey(tipo)
  const capacita = readNumericSpec(tipo, v.item.specs, chiave)
  if (capacita !== null) {
    const unita = (CANONICAL_SPECS[tipo] ?? []).find(d => d.key === chiave)?.unit
    parti.push(`${numeroIT(capacita)}${unita ? ` ${unita}` : ''}`)
  }

  return parti.join(' · ')
}

export interface AvvisoVariante {
  titolo: string
  /** Apertura: quante varianti ci sono già. */
  intro: string
  /** Una riga per variante, nella stessa forma del menu della colonna PS. */
  varianti: string[]
  /** Chiusura: cosa si sta per aggiungere. */
  coda: string
}

/**
 * Avviso da mostrare prima di aggiungere a catalogo una variante di un modello che c'è già.
 *
 * Il pulsante «+» compare in due casi che si somigliano ma non sono la stessa cosa: il
 * modello manca del tutto, e allora non c'è niente da segnalare, oppure c'è ad altre
 * pressioni, e allora chi sta per aggiungerne una deve sapere quali. Restituisce `null` nel
 * primo caso.
 *
 * L'elenco riporta la variante intera — pressione ed etichetta come nel menu della colonna
 * PS — e non la sola pressione: su KAESER SK 19, dove due varianti dichiarano entrambe 11 bar
 * di massima e si distinguono solo per portata (1855 e 1680 l/min), un elenco di sole
 * pressioni diceva «11 e 11 bar», che si legge come un errore di battitura invece che come
 * due macchine diverse.
 */
export function testoAvvisoVariante(
  tipo: EquipmentCatalogType,
  params: {
    marca: string
    modello: string
    /** Varianti già a catalogo per questo modello, ordinate come le restituisce `raggruppaVarianti`. */
    varianti: VarianteCatalogo[]
    /** Pressione della variante che si sta per creare; `null` se la colonna PS è vuota. */
    nuova: number | null
  }
): AvvisoVariante | null {
  const { marca, modello, varianti, nuova } = params
  if (varianti.length === 0) return null

  const intro =
    varianti.length === 1
      ? `A catalogo ${marca} ${modello} esiste già in una variante:`
      : `A catalogo ${marca} ${modello} esiste già in ${varianti.length} varianti:`

  const coda =
    nuova === null ? "Stai per aggiungerne un'altra." : `Stai per aggiungerne una a ${numeroIT(nuova)} bar.`

  return {
    titolo: 'Variante nuova di un modello già a catalogo',
    intro,
    varianti: varianti.map((v) => etichettaVariante(tipo, v)),
    coda,
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
