/**
 * Engine — tabelle di verifica delle valvole di sicurezza.
 *
 * Tabella portata: "Adeguato" se portata da elaborare ≤ portata scaricata alla taratura.
 * - valvola di disoleatore (Cx.2): portata da elaborare = portata del compressore Cx.
 * - valvola di serbatoio (Sx.1): portata da elaborare = somma delle portate dei
 *   compressori collegati (da additional_info.collegamentiCompressoriSerbatoi).
 *
 * Tabella pressione: "Adeguato" se pressione di taratura ≤ PS del recipiente associato.
 */
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import type {
  AdditionalInfo,
  EngineOptions,
  PortataValvolaRow,
  PressioneValvolaRow,
  ValvolaConnessa,
  ValvoleModel,
} from '../types'
import { codiceValvolaDisoleatore, codiceValvolaSerbatoio, formatNumberIT } from '../helpers'

export function buildValvole(
  scheda: SchedaDatiCompleta,
  additionalInfo: AdditionalInfo,
  options: EngineOptions = {}
): ValvoleModel {
  const resolve = options.resolveCostruttore ?? ((m?: string) => m ?? '')
  const portata: PortataValvolaRow[] = []
  const pressione: PressioneValvolaRow[] = []

  const connessa = (
    pos: string,
    descrizione: string,
    marca: string | undefined,
    modello: string | undefined
  ): ValvolaConnessa => ({ pos, descrizione, costruttore: resolve(marca), modello: modello ?? '' })

  const compressori = scheda.compressori ?? []

  // Valvole dei disoleatori
  for (const c of compressori) {
    const diso = (scheda.disoleatori ?? []).find((d) => d.compressore_associato === c.codice)
    if (!diso) continue
    const posV = codiceValvolaDisoleatore(diso.codice)
    const v = diso.valvola_sicurezza
    const nFabbricaValvola = v.n_fabbrica ?? ''

    const portataMax = c.volume_aria_prodotto ?? 0
    const scaricato = v.volume_aria_scaricato ?? 0
    portata.push({
      posValvola: posV,
      nFabbricaValvola,
      connesse: [connessa(c.codice, 'Compressore', c.marca, c.modello)],
      portataMax: formatNumberIT(portataMax),
      portataScaricata: formatNumberIT(scaricato),
      adeguato: portataMax <= scaricato,
    })

    const ps = diso.ps_pressione_max ?? 0
    const taratura = v.pressione_taratura ?? 0
    pressione.push({
      posValvola: posV,
      nFabbricaValvola,
      connesse: [connessa(diso.codice, 'Serbatoio disoleatore', diso.marca, diso.modello)],
      psRecipiente: formatNumberIT(ps),
      pressioneTaratura: formatNumberIT(taratura),
      adeguato: taratura <= ps,
    })
  }

  // Valvole dei serbatoi
  const collegamenti = additionalInfo.collegamentiCompressoriSerbatoi ?? {}
  for (const s of scheda.serbatoi ?? []) {
    const posV = codiceValvolaSerbatoio(s.codice)
    const v = s.valvola_sicurezza
    const nFabbricaValvola = v.n_fabbrica ?? ''

    const connessi = compressori.filter((c) => (collegamenti[c.codice] ?? []).includes(s.codice))
    const portataMax = connessi.reduce((sum, c) => sum + (c.volume_aria_prodotto ?? 0), 0)
    const scaricato = v.volume_aria_scaricato ?? 0
    portata.push({
      posValvola: posV,
      nFabbricaValvola,
      connesse: connessi.map((c) => connessa(c.codice, 'Compressore', c.marca, c.modello)),
      portataMax: formatNumberIT(portataMax),
      portataScaricata: formatNumberIT(scaricato),
      adeguato: portataMax <= scaricato,
    })

    const ps = s.ps_pressione_max ?? 0
    const taratura = v.pressione_taratura ?? 0
    pressione.push({
      posValvola: posV,
      nFabbricaValvola,
      connesse: [connessa(s.codice, 'Serbatoio aria verticale', s.marca, s.modello)],
      psRecipiente: formatNumberIT(ps),
      pressioneTaratura: formatNumberIT(taratura),
      adeguato: taratura <= ps,
    })
  }

  return { portata, pressione }
}
