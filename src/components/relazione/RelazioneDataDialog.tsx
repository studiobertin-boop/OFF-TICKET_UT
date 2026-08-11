/**
 * Step "Dati relazione": raccoglie i dati aggiuntivi (additional_info) non presenti
 * nella scheda, li salva e genera/scarica la relazione .docx.
 *
 * ⚠️ Da verificare nell'app in esecuzione (UI non coperta dai test unitari).
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { SelectChangeEvent } from '@mui/material'
import type { Customer } from '@/types'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import { TIPO_GIRI_LABELS, TIPO_GIRI_OPTIONS } from '@/types/technicalSheet'
import { technicalDataApi } from '@/services/api/technicalData'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import { customersApi } from '@/services/api/customers'
import { scegliVarianteSalvata } from '@/utils/equipmentVarianti'
import { additionalInfoSchema } from '@/services/relazione/schema'
import { generateAndDownloadRelazione } from '@/services/relazione/generateRelazione'
import { buildRelazioneModel } from '@/services/relazione/buildRelazioneModel'
import { validateRelazione, haErrori } from '@/services/relazione/preflight'
import type { AdditionalInfo, PraticaInfo, SchemaImpianto, TipoGiri } from '@/services/relazione/types'
import { SchemaImpiantoSection } from './SchemaImpiantoSection'
import { collectCodes, pruneAdditionalInfo } from '@/utils/equipmentCodes'

/**
 * Data odierna in forma ISO, come la vuole il campo data.
 *
 * Composta dai componenti locali e non da `toISOString`, che riporta l'istante in UTC: a
 * fuso avanti, generare una relazione dopo cena la daterebbe al giorno prima.
 */
