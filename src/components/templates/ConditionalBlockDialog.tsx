/**
 * Dialog per creare/modificare blocchi condizionali
 * Wizard-based UI per definire condizioni senza scrivere codice
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Box,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import type {
  ConditionalBlock,
  BlockVariant,
  BlockCondition
} from '../../types/template';
import { conditionToString } from '../../utils/conditionEvaluator';
import { VisualConditionBuilder } from './VisualConditionBuilder';

interface ConditionalBlockDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (block: ConditionalBlock) => void;
  initialBlock?: ConditionalBlock;
}


export function ConditionalBlockDialog({
  open,
  onClose,
  onSave,
  initialBlock
}: ConditionalBlockDialogProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [blockId, setBlockId] = useState(initialBlock?.id || `block_${Date.now()}`);
  const [showCondition, setShowCondition] = useState<BlockCondition | undefined>(
    initialBlock?.showCondition
  );
  const [variants, setVariants] = useState<BlockVariant[]>(
    initialBlock?.variants || []
  );
  const [defaultVariantId, setDefaultVariantId] = useState(
    initialBlock?.defaultVariantId || ''
  );

  // State per editare singola variante
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
  const [variantLabel, setVariantLabel] = useState('');
  const [variantContent, setVariantContent] = useState('');
  const [variantCondition, setVariantCondition] = useState<BlockCondition | undefined>();

  const steps = ['Configurazione Blocco', 'Aggiungi Varianti', 'Riepilogo'];

  function handleNext() {
    if (activeStep === steps.length - 1) {
      // Salva blocco
      const block: ConditionalBlock = {
        id: blockId,
        type: 'conditional',
        showCondition,
        variants,
        defaultVariantId: defaultVariantId || variants[0]?.id
      };
      onSave(block);
      handleClose();
    } else {
      setActiveStep(prev => prev + 1);
    }
  }

  function handleBack() {
    setActiveStep(prev => prev - 1);
  }

  function handleClose() {
    setActiveStep(0);
    setBlockId(`block_${Date.now()}`);
    setShowCondition(undefined);
    setVariants([]);
    setDefaultVariantId('');
    onClose();
  }

  function handleAddVariant() {
    if (!variantLabel.trim() || !variantContent.trim()) {
      return;
    }

    const newVariant: BlockVariant = {
      id: `variant_${Date.now()}`,
      label: variantLabel,
      content: variantContent,
      condition: variantCondition,
      isDefault: variants.length === 0 // Prima variante è default
    };

    if (editingVariantIndex !== null) {
      // Modifica esistente
      const updated = [...variants];
      updated[editingVariantIndex] = newVariant;
      setVariants(updated);
    } else {
      // Nuova variante
      setVariants([...variants, newVariant]);
    }

    // Reset form
    setVariantLabel('');
    setVariantContent('');
    setVariantCondition(undefined);
    setEditingVariantIndex(null);
  }

  function handleEditVariant(index: number) {
    const variant = variants[index];
    setVariantLabel(variant.label);
    setVariantContent(variant.content);
    setVariantCondition(variant.condition);
    setEditingVariantIndex(index);
  }

  function handleDeleteVariant(index: number) {
    setVariants(variants.filter((_, i) => i !== index));
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {initialBlock ? 'Modifica Blocco Condizionale' : 'Nuovo Blocco Condizionale'}
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {steps.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 1: Configurazione Blocco */}
        {activeStep === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info">
              Un blocco condizionale mostra testi diversi in base ai dati. Es: "il
              compressore" se ce n'è uno solo, "i compressori" se sono multipli.
            </Alert>

            <TextField
              label="ID Blocco"
              value={blockId}
              onChange={e => setBlockId(e.target.value)}
              helperText="Identificatore univoco per questo blocco"
              fullWidth
            />

            <VisualConditionBuilder
              condition={showCondition}
              onChange={setShowCondition}
              label="Condizione Visibilità Blocco (opzionale)"
              helperText="Se specificata, il blocco appare solo se la condizione è vera"
            />
          </Box>
        )}

        {/* Step 2: Aggiungi Varianti */}
        {activeStep === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info">
              Aggiungi le varianti di testo. Ogni variante può avere una condizione.
              La prima variante che soddisfa la condizione viene usata.
            </Alert>

            {/* Form aggiungi variante */}
            <Paper sx={{ p: 2, bgcolor: 'background.default' }}>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                {editingVariantIndex !== null ? 'Modifica Variante' : 'Nuova Variante'}
              </Typography>

              <TextField
                label="Etichetta"
                value={variantLabel}
                onChange={e => setVariantLabel(e.target.value)}
                placeholder="Es: Singolare, Plurale, Nessuno"
                fullWidth
                sx={{ mb: 2 }}
              />

              <TextField
                label="Testo"
                value={variantContent}
                onChange={e => setVariantContent(e.target.value)}
                placeholder="Il compressore {{compressori[0].codice}}..."
                multiline
                rows={3}
                fullWidth
                sx={{ mb: 2 }}
              />

              <VisualConditionBuilder
                condition={variantCondition}
                onChange={setVariantCondition}
                label="Condizione per questa variante (opzionale)"
                helperText="Se specificata, questa variante viene usata solo quando la condizione è vera"
              />

              <Button
                variant="contained"
                startIcon={editingVariantIndex !== null ? <EditIcon /> : <AddIcon />}
                onClick={handleAddVariant}
                disabled={!variantLabel.trim() || !variantContent.trim()}
                sx={{ mt: 2 }}
              >
                {editingVariantIndex !== null ? 'Aggiorna Variante' : 'Aggiungi Variante'}
              </Button>
            </Paper>

            {/* Lista varianti */}
            {variants.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Varianti configurate ({variants.length})
                </Typography>
                <List>
                  {variants.map((variant, index) => (
                    <ListItem key={variant.id} divider>
                      <ListItemText
                        primary={variant.label}
                        secondary={
                          <>
                            <Typography variant="body2" component="span">
                              {variant.content.substring(0, 60)}
                              {variant.content.length > 60 ? '...' : ''}
                            </Typography>
                            {variant.condition && (
                              <Typography
                                variant="caption"
                                component="div"
                                sx={{ mt: 0.5, fontStyle: 'italic' }}
                              >
                                Condizione: {conditionToString(variant.condition)}
                              </Typography>
                            )}
                          </>
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => handleEditVariant(index)}
                          sx={{ mr: 1 }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton edge="end" onClick={() => handleDeleteVariant(index)}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {variants.length === 0 && (
              <Alert severity="warning">Aggiungi almeno una variante per procedere</Alert>
            )}
          </Box>
        )}

        {/* Step 3: Riepilogo */}
        {activeStep === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="success">
              Blocco configurato! Rivedi le impostazioni prima di salvare.
            </Alert>

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2">ID Blocco</Typography>
              <Typography variant="body2">{blockId}</Typography>
            </Paper>

            {showCondition && (
              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2">Condizione Visibilità</Typography>
                <Typography variant="body2">{conditionToString(showCondition)}</Typography>
              </Paper>
            )}

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Varianti ({variants.length})
              </Typography>
              {variants.map((variant, index) => (
                <Box key={variant.id} sx={{ mb: 2 }}>
                  <Typography variant="body2" fontWeight="bold">
                    {index + 1}. {variant.label}
                    {variant.isDefault && ' (default)'}
                  </Typography>
                  <Typography variant="body2" sx={{ ml: 2 }}>
                    {variant.content}
                  </Typography>
                  {variant.condition && (
                    <Typography variant="caption" sx={{ ml: 2, fontStyle: 'italic' }}>
                      Se: {conditionToString(variant.condition)}
                    </Typography>
                  )}
                </Box>
              ))}
            </Paper>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Annulla</Button>
        <Button onClick={handleBack} disabled={activeStep === 0}>
          Indietro
        </Button>
        <Button
          onClick={handleNext}
          variant="contained"
          disabled={activeStep === 1 && variants.length === 0}
        >
          {activeStep === steps.length - 1 ? 'Salva Blocco' : 'Avanti'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

