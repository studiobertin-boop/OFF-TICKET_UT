import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { EquipmentCatalogType } from '@/types'
import type { FindingFix } from '@/services/equipmentAudit'
import {
  equipmentCatalogAdminApi,
  type CatalogFilters,
} from '@/services/api/equipmentCatalogAdmin'
import type {
  CreateEquipmentInput,
  UpdateEquipmentInput,
} from '@/utils/equipmentCatalogValidation'

/** Chiavi di cache del catalogo apparecchiature. */
export const equipmentCatalogKeys = {
  all: ['equipment-catalog-admin'] as const,
  lists: () => [...equipmentCatalogKeys.all, 'list'] as const,
  list: (filters: CatalogFilters) => [...equipmentCatalogKeys.lists(), filters] as const,
  details: () => [...equipmentCatalogKeys.all, 'detail'] as const,
  detail: (id: string) => [...equipmentCatalogKeys.details(), id] as const,
  marche: (tipo?: EquipmentCatalogType) =>
    [...equipmentCatalogKeys.all, 'marche', tipo ?? 'tutte'] as const,
  riferimenti: (marca: string, modello: string) =>
    [...equipmentCatalogKeys.all, 'riferimenti', marca, modello] as const,
}

const STALE = 5 * 60 * 1000
const GC = 10 * 60 * 1000

export function useEquipmentCatalogList(filters: CatalogFilters) {
  return useQuery({
    queryKey: equipmentCatalogKeys.list(filters),
    queryFn: () => equipmentCatalogAdminApi.list(filters),
    staleTime: STALE,
    gcTime: GC,
  })
}

export function useEquipmentMarche(tipo?: EquipmentCatalogType) {
  return useQuery({
    queryKey: equipmentCatalogKeys.marche(tipo),
    queryFn: () => equipmentCatalogAdminApi.getMarche(tipo),
    staleTime: STALE,
    gcTime: GC,
  })
}

/**
 * Quante schede dati citano una voce. Serve prima di eliminarla o rinominarla:
 * il legame passa per marca e modello, quindi una modifica lo spezza.
 */
export function useSheetReferences(marca: string | null, modello: string | null) {
  return useQuery({
    queryKey: equipmentCatalogKeys.riferimenti(marca ?? '', modello ?? ''),
    queryFn: () => equipmentCatalogAdminApi.countSheetReferences(marca!, modello!),
    enabled: Boolean(marca && modello),
    staleTime: STALE,
  })
}

/** Ogni scrittura invalida tutto il ramo: il catalogo è piccolo e la coerenza vale più della finezza. */
function useCatalogMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
  messaggio: string
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentCatalogKeys.all })
      queryClient.invalidateQueries({ queryKey: ['equipment-audit'] })
      toast.success(messaggio)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Operazione non riuscita')
    },
  })
}

export function useCreateEquipment() {
  return useCatalogMutation(
    (input: CreateEquipmentInput) => equipmentCatalogAdminApi.create(input),
    'Apparecchiatura aggiunta al catalogo'
  )
}

export function useUpdateEquipment() {
  return useCatalogMutation(
    ({ id, input }: { id: string; input: UpdateEquipmentInput }) =>
      equipmentCatalogAdminApi.update(id, input),
    'Apparecchiatura aggiornata'
  )
}

export function useSetEquipmentActive() {
  return useCatalogMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) =>
      equipmentCatalogAdminApi.setActive(id, isActive),
    'Stato aggiornato'
  )
}

export function useDeleteEquipment() {
  return useCatalogMutation(
    (id: string) => equipmentCatalogAdminApi.hardDelete(id),
    'Apparecchiatura eliminata'
  )
}

/** Applica in blocco le correzioni proposte dalla verifica di coerenza. */
export function useApplyFixes() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (fixes: FindingFix[]) => equipmentCatalogAdminApi.applyFixes(fixes),
    onSuccess: applicate => {
      queryClient.invalidateQueries({ queryKey: equipmentCatalogKeys.all })
      queryClient.invalidateQueries({ queryKey: ['equipment-audit'] })
      toast.success(
        applicate === 1 ? 'Correzione applicata' : `${applicate} correzioni applicate`
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Correzioni non applicate')
    },
  })
}
