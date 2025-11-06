import { useEffect, useState } from 'react'
import {
  Container,
  Paper,
  Typography,
  Box,
  Switch,
  FormControlLabel,
  FormGroup,
  Button,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Email as EmailIcon,
} from '@mui/icons-material'
import { Layout } from '../components/common/Layout'
import { useNotificationPreferences } from '../hooks/useNotifications'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { RequestStatus, DM329Status } from '../types'

// Tutte le possibili transizioni di stato
const REQUEST_STATUS_TRANSITIONS: Array<{
  from: RequestStatus
  to: RequestStatus
  label: string
}> = [
  { from: 'APERTA', to: 'ASSEGNATA', label: 'APERTA → ASSEGNATA' },
  { from: 'ASSEGNATA', to: 'IN_LAVORAZIONE', label: 'ASSEGNATA → IN LAVORAZIONE' },
  { from: 'IN_LAVORAZIONE', to: 'COMPLETATA', label: 'IN LAVORAZIONE → COMPLETATA' },
  { from: 'IN_LAVORAZIONE', to: 'BLOCCATA', label: 'IN LAVORAZIONE → BLOCCATA' },
  { from: 'BLOCCATA', to: 'IN_LAVORAZIONE', label: 'BLOCCATA → IN LAVORAZIONE' },
  { from: 'APERTA', to: 'ABORTITA', label: 'APERTA → ABORTITA' },
  { from: 'ASSEGNATA', to: 'ABORTITA', label: 'ASSEGNATA → ABORTITA' },
  { from: 'BLOCCATA', to: 'ABORTITA', label: 'BLOCCATA → ABORTITA' },
]

const DM329_STATUS_TRANSITIONS: Array<{
  from: DM329Status
  to: DM329Status
  label: string
}> = [
  { from: '1-INCARICO_RICEVUTO', to: '2-SCHEDA_DATI_PRONTA', label: '1-INCARICO RICEVUTO → 2-SCHEDA DATI PRONTA' },
  { from: '2-SCHEDA_DATI_PRONTA', to: '3-MAIL_CLIENTE_INVIATA', label: '2-SCHEDA DATI PRONTA → 3-MAIL CLIENTE INVIATA' },
  { from: '3-MAIL_CLIENTE_INVIATA', to: '4-DOCUMENTI_PRONTI', label: '3-MAIL CLIENTE INVIATA → 4-DOCUMENTI PRONTI' },
  { from: '4-DOCUMENTI_PRONTI', to: '5-ATTESA_FIRMA', label: '4-DOCUMENTI PRONTI → 5-ATTESA FIRMA' },
  { from: '5-ATTESA_FIRMA', to: '6-PRONTA_PER_CIVA', label: '5-ATTESA FIRMA → 6-PRONTA PER CIVA' },
  { from: '6-PRONTA_PER_CIVA', to: '7-CHIUSA', label: '6-PRONTA PER CIVA → 7-CHIUSA' },
]

