import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { statoScadenza, GIORNI_PREAVVISO } from '../../../src/services/fascicolo/scadenza.ts'

/**
 * Edge Function: pulisci-fascicoli-scaduti
 *
 * Gira una volta al giorno, chiamata da pg_cron via pg_net. Fa tre cose: preavvisa chi ha
 * documenti in scadenza, cancella quelli scaduti, rimuove quelli agganciati a codici che la
 * scheda non contiene più.
 *
 * La regola di scadenza non è dichiarata qui: arriva da src/services/fascicolo/scadenza.ts,
 * la stessa che l'interfaccia usa per mostrare la data. Due copie divergerebbero.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKET = 'fascicoli'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const adesso = new Date()
  const esito = { preavvisate: 0, purgate: 0, fileCancellati: 0, orfaniRimossi: 0 }

  try {
    const { data: movimenti, error } = await supabase.from('fascicolo_movimenti').select('*')
    if (error) throw error

    for (const m of movimenti ?? []) {
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
        const { data: documenti } = await supabase
          .from('fascicolo_documenti')
          .select('id, codice, file_path')
          .eq('request_id', m.request_id)
        if (!documenti?.length) continue

        // Prima i byte, poi le righe: se lo Storage fallisce ci si ferma qui, senza cancellare
        // le righe. Inghiottire l'errore lascerebbe un file irraggiungibile nel bucket — nessuna
        // riga punta più a lui, la prossima passata non lo ritenta perché per lei il documento
        // non esiste già più — cioè spazio perso per sempre, silenziosamente.
        const { error: erroreStorage } = await supabase.storage
          .from(BUCKET)
          .remove(documenti.map((d) => d.file_path))
        if (erroreStorage) throw new Error(`Rimozione dei file scaduti non riuscita: ${erroreStorage.message}`)

        const { error: erroreDelete } = await supabase
          .from('fascicolo_documenti')
          .delete()
          .eq('request_id', m.request_id)
        if (erroreDelete) throw erroreDelete

        // Una riga di scadenza per apparecchiatura, col numero di file che portava via.
        const perCodice = new Map<string, number>()
        for (const d of documenti) perCodice.set(d.codice, (perCodice.get(d.codice) ?? 0) + 1)
        const { error: erroreScadenze } = await supabase.from('fascicolo_scadenze').upsert(
          [...perCodice].map(([codice, n_file]) => ({
            request_id: m.request_id, codice, n_file, purgato_il: adesso.toISOString(),
          })),
          { onConflict: 'request_id,codice' }
        )
        if (erroreScadenze) throw erroreScadenze

        esito.purgate++
        esito.fileCancellati += documenti.length
        continue
      }

      if (stato.inPreavviso) {
        const inviata = await preavvisaSeServe(supabase, m.request_id, stato.data, adesso)
        if (inviata) esito.preavvisate++
      }
    }

    esito.orfaniRimossi = await rimuoviOrfani(supabase)

    return new Response(JSON.stringify({ success: true, ...esito }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (errore) {
    console.error('Pulizia non riuscita:', errore)
    return new Response(
      JSON.stringify({ success: false, error: String(errore), ...esito }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/** Avvisa tecnico assegnato e admin, una volta sola per finestra di preavviso. */
async function preavvisaSeServe(
  supabase: ReturnType<typeof createClient>,
  requestId: string,
  quando: Date,
  adesso: Date
): Promise<boolean> {
  const da = new Date(adesso.getTime() - GIORNI_PREAVVISO * 24 * 60 * 60 * 1000).toISOString()
  const { data: gia } = await supabase
    .from('notifications')
    .select('id')
    .eq('request_id', requestId)
    .eq('type', 'fascicolo_in_scadenza')
    .gte('created_at', da)
    .limit(1)
  if (gia?.length) return false

  const { data: pratica } = await supabase
    .from('requests')
    .select('assigned_to, title')
    .eq('id', requestId)
    .single()
  const { data: admin } = await supabase.from('users').select('id').eq('role', 'admin')

  const destinatari = new Set<string>((admin ?? []).map((u) => u.id))
  if (pratica?.assigned_to) destinatari.add(pratica.assigned_to)
  if (destinatari.size === 0) return false

  const giorno = quando.toLocaleDateString('it-IT')
  await supabase.from('notifications').insert(
    [...destinatari].map((user_id) => ({
      user_id,
      request_id: requestId,
      type: 'fascicolo_in_scadenza',
      event_type: 'fascicolo_in_scadenza',
      read: false,
      message: `I documenti del fascicolo di «${pratica?.title ?? 'una pratica'}» verranno cancellati il ${giorno}. Scaricali se ti servono.`,
    }))
  )
  return true
}

/**
 * Documenti agganciati a codici che la scheda non contiene più.
 *
 * L'interfaccia già li toglie quando si elimina una riga; questa è la rete per ciò che le
 * sfugge: importazioni Excel, retro-coding, modifiche fatte da un'altra sessione.
 */
async function rimuoviOrfani(supabase: ReturnType<typeof createClient>): Promise<number> {
  const { data: documenti } = await supabase
    .from('fascicolo_documenti')
    .select('id, request_id, codice, file_path')
  if (!documenti?.length) return 0

  const pratiche = [...new Set(documenti.map((d) => d.request_id))]
  const { data: schede, error } = await supabase
    .from('dm329_technical_data')
    .select('request_id, equipment_data')
    .in('request_id', pratiche)

  // Senza le schede ogni documento sembrerebbe orfano: meglio non cancellare niente che
  // cancellare tutto per una lettura fallita.
  if (error) throw error

  const codiciDi = new Map<string, Set<string>>()
  for (const s of schede ?? []) {
    const codici = new Set<string>()
    for (const valore of Object.values(s.equipment_data ?? {})) {
      if (!Array.isArray(valore)) continue
      for (const riga of valore) {
        if (riga && typeof riga.codice === 'string') codici.add(riga.codice.trim())
      }
    }
    codiciDi.set(s.request_id, codici)
  }

  // Una pratica di cui non è tornata la scheda si salta: è un'assenza di informazione, non la
  // prova che i codici non esistano più. 333 schede su 359 hanno equipment_data vuoto — sono
  // pratiche vecchie senza apparecchiature, e infatti non hanno documenti da rimuovere.
  const orfani = documenti.filter((d) => {
    const codici = codiciDi.get(d.request_id)
    return codici ? !codici.has(d.codice) : false
  })
  if (orfani.length === 0) return 0

  // Stesso ordine byte-poi-riga della purga sopra, per lo stesso motivo: un fallimento dello
  // Storage non deve produrre righe cancellate con file ancora nel bucket, altrimenti quei
  // file smettono di essere tracciati e nessuna passata futura li ritenterà.
  const { error: erroreStorage } = await supabase.storage.from(BUCKET).remove(orfani.map((d) => d.file_path))
  if (erroreStorage) throw new Error(`Rimozione dei file orfani non riuscita: ${erroreStorage.message}`)

  const { error: erroreDelete } = await supabase
    .from('fascicolo_documenti')
    .delete()
    .in('id', orfani.map((d) => d.id))
  if (erroreDelete) throw erroreDelete

  return orfani.length
}
