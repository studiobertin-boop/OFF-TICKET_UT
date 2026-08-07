import { useState } from 'react'
import { Control, Controller } from 'react-hook-form'
import {
  TextField,
  Box,
  Autocomplete,
} from '@mui/material'
import { FieldValue } from '@/components/common'
import { useInstallers } from '@/hooks/useInstallers'
import { AddInstallerDialog } from '@/components/installers/AddInstallerDialog'

interface DatiGeneraliSectionProps {
  control: Control<any>
  errors: any
  defaultCustomer?: string
  defaultInstaller?: string
}

/**
 * SEZIONE 1: DATI GENERALI
 * - Data sopralluogo (obbligatorio)
 * - Nome tecnico (obbligatorio)
 * - Cliente (obbligatorio, suggerimento da DB)
 * - Installatore (obbligatorio, precompilato con OFFICINA DEL COMPRESSORE)
 * - Note generali (opzionale)
 */
export const DatiGeneraliSection = ({
  control,
  errors,
  defaultCustomer,
  defaultInstaller = 'OFFICINA DEL COMPRESSORE S.R.L.',
}: DatiGeneraliSectionProps) => {
  // Fetch installers per autocomplete
  const { data: installersResponse, refetch: refetchInstallers } = useInstallers({ is_active: true })
  const installers = installersResponse?.data || []

  // State per dialog aggiunta installatore
  const [addInstallerDialogOpen, setAddInstallerDialogOpen] = useState(false)
  const [pendingInstallerNome, setPendingInstallerNome] = useState('')
  const [tempOnChange, setTempOnChange] = useState<((nome: string) => void) | null>(null)

  return (
    <Box>
      {/* Griglia a riempimento: i campi si affiancano finché ci stanno, invece di
          occupare frazioni fisse che a metà larghezza lasciano buchi. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 1.5, alignItems: 'start' }}>
        <Box>
          <Controller
            name="dati_generali.data_sopralluogo"
            control={control}
            rules={{ required: 'Campo obbligatorio' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Data sopralluogo"
                type="date"
                size="small"
                fullWidth
                required
                error={!!errors?.dati_generali?.data_sopralluogo}
                helperText={errors?.dati_generali?.data_sopralluogo?.message}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            )}
          />
        </Box>

        {/* Nome Tecnico */}
        <Box>
          <Controller
            name="dati_generali.nome_tecnico"
            control={control}
            rules={{ required: 'Campo obbligatorio' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nome tecnico"
                size="small"
                fullWidth
                required
                error={!!errors?.dati_generali?.nome_tecnico}
                helperText={errors?.dati_generali?.nome_tecnico?.message}
                placeholder="Nome e cognome del tecnico"
              />
            )}
          />
        </Box>

        {/* Installatore */}
        <Box>
          <Controller
            name="dati_generali.installatore"
            control={control}
            rules={{ required: 'Campo obbligatorio' }}
            defaultValue={defaultInstaller}
            render={({ field: { onChange, value, ...field } }) => (
              <Autocomplete
                {...field}
                value={installers.find((i) => i.nome === value) || null}
                onChange={(_, newValue) => {
                  // Se è un oggetto Installer, prendi il nome
                  if (newValue && typeof newValue === 'object' && 'nome' in newValue) {
                    onChange(newValue.nome)
                  }
                  // Se è una stringa (freeSolo), verifica se esiste nel DB
                  else if (typeof newValue === 'string') {
                    const exists = installers.some(
                      (i) => i.nome.toLowerCase().trim() === newValue.toLowerCase().trim()
                    )

                    if (!exists && newValue.trim().length > 0) {
                      // Nome non esiste - apri dialog per aggiungere
                      setPendingInstallerNome(newValue.trim())
                      setTempOnChange(() => onChange)
                      setAddInstallerDialogOpen(true)
                    } else {
                      onChange(newValue)
                    }
                  } else {
                    onChange('')
                  }
                }}
                options={installers}
                getOptionLabel={(option) => {
                  if (typeof option === 'string') return option
                  return option.nome
                }}
                isOptionEqualToValue={(option, value) => {
                  if (!value) return false
                  const optionNome = typeof option === 'string' ? option : option.nome
                  const valueNome = typeof value === 'string' ? value : value.nome
                  return optionNome === valueNome
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Installatore"
                    size="small"
                    required
                    error={!!errors?.dati_generali?.installatore}
                    helperText={errors?.dati_generali?.installatore?.message}
                    placeholder="Seleziona o inserisci installatore"
                  />
                )}
                freeSolo
                autoSelect
                size="small"
                fullWidth
              />
            )}
          />
        </Box>

        {/* Cliente: non è compilabile qui — arriva dall'anagrafica della pratica.
            Resta registrato nel form (il Controller c'è) ma smette di occupare una
            casella di testo che invita a scriverci dentro. */}
        <Controller
          name="dati_generali.cliente"
          control={control}
          rules={{ required: 'Campo obbligatorio' }}
          defaultValue={defaultCustomer || ''}
          render={({ field }) => <FieldValue label="Cliente" value={field.value} sx={{ pt: 0.5 }} />}
        />
      </Box>

      {/* Note generali: campo lungo, a piena larghezza sotto la griglia, così non
          costringe gli altri campi a una colonna stretta. */}
      <Box sx={{ mt: 1.5 }}>
        <Controller
          name="dati_generali.note_generali"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Note generali"
              size="small"
              fullWidth
              multiline
              minRows={1}
              maxRows={6}
              error={!!errors?.dati_generali?.note_generali}
              helperText={errors?.dati_generali?.note_generali?.message}
              placeholder="Note aggiuntive sul sopralluogo…"
            />
          )}
        />
      </Box>

      {/* Dialog per aggiungere nuovo installatore */}
      <AddInstallerDialog
        open={addInstallerDialogOpen}
        onClose={() => {
          setAddInstallerDialogOpen(false)
          setPendingInstallerNome('')
          setTempOnChange(null)
        }}
        initialNome={pendingInstallerNome}
        onSuccess={async (nome) => {
          // Refetch installers per aggiornare la lista
          await refetchInstallers()
          // Imposta il nuovo valore nel form
          if (tempOnChange) {
            tempOnChange(nome)
          }
        }}
      />
    </Box>
  )
}
