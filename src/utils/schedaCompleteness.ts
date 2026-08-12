import type { DatiGenerali, DatiImpianto } from '@/types/technicalSheet'
import {
  EQUIPMENT_DEFS,
  KIND_ARRAY,
  type EquipmentKind,
  type EquipmentTypeDef,
  type ExtraFieldDef,
} from '@/components/technicalSheet/table/equipmentConfig'

/**
 * Completezza della SCHEDA DATI DM329: quanti dei campi *previsti* per quel record
 * sono valorizzati.
 *
 * È un indicatore, non una validazione: non blocca il salvataggio né il completamento
 * della scheda, e nessun campo nuovo entra nel modello dati. Serve solo a dire, a
 * colpo d'occhio, dove manca qualcosa.
 *
 * La parola chiave è «previsti». Un filtro non ha PS, capacità, TS né categoria PED
 * (`EQUIPMENT_DEFS.filtro` li dichiara assenti): contarli lo terrebbe per sempre a
 * metà pur essendo compilato per quello che è. Il denominatore lo detta quindi il tipo,
 * non la lista di tutte le colonne della tabella.
 */

export interface Completezza {
  compilati: number
  previsti: number
  /**
   * Quanti dei compilati portano un valore scritto da qualcuno.
   *
   * Una spunta e un campo con default applicato dal motore risultano compilati anche se
   * nessuno li ha toccati — è giusto ai fini della percentuale, che dice quanti dati la
   * scheda ha — ma su una scheda mai aperta farebbero un 30% che non corrisponde a niente.
   * Questo conteggio è quello che distingue «non ancora cominciata» da «cominciata».
   */
  valorizzati: number
  /** Etichette dei campi previsti ma vuoti, nell'ordine in cui compaiono. */
  mancanti: string[]
}

/** Percentuale 0–100; una sezione senza campi previsti è completa, non a zero. */
export const percentuale = (c: Completezza) =>
  c.previsti === 0 ? 100 : Math.round((c.compilati / c.previsti) * 100)

export const eCompleta = (c: Completezza) => c.compilati >= c.previsti

/** Somma di più conteggi (le righe di una tabella, le bande di una sezione). */
export const somma = (parti: Completezza[]): Completezza => ({
  compilati: parti.reduce((n, p) => n + p.compilati, 0),
  previsti: parti.reduce((n, p) => n + p.previsti, 0),
  valorizzati: parti.reduce((n, p) => n + p.valorizzati, 0),
  mancanti: parti.flatMap((p) => p.mancanti),
})

/**
 * Valore presente. Lo zero numerico conta come compilato — un anno o una pressione
 * non valgono mai zero, ma un fondo scala sì — mentre `NaN` è quello che lascia in
 * campo un input numerico svuotato a metà.
 */
const presente = (v: unknown): boolean => {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim() !== ''
  if (typeof v === 'number') return !Number.isNaN(v)
  if (Array.isArray(v)) return v.length > 0
  return true
}

/** Lettura per percorso puntato (`manometro.fondo_scala`). */
const leggi = (riga: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>(
    (o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]),
    riga,
  )

/** Contatore incrementale: ogni campo dichiara se è previsto e se risulta compilato. */
class Conteggio {
  private c: Completezza = { compilati: 0, previsti: 0, valorizzati: 0, mancanti: [] }

  /**
   * Registra un campo previsto. `ok` a true lo dà per compilato; `valorizzato` distingue il
   * valore scritto dal compilato d'ufficio (spunte, default del motore) e vale `ok` quando
   * i due coincidono.
   */
  campo(label: string, ok: boolean, valorizzato: boolean = ok) {
    this.c.previsti += 1
    if (ok) this.c.compilati += 1
    else this.c.mancanti.push(label)
    if (valorizzato) this.c.valorizzati += 1
  }

  /** Registra un campo previsto solo se `quando` è vero (campi condizionali). */
  campoSe(quando: boolean, label: string, ok: boolean, valorizzato: boolean = ok) {
    if (quando) this.campo(label, ok, valorizzato)
  }

  get risultato(): Completezza {
    return this.c
  }
}

