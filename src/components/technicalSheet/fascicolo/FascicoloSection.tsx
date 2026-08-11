import { useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, MenuItem, Select, Tooltip, Typography,
} from '@mui/material'
import {
  CloudUpload as UploadIcon, Delete as DeleteIcon, PictureAsPdf as PdfIcon,
  Image as ImageIcon, AutoAwesome as AutoIcon, Download as DownloadIcon,
} from '@mui/icons-material'
import { radii } from '@/theme/tokens'
import { classificaDocumenti } from '@/services/fascicolo/classifica'
import { componiFascicolo, LIMITE_BYTE } from '@/services/fascicolo/componiPdf'
import { ordinaFascicolo, ruoliPrevisti } from '@/services/fascicolo/ordina'
import { statoScadenza, type MovimentoPratica } from '@/services/fascicolo/scadenza'
import {
  ORDINE_RUOLI, etichettaRuolo,
  type ContestoFascicolo, type DocumentoFascicolo, type RuoloDocumento,
} from '@/services/fascicolo/types'
import { fascicoloDocumentiApi, TETTO_BYTE_APPARECCHIATURA } from '@/services/api/fascicoloDocumenti'
import { apriDocumento, eUnImmagine } from '@/services/fascicolo/sorgente'

export interface FascicoloSectionProps {
  contesto: ContestoFascicolo
  /** Nome del file da scaricare, già composto dal codice pratica. */
  nomeFile: string
  requestId: string
  codice: string
  /** Stato e date della pratica: da qui si ricava quando i documenti verranno cancellati. */
  movimenti?: MovimentoPratica
}

const ACCETTATI = 'image/*,.pdf,application/pdf'

const peso = (byte: number) => `${(byte / 1024 / 1024).toFixed(1)} MB`

const dataItaliana = (iso: string) => new Date(iso).toLocaleDateString('it-IT')

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
 * Riga di un documento sorgente nell'elenco: icona, nome, peso, ruolo assegnabile e cestino.
 *
 * Componente a sé perché la riga porta la parte più densa della sezione — il selettore multiplo
 * dei ruoli, col suo `renderValue` — e isolarla tiene il corpo di `FascicoloSection` leggibile.
 */
