import { useQueries, useQuery, type QueryClient } from '@tanstack/react-query'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import type { EquipmentCatalogItem, EquipmentCatalogType } from '@/types'

const chiave = (tipo: EquipmentCatalogType) => ['catalogo-per-tipo', tipo] as const
const STALE = 5 * 60 * 1000

/**
 * Le righe di catalogo di un tipo, per il matching della targhetta.
 *
 * Sta in cache come `useVariantiModello`: tutte le righe della tabella dello stesso tipo
 * condividono la richiesta, che parte una volta sola per scheda.
 */
export function useCatalogoPerTipo(tipo: EquipmentCatalogType | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: chiave(tipo!),
    queryFn: () => equipmentCatalogApi.findByTipo(tipo!),
    enabled: Boolean(tipo),
    staleTime: STALE,
  })

  return { righe: (data ?? []) as EquipmentCatalogItem[], loading: isLoading }
}

/**
 * Le righe di **tutti** i tipi presenti in tabella, indicizzate per tipo.
 *
 * La tabella mostra righe di tipi diversi e il numero di hook chiamati da un componente
 * deve restare costante fra un render e l'altro: `useQueries` prende l'elenco dei tipi
 * come dato e resta una sola chiamata, mentre un `useCatalogoPerTipo` per riga
 * violerebbe le regole degli hook appena una riga viene aggiunta o eliminata.
 */
export function useCatalogoPerTipi(tipi: EquipmentCatalogType[]) {
  const risultati = useQueries({
    queries: tipi.map((tipo) => ({
      queryKey: chiave(tipo),
      queryFn: () => equipmentCatalogApi.findByTipo(tipo),
      staleTime: STALE,
    })),
  })

  const perTipo = {} as Record<EquipmentCatalogType, EquipmentCatalogItem[]>
  tipi.forEach((tipo, i) => {
    perTipo[tipo] = (risultati[i]?.data ?? []) as EquipmentCatalogItem[]
  })
  return perTipo
}

/**
 * Le stesse righe, fuori da un componente.
 *
 * Il batch elabora N targhette dentro un handler e non può montare un hook per ciascuna:
 * passando dal `QueryClient` condivide però la stessa cache degli hook, quindi un tipo già
 * caricato dalla tabella non viene richiesto una seconda volta.
 */
export function caricaCatalogoPerTipo(
  queryClient: QueryClient,
  tipo: EquipmentCatalogType
): Promise<EquipmentCatalogItem[]> {
  return queryClient.fetchQuery({
    queryKey: chiave(tipo),
    queryFn: () => equipmentCatalogApi.findByTipo(tipo),
    staleTime: STALE,
  })
}
