/**
 * Visual Condition Builder con supporto AND/OR
 * Permette di costruire condizioni complesse visivamente senza scrivere codice
 */

import { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  MenuItem,
  Button,
  IconButton,
  Typography,
  Chip,
  Stack,
  Divider,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import type { BlockCondition, ConditionOperator } from '../../types/template';
import { DM329_PLACEHOLDERS } from '../../utils/templateDataSchema';
import { conditionToString } from '../../utils/conditionEvaluator';

interface VisualConditionBuilderProps {
  condition?: BlockCondition;
  onChange: (condition: BlockCondition | undefined) => void;
  label?: string;
  helperText?: string;
}

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  eq: 'uguale a',
  ne: 'diverso da',
  gt: 'maggiore di',
  gte: 'maggiore o uguale a',
  lt: 'minore di',
  lte: 'minore o uguale a',
  contains: 'contiene',
  isEmpty: 'è vuoto',
  isNotEmpty: 'non è vuoto'
};

export function VisualConditionBuilder({
  condition,
  onChange,
  label = 'Condizione',
  helperText
}: VisualConditionBuilderProps) {
  const [isBuilding, setIsBuilding] = useState(!!condition);

  // State per condizione corrente
  const [mainField, setMainField] = useState(condition?.field || '');
  const [mainOperator, setMainOperator] = useState<ConditionOperator>(
    condition?.operator || 'eq'
  );
  const [mainValue, setMainValue] = useState(condition?.value?.toString() || '');
  const [logicalOperator, setLogicalOperator] = useState<'AND' | 'OR'>(
    condition?.logicalOperator || 'AND'
  );
  const [subConditions, setSubConditions] = useState<BlockCondition[]>(
    condition?.subConditions || []
  );

  function handleStartBuilding() {
    setIsBuilding(true);
  }

  function handleClear() {
    setIsBuilding(false);
    setMainField('');
    setMainOperator('eq');
    setMainValue('');
    setLogicalOperator('AND');
    setSubConditions([]);
    onChange(undefined);
  }

  function handleApply() {
    if (!mainField) {
      return;
    }

    const newCondition: BlockCondition = {
      field: mainField,
      operator: mainOperator,
      value: parseValue(mainValue, mainOperator),
      logicalOperator: subConditions.length > 0 ? logicalOperator : undefined,
      subConditions: subConditions.length > 0 ? subConditions : undefined
    };

    onChange(newCondition);
  }

  function parseValue(val: string, op: ConditionOperator): any {
    if (op === 'isEmpty' || op === 'isNotEmpty') {
      return null;
    }
    const num = Number(val);
    if (!isNaN(num)) return num;
    return val;
  }

  function handleAddSubCondition() {
    const newSub: BlockCondition = {
      field: '',
      operator: 'eq',
      value: ''
    };
    setSubConditions([...subConditions, newSub]);
  }

  function handleUpdateSubCondition(index: number, updated: Partial<BlockCondition>) {
    const newSubs = [...subConditions];
    newSubs[index] = { ...newSubs[index], ...updated };
    setSubConditions(newSubs);
  }

  function handleDeleteSubCondition(index: number) {
    setSubConditions(subConditions.filter((_, i) => i !== index));
  }

  const needsMainValue = mainOperator !== 'isEmpty' && mainOperator !== 'isNotEmpty';
  const isValid =
    mainField &&
    (needsMainValue ? mainValue : true) &&
    subConditions.every(
      sub =>
        sub.field &&
        (sub.operator === 'isEmpty' || sub.operator === 'isNotEmpty' || sub.value)
    );

  if (!isBuilding) {
    return (
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {label}
        </Typography>
        {helperText && (
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {helperText}
          </Typography>
        )}
        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleStartBuilding}>
          Aggiungi Condizione
        </Button>
      </Box>
    );
  }

  return (
    <Paper
      sx={{
        p: 2,
        border: '2px solid',
        borderColor: 'primary.main',
        bgcolor: 'background.default'
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight="bold">
          {label}
        </Typography>
        <IconButton size="small" onClick={handleClear}>
          <CloseIcon />
        </IconButton>
      </Box>

      {helperText && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {helperText}
        </Alert>
      )}

      {/* Condizione Principale */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Condizione Principale
        </Typography>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            select
            label="Campo"
            value={mainField}
            onChange={e => setMainField(e.target.value)}
            sx={{ flex: 2 }}
            size="small"
          >
            <MenuItem value="">-- Seleziona campo --</MenuItem>
            {DM329_PLACEHOLDERS.filter(p => p.type !== 'object').map(placeholder => (
              <MenuItem key={placeholder.path} value={placeholder.path}>
                {placeholder.path}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Operatore"
            value={mainOperator}
            onChange={e => setMainOperator(e.target.value as ConditionOperator)}
            sx={{ flex: 1.5 }}
            size="small"
          >
            {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
              <MenuItem key={op} value={op}>
                {label}
              </MenuItem>
            ))}
          </TextField>

          {needsMainValue && (
            <TextField
              label="Valore"
              value={mainValue}
              onChange={e => setMainValue(e.target.value)}
              sx={{ flex: 1 }}
              size="small"
              placeholder="es: 1, 8000, true"
            />
          )}
        </Stack>
      </Box>

      {/* Operatore Logico (se ci sono sub-condizioni) */}
      {subConditions.length > 0 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" fontWeight="bold">
            Operatore Logico:
          </Typography>
          <ToggleButtonGroup
            value={logicalOperator}
            exclusive
            onChange={(_, value) => value && setLogicalOperator(value)}
            size="small"
          >
            <ToggleButton value="AND">
              <Tooltip title="Tutte le condizioni devono essere vere">
                <span>AND (E)</span>
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="OR">
              <Tooltip title="Almeno una condizione deve essere vera">
                <span>OR (O)</span>
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      )}

      {/* Sub-Condizioni */}
      {subConditions.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Divider sx={{ mb: 2 }}>
            <Chip label="Condizioni Aggiuntive" size="small" />
          </Divider>

          <Stack spacing={1.5}>
            {subConditions.map((subCond, index) => (
              <SubConditionRow
                key={index}
                condition={subCond}
                index={index}
                logicalOperator={logicalOperator}
                onUpdate={updated => handleUpdateSubCondition(index, updated)}
                onDelete={() => handleDeleteSubCondition(index)}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Azioni */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddSubCondition}
          size="small"
        >
          Aggiungi {subConditions.length > 0 ? 'Altra' : ''} Condizione
        </Button>

        <Box sx={{ flex: 1 }} />

        <Button variant="outlined" onClick={handleClear} size="small">
          Cancella
        </Button>

        <Button
          variant="contained"
          onClick={handleApply}
          disabled={!isValid}
          size="small"
        >
          Applica
        </Button>
      </Box>

      {/* Preview */}
      {isValid && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
            Anteprima Condizione:
          </Typography>
          <Typography variant="body2" fontFamily="monospace" sx={{ whiteSpace: 'pre-wrap' }}>
            {conditionToString({
              field: mainField,
              operator: mainOperator,
              value: parseValue(mainValue, mainOperator),
              logicalOperator: subConditions.length > 0 ? logicalOperator : undefined,
              subConditions: subConditions.length > 0 ? subConditions : undefined
            })}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}

/**
 * Riga singola sub-condizione
 */
interface SubConditionRowProps {
  condition: BlockCondition;
  index: number;
  logicalOperator: 'AND' | 'OR';
  onUpdate: (updated: Partial<BlockCondition>) => void;
  onDelete: () => void;
}

function SubConditionRow({
  condition,
  index,
  logicalOperator,
  onUpdate,
  onDelete
}: SubConditionRowProps) {
  const needsValue = condition.operator !== 'isEmpty' && condition.operator !== 'isNotEmpty';

  return (
    <Paper
      sx={{
        p: 1.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <DragIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
        <Chip
          label={logicalOperator}
          size="small"
          color={logicalOperator === 'AND' ? 'primary' : 'secondary'}
          sx={{ fontWeight: 'bold' }}
        />
        <Typography variant="caption" color="text.secondary">
          Condizione {index + 2}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onDelete} color="error">
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          select
          value={condition.field}
          onChange={e => onUpdate({ field: e.target.value })}
          sx={{ flex: 2 }}
          size="small"
          placeholder="Campo"
        >
          <MenuItem value="">-- Seleziona campo --</MenuItem>
          {DM329_PLACEHOLDERS.filter(p => p.type !== 'object').map(placeholder => (
            <MenuItem key={placeholder.path} value={placeholder.path}>
              {placeholder.path}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          value={condition.operator}
          onChange={e => onUpdate({ operator: e.target.value as ConditionOperator })}
          sx={{ flex: 1.5 }}
          size="small"
        >
          {Object.entries(OPERATOR_LABELS).map(([op, label]) => (
            <MenuItem key={op} value={op}>
              {label}
            </MenuItem>
          ))}
        </TextField>

        {needsValue && (
          <TextField
            value={condition.value?.toString() || ''}
            onChange={e => onUpdate({ value: e.target.value })}
            sx={{ flex: 1 }}
            size="small"
            placeholder="Valore"
          />
        )}
      </Stack>
    </Paper>
  );
}
