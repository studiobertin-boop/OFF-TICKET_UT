import { supabase } from '../supabase'
import type { DismissalRecord, Finding, RawSheet } from '@/services/equipmentAudit'

/**
 * Accesso ai dati della verifica di coerenza: le archiviazioni e le schede dati.
 *
 * Il parsing delle schede non sta qui ma nel motore (`flattenSheetEquipment`),
 * così resta logica pura e verificabile.
 */

interface DismissalRow {
  finding_key: string
  payload_hash: string
  motivazione: string
  created_at: string
  dismissed_by: string | null
}

export const equipmentDismissalsApi = {
  async listAll(): Promise<DismissalRecord[]> {
    const { data, error } = await supabase
      .from('equipment_check_dismissals')
      .select('finding_key, payload_hash, motivazione, created_at, dismissed_by')

    if (error) {
      throw new Error(`Errore nel caricamento delle segnalazioni archiviate: ${error.message}`)
    }

    return ((data ?? []) as DismissalRow[]).map(r => ({
      findingKey: r.finding_key,
      payloadHash: r.payload_hash,
      motivazione: r.motivazione,
      dismissedAt: r.created_at,
      dismissedByName: null,
    }))
  },

  /**
   * Archivia una segnalazione.
   *
   * Registra anche l'impronta dei valori coinvolti: se cambiano, la segnalazione
   * riemerge da sola invece di restare sepolta sotto una valutazione superata.
   */
  async dismiss(finding: Finding, motivazione: string): Promise<void> {
    const testo = motivazione.trim()
    if (testo.length < 5) {
      throw new Error('Serve una motivazione di almeno 5 caratteri')
    }

    const { data: session } = await supabase.auth.getUser()

    const { error } = await supabase.from('equipment_check_dismissals').upsert(
      {
        finding_key: finding.key,
        rule_id: finding.rule,
        payload_hash: finding.payloadHash,
        scope: finding.scope,
        entity_ids: finding.entities.filter(e => e.kind === 'catalog').map(e => e.id),
        motivazione: testo,
        dismissed_by: session.user?.id ?? null,
      },
      { onConflict: 'finding_key' }
    )

    if (error) {
      throw new Error(`Errore nell’archiviazione della segnalazione: ${error.message}`)
    }
  },

  async restore(findingKey: string): Promise<void> {
    const { error } = await supabase
      .from('equipment_check_dismissals')
      .delete()
      .eq('finding_key', findingKey)

    if (error) {
      throw new Error(`Errore nel ripristino della segnalazione: ${error.message}`)
    }
  },
}

interface SheetRow {
  id: string
  request_id: string
  equipment_data: Record<string, unknown> | null
  requests: { title: string | null } | { title: string | null }[] | null
}

export const equipmentSheetsApi = {
  /**
   * Schede dati con apparecchiature censite.
   *
   * L'etichetta della pratica è il titolo della richiesta: il codice pratica si
   * compone lato client da più sorgenti e qui servirebbe solo a farsi riconoscere.
   */
  async listRawSheets(): Promise<RawSheet[]> {
    const { data, error } = await supabase
      .from('dm329_technical_data')
      .select('id, request_id, equipment_data, requests(title)')
      .not('equipment_data', 'eq', '{}')

    if (error) {
      throw new Error(`Errore nel caricamento delle schede dati: ${error.message}`)
    }

    return ((data ?? []) as SheetRow[]).map(r => {
      const req = Array.isArray(r.requests) ? r.requests[0] : r.requests
      return {
        id: r.id,
        requestId: r.request_id,
        etichettaPratica: req?.title ?? null,
        equipmentData: r.equipment_data,
      }
    })
  },
}
