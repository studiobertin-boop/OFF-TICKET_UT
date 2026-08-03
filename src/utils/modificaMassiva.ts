import type { EquipmentCatalogItem } from '@/types'
import { CANONICAL_SPECS } from '@/services/equipmentAudit'

/**
 * Modifica massiva delle proprietà costruttive dei compressori: che cosa succederebbe.
 *
 * Logica pura, senza React né Supabase. Sta qui e non nel dialog perché è la parte che va
 * verificata sui casi reali, e perché la conferma mostrata all'utente e la lista di righe
 * effettivamente scritte devono venire dallo stesso calcolo: se divergessero, il numero
 * annunciato non sarebbe quello applicato.
 */

/** Le sole due proprietà che appartengono al modello e non alla singola variante. */
export type ChiaveMassiva = 'giri' | 'tipo_compressore'

export interface RipartizioneMassiva {
  /** Il campo è vuoto: si compila. */
  daCompilare: EquipmentCatalogItem[]
  /** Il campo ha un altro valore: si sostituisce, ed è ciò su cui va richiamata l'attenzione. */
  daSostituire: EquipmentCatalogItem[]
  /** Il campo ha già questo valore: non si riscrive, per non sporcare `updated_at`. */
  giaUguali: EquipmentCatalogItem[]
  /**
   * Il campo non si applica a questa riga (`appliesWhen` del contratto canonico è falso):
   * non si scrive, qualunque cosa porti già in `specs`. Sui giri è lo scroll o il pistoni —
   * il form di modifica nasconde già il campo per queste righe, e scriverci sotto un valore
   * lo lascerebbe lì, invisibile e non correggibile dall'interfaccia.
   */
  nonApplicabili: EquipmentCatalogItem[]
}

/**
 * Divide le righe selezionate rispetto al valore che si sta per applicare.
 *
 * I gruppi non sono una comodità di presentazione: `daSostituire` sono le righe il cui
 * valore qualcuno ha già stabilito — sui giri, le 141 che il backfill aveva verificato una
 * a una — e cancellarne uno per sbaglio è silenzioso, perché il dato finisce in una frase
 * asseverata di una relazione firmata. `nonApplicabili` sono quelle su cui il dato non ha
 * senso del tutto, e la condizione la dichiara il contratto canonico stesso
 * (`appliesWhen`), non una regola duplicata qui.
 */
export function ripartisciPerValore(
  righe: EquipmentCatalogItem[],
  chiave: ChiaveMassiva,
  valore: string
): RipartizioneMassiva {
  const def = (CANONICAL_SPECS.Compressori ?? []).find(d => d.key === chiave)
  const out: RipartizioneMassiva = {
    daCompilare: [],
    daSostituire: [],
    giaUguali: [],
    nonApplicabili: [],
  }

  for (const riga of righe) {
    if (def?.appliesWhen && !def.appliesWhen(riga.specs ?? {})) {
      out.nonApplicabili.push(riga)
      continue
    }

    const attuale = riga.specs?.[chiave]
    const vuoto = attuale === null || attuale === undefined || String(attuale).trim() === ''

    if (vuoto) out.daCompilare.push(riga)
    else if (String(attuale) === valore) out.giaUguali.push(riga)
    else out.daSostituire.push(riga)
  }

  return out
}

/** Come il valore si dice all'utente: l'etichetta del contratto, non la sigla memorizzata. */
export function etichettaValore(chiave: ChiaveMassiva, valore: string): string {
  const def = (CANONICAL_SPECS.Compressori ?? []).find(d => d.key === chiave)
  return def?.optionLabels?.[valore] ?? valore
}

/**
 * Elenco dei modelli, senza ripetizioni e troncato.
 *
 * I modelli si nominano, non si contano soltanto: chi sta per sostituire un valore deve
 * poter riconoscere le macchine su cui lo fa. Oltre `max` l'elenco diventa illeggibile e si
 * tronca dicendo quanti ne restano.
 */
