import { useEffect, useRef } from 'react'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import { rowKeyOf, useEquipmentCatalogContext } from '@/components/technicalSheet/EquipmentCatalogContext'
import {
  EQUIPMENT_DEFS, KIND_ARRAY, type EquipmentKind, type EquipmentTypeDef,
} from '@/components/technicalSheet/table/equipmentConfig'
import { variantSpecKey } from '@/services/equipmentAudit'
import { scegliVarianteSalvata } from '@/utils/equipmentVarianti'
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
  /** Pressione dichiarata dalla scheda, per i tipi che hanno più varianti. */
  pressione: number | null
  /** Capacità compilata: è ciò che distingue due varianti che dichiarano la stessa pressione. */
  capacita: number | null
  /** Diametro della valvola: sulle valvole distingue le varianti prima della capacità. */
  diametro: string | null
}

/** Tipi con dati tecnici da agganciare: i separatori non ne hanno (`specsMap` vuota). */
const KIND_DA_AGGANCIARE = (Object.keys(EQUIPMENT_DEFS) as EquipmentKind[]).filter(
  (k) => k !== 'valvola' && Object.keys(EQUIPMENT_DEFS[k].specsMap).length > 0
)

/** Prefisso della chiave di provenienza delle valvole: non vivono in un array proprio. */
export const VALVOLE_ROW_PREFIX = 'valvole'

/** Righe della scheda che possono avere una voce di catalogo dietro. */
function righeDaAgganciare(scheda: SchedaDatiCompleta | null | undefined): RigaDaAgganciare[] {
  if (!scheda) return []
  const out: RigaDaAgganciare[] = []

  const numero = (v: unknown): number | null => (typeof v === 'number' ? v : null)

  const aggiungi = (rowKey: string, def: EquipmentTypeDef, row: any) => {
    if (!row?.marca || !row?.modello) return
    const tipo = def.catalogType
    out.push({
      rowKey,
      tipo,
      marca: row.marca,
      modello: row.modello,
      pressione: variantSpecKey(tipo) && def.pressioneField ? numero(row[def.pressioneField]) : null,
      capacita: def.capacitaField ? numero(row[def.capacitaField]) : null,
      diametro: typeof row.diametro === 'string' && row.diametro !== '' ? row.diametro : null,
    })
  }

  for (const kind of KIND_DA_AGGANCIARE) {
    const def = EQUIPMENT_DEFS[kind]
    const arrayName = KIND_ARRAY[kind]
    const items = (scheda as any)[arrayName]
    if (!Array.isArray(items)) continue
    for (const row of items) {
      aggiungi(rowKeyOf(arrayName, row?.codice), def, row)
    }
  }

  // Le valvole non stanno in un array proprio: la loro identità è la posizione nell'impianto.
  const defValvola = EQUIPMENT_DEFS.valvola
  for (const v of elencaValvole(scheda)) {
    aggiungi(rowKeyOf(VALVOLE_ROW_PREFIX, v.pos), defValvola, v.valvola)
  }

  return out
}

/**
 * Aggancia le righe di una scheda già compilata alle voci di catalogo da cui provengono.
 *
 * Senza questo, le provenienze restano vuote per tutto ciò che non è stato selezionato nella
 * sessione corrente: riaprendo una scheda salvata non si saprebbe da quale voce vengono i
 * dati, e non si potrebbe né rilevare uno scostamento né proporre di riportarlo a catalogo.
 *
 * Una query per tipo, non una per riga. Gira una sola volta per scheda: la chiave di controllo
 * è l'identità dell'oggetto `defaultValues`, che cambia solo al caricamento o dopo un `reset`.
 */
export function useHydrateCatalogOrigini(scheda: SchedaDatiCompleta | null | undefined) {
  const { setOrigine } = useEquipmentCatalogContext()
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
            console.error('[useHydrateCatalogOrigini] Errore nel precaricamento', tipo, e)
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
        const item = scegliVarianteSalvata(riga.tipo, candidate, riga)
        if (!item) {
          if (candidate.length > 1) {
            console.warn(
              '[useHydrateCatalogOrigini] Variante non identificabile: né la pressione né la capacità ' +
                'della scheda bastano a scegliere fra le righe di catalogo. La riga resta senza provenienza.',
              {
                rowKey: riga.rowKey,
                tipo: riga.tipo,
                marca: riga.marca,
                modello: riga.modello,
                pressione: riga.pressione,
                capacita: riga.capacita,
                candidate: candidate.map(c => c.id),
              }
            )
          }
          continue
        }

        setOrigine(riga.rowKey, {
          catalogItem: item,
          appliedSpecs: (item.specs ?? {}) as Record<string, unknown>,
        })
      }
    }

    carica()
    return () => { annullato = true }
  }, [scheda, setOrigine])
}
