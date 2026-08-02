import { useEffect, useRef } from 'react'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import {
  generateCacheKey, rowKeyOf, useEquipmentCatalogContext,
} from '@/components/technicalSheet/EquipmentCatalogContext'
import { EQUIPMENT_DEFS, KIND_ARRAY, type EquipmentKind } from '@/components/technicalSheet/table/equipmentConfig'
import { readSheetPressure, variantSpecKey } from '@/services/equipmentAudit'
import { elencaValvole } from '@/utils/valvoleImpianto'
import type { EquipmentCatalogItem, EquipmentCatalogType, SchedaDatiCompleta } from '@/types'

/**
 * Riga della scheda da agganciare al catalogo: chiave di provenienza, tipo e coordinate.
 */
interface RigaDaAgganciare {
  rowKey: string
  tipo: EquipmentCatalogType
  marca: string
  modello: string
  /** Valore che identifica la variante, per i tipi che ne hanno più d'una. */
  variante: number | null
}

/** Tipi con dati tecnici da agganciare: filtri e separatori non ne hanno (`specsMap` vuota). */
const KIND_DA_AGGANCIARE = (Object.keys(EQUIPMENT_DEFS) as EquipmentKind[]).filter(
  (k) => k !== 'valvola' && Object.keys(EQUIPMENT_DEFS[k].specsMap).length > 0
)

/** Prefisso della chiave di provenienza delle valvole: non vivono in un array proprio. */
export const VALVOLE_ROW_PREFIX = 'valvole'

/** Righe della scheda che possono avere una voce di catalogo dietro. */
function righeDaAgganciare(scheda: SchedaDatiCompleta | null | undefined): RigaDaAgganciare[] {
  if (!scheda) return []
  const out: RigaDaAgganciare[] = []

  const aggiungi = (rowKey: string, tipo: EquipmentCatalogType, row: any, pressioneField?: string) => {
    if (!row?.marca || !row?.modello) return
    const variante = variantSpecKey(tipo) && pressioneField ? row[pressioneField] : null
    out.push({
      rowKey,
      tipo,
      marca: row.marca,
      modello: row.modello,
      variante: typeof variante === 'number' ? variante : null,
    })
  }

  for (const kind of KIND_DA_AGGANCIARE) {
    const def = EQUIPMENT_DEFS[kind]
    const arrayName = KIND_ARRAY[kind]
    const items = (scheda as any)[arrayName]
    if (!Array.isArray(items)) continue
    for (const row of items) {
      aggiungi(rowKeyOf(arrayName, row?.codice), def.catalogType, row, def.pressioneField)
    }
  }

  // Le valvole non stanno in un array proprio: la loro identità è la posizione nell'impianto.
  const defValvola = EQUIPMENT_DEFS.valvola
  for (const v of elencaValvole(scheda)) {
    aggiungi(rowKeyOf(VALVOLE_ROW_PREFIX, v.pos), defValvola.catalogType, v.valvola, defValvola.pressioneField)
  }

  return out
}

/** Sceglie fra le righe di catalogo di un modello quella che corrisponde alla variante della scheda. */
function scegliVariante(
  tipo: EquipmentCatalogType,
  candidate: EquipmentCatalogItem[],
  variante: number | null
): EquipmentCatalogItem | undefined {
  if (candidate.length <= 1 || variante === null) return candidate[0]
  // La scheda ha in mano la propria pressione di colonna: si cerca la riga che dichiara quella,
  // non quella che il catalogo usa per distinguere le varianti fra loro.
  return candidate.find((c) => readSheetPressure(tipo, c.specs) === variante) ?? candidate[0]
}

/**
 * Aggancia le righe di una scheda già compilata alle voci di catalogo da cui provengono.
 *
 * Senza questo, la cache del catalogo resta vuota per tutto ciò che non è stato selezionato
 * nella sessione corrente: riaprendo una scheda salvata non si saprebbe da quale voce vengono i
 * dati, e non si potrebbe né rilevare uno scostamento né proporre di riportarlo a catalogo.
 *
 * Una query per tipo, non una per riga. Gira una sola volta per scheda: la chiave di controllo
 * è l'identità dell'oggetto `defaultValues`, che cambia solo al caricamento o dopo un `reset`.
 */
export function useHydrateCatalogCache(scheda: SchedaDatiCompleta | null | undefined) {
  const { setCache, setOrigine } = useEquipmentCatalogContext()
  const gia = useRef<unknown>(null)

  useEffect(() => {
    if (!scheda || gia.current === scheda) return
    gia.current = scheda

    let annullato = false

    const carica = async () => {
      const righe = righeDaAgganciare(scheda)
      if (righe.length === 0) return

      const perTipo = new Map<EquipmentCatalogType, Set<string>>()
      for (const r of righe) {
        if (!perTipo.has(r.tipo)) perTipo.set(r.tipo, new Set())
        perTipo.get(r.tipo)!.add(r.marca)
      }

      const risultati = await Promise.all(
        [...perTipo.entries()].map(async ([tipo, marche]) => {
          try {
            return [tipo, await equipmentCatalogApi.findByMarche(tipo, [...marche])] as const
          } catch (e) {
            console.error('[useHydrateCatalogCache] Errore nel precaricamento', tipo, e)
            return [tipo, [] as EquipmentCatalogItem[]] as const
          }
        })
      )
      if (annullato) return

      const perChiave = new Map<string, EquipmentCatalogItem[]>()
      for (const [tipo, items] of risultati) {
        for (const item of items) {
          const k = `${tipo}|${item.marca}|${item.modello}`
          if (!perChiave.has(k)) perChiave.set(k, [])
          perChiave.get(k)!.push(item)
        }
      }

      for (const riga of righe) {
        const candidate = perChiave.get(`${riga.tipo}|${riga.marca}|${riga.modello}`) ?? []
        const item = scegliVariante(riga.tipo, candidate, riga.variante)
        if (!item) continue

        const cacheKey = generateCacheKey(riga.tipo, riga.marca, riga.modello, {
          variante: riga.variante ?? undefined,
        })
        setCache(cacheKey, item)
        setOrigine(riga.rowKey, { cacheKey, appliedSpecs: (item.specs ?? {}) as Record<string, unknown> })
      }
    }

    carica()
    return () => { annullato = true }
  }, [scheda, setCache, setOrigine])
}
