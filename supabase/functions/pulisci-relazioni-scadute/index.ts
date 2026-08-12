import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { statoScadenza, GIORNI_PREAVVISO } from '../../../src/services/fascicolo/scadenza.ts'

/**
 * Edge Function: pulisci-relazioni-scadute
 *
 * Gemella di pulisci-dichiarazioni-scadute, stessa struttura e stesso cron giornaliero, ma
 * per relazione_documenti/relazione_scadenze/relazione_movimenti e il bucket relazioni. La
 * regola di scadenza è la stessa identica di src/services/fascicolo/scadenza.ts — non
 * duplicata.
 */

const BUCKET = 'relazioni'
const PAGINA = 1000

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
  const esito = { preavvisate: 0, purgate: 0, fileCancellati: 0 }
  const errori: string[] = []

  try {
    const movimenti = await leggiTutto<{
      request_id: string
      stato: string
      aggiornata_il: string | null
      creata_il: string
      ultimo_cambio_stato: string | null
    }>(supabase, 'relazione_movimenti', '*', 'request_id')

    for (const m of movimenti) {
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
            .from('relazione_documenti')
            .select('id, file_path')
            .eq('request_id', m.request_id)
          if (erroreLettura) throw erroreLettura
          if (!documenti?.length) continue

          const confermati = await rimuoviByte(
            supabase, documenti.map((d) => d.file_path), 'Rimozione dei file scaduti'
          )

          const { error: erroreScadenza } = await supabase.from('relazione_scadenze').upsert(
            { request_id: m.request_id, n_file: documenti.length, purgato_il: adesso.toISOString() },
            { onConflict: 'request_id' }
          )
          if (erroreScadenza) throw erroreScadenza

          const { error: erroreDelete } = await supabase
            .from('relazione_documenti')
            .delete()
            .eq('request_id', m.request_id)
          if (erroreDelete) throw erroreDelete

          esito.purgate++
          esito.fileCancellati += confermati
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

    const success = errori.length === 0
    return new Response(
      JSON.stringify({ success, ...esito, ...(errori.length ? { errori } : {}) }),
      { status: success ? 200 : 500, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (erroreGenerale) {
    console.error('Pulizia non riuscita:', erroreGenerale)
    return new Response(
      JSON.stringify({ success: false, error: String(erroreGenerale), ...esito }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

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

async function rimuoviByte(
  supabase: ReturnType<typeof createClient>,
  percorsi: string[],
  descrizione: string
): Promise<number> {
  const { data: rimossi, error } = await supabase.storage.from(BUCKET).remove(percorsi)
  if (error) throw new Error(`${descrizione} non riuscita: ${error.message}`)
  const confermati = rimossi?.length ?? 0
  if (confermati > 0 && confermati !== percorsi.length) {
    throw new Error(`${descrizione}: richiesti ${percorsi.length}, confermati ${confermati}`)
  }
  return confermati
}

async function preavvisaSeServe(
  supabase: ReturnType<typeof createClient>,
  requestId: string,
  quando: Date,
  adesso: Date
): Promise<boolean> {
  const da = new Date(adesso.getTime() - (GIORNI_PREAVVISO + 1) * 24 * 60 * 60 * 1000).toISOString()
  const { data: gia, error: erroreLettura } = await supabase
    .from('notifications')
    .select('id')
    .eq('request_id', requestId)
    .eq('type', 'relazione_in_scadenza')
    .gte('created_at', da)
    .limit(1)
  if (erroreLettura) throw erroreLettura
  if (gia?.length) return false

  const { data: pratica, error: erroreRichiesta } = await supabase
    .from('requests')
    .select('title')
    .eq('id', requestId)
    .single()
  if (erroreRichiesta) throw erroreRichiesta

  const { data: destinatariRuoli, error: erroreUtenti } = await supabase
    .from('users')
    .select('id')
    .in('role', ['admin', 'userdm329'])
  if (erroreUtenti) throw erroreUtenti

  const destinatari = new Set<string>((destinatariRuoli ?? []).map((u) => u.id))
  if (destinatari.size === 0) return false

  const giorno = quando.toLocaleDateString('it-IT')
  const { error: erroreInvio } = await supabase.from('notifications').insert(
    [...destinatari].map((user_id) => ({
      user_id,
      request_id: requestId,
      type: 'relazione_in_scadenza',
      event_type: 'relazione_in_scadenza',
      read: false,
      message: `La relazione tecnica di «${pratica?.title ?? 'una pratica'}» verrà cancellata il ${giorno}. Scaricala se ti serve.`,
    }))
  )
  if (erroreInvio) throw erroreInvio
  return true
}
