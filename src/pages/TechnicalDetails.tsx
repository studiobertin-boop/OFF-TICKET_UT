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
  Divider,
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
import type { DM329TechnicalData } from '@/types'

/**
 * Pagina SCHEDA DATI - Gestione dati tecnici pratiche DM329
 *
 * PASSO 1: Skeleton/layout base
 * - Visualizza informazioni richiesta
 * - Placeholder per form (campi aggiunti nei passi successivi)
 * - Bottoni "Salva Bozza" e "Completa Scheda"
 * - Sezione upload foto targhette (preparazione OCR futuro)
 *
 * PASSI FUTURI:
 * - Passo 2: Aggiunta campi form specifici forniti dall'utente
 * - Passo 3: Integrazione OCR con GPT-4o Vision
 * - Passo 4: Pre-compilazione da dati cliente
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

  // Carica scheda dati tecnici
  useEffect(() => {
    const loadTechnicalData = async () => {
      if (!id) return

      try {
        setLoading(true)
        const data = await technicalDataApi.getByRequestId(id)
        setTechnicalData(data)
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

  const handleSaveDraft = async () => {
    if (!id) return

    try {
      setSaving(true)
      // TODO Passo 2: Salvare i dati del form
      // Per ora salviamo solo un aggiornamento vuoto per testare
      await technicalDataApi.update(id, {})
      alert('Bozza salvata con successo')
    } catch (err) {
      console.error('Error saving draft:', err)
      alert('Errore nel salvataggio della bozza')
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteSheet = async () => {
    if (!id) return

    const confirmed = window.confirm(
      'Confermi di voler completare la scheda dati?\n\n' +
      'Questa azione cambierà automaticamente lo stato della pratica a "2-SCHEDA_DATI_PRONTA".'
    )

    if (!confirmed) return

    try {
      setSaving(true)
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
              <>
                <Button
                  variant="outlined"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveDraft}
                  disabled={saving}
                >
                  Salva Bozza
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleIcon />}
                  onClick={handleCompleteSheet}
                  disabled={saving}
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
              {technicalData.indirizzo_impianto && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Indirizzo Impianto
                  </Typography>
                  <Typography variant="body1">{technicalData.indirizzo_impianto}</Typography>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        {/* Form Dati Tecnici - PLACEHOLDER PASSO 1 */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Dati Sala Compressori e Apparecchiature
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>PASSO 1 - Implementazione in corso</strong>
                <br />
                I campi specifici del form verranno aggiunti nel Passo 2.
                <br />
                Questa è la struttura base della pagina.
              </Typography>
            </Alert>

            <Box sx={{ p: 3, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" align="center">
                Form campi dati tecnici verrà inserito qui
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Sezione Upload Foto Targhette - PLACEHOLDER PASSO 1 */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Foto Targhette Apparecchiature (OCR)
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2">
                <strong>PASSO 3 - Da implementare</strong>
                <br />
                L'integrazione con GPT-4o Vision per il riconoscimento ottico
                delle targhette verrà implementata nel Passo 3.
              </Typography>
            </Alert>

            <Box sx={{ p: 3, bgcolor: 'background.default', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary" align="center">
                Upload e OCR foto targhette verrà inserito qui
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Layout>
  )
}
