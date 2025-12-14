/**
 * Pagina editor template con split view Monaco + Live Preview
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  TextField,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  Visibility as PreviewIcon,
  Download as DownloadIcon,
  LibraryBooks as BrowserIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material';
import { WYSIWYGEditor } from '../components/templates/WYSIWYGEditor';
import { LivePreviewPanel, SAMPLE_DM329_DATA } from '../components/templates/LivePreviewPanel';
import { PlaceholderBrowserPanel } from '../components/templates/PlaceholderBrowserPanel';
import { PlaceholderWizardDialog } from '../components/templates/PlaceholderWizardDialog';
import {
  getTemplate,
  createTemplate,
  updateTemplate
} from '../services/templateService';
import type { ReportTemplate, TemplateType, TemplateContent, PlaceholderDefinition } from '../types/template';

const EMPTY_TEMPLATE: TemplateContent = {
  format: 'docx',
  metadata: {
    pageMargins: { top: 2.5, bottom: 2.5, left: 2.5, right: 1.5 },
    defaultFont: 'Cambria',
    defaultFontSize: 11
  },
  sections: [
    {
      id: 'section_1',
      title: 'Sezione 1',
      enabled: true,
      type: 'paragraph',
      template: 'Il cliente {{cliente.ragione_sociale}} è sito in {{formatIndirizzo cliente.sede_legale}}.'
    }
  ],
  partials: {},
  helpers: {}
};

export function TemplateEditor() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isNew = !id;

  // State
  const [template, setTemplate] = useState<ReportTemplate | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState<TemplateType>('dm329_technical');
  const [editorValue, setEditorValue] = useState('');
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0); // NEW: Track current section
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [browserOpen, setBrowserOpen] = useState(() => {
    // Persist drawer state in localStorage
    const saved = localStorage.getItem('template-browser-open');
    return saved ? JSON.parse(saved) : true;
  });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardType, setWizardType] = useState<'loop' | 'condition'>('loop');
  const [wizardPlaceholder, setWizardPlaceholder] = useState<PlaceholderDefinition | undefined>();

  // Load template if editing
  useEffect(() => {
    if (!isNew && id) {
      loadTemplate(id);
    } else {
      // New template
      setEditorValue(EMPTY_TEMPLATE.sections[0].template as string);
    }
  }, [id, isNew]);

  async function loadTemplate(templateId: string) {
    setLoading(true);
    try {
      const data = await getTemplate(templateId);
      if (!data) {
        setError('Template non trovato');
        return;
      }

      setTemplate(data);
      setName(data.name);
      setDescription(data.description || '');
      setTemplateType(data.template_type);

      // Load current section (or first if currentSectionIndex is out of bounds)
      if (data.content.sections.length > 0) {
        const sectionIndex = Math.min(currentSectionIndex, data.content.sections.length - 1);
        const section = data.content.sections[sectionIndex];
        setCurrentSectionIndex(sectionIndex);
        setEditorValue(
          typeof section.template === 'string'
            ? section.template
            : JSON.stringify(section.template, null, 2)
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore caricamento template');
    } finally {
      setLoading(false);
    }
  }

  // NEW: Handle section change
  function handleSectionChange(newIndex: number) {
    if (!template) return;

    // Save current section content before switching
    const updatedSections = [...template.content.sections];
    if (updatedSections[currentSectionIndex]) {
      updatedSections[currentSectionIndex] = {
        ...updatedSections[currentSectionIndex],
        template: editorValue
      };
    }

    // Update template with saved sections
    setTemplate({
      ...template,
      content: {
        ...template.content,
        sections: updatedSections
      }
    });

    // Load new section content
    const newSection = updatedSections[newIndex];
    if (newSection) {
      setEditorValue(
        typeof newSection.template === 'string'
          ? newSection.template
          : JSON.stringify(newSection.template, null, 2)
      );
    }

    setCurrentSectionIndex(newIndex);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Nome template è obbligatorio');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Build content
      const content: TemplateContent = template?.content || EMPTY_TEMPLATE;

      // Update current section with editor value before saving
      const updatedSections = [...content.sections];
      if (updatedSections[currentSectionIndex]) {
        updatedSections[currentSectionIndex] = {
          ...updatedSections[currentSectionIndex],
          template: editorValue
        };
      }

      const templateData = {
        name,
        description,
        template_type: templateType,
        content: {
          ...content,
          sections: updatedSections
        }
      };

      if (isNew) {
        const newTemplate = await createTemplate(templateData);
        setSuccessMessage('Template creato con successo!');
        navigate(`/templates/${newTemplate.id}`);
      } else {
        await updateTemplate(id!, {
          ...templateData,
          change_description: 'Modifiche da editor'
        });
        setSuccessMessage('Template salvato con successo!');
        await loadTemplate(id!);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore salvataggio template');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestRender() {
    setSaving(true);
    setError(null);

    try {
      // Build temporary content for testing
      const content: TemplateContent = {
        ...(template?.content || EMPTY_TEMPLATE),
        sections: [
          {
            id: 'test',
            title: 'Test',
            enabled: true,
            type: 'paragraph',
            template: editorValue
          }
        ]
      };

      const fileName = `Test_${name || 'Template'}_${new Date().toISOString().split('T')[0]}.docx`;

      // Use rendering engine directly
      const { templateEngine } = await import('../services/templateRenderingEngine');
      await templateEngine.renderAndDownload(content, SAMPLE_DM329_DATA, fileName);

      setSuccessMessage('Documento test DOCX generato!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore generazione test');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestRenderPDF() {
    setSaving(true);
    setError(null);

    try {
      // Build temporary content for testing
      const content: TemplateContent = {
        ...(template?.content || EMPTY_TEMPLATE),
        sections: [
          {
            id: 'test',
            title: 'Test',
            enabled: true,
            type: 'paragraph',
            template: editorValue
          }
        ]
      };

      const fileName = `Test_${name || 'Template'}_${new Date().toISOString().split('T')[0]}.pdf`;

      // Use rendering engine directly
      const { templateEngine } = await import('../services/templateRenderingEngine');
      await templateEngine.renderAndDownloadPDF(content, SAMPLE_DM329_DATA, fileName);

      setSuccessMessage('Documento test PDF generato!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore generazione test PDF');
    } finally {
      setSaving(false);
    }
  }

  function handleEditorChange(value: string) {
    setEditorValue(value);
  }

  function handleToggleBrowser() {
    setBrowserOpen(prev => {
      const newValue = !prev;
      localStorage.setItem('template-browser-open', JSON.stringify(newValue));
      return newValue;
    });
  }

  function handleInsertPlaceholder(path: string) {
    // Inserisci placeholder nell'editor
    // Se il path contiene già le graffe (helper), usalo così com'è
    const placeholder = path.includes('{{') ? path : `{{${path}}}`;

    // Aggiungi spazi per separazione corretta
    setEditorValue(prev => {
      const trimmedPrev = prev.trimEnd();
      const needsSpace = trimmedPrev.length > 0 && !trimmedPrev.endsWith(' ') && !trimmedPrev.endsWith('\n');
      return trimmedPrev + (needsSpace ? ' ' : '') + placeholder + ' ';
    });
  }

  function handleOpenWizard(type: 'loop' | 'condition', placeholder?: PlaceholderDefinition) {
    setWizardType(type);
    setWizardPlaceholder(placeholder);
    setWizardOpen(true);
  }

  function handleWizardInsert(code: string) {
    // Inserisci codice generato dal wizard
    setEditorValue(prev => prev + '\n' + code + '\n');
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Placeholder Browser Drawer */}
      <PlaceholderBrowserPanel
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onInsertPlaceholder={handleInsertPlaceholder}
        onOpenWizard={handleOpenWizard}
      />

      {/* Wizard Dialog */}
      <PlaceholderWizardDialog
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onInsert={handleWizardInsert}
        initialType={wizardType}
        initialPlaceholder={wizardPlaceholder}
      />

      {/* AppBar */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <IconButton edge="start" onClick={() => navigate('/templates')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2, flex: 1 }}>
            {isNew ? 'Nuovo Template' : `Modifica: ${name}`}
          </Typography>
          <Button
            startIcon={<BrowserIcon />}
            onClick={handleToggleBrowser}
            sx={{ mr: 1 }}
            variant={browserOpen ? 'contained' : 'outlined'}
          >
            Browser
          </Button>
          <Button
            startIcon={<PreviewIcon />}
            onClick={() => setShowPreview(!showPreview)}
            sx={{ mr: 1 }}
          >
            {showPreview ? 'Nascondi' : 'Mostra'} Preview
          </Button>
          <Button
            startIcon={<DownloadIcon />}
            onClick={handleTestRender}
            disabled={saving}
            sx={{ mr: 1 }}
          >
            Test DOCX
          </Button>
          <Button
            startIcon={<DownloadIcon />}
            onClick={handleTestRenderPDF}
            disabled={saving}
            color="secondary"
            sx={{ mr: 1 }}
          >
            Test PDF
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvataggio...' : 'Salva'}
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container
        maxWidth={false}
        sx={{
          flex: 1,
          py: 3,
          display: 'flex',
          flexDirection: 'column',
          ml: browserOpen ? '320px' : 0,
          transition: 'margin-left 0.2s ease-in-out'
        }}
      >
        {/* Template Info */}
        <Paper sx={{ p: 2, mb: 2 }}>
          <Box display="flex" gap={2}>
            <TextField
              label="Nome Template"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
            />
            <TextField
              label="Tipo"
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value as TemplateType)}
              select
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="dm329_technical">DM329 Relazione Tecnica</MenuItem>
              <MenuItem value="inail">INAIL</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </TextField>
          </Box>
          <TextField
            label="Descrizione"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            sx={{ mt: 2 }}
          />
        </Paper>

        {/* Editor + Preview */}
        <Paper sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* WYSIWYG Editor */}
          <Box sx={{ flex: showPreview ? 1 : 2, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="subtitle2" fontWeight="bold">
                    Editor Template
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Usa il pulsante "Inserisci Placeholder" per aggiungere dati dinamici
                  </Typography>
                </Box>

                {/* Section Navigator */}
                {template && template.content.sections.length > 1 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleSectionChange(currentSectionIndex - 1)}
                      disabled={currentSectionIndex === 0}
                    >
                      <ChevronLeftIcon />
                    </IconButton>

                    <Box sx={{ textAlign: 'center', minWidth: 200 }}>
                      <Typography variant="caption" display="block" color="text.secondary">
                        Sezione {currentSectionIndex + 1} di {template.content.sections.length}
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {template.content.sections[currentSectionIndex]?.title || 'Senza titolo'}
                      </Typography>
                    </Box>

                    <IconButton
                      size="small"
                      onClick={() => handleSectionChange(currentSectionIndex + 1)}
                      disabled={currentSectionIndex >= template.content.sections.length - 1}
                    >
                      <ChevronRightIcon />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              <WYSIWYGEditor
                value={editorValue}
                onChange={handleEditorChange}
                height="100%"
              />
            </Box>
          </Box>

          {/* Divider */}
          {showPreview && <Divider orientation="vertical" flexItem />}

          {/* Live Preview */}
          {showPreview && (
            <Box sx={{ flex: 1 }}>
              <LivePreviewPanel
                templateString={editorValue}
                sampleData={SAMPLE_DM329_DATA}
                height="100%"
              />
            </Box>
          )}
        </Paper>
      </Container>

      {/* Snackbar for success messages */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={4000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Snackbar for errors */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
