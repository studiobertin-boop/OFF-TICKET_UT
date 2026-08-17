/**
 * Step "Dati relazione": raccoglie i dati aggiuntivi (additional_info) non presenti
 * nella scheda, li salva e genera/scarica la relazione .docx.
 *
 * ⚠️ Da verificare nell'app in esecuzione (UI non coperta dai test unitari).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { GruppoCampi } from '@/components/common'
import toast from 'react-hot-toast'
import type { SelectChangeEvent } from '@mui/material'
import type { Customer } from '@/types'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import { TIPO_GIRI_LABELS, TIPO_GIRI_OPTIONS } from '@/types/technicalSheet'
import { technicalDataApi } from '@/services/api/technicalData'
import { additionalInfoSchema } from '@/services/relazione/schema'
import { generateAndDownloadRelazione } from '@/services/relazione/generateRelazione'
import { relazioneDocumentiApi } from '@/services/api/relazioneDocumenti'
import { buildRelazioneModel } from '@/services/relazione/buildRelazioneModel'
import { validateRelazione, haErrori } from '@/services/relazione/preflight'
import type { AdditionalInfo, PraticaInfo, SchemaImpianto, TipoGiri } from '@/services/relazione/types'
import type { Tarature } from '@/services/schemaImpianto/libreria'
import type { LayoutSalvato } from '@/services/schemaImpianto/persistenza'
import { layoutDaPersistere } from '@/services/schemaImpianto/persistenza'
import type { SchemaLayout } from '@/services/schemaImpianto/types'
import { SchemaImpiantoSection } from './SchemaImpiantoSection'
import { collectCodes, pruneAdditionalInfo } from '@/utils/equipmentCodes'
import { oggiISO } from '@/services/relazione/helpers'

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
  /**
   * Chiamata appena `additional_info` è scritto: il genitore tiene una copia in stato e senza
   * questo avviso riaprirebbe il dialog sui dati di prima del salvataggio.
   */
  onAdditionalInfoSaved?: (info: AdditionalInfo) => void
}

/**
 * Larghezza delle select che raccolgono una sigla o due — collegamenti e giri.
 *
 * Erano larghe quanto la finestra: novecento pixel per contenere «S1, S2», una per riga.
 * Con una misura propria stanno in fila e vanno a capo solo quando la finestra si stringe
 * davvero, ed è lì che la finestra smette di dover essere scorsa per intero.
 */
const LARGHEZZA_SELECT = 232

/**
 * Etichetta che si tronca invece di sfondare il campo.
 *
 * «C1 · KAESER SK 19» ci sta, «C1 · ATLAS COPCO GA 30 VSD+ FF» no: MUI non accorcia da sé
 * l'etichetta di un campo contornato, e quella in eccesso uscirebbe dal bordo.
 */
