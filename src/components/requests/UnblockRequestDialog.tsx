import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Typography,
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material'
import { AttachFile as AttachFileIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useUnblockRequest } from '@/hooks/useRequestBlocks'
import { RequestBlock } from '@/types'
import { supabase } from '@/services/supabase'

interface UnblockRequestDialogProps {
  open: boolean
  onClose: () => void
  block: RequestBlock | null
  requestTitle: string
}

/**
 * Dialog for unblocking (resolving) a blocked request
 * Visible to: request creator (utente who created the request)
 */
export function UnblockRequestDialog({
  open,
  onClose,
  block,
  requestTitle,
}: UnblockRequestDialogProps) {
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const unblockMutation = useUnblockRequest()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files)
      setFiles(prev => [...prev, ...newFiles])
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async (requestId: string): Promise<boolean> => {
    if (files.length === 0) return true

    try {
      setUploading(true)

      for (const file of files) {
        const fileName = `${requestId}/${Date.now()}_${file.name}`

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(fileName, file)

        if (uploadError) {
          console.error('File upload error:', uploadError)
          setError(`Errore caricamento file ${file.name}: ${uploadError.message}`)
          return false
        }

        // Save attachment record
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setError('Utente non autenticato')
          return false
        }

        const { error: dbError } = await supabase
          .from('attachments')
          .insert({
            request_id: requestId,
            file_name: file.name,
            file_path: fileName,
            file_size: file.size,
            uploaded_by: user.id,
          })

        if (dbError) {
          console.error('Attachment record error:', dbError)
          setError(`Errore salvataggio allegato ${file.name}`)
          return false
        }
      }

      return true
    } catch (err) {
      console.error('Upload error:', err)
      setError('Errore durante il caricamento dei file')
      return false
    } finally {
      setUploading(false)
    }
  }

  const handleUnblock = async () => {
    if (!block) {
      setError('Nessun blocco attivo trovato')
      return
    }

    try {
      // First upload files if any
      if (files.length > 0) {
        const uploadSuccess = await uploadFiles(block.request_id)
        if (!uploadSuccess) {
          return // Error already set by uploadFiles
        }
      }

      // Then unblock
      const result = await unblockMutation.mutateAsync({
        blockId: block.id,
        requestId: block.request_id,
        resolutionNotes: resolutionNotes.trim() || undefined,
      })

      if (result.success) {
        handleClose()
      } else {
        setError(result.message)
      }
    } catch (err) {
      setError('Errore durante lo sblocco della richiesta')
      console.error('Unblock error:', err)
    }
  }

  const handleClose = () => {
    setResolutionNotes('')
    setFiles([])
    setError(null)
    onClose()
  }

  if (!block) {
    return null
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Risolvi Blocco</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Stai per risolvere il blocco sulla richiesta &quot;{requestTitle}&quot;.{' '}
          {block.blocked_by_user?.full_name || 'Il tecnico'} riceverà una notifica.
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Motivo del blocco:
          </Typography>
          <Typography variant="body2">{block.reason}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Bloccato da: {block.blocked_by_user?.full_name || block.blocked_by_user?.email || 'Sconosciuto'}
            <br />
            Data blocco: {new Date(block.blocked_at).toLocaleString('it-IT')}
          </Typography>
        </Box>

        <TextField
          margin="dense"
          label="Note di risoluzione (facoltativo)"
          placeholder="Es: Caricato il file richiesto, Fornite le informazioni mancanti..."
          fullWidth
          multiline
          rows={3}
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
          helperText="Spiega cosa hai fatto per risolvere il blocco"
        />

        <Box sx={{ mt: 2 }}>
          <input
            accept="*/*"
            style={{ display: 'none' }}
            id="unblock-file-upload"
            type="file"
            multiple
            onChange={handleFileSelect}
            disabled={uploading || unblockMutation.isPending}
          />
          <label htmlFor="unblock-file-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={<AttachFileIcon />}
              disabled={uploading || unblockMutation.isPending}
            >
              Allega File
            </Button>
          </label>

          {files.length > 0 && (
            <List dense sx={{ mt: 1 }}>
              {files.map((file, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={file.name}
                    secondary={`${(file.size / 1024).toFixed(2)} KB`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveFile(index)}
                      disabled={uploading || unblockMutation.isPending}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={unblockMutation.isPending}>
          Annulla
        </Button>
        <Button
          onClick={handleUnblock}
          variant="contained"
          color="success"
          disabled={unblockMutation.isPending || uploading}
          startIcon={unblockMutation.isPending || uploading ? <CircularProgress size={16} /> : undefined}
        >
          {uploading ? 'Caricamento...' : unblockMutation.isPending ? 'Sblocco...' : 'Sblocca Richiesta'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
