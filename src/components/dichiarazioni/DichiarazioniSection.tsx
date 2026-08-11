/**
 * Caricamento manuale dei documenti sorgente (dichiarazione marca da bollo, attestazione,
 * documento d'identità dell'utilizzatore), generazione della dichiarazione installatore e
 * composizione del PDF finale a 5 parti.
 *
 * L'assegnazione dei ruoli è **manuale**: questi documenti contengono dati personali sensibili
 * (carte d'identità, firme, codici fiscali) e non vanno mai inviati a un servizio esterno per
 * la classificazione — a differenza del fascicolo apparecchiatura. Le anteprime pagina-per-
 * pagina si generano interamente in locale (pdf.js/canvas).
 *
 * ⚠️ Da verificare nell'app in esecuzione (UI non coperta dai test unitari).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, CircularProgress, IconButton, Typography } from '@mui/material'
import { CloudUpload as UploadIcon, Delete as DeleteIcon, PictureAsPdf as PdfIcon, Download as DownloadIcon } from '@mui/icons-material'
import { radii } from '@/theme/tokens'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import { statoScadenza, type MovimentoPratica } from '@/services/dichiarazioni/scadenza'
import type { RuoloDichiarazione } from '@/services/dichiarazioni/tipi'
import { dichiarazioniDocumentiApi } from '@/services/api/dichiarazioniDocumenti'
import { apriDocumentoDichiarazione, eUnImmagineDichiarazione } from '@/services/dichiarazioni/sorgente'
import { generaAnteprime } from '@/services/dichiarazioni/anteprima'
import { estraiPagina } from '@/services/dichiarazioni/estraiPagine'
import { assemblaDichiarazioni, type FontePagina } from '@/services/dichiarazioni/assembla'
import { generaDichiarazioneInstallatore } from '@/services/dichiarazioni/installatore'
import { installersApi } from '@/services/api/installers'
import { PaginaMiniatura } from './PaginaMiniatura'

export interface DichiarazioniSectionProps {
  requestId: string
  scheda: SchedaDatiCompleta
  customerName: string
  /** Indirizzo del sito produttivo, già risolto (uguale a sede legale o indirizzo dichiarato). */
  sitoProduttivo: string
  /** Nome del file da scaricare, già composto dal codice pratica. */
  nomeFile: string
  movimenti?: MovimentoPratica
}

const ACCETTATI = 'image/*,.pdf,application/pdf'

const peso = (byte: number) => `${(byte / 1024 / 1024).toFixed(1)} MB`
const dataItaliana = (iso: string) => new Date(iso).toLocaleDateString('it-IT')
const oggiItaliano = () => new Date().toLocaleDateString('it-IT')

interface PaginaVista {
  sorgenteId: string
  sorgenteNome: string
  pagina: number
  ruolo: RuoloDichiarazione | null
  ordine: number
  anteprimaUrl: string | null
}

