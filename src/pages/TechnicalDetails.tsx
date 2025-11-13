import { useState, useEffect } from 'react'
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
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  CheckCircle as CheckCircleIcon,
  Edit as EditIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/common/Layout'
import { useRequest } from '@/hooks/useRequests'
import { useAuth } from '@/hooks/useAuth'
import { technicalDataApi } from '@/services/api/technicalData'
import { TechnicalSheetForm } from '@/components/technicalSheet/TechnicalSheetForm'
import type { DM329TechnicalData, SchedaDatiCompleta } from '@/types'

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

  // Carica scheda dati tecnici
  useEffect(() => {
    const loadTechnicalData = async () => {
      if (!id) return

      try {
        setLoading(true)
        const data = await technicalDataApi.getByRequestId(id)
        setTechnicalData(data)

        // Parse equipment_data da JSONB
        if (data && data.equipment_data) {
          setFormData(data.equipment_data as SchedaDatiCompleta)
        }
      } catch (err) {
        console.error('Error loading technical data:', err)
        setError(err instanceof Error ? err.message : 'Errore nel caricamento della scheda dati')
      } finally {
        setLoading(false)
      }
    }

    loadTechnicalData()
  }, [id])

  // Verifica accesso (solo admin e userdm329)
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'userdm329') {
      navigate('/requests')
    }
  }, [user, navigate])

  const handleFormSubmit = async (data: SchedaDatiCompleta) => {
    if (!id) return

    try {
      setSaving(true)

      // Salva i dati nel campo equipment_data (JSONB)
      await technicalDataApi.updateEquipmentData(id, data)

      alert('Bozza salvata con successo')
      setFormData(data)
    } catch (err) {
      console.error('Error saving draft:', err)
      alert('Errore nel salvataggio della bozza')
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteSheet = async () => {
    if (!id) return

    // TODO: Validare campi obbligatori prima di completare
    const confirmed = window.confirm(
      'Confermi di voler completare la scheda dati?\n\n' +
      'Questa azione cambierà automaticamente lo stato della pratica a "2-SCHEDA_DATI_PRONTA".\n\n' +
      'Assicurati che tutti i campi obbligatori siano compilati.'
    )

    if (!confirmed) return

    try {
      setSaving(true)

      // Marca come completata (trigger cambio stato automatico)
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

  if (error || !technicalData) {
    return (
      <Layout>
        <Alert severity="error">
          {error || 'Scheda dati tecnici non trovata'}
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
  const customerName = request.custom_fields?.cliente?.ragione_sociale || 'N/A'

  return (
    <Layout>
      <Box>
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

          <Box sx={{ display: 'flex', gap: 1 }}>
            {isCompleted ? (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={handleReopenSheet}
                disabled={saving}
              >
                Riapri per Modifiche
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={handleCompleteSheet}
                disabled={saving}
              >
                Completa Scheda
              </Button>
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

            <Alert severity="info" sx={{ my: 2 }}>
              <Typography variant="body2">
                <strong>PASSO 2 - Form Implementato</strong>
                <br />
                Il form è completo con tutte le 10 sezioni. Compilalo e usa il bottone "Completa Scheda" per terminare.
                <br />
                I dati vengono salvati automaticamente in formato JSONB nel campo equipment_data.
              </Typography>
            </Alert>

            <TechnicalSheetForm
              defaultValues={formData || undefined}
              onSubmit={handleFormSubmit}
              customerName={customerName}
              readOnly={isCompleted}
            />
          </CardContent>
        </Card>

        {/* Sezione Upload Foto Targhette - PLACEHOLDER PASSO 3 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Foto Targhette Apparecchiature (OCR)
            </Typography>

            <Alert severity="info">
              <Typography variant="body2">
                <strong>PASSO 3 - Da implementare</strong>
                <br />
                L'integrazione con GPT-4o Vision per il riconoscimento ottico
                delle targhette verrà implementata nel Passo 3.
              </Typography>
            </Alert>
          </CardContent>
        </Card>
      </Box>
    </Layout>
  )
}
