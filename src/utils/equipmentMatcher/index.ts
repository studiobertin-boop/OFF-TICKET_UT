import { normalizzaMarcaStretta, normalizzaModello, similarita } from './normalizzazione'
import { risolviFamiglia } from './marcheFamiglie'
import { confrontaSpecs, eCompatibile, haConferme, type ConfrontoSpec } from './compatibilita'
import { EQUIPMENT_DEFS, type EquipmentKind } from '@/components/technicalSheet/table/equipmentConfig'
import type { EquipmentCatalogItem } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'

/** Sotto questa somiglianza di modello una riga non è nemmeno un candidato. */
const SOGLIA_INGRESSO = 0.6
/** Quanti candidati ha senso mostrare nel popup. */
const MAX_CANDIDATI = 5

export interface Candidato {
  riga: EquipmentCatalogItem
  simModello: number
  /** La targhetta dà la ragione sociale completa e coincide con quella della riga. */
  marcaEsatta: boolean
  confronti: ConfrontoSpec[]
}

export type MotivoAmbiguita =
  | 'ragione_sociale_altra'
  | 'divergenza_specs'
  | 'piu_candidati'
  | 'somiglianza_incerta'

export type RisultatoMatch =
  | { esito: 'certo'; candidato: Candidato }
  | { esito: 'ambiguo'; candidati: Candidato[]; motivo: MotivoAmbiguita }
  | { esito: 'nessuno' }

/**
 * Riconduce ciò che l'OCR ha letto a una riga di `equipment_catalog`.
 *
 * Funzione pura: riceve le righe già caricate e non conosce né React né Supabase. È il
 * punto in cui si decide se la scheda si compila da sola, se serve una domanda
 * all'operatore, o se l'apparecchiatura è davvero sconosciuta.
 */
export function matchEquipment(
  kind: EquipmentKind,
  datiOcr: OCRExtractedData,
  righe: EquipmentCatalogItem[]
): RisultatoMatch {
  const modelloLetto = normalizzaModello(datiOcr.modello ?? '')
  if (!modelloLetto || righe.length === 0) return { esito: 'nessuno' }

  const marcaLetta = datiOcr.marca ?? ''
  const marcaStretta = normalizzaMarcaStretta(marcaLetta)

  // 1. Restrizione stretta: se la targhetta dichiara una ragione sociale precisa, si cerca
  //    solo lì. Una targhetta che dice «SICC TECH s.r.l.» non fa guardare le righe SpA.
  const strette = marcaStretta
    ? righe.filter((r) => normalizzaMarcaStretta(r.marca) === marcaStretta)
    : []

  const valuta = (insieme: EquipmentCatalogItem[]): Candidato[] =>
    insieme
      .map((riga) => ({
        riga,
        simModello: similarita(modelloLetto, normalizzaModello(riga.modello)),
        marcaEsatta: Boolean(marcaStretta) && normalizzaMarcaStretta(riga.marca) === marcaStretta,
        confronti: confrontaSpecs(kind, datiOcr, riga),
      }))
      .filter((c) => c.simModello >= SOGLIA_INGRESSO)

  let candidati = valuta(strette)
  let daAltraRagioneSociale = false

  // 2. Ripiego alla famiglia. Serve in due casi: la targhetta è parziale e non ha
  //    selezionato nulla, oppure ha selezionato righe in cui quel modello non c'è. Nel
  //    secondo caso i candidati trovati altrove portano una contraddizione che va vista.
  if (candidati.length === 0) {
    const famiglia = risolviFamiglia(marcaLetta)
    const insieme = famiglia
      ? righe.filter((r) => famiglia.includes(r.marca))
      : righe   // marca illeggibile o fuori mappa: si cerca su tutto il tipo
    candidati = valuta(insieme)
    daAltraRagioneSociale = strette.length > 0 && candidati.length > 0
  }

  if (candidati.length === 0) return { esito: 'nessuno' }

  // 3. Collasso dei duplicati: stessa ragione sociale, stesso modello normalizzato e stesse
  //    specs sono la stessa apparecchiatura scritta due volte (a catalogo `500-12783` e
  //    `500 - 12783` convivono). Il modello normalizzato entra nell'impronta apposta — non
  //    solo marca+specs — perché su un tipo come `separatore`, il cui `specsMap` è vuoto,
  //    l'impronta senza modello si ridurrebbe alla sola marca: due modelli realmente diversi
  //    della stessa marca, entrambi sopra soglia, si fonderebbero e uno sparirebbe in
  //    silenzio. Con `500-12783` e `500 - 12783` che normalizzano identici, il collasso
  //    voluto resta intatto; a sparire è solo la fusione indebita fra modelli diversi.
  //    Fra ragioni sociali diverse non si collassa mai: quella è la scelta dell'operatore.
  const def = EQUIPMENT_DEFS[kind]
  const chiaveSpecs = Object.keys(def.specsMap)
  const impronta = (c: Candidato) =>
    [
      normalizzaMarcaStretta(c.riga.marca),
      normalizzaModello(c.riga.modello),
      ...chiaveSpecs.map((k) => String((c.riga.specs ?? {})[k] ?? '')),
    ].join('|')

  const perImpronta = new Map<string, Candidato>()
  for (const c of candidati) {
    const chiave = impronta(c)
    const gia = perImpronta.get(chiave)
    if (!gia || (c.riga.usage_count ?? 0) > (gia.riga.usage_count ?? 0)) perImpronta.set(chiave, c)
  }
  candidati = [...perImpronta.values()]

  // 3bis. Un modello identico rende rumore chi è solo somigliante. Se la targhetta trova
  // almeno una riga con corrispondenza esatta, le righe che si avvicinano ma non coincidono
  // non aggiungono un'alternativa reale: sono lo stesso modello letto peggio, o un modello
  // diverso che il testo ricorda. In entrambi i casi non aiutano la scelta e allungano solo
  // il popup — l'unica domanda che deve restare aperta, quando l'exact match esiste, è fra le
  // ragioni sociali che lo condividono (vedi CECCATO: stesso `FONOCOMPACT PRO 270 F6S` sotto
  // due aziende), non fra modelli diversi.
  if (candidati.some((c) => c.simModello === 1)) {
    candidati = candidati.filter((c) => c.simModello === 1)
  }

  const compatibili = candidati.filter((c) => eCompatibile(c.confronti))
  const ordina = (a: Candidato, b: Candidato) =>
    b.simModello - a.simModello || (b.riga.usage_count ?? 0) - (a.riga.usage_count ?? 0)

  // 4. Certezza: un solo candidato compatibile, modello identico, e almeno un dato tecnico
  //    che lo conferma. Tutto il resto passa dall'operatore.
  if (
    !daAltraRagioneSociale &&
    compatibili.length === 1 &&
    compatibili[0].simModello === 1 &&
    haConferme(compatibili[0].confronti)
  ) {
    return { esito: 'certo', candidato: compatibili[0] }
  }

  const mostrati = (compatibili.length > 0 ? compatibili : candidati).sort(ordina).slice(0, MAX_CANDIDATI)

  const motivo: MotivoAmbiguita = daAltraRagioneSociale
    ? 'ragione_sociale_altra'
    : compatibili.length === 0
      ? 'divergenza_specs'
      : compatibili.length > 1
        ? 'piu_candidati'
        : 'somiglianza_incerta'

  return { esito: 'ambiguo', candidati: mostrati, motivo }
}

export type { ConfrontoSpec } from './compatibilita'