/**
 * Fuori dal conteggio: `note`, che è un commento e non un dato, e i campi dichiarati
 * opzionali — chiederli terrebbe a metà una riga che è compilata per quel che c'è da sapere.
 */
const extraDaIgnorare = (f: ExtraFieldDef) => f.name === 'note' || f.opzionale === true

/**
 * Un campo extra risulta compilato anche da vuoto quando:
 * - è una spunta: «falso» è una risposta, e non è distinguibile da «non ancora toccato»;
 * - ha un `emptyLabel`, cioè il motore applica comunque un default (orientamento →
 *   Verticale, ubicazione → Sala compressori): il valore è determinato.
 */
const extraCompilato = (f: ExtraFieldDef, riga: unknown) =>
  f.kind === 'check' || f.emptyLabel !== undefined || presente(leggi(riga, f.name))

/**
 * Un campo extra è previsto se la sua condizione di visibilità è soddisfatta.
 * `matricola_inail` non dichiara uno `showIf` — resta visibile anche senza denuncia —
 * ma è prevista solo a denuncia spuntata, con la stessa logica dei campi condizionali.
 */
const extraPrevisto = (f: ExtraFieldDef, riga: unknown) => {
  if (f.showIf) return leggi(riga, f.showIf.field) === f.showIf.equals
  if (f.name === 'matricola_inail') return !!leggi(riga, 'gia_denunciato')
  return true
}

/**
 * Completezza di una riga di apparecchiatura.
 *
 * Il denominatore non dipende dal ruolo: le colonne nascoste a `tecnicoDM329` restano
 * previste, altrimenti la stessa scheda mostrerebbe due percentuali diverse a due
 * persone. La categoria PED conta solo dove è un campo da compilare (`cat: 'edit'`):
 * sulle valvole è la costante IV, non un dato mancante.
 */
export const completezzaRiga = (def: EquipmentTypeDef, riga: unknown): Completezza => {
  const q = new Conteggio()
  const r = riga ?? {}
  const campo = (path: string) => presente(leggi(r, path))

  q.campo('Marca', campo('marca'))
  q.campo('Modello', campo('modello'))
  if (def.pressioneField && !def.pressioneTsOpzionali) q.campo('PS', campo(def.pressioneField))
  if (def.capacitaField) q.campo('Capacità', campo(def.capacitaField))
  if (def.ts && !def.pressioneTsOpzionali) q.campo('TS', campo('ts'))
  if (def.cat === 'edit') q.campo('Cat. PED', campo('categoria_ped'))
  q.campo('Anno', campo('anno'))
  q.campo('N° fabbrica', campo('n_fabbrica'))

  for (const f of def.extra) {
    if (extraDaIgnorare(f)) continue
    q.campoSe(extraPrevisto(f, r), f.label, extraCompilato(f, r), presente(leggi(r, f.name)))
  }

  return q.risultato
}

/**
 * Completezza di un recipiente e delle valvole che porta.
 *
 * Le valvole non hanno un array proprio — vivono dentro il recipiente — ma sono righe a
 * sé nella tabella, quindi contano come record distinti.
 */
const completezzaConValvole = (def: EquipmentTypeDef, riga: unknown): Completezza[] => {
  const parti = [completezzaRiga(def, riga)]
  if (!def.mandatoryValvola) return parti

  parti.push(completezzaRiga(EQUIPMENT_DEFS.valvola, leggi(riga, 'valvola_sicurezza')))
  for (const v of (leggi(riga, 'valvole_aggiuntive') ?? []) as unknown[]) {
    parti.push(completezzaRiga(EQUIPMENT_DEFS.valvola, v))
  }
  return parti
}

/** Tipi che compaiono nella tabella unica, ciascuno col proprio array nella scheda. */
const TIPI_IN_TABELLA: EquipmentKind[] = [
  'serbatoio', 'compressore', 'disoleatore', 'essiccatore',
  'scambiatore', 'filtro', 'recipiente', 'separatore',
]

