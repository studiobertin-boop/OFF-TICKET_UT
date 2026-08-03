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
  /**
   * Il verso opposto di `nonApplicabili`: righe che si scrivono, e che *dopo* la scrittura
   * porterebbero in un'altra chiave un valore diventato inapplicabile.
   *
   * Non è un gruppo alternativo agli altri — queste righe stanno anche in `daCompilare` o in
   * `daSostituire` — ma un secondo effetto della stessa scrittura. Marcare «a pistoni» un
   * modello su cui qualcuno aveva stabilito i giri variabili lascerebbe lì la regolazione:
   * il form la nasconde, la verifica di coerenza non la guarda, e la relazione firmata
   * finirebbe per dire «compressore a pistoni a giri variabili tramite inverter». Il dato va
   * quindi tolto nella stessa transazione, e detto prima nella conferma.
   */
  daRipulire: EquipmentCatalogItem[]
  /** Le chiavi che quella pulizia rimuove, unione sulle righe di `daRipulire`. */
  chiaviDaRipulire: string[]
}

/** Un campo si considera vuoto anche quando porta una stringa di soli spazi. */
function vuoto(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === ''
}

/**
 * Le chiavi che, sui dati come sarebbero dopo la scrittura, portano un valore che non si
 * applica più.
 *
 * La regola non è riscritta qui: si rilegge `appliesWhen` delle *altre* chiavi del contratto
 * canonico sugli specs risultanti. Se domani una proprietà costruttiva guadagnasse una
 * condizione — o la condizione dei giri cambiasse — questo calcolo la seguirebbe senza che
 * nessuno debba ricordarsi di questo file.
 *
 * Il limite da tenere presente: l'insieme così ottenuto viene poi applicato a tutte le righe
 * scritte, ed è corretto finché una chiave diventa inapplicabile *per effetto della chiave
 * che si sta scrivendo* — allora l'esito è lo stesso per ogni riga. Oggi è così: i giri
 * dipendono dal solo `tipo_compressore`, e nessun'altra chiave ha una condizione.
 */
function chiaviInapplicabiliDopo(
  specsRisultanti: Record<string, unknown>,
  chiaveScritta: ChiaveMassiva
): string[] {
  return (CANONICAL_SPECS.Compressori ?? [])
    .filter(
      d =>
        d.key !== chiaveScritta &&
        d.appliesWhen &&
        !d.appliesWhen(specsRisultanti) &&
        !vuoto(specsRisultanti[d.key])
    )
    .map(d => d.key)
}

/**
 * Divide le righe selezionate rispetto al valore che si sta per applicare.
 *
 * I gruppi non sono una comodità di presentazione: `daSostituire` sono le righe il cui
 * valore qualcuno ha già stabilito — sui giri, le 141 che il backfill aveva verificato una
 * a una — e cancellarne uno per sbaglio è silenzioso, perché il dato finisce in una frase
 * asseverata di una relazione firmata. `nonApplicabili` sono quelle su cui il dato non ha
 * senso del tutto, e la condizione la dichiara il contratto canonico stesso
 * (`appliesWhen`), non una regola duplicata qui. `daRipulire` è il verso opposto della stessa
 * condizione, riletta sui dati come sarebbero dopo la scrittura: quel che questa modifica
 * rende privo di senso non può restare a catalogo, perché nessuna interfaccia lo mostrerebbe
 * più mentre la relazione continuerebbe a leggerlo.
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
    daRipulire: [],
    chiaviDaRipulire: [],
  }
  const chiavi = new Set<string>()

  for (const riga of righe) {
    if (def?.appliesWhen && !def.appliesWhen(riga.specs ?? {})) {
      out.nonApplicabili.push(riga)
      continue
    }

    const attuale = riga.specs?.[chiave]

    if (vuoto(attuale)) out.daCompilare.push(riga)
    else if (String(attuale) === valore) {
      // Non si scrive, quindi niente cambia: quel che la riga porta resta come qualcuno
      // l'aveva lasciato, e non è questa operazione a doverlo rimettere in ordine.
      out.giaUguali.push(riga)
      continue
    } else out.daSostituire.push(riga)

    const risultanti = { ...((riga.specs ?? {}) as Record<string, unknown>), [chiave]: valore }
    const daTogliere = chiaviInapplicabiliDopo(risultanti, chiave)
    if (daTogliere.length > 0) {
      out.daRipulire.push(riga)
      daTogliere.forEach(k => chiavi.add(k))
    }
  }

  out.chiaviDaRipulire = [...chiavi]
  return out
}

/** Come il valore si dice all'utente: l'etichetta del contratto, non la sigla memorizzata. */
export function etichettaValore(chiave: ChiaveMassiva, valore: string): string {
  const def = (CANONICAL_SPECS.Compressori ?? []).find(d => d.key === chiave)
  return def?.optionLabels?.[valore] ?? valore
}

/** Come la chiave si dice all'utente. Vale per qualsiasi chiave del contratto, non solo le due. */
function etichettaChiave(chiave: string): string {
  const def = (CANONICAL_SPECS.Compressori ?? []).find(d => d.key === chiave)
  return def?.label ?? chiave
}

/**
 * Gli identificativi che verranno davvero scritti.
 *
 * Sta qui e non nel dialog perché è la regola che dice quali gruppi si scrivono, e vale una
 * volta sola: il numero annunciato dal pulsante e la lista mandata alla funzione a database
 * devono nascere dallo stesso calcolo. Contarli in un punto e sceglierli in un altro
 * significa che il giorno in cui uno dei due cambia il pulsante annuncia N e ne scrive M —
 * cioè proprio la cosa da cui questa conferma esiste per proteggere.
 */
export function idsDaScrivere(rip: RipartizioneMassiva): string[] {
  return [...rip.daCompilare, ...rip.daSostituire].map(r => r.id)
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
  /**
   * Una riga per gruppo non vuoto, nell'ordine: da compilare, da sostituire, da ripulire,
   * già uguali, non applicabili. La pulizia sta accanto alle sostituzioni perché è l'altra
   * cosa che questa scrittura toglie a un dato che qualcuno aveva stabilito.
   */
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

  if (rip.daRipulire.length > 0) {
    const n = rip.daRipulire.length
    const k = rip.chiaviDaRipulire.length
    // «con questa scelta» e non «con questo tipo»: la frase deve reggere anche il giorno in
    // cui è un'altra chiave a rendere inapplicabile qualcosa, senza sbagliare il genere.
    const quali = rip.chiaviDaRipulire.map(c => `«${etichettaChiave(c)}»`).join(' e ')
    righe.push(
      `${conta(n, 'riga porta', 'righe portano')} ${scegli(k, 'un valore', 'valori')} in ${quali} che con questa scelta ${scegli(k, 'non si applica più e verrà rimosso', 'non si applicano più e verranno rimossi')}: ${modelliDa(rip.daRipulire)}`
    )
  }

  if (rip.giaUguali.length > 0) {
    const n = rip.giaUguali.length
    righe.push(
      `${conta(n, 'riga ha', 'righe hanno')} già questo valore e ${scegli(n, "resta com'è", 'restano come sono')}`
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
        ? "1 riga non è un rotativo a vite e resta com'è"
        : `${n} righe non sono rotativi a vite e restano come sono`
    )
  }

  const daScrivere = idsDaScrivere(rip).length

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
