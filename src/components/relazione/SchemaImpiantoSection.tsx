/**
 * Sezione §2.3 del dialog relazione: lo schema d'impianto.
 *
 * Quando i dati della scheda bastano, lo schema si genera da solo e l'utente lo rifinisce
 * nell'editor; l'upload di un disegno AutoCAD resta sempre disponibile per i casi che il
 * generatore non copre. In entrambe le strade l'uscita è la stessa: un `SchemaImpianto`,
 * cioè i byte PNG che il motore della relazione incorpora nel .docx senza saperne l'origine.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
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
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import type { SchemaImpianto } from '@/services/relazione/types'
import {
  buildSchemaModel,
  notaTubazioni,
  puoGenerareSchema,
} from '@/services/schemaImpianto/buildSchemaModel'
import { layoutSchema } from '@/services/schemaImpianto/layout'
import { renderSvg } from '@/services/schemaImpianto/renderSvg'
import { rasterizzaSvg } from '@/services/schemaImpianto/rasterize'
import type { LayoutSalvato } from '@/services/schemaImpianto/persistenza'
import { riconcilia } from '@/services/schemaImpianto/persistenza'
import type { SchemaLayout } from '@/services/schemaImpianto/types'
import { SchemaEditor } from '@/components/schemaImpianto/SchemaEditor'
import { FORMATI_SCHEMA, leggiSchemaImpianto } from './schemaImpiantoFile'

/** Da dove viene lo schema attualmente in uso: cambia solo ciò che si racconta all'utente. */
type Origine = 'generato' | 'caricato'

export interface SchemaImpiantoSectionProps {
  scheda: SchedaDatiCompleta
  collegamentiCompressoriSerbatoi: Record<string, string[]>
  schema: SchemaImpianto | null
  onSchemaChange: (schema: SchemaImpianto | null) => void
  /** Layout ritoccato salvato in una sessione precedente, da riconciliare alla prima generazione. */
  layoutSalvato?: LayoutSalvato
  /** Chiamata a ogni `disegna`, così il dialog ha sempre il layout corrente da persistere. */
  onLayoutChange: (layout: SchemaLayout | null) => void
  disabled?: boolean
}

export function SchemaImpiantoSection({
  scheda,
  collegamentiCompressoriSerbatoi,
  schema,
  onSchemaChange,
  layoutSalvato,
  onLayoutChange,
  disabled = false,
}: SchemaImpiantoSectionProps) {
  const [layout, setLayout] = useState<SchemaLayout | null>(null)
  const [origine, setOrigine] = useState<Origine | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [editorAperto, setEditorAperto] = useState(false)
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
        const immagine = await rasterizzaSvg(renderSvg(daDisegnare, { noteTubazioni: note }))
        setLayout(daDisegnare)
        onLayoutChange(daDisegnare)
        pubblica(immagine, 'generato')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Generazione dello schema non riuscita.')
      } finally {
        setInCorso(false)
      }
    },
    [note, onLayoutChange, pubblica]
  )

  // Prima generazione automatica: appena i dati bastano, l'utente trova la proposta già
  // pronta. Non si rigenera da sola dopo: sovrascriverebbe le correzioni fatte nell'editor.
  // Con un layout salvato la proposta è la riconciliazione, non l'auto-layout da zero: le
  // posizioni ritoccate a mano non vanno perse solo perché il dialog è stato riaperto.
  const generazioneTentata = useRef(false)
  useEffect(() => {
    if (generazioneTentata.current || !puoGenerare || schema) return
    generazioneTentata.current = true
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi })
    if (layoutSalvato) {
      const esito = riconcilia(layoutSalvato, modello)
      setEsitoRiconciliazione(
        esito.aggiunti.length > 0 || esito.rimossi.length > 0
          ? { aggiunti: esito.aggiunti, rimossi: esito.rimossi }
          : null
      )
      void disegna(esito.layout)
    } else {
      void disegna(layoutSchema(modello))
    }
  }, [collegamentiCompressoriSerbatoi, disegna, layoutSalvato, puoGenerare, scheda, schema])

  const rigenera = useCallback(() => {
    // Via d'uscita quando il disegno salvato non va più bene: si riparte dalla scheda,
    // scartando sia il layout ritoccato sia l'esito della riconciliazione che lo riguardava.
    setEsitoRiconciliazione(null)
    void disegna(layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi })))
  }, [collegamentiCompressoriSerbatoi, disegna, scheda])

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

      <Dialog open={editorAperto} onClose={() => setEditorAperto(false)} fullWidth maxWidth="xl">
        <DialogTitle>Rifinisci lo schema d’impianto</DialogTitle>
        <DialogContent dividers sx={{ height: '75vh', p: 0 }}>
          {layout && (
            <SchemaEditor
              layout={layout}
              noteTubazioni={note}
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
