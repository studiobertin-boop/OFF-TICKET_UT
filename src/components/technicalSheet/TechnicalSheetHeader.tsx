import { useEffect, useRef } from 'react'
import { Box, Button, Chip, CircularProgress, Tooltip, Typography } from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  Save as SaveIcon,
  Share as ShareIcon,
} from '@mui/icons-material'
import { AzioneIcona } from '@/components/common'
import { eCompleta, percentuale, type Completezza } from '@/utils/schedaCompleteness'

/**
 * Altezza della barra agganciata, pubblicata come variabile CSS.
 *
 * Serve a chi deve agganciarsi *sotto* di lei — la testata della tabella, il pannello
 * dei dettagli — che altrimenti scivolerebbe dietro. Misurata e non dichiarata: la
 * barra va a capo sulle finestre strette, e un numero fisso lascerebbe la testata
 * sotto l'intestazione proprio dove serve di più.
 */
const VAR_BARRA = '--altezza-barra-scheda'
export const ALTEZZA_BARRA = `var(${VAR_BARRA}, 48px)`

export interface TechnicalSheetHeaderProps {
  customerName: string
  codicePratica: string
  denominazioneSala?: string | null
  completezza: Completezza
  saving: boolean
  autoSaving: boolean
  lastSaved: Date | null
  canManageSharing: boolean
  /** Dati CIVA e relazione: per admin e userdm329. */
  canGenerateDocs: boolean
  onBack: () => void
  onShare: () => void
  onCivaSummary: () => void
  onRelazione: () => void
  onSaveDraft: () => void
}

/**
 * Intestazione della SCHEDA DATI: resta agganciata in cima allo scroll, così identità
 * della pratica, stato di compilazione e salvataggio restano raggiungibili anche in
 * fondo a una tabella lunga.
 *
 * Deve essere figlia diretta del corpo pagina: dentro un wrapper alto quanto sé stessa
 * si stacca al primo scorrimento.
 *
 * Le azioni sono tutte in fila e tutte visibili, ciascuna ridotta alla propria icona finché
 * il mouse non ci passa sopra (vedi `AzioneIcona`). Non c'è più un «Completa scheda»: lo
 * stato della pratica si governa dallo stepper del dettaglio, dove stanno già tutti gli
 * altri passaggi.
 */
export const TechnicalSheetHeader = ({
  customerName,
  codicePratica,
  denominazioneSala,
  completezza,
  saving,
  autoSaving,
  lastSaved,
  canManageSharing,
  canGenerateDocs,
  onBack,
  onShare,
  onCivaSummary,
  onRelazione,
  onSaveDraft,
}: TechnicalSheetHeaderProps) => {
  const pieno = eCompleta(completezza)

  const barra = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = barra.current
    if (!el) return
    const misura = () => document.documentElement.style.setProperty(VAR_BARRA, `${el.offsetHeight}px`)
    misura()
    const osservatore = new ResizeObserver(misura)
    osservatore.observe(el)
    return () => {
      osservatore.disconnect()
      document.documentElement.style.removeProperty(VAR_BARRA)
    }
  }, [])

  return (
    <>
      <Box
        ref={barra}
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar - 1,
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
          py: 1,
          minHeight: 48,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minWidth: 0 }}>
          <Button size="small" color="inherit" startIcon={<ArrowBackIcon />} onClick={onBack}>
            Richiesta
          </Button>

          <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
            Scheda dati
          </Typography>

          {codicePratica && (
            <Typography component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem' }}>
              {codicePratica}
            </Typography>
          )}

          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
            {[customerName, denominazioneSala].filter(Boolean).join(' · ')}
          </Typography>

          {/* Il chip dice una cosa sola: se i dati ci sono tutti. Prima ne diceva due, e la
              prima delle due — «Completata» / «Bozza» — era lo stato di workflow: informazione
              che appartiene alla pratica, la porta il suo stepper, e qui si limitava a
              contraddire il colore su ogni scheda piena ma non marcata. */}
          <Tooltip
            title={
              pieno
                ? 'Tutti i campi previsti sono compilati'
                : `Mancano ${completezza.mancanti.length} campi su ${completezza.previsti}`
            }
            placement="bottom"
          >
            <Chip
              size="small"
              variant={pieno ? 'filled' : 'outlined'}
              color={pieno ? 'success' : 'warning'}
              icon={pieno ? <CheckCircleIcon /> : undefined}
              label={pieno ? 'Compilata' : `${percentuale(completezza)}% compilata`}
            />
          </Tooltip>
        </Box>

        {/* Le azioni vanno a capo invece di sfondare: dove il mouse non c'è le etichette
            stanno tutte aperte, e quattro parole in fila non entrano in una finestra stretta.
            La barra si rimisura da sé, quindi una seconda riga non nasconde nulla sotto. */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', ml: 'auto' }}>
          {autoSaving && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CircularProgress size={14} />
              Salvataggio…
            </Typography>
          )}
          {lastSaved && !autoSaving && (
            <Typography variant="caption" color="text.secondary">
              Salvato alle {lastSaved.toLocaleTimeString('it-IT')}
            </Typography>
          )}

          <AzioneIcona
            icona={<SaveIcon fontSize="small" />}
            testo="Salva bozza"
            onClick={onSaveDraft}
            disabled={saving || autoSaving}
          />

          {canManageSharing && (
            <AzioneIcona icona={<ShareIcon fontSize="small" />} testo="Assegna scheda" onClick={onShare} />
          )}

          {canGenerateDocs && (
            <AzioneIcona icona={<AssessmentIcon fontSize="small" />} testo="Visualizza dati CIVA" onClick={onCivaSummary} />
          )}

          {canGenerateDocs && (
            <AzioneIcona icona={<DescriptionIcon fontSize="small" />} testo="Genera relazione" onClick={onRelazione} />
          )}
        </Box>
      </Box>
    </>
  )
}
