import { useState, useEffect, useCallback, useRef } from 'react'
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
  Description as DescriptionIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/common/Layout'
import { useRequest } from '@/hooks/useRequests'
import { useAuth } from '@/hooks/useAuth'
import { technicalDataApi } from '@/services/api/technicalData'
import { TechnicalSheetForm, type TechnicalSheetFormRef } from '@/components/technicalSheet/TechnicalSheetForm'
import { OCRReviewDialog } from '@/components/technicalSheet/OCRReviewDialog'
import { ShareDialog } from '@/components/technicalSheet/ShareDialog'
import { GenerateReportDialog } from '@/components/reports/GenerateReportDialog'
import { EquipmentCatalogProvider } from '@/components/technicalSheet/EquipmentCatalogContext'
import type { DM329TechnicalData, SchedaDatiCompleta, OCRExtractedData, FuzzyMatch, OCRReviewData } from '@/types'

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
  const [generateReportDialogOpen, setGenerateReportDialogOpen] = useState(false)
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

  // Manual save function (con feedback)
  const handleFormSubmit = async (data: SchedaDatiCompleta) => {
    if (!id) return

    try {
      setSaving(true)

      // Salva i dati nel campo equipment_data (JSONB)
      await technicalDataApi.updateEquipmentData(id, data)

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

  const isDM329 = request.request_type?.name === 'DM329'
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

  const sedeLegale = request.custom_fields?.sede_legale || ''

  // Use request.customer (joined relation) which has complete customer data
  // FALLBACK: Se customer non esiste ma abbiamo dati cliente nei custom_fields O nei dati tecnici
  const customerForReport = request.customer || (
    (request.custom_fields?.cliente || technicalDataClientName) ? {
      id: 'temp-' + request.id, // ID temporaneo
      ragione_sociale: request.custom_fields?.cliente?.ragione_sociale || technicalDataClientName || '',
      via: request.custom_fields?.cliente?.via || sedeLegale || null,
      cap: request.custom_fields?.cliente?.cap || null,
      citta: request.custom_fields?.cliente?.citta || null,
      provincia: request.custom_fields?.cliente?.provincia || null,
      external_id: null,
      is_active: true,
      created_at: request.created_at,
      updated_at: request.updated_at,
      created_by: null,
    } : null
  )

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
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<DescriptionIcon />}
                  onClick={() => {
                    if (!customerForReport) {
                      console.error('❌ Customer non trovato - customer_id:', request?.customer_id);
                      alert(
                        'Errore: Dati cliente non trovati.\n\n' +
                        'La relazione tecnica richiede i dati del cliente.\n' +
                        'Questa pratica non ha un cliente associato.\n\n' +
                        'Per risolvere:\n' +
                        '1. Torna alla richiesta\n' +
                        '2. Modifica la richiesta e associa un cliente dalla lista\n' +
                        '3. Riprova a generare la relazione'
                      );
                      return;
                    }

                    setGenerateReportDialogOpen(true);
                  }}
                  disabled={saving}
                >
                  Genera Relazione
                </Button>
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

        {/* Info Richiesta */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Informazioni Pratica
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Titolo
                </Typography>
                <Typography variant="body1">{request.title}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Cliente
                </Typography>
                <Typography variant="body1">{customerName}</Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Stato Pratica
                </Typography>
                <Typography variant="body1">{request.status}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Form Dati Tecnici - PASSO 2 COMPLETATO */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Dati Sala Compressori e Apparecchiature
            </Typography>

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

        {/* Generate Report Dialog */}
        {technicalData && customerForReport && (
          <GenerateReportDialog
            open={generateReportDialogOpen}
            onClose={() => setGenerateReportDialogOpen(false)}
            technicalData={technicalData}
            request={request}
            customer={customerForReport}
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
