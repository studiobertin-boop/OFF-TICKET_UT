/**
 * PlaceholderWizardDialog - Dialog wizard per generare codice Handlebars
 *
 * Features:
 * - Tab Loop: genera {{#each}} per array
 * - Tab Condizione: genera {{#if}} con operatori
 * - Preview live con SAMPLE_DM329_DATA
 * - Validazione sintassi
 */

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Tabs,
  Tab,
  TextField,
  MenuItem,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Typography,
  Paper,
  Divider,
  Alert
} from '@mui/material';
import {
  Loop as LoopIcon,
  QuestionMark as ConditionIcon,
  Visibility as PreviewIcon
} from '@mui/icons-material';
import Handlebars from 'handlebars';
import type { PlaceholderDefinition } from '../../types/template';
import { DM329_PLACEHOLDERS } from '../../utils/templateDataSchema';
import { SAMPLE_DM329_DATA } from './LivePreviewPanel';
import {
  generateLoopCode,
  generateConditionalCode,
  getArrayFields,
  validateHandlebars,
  OPERATORS,
  type LoopCodeOptions,
  type ConditionalCodeOptions
} from '../../utils/codeGenerators';

interface PlaceholderWizardDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (code: string) => void;
  initialPlaceholder?: PlaceholderDefinition;
  initialType?: 'loop' | 'condition';
}

