import { useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, MenuItem, Select, Tooltip, Typography,
} from '@mui/material'
import {
  CloudUpload as UploadIcon, Delete as DeleteIcon, PictureAsPdf as PdfIcon,
  Image as ImageIcon, AutoAwesome as AutoIcon,
} from '@mui/icons-material'
import { radii } from '@/theme/tokens'
import { classificaDocumenti } from '@/services/fascicolo/classifica'
import { componiFascicolo, LIMITE_BYTE } from '@/services/fascicolo/componiPdf'
import { ordinaFascicolo, ruoliPrevisti } from '@/services/fascicolo/ordina'
import {
  ORDINE_RUOLI, etichettaRuolo,
  type ContestoFascicolo, type DocumentoFascicolo, type RuoloDocumento,
} from '@/services/fascicolo/types'

export interface FascicoloSectionProps {
  contesto: ContestoFascicolo
  /** Nome del file da scaricare, già composto dal codice pratica. */
  nomeFile: string
  documenti: DocumentoFascicolo[]
  onCambia: (documenti: DocumentoFascicolo[]) => void
}

const ACCETTATI = 'image/*,.pdf,application/pdf'

const peso = (byte: number) => `${(byte / 1024 / 1024).toFixed(1)} MB`

const eUnImmagine = (file: File) =>
  file.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp|heic|tiff?)$/i.test(file.name)

/** Esito della generazione, da mostrare finché non si tocca di nuovo l'elenco. */
interface Esito {
  pagine: number
  byte: number
  sottoLimite: boolean
  ridotti: string[]
  scartati: { etichetta: string; motivo: string }[]
  mancanti: RuoloDocumento[]
}

/**
 * Caricamento dei documenti e generazione del fascicolo, nel piede della finestra
 * dell'apparecchiatura.
 *
 * Qui dentro si trascina **tutto** il corredo: certificati e istruzioni dell'apparecchiatura,
 * della sua valvola di sicurezza e dell'apparecchiatura principale che la contiene, più le foto
 * delle targhette. Il sistema riconosce che cos'è ciascun file, li dispone nell'ordine prescritto
 * e li rilega in un PDF unico in formato A4.
 *
 * I file restano in memoria per la durata della pagina: si caricano, si genera, si scarica.
 * Ricaricando la pagina si ricomincia — è la conseguenza voluta del non archiviarli.
 */
