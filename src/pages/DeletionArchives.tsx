import { useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material'
import {
  Download as DownloadIcon,
  Description as PdfIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/common/Layout'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { deletionArchivesApi } from '@/services/api/deletionArchives'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'react-hot-toast'

export const DeletionArchives = () => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: archives = [], isLoading, error } = useQuery({
    queryKey: ['deletion-archives'],
    queryFn: () => deletionArchivesApi.getAll(),
  })

  const deleteMutation = useMutation({
    mutationFn: (archiveId: string) => deletionArchivesApi.delete(archiveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletion-archives'] })
      toast.success('Archivio eliminato con successo')
    },
    onError: (error: any) => {
      console.error('Errore eliminazione archivio:', error)
      toast.error(error.message || 'Errore durante l\'eliminazione dell\'archivio')
    },
  })

  const handleDownload = async (archiveId: string, fileName: string, filePath: string) => {
    try {
      setDownloadingId(archiveId)

      // Download PDF from storage
      const blob = await deletionArchivesApi.downloadPDF(filePath)

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('PDF scaricato con successo')
    } catch (error: any) {
      console.error('Errore download PDF:', error)
      toast.error(error.message || 'Errore durante il download del PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = (archiveId: string, fileName: string) => {
    if (window.confirm(`Sei sicuro di voler eliminare l'archivio "${fileName}"? Questa azione è irreversibile.`)) {
      deleteMutation.mutate(archiveId)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(2)} MB`
  }

  if (isLoading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <Alert severity="error">Errore nel caricamento degli archivi eliminazioni</Alert>
      </Layout>
    )
  }

  return (
    <Layout>
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4">Archivio Eliminazioni</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Storico dei PDF generati durante le eliminazioni massive di pratiche
          </Typography>
        </Box>

        {archives.length === 0 ? (
          <Alert severity="info">
            Nessun archivio di eliminazione disponibile. Gli archivi vengono generati automaticamente
            quando si utilizza la funzione di eliminazione massiva.
          </Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 60 }} />
                  <TableCell>Data Eliminazione</TableCell>
                  <TableCell>Nome File</TableCell>
                  <TableCell align="center">Pratiche Eliminate</TableCell>
                  <TableCell align="center">Dimensione</TableCell>
                  <TableCell>Eliminato da</TableCell>
                  <TableCell align="center">Azioni</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {archives.map((archive) => (
                  <TableRow
                    key={archive.id}
                    hover
                    sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
                  >
                    <TableCell>
                      <PdfIcon color="error" fontSize="large" />
                    </TableCell>
                    <TableCell>
                      {format(new Date(archive.created_at), 'dd/MM/yyyy HH:mm', { locale: it })}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">
                        {archive.file_name}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={archive.deleted_count}
                        color="primary"
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" color="text.secondary">
                        {formatFileSize(archive.file_size)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {archive.deleted_by_user?.full_name || 'N/A'}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Scarica PDF">
                        <IconButton
                          color="primary"
                          onClick={() =>
                            handleDownload(archive.id, archive.file_name, archive.file_path)
                          }
                          disabled={downloadingId === archive.id || deleteMutation.isPending}
                        >
                          {downloadingId === archive.id ? (
                            <CircularProgress size={24} />
                          ) : (
                            <DownloadIcon />
                          )}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Elimina archivio">
                        <IconButton
                          color="error"
                          onClick={() => handleDelete(archive.id, archive.file_name)}
                          disabled={downloadingId === archive.id || deleteMutation.isPending}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Layout>
  )
}