export function modelliDa(righe: EquipmentCatalogItem[], max = 10): string {
  const unici = [...new Set(righe.map(r => r.modello))]
  if (unici.length <= max) return unici.join(', ')
  return `${unici.slice(0, max).join(', ')} e altri ${unici.length - max}`
}

export interface TestoConferma {
  titolo: string
  /** Una riga per gruppo non vuoto, nell'ordine: da compilare, da sostituire, già uguali, non applicabili. */
  righe: string[]
  /** Etichetta del pulsante, che dichiara quante righe verranno davvero scritte. */
  azione: string
  applicabile: boolean
}

export function testoConferma(
  rip: RipartizioneMassiva,
  chiave: ChiaveMassiva,
  valore: string
): TestoConferma {
  const def = (CANONICAL_SPECS.Compressori ?? []).find(d => d.key === chiave)
  const righe: string[] = []

  if (rip.daCompilare.length > 0) {
    const n = rip.daCompilare.length
    righe.push(
      `${conta(n, 'riga ha', 'righe hanno')} il campo vuoto e ${scegli(n, 'verrà compilata', 'verranno compilate')}`
    )
  }

  if (rip.daSostituire.length > 0) {
    const n = rip.daSostituire.length
    // Il valore attuale si nomina solo quando è uno solo: dire «hanno già X» quando le righe
    // da sostituire portano valori diversi sarebbe falso.
    const attuali = [...new Set(rip.daSostituire.map(r => String(r.specs?.[chiave])))]
    const quali = attuali.length === 1 ? ` «${etichettaValore(chiave, attuali[0])}»` : ' un altro valore'
    righe.push(
      `${conta(n, 'riga ha', 'righe hanno')} già${quali} e ${scegli(n, 'verrà sostituita', 'verranno sostituite')}: ${modelliDa(rip.daSostituire)}`
    )
  }

  if (rip.giaUguali.length > 0) {
    const n = rip.giaUguali.length
    righe.push(
      `${conta(n, 'riga ha', 'righe hanno')} già questo valore e ${scegli(n, 'resta com è', 'restano come sono')}`
    )
  }

  if (rip.nonApplicabili.length > 0) {
    const n = rip.nonApplicabili.length
    // La frase nomina la condizione — «rotativi a vite» — perché oggi `giri` è l'unica
    // chiave con un `appliesWhen`, ed è quella condizione. Se in futuro un'altra proprietà
    // costruttiva ne guadagnasse uno diverso, questo testo andrebbe generalizzato invece di
    // aggiungere qui un altro ramo con un'altra frase fissa.
    righe.push(
      n === 1
        ? '1 riga non è un rotativo a vite e resta com è'
        : `${n} righe non sono rotativi a vite e restano come sono`
    )
  }

  const daScrivere = rip.daCompilare.length + rip.daSostituire.length

  return {
    titolo: `${def?.label ?? chiave} → ${etichettaValore(chiave, valore)}`,
    righe,
    azione: daScrivere > 0 ? `Applica a ${daScrivere} ${daScrivere === 1 ? 'riga' : 'righe'}` : 'Niente da applicare',
    applicabile: daScrivere > 0,
  }
}

/** Le proprietà costruttive esistono solo sui compressori: su un serbatoio non vogliono dire nulla. */
export function soloCompressori(righe: EquipmentCatalogItem[]): boolean {
  return righe.length > 0 && righe.every(r => r.tipo_apparecchiatura === 'Compressori')
}

/**
 * «2 righe hanno» — il numero davanti, una volta sola nella frase.
 *
 * Esportata perché la concordanza singolare/plurale serve anche fuori da questo file — alla
 * barra, per dire quante righe della selezione non sono compressori — e non va riscritta lì.
 */
export function conta(n: number, uno: string, molti: string): string {
  return `${n} ${n === 1 ? uno : molti}`
}

/** «verranno compilate» — la sola concordanza, senza ripetere il numero a metà frase. */
function scegli(n: number, uno: string, molti: string): string {
  return n === 1 ? uno : molti
}
