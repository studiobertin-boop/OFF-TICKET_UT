/**
 * Sezione §2.3 del dialog relazione: lo schema d'impianto.
 *
 * Quando i dati della scheda bastano, lo schema si genera da solo e l'utente lo rifinisce
 * nell'editor; l'upload di un disegno AutoCAD resta sempre disponibile per i casi che il
 * generatore non copre. In entrambe le strade l'uscita è la stessa: un `SchemaImpianto`,
 * cioè i byte PNG che il motore della relazione incorpora nel .docx senza saperne l'origine.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { AutoFixHigh as GeneraIcon, Edit as EditIcon } from '@mui/icons-material'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import type { SchemaImpianto } from '@/services/relazione/types'
import {
  buildSchemaModel,
  notaTubazioni,
  puoGenerareSchema,
} from '@/services/schemaImpianto/buildSchemaModel'
import { layoutSchema } from '@/services/schemaImpianto/layout'
import type { Tarature, TaraturaSimbolo } from '@/services/schemaImpianto/libreria'
import { risolviLibreria } from '@/services/schemaImpianto/libreria'
import { renderSvg } from '@/services/schemaImpianto/renderSvg'
import { rasterizzaSvg } from '@/services/schemaImpianto/rasterize'
import type { LayoutSalvato } from '@/services/schemaImpianto/persistenza'
import { layoutIniziale } from '@/services/schemaImpianto/persistenza'
import { leggiTaraturePermanenti, scriviTaraturaPermanente } from '@/services/schemaImpianto/tarature'
import type { ChiaveSimbolo, SchemaLayout } from '@/services/schemaImpianto/types'
import { SchemaEditor } from '@/components/schemaImpianto/SchemaEditor'
import { leggiPreferenze, scriviPreferenze, type PreferenzeEditor } from '@/components/schemaImpianto/preferenzeEditor'
import { FORMATI_SCHEMA, leggiSchemaImpianto } from './schemaImpiantoFile'

/** Da dove viene lo schema attualmente in uso: cambia solo ciò che si racconta all'utente. */
type Origine = 'generato' | 'caricato'

/**
 * Chiave della cache per le tarature permanenti (tabella `schema_simboli`). Una sola per l'intera
 * applicazione, senza parti variabili: la tabella non è filtrata per pratica né per utente — una
 * taratura permanente vale per tutti — quindi due pratiche aperte di seguito devono leggere la
 * STESSA voce di cache, ed è anche la voce che «rendi permanenti» aggiorna a scrittura riuscita.
 */
const CHIAVE_TARATURE_PERMANENTI = ['schemaImpianto', 'taraturePermanenti'] as const

/** Mappa vuota di modulo, non `{}` inline: entra nelle dipendenze di `libreria` qui sotto e un
 *  oggetto nuovo a ogni render invaliderebbe quel `useMemo` a schema fermo (stessa trappola
 *  descritta per `LIBRERIA_VUOTA` in SchemaEditor.tsx). */
const TARATURE_VUOTE: Tarature = {}

export interface SchemaImpiantoSectionProps {
  scheda: SchedaDatiCompleta
  collegamentiCompressoriSerbatoi: Record<string, string[]>
  schema: SchemaImpianto | null
  onSchemaChange: (schema: SchemaImpianto | null) => void
  /**
   * Layout ritoccato salvato in una sessione precedente, da riconciliare alla prima
   * generazione. Tre stati distinti, non due:
   * - `undefined` — il genitore non ha ancora letto `additional_info`: non si genera e non si
   *   alza la guardia `generazioneTentata`, altrimenti alla lettura effettiva il valore vero
   *   arriverebbe a guardia già alzata e verrebbe ignorato.
   * - `null` — letto, non c'è nessun layout salvato: si genera da zero.
   * - `LayoutSalvato` — letto, c'è: si riconcilia.
   */
  layoutSalvato: LayoutSalvato | null | undefined
  /** Chiamata a ogni `disegna`, così il dialog ha sempre il layout corrente da persistere. */
  onLayoutChange: (layout: SchemaLayout | null) => void
  /**
   * La taratura di PRATICA (Task 12, il modo taratura sulla tela): letta all'apertura da
   * `layoutSalvato.simboli` (chi monta questo componente, `RelazioneDataDialog`, la semina lì),
   * amendata quando l'editor chiude il modo con «usa solo questa volta» o «rendi permanenti»
   * (che la toglie di qui, per non lasciarla a fare ombra al valore appena reso permanente —
   * vedi `SchemaEditor.tsx`, `rendiPermanenti`). È lo strato sotto la libreria di QUESTA
   * pratica: `libreria` qui sotto la fonde col registro tramite `risolviLibreria`.
   */
  taraturaPratica: Tarature
  onTaraturaPraticaChange: (taraturaPratica: Tarature) => void
  disabled?: boolean
}

