import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material'
import { Layout } from '@/components/common/Layout'
import { TechnicalSheetHeader } from '@/components/technicalSheet/TechnicalSheetHeader'
import { codiceForRequest, nomeFileDichiarazioni, nomeFileRelazione } from '@/utils/practiceCode'
import { useRequest, useClientDm329Overview } from '@/hooks/useRequests'
import { useAuth } from '@/hooks/useAuth'
import { useCustomers } from '@/hooks/useCustomers'
import { technicalDataApi } from '@/services/api/technicalData'
import { requestsApi } from '@/services/api/requests'
import { customersApi } from '@/services/api/customers'
import { relazioneDocumentiApi } from '@/services/api/relazioneDocumenti'
import { dichiarazioniDocumentiApi } from '@/services/api/dichiarazioniDocumenti'
import { fascicoloDocumentiApi } from '@/services/api/fascicoloDocumenti'
import { calcolaEsitiPerCodice, codiciConAdempimento } from '@/utils/dm329Classification'
import { supabase } from '@/services/supabase'
import { TechnicalSheetForm, type TechnicalSheetFormRef } from '@/components/technicalSheet/TechnicalSheetForm'
import { OCRReviewDialog } from '@/components/technicalSheet/OCRReviewDialog'
import { ShareDialog } from '@/components/technicalSheet/ShareDialog'
import RelazioneDataDialog from '@/components/relazione/RelazioneDataDialog'
import DichiarazioniDialog from '@/components/dichiarazioni/DichiarazioniDialog'
import { risolviSitoProduttivo } from '@/services/dichiarazioni/sitoProduttivo'
import type { AdditionalInfo } from '@/services/relazione/types'
import { EquipmentCatalogProvider } from '@/components/technicalSheet/EquipmentCatalogContext'
import type { DM329TechnicalData, SchedaDatiCompleta, OCRExtractedData, FuzzyMatch, OCRReviewData } from '@/types'
import { isDM329Family } from '@/utils/workflow'
import { normalizeSchedaCodes } from '@/utils/equipmentCodes'
import { puoLeggereStoriaPratica } from '@/utils/storiaPratica'
import { attendi, scaricaDaUrl } from '@/utils/scaricaFile'

/**
 * Pagina SCHEDA DATI - Gestione dati tecnici pratiche DM329
 *
 * PASSO 2: Form completo implementato
 * - 10 sezioni con apparecchiature ripetibili
 * - Validazione campi obbligatori
 * - Salvataggio bozza e completamento scheda
 *
 * PASSI FUTURI:
 * - Passo 3: Integrazione OCR con Claude (Anthropic) Vision
 * - Passo 4: Portale cliente
 */
