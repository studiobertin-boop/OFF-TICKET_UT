import { useQuery } from '@tanstack/react-query'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import { raggruppaVarianti, type VarianteCatalogo } from '@/utils/equipmentVarianti'
import { readSpec } from '@/services/equipmentAudit'
import type { EquipmentCatalogItem, EquipmentCatalogType } from '@/types'

/**
 * Le righe di catalogo di un modello, condivise fra le celle della stessa riga di scheda.
 *
 * Colonna PS, capacità e TS interrogano tutte e tre lo stesso insieme. Passando da TanStack
 * Query la richiesta è una sola per modello — le tre celle si agganciano alla stessa chiave —
 * e resta in cache mentre si compila il resto della scheda.
 */
export function useVariantiModello(
  tipo: EquipmentCatalogType,
  marca: string | undefined,
  modello: string | undefined
) {
  const { data, isLoading } = useQuery({
    queryKey: ['catalogo-varianti', tipo, marca, modello],
    queryFn: () => equipmentCatalogApi.findVariants(tipo, marca!, modello!),
    enabled: Boolean(marca && modello),
    staleTime: 5 * 60 * 1000,
  })

  const righe: EquipmentCatalogItem[] = data ?? []
  return { righe, varianti: raggruppaVarianti(tipo, righe), loading: isLoading }
}

/**
 * Valori distinti che il catalogo dichiara per un dato tecnico di questo modello.
 *
 * Sono le voci proposte dalle colonne capacità e TS: si sceglie fra ciò che il catalogo
 * conosce, e per tutto il resto c'è il pulsante che sblocca l'inserimento libero.
 * L'ordinamento è numerico dove il dato è un numero — TS a catalogo è spesso un intervallo
 * («-10 ÷ +200») e lì l'unico ordine sensato è quello alfabetico.
 */
export function valoriACatalogo(
  tipo: EquipmentCatalogType,
  righe: EquipmentCatalogItem[],
  chiave: string
): (number | string)[] {
  const visti = new Map<string, number | string>()
  for (const riga of righe) {
    const v = readSpec(tipo, riga.specs, chiave)
    if (v === null || v === '') continue
    visti.set(String(v), v)
  }

  return [...visti.values()].sort((a, b) =>
    typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
  )
}

export type { VarianteCatalogo }
