import { useEffect, useMemo, useState } from 'react'
import { useForm, type Control, type FieldValues, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  FactCheck as VerificaIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import type { EquipmentCatalogItem, EquipmentCatalogType } from '@/types'
import { Layout } from '@/components/common/Layout'
import { EquipmentCatalogTable } from '@/components/equipmentCatalog/EquipmentCatalogTable'
import { EquipmentFormFields } from '@/components/equipmentCatalog/EquipmentFormFields'
import { DeleteEquipmentDialog } from '@/components/equipmentCatalog/DeleteEquipmentDialog'
import { AuditPanel } from '@/components/equipmentCatalog/audit/AuditPanel'
import {
  useCreateEquipment,
  useDeleteEquipment,
  useEquipmentCatalogList,
  useEquipmentMarche,
  useSetEquipmentActive,
  useUpdateEquipment,
} from '@/hooks/useEquipmentCatalogAdmin'
import {
  EQUIPMENT_CATALOG_TYPES,
  createEquipmentSchema,
  specsSchemaFor,
} from '@/utils/equipmentCatalogValidation'

/**
 * Gestione del catalogo apparecchiature.
 *
 * A disposizione di admin e userdm329. Oltre al normale lavoro di anagrafica —
 * aggiungere, correggere, disattivare, eliminare — ospita la verifica di
 * coerenza, che confronta le voci fra loro e con le pratiche per far emergere
 * quello che a occhio non si vede: portate che crescono con la pressione,
 * tarature incoerenti, duplicati nascosti da una grafia diversa.
 */

type FormValues = {
  tipo_apparecchiatura: EquipmentCatalogType | ''
  marca: string
  modello: string
  specs: Record<string, number | string | null>
}

const VUOTO: FormValues = { tipo_apparecchiatura: '', marca: '', modello: '', specs: {} }

/** Evita una query per ogni tasto premuto mentre si scrive nella ricerca. */
function useValoreRitardato<T>(valore: T, ms = 300): T {
  const [ritardato, setRitardato] = useState(valore)
  useEffect(() => {
    const t = setTimeout(() => setRitardato(valore), ms)
    return () => clearTimeout(t)
  }, [valore, ms])
  return ritardato
}

/**
 * I dati tecnici ammessi dipendono dal tipo scelto, che è un campo del form
 * stesso: lo schema si sceglie al momento della validazione, dai valori.
 */
const resolverPerTipo: Resolver<FormValues> = (values, context, options) => {
  const tipo = values.tipo_apparecchiatura || null
  const schema = tipo
    ? createEquipmentSchema.extend({ specs: specsSchemaFor(tipo) })
    : createEquipmentSchema
  // Lo schema esclude il tipo vuoto, che nel form è invece lo stato iniziale:
  // è proprio ciò che la validazione deve poter respingere.
  return (zodResolver(schema) as Resolver<FormValues>)(values, context, options)
}

export default function EquipmentCatalogManagement() {
  const [search, setSearch] = useState('')
  const [tipo, setTipo] = useState<EquipmentCatalogType | ''>('')
  const [soloIncompleti, setSoloIncompleti] = useState(false)
  const [mostraDisattivate, setMostraDisattivate] = useState(false)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)

  const [formOpen, setFormOpen] = useState(false)
  const [inModifica, setInModifica] = useState<EquipmentCatalogItem | null>(null)
  const [daEliminare, setDaEliminare] = useState<EquipmentCatalogItem | null>(null)
  const [auditOpen, setAuditOpen] = useState(false)

  const searchDebounced = useValoreRitardato(search)

  const filters = useMemo(
    () => ({
      search: searchDebounced || undefined,
      tipo: tipo || undefined,
      isActive: mostraDisattivate ? ('all' as const) : true,
      soloIncompleti: soloIncompleti || undefined,
      page,
      pageSize: rowsPerPage,
    }),
    [searchDebounced, tipo, mostraDisattivate, soloIncompleti, page, rowsPerPage]
  )

  const { data, isLoading, error } = useEquipmentCatalogList(filters)
  const { data: marche = [] } = useEquipmentMarche(tipo || undefined)

  const createEquipment = useCreateEquipment()
  const updateEquipment = useUpdateEquipment()
  const setActive = useSetEquipmentActive()
  const deleteEquipment = useDeleteEquipment()

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: VUOTO, resolver: resolverPerTipo })

  const tipoScelto = (watch('tipo_apparecchiatura') || null) as EquipmentCatalogType | null

  const apriNuova = () => {
    setInModifica(null)
    reset(VUOTO)
    setFormOpen(true)
  }

  const apriModifica = (item: EquipmentCatalogItem) => {
    setInModifica(item)
    reset({
      tipo_apparecchiatura: item.tipo_apparecchiatura ?? '',
      marca: item.marca,
      modello: item.modello,
      specs: (item.specs ?? {}) as Record<string, number | string | null>,
    })
    setFormOpen(true)
  }

  const salva = handleSubmit(async values => {
    // I campi svuotati li toglie lo schema, per tutti i punti che salvano allo
    // stesso modo: qui non si ripulisce nulla a mano.
    const payload = {
      tipo_apparecchiatura: values.tipo_apparecchiatura as EquipmentCatalogType,
      marca: values.marca,
      modello: values.modello,
      specs: values.specs ?? {},
    }

    if (inModifica) await updateEquipment.mutateAsync({ id: inModifica.id, input: payload })
    else await createEquipment.mutateAsync(payload)

    setFormOpen(false)
  })

  useEffect(() => {
    setPage(0)
  }, [searchDebounced, tipo, mostraDisattivate, soloIncompleti])

  const salvataggioInCorso = createEquipment.isPending || updateEquipment.isPending
  const erroreSalvataggio = createEquipment.error ?? updateEquipment.error

  return (
    <Layout>
      <Box>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 3 }}
          flexWrap="wrap"
          gap={2}
        >
          <Typography variant="h4">Gestisci apparecchiature</Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<VerificaIcon />}
              onClick={() => setAuditOpen(true)}
            >
              Verifica coerenza
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={apriNuova}>
              Nuova apparecchiatura
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {(error as Error).message}
          </Alert>
        )}

        <Paper sx={{ p: 2, mb: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <TextField
              sx={{ flexGrow: 1, minWidth: 240 }}
              size="small"
              placeholder="Cerca per marca o modello…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <FormControl size="small" sx={{ minWidth: 190 }}>
              <InputLabel>Tipo</InputLabel>
              <Select
                value={tipo}
                label="Tipo"
                onChange={e => setTipo(e.target.value as EquipmentCatalogType | '')}
              >
                <MenuItem value="">Tutti</MenuItem>
                {EQUIPMENT_CATALOG_TYPES.map(t => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={soloIncompleti}
                  onChange={e => setSoloIncompleti(e.target.checked)}
                />
              }
              label="Solo incomplete"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={mostraDisattivate}
                  onChange={e => setMostraDisattivate(e.target.checked)}
                />
              }
              label="Mostra disattivate"
            />
          </Stack>
        </Paper>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <EquipmentCatalogTable
            righe={data?.data ?? []}
            totale={data?.count ?? 0}
            page={page}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={n => {
              setRowsPerPage(n)
              setPage(0)
            }}
            onEdit={apriModifica}
            onDelete={setDaEliminare}
            onToggleActive={item => setActive.mutate({ id: item.id, isActive: !item.is_active })}
          />
        )}
      </Box>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {inModifica ? 'Modifica apparecchiatura' : 'Nuova apparecchiatura'}
        </DialogTitle>

        <DialogContent>
          {erroreSalvataggio && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {(erroreSalvataggio as Error).message}
            </Alert>
          )}

          <Box sx={{ pt: 1 }}>
            <EquipmentFormFields
              // I campi dei dati tecnici sono generati a runtime dal tipo scelto,
              // quindi i loro nomi non sono noti al tipo del form.
              control={control as unknown as Control<FieldValues>}
              errors={errors}
              tipo={tipoScelto}
              marche={marche}
              tipoBloccato={inModifica !== null}
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setFormOpen(false)}>Annulla</Button>
          <Button
            variant="contained"
            onClick={salva}
            disabled={salvataggioInCorso}
            startIcon={salvataggioInCorso ? <CircularProgress size={16} /> : null}
          >
            {salvataggioInCorso ? 'Salvataggio…' : inModifica ? 'Salva' : 'Crea'}
          </Button>
        </DialogActions>
      </Dialog>

      <DeleteEquipmentDialog
        open={daEliminare !== null}
        item={daEliminare}
        isDeleting={deleteEquipment.isPending}
        onClose={() => setDaEliminare(null)}
        onConfirm={async () => {
          if (!daEliminare) return
          await deleteEquipment.mutateAsync(daEliminare.id)
          setDaEliminare(null)
        }}
      />

      <AuditPanel open={auditOpen} onClose={() => setAuditOpen(false)} />
    </Layout>
  )
}
