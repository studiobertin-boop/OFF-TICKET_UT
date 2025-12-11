/**
 * Dialog per creare e modificare tabelle
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Typography
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  AddCircleOutline as AddRowIcon,
  RemoveCircleOutline as RemoveRowIcon
} from '@mui/icons-material';
import { RichTextCellEditor } from './RichTextCellEditor';

interface TableDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (tableMarkup: string) => void;
  initialData?: {
    headers: string[];
    rows: string[][];
  };
}

export function TableDialog({ open, onClose, onSave, initialData }: TableDialogProps) {
  const [headers, setHeaders] = useState<string[]>(
    initialData?.headers || ['Intestazione 1', 'Intestazione 2', 'Intestazione 3']
  );
  const [rows, setRows] = useState<string[][]>(
    initialData?.rows || [
      ['Cella 1', 'Cella 2', 'Cella 3'],
      ['Cella 4', 'Cella 5', 'Cella 6']
    ]
  );

  function handleHeaderChange(colIndex: number, value: string) {
    const newHeaders = [...headers];
    newHeaders[colIndex] = value;
    setHeaders(newHeaders);
  }

  function handleCellChange(rowIndex: number, colIndex: number, value: string) {
    const newRows = [...rows];
    newRows[rowIndex][colIndex] = value;
    setRows(newRows);
  }

  function addColumn() {
    setHeaders([...headers, `Intestazione ${headers.length + 1}`]);
    setRows(rows.map(row => [...row, `Cella ${row.length + 1}`]));
  }

  function removeColumn() {
    if (headers.length <= 1) return;
    setHeaders(headers.slice(0, -1));
    setRows(rows.map(row => row.slice(0, -1)));
  }

  function addRow() {
    const newRow = headers.map((_, i) => `Cella ${rows.length * headers.length + i + 1}`);
    setRows([...rows, newRow]);
  }

  function removeRow() {
    if (rows.length <= 1) return;
    setRows(rows.slice(0, -1));
  }

  function handleSave() {
    // Genera markup tabella nel formato [[TABLE:id:headers::rows]]
    const tableId = `table_${Date.now()}`;
    const headersStr = headers.join('|');
    const rowsStr = rows.map(row => row.join('|')).join('||');

    const tableMarkup = `[[TABLE:${tableId}:${headersStr}::${rowsStr}]]`;

    onSave(tableMarkup);
    onClose();
  }

  function handleCancel() {
    // Reset ai valori iniziali
    setHeaders(initialData?.headers || ['Intestazione 1', 'Intestazione 2', 'Intestazione 3']);
    setRows(initialData?.rows || [
      ['Cella 1', 'Cella 2', 'Cella 3'],
      ['Cella 4', 'Cella 5', 'Cella 6']
    ]);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="lg" fullWidth>
      <DialogTitle>
        Crea Tabella
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Dimensioni: {headers.length} colonne × {rows.length} righe
          </Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={addColumn}
              variant="outlined"
            >
              Aggiungi Colonna
            </Button>
            <Button
              size="small"
              startIcon={<RemoveIcon />}
              onClick={removeColumn}
              variant="outlined"
              disabled={headers.length <= 1}
            >
              Rimuovi Colonna
            </Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              startIcon={<AddRowIcon />}
              onClick={addRow}
              variant="outlined"
            >
              Aggiungi Riga
            </Button>
            <Button
              size="small"
              startIcon={<RemoveRowIcon />}
              onClick={removeRow}
              variant="outlined"
              disabled={rows.length <= 1}
            >
              Rimuovi Riga
            </Button>
          </Box>
        </Box>

        <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                {headers.map((header, colIndex) => (
                  <TableCell key={colIndex} sx={{ bgcolor: 'grey.200' }}>
                    <RichTextCellEditor
                      value={header}
                      onChange={(value) => handleHeaderChange(colIndex, value)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, colIndex) => (
                    <TableCell key={colIndex}>
                      <RichTextCellEditor
                        value={cell}
                        onChange={(value) => handleCellChange(rowIndex, colIndex, value)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          💡 Suggerimenti:
          <br />
          • Seleziona il testo in una cella e usa i pulsanti per formattare (Grassetto, Corsivo, Colore)
          <br />
          • Puoi anche usare placeholder Handlebars nelle celle (es. <code>{'{{serbatoi[0].marca}}'}</code>)
          <br />
          • La formattazione verrà preservata nell'export PDF
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel}>
          Annulla
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Inserisci Tabella
        </Button>
      </DialogActions>
    </Dialog>
  );
}
