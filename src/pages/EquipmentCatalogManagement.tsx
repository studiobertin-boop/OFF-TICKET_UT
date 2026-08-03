import { useEffect, useMemo, useRef, useState } from 'react'
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
import toast from 'react-hot-toast'
import type { EquipmentCatalogItem, EquipmentCatalogType } from '@/types'
import { Layout } from '@/components/common/Layout'
import { EquipmentCatalogTable } from '@/components/equipmentCatalog/EquipmentCatalogTable'
import { EquipmentFormFields } from '@/components/equipmentCatalog/EquipmentFormFields'
import { DeleteEquipmentDialog } from '@/components/equipmentCatalog/DeleteEquipmentDialog'
import { AuditPanel } from '@/components/equipmentCatalog/audit/AuditPanel'
import { ModificaMassivaBar } from '@/components/equipmentCatalog/ModificaMassivaBar'
import { ModificaMassivaDialog } from '@/components/equipmentCatalog/ModificaMassivaDialog'
import {
  useCreateEquipment,
  useDeleteEquipment,
  useEquipmentCatalogList,
  useEquipmentMarche,
  useSetEquipmentActive,
  useSetEquipmentProperty,
  useUpdateEquipment,
} from '@/hooks/useEquipmentCatalogAdmin'
import { equipmentCatalogAdminApi } from '@/services/api/equipmentCatalogAdmin'
import {
  EQUIPMENT_CATALOG_TYPES,
  createEquipmentSchema,
  specsSchemaFor,
} from '@/utils/equipmentCatalogValidation'
import type { ChiaveMassiva } from '@/utils/modificaMassiva'

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

  /**
   * Righe selezionate per la modifica massiva.
   *
   * Si azzera a ogni cambio di filtro, di ricerca e di pagina: alla conferma non si devono
   * trascinare righe scelte sotto un filtro diverso, che chi conferma non ha più sotto gli occhi.
   */
  const [selezionate, setSelezionate] = useState<Set<string>>(new Set())

  /** Proprietà costruttiva scelta dalla barra, in attesa di conferma nel dialog. */
  const [azione, setAzione] = useState<{ chiave: ChiaveMassiva; valore: string } | null>(null)
  /**
   * Righe della selezione, risolte.
   *
   * Nel modo «solo la pagina» sono quelle che si vedono; con «tutte quelle del filtro» si
   * caricano, perché la conferma deve ripartire le righe vere e non stimarle.
   */
  const [righeSelezionate, setRigheSelezionate] = useState<EquipmentCatalogItem[]>([])
  /**
   * Numero di «generazione» del filtro/pagina, per scartare una risposta di
   * `selezionaTuttoIlFiltro` arrivata dopo che l'utente è passato a un altro filtro. Si
   * incrementa insieme all'azzeramento della selezione: se non combacia più al ritorno
   * della chiamata, quella risposta appartiene a un filtro che chi conferma non ha più
   * sotto gli occhi.
   */
  const generazioneSelezione = useRef(0)

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
  const setProperty = useSetEquipmentProperty()

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

  const toggleRiga = (id: string) => {
    setSelezionate(prec => {
      const prossime = new Set(prec)
      if (prossime.has(id)) prossime.delete(id)
      else prossime.add(id)
      return prossime
    })
  }

  const togglePagina = (seleziona: boolean) => {
    setSelezionate(seleziona ? new Set((data?.data ?? []).map(r => r.id)) : new Set())
  }

  /**
   * «Seleziona tutte le N righe del filtro»: si caricano gli id, non si finge di averli.
   * Il `pageSize` alto è deliberato — il filtro più largo del catalogo sono poche centinaia
   * di righe, e una seconda pagina qui vorrebbe dire una selezione parziale spacciata per
   * totale.
   *
   * PostgREST non restituisce più di 1000 righe in una chiamata sola: se il filtro ne conta
   * di più, la selezione copre solo le prime 1000 e lo si dice esplicitamente, invece di
   * lasciar credere che sia completa quando non lo è.
   *
   * La chiamata non è annullabile: se l'utente cambia filtro mentre è in volo, la risposta
   * arriverebbe comunque e riscriverebbe la selezione con gli id di un filtro che non è più
   * quello sotto gli occhi. Il numero di generazione, incrementato a ogni azzeramento della
   * selezione, scarta una risposta così — è la stessa guardia già in uso in
   * `EquipmentAutocomplete.tsx`, qui su una richiesta innescata da un click e non da un effetto.
   */
  const selezionaTuttoIlFiltro = async () => {
    const generazione = generazioneSelezione.current
    try {
      const tutte = await equipmentCatalogAdminApi.list({ ...filters, page: 0, pageSize: 1000 })
      if (generazione !== generazioneSelezione.current) return

      setSelezionate(new Set(tutte.data.map(r => r.id)))
      setRigheSelezionate(tutte.data)
      if (tutte.count > tutte.data.length) {
        toast(
          `Il filtro conta ${tutte.count} righe: la selezione copre solo le prime ${tutte.data.length}. Restringi il filtro per selezionarle tutte.`,
          { icon: '⚠️' }
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel caricamento della selezione')
    }
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
    setSelezionate(new Set())
    generazioneSelezione.current++
  }, [searchDebounced, tipo, mostraDisattivate, soloIncompleti])

  // La pagina cambia anche senza che cambino i filtri: la selezione non la segue.
  useEffect(() => {
    setSelezionate(new Set())
    generazioneSelezione.current++
  }, [page, rowsPerPage])

  useEffect(() => {
    const dellaPagina = (data?.data ?? []).filter(r => selezionate.has(r.id))
    // Con la selezione estesa `righeSelezionate` contiene già più righe di quelle visibili:
    // non la si sovrascrive con il solo sottoinsieme della pagina.
    if (dellaPagina.length === selezionate.size) setRigheSelezionate(dellaPagina)
  }, [selezionate, data])

  /**
   * Righe da passare alla barra e al dialog: sempre l'intersezione con `selezionate`.
   *
   * `righeSelezionate` può restare più ampio di `selezionate` — dopo la selezione estesa, se
   * si toglie la spunta a una sola riga visibile, l'euristica dell'effetto sopra non si
   * aggiorna finché la selezione resta più larga di una pagina. Filtrare qui, all'uso, fa sì
   * che una riga appena deselezionata non venga mai scritta, indipendentemente da quando
   * quell'euristica si aggiorna.
   */
  const righeScritte = useMemo(
    () => righeSelezionate.filter(r => selezionate.has(r.id)),
    [righeSelezionate, selezionate]
  )

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

        <ModificaMassivaBar
          righe={righeScritte}
          totaleSelezionate={selezionate.size}
          totaleFiltro={data?.count ?? 0}
          onSelezionaTuttoIlFiltro={selezionaTuttoIlFiltro}
          onScegli={(chiave, valore) => setAzione({ chiave, valore })}
          onAnnulla={() => setSelezionate(new Set())}
        />

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
            selezionate={selezionate}
            onToggleRiga={toggleRiga}
            onTogglePagina={togglePagina}
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

      <ModificaMassivaDialog
        open={azione !== null}
        righe={righeScritte}
        chiave={azione?.chiave ?? null}
        valore={azione?.valore ?? null}
        inCorso={setProperty.isPending}
        errore={setProperty.error instanceof Error ? setProperty.error.message : null}
        onAnnulla={() => {
          setAzione(null)
          setProperty.reset()
        }}
        onConferma={async ids => {
          try {
            const n = await setProperty.mutateAsync({ ids, chiave: azione!.chiave, valore: azione!.valore })
            setAzione(null)
            setSelezionate(new Set())
            toast.success(`${n} ${n === 1 ? 'riga aggiornata' : 'righe aggiornate'}.`)
          } catch {
            // L'errore resta visibile nel dialog tramite `setProperty.error`: qui si evita
            // solo che la promise rifiutata risulti un rigetto non gestito in console.
          }
        }}
      />
    </Layout>
  )
}
