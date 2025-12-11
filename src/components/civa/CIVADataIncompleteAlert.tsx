/**
 * CIVADataIncompleteAlert Component
 *
 * Mostra alert con elenco campi mancanti per completezza CIVA
 */

import { Alert, AlertTitle, Typography, Box, Button } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import type { CIVACompletenessCheck } from '@/types/civa'

interface CIVADataIncompleteAlertProps {
  requestId: string
  completenessCheck: CIVACompletenessCheck
  onClose?: () => void
}

export const CIVADataIncompleteAlert = ({
  requestId,
  completenessCheck,
  onClose
}: CIVADataIncompleteAlertProps) => {
  const navigate = useNavigate()

  // Se completo, non mostrare nulla
  if (completenessCheck.isComplete) {
    return null
  }

  return (
    <Alert
      severity="warning"
      onClose={onClose}
      sx={{ mb: 2 }}
    >
      <AlertTitle sx={{ fontWeight: 700 }}>Dati incompleti per CIVA</AlertTitle>

      <Typography variant="body2" sx={{ mb: 1.5 }}>
        Completa i seguenti dati per abilitare il caricamento CIVA:
      </Typography>

      {/* Customer incomplete */}
      {!completenessCheck.customerComplete && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            CLIENTE:
          </Typography>
          <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2 }}>
            {completenessCheck.missingCustomerFields.map((field, index) => (
              <li key={index}>
                <Typography variant="body2">{field.label}</Typography>
              </li>
            ))}
          </Box>
        </Box>
      )}

      {/* Installer incomplete */}
      {!completenessCheck.installerComplete && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            INSTALLATORE:
          </Typography>
          <Box component="ul" sx={{ mt: 0.5, mb: 0, pl: 2 }}>
            {completenessCheck.missingInstallerFields.map((field, index) => (
              <li key={index}>
                <Typography variant="body2">{field.label}</Typography>
              </li>
            ))}
          </Box>
        </Box>
      )}

      {/* Manufacturers incomplete */}
      {!completenessCheck.manufacturersComplete && (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            COSTRUTTORI:
          </Typography>
          {completenessCheck.incompleteManufacturers.map((manufacturer, idx) => (
            <Box key={idx} sx={{ mt: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {manufacturer.marca} ({manufacturer.codice}):
              </Typography>
              <Box component="ul" sx={{ mt: 0.25, mb: 0.5, pl: 2 }}>
                {manufacturer.missingFields.map((field, index) => (
                  <li key={index}>
                    <Typography variant="body2">{field.label}</Typography>
                  </li>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          onClick={() => navigate(`/requests/${requestId}/technical-details`)}
          variant="outlined"
          size="small"
        >
          Torna alla Scheda Tecnica
        </Button>

        {!completenessCheck.customerComplete && (
          <Button
            onClick={() => navigate('/admin/customers')}
            variant="outlined"
            size="small"
          >
            Gestisci Clienti
          </Button>
        )}

        {!completenessCheck.manufacturersComplete && (
          <Button
            onClick={() => navigate('/admin/manufacturers')}
            variant="outlined"
            size="small"
          >
            Gestisci Costruttori
          </Button>
        )}
      </Box>
    </Alert>
  )
}
