/**
 * Editor WYSIWYG con supporto formattazione e placeholder Handlebars
 */

import { useRef, useState, useEffect } from 'react';
import ReactQuill, { Quill } from 'react-quill';
import 'quill/dist/quill.snow.css';
import './quill-custom.css';
import {
  Box,
  Button,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Typography
} from '@mui/material';
import {
  Code as PlaceholderIcon,
  InsertPageBreak as PageBreakIcon,
  CallSplit as ConditionalIcon,
  TableChart as TableIcon
} from '@mui/icons-material';
import { DM329_PLACEHOLDERS } from '../../utils/templateDataSchema';
import { AVAILABLE_HELPERS } from '../../utils/templateHelpers';
import { ConditionalBlockDialog } from './ConditionalBlockDialog';
import { TableDialog } from './TableDialog';
import type { ConditionalBlock } from '../../types/template';

// Registra custom format per line-height
const Parchment = Quill.import('parchment') as any;
const LineHeightStyle = new Parchment.Attributor.Style('lineheight', 'line-height', {
  scope: Parchment.Scope.BLOCK,
  whitelist: ['1', '1.15', '1.5', '1.6', '2', '2.5']
});
Quill.register(LineHeightStyle, true);

// Registra font personalizzati
const Font = Quill.import('formats/font') as any;
Font.whitelist = ['cambria', 'arial', 'times', 'courier'];
Quill.register(Font, true);

interface WYSIWYGEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

