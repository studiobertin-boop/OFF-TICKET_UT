import { useEffect, useMemo, useRef, useState } from 'react'
import { Box, TextField, MenuItem, Typography, Chip, Divider, Alert } from '@mui/material'
import { Customer } from '@/types'
import { useClientDm329Overview } from '@/hooks/useRequests'
import { composeCodicePratica } from '@/utils/practiceCode'

export interface Dm329IntegrazioneValue {
  pratica_padre_id: string
  sala_lettera: string
  progressivo: number
  anno: number
}

interface Props {
  customer: Customer
  onChange: (value: Dm329IntegrazioneValue | null, valid: boolean) => void
  /** Pratica padre iniziale per la modalità modifica. In creazione resta undefined. */
  initialPadreId?: string
}

/**
 * Sezione del form per DM329-Integrazioni: un'integrazione è un documento agganciato a una
 * pratica esistente del cliente, di cui condivide il codice. Richiede di scegliere la pratica padre.
 */
export const DM329IntegrazioneSection = ({ customer, onChange, initialPadreId }: Props) => {
  const { data: overview = [] } = useClientDm329Overview(customer.id)
  const [padreId, setPadreId] = useState(initialPadreId ?? '')
  const skipInitialReset = useRef(!!initialPadreId)

  const clientSalaCount = useMemo(
    () => new Set(overview.map(p => p.sala_lettera)).size,
    [overview]
  )

  const padre = overview.find(p => p.request_id === padreId)

  // Reset quando cambia cliente (saltato una volta al mount in modalità modifica per non azzerare il prefill)
  useEffect(() => {
    if (skipInitialReset.current) {
      skipInitialReset.current = false
      return
    }
    setPadreId('')
  }, [customer.id])

  useEffect(() => {
    if (padre) {
      onChange(
        {
          pratica_padre_id: padre.request_id,
          sala_lettera: padre.sala_lettera,
          progressivo: padre.progressivo,
          anno: padre.anno,
        },
        true
      )
    } else {
      onChange(null, false)
    }
    // overview tra le deps: in modifica il padre prefillato si registra appena l'overview è caricato.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padreId, overview])

  const codiceOf = (p: (typeof overview)[number]) =>
    composeCodicePratica({
      clientCode: customer.identificativo,
      sala_lettera: p.sala_lettera,
      progressivo: p.progressivo,
      anno: p.anno,
      clientSalaCount,
    })

  return (
    <Box sx={{ mt: 3 }}>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        Pratica da integrare
      </Typography>

      {overview.length === 0 ? (
        <Alert severity="warning">
          Questo cliente non ha pratiche DM329 a cui agganciare un'integrazione. Crea prima la pratica
          iniziale.
        </Alert>
      ) : (
        <TextField
          select
          label="Pratica padre"
          value={padreId}
          onChange={e => setPadreId(e.target.value)}
          fullWidth
          required
          helperText="L'integrazione condivide il codice della pratica scelta"
        >
          <MenuItem value="">
            <em>Seleziona una pratica…</em>
          </MenuItem>
          {overview.map(p => (
            <MenuItem key={p.request_id} value={p.request_id}>
              {codiceOf(p)}
              {p.denominazione_sala ? ` — ${p.denominazione_sala}` : ''}
            </MenuItem>
          ))}
        </TextField>
      )}

      {padre && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Codice ereditato:
          </Typography>
          <Chip label={codiceOf(padre)} color="primary" />
        </Box>
      )}
    </Box>
  )
}
