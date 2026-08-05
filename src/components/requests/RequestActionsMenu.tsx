import { useState } from 'react'
import { Button, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import {
  MoreVert as MoreVertIcon,
  Block as BlockIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  PriorityHigh as PriorityHighIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material'

export interface RequestActionsMenuProps {
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
 * Azioni secondarie del dettaglio pratica, raccolte in un solo menu.
 *
 * In toolbar restava una sola azione primaria ("Scheda dati", più "Sblocca" quando
 * la pratica è ferma): sei bottoni pieni tutti dello stesso peso rendevano
 * indistinguibile la routine dall'irreversibile. Nascondi ed Elimina stanno in
 * fondo, dopo un separatore.
 *
 * I permessi non vengono ricalcolati qui: arrivano già risolti dalla pagina.
 */
export const RequestActionsMenu = ({
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
}: RequestActionsMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const chiudi = () => setAnchorEl(null)

  const esegui = (azione: () => void) => () => {
    chiudi()
    azione()
  }

  const mostraBlocca = canBlock && !isBlocked
  const vociDistruttive = canHide || canDelete

  // Senza voci il menu sarebbe un bottone che non apre nulla.
  if (!canToggleUrgent && !mostraBlocca && !canAttribute && !vociDistruttive) return null

  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        size="small"
        endIcon={<MoreVertIcon />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-haspopup="true"
        aria-expanded={Boolean(anchorEl)}
      >
        Azioni
      </Button>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={chiudi}>
        {canToggleUrgent && (
          <MenuItem onClick={esegui(onToggleUrgent)} disabled={togglingUrgent}>
            <ListItemIcon><PriorityHighIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>{isUrgent ? 'Togli urgenza' : 'Segna urgente'}</ListItemText>
          </MenuItem>
        )}

        {mostraBlocca && (
          <MenuItem onClick={esegui(onBlock)}>
            <ListItemIcon><BlockIcon fontSize="small" color="warning" /></ListItemIcon>
            <ListItemText>Blocca richiesta</ListItemText>
          </MenuItem>
        )}

        {canAttribute && (
          <MenuItem onClick={esegui(onAttribute)}>
            <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{hasAttribution ? 'Modifica attribuzione' : 'Attribuisci'}</ListItemText>
          </MenuItem>
        )}

        {vociDistruttive && <Divider />}

        {canHide && (
          <MenuItem onClick={esegui(onHide)}>
            <ListItemIcon><VisibilityOffIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Nascondi</ListItemText>
          </MenuItem>
        )}

        {canDelete && (
          <MenuItem onClick={esegui(onDelete)} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Elimina</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  )
}
