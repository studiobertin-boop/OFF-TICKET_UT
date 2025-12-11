import { useState } from 'react'
import { Control, Controller } from 'react-hook-form'
import {
  TextField,
  Grid,
  Typography,
  Box,
  Autocomplete,
} from '@mui/material'
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
      <Typography variant="h6" gutterBottom>
        1. Dati Generali
      </Typography>

      <Grid container spacing={2}>
        {/* Data Sopralluogo */}
        <Grid item xs={12} md={4}>
          <Controller
            name="dati_generali.data_sopralluogo"
            control={control}
            rules={{ required: 'Campo obbligatorio' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Data Sopralluogo"
                type="date"
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
        </Grid>

        {/* Nome Tecnico */}
        <Grid item xs={12} md={4}>
          <Controller
            name="dati_generali.nome_tecnico"
            control={control}
            rules={{ required: 'Campo obbligatorio' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nome Tecnico"
                fullWidth
                required
                error={!!errors?.dati_generali?.nome_tecnico}
                helperText={errors?.dati_generali?.nome_tecnico?.message}
                placeholder="Nome e cognome del tecnico"
              />
            )}
          />
        </Grid>

        {/* Cliente */}
        <Grid item xs={12} md={6}>
          <Controller
            name="dati_generali.cliente"
            control={control}
            rules={{ required: 'Campo obbligatorio' }}
            defaultValue={defaultCustomer || ''}
            render={({ field }) => (
              <TextField
                {...field}
                label="Cliente"
                fullWidth
                required
                error={!!errors?.dati_generali?.cliente}
                helperText={errors?.dati_generali?.cliente?.message}
                placeholder="Ragione sociale cliente"
              />
            )}
          />
        </Grid>

        {/* Installatore */}
        <Grid item xs={12} md={6}>
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
                    required
                    error={!!errors?.dati_generali?.installatore}
                    helperText={
                      errors?.dati_generali?.installatore?.message ||
                      'Precompilato con OFFICINA DEL COMPRESSORE S.R.L. - Digita per cercare o aggiungere'
                    }
                    placeholder="Seleziona o inserisci installatore"
                  />
                )}
                freeSolo
                autoSelect
                fullWidth
              />
            )}
          />
        </Grid>

        {/* Note Generali */}
        <Grid item xs={12}>
          <Controller
            name="dati_generali.note_generali"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Note Generali"
                fullWidth
                multiline
                rows={3}
                error={!!errors?.dati_generali?.note_generali}
                helperText={errors?.dati_generali?.note_generali?.message}
                placeholder="Note aggiuntive sul sopralluogo..."
              />
            )}
          />
        </Grid>
      </Grid>

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