export default function NotificationSettings() {
  const { preferences, updatePreferences, updateStatusTransition, isUpdating, isLoading } =
    useNotificationPreferences()
  const { user } = useAuth()

  const [inApp, setInApp] = useState(true)
  const [email, setEmail] = useState(false)
  const [statusTransitions, setStatusTransitions] = useState<Record<string, boolean>>({})
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [testEmailLoading, setTestEmailLoading] = useState(false)
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null)

  // Carica preferenze iniziali
  useEffect(() => {
    if (preferences) {
      setInApp(preferences.in_app)
      setEmail(preferences.email)
      setStatusTransitions(preferences.status_transitions || {})
    }
  }, [preferences])

  const handleSaveGeneral = () => {
    updatePreferences(
      { in_app: inApp, email },
      {
        onSuccess: () => {
          setSaveSuccess(true)
          setTimeout(() => setSaveSuccess(false), 3000)
        },
      }
    )
  }

  const handleToggleTransition = (from: string, to: string, enabled: boolean) => {
    const key = `${from}_${to}`
    // Aggiorna immediatamente lo stato locale per feedback visivo
    setStatusTransitions((prev) => ({ ...prev, [key]: enabled }))
    // Salva sul backend
    updateStatusTransition(
      { statusFrom: from, statusTo: to, enabled },
      {
        onError: (error) => {
          console.error('Errore salvataggio preferenza:', error)
          // Ripristina lo stato locale in caso di errore
          setStatusTransitions((prev) => ({ ...prev, [key]: !enabled }))
        }
      }
    )
  }

  const isTransitionEnabled = (from: string, to: string): boolean => {
    const key = `${from}_${to}`
    return statusTransitions[key] || false
  }

  const handleTestEmail = async () => {
    setTestEmailLoading(true)
    setTestEmailResult(null)

    try {
      const { data, error } = await supabase.functions.invoke('test-notification-email')

      if (error) {
        setTestEmailResult({
          success: false,
          message: `Errore: ${error.message}`,
        })
      } else {
        setTestEmailResult({
          success: true,
          message: data.message || 'Email di test inviata con successo!',
        })
      }
    } catch (err) {
      setTestEmailResult({
        success: false,
        message: `Errore imprevisto: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    } finally {
      setTestEmailLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <Container maxWidth="md" sx={{ py: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
            <CircularProgress />
          </Box>
        </Container>
      </Layout>
    )
  }

  return (
    <Layout>
      <Container maxWidth="md" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Impostazioni Notifiche
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Modalità di Notifica
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Scegli come ricevere le notifiche per gli eventi delle richieste
        </Typography>

        <FormGroup>
          <FormControlLabel
            control={<Switch checked={inApp} onChange={(e) => setInApp(e.target.checked)} />}
            label="Notifiche in-app"
          />
          <FormControlLabel
            control={
              <Switch
                checked={email}
                onChange={(e) => setEmail(e.target.checked)}
              />
            }
            label="Notifiche via email"
          />
        </FormGroup>

        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSaveGeneral}
            disabled={isUpdating}
          >
            Salva Impostazioni
          </Button>
        </Box>

        {saveSuccess && (
          <Alert severity="success" sx={{ mt: 2 }}>
            Impostazioni salvate con successo!
          </Alert>
        )}
      </Paper>

      {user?.role === 'admin' && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Test Email (Solo Admin)
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Invia una email di test al tuo indirizzo per verificare la configurazione del sistema
          </Typography>

          <Button
            variant="outlined"
            startIcon={<EmailIcon />}
            onClick={handleTestEmail}
            disabled={testEmailLoading}
            color="info"
          >
            {testEmailLoading ? 'Invio in corso...' : 'Invia Email di Test'}
          </Button>

          {testEmailResult && (
            <Alert severity={testEmailResult.success ? 'success' : 'error'} sx={{ mt: 2 }}>
              {testEmailResult.message}
            </Alert>
          )}
        </Paper>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Notifiche Automatiche
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Queste notifiche sono sempre attive e non possono essere disabilitate:
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Chip label="Creazione nuove richieste" color="info" variant="outlined" />
          <Chip label="Blocco richieste (→ SOSPESA)" color="error" variant="outlined" />
          <Chip label="Sblocco richieste (SOSPESA →)" color="success" variant="outlined" />
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Notifiche per Cambio Stato
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Configura per quali transizioni di stato desideri ricevere notifiche
        </Typography>

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Richieste Standard</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FormGroup>
              {REQUEST_STATUS_TRANSITIONS.map((transition) => {
                const key = `${transition.from}_${transition.to}`
                return (
                  <FormControlLabel
                    key={key}
                    control={
                      <Switch
                        checked={isTransitionEnabled(transition.from, transition.to)}
                        onChange={(e) =>
                          handleToggleTransition(transition.from, transition.to, e.target.checked)
                        }
                        disabled={isUpdating}
                      />
                    }
                    label={transition.label}
                  />
                )
              })}
            </FormGroup>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Richieste DM329</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <FormGroup>
              {DM329_STATUS_TRANSITIONS.map((transition) => {
                const key = `${transition.from}_${transition.to}`
                return (
                  <FormControlLabel
                    key={key}
                    control={
                      <Switch
                        checked={isTransitionEnabled(transition.from, transition.to)}
                        onChange={(e) =>
                          handleToggleTransition(transition.from, transition.to, e.target.checked)
                        }
                        disabled={isUpdating}
                      />
                    }
                    label={transition.label}
                  />
                )
              })}
            </FormGroup>
          </AccordionDetails>
        </Accordion>
      </Paper>
    </Container>
    </Layout>
  )
}
