import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Snackbar,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
  Share as ShareIcon,
  Assessment as AssessmentIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/common/Layout'
import { useRequest } from '@/hooks/useRequests'
import { useAuth } from '@/hooks/useAuth'
import { useCustomers } from '@/hooks/useCustomers'
import { technicalDataApi } from '@/services/api/technicalData'
import { requestsApi } from '@/services/api/requests'
import { customersApi } from '@/services/api/customers'
import { TechnicalSheetForm, type TechnicalSheetFormRef } from '@/components/technicalSheet/TechnicalSheetForm'
import { OCRReviewDialog } from '@/components/technicalSheet/OCRReviewDialog'
import { ShareDialog } from '@/components/technicalSheet/ShareDialog'
import RelazioneDataDialog from '@/components/relazione/RelazioneDataDialog'
import type { AdditionalInfo } from '@/services/relazione/types'
import { EquipmentCatalogProvider } from '@/components/technicalSheet/EquipmentCatalogContext'
import type { DM329TechnicalData, SchedaDatiCompleta, OCRExtractedData, FuzzyMatch, OCRReviewData } from '@/types'
import { isDM329Family } from '@/utils/workflow'

/**
 * Pagina SCHEDA DATI - Gestione dati tecnici pratiche DM329
 *
 * PASSO 2: Form completo implementato
 * - 10 sezioni con apparecchiature ripetibili
 * - Validazione campi obbligatori
 * - Salvataggio bozza e completamento scheda
 *
 * PASSI FUTURI:
 * - Passo 3: Integrazione OCR con GPT-4o Vision
 * - Passo 4: Portale cliente
 */
