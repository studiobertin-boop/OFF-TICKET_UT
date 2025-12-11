/**
 * SnippetLibrary - Componente per visualizzare e inserire snippet predefiniti
 *
 * Features:
 * - Lista snippet categorizzati (testi, tabelle, condizionali, calcoli, loop)
 * - Preview codice con syntax highlighting
 * - Preview output renderizzato con sample data
 * - Ricerca testuale
 * - Click-to-insert
 */

import { useState, useMemo } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Divider,
  Button
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  Code as CodeIcon,
  Visibility as PreviewIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import Handlebars from 'handlebars';
import { ALL_SNIPPETS } from '../../utils/snippets';
import { searchSnippets, type TemplateSnippet } from '../../utils/snippetGenerator';
import { SAMPLE_DM329_DATA } from './LivePreviewPanel';
import { registerAllHelpers } from '../../utils/templateHelpers';

// Registra helper al caricamento del modulo
registerAllHelpers();

interface SnippetLibraryProps {
  onInsert: (code: string) => void;
}

const CATEGORY_LABELS = {
  testi: 'Testi Standard',
  tabelle: 'Tabelle',
  condizionali: 'Condizionali',
  calcoli: 'Calcoli',
  loop: 'Loop Array'
};

const CATEGORY_ICONS = {
  testi: '📄',
  tabelle: '📊',
  condizionali: '❓',
  calcoli: '🧮',
  loop: '🔄'
};

export function SnippetLibrary({ onInsert }: SnippetLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSnippet, setSelectedSnippet] = useState<TemplateSnippet | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Filtra snippet in base alla ricerca
  const filteredSnippets = useMemo(() => {
    return searchSnippets(ALL_SNIPPETS, searchQuery);
  }, [searchQuery]);

  // Raggruppa snippet filtrati per categoria
  const groupedSnippets = useMemo(() => {
    const groups: Record<string, TemplateSnippet[]> = {
      testi: [],
      tabelle: [],
      condizionali: [],
      calcoli: [],
      loop: []
    };

    filteredSnippets.forEach(snippet => {
      groups[snippet.category].push(snippet);
    });

    return groups;
  }, [filteredSnippets]);

  // Renderizza preview snippet con sample data
  const renderPreview = (snippet: TemplateSnippet): string => {
    try {
      const template = Handlebars.compile(snippet.code);
      return template(SAMPLE_DM329_DATA);
    } catch (error) {
      return `Errore rendering: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`;
    }
  };

  const handleInsert = (snippet: TemplateSnippet) => {
    // Assicura che ci siano spazi intorno allo snippet inserito
    const codeToInsert = `\n${snippet.code}\n`;
    onInsert(codeToInsert);
    setSelectedSnippet(null);
  };

  const handleCopyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <Box sx={{ p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Cerca snippet..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            )
          }}
        />
      </Box>

      <Divider />

      {/* Snippet List by Category */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {Object.entries(groupedSnippets).map(([category, snippets]) => {
          if (snippets.length === 0) return null;

          return (
            <Accordion
              key={category}
              defaultExpanded={category === 'testi'}
              sx={{ mb: 1 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="body2">
                    {CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS]}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                  </Typography>
                  <Chip
                    label={snippets.length}
                    size="small"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                <List dense>
                  {snippets.map((snippet) => (
                    <ListItem
                      key={snippet.id}
                      disablePadding
                      secondaryAction={
                        snippet.autoGenerated && (
                          <Chip
                            label="auto"
                            size="small"
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                        )
                      }
                    >
                      <ListItemButton
                        selected={selectedSnippet?.id === snippet.id}
                        onClick={() => setSelectedSnippet(snippet)}
                      >
                        <ListItemText
                          primary={snippet.name}
                          secondary={snippet.description}
                          primaryTypographyProps={{
                            fontSize: '0.875rem',
                            fontWeight: selectedSnippet?.id === snippet.id ? 600 : 400
                          }}
                          secondaryTypographyProps={{
                            fontSize: '0.75rem'
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* No Results */}
        {filteredSnippets.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Nessuno snippet trovato per "{searchQuery}"
            </Typography>
          </Box>
        )}
      </Box>

      {/* Preview Panel */}
      {selectedSnippet && (
        <>
          <Divider />
          <Box sx={{ p: 2, bgcolor: 'background.default' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight="bold">
                {selectedSnippet.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => setShowPreview(!showPreview)}
                  color={showPreview ? 'primary' : 'default'}
                >
                  <PreviewIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => handleCopyToClipboard(selectedSnippet.code)}
                  title="Copia codice"
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              {selectedSnippet.description}
            </Typography>

            {/* Code Preview */}
            <Paper variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: 'background.paper' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <CodeIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  Codice:
                </Typography>
              </Box>
              <Box
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  m: 0,
                  maxHeight: '150px',
                  overflow: 'auto'
                }}
              >
                {selectedSnippet.code}
              </Box>
            </Paper>

            {/* Rendered Preview */}
            {showPreview && (
              <Paper variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: 'action.hover' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <PreviewIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    Anteprima (dati esempio):
                  </Typography>
                </Box>
                <Box
                  sx={{
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '150px',
                    overflow: 'auto'
                  }}
                  dangerouslySetInnerHTML={{ __html: renderPreview(selectedSnippet) }}
                />
              </Paper>
            )}

            {/* Insert Button */}
            <Button
              fullWidth
              variant="contained"
              size="small"
              onClick={() => handleInsert(selectedSnippet)}
              startIcon={<CodeIcon />}
            >
              Inserisci Snippet
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
