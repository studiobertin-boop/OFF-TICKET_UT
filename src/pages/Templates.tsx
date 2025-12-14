/**
 * Pagina lista e gestione template
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  MenuItem,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Menu
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  History as HistoryIcon,
  Download as DownloadIcon,
  MoreVert as MoreVertIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon
} from '@mui/icons-material';
import {
  listTemplates,
  deleteTemplate,
  duplicateTemplate,
  exportTemplateToJSON,
  getTemplateVersions
} from '../services/templateService';
import type { ReportTemplate, TemplateType, ReportTemplateVersion } from '../types/template';

export function Templates() {
  const navigate = useNavigate();

  // State
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);

  // Dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [versionsDialogOpen, setVersionsDialogOpen] = useState(false);
  const [versions, setVersions] = useState<ReportTemplateVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, [filterType, searchQuery]);

  async function loadTemplates() {
    setLoading(true);
    setError(null);

    try {
      const filters: any = {};

      if (filterType !== 'all') {
        filters.template_type = filterType;
      }

      if (searchQuery.trim()) {
        filters.search = searchQuery.trim();
      }

      const data = await listTemplates(filters);
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento template');
    } finally {
      setLoading(false);
    }
  }

  function handleMenuOpen(event: React.MouseEvent<HTMLElement>, template: ReportTemplate) {
    setAnchorEl(event.currentTarget);
    setSelectedTemplate(template);
  }

  function handleMenuClose() {
    setAnchorEl(null);
  }

  function handleNew() {
    navigate('/templates/new');
  }

  function handleEdit(template: ReportTemplate) {
    navigate(`/templates/${template.id}`);
    handleMenuClose();
  }

  async function handleDuplicate(template: ReportTemplate) {
    try {
      await duplicateTemplate(
        template.id,
        `${template.name} (Copia)`
      );
      setSuccessMessage('Template duplicato con successo!');
      await loadTemplates();
      handleMenuClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore duplicazione template');
    }
  }

  function handleDeleteClick(template: ReportTemplate) {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
    handleMenuClose();
  }

  async function handleDeleteConfirm() {
    if (!selectedTemplate) return;

    try {
      await deleteTemplate(selectedTemplate.id);
      setSuccessMessage('Template eliminato con successo!');
      await loadTemplates();
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore eliminazione template');
    }
  }

  async function handleViewVersions(template: ReportTemplate) {
    setSelectedTemplate(template);
    setVersionsDialogOpen(true);
    setLoadingVersions(true);
    handleMenuClose();

    try {
      const versionsList = await getTemplateVersions(template.id);
      setVersions(versionsList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento versioni');
    } finally {
      setLoadingVersions(false);
    }
  }

  async function handleExport(template: ReportTemplate) {
    try {
      const json = await exportTemplateToJSON(template.id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessMessage('Template esportato!');
      handleMenuClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore esportazione template');
    }
  }

  function getTypeLabel(type: TemplateType): string {
    const labels: Record<TemplateType, string> = {
      dm329_technical: 'DM329 Relazione',
      inail: 'INAIL',
      custom: 'Custom'
    };
    return labels[type] || type;
  }

  function getTypeColor(type: TemplateType): 'primary' | 'secondary' | 'default' {
    const colors: Record<TemplateType, 'primary' | 'secondary' | 'default'> = {
      dm329_technical: 'primary',
      inail: 'secondary',
      custom: 'default'
    };
    return colors[type] || 'default';
  }

  if (loading && templates.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Template Documenti
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNew}
        >
          Nuovo Template
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2}>
          <TextField
            label="Cerca"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nome o descrizione..."
            size="small"
            sx={{ flex: 1 }}
          />
          <TextField
            label="Tipo"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            select
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">Tutti i tipi</MenuItem>
            <MenuItem value="dm329_technical">DM329 Relazione</MenuItem>
            <MenuItem value="inail">INAIL</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </TextField>
        </Box>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Descrizione</TableCell>
              <TableCell>Versione</TableCell>
              <TableCell>Stato</TableCell>
              <TableCell>Ultimo aggiornamento</TableCell>
              <TableCell align="right">Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" py={4}>
                    Nessun template trovato
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {template.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getTypeLabel(template.template_type)}
                      color={getTypeColor(template.template_type)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap maxWidth={300}>
                      {template.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={`v${template.version}`} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {template.is_active ? (
                      <Chip
                        icon={<ActiveIcon />}
                        label="Attivo"
                        color="success"
                        size="small"
                      />
                    ) : (
                      <Chip
                        icon={<InactiveIcon />}
                        label="Inattivo"
                        color="default"
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(template.updated_at).toLocaleDateString('it-IT')}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Modifica">
                      <IconButton size="small" onClick={() => handleEdit(template)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, template)}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedTemplate && handleEdit(selectedTemplate)}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Modifica
        </MenuItem>
        <MenuItem onClick={() => selectedTemplate && handleDuplicate(selectedTemplate)}>
          <CopyIcon fontSize="small" sx={{ mr: 1 }} />
          Duplica
        </MenuItem>
        <MenuItem onClick={() => selectedTemplate && handleViewVersions(selectedTemplate)}>
          <HistoryIcon fontSize="small" sx={{ mr: 1 }} />
          Storico versioni
        </MenuItem>
        <MenuItem onClick={() => selectedTemplate && handleExport(selectedTemplate)}>
          <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
          Esporta JSON
        </MenuItem>
        <MenuItem
          onClick={() => selectedTemplate && handleDeleteClick(selectedTemplate)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
          Elimina
        </MenuItem>
      </Menu>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Conferma Eliminazione</DialogTitle>
        <DialogContent>
          <Typography>
            Sei sicuro di voler eliminare il template "{selectedTemplate?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={1}>
            Il template verrà disattivato ma non eliminato permanentemente.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annulla</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Elimina
          </Button>
        </DialogActions>
      </Dialog>

      {/* Versions Dialog */}
      <Dialog
        open={versionsDialogOpen}
        onClose={() => setVersionsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Storico Versioni - {selectedTemplate?.name}</DialogTitle>
        <DialogContent>
          {loadingVersions ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : versions.length === 0 ? (
            <Typography color="text.secondary">Nessuna versione storica disponibile</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Versione</TableCell>
                  <TableCell>Data</TableCell>
                  <TableCell>Autore</TableCell>
                  <TableCell>Descrizione</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell>v{version.version}</TableCell>
                    <TableCell>
                      {new Date(version.created_at).toLocaleString('it-IT')}
                    </TableCell>
                    <TableCell>{version.changed_by || '-'}</TableCell>
                    <TableCell>{version.change_description || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVersionsDialogOpen(false)}>Chiudi</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbars */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
      >
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Container>
  );
}
