import { useForm, FormProvider } from 'react-hook-form'
import { useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Divider,
} from '@mui/material'
import {
  AutoFixHigh as AutoFixHighIcon,
} from '@mui/icons-material'
import { DatiGeneraliSection } from './DatiGeneraliSection'
import { DatiImpiantoSection } from './DatiImpiantoSection'
import { SchedaSection } from './SchedaSection'
import { UnifiedEquipmentTable } from './table/UnifiedEquipmentTable'
import { AperturaApparecchiaturaProvider } from './AperturaApparecchiatura'
import { AltriApparecchiSection } from './AllEquipmentSections'
import { BatchOCRDialog } from './BatchOCRDialog'
import { EquipmentMatchDialog } from './EquipmentMatchDialog'
import { EQUIPMENT_DEFS, KIND_PER_CATALOG_TYPE, type EquipmentKind } from './table/equipmentConfig'
import { AzioneIcona, CompletenessBar, SectionLabel } from '@/components/common'
import { radii } from '@/theme/tokens'
import {
  completezzaApparecchiature, completezzaDatiGenerali, completezzaDatiImpianto,
  eCompleta, righeComplete, somma, type Completezza,
} from '@/utils/schedaCompleteness'
import { useHydrateCatalogOrigini, VALVOLE_ROW_PREFIX } from '@/hooks/useHydrateCatalogOrigini'
import { rowKeyOf, useEquipmentCatalogContext } from './EquipmentCatalogContext'
import { codiciValvoleDisoleatore, codiciValvoleSerbatoio } from '@/utils/valvoleImpianto'
import { caricaCatalogoPerTipo } from '@/hooks/useCatalogoPerTipo'
import { normalizeDiametroValvola, readSpec } from '@/services/equipmentAudit'
import { matchEquipment, type Candidato, type MotivoAmbiguita } from '@/utils/equipmentMatcher'
import { type MovimentoPratica } from '@/services/fascicolo/scadenza'
import type { SchedaDatiCompleta } from '@/types'
import type { BatchOCRResult, BatchOCRItem } from '@/types/ocr'
import type { EquipmentCatalogItem, EquipmentCatalogType } from '@/types'
import { EQUIPMENT_LIMITS } from '@/types'
import { codeForArrayIndex, normalizeSchedaCodes } from '@/utils/equipmentCodes'

interface TechnicalSheetFormProps {
  defaultValues?: Partial<SchedaDatiCompleta>
  onSubmit: (data: SchedaDatiCompleta) => void
  onAutoSave?: (data: SchedaDatiCompleta) => void
  customerName?: string
  sedeLegale?: string
  /** Codice pratica: entra nel nome dei fascicoli generati dalle apparecchiature. */
  codicePratica?: string
  /** Pratica a cui appartengono i fascicoli: serve a salvarne i documenti. */
  requestId?: string
  /** Stato e date della pratica: da qui si ricava quando i documenti dei fascicoli scadono. */
  movimenti?: MovimentoPratica
  /**
   * Barra agganciata della pagina. La disegna il chiamante (che ha stato di
   * salvataggio e permessi) ma la rende il form, perché la completezza si calcola
   * dai valori osservati: passarla al genitore rimonterebbe l'intero form a ogni
   * tasto premuto.
   */
  header?: (completezza: Completezza) => ReactNode
}

/**
 * Bande che identificano le due sezioni della scheda.
 *
 * Prese dalla palette del tema (`primary` e `secondary`) e scelte fra i colori che nella
 * pagina non significano già qualcos'altro: il verde dice «completo», l'ambra «incompleto»,
 * il rosso «errore», e i colori dei tipi di apparecchiatura sono impegnati nella tabella.
 */
const BANDA_CONTESTO = '#6fb0ef'
const BANDA_APPARECCHIATURE = '#ce93d8'

/**
 * La data di sopralluogo è memorizzata come la scrive un `input[type=date]`
 * (`2026-07-01`): nel riepilogo va letta come la legge chi compila.
 */
const dataItaliana = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('it-IT')
}

export interface TechnicalSheetFormRef {
  getFormData: () => SchedaDatiCompleta
  submitForm: () => Promise<void>
}

/** Campo di riferimento al padre, per gli array dipendenti. */
const CHILD_REF_FIELD: Record<string, string> = {
  disoleatori: 'compressore_associato',
  scambiatori: 'essiccatore_associato',
  recipienti_filtro: 'filtro_associato',
}

/** Tipo riconosciuto dal nome del file → field array del form. */
const TYPE_TO_FIELD: Record<EquipmentCatalogType, string> = {
  'Serbatoi': 'serbatoi',
  'Compressori': 'compressori',
  'Disoleatori': 'disoleatori',
  'Essiccatori': 'essiccatori',
  'Scambiatori': 'scambiatori',
  'Filtri': 'filtri',
  'Separatori': 'separatori',
  'Recipienti filtro': 'recipienti_filtro',
  'Altro': 'altri_apparecchi',
  'Valvole di sicurezza': '', // Non applicabile
}

