/**
 * Editor ricco per celle di tabella con formattazione
 */

import { useState, useRef, useEffect } from 'react';
import {
  Box,
  IconButton,
  TextField,
  Popover,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  FormatColorText as ColorIcon
} from '@mui/icons-material';

interface RichTextCellEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

export function RichTextCellEditor({ value, onChange, onBlur }: RichTextCellEditorProps) {
  const [htmlValue, setHtmlValue] = useState(value);
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHtmlValue(value);
  }, [value]);

  // Colori comuni
  const colors = [
    { name: 'Nero', value: '#000000' },
    { name: 'Rosso', value: '#FF0000' },
    { name: 'Blu', value: '#0000FF' },
    { name: 'Verde', value: '#008000' },
    { name: 'Arancione', value: '#FFA500' },
    { name: 'Viola', value: '#800080' }
  ];

  function wrapSelection(tagOpen: string, tagClose: string) {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const selectedText = htmlValue.substring(start, end);

    if (selectedText) {
      const newValue =
        htmlValue.substring(0, start) +
        tagOpen + selectedText + tagClose +
        htmlValue.substring(end);

      setHtmlValue(newValue);
      onChange(newValue);

      // Ripristina focus e selezione
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + tagOpen.length, end + tagOpen.length);
      }, 0);
    }
  }

  function handleBold() {
    wrapSelection('<b>', '</b>');
  }

  function handleItalic() {
    wrapSelection('<i>', '</i>');
  }

  function handleUnderline() {
    wrapSelection('<u>', '</u>');
  }

  function handleColorClick(event: React.MouseEvent<HTMLElement>) {
    setColorAnchor(event.currentTarget);
  }

  function handleColorClose() {
    setColorAnchor(null);
  }

  function handleColorSelect(color: string) {
    wrapSelection(`<span style="color:${color}">`, '</span>');
    handleColorClose();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newValue = e.target.value;
    setHtmlValue(newValue);
    onChange(newValue);
  }

  return (
    <Box>
      {/* Toolbar formattazione */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
        <IconButton
          size="small"
          onClick={handleBold}
          title="Grassetto (seleziona testo e clicca)"
          sx={{ bgcolor: 'action.hover' }}
        >
          <BoldIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={handleItalic}
          title="Corsivo (seleziona testo e clicca)"
          sx={{ bgcolor: 'action.hover' }}
        >
          <ItalicIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={handleUnderline}
          title="Sottolineato (seleziona testo e clicca)"
          sx={{ bgcolor: 'action.hover' }}
        >
          <UnderlineIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          onClick={handleColorClick}
          title="Colore (seleziona testo e clicca)"
          sx={{ bgcolor: 'action.hover' }}
        >
          <ColorIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Input testo */}
      <TextField
        inputRef={inputRef}
        fullWidth
        size="small"
        value={htmlValue}
        onChange={handleChange}
        onBlur={onBlur}
        multiline
        maxRows={3}
        placeholder="Seleziona il testo e usa i pulsanti per formattare"
      />

      {/* Popover colori */}
      <Popover
        open={Boolean(colorAnchor)}
        anchorEl={colorAnchor}
        onClose={handleColorClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Box sx={{ p: 1, display: 'flex', gap: 1, flexWrap: 'wrap', maxWidth: 200 }}>
          {colors.map((color) => (
            <Box
              key={color.value}
              onClick={() => handleColorSelect(color.value)}
              sx={{
                width: 32,
                height: 32,
                bgcolor: color.value,
                border: '1px solid #ccc',
                cursor: 'pointer',
                borderRadius: 1,
                '&:hover': {
                  transform: 'scale(1.1)',
                  boxShadow: 2
                }
              }}
              title={color.name}
            />
          ))}
        </Box>
      </Popover>
    </Box>
  );
}
