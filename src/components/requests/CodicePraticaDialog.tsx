import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert } from '@mui/material'
import { Request, Customer } from '@/types'
import { useUpdateRequest } from '@/hooks/useRequests'
import { DM329PraticaSection, Dm329PraticaValue } from './DM329PraticaSection'
import { DM329IntegrazioneSection, Dm329IntegrazioneValue } from './DM329IntegrazioneSection'

interface Props {
  request: Request
  customer: Customer
  sedeLegale: string
  /** true se la pratica ha già un codice: dialog in modalità modifica coi campi prefillati. */
  hasCode: boolean
  onClose: () => void
  onSaved: () => void
}

/**
 * Dialog per assegnare (se manca) o modificare (se già presente) il codice pratica DM329
 * dopo la creazione, riusando la stessa logica del form di creazione. Solo admin/userdm329.
 * Va montato solo quando aperto (mount fresco = prefill applicato a ogni apertura).
 */
export const CodicePraticaDialog = ({ request, customer, sedeLegale, hasCode, onClose, onSaved }: Props) => {
  const isIntegrazione = request.request_type?.name === 'DM329-Integrazioni'

  // Valori iniziali per la modifica (l'indirizzo NON va qui: è prefillato dai defaultValues del form).
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
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Errore nel salvataggio del codice pratica')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{hasCode ? 'Modifica codice pratica' : 'Assegna codice pratica'}</DialogTitle>
      <DialogContent dividers>
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={updateRequest.isPending}>
          Annulla
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={!valid || updateRequest.isPending}>
          {updateRequest.isPending ? 'Salvataggio…' : 'Salva'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