/** Un conteggio per ogni riga della tabella, valvole comprese. */
const righeTabella = (scheda: unknown): Completezza[] =>
  TIPI_IN_TABELLA.flatMap((kind) => {
    const def = EQUIPMENT_DEFS[kind]
    const righe = (leggi(scheda, KIND_ARRAY[kind]) ?? []) as unknown[]
    return righe.flatMap((riga) => completezzaConValvole(def, riga))
  })

/**
 * Completezza dell'intera tabella apparecchiature, in campi.
 *
 * Conta anche i recipienti filtro, nascosti a `tecnicoDM329`: il denominatore descrive
 * la scheda, non chi la sta guardando.
 */
export const completezzaApparecchiature = (scheda: unknown): Completezza => somma(righeTabella(scheda))

/** Righe complete sul totale: il conteggio che accompagna la barra di sezione. */
export const righeComplete = (scheda: unknown): { complete: number; totali: number } => {
  const parti = righeTabella(scheda)
  return { complete: parti.filter(eCompleta).length, totali: parti.length }
}

/**
 * Completezza dell'intera scheda dati: contesto e apparecchiature nello stesso conteggio.
 *
 * È il numero che la testata della scheda mostra come percentuale, e quello da cui l'elenco
 * pratiche desume l'icona di compilazione: uno solo, altrimenti la stessa scheda risulterebbe
 * completa in un posto e a metà nell'altro.
 */
export const completezzaScheda = (scheda: unknown): Completezza => {
  const s = (scheda ?? {}) as Record<string, any>
  return somma([
    completezzaDatiGenerali(s.dati_generali),
    completezzaDatiImpianto(s.dati_impianto),
    completezzaApparecchiature(s),
  ])
}

/** Completezza della banda «sopralluogo». Le note generali sono un commento: escluse. */
export const completezzaDatiGenerali = (d: Partial<DatiGenerali> | undefined): Completezza => {
  const q = new Conteggio()
  const g = d ?? {}
  q.campo('Data sopralluogo', presente(g.data_sopralluogo))
  q.campo('Tecnico', presente(g.nome_tecnico))
  q.campo('Cliente', presente(g.cliente))
  q.campo('Installatore', presente(g.installatore))
  return q.risultato
}

/**
 * Completezza della banda «sala compressori».
 *
 * Due campi sono condizionali: «locale condiviso con» ha senso solo se il locale non è
 * dedicato, e le fonti di calore o i materiali infiammabili vicini solo se almeno una
 * delle due distanze non è dichiarata. Chiederli comunque terrebbe la sezione sotto il
 * 100% su schede che non hanno nulla da aggiungere.
 */
export const completezzaDatiImpianto = (d: Partial<DatiImpianto> | undefined): Completezza => {
  const q = new Conteggio()
  const i = d ?? {}

  q.campo('Aria aspirata', presente(i.aria_aspirata))
  q.campo('Raccolta condense', presente(i.raccolta_condense))
  q.campoSe(!i.locale_dedicato, 'Locale condiviso con', presente(i.locale_condiviso_con))

  // Spunte: sempre compilate, per la stessa ragione delle spunte di riga. Valgono come dato
  // scritto solo quando sono spuntate: a falso non si distinguono dal «mai aperta».
  q.campo('Locale dedicato', true, !!i.locale_dedicato)
  q.campo('Accesso al locale vietato', true, !!i.accesso_locale_vietato)
  q.campo('Lontano da fonti di calore', true, !!i.lontano_fonti_calore)
  q.campo('Lontano da materiale infiammabile', true, !!i.lontano_materiale_infiammabile)

  const tuttoLontano = !!i.lontano_fonti_calore && !!i.lontano_materiale_infiammabile
  q.campoSe(
    !tuttoLontano,
    'Fonti di calore o materiali infiammabili vicini',
    presente(i.fonti_calore_materiali_infiammabili),
  )

  q.campo('DN min collegamenti in sala', presente(i.dn_sala_min))
  q.campo('DN max collegamenti in sala', presente(i.dn_sala_max))
  q.campo('DN min linee di distribuzione', presente(i.dn_distribuzione_min))
  q.campo('DN max linee di distribuzione', presente(i.dn_distribuzione_max))

  return q.risultato
}
