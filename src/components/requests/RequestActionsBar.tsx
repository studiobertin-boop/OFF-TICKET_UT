import { Box, Divider } from '@mui/material'
import {
  Block as BlockIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  PriorityHigh as PriorityHighIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material'
import { AzioneIcona } from '@/components/common'

export interface RequestActionsBarProps {
  isUrgent: boolean
  isBlocked: boolean
  hasAttribution: boolean
  canToggleUrgent: boolean
  canBlock: boolean
  canAttribute: boolean
  canHide: boolean
  canDelete: boolean
  togglingUrgent: boolean
  onToggleUrgent: () => void
  onBlock: () => void
  onAttribute: () => void
  onHide: () => void
  onDelete: () => void
}

/**
 * Azioni secondarie del dettaglio pratica, ciascuna con la propria icona in vista.
 *
 * Stavano dietro un bottone «Azioni», che le rendeva introvabili: chi non lo apriva non
 * sapeva nemmeno che urgenza, blocco e attribuzione esistessero. Ora sono in fila come nella
 * testata della scheda dati, ridotte all'icona finché il mouse non ci passa sopra.
 *
 * Il menu però faceva anche un'altra cosa, e quella va conservata: teneva Nascondi ed Elimina
 * in fondo, dopo un separatore, perché sei voci dello stesso peso non distinguono la routine
 * dall'irreversibile. Qui il separatore resta — è un filetto verticale — e il colore dice il
 * peso di ciascuna anche quando la parola è chiusa: rosso solo per ciò da cui non si torna
 * indietro, ambra per il blocco (che si sblocca), il colore ordinario per il resto.
 *
 * Urgenza compresa: nel menu portava un'icona rossa, ma è una spunta che si toglie come si
 * mette, e in una fila di pulsanti contornati un bordo rosso si legge come un avvertimento.
 * Tre rossi su cinque avrebbero reso il rosso un colore qualunque.
 *
 * I permessi non vengono ricalcolati qui: arrivano già risolti dalla pagina.
 */
export const RequestActionsBar = ({
  isUrgent,
  isBlocked,
  hasAttribution,
  canToggleUrgent,
  canBlock,
  canAttribute,
  canHide,
  canDelete,
  togglingUrgent,
  onToggleUrgent,
  onBlock,
  onAttribute,
  onHide,
  onDelete,
}: RequestActionsBarProps) => {
  const mostraBlocca = canBlock && !isBlocked
  const vociDistruttive = canHide || canDelete

  if (!canToggleUrgent && !mostraBlocca && !canAttribute && !vociDistruttive) return null

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      {canToggleUrgent && (
        <AzioneIcona
          icona={<PriorityHighIcon fontSize="small" />}
          testo={isUrgent ? 'Togli urgenza' : 'Segna urgente'}
          onClick={onToggleUrgent}
          disabled={togglingUrgent}
        />
      )}

      {mostraBlocca && (
        <AzioneIcona
          icona={<BlockIcon fontSize="small" />}
          testo="Blocca richiesta"
          onClick={onBlock}
          colore="warning"
        />
      )}

      {canAttribute && (
        <AzioneIcona
          icona={<PersonAddIcon fontSize="small" />}
          testo={hasAttribution ? 'Modifica attribuzione' : 'Attribuisci'}
          onClick={onAttribute}
        />
      )}

      {vociDistruttive && <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />}

      {canHide && (
        <AzioneIcona
          icona={<VisibilityOffIcon fontSize="small" />}
          testo="Nascondi"
          onClick={onHide}
          colore="error"
        />
      )}

      {canDelete && (
        <AzioneIcona
          icona={<DeleteIcon fontSize="small" />}
          testo="Elimina"
          onClick={onDelete}
          colore="error"
        />
      )}
    </Box>
  )
}