export const TechnicalDetails = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: request, isLoading: requestLoading, error: requestError } = useRequest(id!)

  const [technicalData, setTechnicalData] = useState<DM329TechnicalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<SchedaDatiCompleta | null>(null)
  const [autoSaving, setAutoSaving] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [ocrReviewData, setOcrReviewData] = useState<OCRReviewData | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [relazioneDialogOpen, setRelazioneDialogOpen] = useState(false)
  const formRef = useRef<TechnicalSheetFormRef>(null)

  // Carica scheda dati tecnici
  useEffect(() => {
    const loadTechnicalData = async () => {
      if (!id) return

      try {
        setLoading(true)
        let data = await technicalDataApi.getByRequestId(id)

        // Se la scheda dati non esiste, creala automaticamente
        // (necessario per richieste DM329 create prima dell'implementazione della funzionalità)
        if (!data) {
          console.log('Technical data not found for request', id, '- creating automatically...')

          // Estrai indirizzo impianto dai custom_fields della richiesta se disponibile
          const indirizzoImpianto = request?.custom_fields?.indirizzo_impianto as string | undefined

          try {
            // Crea la scheda dati
            data = await technicalDataApi.create(id, indirizzoImpianto)
            console.log('Technical data created successfully:', data.id)

            // Mostra messaggio informativo all'utente
            setError('Scheda dati creata automaticamente. Puoi ora compilare i dati tecnici.')
            setTimeout(() => setError(null), 5000) // Rimuovi messaggio dopo 5 secondi
          } catch (createErr) {
            console.error('Error creating technical data:', createErr)
            throw new Error('Impossibile creare la scheda dati. Verifica i permessi.')
          }
        }

        setTechnicalData(data)

        // Parse equipment_data da JSONB
        if (data && data.equipment_data) {
          const parsedData = data.equipment_data as SchedaDatiCompleta

          // Precompilazione nome_tecnico se vuoto e richiesta assegnata
          if (!parsedData.dati_generali?.nome_tecnico && request?.assigned_user?.full_name) {
            parsedData.dati_generali = {
              ...parsedData.dati_generali,
              nome_tecnico: request.assigned_user.full_name,
            }
          }

          setFormData(parsedData)
        }
      } catch (err) {
        console.error('Error loading technical data:', err)
        setError(err instanceof Error ? err.message : 'Errore nel caricamento della scheda dati')
      } finally {
        setLoading(false)
      }
    }

    loadTechnicalData()
  }, [id, request?.assigned_user, request?.custom_fields])

  // Verifica accesso (solo admin, userdm329 e tecnicoDM329)
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'userdm329' && user.role !== 'tecnicoDM329') {
      navigate('/requests')
    }
  }, [user, navigate])

  // Autosave function (senza alert/snackbar)
  const handleAutoSave = useCallback(async (data: SchedaDatiCompleta) => {
    if (!id) return

    try {
      setAutoSaving(true)
      await technicalDataApi.updateEquipmentData(id, data)
      setFormData(data)
      setLastSaved(new Date())
    } catch (err) {
      console.error('Error auto-saving:', err)
    } finally {
      setAutoSaving(false)
    }
  }, [id])

  // Sync sede_impianto to request.custom_fields.indirizzo_immobile
  const syncIndirizzoImmobile = async (sedeImpianto: string) => {
    if (!id || !request) {
      return
    }

    try {
      const updatedFields = {
        ...request.custom_fields,
        indirizzo_immobile: sedeImpianto,
      }

      await requestsApi.update(id, {
        custom_fields: updatedFields,
      })
    } catch (err) {
      console.error('[syncIndirizzoImmobile] Errore sync indirizzo immobile:', err)
      // Non-blocking, logged only
    }
  }

  // Manual save function (con feedback)
  const handleFormSubmit = async (data: SchedaDatiCompleta) => {
    if (!id) return

    try {
      setSaving(true)

      // Salva i dati nel campo equipment_data (JSONB)
      await technicalDataApi.updateEquipmentData(id, data)

      // Sync sede_impianto to indirizzo_immobile
      const sedeImpianto = data?.dati_impianto?.sede_impianto
      if (sedeImpianto) {
        await syncIndirizzoImmobile(sedeImpianto)
      }

      setFormData(data)
      setLastSaved(new Date())
      setShowSaveSuccess(true)
    } catch (err) {
      console.error('Error saving draft:', err)
      alert('Errore nel salvataggio della bozza')
    } finally {
      setSaving(false)
    }
  }

  // Salva bozza usando i dati attuali del form
  const handleSaveDraft = async () => {
    if (!id || !formRef.current) return

    try {
      setSaving(true)
      const currentData = formRef.current.getFormData()

      // Salva i dati nel campo equipment_data (JSONB)
      await technicalDataApi.updateEquipmentData(id, currentData)

      // Sync sede_impianto to indirizzo_immobile
      const sedeImpianto = currentData?.dati_impianto?.sede_impianto
      if (sedeImpianto) {
        await syncIndirizzoImmobile(sedeImpianto)
      }

      setFormData(currentData)
      setLastSaved(new Date())
      setShowSaveSuccess(true)
    } catch (err) {
      console.error('Error saving draft:', err)
      alert('Errore nel salvataggio della bozza')
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteSheet = async () => {
    if (!id || !formRef.current) return

    // TODO: Validare campi obbligatori prima di completare
    const confirmed = window.confirm(
      'Confermi di voler completare la scheda dati?'
    )

    if (!confirmed) return

    try {
      setSaving(true)

      // Prima salva i dati attuali del form
      const currentData = formRef.current.getFormData()
      await technicalDataApi.updateEquipmentData(id, currentData)

      // Sync sede_impianto to indirizzo_immobile
      const sedeImpianto = currentData?.dati_impianto?.sede_impianto
      if (sedeImpianto) {
        await syncIndirizzoImmobile(sedeImpianto)
      }

      setFormData(currentData)

      // Poi marca come completata (trigger cambio stato automatico)
      await technicalDataApi.markAsCompleted(id)

      alert('Scheda dati completata! Lo stato della pratica è stato aggiornato.')
      navigate(`/requests/${id}`)
    } catch (err) {
      console.error('Error completing sheet:', err)
      alert('Errore nel completamento della scheda dati')
    } finally {
      setSaving(false)
    }
  }

  const handleReopenSheet = async () => {
    if (!id) return

    const confirmed = window.confirm(
      'Confermi di voler riaprire la scheda dati per modifiche?'
    )

    if (!confirmed) return

    try {
      setSaving(true)
      await technicalDataApi.markAsIncomplete(id)

      // Ricarica i dati
      const data = await technicalDataApi.getByRequestId(id)
      setTechnicalData(data)

      alert('Scheda dati riaperta per modifiche')
    } catch (err) {
      console.error('Error reopening sheet:', err)
      alert('Errore nella riapertura della scheda dati')
    } finally {
      setSaving(false)
    }
  }

  // OCR handlers
  const handleOCRConfirm = useCallback((editedData: OCRExtractedData, selectedMatch?: FuzzyMatch) => {
    if (!ocrReviewData?.equipment_code) {
      console.error('❌ Codice apparecchiatura mancante')
      alert('Errore: codice apparecchiatura non trovato')
      return
    }

    // Parse equipment code (es: "S1", "C2.1")
    const equipmentCode = ocrReviewData.equipment_code

    console.log('✅ OCR data confirmed:', { editedData, selectedMatch, equipmentCode })

    // Nota: L'inserimento nel form verrà gestito da TechnicalSheetForm
    // che riceverà questi dati tramite un nuovo prop onOCRDataReady
    // Per ora mostriamo i dati confermati

    // TODO: Implementare callback per passare dati al form
    // onOCRDataReady({ equipmentCode, data: editedData })

    // Close dialog
    setOcrReviewData(null)

    // Show success message
    alert('Dati OCR confermati! Per ora visualizzati in console. Prossimo step: integrazione con form.')
  }, [ocrReviewData])

  const handleOCRCancel = useCallback(() => {
    setOcrReviewData(null)
  }, [])

  // IMPORTANT: Load customer data for legacy CSV imports BEFORE early returns
  // Extract cliente string if it exists
  const clienteString = request?.custom_fields?.cliente && typeof request.custom_fields.cliente === 'string'
    ? request.custom_fields.cliente
    : null
  const shouldFetchByName = !request?.customer && !!clienteString

  // Search for customer by name for CSV imported requests
  const { data: customersSearchResult } = useCustomers(
    clienteString ? { search: clienteString } : undefined,
    { enabled: shouldFetchByName }
  )

  const customerByName = useMemo(() => {
    if (!customersSearchResult?.data || !clienteString) return undefined
    return customersSearchResult.data.find(
      c => c.ragione_sociale.toLowerCase() === clienteString.toLowerCase()
    )
  }, [customersSearchResult, clienteString])

  // Auto-sync customer_id when customerByName is found
  useEffect(() => {
    if (!id || !customerByName || request?.customer_id) return

    const syncCustomerId = async () => {
      try {
        await requestsApi.update(id, {
          customer_id: customerByName.id
        })

        // Force re-fetch request data
        window.location.reload()
      } catch (err) {
        console.error('[TechnicalDetails] Error syncing customer_id:', err)
      }
    }

    syncCustomerId()
  }, [id, customerByName, request?.customer_id])

  // IMPORTANT: Calculate sedeLegale BEFORE early returns to avoid React Hook ordering issues
  // Get sede legale from customer data using formatFullAddress
  // Priority: request.customer > customerByName > custom_fields.sede_legale
  const sedeLegale = useMemo(() => {
    if (request?.customer) {
      const addr = customersApi.formatFullAddress(request.customer)
      return addr
    }
    if (customerByName) {
      const addr = customersApi.formatFullAddress(customerByName)
      return addr
    }
    return request?.custom_fields?.sede_legale || ''
  }, [request, customerByName, clienteString])

  if (requestLoading || loading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (requestError || !request) {
    return (
      <Layout>
        <Alert severity="error">Richiesta non trovata</Alert>
      </Layout>
    )
  }

  if (!technicalData) {
    return (
      <Layout>
        <Alert severity="error">
          Scheda dati tecnici non trovata
        </Alert>
      </Layout>
    )
  }

  const isDM329 = isDM329Family(request.request_type?.name)
  if (!isDM329) {
    return (
      <Layout>
        <Alert severity="error">
          Questa funzionalità è disponibile solo per richieste DM329
        </Alert>
      </Layout>
    )
  }

  const isCompleted = technicalData.is_completed

  // Estrai il nome cliente dai dati tecnici come fallback prioritario per i dati storici
  const technicalDataClientName = technicalData?.equipment_data?.dati_generali?.cliente

  const customerName =
    request.custom_fields?.cliente?.ragione_sociale ||
    request.customer?.ragione_sociale ||
    technicalDataClientName ||
    'N/A'

  // Determina se l'utente può gestire la condivisione
  const canManageSharing =
    user?.role === 'admin' ||
    user?.role === 'userdm329' ||
    (user?.role === 'tecnicoDM329' && request?.assigned_to === user?.id)

  return (
    <Layout>
      <Box>
        {/* Messaggio informativo creazione automatica */}
        {error && (
          <Alert severity="info" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/requests/${id}`)}
            >
              Torna alla Richiesta
            </Button>
            <Typography variant="h4">
              Scheda Dati - {customerName}
            </Typography>
            {isCompleted && (
              <Chip
                label="Completata"
                color="success"
                icon={<CheckCircleIcon />}
                size="small"
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* Indicatore autosave */}
            {autoSaving && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CircularProgress size={14} />
                Salvataggio automatico...
              </Typography>
            )}
            {lastSaved && !autoSaving && (
              <Typography variant="caption" color="text.secondary">
                Ultimo salvataggio: {lastSaved.toLocaleTimeString('it-IT')}
              </Typography>
            )}

            {/* Bottone Assegna Scheda */}
            {canManageSharing && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ShareIcon />}
                onClick={() => setShareDialogOpen(true)}
                size="small"
              >
                Assegna Scheda
              </Button>
            )}

            {isCompleted ? (
              <>
                {(user?.role === 'admin' || user?.role === 'userdm329') && (
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<AssessmentIcon />}
                    onClick={() => navigate(`/requests/${id}/civa-summary`)}
                    disabled={saving}
                  >
                    Visualizza Dati CIVA
                  </Button>
                )}
                {(user?.role === 'admin' || user?.role === 'userdm329') && (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<DescriptionIcon />}
                    onClick={() => setRelazioneDialogOpen(true)}
                    disabled={saving}
                  >
                    Genera Relazione
                  </Button>
                )}
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={handleReopenSheet}
                  disabled={saving}
                >
                  Riapri per Modifiche
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveDraft}
                  disabled={saving || autoSaving}
                >
                  Salva Bozza
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleCompleteSheet}
                  disabled={saving || autoSaving}
                >
                  Completa Scheda
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Form Dati Tecnici - PASSO 2 COMPLETATO */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            {/* ✅ Wrap form con EquipmentCatalogProvider per cache specs */}
            <EquipmentCatalogProvider>
              <TechnicalSheetForm
                ref={formRef}
                defaultValues={formData || undefined}
                onSubmit={handleFormSubmit}
                onAutoSave={handleAutoSave}
                customerName={customerName}
                sedeLegale={sedeLegale}
                readOnly={isCompleted}
              />
            </EquipmentCatalogProvider>
          </CardContent>
        </Card>

        {/* OCR Review Dialog */}
        <OCRReviewDialog
          open={!!ocrReviewData}
          data={ocrReviewData}
          onConfirm={handleOCRConfirm}
          onCancel={handleOCRCancel}
        />

        {/* Share Dialog */}
        {technicalData && (
          <ShareDialog
            open={shareDialogOpen}
            onClose={() => setShareDialogOpen(false)}
            technicalDataId={technicalData.id}
            requestId={request.id}
          />
        )}

        {/* Dialog "Dati relazione" + generazione .docx */}
        {technicalData && id && (
          <RelazioneDataDialog
            open={relazioneDialogOpen}
            onClose={() => setRelazioneDialogOpen(false)}
            requestId={id}
            scheda={technicalData.equipment_data as SchedaDatiCompleta}
            customer={request?.customer ?? customerByName ?? null}
            initialAdditionalInfo={technicalData.additional_info as AdditionalInfo | undefined}
            fileName={`Relazione_${customerName}.docx`}
          />
        )}

        {/* Snackbar per conferma salvataggio */}
        <Snackbar
          open={showSaveSuccess}
          autoHideDuration={3000}
          onClose={() => setShowSaveSuccess(false)}
          message="Bozza salvata con successo"
        />
      </Box>
    </Layout>
  )
}
