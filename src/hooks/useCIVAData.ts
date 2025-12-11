/**
 * Custom Hook: useCIVAData
 *
 * Carica tutti i dati necessari per il riepilogo CIVA
 * - Request
 * - Technical Data
 * - Customer
 * - Installer (by nome)
 * - Manufacturers (by nome from equipment marca fields)
 */

import { useMemo } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { useRequest } from './useRequests'
import { supabase } from '@/services/supabase'
import { technicalDataApi } from '@/services/api/technicalData'
import { extractManufacturerNames } from '@/utils/civaFiltering'
import type { Customer, Installer, Manufacturer, DM329TechnicalData, SchedaDatiCompleta } from '@/types'

/**
 * Fetch customer by ID
 */
async function fetchCustomer(customerId: string | null | undefined): Promise<Customer | null> {
  if (!customerId) return null

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single()

  if (error) {
    console.error('Error fetching customer:', error)
    return null
  }

  return data
}

/**
 * Fetch installer by nome
 */
async function fetchInstallerByNome(nome: string | undefined): Promise<Installer | null> {
  if (!nome || nome.trim() === '') return null

  const { data, error } = await supabase
    .from('installers')
    .select('*')
    .eq('nome', nome.trim())
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching installer by nome:', error)
    return null
  }

  return data
}

/**
 * Fetch manufacturer by nome
 */
async function fetchManufacturerByNome(nome: string): Promise<Manufacturer | null> {
  if (!nome || nome.trim() === '') return null

  const { data, error } = await supabase
    .from('manufacturers')
    .select('*')
    .eq('nome', nome.trim())
    .eq('is_active', true)
    .single()

  if (error) {
    console.error('Error fetching manufacturer by nome:', error)
    return null
  }

  return data
}

/**
 * Hook per caricare tutti i dati CIVA
 */
export function useCIVAData(requestId: string) {
  // 1. Load request
  const { data: request, isLoading: requestLoading, error: requestError } = useRequest(requestId)

  // 2. Load technical data
  const {
    data: technicalData,
    isLoading: technicalDataLoading,
    error: technicalDataError
  } = useQuery<DM329TechnicalData | null>({
    queryKey: ['technicalData', requestId],
    queryFn: () => technicalDataApi.getByRequestId(requestId),
    enabled: !!requestId
  })

  // 3. Parse equipment data
  const equipmentData = useMemo(() => {
    if (!technicalData?.equipment_data) return null
    return technicalData.equipment_data as SchedaDatiCompleta
  }, [technicalData])

  // 4. Extract installer nome from equipment_data
  const installerNome = useMemo(() => {
    return equipmentData?.dati_generali?.installatore
  }, [equipmentData])

  // 5. Extract manufacturer names from equipment
  const manufacturerNames = useMemo(() => {
    if (!equipmentData) return []
    return extractManufacturerNames(equipmentData)
  }, [equipmentData])

  // 6. Load customer
  const {
    data: customer,
    isLoading: customerLoading,
    error: customerError
  } = useQuery<Customer | null>({
    queryKey: ['customer', request?.customer_id],
    queryFn: () => fetchCustomer(request?.customer_id),
    enabled: !!request?.customer_id
  })

  // 7. Load installer by nome
  const {
    data: installer,
    isLoading: installerLoading,
    error: installerError
  } = useQuery<Installer | null>({
    queryKey: ['installer', 'byNome', installerNome],
    queryFn: () => fetchInstallerByNome(installerNome),
    enabled: !!installerNome,
    staleTime: 5 * 60 * 1000 // Cache 5 minutes
  })

  // 8. Load manufacturers by nome (parallel queries)
  const manufacturersQueries = useQueries({
    queries: manufacturerNames.map(nome => ({
      queryKey: ['manufacturer', 'byNome', nome],
      queryFn: () => fetchManufacturerByNome(nome),
      staleTime: 5 * 60 * 1000, // Cache 5 minutes
      enabled: !!nome
    }))
  })

  // 9. Build manufacturers map
  const manufacturers = useMemo(() => {
    const map = new Map<string, Manufacturer>()

    manufacturersQueries.forEach((query, index) => {
      if (query.data) {
        const nome = manufacturerNames[index]
        map.set(nome, query.data)
      }
    })

    return map
  }, [manufacturersQueries, manufacturerNames])

  // 10. Compute loading states
  const isLoading =
    requestLoading ||
    technicalDataLoading ||
    customerLoading ||
    installerLoading ||
    manufacturersQueries.some(q => q.isLoading)

  // 11. Compute error states
  const error =
    requestError ||
    technicalDataError ||
    customerError ||
    installerError ||
    manufacturersQueries.find(q => q.error)?.error

  return {
    request,
    technicalData,
    equipmentData,
    customer,
    installer,
    manufacturers,
    isLoading,
    error,
    // Additional flags
    hasCustomer: !!customer,
    hasInstaller: !!installer,
    manufacturersCount: manufacturers.size,
    expectedManufacturersCount: manufacturerNames.length
  }
}