export const TechnicalDetails = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { data: request, isLoading: requestLoading, error: requestError } = useRequest(id!)

  const [technicalData, setTechnicalData] = useState<DM329TechnicalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState<SchedaDatiCompleta | null>(null)
  const [autoSaving, setAutoSaving] = useState(false)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [ocrReviewData, setOcrReviewData] = useState<OCRReviewData | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [relazioneDialogOpen, setRelazioneDialogOpen] = useState(false)
  const [dichiarazioniDialogOpen, setDichiarazioniDialogOpen] = useState(false)
  const formRef = useRef<TechnicalSheetFormRef>(null)

  // Carica scheda dati tecnici
  useEffect(() => {
    const loadTechnicalData = async () => {
      if (!id) return

      try {
        setLoading(true)
        let data = await technicalDataApi.getByRequestId(id)

        // Se la scheda dati non esiste, creala automaticamente
        // (necessario per richieste DM329 create prima dell'implementazione della funzionalità)
        if (!data) {
          console.log('Technical data not found for request', id, '- creating automatically...')

          try {
            // Crea la scheda dati
            data = await technicalDataApi.create(id)
            console.log('Technical data created successfully:', data.id)

            // Mostra messaggio informativo all'utente
            setError('Scheda dati creata automaticamente. Puoi ora compilare i dati tecnici.')
            setTimeout(() => setError(null), 5000) // Rimuovi messaggio dopo 5 secondi
          } catch (createErr) {
            console.error('Error creating technical data:', createErr)
            throw new Error('Impossibile creare la scheda dati. Verifica i permessi.')
          }
        }

        setTechnicalData(data)

        // Parse equipment_data da JSONB
        if (data && data.equipment_data) {
          const parsedData = data.equipment_data as SchedaDatiCompleta

          // Precompilazione nome_tecnico se vuoto e richiesta assegnata
          if (!parsedData.dati_generali?.nome_tecnico && request?.assigned_user?.full_name) {
            parsedData.dati_generali = {
              ...parsedData.dati_generali,
              nome_tecnico: request.assigned_user.full_name,
            }
          }

          // Completa i codici mancanti: il codice mostrato è quello memorizzato, quindi un record
          // senza codice comparirebbe con la colonna vuota. Idempotente, quindi a regime non fa
          // nulla; la persistenza non è bloccante perché la scheda è già utilizzabile.
          const { scheda: normalized, changed } = normalizeSchedaCodes(parsedData)
          if (changed) {
            try {
              await technicalDataApi.updateEquipmentData(id, normalized)
            } catch (normErr) {
              console.error('[normalizeSchedaCodes] Errore nel salvataggio dei codici:', normErr)
            }

            // Allinea anche lo stato locale: il dialog della relazione legge
            // technicalData.equipment_data, non formData, e senza questo continuerebbe a
            // vedere la scheda non normalizzata fino al ricaricamento della pagina.
            setTechnicalData((prev) => (prev ? { ...prev, equipment_data: normalized } : prev))
          }

          setFormData(normalized)
        }
      } catch (err) {
        console.error('Error loading technical data:', err)
        setError(err instanceof Error ? err.message : 'Errore nel caricamento della scheda dati')
      } finally {
        setLoading(false)
      }
    }

    loadTechnicalData()
  }, [id, request?.assigned_user, request?.custom_fields])

  // Verifica accesso (solo admin, userdm329 e tecnicoDM329)
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'userdm329' && user.role !== 'tecnicoDM329') {
      navigate('/requests')
    }
  }, [user, navigate])

  /**
   * L'elenco pratiche mostra lo stato di compilazione di questa scheda, e lo legge dalla
   * scheda stessa: salvata la scheda, quella lista è vecchia. Si segna da invalidare invece
   * di ricaricarla — mentre si compila non è montata, quindi non parte nessuna richiesta:
   * la si rilegge tornando indietro.
   */
  const segnalaListeDaAggiornare = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['requests'] })
  }, [queryClient])

  /**
   * Il dialog "Genera relazione" e il dialog "Dichiarazioni" leggono e scrivono lo stesso
   * campo (`additional_info.dataEmissione`): senza rileggerlo alla chiusura di uno dei due,
   * l'altro — che smonta e riparte da questo stato ogni volta che si apre — continuerebbe a
   * proporre la data con cui la pagina si era caricata, non quella appena salvata dall'altro
   * form. Solo `additional_info`: `equipment_data` e il resto dello stato del form non
   * c'entrano, e un ricaricamento completo rischierebbe di scavalcare modifiche in corso.
   */
  const riaggiornaAdditionalInfo = useCallback(async () => {
    if (!id) return
    try {
      const data = await technicalDataApi.getByRequestId(id)
      if (data) setTechnicalData((prev) => (prev ? { ...prev, additional_info: data.additional_info } : prev))
    } catch (err) {
      console.warn('[additional_info] rilettura non riuscita', err)
    }
  }, [id])

  // Autosave function (senza alert/snackbar)
  const handleAutoSave = useCallback(async (data: SchedaDatiCompleta) => {
    if (!id) return

    try {
      setAutoSaving(true)
      await technicalDataApi.updateEquipmentData(id, data)
      setFormData(data)
      setLastSaved(new Date())
      segnalaListeDaAggiornare()
    } catch (err) {
      console.error('Error auto-saving:', err)
    } finally {
      setAutoSaving(false)
    }
  }, [id, segnalaListeDaAggiornare])

  // Submit nativo del form (Invio in un campo): stesso salvataggio dell'autosave, con feedback.
  const handleFormSubmit = async (data: SchedaDatiCompleta) => {
    if (!id) return

    try {
      // Salva i dati nel campo equipment_data (JSONB)
      await technicalDataApi.updateEquipmentData(id, data)

      setFormData(data)
      setLastSaved(new Date())
      setShowSaveSuccess(true)
      segnalaListeDaAggiornare()
    } catch (err) {
      console.error('Error saving draft:', err)
      alert('Errore nel salvataggio della bozza')
    }
  }

  // OCR handlers
  const handleOCRConfirm = useCallback((editedData: OCRExtractedData, selectedMatch?: FuzzyMatch) => {
    if (!ocrReviewData?.equipment_code) {
      console.error('❌ Codice apparecchiatura mancante')
      alert('Errore: codice apparecchiatura non trovato')
      return
    }

    // Parse equipment code (es: "S1", "C2.1")
    const equipmentCode = ocrReviewData.equipment_code

    console.log('✅ OCR data confirmed:', { editedData, selectedMatch, equipmentCode })

    // Nota: L'inserimento nel form verrà gestito da TechnicalSheetForm
    // che riceverà questi dati tramite un nuovo prop onOCRDataReady
    // Per ora mostriamo i dati confermati

    // TODO: Implementare callback per passare dati al form
    // onOCRDataReady({ equipmentCode, data: editedData })

    // Close dialog
    setOcrReviewData(null)

    // Show success message
    alert('Dati OCR confermati! Per ora visualizzati in console. Prossimo step: integrazione con form.')
  }, [ocrReviewData])

  const handleOCRCancel = useCallback(() => {
    setOcrReviewData(null)
  }, [])

  // IMPORTANT: Load customer data for legacy CSV imports BEFORE early returns
  // Extract cliente string if it exists
  const clienteString = request?.custom_fields?.cliente && typeof request.custom_fields.cliente === 'string'
    ? request.custom_fields.cliente
    : null
  const shouldFetchByName = !request?.customer && !!clienteString

  // Search for customer by name for CSV imported requests
  const { data: customersSearchResult } = useCustomers(
    clienteString ? { search: clienteString } : undefined,
    { enabled: shouldFetchByName }
  )

  const customerByName = useMemo(() => {
    if (!customersSearchResult?.data || !clienteString) return undefined
    return customersSearchResult.data.find(
      c => c.ragione_sociale.toLowerCase() === clienteString.toLowerCase()
    )
  }, [customersSearchResult, clienteString])

  // Auto-sync customer_id when customerByName is found
  useEffect(() => {
    if (!id || !customerByName || request?.customer_id) return

    const syncCustomerId = async () => {
      try {
        await requestsApi.update(id, {
          customer_id: customerByName.id
        })

        // Force re-fetch request data
        window.location.reload()
      } catch (err) {
        console.error('[TechnicalDetails] Error syncing customer_id:', err)
      }
    }

    syncCustomerId()
  }, [id, customerByName, request?.customer_id])

  // Sale distinte del cliente: la lettera compare nel codice pratica solo se ne ha
  // più d'una. Prima delle uscite anticipate, come tutti gli altri hook.
  const { data: clientDm329Overview = [] } = useClientDm329Overview(request?.customer_id)
  const clientSalaCount = useMemo(
    () => new Set(clientDm329Overview.map((p) => p.sala_lettera)).size,
    [clientDm329Overview]
  )

  // Ultimo cambio di stato della pratica: insieme a `request.status/updated_at/created_at`
  // dice alla sezione fascicolo quando i documenti verranno cancellati. Anche questa prima
  // delle uscite anticipate.
  //
  // Non tutti i ruoli hanno una policy di SELECT su `request_history`, e una lettura negata non
  // produce un errore: `authenticated` ha comunque il GRANT di tabella, quindi Postgres applica
  // l'RLS filtrando le righe in silenzio e la query torna `data: null, error: null`,
  // indistinguibile da «la pratica non ha righe di storia». Controllare solo `error` non basta:
  // propagarlo protegge da guasti genuini (rete, permessi cambiati), ma per un ruolo senza policy
  // il risultato vuoto è sempre e comunque inaffidabile, non solo a volte. Per questo la query
  // resta disabilitata a monte, prima ancora di interrogare, invece di fidarsi di un `null` che
  // potrebbe nascondere una storia che esiste ma che quell'utente non può leggere:
  // `dataCancellazione` scivolerebbe su `creataIl` e mostrerebbe una data falsa, su una pratica
  // chiusa da tempo sparita mesi fa invece che fra 30 giorni dalla chiusura.
  //
  // Quali siano quei ruoli lo dice `puoLeggereStoriaPratica`, che tiene l'elenco degli ammessi
  // accanto ai nomi delle policy che lo giustificano: un ruolo nuovo senza policy cade fuori da
  // solo, e qui la data sparisce invece di essere sbagliata.
  //
  // `isSuccess` distingue quindi tre casi, non due: query disabilitata (ruolo senza policy,
  // sempre inaffidabile) e query fallita (rete, RLS cambiata) restano entrambe `false` —
  // `movimenti` sotto resta `undefined` e la sezione fascicolo non mostra alcuna data; query
  // riuscita con nessuna riga (`maybeSingle` su una pratica senza storia) resta `true` con
  // `ultimoCambioStato: null`, e il ripiego su `creataIl` in `scadenza.ts` è quello giusto.
  const { data: ultimoCambioStato, isSuccess: storiaLetta } = useQuery({
    queryKey: ['ultimo-cambio-stato', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('request_history')
        .select('created_at')
        .eq('request_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data?.created_at ?? null
    },
    enabled: Boolean(id) && puoLeggereStoriaPratica(user?.role),
  })

  /**
   * Dati CIVA e relazione: questione di ruolo, non di stato della scheda.
   *
   * Erano legati a `is_completed`, che si accendeva solo dal pulsante «Completa scheda» in
   * testata. Tolto quello, restare agganciati a quel flag li avrebbe resi irraggiungibili —
   * la pagina CIVA non ha altri punti d'ingresso in tutta l'app. Del resto la relazione si
   * genera anche su una scheda ancora in lavorazione: è il suo preflight a dire cosa manca,
   * e lo dice meglio di un flag binario acceso a mano.
   *
   * Calcolato qui — prima dei return anticipati — perché serve alle due query sotto: dipende
   * solo da `user`, già disponibile da `useAuth()`, quindi anticiparlo non introduce nessuna
   * dipendenza sui dati della richiesta che gli early return sotto potrebbero non avere ancora.
   */
  const canGenerateDocs = user?.role === 'admin' || user?.role === 'userdm329'

  // Relazione e dichiarazioni già salvate per questa pratica: se esistono, l'azione in testata
  // diventa verde e scarica invece di riaprire il dialog di generazione. Anche queste prima dei
  // return anticipati, per lo stesso motivo della query sopra.
  const { data: relazioneSalvata } = useQuery({
    queryKey: ['relazione-documento', id],
    queryFn: () => relazioneDocumentiApi.ultimoFinale(id!),
    enabled: !!id && canGenerateDocs,
  })
  const { data: dichiarazioniSalvate } = useQuery({
    queryKey: ['dichiarazioni-finale', id],
    queryFn: () => dichiarazioniDocumentiApi.ultimoFinale(id!),
    enabled: !!id && canGenerateDocs,
  })

  // I documenti già salvati si scaricano da un link firmato e non da un blob in memoria:
  // `utils/scaricaFile` spiega perché — sui .docx il blob resta fermo al controllo di
  // sicurezza del browser e il file non arriva mai.
  const handleScaricaRelazione = async () => {
    if (!relazioneSalvata) return
    try {
      const url = await relazioneDocumentiApi.urlFirmato(relazioneSalvata.filePath, relazioneSalvata.nome)
      scaricaDaUrl(url, relazioneSalvata.nome)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scaricamento non riuscito')
    }
  }
  const handleScaricaDichiarazioni = async () => {
    if (!dichiarazioniSalvate) return
    try {
      const url = await dichiarazioniDocumentiApi.urlFirmato(dichiarazioniSalvate.filePath, dichiarazioniSalvate.nome)
      scaricaDaUrl(url, dichiarazioniSalvate.nome)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scaricamento non riuscito')
    }
  }

  // Relazione + dichiarazioni + un fascicolo per ogni apparecchiatura con adempimento, in
  // un solo clic. I codici si calcolano sull'istantanea più fresca della scheda — presa da
  // `formRef` al momento del clic, non da uno stato osservato prima — perché nel frattempo
  // l'utente può aver aggiunto o tolto apparecchiature rispetto a quando la pagina si è
  // caricata.
  const handleScaricaCompleta = async () => {
    try {
      // Prima si raccolgono tutti i link, poi partono i download. Nell'ordine inverso ogni
      // scaricamento aspetterebbe la chiamata di rete del successivo, allungando la fila; e
      // un errore a metà lascerebbe scaricati i primi file e non gli altri, senza dirlo.
      const daScaricare: { url: string; nome: string }[] = []

      if (relazioneSalvata) {
        daScaricare.push({
          url: await relazioneDocumentiApi.urlFirmato(relazioneSalvata.filePath, relazioneSalvata.nome),
          nome: relazioneSalvata.nome,
        })
      }
      if (dichiarazioniSalvate) {
        daScaricare.push({
          url: await dichiarazioniDocumentiApi.urlFirmato(dichiarazioniSalvate.filePath, dichiarazioniSalvate.nome),
          nome: dichiarazioniSalvate.nome,
        })
      }

      // Un file per codice: il browser mette in coda i download consecutivi, non serve uno zip
      // lato client per un pugno di file — la scelta è deliberatamente la più semplice che
      // funzioni (vedi documento di design, sezione «Fuori scope»).
      const codici = codiciConAdempimento(calcolaEsitiPerCodice(formRef.current?.getFormData() ?? {}))
      for (const codice of codici) {
        const documenti = await fascicoloDocumentiApi.elenca(id!, codice)
        const fascicolo = documenti.find((d) => d.tipo === 'fascicolo')
        if (!fascicolo) {
          console.warn('[handleScaricaCompleta] Nessun fascicolo trovato per il codice', codice)
          continue
        }
        daScaricare.push({
          url: await fascicoloDocumentiApi.urlFirmato(fascicolo.filePath, fascicolo.nome),
          nome: fascicolo.nome,
        })
      }

      // Distanziati: partiti tutti nello stesso istante, alcuni browser considerano i
      // successivi al primo un tentativo di scaricamento automatico e li strozzano.
      for (const [i, doc] of daScaricare.entries()) {
        if (i > 0) await attendi(400)
        scaricaDaUrl(doc.url, doc.nome)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scaricamento non riuscito')
    }
  }

  // IMPORTANT: Calculate sedeLegale BEFORE early returns to avoid React Hook ordering issues
  // Get sede legale from customer data using formatFullAddress
  // Priority: request.customer > customerByName > custom_fields.sede_legale
  const sedeLegale = useMemo(() => {
    if (request?.customer) {
      const addr = customersApi.formatFullAddress(request.customer)
      return addr
    }
    if (customerByName) {
      const addr = customersApi.formatFullAddress(customerByName)
      return addr
    }
    return request?.custom_fields?.sede_legale || ''
  }, [request, customerByName, clienteString])

  if (requestLoading || loading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (requestError || !request) {
    return (
      <Layout>
        <Alert severity="error">Richiesta non trovata</Alert>
      </Layout>
    )
  }

  if (!technicalData) {
    return (
      <Layout>
        <Alert severity="error">
          Scheda dati tecnici non trovata
        </Alert>
      </Layout>
    )
  }

  const isDM329 = isDM329Family(request.request_type?.name)
  if (!isDM329) {
    return (
      <Layout>
        <Alert severity="error">
          Questa funzionalità è disponibile solo per richieste DM329
        </Alert>
      </Layout>
    )
  }

  // Estrai il nome cliente dai dati tecnici come fallback prioritario per i dati storici
  const technicalDataClientName = technicalData?.equipment_data?.dati_generali?.cliente

  const customerName =
    request.custom_fields?.cliente?.ragione_sociale ||
    request.customer?.ragione_sociale ||
    technicalDataClientName ||
    'N/A'

  // Codice pratica: la stessa identità che porta il dettaglio pratica. Stessa
  // queryKey del dettaglio, quindi TanStack la serve dalla cache.
  const codicePratica = codiceForRequest(request, clientSalaCount)

  // Determina se l'utente può gestire la condivisione
  const canManageSharing =
    user?.role === 'admin' ||
    user?.role === 'userdm329' ||
    (user?.role === 'tecnicoDM329' && request?.assigned_to === user?.id)

  return (
    <Layout>
      <Box>
        {/* Messaggio informativo creazione automatica */}
        {error && (
          <Alert severity="info" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Niente card attorno al form: le sezioni hanno già la propria, e una card
            dentro la card raddoppiava bordi e padding senza aggiungere struttura.
            L'intestazione la rende il form perché deve mostrare la completezza, che
            si calcola dai valori osservati. */}
        <EquipmentCatalogProvider>
          <TechnicalSheetForm
            ref={formRef}
            defaultValues={formData || undefined}
            onSubmit={handleFormSubmit}
            onAutoSave={handleAutoSave}
            customerName={customerName}
            sedeLegale={sedeLegale}
            codicePratica={codicePratica}
            requestId={request.id}
            // undefined quando la lettura di request_history è fallita (RLS, rete): senza un
            // ultimo cambio di stato certo non si passa alcun `movimenti`, e la sezione fascicolo
            // non mostra alcuna data invece di una calcolata su un ripiego potenzialmente falso.
            movimenti={
              storiaLetta
                ? {
                    stato: request.status,
                    ultimoCambioStato: ultimoCambioStato ?? null,
                    aggiornataIl: request.updated_at,
                    creataIl: request.created_at,
                  }
                : undefined
            }
            header={(completezza) => (
              <TechnicalSheetHeader
                customerName={customerName}
                codicePratica={codicePratica}
                denominazioneSala={request.denominazione_sala}
                completezza={completezza}
                autoSaving={autoSaving}
                lastSaved={lastSaved}
                canManageSharing={canManageSharing}
                canGenerateDocs={canGenerateDocs}
                onBack={() => navigate(`/requests/${id}`)}
                onShare={() => setShareDialogOpen(true)}
                onCivaSummary={() => navigate(`/requests/${id}/civa-summary`)}
                onRelazione={() => setRelazioneDialogOpen(true)}
                onDichiarazioni={() => setDichiarazioniDialogOpen(true)}
                relazionePronta={!!relazioneSalvata}
                dichiarazioniPronte={!!dichiarazioniSalvate}
                onScaricaRelazione={handleScaricaRelazione}
                onScaricaDichiarazioni={handleScaricaDichiarazioni}
                requestId={id!}
                onScaricaCompleta={handleScaricaCompleta}
              />
            )}
          />
        </EquipmentCatalogProvider>

        {/* OCR Review Dialog */}
        <OCRReviewDialog
          open={!!ocrReviewData}
          data={ocrReviewData}
          onConfirm={handleOCRConfirm}
          onCancel={handleOCRCancel}
        />

        {/* Share Dialog */}
        {technicalData && (
          <ShareDialog
            open={shareDialogOpen}
            onClose={() => setShareDialogOpen(false)}
            technicalDataId={technicalData.id}
            requestId={request.id}
          />
        )}

        {/* Dialog "Dati relazione" + generazione .docx */}
        {/* `scheda` preferisce `formData`: `technicalData.equipment_data` è la foto scattata al
            caricamento della pagina e non si aggiorna al salvataggio, quindi generare la relazione
            dopo una modifica non ancora ricaricata avrebbe riletto i valori di prima. */}
        {technicalData && id && (
          <RelazioneDataDialog
            open={relazioneDialogOpen}
            onClose={() => {
              setRelazioneDialogOpen(false)
              riaggiornaAdditionalInfo()
              queryClient.invalidateQueries({ queryKey: ['relazione-documento', id] })
            }}
            requestId={id}
            scheda={(formData ?? technicalData.equipment_data) as SchedaDatiCompleta}
            customer={request?.customer ?? customerByName ?? null}
            pratica={{
              progressivo: request?.progressivo,
              denominazioneSala: request?.denominazione_sala,
              impiantoUgualeSedeLegale: request?.impianto_uguale_sede_legale,
              indirizzoImpianto: request?.indirizzo_impianto,
              motivoRevisione: request?.motivo_revisione,
            }}
            initialAdditionalInfo={technicalData.additional_info as AdditionalInfo | undefined}
            fileName={nomeFileRelazione(codicePratica, customerName)}
            onAdditionalInfoSaved={(info) =>
              // Il dialog si chiude da solo al salvataggio: senza questo aggiornamento,
              // riaprirlo subito dopo rilegge un `initialAdditionalInfo` di prima del
              // salvataggio (il `useState` qui sotto è popolato una volta sola al mount) e lo
              // schema d'impianto ritoccato sembrerebbe perso finché non si ricarica la pagina.
              setTechnicalData((prev) => (prev ? { ...prev, additional_info: info } : prev))
            }
          />
        )}

        {/* Dialog "Dichiarazioni" + composizione del PDF a 5 parti */}
        {technicalData && (
          <DichiarazioniDialog
            open={dichiarazioniDialogOpen}
            onClose={() => {
              setDichiarazioniDialogOpen(false)
              riaggiornaAdditionalInfo()
            }}
            requestId={request.id}
            scheda={(formData ?? technicalData.equipment_data) as SchedaDatiCompleta}
            customerName={customerName}
            sitoProduttivo={risolviSitoProduttivo({
              impiantoUgualeSedeLegale: request?.impianto_uguale_sede_legale,
              indirizzoImpianto: request?.indirizzo_impianto,
              customer: request?.customer ?? customerByName ?? null,
            })}
            initialAdditionalInfo={technicalData.additional_info as AdditionalInfo | undefined}
            movimenti={
              storiaLetta
                ? {
                    stato: request.status,
                    ultimoCambioStato: ultimoCambioStato ?? null,
                    aggiornataIl: request.updated_at,
                    creataIl: request.created_at,
                  }
                : undefined
            }
            nomeFile={nomeFileDichiarazioni(codicePratica, customerName)}
          />
        )}

        {/* Snackbar per conferma salvataggio */}
        <Snackbar
          open={showSaveSuccess}
          autoHideDuration={3000}
          onClose={() => setShowSaveSuccess(false)}
          message="Bozza salvata con successo"
        />
      </Box>
    </Layout>
  )
}