export const FascicoloSection = ({ contesto, nomeFile, documenti, onCambia }: FascicoloSectionProps) => {
  const [stato, setStato] = useState<'pronto' | 'analisi' | 'generazione'>('pronto')
  const [avanzamento, setAvanzamento] = useState('')
  const [avviso, setAvviso] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [esito, setEsito] = useState<Esito | null>(null)
  const [sopra, setSopra] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const previsti = ruoliPrevisti(contesto)
  const lavorando = stato !== 'pronto'

  const aggiungi = async (files: FileList | File[]) => {
    const nuovi: DocumentoFascicolo[] = Array.from(files)
      .filter((f) => eUnImmagine(f) || f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
      .map((file, i) => ({
        id: `${Date.now()}-${i}-${file.name}`,
        file,
        ruoli: [],
      }))

    if (nuovi.length === 0) {
      setErrore('Si possono caricare solo PDF e immagini.')
      return
    }

    setErrore(null)
    setEsito(null)
    const conNuovi = [...documenti, ...nuovi]
    onCambia(conNuovi)

    // La classificazione riguarda l'insieme: due certificati si distinguono l'uno dall'altro,
    // quindi si rianalizza tutto, non solo ciò che è appena arrivato.
    setStato('analisi')
    setAvanzamento('Riconoscimento dei documenti…')
    try {
      const { risultati, avviso: nota } = await classificaDocumenti(
        conNuovi.map((d) => ({ id: d.id, file: d.file })),
        contesto
      )
      const perId = new Map(risultati.map((r) => [r.id, r]))
      onCambia(conNuovi.map((d) => {
        const r = perId.get(d.id)
        return r ? { ...d, ruoli: r.ruoli, valvola: r.valvola, confidenza: r.confidenza, motivazione: r.motivazione, origine: r.origine } : d
      }))
      setAvviso(nota ?? null)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Riconoscimento non riuscito')
    } finally {
      setStato('pronto')
      setAvanzamento('')
    }
  }

  const rimuovi = (id: string) => {
    setEsito(null)
    onCambia(documenti.filter((d) => d.id !== id))
  }

  const assegna = (id: string, ruoli: RuoloDocumento[]) => {
    setEsito(null)
    onCambia(documenti.map((d) => (d.id === id ? { ...d, ruoli, origine: 'manuale' } : d)))
  }

  const genera = async () => {
    setErrore(null)
    setStato('generazione')
    try {
      const { sequenza, mancanti } = ordinaFascicolo(documenti, contesto)
      const composto = await componiFascicolo(
        sequenza.map((d) => ({
          file: d.file,
          etichetta: d.file.name,
          foto: d.ruoli.some((r) => r === 'FOTO_TARGHETTA' || r === 'FOTO_TARGHETTA_PRINCIPALE'),
        })),
        { onProgresso: setAvanzamento }
      )

      saveAs(composto.blob, nomeFile)
      setEsito({ ...composto, mancanti })
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Generazione non riuscita')
    } finally {
      setStato('pronto')
      setAvanzamento('')
    }
  }

  const classificati = documenti.filter((d) => d.ruoli.length > 0).length

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography
          component="span"
          sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'text.disabled' }}
        >
          Fascicolo
        </Typography>
        <Typography variant="caption" color="text.disabled">
          certificati, istruzioni e foto targhetta di questa apparecchiatura, della sua valvola e
          dell’apparecchiatura che la contiene
        </Typography>
      </Box>

      {/* Area di trascinamento. Fa anche da elenco quando i file ci sono: tenerli separati
          costringerebbe a scorrere per tornare al punto in cui si aggiunge. */}
      <Box
        onDragOver={(e) => { e.preventDefault(); setSopra(true) }}
        onDragLeave={() => setSopra(false)}
        onDrop={(e) => { e.preventDefault(); setSopra(false); if (!lavorando) aggiungi(e.dataTransfer.files) }}
        onClick={() => !lavorando && inputRef.current?.click()}
        sx={{
          border: '1px dashed', borderRadius: `${radii.control}px`,
          borderColor: sopra ? 'primary.main' : 'divider',
          bgcolor: sopra ? 'action.hover' : 'transparent',
          px: 1.5, py: documenti.length ? 1 : 2,
          cursor: lavorando ? 'default' : 'pointer',
          transition: 'border-color .15s, background-color .15s',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept={ACCETTATI}
          onChange={(e) => { if (e.target.files) aggiungi(e.target.files); e.target.value = '' }}
        />

        {documenti.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary' }}>
            <UploadIcon fontSize="small" />
            <Typography variant="body2">Trascina qui i documenti, o fai clic per sceglierli</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
            {documenti.map((d) => (
              <Box key={d.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                {eUnImmagine(d.file)
                  ? <ImageIcon fontSize="small" sx={{ color: 'text.disabled', flex: 'none' }} />
                  : <PdfIcon fontSize="small" sx={{ color: 'text.disabled', flex: 'none' }} />}

                <Tooltip title={d.motivazione || ''} placement="top-start">
                  <Typography
                    variant="body2"
                    noWrap
                    sx={{ flex: '1 1 30%', minWidth: 0, color: d.ruoli.length ? 'text.primary' : 'warning.main' }}
                  >
                    {d.file.name}
                  </Typography>
                </Tooltip>

                <Typography variant="caption" color="text.disabled" sx={{ flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
                  {peso(d.file.size)}
                </Typography>

                {/* Il ruolo assegnato resta modificabile: la classificazione è una proposta,
                    e un fascicolo sbagliato costa più di un menu in più. */}
                <Select
                  size="small"
                  variant="standard"
                  disableUnderline
                  multiple
                  displayEmpty
                  value={d.ruoli}
                  onChange={(e) => assegna(d.id, e.target.value as RuoloDocumento[])}
                  renderValue={(scelti) =>
                    scelti.length === 0
                      ? <Typography component="span" variant="caption" color="warning.main">da assegnare</Typography>
                      : <Typography component="span" variant="caption" noWrap>{scelti.map((r) => etichettaRuolo(r, contesto)).join(' + ')}</Typography>
                  }
                  sx={{ flex: '1 1 45%', minWidth: 0, '& .MuiSelect-select': { py: 0.25 } }}
                >
                  {ORDINE_RUOLI.map((r) => (
                    <MenuItem key={r} value={r} dense sx={{ fontSize: '0.8rem' }}>
                      {etichettaRuolo(r, contesto)}
                      {!previsti.includes(r) && (
                        <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: 0.75 }}>
                          (non previsto)
                        </Typography>
                      )}
                    </MenuItem>
                  ))}
                </Select>

                {d.origine === 'ai' && (
                  <Tooltip title={d.motivazione || 'Riconosciuto automaticamente'}>
                    <AutoIcon sx={{ fontSize: 14, color: 'text.disabled', flex: 'none' }} />
                  </Tooltip>
                )}

                <IconButton size="small" onClick={() => rimuovi(d.id)} disabled={lavorando} aria-label={`Togli ${d.file.name}`}>
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            ))}

            <Button
              size="small"
              startIcon={<UploadIcon sx={{ fontSize: 16 }} />}
              onClick={() => inputRef.current?.click()}
              disabled={lavorando}
              sx={{ alignSelf: 'flex-start', mt: 0.25 }}
            >
              Aggiungi altri
            </Button>
          </Box>
        )}
      </Box>

      {lavorando && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">{avanzamento}</Typography>
        </Box>
      )}

      {avviso && <Alert severity="warning" sx={{ py: 0.25 }}>{avviso}</Alert>}
      {errore && <Alert severity="error" sx={{ py: 0.25 }} onClose={() => setErrore(null)}>{errore}</Alert>}

      {esito && (
        <Alert severity={esito.sottoLimite ? 'success' : 'warning'} sx={{ py: 0.25 }}>
          Fascicolo di {esito.pagine} pagine, {peso(esito.byte)}
          {!esito.sottoLimite && ` — oltre il limite di ${peso(LIMITE_BYTE)}`}.
          {esito.mancanti.length > 0 && ` Mancano: ${esito.mancanti.map((r) => etichettaRuolo(r, contesto)).join('; ')}.`}
          {esito.ridotti.length > 0 && ` Ridotti per rientrare nel peso: ${esito.ridotti.join(', ')}.`}
          {esito.scartati.length > 0 && ` Non leggibili: ${esito.scartati.map((s) => s.etichetta).join(', ')}.`}
        </Alert>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="outlined"
          color="primary"
          startIcon={stato === 'generazione' ? <CircularProgress size={14} color="inherit" /> : <PdfIcon />}
          onClick={genera}
          disabled={lavorando || classificati === 0}
          sx={{ borderColor: 'primary.main' }}
        >
          Genera fascicolo
        </Button>

        {documenti.length > 0 && (
          <Chip
            size="small"
            variant="outlined"
            color={classificati === documenti.length ? 'default' : 'warning'}
            label={`${classificati} di ${documenti.length} riconosciuti`}
            sx={{ height: 20, fontSize: '0.68rem' }}
          />
        )}

        <Typography variant="caption" color="text.disabled" sx={{ minWidth: 0 }}>
          I file restano solo per questa sessione: ricaricando la pagina vanno ricaricati.
        </Typography>
      </Box>
    </Box>
  )
}
