import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { statoScadenza, GIORNI_PREAVVISO } from '../../../src/services/fascicolo/scadenza.ts'
import { collectCodes } from '../../../src/services/fascicolo/codiciScheda.ts'

/**
 * Edge Function: pulisci-fascicoli-scaduti
 *
 * Gira una volta al giorno, chiamata da pg_cron via pg_net. Fa tre cose: preavvisa chi ha
 * documenti in scadenza, cancella quelli scaduti, rimuove quelli agganciati a codici che la
 * scheda non contiene più.
 *
 * La regola di scadenza non è dichiarata qui: arriva da src/services/fascicolo/scadenza.ts,
 * la stessa che l'interfaccia usa per mostrare la data. La nozione di «codice valido» viene
 * allo stesso modo da src/services/fascicolo/codiciScheda.ts, la stessa che il client usa per
 * decidere quali documenti sono orfani quando si elimina una riga della scheda. Due copie di
 * uno qualunque dei due criteri divergerebbero.
 *
 * Endpoint distruttivo: non è raggiungibile con la sola anon key. Richiede l'header
 * `x-cron-key`, confrontato con il secret `CRON_SECRET` della funzione — lo stesso valore che
 * il job di pg_cron legge dal Vault. Nessuna intestazione CORS: non è pensato per un browser.
 */

const BUCKET = 'fascicoli'
/** Limite implicito di PostgREST: oltre questa soglia una `select` senza `.range()` tronca in silenzio. */
const PAGINA = 1000
/** Un centinaio di UUID per `.in()` resta ben sotto i limiti di lunghezza URL del proxy. */
const LOTTO = 100