/** Array del padre, per gli array dipendenti. */
const CHILD_PARENT_ARRAY: Record<string, string> = {
  disoleatori: 'compressori',
  scambiatori: 'essiccatori',
  recipienti_filtro: 'filtri',
}

/**
 * Valore che l'OCR non ha saputo leggere: non deve sovrascrivere quello già presente nel record.
 * Comprende gli oggetti vuoti (`valvola_sicurezza: {}`), usati come default quando manca il dato.
 */
const isEmptyOcrValue = (v: unknown) =>
  v === undefined ||
  v === null ||
  v === '' ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)

/**
 * Sovrascrive con i dati OCR solo i campi effettivamente letti: rileggere una targhetta aggiorna la
 * scheda senza cancellare quello che l'OCR non recupera (categoria PED scelta a mano, note, ecc.).
 */
const mergeOcrData = (existing: any, incoming: Record<string, any>) => {
  const out = { ...existing }
  for (const [key, value] of Object.entries(incoming)) {
    if (isEmptyOcrValue(value)) continue
    out[key] = value
  }
  return out
}

/** Esito del riconoscimento per un file del batch, risolto prima di toccare il form. */
interface DecisioneBatch {
  item: BatchOCRItem
  /** Voce di catalogo riconosciuta, o `null` se la targhetta non ne ha una. */
  candidato: Candidato | null
}

/** Targhetta ambigua in attesa che l'operatore scelga. */
interface AmbiguitaBatch {
  item: BatchOCRItem
  candidati: Candidato[]
  motivo: MotivoAmbiguita
}

/**
 * Provenienza da registrare quando i codici si saranno assestati.
 *
 * La riga si indica per **posizione** nell'array e non per codice: `normalizeSchedaCodes` gira
 * dopo la scrittura e può rinumerare («F9.jpg» con `filtri.max = 8` diventa F1), mentre l'ordine
 * degli array lo conserva — lavora con `items.map`. La posizione è quindi l'unica coordinata che
 * sopravvive alla normalizzazione, e il codice definitivo si rilegge da lì.
 */
interface ProvenienzaBatch {
  arrayName: string
  indice: number
  /** La provenienza è della valvola di quel record, non del record stesso. */
  valvola?: boolean
  catalogItem: EquipmentCatalogItem
  appliedSpecs: Record<string, unknown>
}

/**
 * Il `kind` che descrive la targhetta di un file del batch.
 *
 * Per le valvole `parsedType` è il tipo del *recipiente* che le porta ("S1.1.jpg" ⇒ Serbatoi):
 * è il dato con cui il resto della funzione ritrova il proprietario, ma non dice niente sulla
 * valvola. Il tipo di catalogo su cui cercarla va quindi ricavato dal `kind` — cioè da
 * `EQUIPMENT_DEFS.valvola.catalogType` — e non da `parsedType`, che manderebbe a cercare una
 * valvola fra i serbatoi.
 */
const kindDelFile = (item: BatchOCRItem): EquipmentKind | undefined => {
  if (item.parsedComponentType === 'valvola_sicurezza') return 'valvola'
  return item.parsedType ? KIND_PER_CATALOG_TYPE[item.parsedType as EquipmentCatalogType] : undefined
}

/**
 * Form completo SCHEDA DATI DM329
 * Organizzato in sezioni collassabili (Accordion)
 */
