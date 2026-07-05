import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Card, CardContent, Typography, Button, Box, Alert, Chip, Stack } from '@mui/material'
import { Request, Customer } from '@/types'
import { useUpdateRequest } from '@/hooks/useRequests'
import { DM329PraticaSection, Dm329PraticaValue } from './DM329PraticaSection'
import { DM329IntegrazioneSection, Dm329IntegrazioneValue } from './DM329IntegrazioneSection'

interface Props {
  request: Request
  customer: Customer
  sedeLegale: string
  /** true se la pratica ha già un codice: pannello in modalità "modifica" (collassato + prefill). */
  hasCode: boolean
  /** Codice pratica attuale, per mostrarlo in modalità modifica. */
  currentCodice?: string
  onSaved: () => void
}

/**
 * Pannello sul dettaglio pratica DM329 per assegnare (se manca) o modificare (se già presente)
 * il codice pratica dopo la creazione, riusando la stessa logica del form di creazione.
 * Solo admin/userdm329. In modifica i campi sono prefillati coi valori correnti.
 */
export const AssegnaCodicePraticaPanel = ({ request, customer, sedeLegale, hasCode, currentCodice, onSaved }: Props) => {
  const isIntegrazione = request.request_type?.name === 'DM329-Integrazioni'

  // Valori iniziali per la modalità modifica (solo se la pratica è già codificata).
  // Nota: l'indirizzo NON va qui — è prefillato tramite i defaultValues del form sottostante
  // (la sezione lo legge dal control, non da `initial`).
  const initialPratica: Partial<Dm329PraticaValue> | undefined =
    hasCode && !isIntegrazione
      ? {
          sala_lettera: request.sala_lettera ?? undefined,
          denominazione_sala: request.denominazione_sala ?? undefined,
          progressivo: request.progressivo ?? undefined,
          anno: request.anno ?? undefined,
          impianto_uguale_sede_legale: request.impianto_uguale_sede_legale ?? undefined,
        }
      : undefined
  const initialPadreId = hasCode && isIntegrazione ? request.pratica_padre_id ?? undefined : undefined

  const { control, setValue } = useForm<{ indirizzo_impianto: string }>({
    defaultValues: { indirizzo_impianto: request.indirizzo_impianto ?? '' },
  })
  const updateRequest = useUpdateRequest()

  // In modifica parte collassato (mostra il codice attuale + "Modifica"); in assegnazione parte aperto.
  const [editing, setEditing] = useState(!hasCode)
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
      setEditing(false)
      onSaved()
    } catch (e: any) {
      setError(e?.message || 'Errore nel salvataggio del codice pratica')
    }
  }

  const borderColor = hasCode ? 'divider' : 'warning.main'

  return (
    <Card sx={{ mt: 2, borderLeft: '4px solid', borderColor }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {hasCode ? 'Codice pratica' : 'Assegna codice pratica'}
        </Typography>

        {hasCode && !editing ? (
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip label={currentCodice || '—'} color="primary" />
            <Button variant="outlined" size="small" onClick={() => setEditing(true)}>
              Modifica
            </Button>
          </Stack>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {hasCode
                ? 'Modifica sala, progressivo, anno o indirizzo. Cambiando il codice, controlla che rispetti i vincoli.'
                : 'Questa pratica è stata creata prima della funzione codice pratica. Assegnalo qui.'}
            </Typography>

            {isIntegrazione ? (
              <DM329IntegrazioneSection
                customer={customer}
                initialPadreId={initialPadreId}
                onChange={(value, v) => setIntegrVal({ value, valid: v })}
              />
            ) : (
              <DM329PraticaSection
                customer={customer}
                sedeLegale={sedeLegale}
                control={control}
                setValue={setValue}
                initial={initialPratica}
                onChange={(value, v) => setPraticaVal({ value, valid: v })}
              />
            )}

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
              {hasCode && (
                <Button color="inherit" onClick={() => { setEditing(false); setError(null) }} disabled={updateRequest.isPending}>
                  Annulla
                </Button>
              )}
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={!valid || updateRequest.isPending}
              >
                {updateRequest.isPending ? 'Salvataggio…' : 'Salva codice pratica'}
              </Button>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  )
}
