import { useState } from 'react'
import { useEquipmentCatalogContext, generateCacheKey } from '@/components/technicalSheet/EquipmentCatalogContext'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import type { UpdateData } from '@/types/equipmentUpdate'
import type { SchedaDatiCompleta } from '@/types'
import { compareSpecs, extractUpdatedSpecs } from '@/utils/equipmentSpecsComparison'

/**
 * Hook per gestire aggiornamenti al catalogo apparecchiature
 *
 * Workflow:
 * 1. collectUpdates() - Raccoglie tutti gli aggiornamenti necessari dal form
 * 2. promptUpdates() - Apre dialog di conferma
 * 3. confirmUpdates() - Esegue aggiornamenti nel database
 */
export function useEquipmentCatalogUpdate() {
  const catalogContext = useEquipmentCatalogContext()
  const [pendingUpdates, setPendingUpdates] = useState<UpdateData[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Raccoglie tutti gli aggiornamenti necessari confrontando form vs catalogo
   */
  const collectUpdates = (formData: SchedaDatiCompleta): UpdateData[] => {
    const updates: UpdateData[] = []

    // ========================================
    // SERBATOI
    // ========================================
    formData.serbatoi?.forEach((serbatoio) => {
      if (!serbatoio.marca || !serbatoio.modello) return

      const cacheKey = generateCacheKey('Serbatoi', serbatoio.marca, serbatoio.modello)
      const catalogData = catalogContext.getCache(cacheKey)

      const comparison = compareSpecs(catalogData?.specs, serbatoio, 'Serbatoi')

      if (comparison.hasChanges) {
        updates.push({
          equipmentType: 'Serbatoi',
          marca: serbatoio.marca,
          modello: serbatoio.modello,
          codice: serbatoio.codice,
          newSpecs: extractUpdatedSpecs(serbatoio, 'Serbatoi', comparison),
          comparison,
          catalogData,
        })
      }
    })

    // ========================================
    // COMPRESSORI
    // ========================================
    formData.compressori?.forEach((compressore) => {
      if (!compressore.marca || !compressore.modello) return

      // Compressori: pressione_max fa parte della chiave
      const cacheKey = generateCacheKey('Compressori', compressore.marca, compressore.modello, {
        pressione: compressore.pressione_max,
      })
      const catalogData = catalogContext.getCache(cacheKey)

      const comparison = compareSpecs(catalogData?.specs, compressore, 'Compressori')

      if (comparison.hasChanges && !comparison.suggestNewVariant) {
        updates.push({
          equipmentType: 'Compressori',
          marca: compressore.marca,
          modello: compressore.modello,
          codice: compressore.codice,
          newSpecs: extractUpdatedSpecs(compressore, 'Compressori', comparison),
          comparison,
          catalogData,
          pressione: compressore.pressione_max,
        })
      }
    })

    // ========================================
    // DISOLEATORI
    // ========================================
    formData.disoleatori?.forEach((disoleatore) => {
      if (!disoleatore.marca || !disoleatore.modello) return

      const cacheKey = generateCacheKey('Disoleatori', disoleatore.marca, disoleatore.modello)
      const catalogData = catalogContext.getCache(cacheKey)

      const comparison = compareSpecs(catalogData?.specs, disoleatore, 'Disoleatori')

      if (comparison.hasChanges) {
        updates.push({
          equipmentType: 'Disoleatori',
          marca: disoleatore.marca,
          modello: disoleatore.modello,
          codice: disoleatore.codice,
          newSpecs: extractUpdatedSpecs(disoleatore, 'Disoleatori', comparison),
          comparison,
          catalogData,
        })
      }
    })

    // ========================================
    // ESSICCATORI
    // ========================================
    formData.essiccatori?.forEach((essiccatore) => {
      if (!essiccatore.marca || !essiccatore.modello) return

      const cacheKey = generateCacheKey('Essiccatori', essiccatore.marca, essiccatore.modello)
      const catalogData = catalogContext.getCache(cacheKey)

      const comparison = compareSpecs(catalogData?.specs, essiccatore, 'Essiccatori')

      if (comparison.hasChanges) {
        updates.push({
          equipmentType: 'Essiccatori',
          marca: essiccatore.marca,
          modello: essiccatore.modello,
          codice: essiccatore.codice,
          newSpecs: extractUpdatedSpecs(essiccatore, 'Essiccatori', comparison),
          comparison,
          catalogData,
        })
      }
    })

    // ========================================
    // SCAMBIATORI
    // ========================================
    formData.scambiatori?.forEach((scambiatore) => {
      if (!scambiatore.marca || !scambiatore.modello) return

      const cacheKey = generateCacheKey('Scambiatori', scambiatore.marca, scambiatore.modello)
      const catalogData = catalogContext.getCache(cacheKey)

      const comparison = compareSpecs(catalogData?.specs, scambiatore, 'Scambiatori')

      if (comparison.hasChanges) {
        updates.push({
          equipmentType: 'Scambiatori',
          marca: scambiatore.marca,
          modello: scambiatore.modello,
          codice: scambiatore.codice,
          newSpecs: extractUpdatedSpecs(scambiatore, 'Scambiatori', comparison),
          comparison,
          catalogData,
        })
      }
    })

    console.log('📊 Collected updates:', updates.length, updates)
    return updates
  }

  /**
   * Apre dialog mostrando updates proposti
   */
  const promptUpdates = (updates: UpdateData[]) => {
    setPendingUpdates(updates)
    setDialogOpen(true)
    setError(null)
  }

  /**
   * Conferma ed esegue tutti gli aggiornamenti
   */
  const confirmUpdates = async (): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      for (const update of pendingUpdates) {
        await equipmentCatalogApi.updateEquipmentSpecs(
          update.equipmentType,
          update.marca,
          update.modello,
          update.newSpecs,
          {
            pressione: update.pressione,
            ptar: update.ptar,
          }
        )
      }

      console.log('✅ All updates completed successfully')
      setDialogOpen(false)
      setPendingUpdates([])
    } catch (err: any) {
      console.error('❌ Error updating equipment catalog:', err)

      // Gestione errori specifici
      if (err.code === 'PGRST301' || err.message?.includes('permission')) {
        setError(
          'Non hai i permessi per aggiornare il catalogo. Contatta un amministratore.'
        )
      } else {
        setError(err.message || 'Errore durante l\'aggiornamento del catalogo')
      }
    } finally {
      setLoading(false)
    }
  }

  /**
   * Annulla aggiornamenti
   */
  const cancelUpdate = () => {
    setDialogOpen(false)
    setPendingUpdates([])
    setError(null)
  }

  return {
    // State
    dialogOpen,
    pendingUpdates,
    loading,
    error,

    // Actions
    collectUpdates,
    promptUpdates,
    confirmUpdates,
    cancelUpdate,
  }
}
