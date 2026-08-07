import { useEffect, useRef, type ReactElement } from 'react'
import { Box, Button, Chip, CircularProgress, Tooltip, Typography } from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  Save as SaveIcon,
  Share as ShareIcon,
} from '@mui/icons-material'
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

interface AzioneBarraProps {
  icona: ReactElement
  testo: string
  onClick: () => void
  disabled?: boolean
}

/**
 * Azione della barra: icona sempre in vista, parola che si apre al passaggio del mouse.
 *
 * Quattro parole in fila occupavano tutta la barra e la mandavano a capo sulle finestre
 * strette, ma nasconderle dietro tre puntini le rendeva introvabili — è lo stesso equivoco
 * della freccina dei dettagli. Così le icone restano tutte visibili e la parola arriva a
 * chiedere.
 *
 * L'apertura è una griglia da `0fr` a `1fr` e non una larghezza in pixel: la parola detta la
 * propria misura, quindi «Visualizza dati CIVA» e «Salva bozza» si aprono ciascuna per quel
 * che è lunga, senza numeri da tenere allineati a mano.
 *
 * Dove il passaggio del mouse non esiste — un tablet in cantiere — la parola sta sempre
 * aperta: `@media (hover: none)`. E `aria-label` porta comunque il nome dell'azione a chi
 * naviga con la tastiera o con un lettore di schermo, che l'animazione non la vede.
 */
const AzioneBarra = ({ icona, testo, onClick, disabled }: AzioneBarraProps) => (
  <Tooltip title={testo} placement="bottom">
    <span>
      <Button
        size="small"
        variant="outlined"
        color="primary"
        onClick={onClick}
        disabled={disabled}
        aria-label={testo}
        // Bordo a piena opacità: il 50% di default di MUI su fondo scuro sparisce.
        sx={{
          minWidth: 0, px: 0.9, borderColor: 'primary.main', whiteSpace: 'nowrap',
          '& .etichetta': {
            display: 'grid', gridTemplateColumns: '0fr', ml: 0, opacity: 0,
            transition: 'grid-template-columns .18s ease, opacity .18s ease, margin-left .18s ease',
          },
          '& .etichetta > span': { overflow: 'hidden', minWidth: 0 },
          '&:hover .etichetta, &:focus-visible .etichetta': {
            gridTemplateColumns: '1fr', ml: 0.75, opacity: 1,
          },
          '@media (hover: none)': {
            '& .etichetta': { gridTemplateColumns: '1fr', ml: 0.75, opacity: 1 },
          },
        }}
      >
        {icona}
        <Box component="span" className="etichetta"><span>{testo}</span></Box>
      </Button>
    </span>
  </Tooltip>
)

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
 * il mouse non ci passa sopra (vedi `AzioneBarra`). Non c'è più un «Completa scheda»: lo
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

          <AzioneBarra
            icona={<SaveIcon fontSize="small" />}
            testo="Salva bozza"
            onClick={onSaveDraft}
            disabled={saving || autoSaving}
          />

          {canManageSharing && (
            <AzioneBarra icona={<ShareIcon fontSize="small" />} testo="Assegna scheda" onClick={onShare} />
          )}

          {canGenerateDocs && (
            <AzioneBarra icona={<AssessmentIcon fontSize="small" />} testo="Visualizza dati CIVA" onClick={onCivaSummary} />
          )}

          {canGenerateDocs && (
            <AzioneBarra icona={<DescriptionIcon fontSize="small" />} testo="Genera relazione" onClick={onRelazione} />
          )}
        </Box>
      </Box>
    </>
  )
}
