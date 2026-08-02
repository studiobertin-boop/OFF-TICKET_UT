import { EQUIPMENT_DEFS, type EquipmentKind } from '@/components/technicalSheet/table/equipmentConfig'
import { canonicalFromForm } from './specsNormalization'
import type { SheetEquipmentRef } from './types'

/**
 * Appiattisce le apparecchiature censite nelle schede dati.
 *
 * `equipment_data` è un JSONB con un array per tipo, più le valvole di sicurezza
 * annidate dentro serbatoi e disoleatori — una obbligatoria e un numero libero di
 * aggiuntive. Il motore ha bisogno di una lista piatta e uniforme, con i valori
 * già tradotti nelle chiavi canoniche del catalogo.
 */

export interface RawSheet {
  id: string
  requestId: string
  codicePratica: string | null
  equipmentData: Record<string, unknown> | null
}

/** Chiave dell'array in equipment_data → tipo di apparecchiatura. */
const ARRAY_KINDS: ReadonlyArray<readonly [string, EquipmentKind]> = [
  ['serbatoi', 'serbatoio'],
  ['compressori', 'compressore'],
  ['disoleatori', 'disoleatore'],
  ['essiccatori', 'essiccatore'],
  ['scambiatori', 'scambiatore'],
  ['filtri', 'filtro'],
  ['recipienti_filtro', 'recipiente'],
  ['separatori', 'separatore'],
]

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function asString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

function makeRef(
  sheet: RawSheet,
  kind: EquipmentKind,
  path: string,
  codice: string,
  item: Record<string, unknown>
): SheetEquipmentRef {
  const def = EQUIPMENT_DEFS[kind]
  return {
    technicalDataId: sheet.id,
    requestId: sheet.requestId,
    codicePratica: sheet.codicePratica,
    path,
    codice,
    kind,
    catalogType: def.catalogType,
    marca: asString(item.marca),
    modello: asString(item.modello),
    values: canonicalFromForm(def.catalogType, item),
  }
}

/**
 * Le valvole non hanno un array proprio: vivono dentro l'apparecchiatura che
 * proteggono, e il loro codice deriva da quello del recipiente (S1 → S1.1).
 */
function collectValvole(
  sheet: RawSheet,
  parentPath: string,
  parentCodice: string,
  parent: Record<string, unknown>
): SheetEquipmentRef[] {
  const out: SheetEquipmentRef[] = []

  const principale = asRecord(parent.valvola_sicurezza)
  if (principale) {
    out.push(
      makeRef(sheet, 'valvola', `${parentPath}.valvola_sicurezza`, `${parentCodice}.1`, principale)
    )
  }

  const aggiuntive = Array.isArray(parent.valvole_aggiuntive) ? parent.valvole_aggiuntive : []
  aggiuntive.forEach((raw, i) => {
    const v = asRecord(raw)
    if (!v) return
    out.push(
      makeRef(
        sheet,
        'valvola',
        `${parentPath}.valvole_aggiuntive[${i}]`,
        `${parentCodice}.${i + 2}`,
        v
      )
    )
  })

  return out
}

export function flattenSheetEquipment(sheets: RawSheet[]): SheetEquipmentRef[] {
  const out: SheetEquipmentRef[] = []

  for (const sheet of sheets) {
    const data = sheet.equipmentData
    if (!data) continue

    for (const [arrayKey, kind] of ARRAY_KINDS) {
      const list = Array.isArray(data[arrayKey]) ? (data[arrayKey] as unknown[]) : []

      list.forEach((raw, i) => {
        const item = asRecord(raw)
        if (!item) return

        const path = `${arrayKey}[${i}]`
        const codice = asString(item.codice) ?? `${EQUIPMENT_DEFS[kind].prefix}${i + 1}`

        // Una riga senza marca né modello è una riga vuota del form, non un censimento.
        if (asString(item.marca) || asString(item.modello)) {
          out.push(makeRef(sheet, kind, path, codice, item))
        }

        out.push(
          ...collectValvole(sheet, path, codice, item).filter(v => v.marca !== null || v.modello !== null)
        )
      })
    }
  }

  return out
}
