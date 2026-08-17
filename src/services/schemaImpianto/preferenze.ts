/**
 * Traduzione delle scelte salvate dall'operatore (`additional_info.schemaPreferenze`) in ciò che
 * vale adesso, sulla scheda com'è adesso. Funzioni pure: qui vive tutta la logica del pannello
 * della finestra SCHEMA IMPIANTO, così il componente resta muto e provabile per lettura.
 *
 * Le preferenze invecchiano — un'apparecchiatura sparisce, un'altra compare, un gruppo by-pass
 * perde la contiguità — e questo modulo è l'unico posto che sa cosa farne. `pruneAdditionalInfo`
 * (utils/equipmentCodes.ts) toglie prima i riferimenti a codici che la scheda non ha più; qui si
 * fa il resto, che richiede di sapere l'ORDINE, informazione che lì non c'è.
 *
 * Difensivo di proposito: `schemaPreferenze` è dichiarato `z.any()` a Zod, quindi un dato storto
 * arriva fin qui invece di far fallire il salvataggio. Meglio ignorarlo che sollevare a metà
 * generazione dello schema.
 */
import type { SchemaPreferenze } from '@/services/relazione/types'
import type { SchemaNodo } from './types'

export interface PreferenzeRisolte {
  /** Codici degli stadi di trattamento, nell'ordine in cui vanno disegnati da sinistra a destra. */
  ordineStadi: string[]
  ordineSerbatoi: string[]
  /** Chi scarica condensa. Un `Set` e non una mappa: il default è già stato applicato. */
  condense: Set<string>
  /** Gruppi ancora validi, coi membri riordinati secondo `ordineStadi`. */
  bypass: { id: string; stadi: string[] }[]
  /** Id dei gruppi caduti perché non più contigui: da dire all'operatore, non da riparare. */
  bypassScartati: string[]
}

const elenco = (valore: unknown): string[] =>
  Array.isArray(valore) ? valore.filter((v): v is string => typeof v === 'string') : []

/**
 * Ordina secondo l'elenco salvato: prima chi è nominato, nell'ordine in cui è nominato, poi chi
 * non lo è — e questi ultimi **fra loro nell'ordine di default**, non in ordine di arrivo. Senza
 * quest'ultima regola due filtri aggiunti insieme comparirebbero invertiti, e l'operatore
 * dovrebbe riordinare qualcosa che non ha mai toccato.
 */
export function ordinaPerElenco<T extends { id: string }>(elementi: T[], salvato: string[] | undefined): T[] {
  const posizione = new Map(elenco(salvato).map((id, i) => [id, i]))
  return elementi
    .map((elemento, difetto) => ({ elemento, difetto, scelto: posizione.get(elemento.id) }))
    .sort((a, b) => {
      if (a.scelto !== undefined && b.scelto !== undefined) return a.scelto - b.scelto
      if (a.scelto !== undefined) return -1
      if (b.scelto !== undefined) return 1
      return a.difetto - b.difetto
    })
    .map((v) => v.elemento)
}

/**
 * Vero se i codici occupano posizioni consecutive nell'ordine dato. È la condizione perché un
 * by-pass sia disegnabile: due soli TEE, uno prima del primo scavalcato e uno dopo l'ultimo, non
 * possono saltare un'apparecchiatura in mezzo e rimetterla in linea.
 */
export function contigui(codici: string[], ordine: string[]): boolean {
  if (codici.length === 0) return false
  const posizioni = codici.map((c) => ordine.indexOf(c))
  if (posizioni.some((p) => p < 0)) return false
  const min = Math.min(...posizioni)
  const max = Math.max(...posizioni)
  return max - min + 1 === new Set(posizioni).size
}

/**
 * Il primo intero libero, non il successivo del massimo: sciogliendo `bp2` e ricreando un gruppo,
 * l'operatore si ritrova `bp2` invece di `bp3`, e gli id non crescono senza fine su una pratica
 * ritoccata a lungo.
 */
export function prossimoIdBypass(gruppi: { id: string }[]): string {
  const presi = new Set(
    gruppi.map((g) => Number(/^bp(\d+)$/.exec(g.id)?.[1])).filter((n) => Number.isInteger(n))
  )
  let n = 1
  while (presi.has(n)) n++
  return `bp${n}`
}

export function risolviPreferenze(
  preferenze: SchemaPreferenze | undefined,
  stadiDiDefault: SchemaNodo[],
  serbatoiDiDefault: SchemaNodo[],
  scaricaDiDefault: (nodo: SchemaNodo) => boolean
): PreferenzeRisolte {
  const p = (preferenze ?? {}) as SchemaPreferenze
  const ordineStadi = ordinaPerElenco(stadiDiDefault, p.ordineStadi).map((n) => n.id)
  const ordineSerbatoi = ordinaPerElenco(serbatoiDiDefault, p.ordineSerbatoi).map((n) => n.id)

  // Chiave assente = regola per tipo: è ciò che rende indolore il passaggio da «selezione per
  // tipo» a «flag per apparecchiatura» su una pratica salvata prima che il pannello esistesse.
  const scelte = p.condense && typeof p.condense === 'object' ? p.condense : {}
  const condense = new Set<string>()
  for (const nodo of [...serbatoiDiDefault, ...stadiDiDefault]) {
    const scelta = scelte[nodo.id]
    if (typeof scelta === 'boolean' ? scelta : scaricaDiDefault(nodo)) condense.add(nodo.id)
  }

  const bypass: { id: string; stadi: string[] }[] = []
  const bypassScartati: string[] = []
  for (const gruppo of Array.isArray(p.bypass) ? p.bypass : []) {
    if (!gruppo || typeof gruppo.id !== 'string') continue
    // Riordinati secondo l'ordine risolto, non secondo com'erano salvati: l'operatore può aver
    // riordinato le righe dopo aver creato il gruppo, e il disegno segue l'ordine, non la memoria.
    const membri = ordineStadi.filter((id) => elenco(gruppo.stadi).includes(id))
    if (membri.length === 0) continue
    if (!contigui(membri, ordineStadi)) {
      bypassScartati.push(gruppo.id)
      continue
    }
    bypass.push({ id: gruppo.id, stadi: membri })
  }

  return { ordineStadi, ordineSerbatoi, condense, bypass, bypassScartati }
}

/**
 * Impronta stabile delle preferenze risolte, per dire all'operatore «il disegno salvato è stato
 * generato con altre scelte: premi Rigenera da capo». Non entra in nessun calcolo geometrico.
 * Le condense si ordinano perché due oggetti uguali scritti in ordine diverso devono dare la
 * stessa impronta, o l'avviso comparirebbe da solo.
 */
export function improntaPreferenze(risolte: PreferenzeRisolte): string {
  return JSON.stringify({
    stadi: risolte.ordineStadi,
    serbatoi: risolte.ordineSerbatoi,
    condense: [...risolte.condense].sort(),
    bypass: risolte.bypass.map((g) => ({ id: g.id, stadi: g.stadi })),
  })
}