export const DichiarazioniSection = ({ requestId, scheda, customerName, sitoProduttivo, nomeFile, movimenti }: DichiarazioniSectionProps) => {
  const queryClient = useQueryClient()
  const chiaveSorgenti = ['dichiarazioni-sorgenti', requestId]
  const chiaveOverride = ['dichiarazioni-override-id', requestId]
  const chiaveFinale = ['dichiarazioni-finale', requestId]
  const chiaveScadenza = ['dichiarazioni-scadenza', requestId]

  const { data: sorgenti = [], isLoading } = useQuery({
    queryKey: chiaveSorgenti,
    queryFn: () => dichiarazioniDocumentiApi.elencaSorgenti(requestId),
    enabled: Boolean(requestId),
  })
  const { data: override = null } = useQuery({
    queryKey: chiaveOverride,
    queryFn: () => dichiarazioniDocumentiApi.overrideIdInstallatore(requestId),
    enabled: Boolean(requestId),
  })
  const { data: finale = null } = useQuery({
    queryKey: chiaveFinale,
    queryFn: () => dichiarazioniDocumentiApi.ultimoFinale(requestId),
    enabled: Boolean(requestId),
  })
  const { data: scadenza } = useQuery({
    queryKey: chiaveScadenza,
    queryFn: () => dichiarazioniDocumentiApi.scadenzaDi(requestId),
    enabled: Boolean(requestId),
  })

  const ricarica = () => {
    queryClient.invalidateQueries({ queryKey: chiaveSorgenti })
    queryClient.invalidateQueries({ queryKey: chiaveOverride })
    queryClient.invalidateQueries({ queryKey: chiaveFinale })
    queryClient.invalidateQueries({ queryKey: chiaveScadenza })
  }

  const [stato, setStato] = useState<'pronto' | 'caricamento' | 'generazione'>('pronto')
  const [avanzamento, setAvanzamento] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [esito, setEsito] = useState<{ pagine: number; byte: number; sottoLimite: boolean } | null>(null)
  const [sopra, setSopra] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const inputOverrideRef = useRef<HTMLInputElement>(null)

  // Anteprime generate localmente, una volta per sorgente: mai inviate altrove.
  const [anteprime, setAnteprime] = useState<Record<string, string[]>>({})
  useEffect(() => {
    let annullato = false
    const daGenerare = sorgenti.filter((s) => !anteprime[s.id])
    if (daGenerare.length === 0) return
    ;(async () => {
      for (const s of daGenerare) {
        try {
          const file = await apriDocumentoDichiarazione(s)
          const pagine = await generaAnteprime(file)
          if (!annullato) setAnteprime((prev) => ({ ...prev, [s.id]: pagine.map((p) => p.url) }))
        } catch {
          // Un'anteprima mancante non blocca l'assegnazione: la pagina resta selezionabile,
          // solo senza immagine.
          if (!annullato) setAnteprime((prev) => ({ ...prev, [s.id]: [] }))
        }
      }
    })()
    return () => { annullato = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorgenti])

  const bloccato = stato !== 'pronto' || isLoading

  const pagineTutte = useMemo<PaginaVista[]>(
    () =>
      sorgenti.flatMap((s) =>
        Array.from({ length: s.nPagine ?? 1 }, (_, i) => {
          const assegnazione = s.assegnazioni.find((a) => a.pagina === i)
          return {
            sorgenteId: s.id,
            sorgenteNome: s.nome,
            pagina: i,
            ruolo: assegnazione?.ruolo ?? null,
            ordine: assegnazione?.ordine ?? 0,
            anteprimaUrl: anteprime[s.id]?.[i] ?? null,
          }
        })
      ),
    [sorgenti, anteprime]
  )

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
    setStato('caricamento')
    try {
      const nonCaricati: string[] = []
      for (const file of accettati) {
        try {
          const nPagine = eUnImmagineDichiarazione({ nome: file.name, mime: file.type })
            ? 1
            : (await generaAnteprime(file)).length
          await dichiarazioniDocumentiApi.caricaSorgente({ requestId, file, nPagine })
        } catch (e) {
          nonCaricati.push(`${file.name} (${e instanceof Error ? e.message : 'errore sconosciuto'})`)
        }
      }
      ricarica()
      if (nonCaricati.length) setErrore(`Non caricati: ${nonCaricati.join('; ')}`)
    } finally {
      setStato('pronto')
    }
  }

  const rimuoviSorgente = async (id: string) => {
    setEsito(null)
    try {
      await dichiarazioniDocumentiApi.elimina(id)
      ricarica()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Eliminazione non riuscita')
    }
  }

  const prossimoOrdine = (ruolo: RuoloDichiarazione) =>
    Math.max(-1, ...pagineTutte.filter((p) => p.ruolo === ruolo).map((p) => p.ordine)) + 1

  const assegnaRuolo = async (sorgenteId: string, pagina: number, ruolo: RuoloDichiarazione | null) => {
    const sorgente = sorgenti.find((s) => s.id === sorgenteId)
    if (!sorgente) return
    const nuove = [
      ...sorgente.assegnazioni.filter((a) => a.pagina !== pagina),
      ...(ruolo ? [{ pagina, ruolo, ordine: prossimoOrdine(ruolo) }] : []),
    ]
    try {
      await dichiarazioniDocumentiApi.aggiornaAssegnazioni(sorgenteId, nuove)
      ricarica()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Assegnazione non riuscita')
    }
  }

  const sposta = async (ruolo: RuoloDichiarazione, indice: number, direzione: -1 | 1) => {
    const inRuolo = pagineTutte.filter((p) => p.ruolo === ruolo).sort((a, b) => a.ordine - b.ordine)
    const corrente = inRuolo[indice]
    const vicino = inRuolo[indice + direzione]
    if (!corrente || !vicino) return

    const cambi = [
      { sorgenteId: corrente.sorgenteId, pagina: corrente.pagina, nuovoOrdine: vicino.ordine },
      { sorgenteId: vicino.sorgenteId, pagina: vicino.pagina, nuovoOrdine: corrente.ordine },
    ]
    const perSorgente = new Map<string, typeof cambi>()
    for (const c of cambi) perSorgente.set(c.sorgenteId, [...(perSorgente.get(c.sorgenteId) ?? []), c])

    try {
      for (const [sorgenteId, cambiSorgente] of perSorgente) {
        const sorgente = sorgenti.find((s) => s.id === sorgenteId)!
        let nuove = sorgente.assegnazioni
        for (const c of cambiSorgente) {
          nuove = nuove.map((a) => (a.pagina === c.pagina ? { ...a, ordine: c.nuovoOrdine } : a))
        }
        await dichiarazioniDocumentiApi.aggiornaAssegnazioni(sorgenteId, nuove)
      }
      ricarica()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Riordino non riuscito')
    }
  }

  const caricaOverride = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setErrore(null)
    try {
      await dichiarazioniDocumentiApi.caricaOverrideIdInstallatore(requestId, file)
      ricarica()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Caricamento non riuscito')
    }
  }

  const rimuoviOverride = async () => {
    if (!override) return
    try {
      await dichiarazioniDocumentiApi.elimina(override.id)
      ricarica()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Eliminazione non riuscita')
    }
  }

  const genera = async () => {
    setErrore(null)
    setEsito(null)
    setStato('generazione')
    try {
      const assegnate = pagineTutte.filter((p) => p.ruolo !== null)
      if (assegnate.length === 0) {
        throw new Error('Assegna almeno una pagina a un ruolo prima di generare.')
      }

      setAvanzamento('Lettura dei dati installatore…')
      const installer = await installersApi.getPredefinito()
      if (!installer) throw new Error('Nessun installatore predefinito configurato.')
      const mancanti = (
        [
          ['legale_rappresentante', 'legale rappresentante'],
          ['legale_rappresentante_nascita_luogo', 'luogo di nascita del legale rappresentante'],
          ['legale_rappresentante_nascita_data', 'data di nascita del legale rappresentante'],
          ['legale_rappresentante_residenza_via', 'indirizzo di residenza del legale rappresentante'],
          ['legale_rappresentante_residenza_comune', 'comune di residenza del legale rappresentante'],
          ['legale_rappresentante_residenza_provincia', 'provincia di residenza del legale rappresentante'],
          ['posizione_inail', 'posizione I.N.A.I.L.'],
          ['telefono', 'telefono'],
          ['pec', 'PEC'],
        ] as const
      )
        .filter(([campo]) => !installer[campo])
        .map(([, etichetta]) => etichetta)
      if (mancanti.length > 0) {
        throw new Error(`L'installatore predefinito (${installer.nome}) non ha: ${mancanti.join(', ')}.`)
      }

      setAvanzamento('Generazione della dichiarazione installatore…')
      const [templateBytes, firma] = await Promise.all([
        fetch('/templates/dichiarazioni/dichiarazione-installatore-sfondo.pdf').then((r) => r.arrayBuffer()),
        fetch('/templates/dichiarazioni/timbroefirma.png').then((r) => r.arrayBuffer()),
      ])
      const dichiarazioneBytes = await generaDichiarazioneInstallatore({
        scheda,
        installer: {
          nome: installer.nome,
          legale_rappresentante: installer.legale_rappresentante!,
          legale_rappresentante_nascita_luogo: installer.legale_rappresentante_nascita_luogo!,
          legale_rappresentante_nascita_data: installer.legale_rappresentante_nascita_data!,
          legale_rappresentante_residenza_via: installer.legale_rappresentante_residenza_via!,
          legale_rappresentante_residenza_comune: installer.legale_rappresentante_residenza_comune!,
          legale_rappresentante_residenza_provincia: installer.legale_rappresentante_residenza_provincia!,
          partita_iva: installer.partita_iva,
          via: installer.via,
          numero_civico: installer.numero_civico,
          cap: installer.cap,
          comune: installer.comune,
          provincia: installer.provincia,
          posizione_inail: installer.posizione_inail!,
          telefono: installer.telefono!,
          pec: installer.pec!,
        },
        customer: { nome: customerName },
        sitoProduttivo,
        data: oggiItaliano(),
        templateBytes,
        firma,
      })
      const dichiarazioneFile = new File([dichiarazioneBytes.slice()], 'dichiarazione-installatore.pdf', { type: 'application/pdf' })

      setAvanzamento('Documento d’identità installatore…')
      const docIdInstallatoreFile = override
        ? await apriDocumentoDichiarazione(override)
        : new File(
            [await fetch('/templates/dichiarazioni/documento-identita-installatore-default.pdf').then((r) => r.blob())],
            'documento-identita-installatore.pdf',
            { type: 'application/pdf' }
          )

      setAvanzamento('Lettura dei documenti caricati…')
      const cacheFile = new Map<string, File>()
      const fontiSorgente: FontePagina[] = []
      for (const p of assegnate) {
        let fileCompleto = cacheFile.get(p.sorgenteId)
        if (!fileCompleto) {
          const sorgente = sorgenti.find((s) => s.id === p.sorgenteId)!
          fileCompleto = await apriDocumentoDichiarazione(sorgente)
          cacheFile.set(p.sorgenteId, fileCompleto)
        }
        const eImmagine = eUnImmagineDichiarazione({ nome: fileCompleto.name, mime: fileCompleto.type })
        const file = eImmagine ? fileCompleto : await estraiPagina(fileCompleto, p.pagina)
        fontiSorgente.push({ file, etichetta: `${p.sorgenteNome} (pag. ${p.pagina + 1})`, ruolo: p.ruolo!, ordine: p.ordine })
      }

      const composto = await assemblaDichiarazioni(
        { fontiSorgente, dichiarazioneInstallatore: dichiarazioneFile, documentoIdentitaInstallatore: docIdInstallatoreFile },
        { onProgresso: setAvanzamento }
      )
      saveAs(composto.blob, nomeFile)

      await dichiarazioniDocumentiApi.salvaFinale(requestId, new File([composto.blob], nomeFile, { type: 'application/pdf' }))
      ricarica()

      setEsito({ pagine: composto.pagine, byte: composto.byte, sottoLimite: composto.sottoLimite })
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Generazione non riuscita')
    } finally {
      setStato('pronto')
      setAvanzamento('')
    }
  }

  const scarica = async () => {
    if (!finale) return
    try {
      const file = await apriDocumentoDichiarazione(finale)
      saveAs(file, finale.nome)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Scaricamento non riuscito')
    }
  }

  const scadenzaCorrente = movimenti && sorgenti.length > 0 ? statoScadenza(movimenti, new Date()) : null
  const assegnate = pagineTutte.filter((p) => p.ruolo !== null).length

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
        <Typography
          component="span"
          sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'text.disabled' }}
        >
          Dichiarazioni
        </Typography>
        <Typography variant="caption" color="text.disabled">
          dichiarazione marca da bollo, attestazione e documento d’identità dell’utilizzatore —
          assegna manualmente ogni pagina caricata al suo ruolo
        </Typography>
      </Box>

      {sorgenti.length === 0 && scadenza && (
        <Alert severity="info" sx={{ py: 0.25 }}>
          Documenti scaduti il {dataItaliana(scadenza.purgato_il)}: {scadenza.n_file} file cancellati. Ricaricali per ricomporli.
        </Alert>
      )}

      <Box
        onDragOver={(e) => { e.preventDefault(); if (!bloccato) setSopra(true) }}
        onDragLeave={() => setSopra(false)}
        onDrop={(e) => { e.preventDefault(); setSopra(false); if (!bloccato) aggiungi(e.dataTransfer.files) }}
        onClick={() => !bloccato && inputRef.current?.click()}
        sx={{
          border: '1px dashed',
          borderRadius: `${radii.control}px`,
          borderColor: sopra ? 'primary.main' : 'divider',
          bgcolor: sopra ? 'action.hover' : 'transparent',
          px: 1.5,
          py: sorgenti.length ? 1 : 2,
          cursor: bloccato ? 'default' : 'pointer',
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
        ) : sorgenti.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary' }}>
            <UploadIcon fontSize="small" />
            <Typography variant="body2">
              Trascina qui bollo, attestazione e documento d’identità dell’utilizzatore, o fai clic per sceglierli
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} onClick={(e) => e.stopPropagation()}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {pagineTutte.map((p) => {
                const inRuolo = p.ruolo ? pagineTutte.filter((q) => q.ruolo === p.ruolo).sort((a, b) => a.ordine - b.ordine) : []
                const indice = inRuolo.findIndex((q) => q.sorgenteId === p.sorgenteId && q.pagina === p.pagina)
                return (
                  <PaginaMiniatura
                    key={`${p.sorgenteId}-${p.pagina}`}
                    anteprimaUrl={p.anteprimaUrl}
                    etichetta={`${p.sorgenteNome} — pag. ${p.pagina + 1}`}
                    ruolo={p.ruolo}
                    onCambiaRuolo={(ruolo) => assegnaRuolo(p.sorgenteId, p.pagina, ruolo)}
                    onSposta={p.ruolo ? (direzione) => sposta(p.ruolo!, indice, direzione) : undefined}
                    primoNelRuolo={indice === 0}
                    ultimoNelRuolo={indice === inRuolo.length - 1}
                  />
                )
              })}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {sorgenti.map((s) => (
                <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" color="text.disabled">
                    {s.nome} ({peso(s.peso)})
                  </Typography>
                  <IconButton size="small" onClick={() => rimuoviSorgente(s.id)} disabled={bloccato} aria-label={`Togli ${s.nome}`}>
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>

            <Button
              size="small"
              startIcon={<UploadIcon sx={{ fontSize: 16 }} />}
              onClick={() => inputRef.current?.click()}
              disabled={bloccato}
              sx={{ alignSelf: 'flex-start' }}
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

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography
          component="span"
          sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'text.disabled' }}
        >
          Documento d’identità installatore
        </Typography>
        {override ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">{override.nome} ({peso(override.peso)}) — sostituisce il predefinito per questa pratica</Typography>
            <IconButton size="small" onClick={rimuoviOverride} disabled={bloccato} aria-label="Rimuovi sostituzione">
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.disabled">
              Verrà usato il documento predefinito (Officina del Compressore).
            </Typography>
            <Button size="small" onClick={() => inputOverrideRef.current?.click()} disabled={bloccato}>
              Sostituisci per questa pratica
            </Button>
            <input
              ref={inputOverrideRef}
              type="file"
              hidden
              accept={ACCETTATI}
              onChange={(e) => { caricaOverride(e.target.files); e.target.value = '' }}
            />
          </Box>
        )}
      </Box>

      {finale && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PdfIcon fontSize="small" sx={{ color: 'primary.main' }} />
          <Typography variant="body2" noWrap sx={{ flex: '1 1 auto', minWidth: 0 }}>{finale.nome}</Typography>
          <Typography variant="caption" color="text.disabled">{peso(finale.peso)}</Typography>
          <IconButton size="small" onClick={scarica} aria-label={`Scarica ${finale.nome}`}>
            <DownloadIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}

      {stato !== 'pronto' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={14} />
          <Typography variant="caption" color="text.secondary">
            {stato === 'caricamento' ? 'Caricamento dei documenti…' : avanzamento}
          </Typography>
        </Box>
      )}

      {errore && <Alert severity="error" sx={{ py: 0.25 }} onClose={() => setErrore(null)}>{errore}</Alert>}

      {esito && (
        <Alert severity={esito.sottoLimite ? 'success' : 'warning'} sx={{ py: 0.25 }}>
          Dichiarazioni di {esito.pagine} pagine, {peso(esito.byte)}
          {!esito.sottoLimite && ' — oltre il limite di 4,9 MB'}.
        </Alert>
      )}

      <Button
        size="small"
        variant="outlined"
        color="primary"
        startIcon={stato === 'generazione' ? <CircularProgress size={14} color="inherit" /> : <PdfIcon />}
        onClick={genera}
        disabled={bloccato || assegnate === 0}
        sx={{ alignSelf: 'flex-start', borderColor: 'primary.main' }}
      >
        Genera dichiarazioni
      </Button>
    </Box>
  )
}