export function WYSIWYGEditor({ value, onChange, height = '600px' }: WYSIWYGEditorProps) {
  const quillRef = useRef<ReactQuill>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [conditionalDialogOpen, setConditionalDialogOpen] = useState(false);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);

  // Configurazione toolbar Quill (toolbar integrata)
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      [{ 'font': ['cambria', 'arial', 'times', 'courier'] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'align': [] }],
      [{ 'lineheight': ['1', '1.15', '1.5', '1.6', '2', '2.5'] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['clean']
    ]
  };

  const formats = [
    'header',
    'font',
    'size',
    'bold',
    'italic',
    'underline',
    'color',
    'background',
    'align',
    'lineheight',
    'list',
    'bullet',
    'table'
  ];

  function handleInsertPlaceholder(event: React.MouseEvent<HTMLElement>) {
    setAnchorEl(event.currentTarget);
  }

  function insertPlaceholder(placeholder: string) {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      // Focus l'editor prima di inserire
      quill.focus();

      // Ottieni la selezione corrente o usa la fine del documento
      let range = quill.getSelection();
      if (!range) {
        range = { index: quill.getLength() - 1, length: 0 };
      }

      // Prepara il testo da inserire con spazi per separazione
      const textToInsert = ` {{${placeholder}}} `;

      // Inserisci il testo
      quill.insertText(range.index, textToInsert, 'user');

      // Posiziona il cursore dopo il placeholder inserito
      quill.setSelection(range.index + textToInsert.length, 0);

      // Forza l'aggiornamento usando un timeout per assicurarsi che Quill abbia processato l'inserimento
      setTimeout(() => {
        onChange(quill.root.innerHTML);
      }, 10);
    }
    setAnchorEl(null);
    setSearchQuery('');
  }

  function insertHelper(helperUsage: string) {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      // Focus l'editor prima di inserire
      quill.focus();

      // Ottieni la selezione corrente o usa la fine del documento
      let range = quill.getSelection();
      if (!range) {
        range = { index: quill.getLength() - 1, length: 0 };
      }

      // Aggiungi spazi intorno all'helper per separazione
      const textToInsert = ` ${helperUsage} `;

      quill.insertText(range.index, textToInsert, 'user');
      quill.setSelection(range.index + textToInsert.length, 0);

      // Forza l'aggiornamento con timeout
      setTimeout(() => {
        onChange(quill.root.innerHTML);
      }, 10);
    }
    setAnchorEl(null);
    setSearchQuery('');
  }

  function handleInsertPageBreak() {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      // Focus l'editor
      quill.focus();

      // Ottieni la selezione corrente o usa la fine del documento
      let range = quill.getSelection();
      if (!range) {
        range = { index: quill.getLength(), length: 0 };
      }

      // Inserisci il marcatore di interruzione di pagina
      const pageBreakMarker = '\n{{pageBreak}}\n';
      quill.insertText(range.index, pageBreakMarker);
      quill.setSelection(range.index + pageBreakMarker.length, 0);

      // Notifica il cambiamento
      onChange(quill.root.innerHTML);
    }
  }

  function handleSaveConditionalBlock(block: ConditionalBlock) {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      quill.focus();

      let range = quill.getSelection();
      if (!range) {
        range = { index: quill.getLength(), length: 0 };
      }

      // Genera markup per blocco condizionale
      // Formato: [[CONDITIONAL:block_id]]
      const blockMarker = `\n[[CONDITIONAL:${block.id}]]\n`;
      quill.insertText(range.index, blockMarker);
      quill.setSelection(range.index + blockMarker.length, 0);

      onChange(quill.root.innerHTML);
    }
    setConditionalDialogOpen(false);
  }

  function handleInsertTable() {
    setTableDialogOpen(true);
  }

  function handleSaveTable(tableMarkup: string) {
    const quill = quillRef.current?.getEditor();
    if (quill) {
      quill.focus();

      let range = quill.getSelection();
      if (!range) {
        range = { index: quill.getLength(), length: 0 };
      }

      // Inserisci il markup della tabella come testo
      const textToInsert = `\n${tableMarkup}\n`;
      quill.insertText(range.index, textToInsert, 'user');
      quill.setSelection(range.index + textToInsert.length, 0);

      // Notifica cambiamento
      onChange(quill.root.innerHTML);
    }
    setTableDialogOpen(false);
  }

  // Filtra placeholder e helper in base alla ricerca
  const filteredPlaceholders = DM329_PLACEHOLDERS.filter(p =>
    p.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredHelpers = AVAILABLE_HELPERS.filter(h =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Evidenzia markup tabelle nell'editor
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const highlightTables = () => {
      const editor = quill.root;
      const paragraphs = editor.querySelectorAll('p');

      paragraphs.forEach((p) => {
        if (p.textContent?.includes('[[TABLE:')) {
          p.classList.add('table-markup');
        } else {
          p.classList.remove('table-markup');
        }
      });
    };

    // Esegui inizialmente
    highlightTables();

    // Ascolta cambiamenti di testo
    quill.on('text-change', highlightTables);

    return () => {
      quill.off('text-change', highlightTables);
    };
  }, [value]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height }}>
      {/* Pulsanti sopra editor */}
      <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="contained"
          startIcon={<PlaceholderIcon />}
          onClick={handleInsertPlaceholder}
        >
          Inserisci Placeholder
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<TableIcon />}
          onClick={handleInsertTable}
          color="primary"
        >
          Inserisci Tabella
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ConditionalIcon />}
          onClick={() => setConditionalDialogOpen(true)}
          color="secondary"
        >
          Blocco Condizionale
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<PageBreakIcon />}
          onClick={handleInsertPageBreak}
        >
          Interruzione Pagina
        </Button>
      </Box>

      {/* Editor Quill con toolbar integrata */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        />
      </Box>

      {/* Popover per selezione placeholder/helper */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null);
          setSearchQuery('');
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left'
        }}
      >
        <Box sx={{ width: 400, maxHeight: 500, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Cerca placeholder o helper..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {/* Placeholder */}
            {filteredPlaceholders.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ p: 2, pb: 0, fontWeight: 'bold' }}>
                  Placeholder ({filteredPlaceholders.length})
                </Typography>
                <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {filteredPlaceholders.map((placeholder) => (
                    <ListItem key={placeholder.path} disablePadding>
                      <ListItemButton onClick={() => insertPlaceholder(placeholder.path)}>
                        <ListItemText
                          primary={placeholder.path}
                          secondary={placeholder.description}
                          primaryTypographyProps={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {/* Helper */}
            {filteredHelpers.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ p: 2, pb: 0, pt: 1, fontWeight: 'bold' }}>
                  Helper ({filteredHelpers.length})
                </Typography>
                <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {filteredHelpers.map((helper) => (
                    <ListItem key={helper.name} disablePadding>
                      <ListItemButton onClick={() => insertHelper(helper.usage)}>
                        <ListItemText
                          primary={helper.name}
                          secondary={helper.description}
                          primaryTypographyProps={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {filteredPlaceholders.length === 0 && filteredHelpers.length === 0 && (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">Nessun risultato trovato</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Popover>

      {/* Dialog blocco condizionale */}
      <ConditionalBlockDialog
        open={conditionalDialogOpen}
        onClose={() => setConditionalDialogOpen(false)}
        onSave={handleSaveConditionalBlock}
      />

      {/* Dialog tabella */}
      <TableDialog
        open={tableDialogOpen}
        onClose={() => setTableDialogOpen(false)}
        onSave={handleSaveTable}
      />
    </Box>
  );
}
