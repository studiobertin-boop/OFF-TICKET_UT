import { useEffect, useRef, useState } from 'react'
import {
  Box, Button, Chip, CircularProgress, Divider, IconButton, ListItemIcon, ListItemText,
  Menu, MenuItem, Tooltip, Typography,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckCircleIcon,
  Description as DescriptionIcon,
  MoreVert as MoreVertIcon,
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

export interface TechnicalSheetHeaderProps {
  customerName: string
  codicePratica: string
  denominazioneSala?: string | null
  isCompleted: boolean
  completezza: Completezza
  saving: boolean
  autoSaving: boolean
  lastSaved: Date | null
  canManageSharing: boolean
  /** Dati CIVA e relazione: solo a scheda completata, per admin e userdm329. */
  canGenerateDocs: boolean
  onBack: () => void
  onShare: () => void
  onCivaSummary: () => void
  onRelazione: () => void
  onSaveDraft: () => void
  onComplete: () => void
}

/**
 * Intestazione della SCHEDA DATI: resta agganciata in cima allo scroll, così identità
 * della pratica, stato di compilazione e salvataggio restano raggiungibili anche in
 * fondo a una tabella lunga.
 *
 * Deve essere figlia diretta del corpo pagina: dentro un wrapper alto quanto sé stessa
 * si stacca al primo scorrimento.
 *
 * Delle sette azioni che stavano in fila resta pieno il solo «Completa scheda»;
 * «Salva bozza» è contornato perché è l'azione di tutti i giorni, e assegnazione,
 * dati CIVA e relazione passano in un menu.
 */
export const TechnicalSheetHeader = ({
  customerName,
  codicePratica,
  denominazioneSala,
  isCompleted,
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
  onComplete,
}: TechnicalSheetHeaderProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const chiudi = () => setAnchorEl(null)
  const esegui = (azione: () => void) => () => { chiudi(); azione() }

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

          {/* Due cose distinte in un chip solo: la parola dice a che punto è la pratica
              («Completata» è lo stato di workflow, deciso da chi preme il pulsante), il
              colore dice se i dati ci sono tutti. Il verde arriva solo a scheda piena:
              una scheda marcata completata con campi mancanti resta ambra, e la
              percentuale accanto dice quanti ne mancano. */}
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
              label={
                (isCompleted ? 'Completata' : 'Bozza') +
                (pieno ? '' : ` · ${percentuale(completezza)}% compilata`)
              }
            />
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', ml: 'auto' }}>
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

          <Button
            variant="outlined"
            size="small"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={onSaveDraft}
            disabled={saving || autoSaving}
            // Bordo a piena opacità: il 50% di default di MUI su fondo scuro sparisce.
            sx={{ borderColor: 'primary.main' }}
          >
            Salva bozza
          </Button>

          <Button
            variant="contained"
            size="small"
            color="primary"
            startIcon={<CheckCircleIcon />}
            onClick={onComplete}
            disabled={saving || autoSaving}
          >
            Completa scheda
          </Button>

          {(canManageSharing || canGenerateDocs) && (
            <>
              <IconButton
                size="small"
                color="primary"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                aria-label="Altre azioni"
                aria-haspopup="true"
                aria-expanded={Boolean(anchorEl)}
              >
                <MoreVertIcon />
              </IconButton>

              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={chiudi}>
                {canManageSharing && (
                  <MenuItem onClick={esegui(onShare)}>
                    <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Assegna scheda</ListItemText>
                  </MenuItem>
                )}

                {canManageSharing && canGenerateDocs && <Divider />}

                {canGenerateDocs && (
                  <MenuItem onClick={esegui(onCivaSummary)}>
                    <ListItemIcon><AssessmentIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Visualizza dati CIVA</ListItemText>
                  </MenuItem>
                )}
                {canGenerateDocs && (
                  <MenuItem onClick={esegui(onRelazione)}>
                    <ListItemIcon><DescriptionIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>Genera relazione</ListItemText>
                  </MenuItem>
                )}
              </Menu>
            </>
          )}
        </Box>
      </Box>
    </>
  )
}
