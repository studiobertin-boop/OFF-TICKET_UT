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
  | 'marca_assente'
  | 'senza_conferma_tecnica'
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

  // `.trim()`: una marca fatta di soli spazi non è una marca. Senza il trim, ' ' passa la
  // guardia `marcaLetta !== ''` più sotto (che esiste apposta per distinguere "nessuna marca
  // letta" da "marca letta ma sbagliata") e un dato di fatto assente verrebbe raccontato come
  // "un'altra ragione sociale" — un'affermazione che i dati non sostengono.
  const marcaLetta = (datiOcr.marca ?? '').trim()
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

  // 4. Compatibilità tecnica, calcolata sull'insieme intero (non ancora ridotto ai soli
  //    esatti: quel filtro è un fatto di *presentazione*, non di decisione — vedi sotto). Se
  //    girasse prima, la clausola «un solo candidato compatibile» del punto 5 si valuterebbe
  //    su un insieme già potato e il cancello del `certo` si allargherebbe: un modello esatto
  //    che diverge sulle specs lascerebbe fuori il quasi-match compatibile, l'insieme potato
  //    crollerebbe a un solo elemento (quello divergente) e quell'elemento — da solo — non
  //    passerebbe comunque il `certo` per via della divergenza, ma nel caso duale (`SK 19` e
  //    `SK 19 B`, stessa marca, stesse specs, l'OCR legge `SK 19` per troncamento) l'esatto
  //    è pure compatibile: il quasi-match verrebbe scartato prima di essere confrontato,
  //    l'insieme crollerebbe a lui solo, e la scheda si compilerebbe da sola su una delle due
  //    varianti senza che l'altra abbia mai avuto voce in capitolo.
  const compatibili = candidati.filter((c) => eCompatibile(c.confronti))

  // 5. La marca letta deve riconoscersi nella riga scelta — o è la stessa ragione sociale, o
  //    appartiene alla sua famiglia produttore. Senza questo controllo il modello può anche
  //    coincidere alla lettera: resta comunque un'altra azienda, e non è un dettaglio che la
  //    scheda possa risolversi da sola. Copre anche la marca del tutto assente: nessuna
  //    corrispondenza vuol dire nessuna certezza sul costruttore.
  const corrispondeAllaMarca = (c: Candidato): boolean => {
    if (c.marcaEsatta) return true
    const famiglia = risolviFamiglia(marcaLetta)
    return famiglia !== null && famiglia.includes(c.riga.marca)
  }

  // Generalizza `daAltraRagioneSociale` oltre al solo caso del ripiego di famiglia: capita
  // anche quando la marca letta non sta in nessuna famiglia mappata (es. un costruttore mai
  // censito) e la ricerca è scivolata sull'intero tipo — lì nessuna delle due branche sopra
  // segnala nulla, ma il candidato tecnico che ne esce appartiene comunque a un'altra azienda.
  // Guardato dietro `marcaLetta !== ''`: quando la targhetta non dichiara proprio una marca
  // non c'è una "ragione sociale altra" da nominare, solo un dato mancante — il motivo di
  // quel caso resta quello determinato dal numero di compatibili, non questo.
  const nessunCandidatoConfermaLaMarca =
    marcaLetta !== '' && compatibili.length > 0 && !compatibili.some(corrispondeAllaMarca)
  daAltraRagioneSociale = daAltraRagioneSociale || nessunCandidatoConfermaLaMarca

  // 6. Certezza: un solo candidato compatibile, modello identico, un dato tecnico che lo
  //    conferma, e una marca che gli corrisponde davvero (punto 5 — copre anche il caso della
  //    marca vuota, che la riga sopra non intercetta per via della guardia su `marcaLetta`).
  //    Tutto il resto passa dall'operatore.
  if (
    !daAltraRagioneSociale &&
    compatibili.length === 1 &&
    compatibili[0].simModello === 1 &&
    haConferme(compatibili[0].confronti) &&
    corrispondeAllaMarca(compatibili[0])
  ) {
    return { esito: 'certo', candidato: compatibili[0] }
  }

  // 7. Presentazione: un modello identico rende rumore chi è solo somigliante. Applicato qui
  //    — sull'insieme che finisce davvero nel popup — e non prima del calcolo di
  //    `compatibili`, così da non alterare la decisione presa al punto 6. Se nell'insieme da
  //    mostrare non c'è nessun modello esatto, il filtro non toglie nulla: è il caso in cui
  //    l'unico esatto è stato escluso da `compatibili` perché diverge sulle specs, e il
  //    quasi-match compatibile rimasto è l'unico aggancio che l'operatore ha — toglierlo
  //    anche lui lascerebbe il popup vuoto o, peggio, con la sola riga che i dati letti hanno
  //    già contraddetto.
  //
  //    Il filtro va saltato anche quando ridurrebbe a una sola voce un'ambiguità che nasce
  //    da più righe compatibili in competizione (`compatibili.length > 1`, motivo
  //    `piu_candidati`): `SK 19` e `SK 19 B`, stessa marca, stesse specs, l'OCR legge `SK 19`
  //    per un troncamento plausibile — filtrare ai soli esatti lascerebbe solo `SK 19` in
  //    scena, e il popup direbbe "più voci corrispondono" sopra un elenco da una riga, con
  //    l'alternativa che ha reso il caso ambiguo mai arrivata all'operatore. Il caso CECCATO,
  //    per cui il filtro esiste, resta invece coperto: lì i compatibili sono 4 ma gli esatti
  //    sono comunque 2 (una ragione sociale ciascuno) — filtrare non cancella la competizione,
  //    la rende solo più precisa. La condizione è quindi sugli *esatti* rimasti, non sul
  //    numero grezzo di compatibili: si applica il filtro se ne resta più di un esatto, o se
  //    i compatibili in gara erano comunque uno solo (nessuna competizione da preservare).
  const base = compatibili.length > 0 ? compatibili : candidati
  const esatti = base.filter((c) => c.simModello === 1)
  const filtroSoliEsattiSiApplica = compatibili.length <= 1 || esatti.length > 1
  const daMostrare = filtroSoliEsattiSiApplica && esatti.length > 0 ? esatti : base

  const ordina = (a: Candidato, b: Candidato) =>
    b.simModello - a.simModello || (b.riga.usage_count ?? 0) - (a.riga.usage_count ?? 0)
  const mostrati = daMostrare.sort(ordina).slice(0, MAX_CANDIDATI)

  const motivo: MotivoAmbiguita = daAltraRagioneSociale
    ? 'ragione_sociale_altra'
    : compatibili.length === 0
      ? 'divergenza_specs'
      : compatibili.length > 1
        ? 'piu_candidati'
        // Nessuna marca letta (già ripulita dai soli spazi): il `certo` è bloccato dal punto
        // 6 a prescindere da quanto modello e specs combacino, quindi non ha senso scendere a
        // parlare di somiglianza o di conferme tecniche — il problema, quando c'è, è più a
        // monte. `marcaLetta` è già `''` qui per costruzione (vedi guardia sopra su
        // `nessunCandidatoConfermaLaMarca`), quindi non serve altro controllo.
        : marcaLetta === ''
          ? 'marca_assente'
          // Un solo compatibile, modello identico, ma senza un dato tecnico che lo confermi
          // (filtro, separatore): non è "solo somigliante", è letteralmente lo stesso modello.
          // Dirlo con `somiglianza_incerta` mentirebbe all'operatore sul motivo reale.
          : compatibili[0].simModello === 1 && !haConferme(compatibili[0].confronti)
            ? 'senza_conferma_tecnica'
            : 'somiglianza_incerta'

  return { esito: 'ambiguo', candidati: mostrati, motivo }
}

export type { ConfrontoSpec } from './compatibilita'
