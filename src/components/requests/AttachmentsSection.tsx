import { useState } from 'react'
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
} from '@mui/material'
import {
  AttachFile as AttachFileIcon,
  Download as DownloadIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'

interface Attachment {
  id: string
  request_id: string
  file_name: string
  file_path: string
  file_size: number
  uploaded_by: string
  created_at: string
  uploaded_by_user?: {
    full_name: string
    email: string
  }
}

interface AttachmentsSectionProps {
  requestId: string
}

export function AttachmentsSection({ requestId }: AttachmentsSectionProps) {
  const [downloading, setDownloading] = useState<string | null>(null)

  // Fetch attachments
  const { data: attachments, isLoading } = useQuery({
    queryKey: ['attachments', requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attachments')
        .select(`
          *,
          uploaded_by_user:users!uploaded_by(full_name, email)
        `)
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Attachment[]
    },
  })

  const handleDownload = async (attachment: Attachment) => {
    try {
      setDownloading(attachment.id)

      const { data, error } = await supabase.storage
        .from('attachments')
        .download(attachment.file_path)

      if (error) throw error

      // Create download link
      const url = URL.createObjectURL(data)
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.file_name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Download error:', err)
    } finally {
      setDownloading(null)
    }
  }

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
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    )
  }

  if (!attachments || attachments.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            <AttachFileIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Allegati
          </Typography>
          <Typography color="text.secondary">Nessun allegato presente</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <AttachFileIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Allegati ({attachments.length})
        </Typography>

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
                <IconButton
                  edge="end"
                  onClick={() => handleDownload(attachment)}
                  disabled={downloading === attachment.id}
                >
                  {downloading === attachment.id ? (
                    <CircularProgress size={24} />
                  ) : (
                    <DownloadIcon />
                  )}
                </IconButton>
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
      </CardContent>
    </Card>
  )
}
