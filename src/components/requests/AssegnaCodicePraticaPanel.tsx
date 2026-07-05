import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Card, CardContent, Typography, Button, Box, Alert } from '@mui/material'
import { Request, Customer } from '@/types'
import { useUpdateRequest } from '@/hooks/useRequests'
import { DM329PraticaSection, Dm329PraticaValue } from './DM329PraticaSection'
import { DM329IntegrazioneSection, Dm329IntegrazioneValue } from './DM329IntegrazioneSection'

interface Props {
  request: Request
  customer: Customer
  sedeLegale: string
  onSaved: () => void
}

/**
 * Pannello sul dettaglio pratica DM329 priva di codice: assegna il codice pratica
 * dopo la creazione, riusando la stessa logica del form di creazione. Solo admin/userdm329.
 */
export const AssegnaCodicePraticaPanel = ({ request, customer, sedeLegale, onSaved }: Props) => {
  const isIntegrazione = request.request_type?.name === 'DM329-Integrazioni'
  const { control, setValue } = useForm<{ indirizzo_impianto: string }>({
    defaultValues: { indirizzo_impianto: '' },
  })
  const updateRequest = useUpdateRequest()

  const [praticaVal, setPraticaVal] = useState<{ value: Dm329PraticaValue | null; valid: boolean }>({ value: null, valid: false })
  const [integrVal, setIntegrVal] = useState<{ value: Dm329IntegrazioneValue | null; valid: boolean }>({ value: null, valid: false })
  const [error, setError] = useState<string | null>(null)

  const valid = isIntegrazione ? integrVal.valid : praticaVal.valid

  const handleSave = async () => {
    setError(null)
    try {
      if (isIntegrazione && integrVal.value) {
        await updateRequest.mutateAsync({
          id: request.id,
          updates: {
            pratica_padre_id: integrVal.value.pratica_padre_id,
            sala_lettera: integrVal.value.sala_lettera,
            progressivo: integrVal.value.progressivo,
            anno: integrVal.value.anno,
          },
        })
      } else if (!isIntegrazione && praticaVal.value) {
        await updateRequest.mutateAsync({
          id: request.id,
          updates: {
            sala_lettera: praticaVal.value.sala_lettera,
            progressivo: praticaVal.value.progressivo,
            anno: praticaVal.value.anno,
            denominazione_sala: praticaVal.value.denominazione_sala,
            indirizzo_impianto: praticaVal.value.indirizzo_impianto,
            impianto_uguale_sede_legale: praticaVal.value.impianto_uguale_sede_legale,
          },
        })
      }
      onSaved()
    } catch (e: any) {
      setError(e?.message || 'Errore nel salvataggio del codice pratica')
    }
  }

  return (
    <Card sx={{ mt: 2, borderLeft: '4px solid', borderColor: 'warning.main' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Assegna codice pratica
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Questa pratica è stata creata prima della funzione codice pratica. Assegnalo qui.
        </Typography>

        {isIntegrazione ? (
          <DM329IntegrazioneSection
            customer={customer}
            onChange={(value, v) => setIntegrVal({ value, valid: v })}
          />
        ) : (
          <DM329PraticaSection
            customer={customer}
            sedeLegale={sedeLegale}
            control={control}
            setValue={setValue}
            onChange={(value, v) => setPraticaVal({ value, valid: v })}
          />
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!valid || updateRequest.isPending}
          >
            {updateRequest.isPending ? 'Salvataggio…' : 'Salva codice pratica'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}