function oggiISO(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

interface RelazioneDataDialogProps {
  open: boolean
  onClose: () => void
  requestId: string
  scheda: SchedaDatiCompleta
  customer: Customer | null
  /**
   * Dati del codice pratica. Sono la sorgente unica di ubicazione impianto e
   * progressivo di revisione: la scheda dati non li duplica più.
   */
  pratica: PraticaInfo
  initialAdditionalInfo?: AdditionalInfo
  fileName?: string
}

export default function RelazioneDataDialog({
  open,
  onClose,
  requestId,
  scheda,
  customer,
  pratica,
  initialAdditionalInfo,
  fileName,
}: RelazioneDataDialogProps) {
  const compressoriCodes = useMemo(
    () => (scheda.compressori ?? []).map((c) => c.codice),
    [scheda]
  )

  /**
   * Compressori per cui la regolazione dei giri va ancora chiesta: quelli che il catalogo non
   * conosce. Il dato è una proprietà costruttiva del modello e sta in `specs.giri`; qui resta
   * solo la coda di modelli su cui nessuno l'ha ancora osservata — e la risposta viene
   * riscritta a catalogo, così la domanda non torna.
   *
   * La distinzione vale sui soli rotativi a vite: sugli altri tipi il campo resta vuoto.
   */
  const compressoriSenzaGiri = useMemo(
    () => (scheda.compressori ?? []).filter((c) => !c.giri && (!c.tipo || c.tipo === 'VITE')),
    [scheda]
  )
  const serbatoiCodes = useMemo(() => (scheda.serbatoi ?? []).map((s) => s.codice), [scheda])
  const spessimetricaOptions = useMemo(
    () => [
      ...(scheda.disoleatori ?? []).map((d) => d.codice),
      ...serbatoiCodes,
      ...(scheda.scambiatori ?? []).map((s) => s.codice),
      ...(scheda.recipienti_filtro ?? []).map((r) => r.codice),
    ],
    [scheda, serbatoiCodes]
  )

  /** Codici realmente presenti nella scheda: valida i riferimenti salvati in additional_info. */
  const schedaCodes = useMemo(() => collectCodes(scheda), [scheda])

  const queryClient = useQueryClient()

  /**
   * Il documento è una revisione quando il progressivo del codice pratica è oltre lo zero.
   * Alla prima emissione il motivo non si chiede: il capoverso di §1 non esiste.
   */
  const eRevisione = (pratica.progressivo ?? 0) > 0

  const [descrizioneAttivita, setDescrizioneAttivita] = useState('')
  const [dataEmissione, setDataEmissione] = useState('')
  const [motivoRevisione, setMotivoRevisione] = useState('')
  const [giri, setGiri] = useState<Record<string, TipoGiri>>({})
  const [spessimetrica, setSpessimetrica] = useState<string[]>([])
  const [collegamenti, setCollegamenti] = useState<Record<string, string[]>>({})
  const [schema, setSchema] = useState<SchemaImpianto | null>(null)
  const [saving, setSaving] = useState(false)
  const [droppedRefs, setDroppedRefs] = useState<string[]>([])

  // Sincronizza lo stato all'apertura del dialog
  useEffect(() => {
    if (!open) return
    // Scarta i riferimenti ad apparecchiature non più presenti: la scheda può essere cambiata
    // dopo che questi dati sono stati redatti.
    const { info, dropped } = pruneAdditionalInfo(initialAdditionalInfo, schedaCodes)
    // L'anagrafica cliente è la fonte: la copia in `additional_info` serve solo alle pratiche
    // vecchie, redatte quando il campo in anagrafica non c'era o era vuoto.
    setDescrizioneAttivita(
      customer?.descrizione_attivita?.trim() || info.descrizioneAttivita || ''
    )
    // La relazione si emette il giorno in cui la si genera: la data si propone già fatta.
    // Quella salvata vince, perché rigenerando una relazione vecchia si vuole la sua data.
    setDataEmissione(info.dataEmissione || oggiISO())
    setMotivoRevisione(info.motivoRevisione ?? '')
    setGiri(info.compressoriGiri ?? {})
    setSpessimetrica(info.spessimetrica ?? [])
    setCollegamenti(info.collegamentiCompressoriSerbatoi ?? {})
    setDroppedRefs(dropped)
    // Lo schema non è persistito: a ogni apertura si riparte da vuoto.
    setSchema(null)
  }, [open, initialAdditionalInfo, customer, schedaCodes])

  const setGiroFor = (code: string, value: TipoGiri) =>
    setGiri((prev) => ({ ...prev, [code]: value }))

  const setCollegamentoFor = (code: string, values: string[]) =>
    setCollegamenti((prev) => ({ ...prev, [code]: values }))

  const additionalInfo: AdditionalInfo = useMemo(
    () => ({
      descrizioneAttivita: descrizioneAttivita.trim(),
      dataEmissione,
      // Alla prima emissione il motivo non viene chiesto: quel che fosse rimasto in un
      // salvataggio precedente non deve rientrare dalla finestra.
      motivoRevisione: eRevisione ? motivoRevisione.trim() : '',
      compressoriGiri: giri,
      spessimetrica,
      collegamentiCompressoriSerbatoi: collegamenti,
    }),
    [descrizioneAttivita, dataEmissione, motivoRevisione, eRevisione, giri, spessimetrica, collegamenti]
  )

  /**
   * Preflight ricalcolato a ogni modifica: il redattore vede sparire le segnalazioni
   * mentre compila, invece di scoprirle solo al momento di generare.
   */
  const segnalazioni = useMemo(() => {
    if (!customer) {
      return [
        {
          livello: 'errore' as const,
          codice: 'cliente-assente',
          messaggio: 'Anagrafica cliente non caricata: impossibile generare la relazione.',
        },
      ]
    }
    return validateRelazione(
      buildRelazioneModel({
        scheda,
        additionalInfo,
        customer,
        pratica,
        schemaImpianto: schema ?? undefined,
      })
    )
  }, [customer, scheda, additionalInfo, pratica, schema])

  const bloccante = haErrori(segnalazioni)

  const handleGenera = async () => {
    // Si persiste il solo oggetto ripulito: altrimenti una voce obsoleta sopravvivrebbe a ogni
    // generazione successiva.
    const { info: candidate } = pruneAdditionalInfo(additionalInfo, schedaCodes)

    const parsed = additionalInfoSchema.safeParse(candidate)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Dati non validi')
      return
    }
    if (!customer) {
      toast.error('Anagrafica cliente mancante: impossibile generare la relazione.')
      return
    }

    setSaving(true)
    try {
      await technicalDataApi.updateAdditionalInfo(requestId, parsed.data)
      // Il documento è ciò che il tecnico sta aspettando: la scrittura a catalogo dei giri fa
      // una manciata di query per compressore e non deve tenere fermo lo scaricamento, che non ha
      // un timeout lato client. Va quindi dopo, non prima.
      await generateAndDownloadRelazione({
        scheda,
        additionalInfo: parsed.data,
        customer,
        pratica,
        schemaImpianto: schema ?? undefined,
        fileName,
      })
      await riportaDescrizioneInAnagrafica(parsed.data.descrizioneAttivita)
      const { nonACatalogo, ambigui } = await riportaGiriACatalogo(parsed.data.compressoriGiri)
      mostraEsitoGenerazione(nonACatalogo, ambigui)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nella generazione della relazione')
    } finally {
      setSaving(false)
    }
  }

  /**
   * Riporta la descrizione dell'attività in anagrafica cliente, che ne è la sede propria: il
   * campo è dell'azienda, non della singola pratica. Chi lo compila qui la prima volta —
   * tipicamente perché l'anagrafica era ancora vuota — non se lo ritrova più da compilare, né
   * qui né nelle pratiche successive dello stesso cliente.
   *
   * Non è bloccante: l'aggiornamento dell'anagrafica è riservato ad admin e userdm329, e un
   * tecnico deve poter generare la relazione lo stesso.
   */
  const riportaDescrizioneInAnagrafica = async (valore: string) => {
    if (!customer?.id || !valore) return
    if (valore === (customer.descrizione_attivita ?? '').trim()) return
    try {
      await customersApi.update(customer.id, { descrizione_attivita: valore })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    } catch (err) {
      console.warn('[descrizioneAttivita] non riportata in anagrafica cliente', err)
    }
  }

  /** Esito di `riportaGiriACatalogo`: i codici per cui la scrittura non è avvenuta, distinti per motivo. */
  interface EsitoRiportoGiri {
    /** Il modello non ha righe a catalogo: mai censito, oppure marca/modello scritti con una
     *  grafia diversa da quella di catalogo (`findVariants` confronta per uguaglianza esatta). */
    nonACatalogo: string[]
    /** Il modello è a catalogo in più varianti e né la pressione né la capacità della riga
     *  bastano a scegliere quella giusta. */
    ambigui: string[]
  }

  /**
   * Riporta a catalogo la regolazione dei giri appena dichiarata, così la domanda non torna alla
   * pratica successiva sullo stesso modello.
   *
   * La sola pressione non individua più una riga sola: due varianti dello stesso modello possono
   * dichiararne una uguale (KAESER SK 19, ASD 37 SFC, ASD 60 T SFC — a produzione). Si carica
   * quindi il catalogo del modello e si sceglie la variante con lo stesso criterio con cui la
   * scheda distingue le proprie righe — `scegliVarianteSalvata`, pressione poi capacità.
   *
   * Quando la scelta è univoca si scrive per `catalogItemId`. Quando `scegliVarianteSalvata`
   * restituisce `null` non si chiama affatto `updateEquipmentSpecs`: il ripiego per pressione di
   * quella funzione userebbe `c.pressione_max`, che qui può benissimo essere `undefined` — e con
   * `variante` indefinita quella funzione ripiegherebbe sulla prima riga del modello e scriverebbe
   * lì, senza restituire alcun avviso. `null` copre due situazioni diverse, da non confondere
   * nell'avviso finale: nessuna riga trovata (modello non a catalogo) oppure più righe che restano
   * indistinguibili anche dopo il filtro per capacità (variante ambigua).
   *
   * Non è bloccante: se il ruolo non ha il permesso di scrittura o la ricerca delle varianti
   * fallisce, la relazione si genera comunque con il dato preso da `additional_info` — l'unico
   * effetto è che la domanda tornerà alla pratica successiva.
   */
  const riportaGiriACatalogo = async (
    giriDaSalvare: Record<string, TipoGiri> | undefined
  ): Promise<EsitoRiportoGiri> => {
    const nonACatalogo: string[] = []
    const ambigui: string[] = []
    for (const c of compressoriSenzaGiri) {
      const valore = giriDaSalvare?.[c.codice]
      if (!valore || !c.marca || !c.modello) continue
      try {
        const candidate = await equipmentCatalogApi.findVariants('Compressori', c.marca, c.modello)
        if (candidate.length === 0) {
          nonACatalogo.push(c.codice)
          continue
        }
        const scelta = scegliVarianteSalvata('Compressori', candidate, {
          pressione: c.pressione_max ?? null,
          capacita: c.volume_aria_prodotto ?? null,
        })
        if (!scelta) {
          ambigui.push(c.codice)
          continue
        }
        const esito = await equipmentCatalogApi.updateEquipmentSpecs(
          'Compressori', c.marca, c.modello, { giri: valore }, { catalogItemId: scelta.id }
        )
        // Qui catalogItemId è sempre valorizzato, quindi updateEquipmentSpecs non imbocca mai il
        // ramo che restituisce 'variante_ambigua' — quello scatta solo per il ripiego a pressione,
        // che si usa solo in assenza di id. Il controllo resta come difesa nel caso in cui in
        // futuro questa chiamata smettesse di passare l'id. L'esito davvero raggiungibile da qui è
        // 'riga_non_trovata': la riga sparita fra la lettura di findVariants e questa scrittura.
        if (esito === 'variante_ambigua') ambigui.push(c.codice)
        else if (esito === 'riga_non_trovata') nonACatalogo.push(c.codice)
      } catch (err) {
        console.warn(`[giri] ${c.codice}: non riportato a catalogo`, err)
      }
    }
    return { nonACatalogo, ambigui }
  }

  /**
   * Un solo avviso per l'esito della generazione, invece di un toast verde di successo e uno
   * giallo di mancato aggiornamento in contemporanea — che si leggono male perché dicono cose di
   * segno opposto nello stesso istante. La relazione è comunque generata e scaricata in entrambi
   * i casi: cambia solo se c'è anche qualcosa da segnalare sul catalogo.
   */
  const mostraEsitoGenerazione = (nonACatalogo: string[], ambigui: string[]) => {
    const motivi: string[] = []
    if (nonACatalogo.length > 0) {
      // findVariants confronta marca/modello per uguaglianza esatta: "non risulta a catalogo"
      // può voler dire "non è mai stato censito", ma anche "è censito con una grafia diversa" —
      // uno spazio in più, una sigla staccata. Chi conosce il modello ha bisogno di questo indizio,
      // altrimenti non sa cosa controllare.
      const clausola = nonACatalogo.length > 1
        ? 'i modelli non risultano a catalogo — verifica marca e modello, o censiscili dal modulo di gestione apparecchiature'
        : 'il modello non risulta a catalogo — verifica marca e modello, o censiscilo dal modulo di gestione apparecchiature'
      motivi.push(`${nonACatalogo.join(', ')}: ${clausola}`)
    }
    if (ambigui.length > 0) {
      const clausola = ambigui.length > 1
        ? 'i modelli hanno più varianti a quella pressione, vanno sistemati dal modulo di gestione apparecchiature'
        : 'il modello ha più varianti a quella pressione, va sistemato dal modulo di gestione apparecchiature'
      motivi.push(`${ambigui.join(', ')}: ${clausola}`)
    }

    if (motivi.length === 0) {
      toast.success('Relazione generata e scaricata.')
      return
    }

    toast(
      `Relazione generata e scaricata. Regolazione giri non registrata a catalogo per ${motivi.join('; ')}.`,
      { icon: '⚠️', duration: 8000 }
    )
  }

  const renderMultiValue = (selected: string[]) => selected.join(', ')

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Dati per la relazione tecnica</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {droppedRefs.length > 0 && (
            <Alert severity="warning">
              Alcuni riferimenti salvati non corrispondono più ad apparecchiature presenti nella
              scheda e sono stati rimossi: {droppedRefs.join('; ')}. Ricontrolla i dati qui sotto
              prima di generare la relazione.
            </Alert>
          )}
          <TextField
            label="Data di emissione"
            type="date"
            value={dataEmissione}
            onChange={(e) => setDataEmissione(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ maxWidth: 240 }}
            helperText="Finisce nella colonna DATA della tabella delle revisioni, in copertina."
          />

          {eRevisione && (
            <TextField
              label="Motivo della revisione"
              value={motivoRevisione}
              onChange={(e) => setMotivoRevisione(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              helperText={
                'Compare in §1: «L’attuale revisione del documento è conseguente a: …». ' +
                'Lasciandolo vuoto, il capoverso non viene stampato.'
              }
            />
          )}

          <TextField
            label="Descrizione attività (ATECO)"
            value={descrizioneAttivita}
            onChange={(e) => setDescrizioneAttivita(e.target.value)}
            fullWidth
            required
            multiline
            minRows={2}
            helperText={
              customer?.descrizione_attivita?.trim()
                ? "Preso dall'anagrafica cliente e inserito così com'è nella premessa. Se lo modifichi, l'anagrafica viene aggiornata."
                : "L'anagrafica del cliente non riporta l'attività: quanto scrivi qui finisce nella premessa e viene salvato in anagrafica."
            }
          />

          {compressoriSenzaGiri.length > 0 && (
            <>
              <Divider />
              <Typography variant="subtitle2">Giri dei compressori</Typography>
              <Typography variant="body2" color="text.secondary">
                Il catalogo non riporta la regolazione dei giri per questi modelli. La risposta
                viene salvata anche a catalogo, così non verrà più richiesta.
              </Typography>
              {compressoriSenzaGiri.map((c) => (
                <FormControl key={c.codice} fullWidth size="small">
                  <InputLabel id={`giri-${c.codice}`}>
                    {`${c.codice} · ${[c.marca, c.modello].filter(Boolean).join(' ') || 'modello non indicato'}`}
                  </InputLabel>
                  <Select
                    labelId={`giri-${c.codice}`}
                    label={`${c.codice} · ${[c.marca, c.modello].filter(Boolean).join(' ') || 'modello non indicato'}`}
                    value={giri[c.codice] ?? ''}
                    onChange={(e: SelectChangeEvent) => setGiroFor(c.codice, e.target.value as TipoGiri)}
                  >
                    {TIPO_GIRI_OPTIONS.map((o) => (
                      <MenuItem key={o} value={o}>{TIPO_GIRI_LABELS[o]}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ))}
            </>
          )}

          <Divider />
          <Typography variant="subtitle2">
            Collegamenti compressori → serbatoi
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Serve al calcolo della portata delle valvole dei serbatoi.
          </Typography>
          {compressoriCodes.map((code) => (
            <FormControl key={code} fullWidth size="small">
              <InputLabel id={`coll-${code}`}>{`${code} collegato a`}</InputLabel>
              <Select
                labelId={`coll-${code}`}
                multiple
                value={collegamenti[code] ?? []}
                onChange={(e: SelectChangeEvent<string[]>) =>
                  setCollegamentoFor(
                    code,
                    typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                  )
                }
                input={<OutlinedInput label={`${code} collegato a`} />}
                renderValue={renderMultiValue}
              >
                {serbatoiCodes.map((s) => (
                  <MenuItem key={s} value={s}>
                    <Checkbox checked={(collegamenti[code] ?? []).includes(s)} />
                    <ListItemText primary={s} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}

          <Divider />
          <Typography variant="subtitle2">
            Apparecchiature con verifica spessimetrica
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel id="spess">Apparecchiature</InputLabel>
            <Select
              labelId="spess"
              multiple
              value={spessimetrica}
              onChange={(e: SelectChangeEvent<string[]>) =>
                setSpessimetrica(
                  typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                )
              }
              input={<OutlinedInput label="Apparecchiature" />}
              renderValue={renderMultiValue}
            >
              {spessimetricaOptions.map((code) => (
                <MenuItem key={code} value={code}>
                  <Checkbox checked={spessimetrica.includes(code)} />
                  <ListItemText primary={code} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Divider />
          <SchemaImpiantoSection
            scheda={scheda}
            collegamentiCompressoriSerbatoi={collegamenti}
            schema={schema}
            onSchemaChange={setSchema}
            disabled={saving}
          />

          <Divider />
          <Typography variant="subtitle2">Controllo di completezza</Typography>
          {segnalazioni.length === 0 ? (
            <Alert severity="success">Nessun dato mancante: la relazione è completa.</Alert>
          ) : (
            <Stack spacing={1}>
              {segnalazioni.map((s) => (
                <Alert key={s.codice} severity={s.livello === 'errore' ? 'error' : 'warning'}>
                  {s.messaggio}
                  {s.posizioni?.length ? (
                    <Typography component="div" variant="body2" sx={{ mt: 0.5, fontWeight: 600 }}>
                      {s.posizioni.join(' · ')}
                    </Typography>
                  ) : null}
                </Alert>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Annulla
        </Button>
        <Box sx={{ position: 'relative' }}>
          {/* Le segnalazioni informano, non sbarrano: il redattore può avere ragioni per
              generare comunque, ma l'etichetta gli ricorda che qualcosa manca. */}
          <Button
            variant="contained"
            color={bloccante ? 'warning' : 'primary'}
            onClick={handleGenera}
            disabled={saving || !customer}
          >
            {bloccante ? 'Genera comunque .docx' : 'Genera e scarica .docx'}
          </Button>
          {saving && (
            <CircularProgress
              size={24}
              sx={{ position: 'absolute', top: '50%', left: '50%', mt: '-12px', ml: '-12px' }}
            />
          )}
        </Box>
      </DialogActions>
    </Dialog>
  )
}