export function PlaceholderWizardDialog({
  open,
  onClose,
  onInsert,
  initialPlaceholder,
  initialType = 'loop'
}: PlaceholderWizardDialogProps) {
  const [activeTab, setActiveTab] = useState(initialType === 'loop' ? 0 : 1);

  // Loop state
  const [selectedArray, setSelectedArray] = useState(initialPlaceholder?.path || '');
  const [outputType, setOutputType] = useState<'text' | 'table' | 'list'>('table');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [customTemplate, setCustomTemplate] = useState('');

  // Condition state
  const [conditionField, setConditionField] = useState('');
  const [conditionOperator, setConditionOperator] = useState<'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'>('gt');
  const [conditionValue, setConditionValue] = useState('');
  const [trueContent, setTrueContent] = useState('');
  const [falseContent, setFalseContent] = useState('');

  // Array placeholders disponibili
  const arrayPlaceholders = useMemo(() => {
    const arrays: PlaceholderDefinition[] = [];
    const findArrays = (items: PlaceholderDefinition[]) => {
      items.forEach(item => {
        if (item.type.includes('array')) {
          arrays.push(item);
        }
        if (item.children) {
          findArrays(item.children);
        }
      });
    };
    findArrays(DM329_PLACEHOLDERS);
    return arrays;
  }, []);

  // Campi disponibili per array selezionato
  const availableFields = useMemo(() => {
    if (!selectedArray) return [];
    const placeholder = arrayPlaceholders.find(p => p.path === selectedArray);
    return placeholder ? getArrayFields(placeholder) : [];
  }, [selectedArray, arrayPlaceholders]);

  // Genera codice
  const generatedCode = useMemo(() => {
    if (activeTab === 0) {
      // Loop
      if (!selectedArray) return '';

      const options: LoopCodeOptions = {
        arrayPath: selectedArray,
        outputType,
        selectedFields,
        customTemplate: outputType === 'text' ? customTemplate : undefined
      };

      return generateLoopCode(options);
    } else {
      // Condition
      if (!conditionField) return '';

      const options: ConditionalCodeOptions = {
        field: conditionField,
        operator: conditionOperator,
        value: isNaN(Number(conditionValue)) ? conditionValue : Number(conditionValue),
        trueContent,
        falseContent: falseContent || undefined
      };

      return generateConditionalCode(options);
    }
  }, [activeTab, selectedArray, outputType, selectedFields, customTemplate, conditionField, conditionOperator, conditionValue, trueContent, falseContent]);

  // Preview renderizzato
  const preview = useMemo(() => {
    if (!generatedCode) return '';

    try {
      const template = Handlebars.compile(generatedCode);
      return template(SAMPLE_DM329_DATA);
    } catch (error) {
      return `Errore rendering: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`;
    }
  }, [generatedCode]);

  // Validazione
  const validation = useMemo(() => {
    if (!generatedCode) return { valid: false, errors: [] };
    return validateHandlebars(generatedCode);
  }, [generatedCode]);

  const handleInsert = () => {
    if (validation.valid && generatedCode) {
      onInsert(generatedCode);
      handleClose();
    }
  };

  const handleClose = () => {
    // Reset state
    setSelectedArray('');
    setOutputType('table');
    setSelectedFields([]);
    setCustomTemplate('');
    setConditionField('');
    setConditionOperator('gt');
    setConditionValue('');
    setTrueContent('');
    setFalseContent('');
    onClose();
  };

  const handleFieldToggle = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Wizard Placeholder
      </DialogTitle>

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tab icon={<LoopIcon />} label="Loop Array" />
        <Tab icon={<ConditionIcon />} label="Condizione" />
      </Tabs>

      <DialogContent sx={{ minHeight: 500 }}>
        {/* TAB LOOP */}
        {activeTab === 0 && (
          <Box sx={{ pt: 2 }}>
            <FormControl fullWidth sx={{ mb: 3 }}>
              <TextField
                select
                label="Seleziona Array"
                value={selectedArray}
                onChange={(e) => {
                  setSelectedArray(e.target.value);
                  setSelectedFields([]); // Reset fields quando cambia array
                }}
                helperText="Scegli quale array ciclare"
              >
                {arrayPlaceholders.map(p => (
                  <MenuItem key={p.path} value={p.path}>
                    {p.path} - {p.description}
                  </MenuItem>
                ))}
              </TextField>
            </FormControl>

            {selectedArray && (
              <>
                <FormControl component="fieldset" sx={{ mb: 3 }}>
                  <FormLabel>Tipo Output</FormLabel>
                  <RadioGroup
                    row
                    value={outputType}
                    onChange={(e) => setOutputType(e.target.value as any)}
                  >
                    <FormControlLabel value="table" control={<Radio />} label="Tabella HTML" />
                    <FormControlLabel value="list" control={<Radio />} label="Lista puntata" />
                    <FormControlLabel value="text" control={<Radio />} label="Testo custom" />
                  </RadioGroup>
                </FormControl>

                {outputType !== 'text' && (
                  <FormControl component="fieldset" sx={{ mb: 3 }}>
                    <FormLabel>Campi da Mostrare</FormLabel>
                    <FormGroup>
                      {availableFields.map(field => (
                        <FormControlLabel
                          key={field}
                          control={
                            <Checkbox
                              checked={selectedFields.includes(field)}
                              onChange={() => handleFieldToggle(field)}
                            />
                          }
                          label={field}
                        />
                      ))}
                    </FormGroup>
                  </FormControl>
                )}

                {outputType === 'text' && (
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Template Testo"
                    value={customTemplate}
                    onChange={(e) => setCustomTemplate(e.target.value)}
                    helperText="Usa {{this.campo}} per accedere ai campi. Esempio: {{this.codice}} - {{this.marca}}"
                    sx={{ mb: 3 }}
                  />
                )}
              </>
            )}
          </Box>
        )}

        {/* TAB CONDITION */}
        {activeTab === 1 && (
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Campo da verificare"
              value={conditionField}
              onChange={(e) => setConditionField(e.target.value)}
              placeholder="es: serbatoi.length o cliente.ragione_sociale"
              sx={{ mb: 2 }}
            />

            <TextField
              select
              fullWidth
              label="Operatore"
              value={conditionOperator}
              onChange={(e) => setConditionOperator(e.target.value as any)}
              sx={{ mb: 2 }}
            >
              {OPERATORS.map(op => (
                <MenuItem key={op.value} value={op.value}>
                  {op.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Valore"
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              placeholder="es: 0 oppure 'ACME'"
              helperText="Per stringhe usa apici singoli: 'testo'"
              sx={{ mb: 3 }}
            />

            <Divider sx={{ my: 2 }} />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Contenuto se VERO"
              value={trueContent}
              onChange={(e) => setTrueContent(e.target.value)}
              placeholder="Testo da mostrare quando la condizione è vera"
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Contenuto se FALSO (opzionale)"
              value={falseContent}
              onChange={(e) => setFalseContent(e.target.value)}
              placeholder="Testo da mostrare quando la condizione è falsa"
            />
          </Box>
        )}

        {/* PREVIEW */}
        <Divider sx={{ my: 3 }} />

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PreviewIcon />
            <Typography variant="h6">Preview</Typography>
          </Box>

          {validation.errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="subtitle2">Errori di validazione:</Typography>
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                {validation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </Alert>
          )}

          <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Codice Generato:
            </Typography>
            <Box
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                m: 0
              }}
            >
              {generatedCode || '(seleziona opzioni per generare codice)'}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Output Renderizzato (con dati esempio):
            </Typography>
            <Box
              sx={{
                fontSize: '0.875rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}
              dangerouslySetInnerHTML={{ __html: preview || '(nessun output)' }}
            />
          </Paper>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Annulla</Button>
        <Button
          variant="contained"
          onClick={handleInsert}
          disabled={!validation.valid || !generatedCode}
        >
          Inserisci Codice
        </Button>
      </DialogActions>
    </Dialog>
  );
}