export function SchemaImpiantoSection({
  scheda,
  collegamentiCompressoriSerbatoi,
  schema,
  onSchemaChange,
  layoutSalvato,
  onLayoutChange,
  taraturaPratica,
  onTaraturaPraticaChange,
  disabled = false,
}: SchemaImpiantoSectionProps) {
  // Letto qui e non dentro `SchemaEditor` (che riceve `isAdmin` come prop): `useAuth` importa
  // `services/supabase.ts`, che senza le variabili d'ambiente lancia al solo caricamento del
  // modulo, e `codiceLibero.test.ts` importa una funzione pura da SchemaEditor.tsx senza montare
  // né un provider né un ambiente Supabase.
  const { isAdmin } = useAuth()
  const [layout, setLayout] = useState<SchemaLayout | null>(null)
  const [origine, setOrigine] = useState<Origine | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [editorAperto, setEditorAperto] = useState(false)
  // Le regolazioni della finestra stanno qui, non nell'editor, perché servono a più consumatori:
  // il Dialog per le proprie dimensioni, l'editor per il divisorio e per la maniglia di
  // ridimensionamento. Una copia per parte significherebbe finestra e gesti che si contraddicono.
  const [preferenze, setPreferenze] = useState<PreferenzeEditor>(leggiPreferenze)
  const cambiaPreferenze = useCallback((parziale: Partial<PreferenzeEditor>) => {
    setPreferenze((precedenti) => {
      // Tenendo la maniglia (o il divisorio) contro un limite, ogni pointermove ricalcola lo
      // stesso valore già clampato: senza questo confronto ogni frame produrrebbe comunque un
      // oggetto nuovo, quindi un render e — via l'effetto qui sotto — una scrittura su
      // localStorage, per l'intera durata in cui il puntatore resta fermo contro il bordo.
      const chiavi = Object.keys(parziale) as (keyof PreferenzeEditor)[]
      const invariata = chiavi.every((chiave) => precedenti[chiave] === parziale[chiave])
      return invariata ? precedenti : { ...precedenti, ...parziale }
    })
  }, [])
  // La persistenza sta in un effetto e non dentro l'updater di setPreferenze: quell'updater deve
  // restare puro (React può invocarlo più volte per lo stesso aggiornamento, come fa in
  // StrictMode), e scriverci dentro su localStorage — un effetto collaterale sincrono — lo
  // violerebbe. Gira anche al primo montaggio, riscrivendo gli stessi valori appena letti da
  // leggiPreferenze: ridondante ma innocuo, perché idempotente.
  useEffect(() => {
    scriviPreferenze(preferenze)
  }, [preferenze])
  const [anteprimaUrl, setAnteprimaUrl] = useState<string | null>(null)
  const [ingrandita, setIngrandita] = useState(false)
  const [sopra, setSopra] = useState(false)
  // Esito della riconciliazione fra layout salvato e scheda, mostrato finché resta valido:
  // sparisce solo quando l'utente rigenera o ricarica un disegno, non a ogni render.
  const [esitoRiconciliazione, setEsitoRiconciliazione] = useState<{
    aggiunti: string[]
    rimossi: string[]
  } | null>(null)

  const puoGenerare = puoGenerareSchema({ scheda, collegamentiCompressoriSerbatoi })
  const note = useMemo(() => notaTubazioni(scheda), [scheda])
  // Lo strato PERMANENTE della libreria (tabella `schema_simboli`, Task 9): questo è il suo
  // unico punto di lettura in tutta l'applicazione. Senza, «rendi permanenti» scriveva in tabella
  // e nessuna pratica rileggeva mai quella riga: l'amministratore vedeva la taratura appena resa
  // permanente sparire alla prima apertura di qualsiasi pratica, compresa quella su cui l'aveva
  // decisa.
  //
  // Una `useQuery` e non una lettura una tantum in un effetto: la voce di cache è condivisa fra
  // tutte le pratiche aperte nella stessa sessione, e «rendi permanenti» la aggiorna in place
  // (`scriviPermanente` qui sotto) — così il risultato si vede subito, senza riaprire nulla.
  // `staleTime` lungo: sono decisioni prese col committente, non un dato che cambia da sé.
  const queryClient = useQueryClient()
  const { data: taraturePermanenti, isPending: permanentiInLettura } = useQuery({
    queryKey: CHIAVE_TARATURE_PERMANENTI,
    queryFn: leggiTaraturePermanenti,
    staleTime: 30 * 60 * 1000,
  })

  // Punto unico di risoluzione della libreria per questa pratica: sia per la generazione del
  // documento (`disegna`/`rigenera` qui sotto) sia per l'editor, che la riceve come prop invece
  // di risolversi la propria, sia per la riconciliazione all'apertura (`layoutIniziale`, che dal
  // canto suo non rifonde nulla — vedi il suo commento). I due strati sopra il registro di
  // fabbrica: le permanenti, e `taraturaPratica` (Task 12, il modo taratura sulla tela) che vince
  // su di loro. «Unico» va preso alla lettera: un secondo `risolviLibreria` altrove tornerebbe a
  // divergere in silenzio appena le due fonti si scostano.
  //
  // In caso di errore di lettura `taraturePermanenti` resta `undefined` e si ripiega sul solo
  // registro: il disegno esce come prima che le tarature permanenti esistessero — meno fedele,
  // ma disegnato. Bloccare l'intera §2.3 perché una tabella accessoria non risponde sarebbe
  // sproporzionato.
  const libreria = useMemo(
    () => risolviLibreria(taraturePermanenti ?? TARATURE_VUOTE, taraturaPratica),
    [taraturePermanenti, taraturaPratica]
  )

  /**
   * `scriviTaraturaPermanente`, più l'aggiornamento della cache a scrittura riuscita: la mappa in
   * memoria deve riflettere subito ciò che è appena finito in tabella, o la tela e il documento
   * tornerebbero al default appena il modo taratura si chiude. Si aggiorna la voce invece di
   * invalidarla per non far dipendere da un secondo giro di rete l'esito di un gesto già
   * concluso. Un errore non tocca la cache e risale al chiamante, che lo mostra (SchemaEditor.tsx).
   */
  const scriviPermanente = useCallback(
    async (chiave: ChiaveSimbolo, taratura: TaraturaSimbolo | null) => {
      await scriviTaraturaPermanente(chiave, taratura)
      queryClient.setQueryData<Tarature>(CHIAVE_TARATURE_PERMANENTI, (precedenti) => {
        const aggiornate = { ...(precedenti ?? {}) }
        if (taratura === null) delete aggiornate[chiave]
        else aggiornate[chiave] = taratura
        return aggiornate
      })
    },
    [queryClient]
  )

  // «Torna a default» (`taratura: null`) toglie la voce; «usa solo questa volta»/«rendi
  // permanenti» (che la toglie di pratica dopo aver scritto in tabella, vedi SchemaEditor.tsx) la
  // scrivono. Un'unica funzione qui, non lasciata al chiamante: solo questa Section possiede
  // `taraturaPratica`, la sola con cui calcolare la mappa aggiornata.
  const impostaTaraturaPratica = useCallback(
    (chiave: ChiaveSimbolo, taratura: TaraturaSimbolo | null) => {
      if (taratura === null) {
        // `delete` su una copia, non destrutturazione con variabile scartata (`{[chiave]:
        // _, ...resto}`): la seconda lascerebbe una variabile mai letta, e il gate di lint del
        // progetto non ha `varsIgnorePattern` per assorbirla (solo `argsIgnorePattern`).
        const resto = { ...taraturaPratica }
        delete resto[chiave]
        onTaraturaPraticaChange(resto)
      } else {
        onTaraturaPraticaChange({ ...taraturaPratica, [chiave]: taratura })
      }
    },
    [taraturaPratica, onTaraturaPraticaChange]
  )

  useEffect(() => {
    return () => {
      if (anteprimaUrl) URL.revokeObjectURL(anteprimaUrl)
    }
  }, [anteprimaUrl])

  const pubblica = useCallback(
    (prodotto: SchemaImpianto, da: Origine) => {
      setAnteprimaUrl((precedente) => {
        if (precedente) URL.revokeObjectURL(precedente)
        return URL.createObjectURL(new Blob([prodotto.dati as BlobPart], { type: 'image/png' }))
      })
      setOrigine(da)
      onSchemaChange(prodotto)
    },
    [onSchemaChange]
  )

  const disegna = useCallback(
    async (daDisegnare: SchemaLayout) => {
      setInCorso(true)
      try {
        const immagine = await rasterizzaSvg(renderSvg(daDisegnare, libreria, { noteTubazioni: note }))
        setLayout(daDisegnare)
        onLayoutChange(daDisegnare)
        pubblica(immagine, 'generato')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Generazione dello schema non riuscita.')
      } finally {
        setInCorso(false)
      }
    },
    [libreria, note, onLayoutChange, pubblica]
  )

  // Prima generazione automatica: appena i dati bastano, l'utente trova la proposta già
  // pronta. Non si rigenera da sola dopo: sovrascriverebbe le correzioni fatte nell'editor.
  // Con un layout salvato la proposta è la riconciliazione, non l'auto-layout da zero: le
  // posizioni ritoccate a mano non vanno perse solo perché il dialog è stato riaperto.
  const generazioneTentata = useRef(false)
  useEffect(() => {
    // Il genitore non ha ancora letto `additional_info`: aspetta il valore vero prima di
    // decidere fra auto-layout e riconciliazione, e soprattutto prima di alzare la guardia.
    // Senza questo controllo, con `RelazioneDataDialog` che resta montato fra un'apertura e
    // l'altra, questo effetto girerebbe alla nuova apertura con `layoutSalvato` ancora quello
    // di prima (il genitore lo sincronizza in un effetto suo, che parte dopo) e la guardia si
    // alzerebbe sul layout vecchio.
    if (layoutSalvato === undefined) return
    // Stessa cautela, sull'altro ingresso che arriva in ritardo: le tarature permanenti. Generare
    // prima che siano lette produrrebbe un disegno col simbolo di fabbrica e alzerebbe la
    // guardia, e non si rigenera più da soli — la taratura permanente non comparirebbe mai.
    // Sull'errore di lettura `isPending` cade comunque a falso e si genera col solo registro
    // (vedi `libreria` qui sopra).
    if (permanentiInLettura) return
    if (generazioneTentata.current || !puoGenerare || schema) return
    generazioneTentata.current = true
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi })
    const esito = layoutIniziale(layoutSalvato, modello, libreria)
    // `aggiuntiDaScheda`, non `aggiunti`: il secondo comprende anche il terminale utenze, che
    // non è un'apparecchiatura e non viene dalla scheda (vedi `EsitoRiconciliazione`).
    setEsitoRiconciliazione(
      esito.aggiuntiDaScheda.length > 0 || esito.rimossi.length > 0
        ? { aggiunti: esito.aggiuntiDaScheda, rimossi: esito.rimossi }
        : null
    )
    void disegna(esito.layout)
  }, [
    collegamentiCompressoriSerbatoi,
    disegna,
    layoutSalvato,
    libreria,
    permanentiInLettura,
    puoGenerare,
    scheda,
    schema,
  ])

  const rigenera = useCallback(() => {
    // Via d'uscita quando il disegno salvato non va più bene: si riparte dalla scheda,
    // scartando sia il layout ritoccato sia l'esito della riconciliazione che lo riguardava.
    setEsitoRiconciliazione(null)
    void disegna(layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi }), libreria))
  }, [collegamentiCompressoriSerbatoi, disegna, libreria, scheda])

  const leggiFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return
      setInCorso(true)
      try {
        const letto = await leggiSchemaImpianto(file)
        // Il disegno caricato sostituisce del tutto quello generato: l'editor non saprebbe
        // che farsene di un'immagine, e riaprirlo riporterebbe indietro il lavoro.
        setLayout(null)
        onLayoutChange(null)
        setEsitoRiconciliazione(null)
        pubblica(letto, 'caricato')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Immagine non leggibile.')
      } finally {
        setInCorso(false)
      }
    },
    [onLayoutChange, pubblica]
  )

  const sospeso = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    if (disabled || inCorso) return
    e.dataTransfer.dropEffect = 'copy'
    setSopra(true)
  }

  const uscito = (e: DragEvent<HTMLElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setSopra(false)
  }

  const rilasciato = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    setSopra(false)
    if (disabled || inCorso) return
    void leggiFile(e.dataTransfer.files?.[0])
  }

  return (
    <>
      <Typography variant="subtitle2">Schema d’impianto (§2.3)</Typography>

      {puoGenerare ? (
        <Typography variant="body2" color="text.secondary">
          Lo schema viene generato dai dati della scheda (apparecchiature, collegamenti
          compressori-serbatoi, raccolta condense, ubicazione dei serbatoi). Rifiniscilo
          nell’editor per aggiungere ciò che i dati non sanno — bypass, valvole aggiuntive,
          tratti flessibili — oppure carica un disegno AutoCAD.
        </Typography>
      ) : (
        <Alert severity="info">
          Lo schema non può essere generato automaticamente: dichiara prima i collegamenti
          compressori → serbatoi qui sopra. Nel frattempo puoi caricare un disegno.
        </Alert>
      )}

      {esitoRiconciliazione && (
        <Alert severity="info">
          {[
            esitoRiconciliazione.aggiunti.length > 0
              ? `Aggiunte dalla scheda: ${esitoRiconciliazione.aggiunti.join(', ')}.`
              : null,
            esitoRiconciliazione.rimossi.length > 0
              ? `Rimosse perché non più in scheda: ${esitoRiconciliazione.rimossi.join(', ')}.`
              : null,
          ]
            .filter(Boolean)
            .join(' ')}
        </Alert>
      )}

      <Box
        onDragEnter={sospeso}
        onDragOver={sospeso}
        onDragLeave={uscito}
        onDrop={rilasciato}
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
          p: 2,
          borderRadius: 1,
          border: '1px dashed',
          borderColor: sopra ? 'primary.main' : 'divider',
          bgcolor: sopra ? 'action.hover' : 'transparent',
          transition: 'border-color 120ms, background-color 120ms',
        }}
      >
        {inCorso && (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Elaborazione dello schema in corso…
            </Typography>
          </Stack>
        )}

        {anteprimaUrl && (
          <Tooltip title="Ingrandisci per leggere codici ed etichette">
            <Box
              component="img"
              src={anteprimaUrl}
              alt="Anteprima dello schema d’impianto"
              onClick={() => setIngrandita(true)}
              sx={{
                maxWidth: 240,
                maxHeight: 180,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'common.white',
                cursor: 'zoom-in',
              }}
            />
          </Tooltip>
        )}

        <Stack spacing={1}>
          {schema && (
            <Typography variant="body2">
              {origine === 'generato' ? 'Schema generato automaticamente' : schema.nomeFile} —{' '}
              {schema.larghezzaPx}×{schema.altezzaPx} px
            </Typography>
          )}

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {layout && (
              <Button
                size="small"
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => setEditorAperto(true)}
                disabled={disabled || inCorso}
              >
                Rifinisci schema
              </Button>
            )}
            {puoGenerare && (
              <Button
                size="small"
                variant={layout ? 'text' : 'contained'}
                startIcon={<GeneraIcon />}
                onClick={rigenera}
                disabled={disabled || inCorso}
              >
                {layout ? 'Rigenera da capo' : 'Genera schema'}
              </Button>
            )}
            <Button component="label" size="small" variant="outlined" disabled={disabled || inCorso}>
              Carica disegno AutoCAD
              <input
                type="file"
                hidden
                accept={FORMATI_SCHEMA.join(',')}
                onChange={(e) => {
                  void leggiFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </Button>
            {schema && (
              <Button
                size="small"
                color="inherit"
                onClick={() => {
                  setLayout(null)
                  onLayoutChange(null)
                  setOrigine(null)
                  setEsitoRiconciliazione(null)
                  setAnteprimaUrl((precedente) => {
                    if (precedente) URL.revokeObjectURL(precedente)
                    return null
                  })
                  onSchemaChange(null)
                }}
                disabled={disabled || inCorso}
              >
                Rimuovi
              </Button>
            )}
          </Stack>

          {!schema && !inCorso && (
            <Typography variant="body2" color="text.secondary">
              …oppure trascina qui un file (PNG, JPEG o PDF, max 10 MB). Senza schema il
              paragrafo resterà vuoto.
            </Typography>
          )}
        </Stack>
      </Box>

      {/* A 240px l'anteprima non basta a giudicare il disegno: qui si legge a grandezza piena. */}
      <Dialog open={ingrandita} onClose={() => setIngrandita(false)} fullWidth maxWidth="xl">
        <DialogTitle>Schema d’impianto — anteprima</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'common.white', overflow: 'auto' }}>
          {anteprimaUrl && (
            <Box
              component="img"
              src={anteprimaUrl}
              alt="Schema d’impianto a grandezza piena"
              sx={{ width: '100%', display: 'block' }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* La finestra non ha più una taglia fissa: le dimensioni arrivano dalle preferenze, e il
          DialogContent si limita a riempire ciò che resta fra titolo e bordo. Il Paper di MUI è
          già una colonna flex, quindi `flex: 1` più `minHeight: 0` bastano a farlo cedere
          l'altezza all'editor invece di gonfiarsi oltre la finestra.
          L'editor ha un'altezza minima incomprimibile (barra strumenti + i 360px della riga
          tela+anteprima + barra inferiore, sotto titolo e divisori): alle percentuali basse che
          la maniglia consente quel minimo può superare l'altezza del Paper. `overflow: 'auto'`
          tiene raggiungibile a scorrimento la barra inferiore — «Conferma schema» compreso —
          invece di tagliarla fuori dalla vista. */}
      <Dialog
        open={editorAperto}
        onClose={() => setEditorAperto(false)}
        fullScreen={preferenze.schermoIntero}
        maxWidth={false}
        PaperProps={{
          sx: preferenze.schermoIntero
            ? undefined
            : {
                width: `${preferenze.larghezza}vw`,
                height: `${preferenze.altezza}vh`,
                maxWidth: 'none',
                maxHeight: 'none',
              },
        }}
      >
        <DialogTitle>Rifinisci lo schema d’impianto</DialogTitle>
        <DialogContent dividers sx={{ p: 0, flex: 1, minHeight: 0, overflow: 'auto' }}>
          {layout && (
            <SchemaEditor
              layout={layout}
              noteTubazioni={note}
              libreria={libreria}
              // Lo strato permanente da solo, oltre a quello fuso: «torna a default» deve sapere
              // con quali ancore resterebbe il simbolo se la taratura di pratica sparisse, e dalla
              // libreria fusa non è più ricavabile (vedi `SchemaEditorProps.libreriaPermanente`).
              libreriaPermanente={taraturePermanenti ?? TARATURE_VUOTE}
              isAdmin={isAdmin}
              onTaraturaPratica={impostaTaraturaPratica}
              onScriviTaraturaPermanente={scriviPermanente}
              preferenze={preferenze}
              onCambiaPreferenze={cambiaPreferenze}
              onAnnulla={() => setEditorAperto(false)}
              onConferma={(modificato) => {
                setEditorAperto(false)
                void disegna(modificato)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
