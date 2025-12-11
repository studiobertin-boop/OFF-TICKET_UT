/**
 * CIVA Summary Page
 *
 * Visualizza riepilogo dati apparecchiature da caricare sul portale CIVA
 * Accessibile solo a admin e userdm329
 */

import '@/styles/civaPrint.css'
import { useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Breadcrumbs,
  Link,
  Divider
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Print as PrintIcon,
  Home as HomeIcon
} from '@mui/icons-material'
import { Layout } from '@/components/common/Layout'
import { useAuth } from '@/hooks/useAuth'
import { useCIVAData } from '@/hooks/useCIVAData'
import { filterCIVAEquipment } from '@/utils/civaFiltering'
import { checkCIVACompleteness } from '@/utils/civaValidation'
import { CIVAApparecchioColumn } from '@/components/civa/CIVAApparecchioColumn'
import { CIVADataIncompleteAlert } from '@/components/civa/CIVADataIncompleteAlert'

export const CIVASummary = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Check access rights
  const hasAccess = user?.role === 'admin' || user?.role === 'userdm329'

  // Load all CIVA data
  const {
    request,
    equipmentData,
    customer,
    installer,
    manufacturers,
    isLoading,
    error
  } = useCIVAData(id!)

  // Filter and classify equipment for CIVA
  const civaData = useMemo(() => {
    if (!equipmentData || !manufacturers) {
      return { dichiarazioni: [], verifiche: [] }
    }
    return filterCIVAEquipment(equipmentData, manufacturers)
  }, [equipmentData, manufacturers])

  // Check completeness
  const completenessCheck = useMemo(() => {
    if (!customer || !installer) {
      return {
        isComplete: false,
        customerComplete: !!customer,
        installerComplete: !!installer,
        manufacturersComplete: false,
        missingCustomerFields: !customer ? [{ field: 'customer', label: 'Cliente non trovato' }] : [],
        missingInstallerFields: !installer ? [{ field: 'installer', label: 'Installatore non trovato' }] : [],
        incompleteManufacturers: []
      }
    }

    const allApparecchi = [...civaData.dichiarazioni, ...civaData.verifiche]
    return checkCIVACompleteness(customer, installer, allApparecchi)
  }, [customer, installer, civaData])

  // Handle print
  const handlePrint = () => {
    window.print()
  }

  // Access denied
  if (!hasAccess) {
    return (
      <Layout>
        <Alert severity="error">
          Accesso negato. Solo admin e userdm329 possono visualizzare i dati CIVA.
        </Alert>
      </Layout>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  // Error state
  if (error) {
    return (
      <Layout>
        <Alert severity="error">
          Errore nel caricamento dei dati: {error instanceof Error ? error.message : 'Errore sconosciuto'}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/requests/${id}/technical-details`)}
          sx={{ mt: 2 }}
        >
          Torna alla Scheda Tecnica
        </Button>
      </Layout>
    )
  }

  // Missing data
  if (!equipmentData) {
    return (
      <Layout>
        <Alert severity="warning">
          Scheda dati tecnici non trovata per questa richiesta.
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/requests/${id}`)}
          sx={{ mt: 2 }}
        >
          Torna alla Richiesta
        </Button>
      </Layout>
    )
  }

  // No CIVA equipment
  const totalApparecchi = civaData.dichiarazioni.length + civaData.verifiche.length
  if (totalApparecchi === 0) {
    return (
      <Layout>
        <Box className="no-print" sx={{ mb: 3 }}>
          <Breadcrumbs>
            <Link
              component="button"
              variant="body2"
              onClick={() => navigate('/dashboard')}
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
              Dashboard
            </Link>
            <Link component="button" variant="body2" onClick={() => navigate('/requests')}>
              Richieste
            </Link>
            <Link
              component="button"
              variant="body2"
              onClick={() => navigate(`/requests/${id}`)}
            >
              {request?.title || 'Richiesta'}
            </Link>
            <Typography color="text.primary">Dati CIVA</Typography>
          </Breadcrumbs>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="h6">Nessun apparecchio richiede CIVA</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Le apparecchiature presenti in questa scheda tecnica non rientrano nei criteri per il
            caricamento sul portale CIVA.
          </Typography>
        </Alert>

        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/requests/${id}/technical-details`)}
          variant="contained"
        >
          Torna alla Scheda Tecnica
        </Button>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Header - Hidden on print */}
      <Box className="no-print" sx={{ mb: 3 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate('/dashboard')}
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Dashboard
          </Link>
          <Link component="button" variant="body2" onClick={() => navigate('/requests')}>
            Richieste
          </Link>
          <Link
            component="button"
            variant="body2"
            onClick={() => navigate(`/requests/${id}`)}
          >
            {request?.title || 'Richiesta'}
          </Link>
          <Typography color="text.primary">Dati CIVA</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4">Riepilogo Dati CIVA</Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(`/requests/${id}/technical-details`)}
              variant="outlined"
            >
              Indietro
            </Button>
            <Button
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              variant="contained"
              disabled={!completenessCheck.isComplete}
            >
              Stampa
            </Button>
          </Box>
        </Box>

        {/* Alert for incomplete data */}
        {!completenessCheck.isComplete && (
          <CIVADataIncompleteAlert requestId={id!} completenessCheck={completenessCheck} />
        )}
      </Box>

      {/* Print-only header */}
      <Box
        className="print-only"
        sx={{ display: 'none', '@media print': { display: 'block', mb: 2 } }}
      >
        <Typography variant="h5" sx={{ fontWeight: 700, textAlign: 'center' }}>
          Riepilogo Dati CIVA - {request?.title}
        </Typography>
        <Divider sx={{ my: 1 }} />
      </Box>

      {/* Layout: Affianca DICHIARAZIONI e VERIFICHE se poche apparecchiature */}
      {totalApparecchi <= 6 ? (
        // Layout affiancato (max 6 apparecchiature totali)
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* Section: DICHIARAZIONI */}
          {civaData.dichiarazioni.length > 0 && (
            <Paper sx={{ p: 2, flex: 1, minWidth: 300 }}>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                DICHIARAZIONI DI MESSA IN SERVIZIO ({civaData.dichiarazioni.length})
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2
                }}
              >
                {civaData.dichiarazioni.map(apparecchio => (
                  <CIVAApparecchioColumn
                    key={apparecchio.codice}
                    apparecchio={apparecchio}
                    customer={customer!}
                    installer={installer!}
                    impianto={equipmentData.dati_impianto}
                  />
                ))}
              </Box>
            </Paper>
          )}

          {/* Section: VERIFICHE */}
          {civaData.verifiche.length > 0 && (
            <Paper sx={{ p: 2, flex: 1, minWidth: 300 }}>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                VERIFICHE DI MESSA IN SERVIZIO ({civaData.verifiche.length})
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2
                }}
              >
                {civaData.verifiche.map(apparecchio => (
                  <CIVAApparecchioColumn
                    key={apparecchio.codice}
                    apparecchio={apparecchio}
                    customer={customer!}
                    installer={installer!}
                    impianto={equipmentData.dati_impianto}
                  />
                ))}
              </Box>
            </Paper>
          )}
        </Box>
      ) : (
        // Layout verticale (più di 6 apparecchiature)
        <>
          {/* Section: DICHIARAZIONI */}
          {civaData.dichiarazioni.length > 0 && (
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                DICHIARAZIONI DI MESSA IN SERVIZIO ({civaData.dichiarazioni.length})
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  overflowX: 'auto',
                  pb: 2,
                  '@media print': {
                    flexWrap: 'wrap',
                    overflowX: 'visible'
                  }
                }}
              >
                {civaData.dichiarazioni.map(apparecchio => (
                  <CIVAApparecchioColumn
                    key={apparecchio.codice}
                    apparecchio={apparecchio}
                    customer={customer!}
                    installer={installer!}
                    impianto={equipmentData.dati_impianto}
                  />
                ))}
              </Box>
            </Paper>
          )}

          {/* Section: VERIFICHE */}
          {civaData.verifiche.length > 0 && (
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h5" sx={{ mb: 2, fontWeight: 600 }}>
                VERIFICHE DI MESSA IN SERVIZIO ({civaData.verifiche.length})
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  overflowX: 'auto',
                  pb: 2,
                  '@media print': {
                    flexWrap: 'wrap',
                    overflowX: 'visible'
                  }
                }}
              >
                {civaData.verifiche.map(apparecchio => (
                  <CIVAApparecchioColumn
                    key={apparecchio.codice}
                    apparecchio={apparecchio}
                    customer={customer!}
                    installer={installer!}
                    impianto={equipmentData.dati_impianto}
                  />
                ))}
              </Box>
            </Paper>
          )}
        </>
      )}
    </Layout>
  )
}