const ETICHETTA_TRONCATA = {
  '& .MuiInputLabel-root': {
    maxWidth: 'calc(100% - 28px)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
} as const

export default function RelazioneDataDialog({
  open,
  onClose,
  requestId,
  scheda,
  customer,
  pratica,
  initialAdditionalInfo,
  fileName,
  onAdditionalInfoSaved,
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

  /**
   * Il documento è una revisione quando il progressivo del codice pratica è oltre lo zero.
   * Alla prima emissione il motivo non si chiede: il capoverso di §1 non esiste.
   */
  const eRevisione = (pratica.progressivo ?? 0) > 0

  const [descrizioneAttivita, setDescrizioneAttivita] = useState('')
  const [dataEmissione, setDataEmissione] = useState('')
  const [giri, setGiri] = useState<Record<string, TipoGiri>>({})
  const [spessimetrica, setSpessimetrica] = useState<string[]>([])
  const [collegamenti, setCollegamenti] = useState<Record<string, string[]>>({})
  const [schema, setSchema] = useState<SchemaImpianto | null>(null)
  // Layout salvato letto all'apertura, passato a SchemaImpiantoSection perché lo riconcili con
  // la scheda. A tre stati (vedi SchemaImpiantoSectionProps.layoutSalvato): `undefined` finché
  // questo effetto non ha ancora sincronizzato, `null` se ha letto e non c'era nulla di salvato.
  // Layout corrente aggiornato a ogni `disegna`: è quello che finisce in additional_info al
  // salvataggio, non quello letto all'apertura.
  const [layoutSalvato, setLayoutSalvato] = useState<LayoutSalvato | null | undefined>(undefined)
  const [layout, setLayout] = useState<SchemaLayout | null>(null)
  // La taratura di PRATICA (Task 12, il modo taratura sulla tela): seminata da
  // `layoutSalvato.simboli` alla stessa sincronizzazione qui sotto, poi tenuta aggiornata da
  // `SchemaImpiantoSection` mentre l'editor chiude il modo con «usa solo questa volta» o «rendi
  // permanenti» (che la toglie di qui dopo averla scritta in tabella, vedi SchemaEditor.tsx). È
  // il filo che il Task 10 aveva lasciato aperto apposta: senza, `layoutDaPersistere` qui sotto
  // continuerebbe a scrivere sempre `simboli: undefined`, e «usa solo questa volta» non
  // sopravviverebbe al salvataggio.
  const [taraturaPratica, setTaraturaPratica] = useState<Tarature>({})
  // Vero non appena `SchemaImpiantoSection` ha ricalcolato il layout almeno una volta in
  // questa apertura del dialog (successo o scelta deliberata di azzerarlo — non importa
  // quale): distingue «nessun layout» da «layout non ancora ricalcolato» in
  // `layoutDaPersistere` qui sotto. Vedi quella funzione per il perché.
  const [layoutRicalcolato, setLayoutRicalcolato] = useState(false)
  const [saving, setSaving] = useState(false)
  const [droppedRefs, setDroppedRefs] = useState<string[]>([])

  // Segna se l'apertura corrente del dialog è già stata sincronizzata. Senza questa guardia
  // l'effetto sotto ripartirebbe ogni volta che `initialAdditionalInfo` cambia identità mentre
  // il dialog resta aperto — succede dopo il salvataggio, via `onAdditionalInfoSaved` — e
  // azzererebbe i campi sotto le mani dell'utente nel bel mezzo della generazione.
  const sincronizzatoRef = useRef(false)

  // Sincronizza lo stato al passaggio chiuso → aperto del dialog, non a ogni cambiamento dei
  // valori che legge: la guardia sopra decide quando l'effetto agisce davvero, le dipendenze
  // restano quelle che l'effetto legge.
  useEffect(() => {
    if (!open) {
      sincronizzatoRef.current = false
      // Il dialog resta montato fra un'apertura e l'altra (lo monta TechnicalDetails, non il
      // Dialog MUI): senza riportarlo a `undefined`, alla riapertura SchemaImpiantoSection lo
      // troverebbe ancora valorizzato col layout della sessione precedente, per lo spazio fra
      // il remount e il momento in cui questo stesso effetto lo sincronizza di nuovo.
      setLayoutSalvato(undefined)
      // Stessa cautela di `layoutSalvato` qui sopra: senza azzerarla, la taratura di pratica
      // della sessione precedente resterebbe visibile fra il remount e la prossima
      // sincronizzazione.
      setTaraturaPratica({})
      return
    }
    if (sincronizzatoRef.current) return
    sincronizzatoRef.current = true
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
    setGiri(info.compressoriGiri ?? {})
    setSpessimetrica(info.spessimetrica ?? [])
    setCollegamenti(info.collegamentiCompressoriSerbatoi ?? {})
    setDroppedRefs(dropped)
    // Il PNG non è persistito: si rigenera sempre da capo. Il layout invece sopravvive in
    // additional_info; SchemaImpiantoSection lo riconcilia con la scheda appena rigenera.
    // `null` (non `undefined`) segnala alla sezione che la lettura è avvenuta e non c'è nulla
    // da riconciliare: `undefined` in quella prop significa "non ancora letto".
    setSchema(null)
    setLayout(null)
    setLayoutRicalcolato(false)
    setLayoutSalvato(info.schemaLayout ?? null)
    // La taratura di pratica salvata in una sessione precedente: `SchemaImpiantoSection` la
    // legge già da `layoutSalvato.simboli` per riconciliare le posizioni (Task 10), ma questo
    // stato è il canale SEPARATO da cui la ri-scrive al prossimo salvataggio — vedi il commento
    // sulla sua dichiarazione.
    setTaraturaPratica(info.schemaLayout?.simboli ?? {})
  }, [open, initialAdditionalInfo, customer, schedaCodes])

  const setGiroFor = (code: string, value: TipoGiri) =>
    setGiri((prev) => ({ ...prev, [code]: value }))

  const setCollegamentoFor = (code: string, values: string[]) =>
    setCollegamenti((prev) => ({ ...prev, [code]: values }))

  const additionalInfo: AdditionalInfo = useMemo(
    () => ({
      descrizioneAttivita: descrizioneAttivita.trim(),
      dataEmissione,
      compressoriGiri: giri,
      spessimetrica,
      collegamentiCompressoriSerbatoi: collegamenti,
      schemaLayout: layoutDaPersistere(layout, layoutRicalcolato, layoutSalvato, taraturaPratica),
    }),
    [
      descrizioneAttivita,
      dataEmissione,
      giri,
      spessimetrica,
      collegamenti,
      layout,
      layoutRicalcolato,
      layoutSalvato,
      taraturaPratica,
    ]
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
  const bloccanti = segnalazioni.filter((s) => s.livello === 'errore').length

  /**
   * Genera e scarica, e basta. Fino al 17-08-2026 la generazione riscriveva anche due dati
   * CONDIVISI fra tutte le pratiche — la regolazione dei giri in `equipment_catalog` e la
   * descrizione attività nell'anagrafica del cliente — senza dirlo e senza chiedere: un valore
   * sbagliato digitato qui veniva ereditato da ogni pratica futura sullo stesso modello, ed è così
   * che «prova attività ATECOOO» è finita nell'anagrafica di un cliente vero. Catalogo e anagrafica
   * si aggiornano ora solo dove li si modifica esplicitamente.
   *
   * Il prezzo, accettato dal committente: la domanda sui giri torna a ogni pratica sullo stesso
   * modello.
   */
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
      // Subito dopo la scrittura riuscita, non alla chiusura: se il download del .docx fallisce
      // più sotto, la riga in banca dati è comunque cambiata e la copia in memoria del genitore
      // deve saperlo, altrimenti la prossima apertura del dialog rilegge dati vecchi.
      onAdditionalInfoSaved?.(parsed.data)
      const blob = await generateAndDownloadRelazione({
        scheda,
        additionalInfo: parsed.data,
        customer,
        pratica,
        schemaImpianto: schema ?? undefined,
        fileName,
      })
      // Non bloccante: la relazione è già stata scaricata con successo, un errore di salvataggio
      // non deve far sembrare fallita l'intera generazione.
      try {
        await relazioneDocumentiApi.salvaFinale(
          requestId,
          new File([blob], fileName ?? 'Relazione_DM329.docx', { type: blob.type })
        )
      } catch (err) {
        console.warn('[relazione] non salvata nell\'app, resta solo scaricata', err)
      }
      toast.success('Relazione generata e scaricata.')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nella generazione della relazione')
    } finally {
      setSaving(false)
    }
  }

  const renderMultiValue = (selected: string[]) => selected.join(', ')

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Dati per la relazione tecnica</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {droppedRefs.length > 0 && (
            <Alert severity="warning">
              Alcuni riferimenti salvati non corrispondono più ad apparecchiature presenti nella
              scheda e sono stati rimossi: {droppedRefs.join('; ')}. Ricontrolla i dati qui sotto
              prima di generare la relazione.
            </Alert>
          )}

          <GruppoCampi
            titolo="Intestazione del documento"
            spiegazione={
              'La data finisce nella colonna DATA della tabella delle revisioni, in copertina, ed è ' +
              'condivisa con il campo data del form Dichiarazioni. Il motivo compare in §1: ' +
              '«L’attuale revisione del documento è conseguente a: …»; vuoto, il capoverso non ' +
              'viene stampato. Si scrive nella pagina di modifica del codice pratica, non qui.'
            }
          >
            {/* Data e motivo su una riga: la data è larga quanto una data, e accanto resta
                posto per una frase. Il motivo è di sola lettura — si scrive nella pagina di
                modifica del codice pratica, dove la relazione lo va a leggere — e compare solo
                dalla prima revisione in poi; quando manca la data resta da sola senza un buco. */}
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <TextField
                label="Data di emissione"
                type="date"
                size="small"
                value={dataEmissione}
                onChange={(e) => setDataEmissione(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 180, flex: 'none' }}
              />

              {eRevisione && (
                <TextField
                  label="Motivo della revisione"
                  size="small"
                  value={pratica.motivoRevisione?.trim() || '(non compilato nel codice pratica)'}
                  InputProps={{ readOnly: true }}
                  multiline
                  sx={{ flex: '1 1 320px', minWidth: 0 }}
                />
              )}
            </Stack>

            {/* Questo aiuto resta in vista: non spiega una procedura, avverte che quel che
                si scrive qui esce dalla pratica e riscrive l'anagrafica del cliente. */}
            <TextField
              label="Descrizione attività (ATECO)"
              size="small"
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
          </GruppoCampi>

          {compressoriSenzaGiri.length > 0 && (
            <GruppoCampi
              titolo="Giri dei compressori"
              spiegazione={
                'Il catalogo non riporta la regolazione dei giri per questi modelli. La risposta ' +
                'viene salvata anche a catalogo, così non verrà più richiesta.'
              }
            >
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
                {compressoriSenzaGiri.map((c) => {
                  const etichetta = `${c.codice} · ${[c.marca, c.modello].filter(Boolean).join(' ') || 'modello non indicato'}`
                  return (
                    <FormControl key={c.codice} size="small" sx={{ width: LARGHEZZA_SELECT, ...ETICHETTA_TRONCATA }}>
                      <InputLabel id={`giri-${c.codice}`}>{etichetta}</InputLabel>
                      <Select
                        labelId={`giri-${c.codice}`}
                        label={etichetta}
                        value={giri[c.codice] ?? ''}
                        onChange={(e: SelectChangeEvent) => setGiroFor(c.codice, e.target.value as TipoGiri)}
                      >
                        {TIPO_GIRI_OPTIONS.map((o) => (
                          <MenuItem key={o} value={o}>{TIPO_GIRI_LABELS[o]}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )
                })}
              </Box>
            </GruppoCampi>
          )}

          <GruppoCampi
            titolo="Collegamenti compressori → serbatoi"
            spiegazione="Serve al calcolo della portata delle valvole dei serbatoi."
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
              {compressoriCodes.map((code) => (
                <FormControl key={code} size="small" sx={{ width: LARGHEZZA_SELECT, ...ETICHETTA_TRONCATA }}>
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
            </Box>
          </GruppoCampi>

          <GruppoCampi titolo="Apparecchiature con verifica spessimetrica">
            <FormControl size="small" sx={{ width: { xs: '100%', sm: 360 } }}>
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
          </GruppoCampi>

          <Divider />
          <SchemaImpiantoSection
            scheda={scheda}
            collegamentiCompressoriSerbatoi={collegamenti}
            schema={schema}
            onSchemaChange={setSchema}
            layoutSalvato={layoutSalvato}
            onLayoutChange={(nuovo) => {
              setLayout(nuovo)
              setLayoutRicalcolato(true)
            }}
            taraturaPratica={taraturaPratica}
            onTaraturaPraticaChange={setTaraturaPratica}
            disabled={saving}
          />

          <Divider />
          <Typography variant="subtitle2">Controllo di completezza</Typography>
          {segnalazioni.length === 0 ? (
            <Alert severity="success" sx={{ py: 0.25 }}>Nessun dato mancante: la relazione è completa.</Alert>
          ) : (
            <Stack spacing={0.75}>
              {/* Una riga per segnalazione, con le posizioni in fondo a destra invece che
                  sotto: su una scheda con più mancanze erano il grosso di quel che si
                  scorreva, e la posizione si legge meglio incolonnata che a capo. */}
              {segnalazioni.map((s) => (
                <Alert
                  key={s.codice}
                  severity={s.livello === 'errore' ? 'error' : 'warning'}
                  sx={{
                    py: 0.25,
                    '& .MuiAlert-message': {
                      display: 'flex', alignItems: 'baseline', gap: 2, width: '100%', flexWrap: 'wrap',
                    },
                  }}
                >
                  <Box component="span" sx={{ minWidth: 0 }}>{s.messaggio}</Box>
                  {s.posizioni?.length ? (
                    <Box
                      component="span"
                      sx={{ ml: 'auto', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.78rem' }}
                    >
                      {s.posizioni.join(' · ')}
                    </Box>
                  ) : null}
                </Alert>
              ))}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {/* Il conteggio sta accanto al pulsante che deve decidere: è lì che serve sapere
            quanto manca, non in cima a una lista che si è appena finito di scorrere. */}
        {segnalazioni.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto', pl: 1 }}>
            {segnalazioni.length === 1 ? '1 segnalazione' : `${segnalazioni.length} segnalazioni`}
            {bloccanti === 0
              ? ', nessuna bloccante'
              : bloccanti === 1
                ? ', 1 bloccante'
                : `, ${bloccanti} bloccanti`}
          </Typography>
        )}
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