const RigaDocumento = ({ doc, contesto, previsti, disabilitato, onAssegna, onRimuovi }: {
  doc: DocumentoFascicolo
  contesto: ContestoFascicolo
  previsti: RuoloDocumento[]
  disabilitato: boolean
  onAssegna: (ruoli: RuoloDocumento[]) => void
  onRimuovi: () => void
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
    {eUnImmagine(doc)
      ? <ImageIcon fontSize="small" sx={{ color: 'text.disabled', flex: 'none' }} />
      : <PdfIcon fontSize="small" sx={{ color: 'text.disabled', flex: 'none' }} />}

    <Tooltip title={doc.motivazione || ''} placement="top-start">
      <Typography
        variant="body2"
        noWrap
        sx={{ flex: '1 1 30%', minWidth: 0, color: doc.ruoli.length ? 'text.primary' : 'warning.main' }}
      >
        {doc.nome}
      </Typography>
    </Tooltip>

    <Typography variant="caption" color="text.disabled" sx={{ flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
      {peso(doc.peso)}
    </Typography>

    {/* Il ruolo assegnato resta modificabile: la classificazione è una proposta,
        e un fascicolo sbagliato costa più di un menu in più. */}
    <Select
      size="small"
      variant="standard"
      disableUnderline
      multiple
      displayEmpty
      value={doc.ruoli}
      onChange={(e) => onAssegna(e.target.value as RuoloDocumento[])}
      renderValue={(scelti) =>
        scelti.length === 0
          ? <Typography component="span" variant="caption" color="warning.main">da assegnare</Typography>
          : <Typography component="span" variant="caption" color="text.secondary" noWrap>
            {scelti.map((r) => etichettaRuolo(r, contesto)).join(' + ')}
          </Typography>
      }
      // Il nome del file è ciò che il tecnico riconosce, il ruolo è ciò che il
      // sistema propone: il primo pesa, il secondo si legge accanto.
      sx={{ flex: '1 1 45%', minWidth: 0, fontWeight: 400, '& .MuiSelect-select': { py: 0.25 } }}
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

    {/* Lo spazio del segno resta occupato anche quando il segno non c'è: senza,
        le righe riconosciute a mano disallineerebbero menu e cestino. */}
    <Box sx={{ width: 16, flex: 'none', display: 'flex', justifyContent: 'center' }}>
      {doc.origine === 'ai' && (
        <Tooltip title={doc.motivazione || 'Riconosciuto automaticamente'}>
          <AutoIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        </Tooltip>
      )}
    </Box>

    <IconButton size="small" onClick={onRimuovi} disabled={disabilitato} aria-label={`Togli ${doc.nome}`}>
      <DeleteIcon sx={{ fontSize: 16 }} />
    </IconButton>
  </Box>
)

/**
 * Caricamento dei documenti e generazione del fascicolo, nel piede della finestra
 * dell'apparecchiatura.
 *
 * Qui dentro si trascina **tutto** il corredo: certificati e istruzioni dell'apparecchiatura,
 * della sua valvola di sicurezza e dell'apparecchiatura principale che la contiene, più le foto
 * delle targhette. Il sistema riconosce che cos'è ciascun file, li dispone nell'ordine prescritto
 * e li rilega in un PDF unico in formato A4.
 *
 * I documenti si salvano non appena caricati (bucket `fascicoli` + tabella
 * `fascicolo_documenti`): ricaricando la pagina, o riaprendo la scheda un altro giorno, restano
 * al loro posto coi ruoli già assegnati. Non per sempre, però: scadono da soli — l'avviso e la
 * data qui sotto vengono dalla stessa regola che di notte li cancella davvero.
 */
export const FascicoloSection = ({ contesto, nomeFile, requestId, codice, movimenti }: FascicoloSectionProps) => {
  const queryClient = useQueryClient()
  const chiave = ['fascicolo-documenti', requestId, codice]

  const { data: documenti = [], isLoading } = useQuery({
    queryKey: chiave,
    queryFn: () => fascicoloDocumentiApi.elenca(requestId, codice),
    enabled: Boolean(requestId && codice),
  })

  const { data: scadenza } = useQuery({
    queryKey: ['fascicolo-scadenza', requestId, codice],
    queryFn: () => fascicoloDocumentiApi.scadenzaDi(requestId, codice),
    enabled: Boolean(requestId && codice),
  })

  const ricarica = () => {
    queryClient.invalidateQueries({ queryKey: chiave })
    queryClient.invalidateQueries({ queryKey: ['fascicolo-scadenza', requestId, codice] })
  }

  const [stato, setStato] = useState<'pronto' | 'analisi' | 'generazione'>('pronto')
  const [avanzamento, setAvanzamento] = useState('')
  const [avviso, setAvviso] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [esito, setEsito] = useState<Esito | null>(null)
  const [sopra, setSopra] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const previsti = ruoliPrevisti(contesto)
  const lavorando = stato !== 'pronto'
  const bloccato = lavorando || isLoading

  const aggiungi = async (files: FileList | File[]) => {
    const accettati = Array.from(files).filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf' || /\.(pdf|jpe?g|png|gif|webp|bmp|heic|tiff?)$/i.test(f.name)
    )
    if (accettati.length === 0) {
      setErrore('Si possono caricare solo PDF e immagini.')
      return
    }

    setErrore(null)
    setEsito(null)
    setAvviso(null)
    setStato('analisi')
    setAvanzamento('Caricamento dei documenti…')

    try {
      // Un file alla volta, e si prosegue anche se uno fallisce: un allegato troppo
      // pesante o una connessione che cade non devono far perdere quelli già saliti.
      const caricati: DocumentoFascicolo[] = []
      const fileCaricati: File[] = []
      const nonCaricati: string[] = []
      for (const file of accettati) {
        try {
          const doc = await fascicoloDocumentiApi.carica({ requestId, codice, file })
          caricati.push(doc)
          fileCaricati.push(file)
        } catch (e) {
          nonCaricati.push(`${file.name} (${e instanceof Error ? e.message : 'errore sconosciuto'})`)
        }
      }

      if (caricati.length === 0) {
        setErrore(`Caricamento non riuscito: ${nonCaricati.join('; ')}`)
        return
      }
      ricarica()

      // Si classificano solo i file nuovi: rianalizzare l'insieme cancellerebbe le correzioni
      // fatte a mano sui documenti già salvati, oltre a riscaricarli e ripagare l'analisi.
      // `documenti` è lo stato di prima di questo caricamento (la chiusura non vede il
      // `ricarica()` di poco fa): i soli documenti già salvati e già classificati, esclusi il
      // fascicolo composto e i file appena saliti che non hanno ancora un ruolo.
      const giaCoperti = documenti
        .filter((d) => d.tipo !== 'fascicolo' && d.ruoli.length > 0)
        .map((d) => ({ nome: d.nome, ruoli: d.ruoli, valvola: d.valvola ?? null }))

      const { risultati, avviso: nota } = await classificaDocumenti(
        caricati.map((d, i) => ({ id: d.id, file: fileCaricati[i] })),
        contesto,
        giaCoperti
      )

      for (const r of risultati) {
        await fascicoloDocumentiApi.aggiornaClassificazione(r.id, {
          ruoli: r.ruoli, valvola: r.valvola, confidenza: r.confidenza,
          motivazione: r.motivazione, origine: r.origine,
        })
      }
      ricarica()

      setAvviso(
        [nota, nonCaricati.length ? `Non caricati: ${nonCaricati.join('; ')}` : null]
          .filter(Boolean)
          .join(' ') || null
      )
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Caricamento non riuscito')
    } finally {
      setStato('pronto')
      setAvanzamento('')
    }
  }

  const rimuovi = async (id: string) => {
    setEsito(null)
    try {
      await fascicoloDocumentiApi.elimina(id)
      ricarica()
    } catch (e) {
      // `elimina` non tocca la riga se lo storage rifiuta la rimozione: l'utente deve
      // saperlo, non vedere sparire un documento che in realtà è ancora lì.
      setErrore(e instanceof Error ? e.message : 'Eliminazione non riuscita')
    }
  }

  const assegna = async (id: string, ruoli: RuoloDocumento[]) => {
    setEsito(null)
    const doc = documenti.find((d) => d.id === id)
    try {
      await fascicoloDocumentiApi.aggiornaClassificazione(id, {
        ruoli, valvola: doc?.valvola, confidenza: doc?.confidenza,
        motivazione: doc?.motivazione, origine: 'manuale',
      })
      ricarica()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Assegnazione non riuscita')
    }
  }

  const genera = async () => {
    setErrore(null)
    setStato('generazione')
    try {
      const sorgenti = documenti.filter((d) => d.tipo !== 'fascicolo')
      const { sequenza, mancanti } = ordinaFascicolo(sorgenti, contesto)

      setAvanzamento('Lettura dei documenti…')
      const pagine = await Promise.all(
        sequenza.map(async (d) => ({
          file: await apriDocumento(d),
          etichetta: d.nome,
          foto: d.ruoli.some((r) => r === 'FOTO_TARGHETTA' || r === 'FOTO_TARGHETTA_PRINCIPALE'),
        }))
      )

      const composto = await componiFascicolo(pagine, { onProgresso: setAvanzamento })
      saveAs(composto.blob, nomeFile)

      // Si carica il nuovo fascicolo prima di eliminare il vecchio, non dopo: se `carica`
      // fallisse a valle di un `elimina` già riuscito, l'apparecchiatura resterebbe senza
      // fascicolo salvato pur avendone avuto uno — un buco silenzioso che l'utente non vede
      // finché non riapre la scheda. Con questo ordine il caso peggiore è per un istante un
      // fascicolo di troppo, mai uno di meno: un documento in più si vede e si toglie, uno in
      // meno sparisce senza avviso. `vecchio` va cercato ora, sull'elenco di partenza — dopo il
      // caricamento conterrebbe anche il fascicolo appena salito, ed è quello che non va toccato.
      const vecchio = documenti.find((d) => d.tipo === 'fascicolo')
      await fascicoloDocumentiApi.carica({
        requestId, codice, tipo: 'fascicolo',
        file: new File([composto.blob], nomeFile, { type: 'application/pdf' }),
      })
      if (vecchio) await fascicoloDocumentiApi.elimina(vecchio.id)
      ricarica()

      setEsito({ ...composto, mancanti })
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Generazione non riuscita')
    } finally {
      setStato('pronto')
      setAvanzamento('')
    }
  }

  /** Riscarica un documento già salvato — tipicamente il fascicolo generato in precedenza. */
  const scarica = async (doc: DocumentoFascicolo) => {
    try {
      const file = await apriDocumento(doc)
      saveAs(file, doc.nome)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Scaricamento non riuscito')
    }
  }

  const sorgentiElenco = documenti.filter((d) => d.tipo !== 'fascicolo')
  const fascicoloGenerato = documenti.find((d) => d.tipo === 'fascicolo')
  const classificati = sorgentiElenco.filter((d) => d.ruoli.length > 0).length

  const occupati = documenti.reduce((somma, d) => somma + d.peso, 0)
  const sopraSoglia = occupati > TETTO_BYTE_APPARECCHIATURA * 0.8

  // Quando i documenti vivono ancora, la scadenza si sa per certo solo conoscendo stato e date
  // della pratica: senza `movimenti` (un istante, mentre la pagina li sta ancora caricando) non
  // si mostra nulla piuttosto che una data calcolata su dati parziali.
  const scadenzaCorrente = movimenti && documenti.length > 0 ? statoScadenza(movimenti, new Date()) : null

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

      {documenti.length === 0 && scadenza && (
        <Alert severity="info" sx={{ py: 0.25 }}>
          Fascicolo scaduto il {dataItaliana(scadenza.purgato_il)}: {scadenza.n_file} file
          cancellati. Ricaricali per ricomporlo.
        </Alert>
      )}

      {/* Area di trascinamento e, sotto, quando la scadenza si sa, la data in cui i documenti
          spariranno: le si tiene vicine perché raccontano la stessa cosa — quanto a lungo
          resta ciò che si vede sopra. */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box
          onDragOver={(e) => { e.preventDefault(); if (!bloccato) setSopra(true) }}
          onDragLeave={() => setSopra(false)}
          onDrop={(e) => { e.preventDefault(); setSopra(false); if (!bloccato) aggiungi(e.dataTransfer.files) }}
          onClick={() => !bloccato && inputRef.current?.click()}
          sx={{
            border: '1px dashed', borderRadius: `${radii.control}px`,
            borderColor: sopra ? 'primary.main' : 'divider',
            bgcolor: sopra ? 'action.hover' : 'transparent',
            px: 1.5, py: documenti.length ? 1 : 2,
            cursor: bloccato ? 'default' : 'pointer',
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

          {isLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary' }}>
              <CircularProgress size={14} />
              <Typography variant="body2">Lettura dei documenti salvati…</Typography>
            </Box>
          ) : documenti.length === 0 ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary' }}>
              <UploadIcon fontSize="small" />
              <Typography variant="body2">Trascina qui i documenti, o fai clic per sceglierli</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }} onClick={(e) => e.stopPropagation()}>
              {sorgentiElenco.map((d) => (
                <RigaDocumento
                  key={d.id}
                  doc={d}
                  contesto={contesto}
                  previsti={previsti}
                  disabilitato={lavorando}
                  onAssegna={(ruoli) => assegna(d.id, ruoli)}
                  onRimuovi={() => rimuovi(d.id)}
                />
              ))}

              {fascicoloGenerato && (
                <Box key={fascicoloGenerato.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, pt: 0.75, borderTop: '1px solid', borderColor: 'divider' }}>
                  <PdfIcon fontSize="small" sx={{ color: 'primary.main', flex: 'none' }} />
                  <Typography variant="body2" noWrap sx={{ flex: '1 1 auto', minWidth: 0 }}>
                    {fascicoloGenerato.nome}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
                    {peso(fascicoloGenerato.peso)}
                  </Typography>
                  <IconButton size="small" onClick={() => scarica(fascicoloGenerato)} aria-label={`Scarica ${fascicoloGenerato.nome}`}>
                    <DownloadIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton size="small" onClick={() => rimuovi(fascicoloGenerato.id)} disabled={lavorando} aria-label={`Togli ${fascicoloGenerato.nome}`}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              )}

              <Button
                size="small"
                startIcon={<UploadIcon sx={{ fontSize: 16 }} />}
                onClick={() => inputRef.current?.click()}
                disabled={bloccato}
                sx={{ alignSelf: 'flex-start', mt: 0.25 }}
              >
                Aggiungi altri
              </Button>
            </Box>
          )}
        </Box>

        {scadenzaCorrente && (
          <Typography
            variant="caption"
            color={scadenzaCorrente.inPreavviso ? 'warning.main' : 'text.disabled'}
            sx={{ fontWeight: scadenzaCorrente.inPreavviso ? 600 : 400, px: 0.25 }}
          >
            {scadenzaCorrente.inPreavviso
              ? `Attenzione: questi documenti verranno cancellati fra ${scadenzaCorrente.giorniMancanti} giorni, il ${scadenzaCorrente.data.toLocaleDateString('it-IT')}.`
              : `I documenti verranno cancellati il ${scadenzaCorrente.data.toLocaleDateString('it-IT')}.`}
          </Typography>
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
          disabled={bloccato || classificati === 0}
          sx={{ borderColor: 'primary.main' }}
        >
          Genera fascicolo
        </Button>

        {sorgentiElenco.length > 0 && (
          <Chip
            size="small"
            variant="outlined"
            color={classificati === sorgentiElenco.length ? 'default' : 'warning'}
            label={`${classificati} di ${sorgentiElenco.length} riconosciuti`}
            sx={{ height: 20, fontSize: '0.68rem' }}
          />
        )}

        <Typography variant="caption" color={sopraSoglia ? 'warning.main' : 'text.disabled'} sx={{ minWidth: 0, ml: 'auto' }}>
          {`${peso(occupati)} di ${peso(TETTO_BYTE_APPARECCHIATURA)}`}
        </Typography>
      </Box>
    </Box>
  )
}
