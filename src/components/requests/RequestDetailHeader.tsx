import { ReactNode } from 'react'
import { Box, Button, Chip, IconButton, Typography } from '@mui/material'
import { ArrowBack as ArrowBackIcon, Edit as EditIcon } from '@mui/icons-material'
import { StatusChip } from '@/components/common'
import { BlockIndicator } from './BlockIndicator'
import { BlocchiNastro } from './BlocchiNastro'
import type { RiassuntoBlocchi } from '@/utils/blocchiPratica'
import type { Request } from '@/types'

export interface RequestDetailHeaderProps {
  request: Request
  /** Sulle DM329 è la ragione sociale del cliente, altrove il titolo della richiesta. */
  title: string
  isDM329: boolean
  /** Codice pratica già calcolato dal chiamante (codiceForRequest). */
  codicePratica: string
  canManageCodice: boolean
  onEditCodice: () => void
  /** Lettura dei fermi della pratica, per il nastro sotto lo stepper. */
  blocchi: RiassuntoBlocchi
  /** Frazione di percorso coperta (0–1): il nastro finisce sotto il passo raggiunto. */
  avanzamento: number
  blockReason?: string
  onBack: () => void
  /** Azione primaria a destra (Scheda dati) e, se la pratica è ferma, Sblocca. */
  primaryActions?: ReactNode
  /** Fila delle azioni secondarie, ciascuna con la propria icona. */
  actions?: ReactNode
  /** Stepper DM329 o bottoni di transizione, a seconda del tipo di richiesta. */
  workflow: ReactNode
}

/**
 * Intestazione del dettaglio pratica: resta agganciata in cima allo scroll così
 * che identità della pratica, stato e azioni siano raggiungibili anche a metà
 * pagina. La AppBar di Layout è `position="static"` e scorre via, quindi qui
 * basta `top: 0`.
 *
 * Rispetto alla versione precedente lo stato è detto una volta sola (chip +
 * stepper) e i due Chip lunghi con le date sono diventati una riga di metadati.
 */
export const RequestDetailHeader = ({
  request,
  title,
  isDM329,
  codicePratica,
  canManageCodice,
  onEditCodice,
  blocchi,
  avanzamento,
  blockReason,
  onBack,
  primaryActions,
  actions,
  workflow,
}: RequestDetailHeaderProps) => {
  const tipo = request.request_type?.name === 'DM329-Integrazioni'
    ? 'Integrazioni'
    : request.request_type?.name

  const metadati = [
    tipo,
    `creata il ${new Date(request.created_at).toLocaleDateString('it-IT')} da ${request.creator?.full_name || 'utente sconosciuto'}`,
    `ultimo cambio stato ${new Date(request.updated_at).toLocaleString('it-IT')}`,
  ].filter(Boolean).join(' · ')

  // Frammento, non un Box: un elemento sticky si aggancia solo dentro il proprio
  // contenitore, quindi la barra deve essere figlia diretta del corpo pagina —
  // dentro un wrapper alto quanto l'intestazione si staccherebbe subito.
  return (
    <>
      {/* Barra agganciata: solo identità, stato e azioni. Resta di altezza fissa
          invece di collassare durante lo scroll — su una pagina alta poco più di
          una schermata un'intestazione che si rimpicciolisce accorcia il documento
          e rischia di rimbalzare fra le due misure. */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: (theme) => theme.zIndex.appBar - 1,
          bgcolor: 'background.default',
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          py: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', minWidth: 0 }}>
          <Button size="small" color="inherit" startIcon={<ArrowBackIcon />} onClick={onBack}>
            Richieste
          </Button>

          <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
            {title}
          </Typography>

          {isDM329 && codicePratica && (
            <Typography component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem' }}>
              {codicePratica}
            </Typography>
          )}
          {isDM329 && !codicePratica && canManageCodice && (
            <Typography component="span" variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
              Codice pratica non assegnato
            </Typography>
          )}
          {isDM329 && canManageCodice && (
            <IconButton
              size="small"
              color="primary"
              onClick={onEditCodice}
              title={codicePratica ? 'Modifica codice pratica' : 'Assegna codice pratica'}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}

          <StatusChip status={request.status} />
          {request.is_urgent && <Chip size="small" color="error" label="Urgente" />}
          {request.is_blocked && <BlockIndicator isBlocked reason={blockReason} />}
        </Box>

        {/* Le azioni vanno a capo invece di sfondare: dove il mouse non c'è le etichette
            stanno tutte aperte, e sei parole in fila non entrano in una finestra stretta. */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {primaryActions}
          {actions}
        </Box>
      </Box>

      {/* Contesto e workflow: scorrono via, non servono mentre si legge il resto. */}
      <Box sx={{ pt: 1, pb: 2 }}>
        {isDM329 && request.denominazione_sala && (
          <Typography variant="subtitle2" color="text.secondary">
            {request.denominazione_sala}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" display="block">
          {metadati}
        </Typography>

        <Box sx={{ mt: 1.5 }}>{workflow}</Box>

        {/* Quante volte si è fermata, per quanto e perché è ripartita: sotto lo stepper,
            e lungo quanto il percorso già coperto, così le due righe si leggono in colonna. */}
        <BlocchiNastro riassunto={blocchi} creataIl={request.created_at} avanzamento={avanzamento} />
      </Box>
    </>
  )
}
