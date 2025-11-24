import { useState, useRef } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  CircularProgress,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material'
import {
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Description as DescriptionIcon,
  Delete as DeleteIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { attachmentsApi, type Attachment } from '@/services/api/attachments'
import { useAuth } from '@/hooks/useAuth'

interface AttachmentsSectionProps {
  requestId: string
  requestCreatedBy?: string
  requestAssignedTo?: string | null
}

export function AttachmentsSection({
  requestId,
  requestCreatedBy,
  requestAssignedTo
}: AttachmentsSectionProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [attachmentToDelete, setAttachmentToDelete] = useState<Attachment | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Fetch attachments
  const { data: attachments, isLoading } = useQuery({
    queryKey: ['attachments', requestId],
    queryFn: () => attachmentsApi.getByRequestId(requestId),
  })

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: (file: File) => attachmentsApi.upload({ requestId, file }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', requestId] })
      setUploadError(null)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    onError: (error: Error) => {
      console.error('Upload error:', error)
      setUploadError(error.message)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => attachmentsApi.delete(attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', requestId] })
      setDeleteDialogOpen(false)
      setAttachmentToDelete(null)
    },
    onError: (error: Error) => {
      console.error('Delete error:', error)
      alert(`Errore nell'eliminazione: ${error.message}`)
    },
  })

  const handleDownload = async (attachment: Attachment) => {
    try {
      setDownloading(attachment.id)
      await attachmentsApi.download(attachment.file_path, attachment.file_name)
    } catch (err) {
      console.error('Download error:', err)
      alert('Errore nel download del file')
    } finally {
      setDownloading(null)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      uploadMutation.mutate(file)
    }
  }

  const handleDeleteClick = (attachment: Attachment) => {
    setAttachmentToDelete(attachment)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (attachmentToDelete) {
      deleteMutation.mutate(attachmentToDelete.id)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setAttachmentToDelete(null)
  }

  // Determine permissions
  // Can add attachments: admin, creator, or assigned user
  const canAddAttachment =
    user?.role === 'admin' ||
    user?.id === requestCreatedBy ||
    user?.id === requestAssignedTo

  // Can delete attachments: admin, creator, assigned user, or uploader
  const canDeleteAttachment = (attachment: Attachment) =>
    user?.role === 'admin' ||
    user?.id === requestCreatedBy ||
    user?.id === requestAssignedTo ||
    user?.id === attachment.uploaded_by

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (isLoading) {
    return (
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            <AttachFileIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Allegati ({attachments?.length || 0})
          </Typography>

          {canAddAttachment && (
            <Box>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={handleFileSelect}
                accept="*/*"
              />
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                size="small"
              >
                {uploadMutation.isPending ? 'Caricamento...' : 'Carica File'}
              </Button>
            </Box>
          )}
        </Box>

        {uploadError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError(null)}>
            {uploadError}
          </Alert>
        )}

        {uploadMutation.isPending && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
            <CircularProgress size={24} />
            <Typography variant="body2">Caricamento in corso...</Typography>
          </Box>
        )}

        {!attachments || attachments.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            Nessun allegato presente
          </Typography>
        ) : (
          <List>
            {attachments.map((attachment) => (
              <ListItem
                key={attachment.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton
                      edge="end"
                      onClick={() => handleDownload(attachment)}
                      disabled={downloading === attachment.id}
                      title="Scarica"
                    >
                      {downloading === attachment.id ? (
                        <CircularProgress size={24} />
                      ) : (
                        <DownloadIcon />
                      )}
                    </IconButton>
                    {canDeleteAttachment(attachment) && (
                      <IconButton
                        edge="end"
                        onClick={() => handleDeleteClick(attachment)}
                        disabled={deleteMutation.isPending}
                        color="error"
                        title="Elimina"
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                }
              >
                <ListItemIcon>
                  <DescriptionIcon />
                </ListItemIcon>
                <ListItemText
                  primary={attachment.file_name}
                  secondary={
                    <Box component="span">
                      <Typography variant="caption" display="block">
                        {formatFileSize(attachment.file_size)}
                      </Typography>
                      <Typography variant="caption" display="block">
                        Caricato da:{' '}
                        {attachment.uploaded_by_user?.full_name ||
                          attachment.uploaded_by_user?.email ||
                          'Sconosciuto'}
                      </Typography>
                      <Typography variant="caption" display="block" color="text.secondary">
                        {formatDate(attachment.created_at)}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>Conferma Eliminazione</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler eliminare l'allegato "{attachmentToDelete?.file_name}"?
            Questa azione non può essere annullata.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleteMutation.isPending}>
            Annulla
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Eliminazione...' : 'Elimina'}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  )
}
