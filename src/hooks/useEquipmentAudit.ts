import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  flattenSheetEquipment,
  runAudit,
  type AuditOptions,
  type AuditReport,
  type Finding,
} from '@/services/equipmentAudit'
import { equipmentDismissalsApi, equipmentSheetsApi } from '@/services/api/equipmentAudit'
import { equipmentCatalogAdminApi } from '@/services/api/equipmentCatalogAdmin'

/**
 * Verifica di coerenza del catalogo.
 *
 * Non parte da sola: `enabled: false` la lascia in attesa finché l'utente non
 * preme il pulsante. Scorrere l'intero catalogo e tutte le schede dati è un
 * lavoro che ha senso fare quando si è deciso di guardarlo, non a ogni apertura
 * della pagina.
 */

export const equipmentAuditKeys = {
  all: ['equipment-audit'] as const,
  report: (options: AuditOptions) => [...equipmentAuditKeys.all, 'report', options] as const,
  dismissals: () => [...equipmentAuditKeys.all, 'dismissals'] as const,
}

export function useEquipmentAudit(options: AuditOptions) {
  const query = useQuery<AuditReport>({
    queryKey: equipmentAuditKeys.report(options),
    queryFn: async () => {
      const [catalog, sheets, dismissals] = await Promise.all([
        equipmentCatalogAdminApi.listAllForAudit(),
        options.includeSheets ? equipmentSheetsApi.listRawSheets() : Promise.resolve([]),
        equipmentDismissalsApi.listAll(),
      ])

      return runAudit({
        catalog,
        sheets: flattenSheetEquipment(sheets),
        dismissals,
        options,
      })
    },
    enabled: false,
    // Il report resta a disposizione riaprendo il pannello: si ricalcola solo
    // quando l'utente lo richiede o dopo una correzione.
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
  })

  return {
    report: query.data,
    run: query.refetch,
    isRunning: query.isFetching,
    hasRun: query.isFetched,
    error: query.error as Error | null,
  }
}

export function useDismissals() {
  return useQuery({
    queryKey: equipmentAuditKeys.dismissals(),
    queryFn: () => equipmentDismissalsApi.listAll(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useDismissFinding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ finding, motivazione }: { finding: Finding; motivazione: string }) =>
      equipmentDismissalsApi.dismiss(finding, motivazione),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentAuditKeys.all })
      toast.success('Segnalazione archiviata')
    },
    onError: (error: Error) => toast.error(error.message || 'Archiviazione non riuscita'),
  })
}

export function useRestoreFinding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (findingKey: string) => equipmentDismissalsApi.restore(findingKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentAuditKeys.all })
      toast.success('Segnalazione ripristinata')
    },
    onError: (error: Error) => toast.error(error.message || 'Ripristino non riuscito'),
  })
}