export const TechnicalSheetForm = forwardRef<TechnicalSheetFormRef, TechnicalSheetFormProps>(({
  defaultValues,
  onSubmit,
  onAutoSave,
  customerName,
  sedeLegale,
  codicePratica = '',
  requestId = '',
  movimenti,
  header,
}, ref) => {
  const methods = useForm<SchedaDatiCompleta>({
    defaultValues: {
      stato: 'bozza',
      dati_generali: {
        data_sopralluogo: '',
        nome_tecnico: '',
        cliente: customerName || '',
        note_generali: '',
      },
      dati_impianto: {
        indirizzo_impianto: '',
        raccolta_condense: 'Nessuna',
      },
      serbatoi: [],
      compressori: [],
      disoleatori: [],
      essiccatori: [],
      scambiatori: [],
      filtri: [],
      separatori: [],
      altri_apparecchi: {},
      ...defaultValues,
    },
    mode: 'onBlur',
  })

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
    getValues,
    reset,
  } = methods

  // Aggancia le righe già compilate alle voci di catalogo da cui provengono: senza, riaprendo
  // una scheda salvata non si saprebbe da dove vengono i dati né si potrebbe riportarli a catalogo.
  useHydrateCatalogOrigini(defaultValues as SchedaDatiCompleta | undefined)

  // Il batch scrive negli array senza passare dal selettore del catalogo della tabella: la
  // provenienza delle righe che aggancia se la registra da sé, a fine scrittura.
  const { setOrigine } = useEquipmentCatalogContext()

  // State per Batch OCR Dialog
  const [batchOCRDialogOpen, setBatchOCRDialogOpen] = useState(false)

  /**
   * Il batch elabora N targhette dentro un handler e non può montare un hook per ciascuna:
   * `caricaCatalogoPerTipo` passa dal `QueryClient` e condivide la cache degli hook, quindi un
   * tipo già caricato dalla tabella non viene richiesto una seconda volta.
   */
  const queryClient = useQueryClient()

  /** Ambiguità in attesa di risposta, e il resolver della promessa che le sta aspettando. */
  const [coda, setCoda] = useState<AmbiguitaBatch[]>([])
  const [posizione, setPosizione] = useState(0)
  const risoltoreCoda = useRef<((scelte: DecisioneBatch[]) => void) | null>(null)
  const scelteFinora = useRef<DecisioneBatch[]>([])

  // Esponi metodi al componente parent
  useImperativeHandle(ref, () => ({
    getFormData: () => methods.getValues() as SchedaDatiCompleta,
    submitForm: async () => { await methods.handleSubmit(onSubmit)() },
  }))

  // Autosave con debounce
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const watchedData = watch()

  /**
   * Completezza, ricalcolata a ogni modifica osservata. È un conteggio su oggetti già
   * in memoria: non tocca il form né la rete, e non entra in quello che si salva.
   *
   * Niente `useMemo` sulle singole bande. React Hook Form muta i propri valori sul posto e
   * `watch()` ne restituisce solo una copia superficiale: `watchedData.dati_generali` è
   * sempre lo *stesso* oggetto, riempito man mano. Una memoizzazione su quella referenza non
   * si invalida mai, e le due bande del contesto restavano ferme al conteggio del primo
   * render — «1 di 4» e «5 di 12» su una scheda compilata per intero. Le apparecchiature si
   * salvavano perché contate sulla radice, che la copia superficiale rinnova a ogni giro.
   */
  const compGenerali = completezzaDatiGenerali(watchedData?.dati_generali)
  const compImpianto = completezzaDatiImpianto(watchedData?.dati_impianto)
  const compApparecchi = useMemo(() => completezzaApparecchiature(watchedData), [watchedData])
  const righe = useMemo(() => righeComplete(watchedData), [watchedData])
  const compContesto = somma([compGenerali, compImpianto])
  const compTotale = somma([compContesto, compApparecchi])

  /** Righe principali: le valvole non si contano, sono un componente del recipiente. */
  const principali = [
    watchedData?.serbatoi, watchedData?.compressori, watchedData?.essiccatori,
    watchedData?.filtri, watchedData?.separatori,
  ].reduce((n, a) => n + (a?.length ?? 0), 0)

  /** Riepilogo del contesto nella testata della sua sezione: la dice anche da chiusa. */
  const riepilogoContesto = [
    dataItaliana(watchedData?.dati_generali?.data_sopralluogo),
    watchedData?.dati_generali?.nome_tecnico,
    (watchedData?.dati_impianto?.aria_aspirata ?? []).join(', '),
    watchedData?.dati_impianto?.raccolta_condense,
    watchedData?.dati_impianto?.locale_dedicato ? 'locale dedicato' : '',
  ].filter(Boolean).join(' · ')

  /**
   * Apertura delle due sezioni.
   *
   * Il contesto si compila una volta sola, all'inizio del sopralluogo, mentre la tabella si
   * compila per tutto il resto: quando il contesto è pieno si ripiega da sé sulla propria
   * riga di riepilogo e lascia la pagina alle apparecchiature. Una scheda riaperta a
   * contesto già completo parte quindi con quella sezione chiusa.
   *
   * Resta una proposta, non una regola: riaperto a mano, il contesto non si richiude più da
   * solo finché la sezione non torna incompleta e viene completata di nuovo.
   */
  const [contestoAperto, setContestoAperto] = useState(
    () => !eCompleta(somma([
      completezzaDatiGenerali(defaultValues?.dati_generali),
      completezzaDatiImpianto(defaultValues?.dati_impianto),
    ]))
  )
  const [apparecchiatureAperte, setApparecchiatureAperte] = useState(true)

  const contestoPieno = eCompleta(compContesto)
  const contestoEraPieno = useRef(contestoPieno)
  useEffect(() => {
    if (contestoPieno && !contestoEraPieno.current) setContestoAperto(false)
    contestoEraPieno.current = contestoPieno
  }, [contestoPieno])

  /**
   * Il gate su `isDirty` non è un'ottimizzazione: la scheda resta modificabile anche dopo il
   * completamento, quindi senza di esso la sola apertura in consultazione la riscriverebbe
   * dopo pochi secondi. `watch()` cambia a ogni render, `isDirty` solo su modifica reale.
   */
  useEffect(() => {
    if (!onAutoSave || !isDirty) return

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Set new timeout for autosave (3 secondi dopo l'ultima modifica)
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveTimeoutRef.current = null
      onAutoSave(watchedData as SchedaDatiCompleta)
    }, 3000)

    // Cleanup
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [watchedData, onAutoSave, isDirty])

  /**
   * Non c'è più un pulsante "Salva bozza": uscire dalla scheda prima che il debounce sopra
   * scada perderebbe l'ultima modifica. I ref si aggiornano a ogni render (non sono nella
   * dependency array apposta) così la cleanup, che gira solo allo smontaggio, salva sempre
   * il dato più fresco invece di quello catturato alla creazione dell'effetto.
   */
  const latestWatchedDataRef = useRef(watchedData)
  latestWatchedDataRef.current = watchedData
  const onAutoSaveRef = useRef(onAutoSave)
  onAutoSaveRef.current = onAutoSave

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
        autoSaveTimeoutRef.current = null
        onAutoSaveRef.current?.(latestWatchedDataRef.current as SchedaDatiCompleta)
      }
    }
  }, [])


  /**
   * Presenta le ambiguità una per volta e si sblocca a coda esaurita.
   *
   * Il ponte fra un dialog, che comunica per callback, e un `await` è una promessa il cui
   * `resolve` resta in un ref finché l'ultima targhetta non ha avuto risposta.
   *
   * Chiudere il dialog non annulla il batch: la targhetta in esame vale «nessuno di questi» e i
   * suoi campi si compilano coi dati letti, come se il catalogo non la conoscesse. Chiuderlo di
   * seguito fino in fondo alla coda porta tutte le rimaste alla stessa sorte: nessun file viene
   * perso per una finestra chiusa.
   */
  const risolviCoda = (ambigue: AmbiguitaBatch[]): Promise<DecisioneBatch[]> => {
    if (ambigue.length === 0) return Promise.resolve([])
    scelteFinora.current = []
    setCoda(ambigue)
    setPosizione(0)
    return new Promise((resolve) => { risoltoreCoda.current = resolve })
  }

  /** Registra la decisione sulla targhetta corrente e passa alla successiva, o chiude la coda. */
  const avanzaCoda = (candidato: Candidato | null) => {
    scelteFinora.current.push({ item: coda[posizione].item, candidato })
    const prossima = posizione + 1
    if (prossima < coda.length) { setPosizione(prossima); return }

    const scelte = scelteFinora.current
    setCoda([])
    setPosizione(0)
    risoltoreCoda.current?.(scelte)
    risoltoreCoda.current = null
  }

  /**
   * Scrive nel form tutte le decisioni, in un colpo solo.
   *
   * È il corpo che il batch ha sempre avuto, con una sola differenza: itera sulle decisioni
   * invece che sui file, e dove la decisione porta una voce di catalogo i dati tecnici vengono
   * da lì. Ordinamento, risoluzione del proprietario delle valvole, risoluzione del padre dei
   * tipi dipendenti, `mergeOcrData` sugli esistenti e la coppia finale `normalizeSchedaCodes` +
   * `reset` restano quelli di prima.
   *
   * Restituisce i file non applicati, con il motivo: il riepilogo li mostra al tecnico.
   */
  const applicaDecisioniAlForm = (decisioni: DecisioneBatch[]): string[] => {
    /** File non applicati al form, con il motivo: da mostrare al tecnico a fine batch. */
    const skipped: string[] = []

    /** Provenienze da registrare a fine scrittura, quando i codici non cambiano più. */
    const provenienze: ProvenienzaBatch[] = []

    /**
     * Ordine di applicazione: prima i record principali, poi i dipendenti, infine le valvole.
     * Ogni gruppo si aggancia a qualcosa che il gruppo precedente ha già creato — un disoleatore al
     * suo compressore, una valvola al serbatoio o al disoleatore che la porta — e l'ordine dei file
     * non lo garantisce (in ordine alfabetico "C1.1.jpg" precede "C1.jpg" e "S1.1.jpg" precede
     * "S1.jpg"). `sort` è stabile: a parità di gruppo l'ordine di caricamento resta.
     */
    const applyOrder = (i: BatchOCRItem) => {
      if (i.parsedComponentType === 'valvola_sicurezza') return 2
      const field = i.parsedType ? TYPE_TO_FIELD[i.parsedType as EquipmentCatalogType] : ''
      return field && CHILD_REF_FIELD[field] ? 1 : 0
    }
    const ordinate = [...decisioni].sort((a, b) => applyOrder(a.item) - applyOrder(b.item))

    ordinate.forEach(decisione => {
      const item = decisione.item
      const kind = kindDelFile(item)

      console.log('🔍 Item RAW:', {
        filename: item.filename,
        parsedType: item.parsedType,
        parsedIndex: item.parsedIndex,
        parsedComponentType: item.parsedComponentType,
        hasData: !!item.result?.data,
        catalogo: decisione.candidato ? `${decisione.candidato.riga.marca} ${decisione.candidato.riga.modello}` : null
      })

      if (!item.parsedType || !item.result?.data) {
        console.warn('⏭️ Skipping item:', item.filename)
        return
      }

      const data = item.result.data
      const equipmentType = item.parsedType as EquipmentCatalogType

      console.log(`🔧 Processando ${equipmentType} index ${item.parsedIndex}:`, data)

      const fieldName = TYPE_TO_FIELD[equipmentType]
      if (!fieldName) {
        console.warn('⚠️ Tipo non mappato:', equipmentType)
        return
      }

      // Gestione componente nested (valvola)
      if (item.parsedComponentType === 'valvola_sicurezza') {
        // La valvola appartiene a un'apparecchiatura precisa, individuata dal codice: scrivere in
        // `${fieldName}.${parsedIndex}` colpirebbe il record sbagliato appena codici e posizioni
        // divergono (con [S1, S3], "S2.1.jpg" sovrascriverebbe la valvola di S3) e, se la posizione
        // non esiste, creerebbe un record fantasma privo di codice.
        const ownerCode = codeForArrayIndex(fieldName, item.parsedIndex)
        const ownerArray = (watch(fieldName as any) || []) as any[]
        const ownerIndex = ownerCode ? ownerArray.findIndex((r: any) => r?.codice === ownerCode) : -1
        if (ownerIndex < 0) {
          skipped.push(`${item.filename}: ${ownerCode ?? 'l\'apparecchiatura'} non è presente nella scheda`)
          return
        }
        console.log(`🔐 Popolando la valvola di ${ownerCode}`)

        // Usa valori normalizzati se disponibili
        const marca = item.normalizedMarca?.normalizedValue || data.marca || ''
        const modello = item.normalizedModello?.normalizedValue || data.modello || ''

        const basePath = `${fieldName}.${ownerIndex}.valvola_sicurezza`
        setValue(`${basePath}.marca` as any, marca)
        setValue(`${basePath}.modello` as any, modello)
        if (data.n_fabbrica) setValue(`${basePath}.n_fabbrica` as any, data.n_fabbrica)
        // Il campo della valvola è `diametro` — `diametro_pressione` è il nome che ha in
        // risposta all'OCR, e scriverlo tale e quale lasciava il dato in un campo che la
        // scheda non legge. Il valore va ricondotto alla scala canonica: fa parte della
        // chiave con cui il catalogo distingue le varianti della valvola.
        if (data.diametro_pressione) {
          setValue(`${basePath}.diametro` as any, normalizeDiametroValvola(data.diametro_pressione))
        }

        // Seconda passata, come per gli altri tipi: il catalogo sovrascrive marca, modello e i
        // dati tecnici della variante — sulla taratura e sul diametro è lui la fonte autorevole
        // — mentre il numero di fabbrica letto sopra è dell'esemplare e resta dov'è.
        if (decisione.candidato) {
          const def = EQUIPMENT_DEFS.valvola
          const specs = (decisione.candidato.riga.specs ?? {}) as Record<string, any>
          setValue(`${basePath}.marca` as any, decisione.candidato.riga.marca)
          setValue(`${basePath}.modello` as any, decisione.candidato.riga.modello)
          Object.entries(def.specsMap).forEach(([specKey, field]) => {
            const v = readSpec(def.catalogType, specs, specKey)
            if (v === null) return
            setValue(`${basePath}.${field}` as any, field === 'ts' ? String(v) : v)
          })
          provenienze.push({
            arrayName: fieldName,
            indice: ownerIndex,
            valvola: true,
            catalogItem: decisione.candidato.riga,
            appliedSpecs: specs,
          })
        }

        console.log(`✅ Valvola popolata: ${marca} ${modello}`)
        return
      }

      // Ottieni array corrente
      const currentArray = watch(fieldName as any) || []
      console.log(`📋 Array corrente ${fieldName}:`, currentArray.length, 'items')

      // Usa valori normalizzati se disponibili, altrimenti usa raw OCR
      const marca = item.normalizedMarca?.normalizedValue || data.marca || ''
      const modello = item.normalizedModello?.normalizedValue || data.modello || ''

      // Crea nuova apparecchiatura o aggiorna esistente
      const newEquipment: any = {
        marca,
        modello,
        n_fabbrica: data.n_fabbrica || '',
        anno: data.anno || undefined,
        volume: data.volume || undefined,
        pressione_max: data.pressione_max || undefined,
        materiale_n: data.materiale_n || undefined,
      }

      // Aggiungi dati specifici per serbatoi
      if (equipmentType === 'Serbatoi') {
        newEquipment.valvola_sicurezza = data.valvola_sicurezza || {}
        newEquipment.manometro = data.manometro || {}
      }

      // Aggiungi dati specifici per disoleatori
      if (equipmentType === 'Disoleatori') {
        newEquipment.valvola_sicurezza = data.valvola_sicurezza || {}
      }

      // Seconda passata: la voce di catalogo riconosciuta sovrascrive marca, modello e i dati
      // tecnici del modello. Deve venire *dopo* la prima e non al suo posto: la stessa foto porta
      // dati che appartengono all'esemplare e non al modello — la valvola e il manometro a bordo,
      // il materiale — e nessuno di questi compare nelle `specs` del catalogo; costruire il record
      // dalla sola riga di catalogo li perderebbe. Numero di fabbrica e anno restano quelli della
      // targhetta per la stessa ragione.
      if (decisione.candidato && kind) {
        const def = EQUIPMENT_DEFS[kind]
        const specs = (decisione.candidato.riga.specs ?? {}) as Record<string, any>
        newEquipment.marca = decisione.candidato.riga.marca
        newEquipment.modello = decisione.candidato.riga.modello
        Object.entries(def.specsMap).forEach(([specKey, field]) => {
          const v = readSpec(def.catalogType, specs, specKey)
          if (v === null) return
          // A catalogo TS è spesso un intervallo («-10 ÷ +200») e nella scheda è testo libero:
          // stessa conversione che fa il selettore del catalogo nella tabella.
          newEquipment[field] = field === 'ts' ? String(v) : v
        })
      }

      // Il nome del file individua l'apparecchiatura per codice, non per posizione: "S3.jpg" ⇒ il
      // record che ha codice S3, ovunque si trovi nell'array.
      const limits = (EQUIPMENT_LIMITS as Record<string, { prefix: string; max: number }>)[fieldName]
      const refField = limits ? CHILD_REF_FIELD[fieldName] : undefined
      /** Codice atteso per gli array principali; per i dipendenti si deriva dal padre. */
      let targetCode: string | undefined

      if (limits && refField) {
        // Array dipendente: il codice deriva dal padre, es. disoleatore di C1 ⇒ C1.1. Il padre va
        // risolto sui codici realmente presenti: senza questo controllo nascerebbe un figlio orfano,
        // che la tabella non renderizza e la normalizzazione non sa correggere.
        // `parsedParentIndex` è sempre valorizzato dal filenameParser per le forme "C1.1"/"E1.1":
        // nessun ripiego sull'indice del figlio, che aggancerebbe il record al padre sbagliato.
        if (item.parsedParentIndex === undefined) {
          skipped.push(`${item.filename}: il nome del file non indica l'apparecchiatura padre`)
          return
        }
        const parentCode = `${limits.prefix}${item.parsedParentIndex + 1}`
        const parentArray = (watch(CHILD_PARENT_ARRAY[fieldName] as any) || []) as any[]
        if (!parentArray.some((p: any) => p?.codice === parentCode)) {
          skipped.push(`${item.filename}: ${parentCode} non è presente nella scheda`)
          return
        }
        targetCode = `${parentCode}.1`
        newEquipment.codice = targetCode
        newEquipment[refField] = parentCode
      } else if (limits) {
        targetCode = `${limits.prefix}${item.parsedIndex + 1}`
        newEquipment.codice = targetCode
      }

      // Inserisci nell'array
      const newArray = [...currentArray]

      // Il record si individua dall'identità (riferimento al padre per i dipendenti, codice per i
      // principali), mai dalla posizione: scrivere per indice sovrascriverebbe l'apparecchiatura
      // sbagliata appena i codici non coincidono più con le posizioni (es. S2 eliminato).
      const existing = refField
        ? newArray.findIndex((r: any) => r?.[refField] === newEquipment[refField])
        : targetCode !== undefined
          ? newArray.findIndex((r: any) => r?.codice === targetCode)
          : -1
      if (existing >= 0) newArray[existing] = mergeOcrData(newArray[existing], newEquipment)
      else newArray.push(newEquipment)
      console.log(`💾 Salvando in ${fieldName} ${targetCode ?? '(senza codice)'}:`, newEquipment)

      // Posizione in cui il record è finito. Le scritture successive di questo stesso batch non
      // la spostano: `mergeOcrData` sostituisce sul posto e i nuovi record si accodano, nessuna
      // rimuove o riordina.
      if (decisione.candidato) {
        provenienze.push({
          arrayName: fieldName,
          indice: existing >= 0 ? existing : newArray.length - 1,
          catalogItem: decisione.candidato.riga,
          appliedSpecs: (decisione.candidato.riga.specs ?? {}) as Record<string, unknown>,
        })
      }

      console.log(`📊 Nuovo array ${fieldName}:`, newArray)
      setValue(fieldName as any, newArray, { shouldValidate: true, shouldDirty: true })
    })

    // Nessun record nasce più privo di codice: ogni inserimento porta con sé il proprio. Resta però
    // il caso fuori range — "F9.jpg" con `filtri.max = 8` accoda un record con codice F9 — che la
    // normalizzazione riporta al numero libero più basso. `reset` riscrive nel form la scheda
    // normalizzata, che è un oggetto nuovo, in un colpo solo invece di un setValue per array.
    //
    // Il reset è incondizionato: gli array sono stati riscritti con `setValue`, che non rigenera
    // gli id di `useFieldArray`. Senza reset `fields` e valori possono divergere in lunghezza, e
    // la tabella — che legge il codice da `values[i]` con `i` preso da `fields` — mostrerebbe i
    // dati di una riga sotto un'altra.
    const { scheda: normalized } = normalizeSchedaCodes(getValues())
    reset(normalized, { keepDirty: true })

    /**
     * Provenienze, registrate qui e non al momento della scrittura: la chiave si costruisce sul
     * codice, e fino alla riga sopra il codice poteva ancora cambiare. Quel che non cambia è la
     * posizione nell'array, che è ciò che il ciclo ha annotato.
     *
     * Senza questa registrazione una riga agganciata dal batch resta orfana, e dalla provenienza
     * dipendono il controllo di scostamento e la riscrittura a catalogo — cioè il difetto che
     * questo lavoro corregge. `useHydrateCatalogOrigini` non chiude il buco da solo: ricostruisce
     * la voce per euristica (marca + modello, poi la variante) e si arrende quando due varianti
     * dello stesso modello non si distinguono, mentre qui l'`id` della riga scelta è noto con
     * certezza; e su un batch di sole valvole non gira nemmeno, perché quel ramo scrive senza
     * `shouldDirty`, l'autosave non parte e l'idratazione non si riarma.
     */
    for (const p of provenienze) {
      const codice = (normalized as any)[p.arrayName]?.[p.indice]?.codice
      if (!codice) continue
      // Le valvole non hanno una chiave propria: la loro identità è la posizione nell'impianto,
      // derivata dal codice del recipiente con la stessa convenzione di `elencaValvole`. Il batch
      // scrive sempre e solo la valvola principale, che è la prima della serie.
      const rowKey = p.valvola
        ? rowKeyOf(
            VALVOLE_ROW_PREFIX,
            p.arrayName === 'disoleatori'
              ? codiciValvoleDisoleatore(codice, 1)[0]
              : codiciValvoleSerbatoio(codice, 1)[0]
          )
        : rowKeyOf(p.arrayName, codice)
      setOrigine(rowKey, { catalogItem: p.catalogItem, appliedSpecs: p.appliedSpecs })
    }

    return skipped
  }

  const handleBatchOCRComplete = async (results: BatchOCRResult, items: BatchOCRItem[]) => {
    console.log('✅ Batch OCR completato:', results, items)

    // Debug: mostra stato di ogni item PRIMA del filtro
    items.forEach((item, idx) => {
      console.log(`📋 Item ${idx} (${item.filename}):`, {
        status: item.status,
        hasResult: !!item.result,
        hasData: !!item.result?.data,
        dataContent: item.result?.data, // 🔍 CONTENUTO COMPLETO di data
        dataKeys: item.result?.data ? Object.keys(item.result.data) : [],
        result: item.result,
        parsedType: item.parsedType,
        parsedComponentType: item.parsedComponentType
      })
    })

    // Applica risultati al form
    const completedItems = items.filter(i => i.status === 'completed' && i.result?.data)
    console.log('📦 Items completati da processare:', completedItems.length)

    // 1. Riconoscimento di tutte le targhette. I casi certi si risolvono qui; gli ambigui si
    //    accodano e si chiedono tutti insieme a elaborazione finita, invece di interrompere il
    //    batch una foto per volta.
    const decisioni: DecisioneBatch[] = []
    const daChiedere: AmbiguitaBatch[] = []

    for (const item of completedItems) {
      const kind = kindDelFile(item)
      const dati = item.result?.data
      if (!kind || !dati) { decisioni.push({ item, candidato: null }); continue }

      // Il tipo di catalogo si ricava dal `kind`, non da `parsedType`: sulle valvole i due non
      // coincidono, e cercare una valvola fra i serbatoi non troverebbe mai niente.
      const tipo = EQUIPMENT_DEFS[kind].catalogType

      let righeCatalogo: EquipmentCatalogItem[] = []
      try {
        righeCatalogo = await caricaCatalogoPerTipo(queryClient, tipo)
      } catch (e) {
        // Un catalogo irraggiungibile non deve far perdere le letture: senza righe non c'è
        // riconoscimento possibile e la targhetta prende la strada di sempre. Lasciar propagare
        // l'errore invece abbandonerebbe l'intero batch prima di scrivere qualsiasi cosa.
        console.error('[Batch OCR] catalogo non caricato per', tipo, e)
      }

      const esito = matchEquipment(kind, dati, righeCatalogo)
      if (esito.esito === 'certo') {
        decisioni.push({ item, candidato: esito.candidato })
      } else if (esito.esito === 'ambiguo') {
        daChiedere.push({ item, candidati: esito.candidati, motivo: esito.motivo })
      } else {
        decisioni.push({ item, candidato: null })
      }
    }

    // 2. Coda delle ambiguità: una targhetta per volta, con l'indicazione del file da cui viene.
    //    Ogni ambiguità esce da qui con una decisione — la voce scelta o «nessuno di questi» —
    //    quindi `decisioni` copre comunque tutti i file elaborati.
    const scelte = await risolviCoda(daChiedere)
    decisioni.push(...scelte)

    // 3. Scrittura nel form: unica, come prima.
    const skipped = applicaDecisioniAlForm(decisioni)

    const applicati = completedItems.length - skipped.length
    alert(
      `Batch OCR completato!\n\n` +
      `Totale: ${results.total}\n` +
      `Completati: ${results.completed}\n` +
      `Errori: ${results.errors}\n` +
      `Agganciate a catalogo: ${decisioni.filter((d) => d.candidato).length}\n\n` +
      `${applicati} apparecchiature aggiunte al form.` +
      (skipped.length
        ? `\n\n${skipped.length} file non applicati:\n${skipped.map((s) => `• ${s}`).join('\n')}`
        : '')
    )

    setBatchOCRDialogOpen(false)
  }

  return (
    <FormProvider {...methods}>
      {/* Il provider avvolge barra e tabella insieme: i chip dei fascicoli stanno nella prima
          e la finestra che aprono vive nella seconda. */}
      <AperturaApparecchiaturaProvider>
      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        {header?.(compTotale)}

        {/* Le due sezioni stanno una sotto l'altra e restano staccate: prima erano
            linguette, e passare dal contesto alle apparecchiature costava un cambio di
            pagina proprio mentre si compilava. Il contesto viene per primo perché è il
            primo passo del sopralluogo. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <SchedaSection
            titolo="Contesto"
            colore={BANDA_CONTESTO}
            aperta={contestoAperto}
            onToggle={() => setContestoAperto((v) => !v)}
            completezza={compContesto}
            riepilogo={riepilogoContesto}
          >
            {/* Due bande separate da un filetto: cinque campi non meritano una card
                propria, e due card affiancate non si allineavano. */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
              <SectionLabel>Sopralluogo</SectionLabel>
              <CompletenessBar completezza={compGenerali} mostraMancanti />
            </Box>
            <DatiGeneraliSection
              control={control}
              errors={errors}
              defaultCustomer={customerName}
            />

            <Divider sx={{ my: 2.5 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
              <SectionLabel>Sala compressori</SectionLabel>
              <CompletenessBar completezza={compImpianto} mostraMancanti />
            </Box>
            <DatiImpiantoSection control={control} errors={errors} sedeLegale={sedeLegale} />
          </SchedaSection>

          <SchedaSection
            titolo="Apparecchiature"
            colore={BANDA_APPARECCHIATURE}
            aperta={apparecchiatureAperte}
            onToggle={() => setApparecchiatureAperte((v) => !v)}
            completezza={compApparecchi}
            contatore={`${principali} principali`}
            riepilogo={`${righe.complete} di ${righe.totali} righe complete`}
          >
            <UnifiedEquipmentTable
              control={control}
              errors={errors}
              completezza={compApparecchi}
              righeComplete={righe}
              codicePratica={codicePratica}
              requestId={requestId}
              movimenti={movimenti}
              ragioneSociale={customerName}
              azioni={
                <AzioneIcona
                  icona={<AutoFixHighIcon fontSize="small" />}
                  testo="Riconosci automaticamente"
                  onClick={() => setBatchOCRDialogOpen(true)}
                />
              }
            />

            {/* Gli altri apparecchi non hanno una riga di tabella propria — sono un campo
                libero — ma sono apparecchiature: stanno in coda alla loro sezione invece
                che in una terza banda tutta per un campo di testo. */}
            <Box sx={{ mt: 2, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: `${radii.card}px` }}>
              <Box sx={{ mb: 1 }}>
                <SectionLabel>Altri apparecchi</SectionLabel>
              </Box>
              <AltriApparecchiSection control={control} errors={errors} />
            </Box>
          </SchedaSection>
        </Box>

        {/* Batch OCR Dialog */}
        <BatchOCRDialog
          open={batchOCRDialogOpen}
          onClose={() => setBatchOCRDialogOpen(false)}
          onComplete={handleBatchOCRComplete}
        />

        {/* Coda delle ambiguità del batch: si monta solo mentre c'è qualcosa da chiedere, sopra
            la finestra del batch che resta aperta finché non si è deciso di tutte.

            `origine` e `passo` non sono decorativi: il popup azzera la selezione anche su quei
            due valori, e senza di essi due targhette consecutive che producono gli stessi
            candidati con lo stesso motivo — due serbatoi SICC identici della stessa scheda, di
            annate diverse — lascerebbero accesa e confermabile la scelta fatta sulla precedente,
            la cui risposta giusta è un'altra riga. */}
        {coda.length > 0 && (
          <EquipmentMatchDialog
            open
            datiOcr={coda[posizione].item.result!.data!}
            candidati={coda[posizione].candidati}
            motivo={coda[posizione].motivo}
            origine={coda[posizione].item.filename}
            passo={{ corrente: posizione + 1, totale: coda.length }}
            onScegli={(c) => avanzaCoda(c)}
            onScarta={() => avanzaCoda(null)}
          />
        )}

      </Box>
      </AperturaApparecchiaturaProvider>
    </FormProvider>
  )
})