serve(async (req) => {
  const chiaveAttesa = Deno.env.get('CRON_SECRET')
  if (!chiaveAttesa || req.headers.get('x-cron-key') !== chiaveAttesa) {
    return new Response(JSON.stringify({ success: false, error: 'Non autorizzato' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const adesso = new Date()
  const esito = { preavvisate: 0, purgate: 0, fileCancellati: 0, orfaniRimossi: 0 }
  const errori: string[] = []

  try {
    const movimenti = await leggiTutto<{
      request_id: string
      stato: string
      aggiornata_il: string | null
      creata_il: string
      ultimo_cambio_stato: string | null
    }>(supabase, 'fascicolo_movimenti', '*', 'request_id')

    for (const m of movimenti) {
      // Un errore su una pratica non deve fermare le altre: la passata continua, e questa
      // pratica verrà ritentata la notte successiva. Nulla di distruttivo resta a metà, per via
      // dell'ordine byte → nota di scadenza → righe più sotto.
      try {
        const stato = statoScadenza(
          {
            stato: m.stato,
            ultimoCambioStato: m.ultimo_cambio_stato,
            aggiornataIl: m.aggiornata_il,
            creataIl: m.creata_il,
          },
          adesso
        )

        if (stato.scaduta) {
          const { data: documenti, error: erroreLettura } = await supabase
            .from('fascicolo_documenti')
            .select('id, codice, file_path')
            .eq('request_id', m.request_id)
          if (erroreLettura) throw erroreLettura
          if (!documenti?.length) continue

          await rimuoviByte(supabase, documenti.map((d) => d.file_path), 'Rimozione dei file scaduti')

          // L'upsert su fascicolo_scadenze viene PRIMA della delete delle righe, non dopo: è
          // idempotente, quindi anticiparlo non ha controindicazioni. Se invece la delete
          // fallisse prima dell'upsert, la notte successiva la pratica avrebbe zero documenti
          // (righe già cancellate) e verrebbe saltata all'inizio del ciclo — la nota «fascicolo
          // scaduto il …» non verrebbe scritta mai più, e l'interfaccia mostrerebbe l'apparecchiatura
          // come se non avesse mai avuto documenti.
          const perCodice = new Map<string, number>()
          for (const d of documenti) perCodice.set(d.codice, (perCodice.get(d.codice) ?? 0) + 1)
          const { error: erroreScadenze } = await supabase.from('fascicolo_scadenze').upsert(
            [...perCodice].map(([codice, n_file]) => ({
              request_id: m.request_id, codice, n_file, purgato_il: adesso.toISOString(),
            })),
            { onConflict: 'request_id,codice' }
          )
          if (erroreScadenze) throw erroreScadenze

          const { error: erroreDelete } = await supabase
            .from('fascicolo_documenti')
            .delete()
            .eq('request_id', m.request_id)
          if (erroreDelete) throw erroreDelete

          esito.purgate++
          esito.fileCancellati += documenti.length
          continue
        }

        if (stato.inPreavviso) {
          const inviata = await preavvisaSeServe(supabase, m.request_id, stato.data, adesso)
          if (inviata) esito.preavvisate++
        }
      } catch (erroreMovimento) {
        errori.push(`pratica ${m.request_id}: ${String(erroreMovimento)}`)
      }
    }

    try {
      esito.orfaniRimossi = await rimuoviOrfani(supabase)
    } catch (erroreOrfani) {
      errori.push(`rimozione orfani: ${String(erroreOrfani)}`)
    }

    const success = errori.length === 0
    return new Response(
      JSON.stringify({ success, ...esito, ...(errori.length ? { errori } : {}) }),
      { status: success ? 200 : 500, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (erroreGenerale) {
    // Fallimenti non legati a una singola pratica — es. fascicolo_movimenti non si legge
    // affatto: qui non c'è nulla da isolare, la passata di stanotte si ferma subito.
    console.error('Pulizia non riuscita:', erroreGenerale)
    return new Response(
      JSON.stringify({ success: false, error: String(erroreGenerale), ...esito }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Legge tutte le righe di una tabella o vista, paginando oltre il limite implicito di
 * PostgREST (1000 righe): senza, una lettura più grande tronca in silenzio, e le righe rimaste
 * fuori non scadono né si preavvisano mai. `ordinaPer` deve essere una colonna che identifica
 * univocamente la riga (qui: la chiave primaria o `request_id`, sempre univoco per query), così
 * la paginazione è stabile — nessuna riga saltata o duplicata fra una pagina e la successiva.
 */
async function leggiTutto<T>(
  supabase: ReturnType<typeof createClient>,
  tabella: string,
  colonne: string,
  ordinaPer: string
): Promise<T[]> {
  const righe: T[] = []
  let da = 0
  for (;;) {
    const { data, error } = await supabase
      .from(tabella)
      .select(colonne)
      .order(ordinaPer, { ascending: true })
      .range(da, da + PAGINA - 1)
    if (error) throw error
    if (!data?.length) break
    righe.push(...(data as T[]))
    if (data.length < PAGINA) break
    da += PAGINA
  }
  return righe
}

/** Spezza un array in lotti di `LOTTO` elementi, per non sfondare la lunghezza URL di `.in()`. */
function* inLotti<T>(elementi: T[]): Generator<T[]> {
  for (let i = 0; i < elementi.length; i += LOTTO) yield elementi.slice(i, i + LOTTO)
}

/**
 * Cancella i byte dal bucket e ne verifica il numero di conferme.
 *
 * Zero conferme è lo stato atteso quando questa passata ritenta una rimozione i cui byte erano
 * già spariti in un tentativo precedente (un passo successivo — upsert o delete — era fallito
 * dopo che lo Storage aveva già tolto tutto): rimuovere un percorso assente non è un errore per
 * lo Storage, e coincide col caso «già fatto», non con un fallimento. Un conteggio intermedio
 * (0 < conferme < richieste) è invece un'anomalia reale — alcuni file rimossi e altri no — e va
 * fermata: `fileCancellati` deve contare ciò che lo Storage conferma, non i percorsi richiesti.
 */
async function rimuoviByte(
  supabase: ReturnType<typeof createClient>,
  percorsi: string[],
  descrizione: string
): Promise<void> {
  const { data: rimossi, error } = await supabase.storage.from(BUCKET).remove(percorsi)
  if (error) throw new Error(`${descrizione} non riuscita: ${error.message}`)
  const confermati = rimossi?.length ?? 0
  if (confermati > 0 && confermati !== percorsi.length) {
    throw new Error(`${descrizione}: richiesti ${percorsi.length}, confermati ${confermati}`)
  }
}

/** Avvisa tecnico assegnato e admin, una volta sola per finestra di preavviso. */
async function preavvisaSeServe(
  supabase: ReturnType<typeof createClient>,
  requestId: string,
  quando: Date,
  adesso: Date
): Promise<boolean> {
  // Un giorno di margine oltre GIORNI_PREAVVISO: `inPreavviso` resta vero per GIORNI_PREAVVISO + 1
  // esecuzioni (giorniMancanti da GIORNI_PREAVVISO a 0 compresi). Guardare indietro di soli
  // GIORNI_PREAVVISO giorni lascia l'ultima esecuzione della finestra senza margine — un'esecuzione
  // che parte anche solo qualche istante più tardi del previsto (jitter di rete, cold start) fa
  // scivolare il confronto oltre il bordo esatto, la notifica dell'inizio finestra non viene più
  // trovata, e parte un secondo preavviso per la stessa pratica.
  const da = new Date(adesso.getTime() - (GIORNI_PREAVVISO + 1) * 24 * 60 * 60 * 1000).toISOString()
  const { data: gia, error: erroreLettura } = await supabase
    .from('notifications')
    .select('id')
    .eq('request_id', requestId)
    .eq('type', 'fascicolo_in_scadenza')
    .gte('created_at', da)
    .limit(1)
  if (erroreLettura) throw erroreLettura
  if (gia?.length) return false

  const { data: pratica, error: erroreRichiesta } = await supabase
    .from('requests')
    .select('assigned_to, title')
    .eq('id', requestId)
    .single()
  if (erroreRichiesta) throw erroreRichiesta

  const { data: admin, error: erroreAdmin } = await supabase.from('users').select('id').eq('role', 'admin')
  if (erroreAdmin) throw erroreAdmin

  const destinatari = new Set<string>((admin ?? []).map((u) => u.id))
  if (pratica?.assigned_to) destinatari.add(pratica.assigned_to)
  if (destinatari.size === 0) return false

  const giorno = quando.toLocaleDateString('it-IT')
  const { error: erroreInvio } = await supabase.from('notifications').insert(
    [...destinatari].map((user_id) => ({
      user_id,
      request_id: requestId,
      type: 'fascicolo_in_scadenza',
      event_type: 'fascicolo_in_scadenza',
      read: false,
      message: `I documenti del fascicolo di «${pratica?.title ?? 'una pratica'}» verranno cancellati il ${giorno}. Scaricali se ti servono.`,
    }))
  )
  if (erroreInvio) throw erroreInvio
  return true
}

/**
 * Documenti agganciati a codici che la scheda non contiene più.
 *
 * L'interfaccia già li toglie quando si elimina una riga; questa è la rete per ciò che le
 * sfugge: importazioni Excel, retro-coding, modifiche fatte da un'altra sessione. `collectCodes`
 * è la stessa funzione che usa il client: un criterio duplicato qui avrebbe potuto divergere da
 * quello con cui l'interfaccia decide gli stessi orfani.
 */
async function rimuoviOrfani(supabase: ReturnType<typeof createClient>): Promise<number> {
  const documenti = await leggiTutto<{ id: string; request_id: string; codice: string; file_path: string }>(
    supabase, 'fascicolo_documenti', 'id, request_id, codice, file_path', 'id'
  )
  if (!documenti.length) return 0

  const pratiche = [...new Set(documenti.map((d) => d.request_id))]
  const schede: { request_id: string; equipment_data: unknown }[] = []
  for (const lotto of inLotti(pratiche)) {
    const { data, error } = await supabase
      .from('dm329_technical_data')
      .select('request_id, equipment_data')
      .in('request_id', lotto)
    // Senza le schede ogni documento del lotto sembrerebbe orfano: meglio non cancellare niente
    // che cancellare tutto per una lettura fallita.
    if (error) throw error
    schede.push(...(data ?? []))
  }

  const codiciDi = new Map<string, Set<string>>()
  for (const s of schede) codiciDi.set(s.request_id, collectCodes(s.equipment_data))

  // Una pratica di cui non è tornata la scheda si salta: è un'assenza di informazione, non la
  // prova che i codici non esistano più. 333 schede su 359 hanno equipment_data vuoto — sono
  // pratiche vecchie senza apparecchiature, e infatti non hanno documenti da rimuovere.
  const orfani = documenti.filter((d) => {
    const codici = codiciDi.get(d.request_id)
    return codici ? !codici.has(d.codice) : false
  })
  if (orfani.length === 0) return 0

  await rimuoviByte(supabase, orfani.map((d) => d.file_path), 'Rimozione dei file orfani')

  for (const lotto of inLotti(orfani.map((d) => d.id))) {
    const { error: erroreDelete } = await supabase.from('fascicolo_documenti').delete().in('id', lotto)
    if (erroreDelete) throw erroreDelete
  }

  return orfani.length
}
