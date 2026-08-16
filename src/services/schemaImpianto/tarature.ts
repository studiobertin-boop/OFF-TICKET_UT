/**
 * Persistenza delle tarature permanenti (tabella `schema_simboli`): lo strato di libreria che
 * vale per ogni pratica, sopra il default di fabbrica del registro e sotto quella specifica
 * della pratica aperta (vedi `libreria.ts`).
 *
 * La lettura è di chiunque sia autenticato: il disegno serve a tutti. La scrittura è riservata
 * all'amministratore — sia lato RLS (migrazione `schema_simboli`) sia per come questo modulo va
 * chiamato dall'interfaccia — perché una taratura permanente cambia il disegno di OGNI pratica,
 * comprese quelle già consegnate al cliente: è una decisione presa col committente, non da
 * rimettere in discussione riga per riga.
 */
import { supabase } from '../supabase'
import type { Tarature, TaraturaSimbolo } from './libreria'
import { REGISTRO_SIMBOLI } from './symbols'
import type { ChiaveSimbolo } from './types'

/**
 * Vero se `v` ha davvero la forma di una `TaraturaSimbolo`. La colonna a database è JSONB senza
 * vincolo di forma: una riga scritta a mano, o rimasta da una versione precedente del formato,
 * deve poter essere scartata qui invece di far cadere l'editor più a valle (dove i campi mancanti
 * o mal tipati arriverebbero dentro un calcolo di trasformazione che non li controlla).
 */
function taraturaValida(v: unknown): v is TaraturaSimbolo {
  if (!v || typeof v !== 'object') return false
  const t = v as Record<string, unknown>
  if (typeof t.dx !== 'number' || typeof t.dy !== 'number') return false
  if (typeof t.sx !== 'number' || typeof t.sy !== 'number') return false
  if (!Array.isArray(t.ancore)) return false
  return t.ancore.every(
    (a) =>
      Boolean(a) &&
      typeof a === 'object' &&
      typeof (a as Record<string, unknown>).id === 'string' &&
      typeof (a as Record<string, unknown>).x === 'number' &&
      typeof (a as Record<string, unknown>).y === 'number' &&
      Array.isArray((a as Record<string, unknown>).accetta)
  )
}

/**
 * Dalle righe grezze lette dal database alla mappa che `risolviLibreria` sa usare. Pura, senza
 * accesso alla rete: è per questo che sta sotto test qui, mentre `leggiTaraturePermanenti` no.
 *
 * Scarta due categorie di riga, entrambe innocue da ignorare piuttosto che da far esplodere:
 * - corpo non riconoscibile come `TaraturaSimbolo` (`taraturaValida`);
 * - chiave che il registro simboli non conosce più (simbolo ritirato, o refuso mai ripulito).
 */
export function taratureDaRighe(righe: { chiave: string; taratura: unknown }[]): Tarature {
  const risolte: Tarature = {}
  for (const riga of righe) {
    if (!(riga.chiave in REGISTRO_SIMBOLI)) continue
    if (!taraturaValida(riga.taratura)) continue
    risolte[riga.chiave as ChiaveSimbolo] = riga.taratura
  }
  return risolte
}

/** Tutte le tarature permanenti oggi in vigore. */
export async function leggiTaraturePermanenti(): Promise<Tarature> {
  const { data, error } = await supabase.from('schema_simboli').select('chiave, taratura')
  if (error) throw new Error(`Errore nella lettura delle tarature permanenti: ${error.message}`)
  return taratureDaRighe(data ?? [])
}

/**
 * Scrive (o cancella) la taratura permanente di un simbolo. `t: null` cancella la riga — «torna
 * a default» significa proprio «nessuna riga», non una riga che ripete i valori di fabbrica: il
 * default di fabbrica resta nel codice (`REGISTRO_SIMBOLI`), non va duplicato a database.
 *
 * Nessun controllo di ruolo qui: lo impone la RLS della tabella (policy di scrittura riservata
 * all'admin). Un tecnico o un utente che la chiamasse riceverebbe l'errore di Postgres, non un
 * fallimento silenzioso.
 */
export async function scriviTaraturaPermanente(
  chiave: ChiaveSimbolo,
  t: TaraturaSimbolo | null
): Promise<void> {
  if (t === null) {
    const { error } = await supabase.from('schema_simboli').delete().eq('chiave', chiave)
    if (error) throw new Error(`Errore nella cancellazione della taratura di "${chiave}": ${error.message}`)
    return
  }

  const { data: sessione } = await supabase.auth.getUser()
  const { error } = await supabase.from('schema_simboli').upsert({
    chiave,
    taratura: t,
    aggiornato_da: sessione.user?.id ?? null,
    // Esplicito e non lasciato al default della colonna: il default a database si applica solo
    // all'INSERT, e questa è anche la strada dell'UPDATE (upsert su una chiave già presente).
    aggiornato_il: new Date().toISOString(),
  })
  if (error) throw new Error(`Errore nel salvataggio della taratura di "${chiave}": ${error.message}`)
}
