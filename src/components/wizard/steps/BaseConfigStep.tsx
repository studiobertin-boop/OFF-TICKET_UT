/**
 * Step 1: Configurazione Base Template
 * Nome, descrizione, tipo template
 */

import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Paper
} from '@mui/material';
import type { TemplateType } from '../../../types/template';

interface BaseConfigStepProps {
  name: string;
  description: string;
  templateType: TemplateType;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onTemplateTypeChange: (type: TemplateType) => void;
  validationErrors?: Record<string, string>;
}

export function BaseConfigStep({
  name,
  description,
  templateType,
  onNameChange,
  onDescriptionChange,
  onTemplateTypeChange,
  validationErrors = {}
}: BaseConfigStepProps) {
  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Configurazione Base
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Inizia configurando le informazioni di base del template
      </Typography>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Nome Template */}
          <TextField
            fullWidth
            required
            label="Nome Template"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            error={!!validationErrors.name}
            helperText={validationErrors.name || 'Es: Relazione Tecnica DM329 Standard'}
            placeholder="Inserisci un nome descrittivo"
          />

          {/* Descrizione */}
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Descrizione"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            helperText="Descrivi brevemente lo scopo di questo template (opzionale)"
            placeholder="Es: Template completo per relazioni tecniche su impianti aria compressa secondo D.M. 329/2004"
          />

          {/* Tipo Template */}
          <FormControl fullWidth required>
            <InputLabel>Tipo Template</InputLabel>
            <Select
              value={templateType}
              label="Tipo Template"
              onChange={(e) => onTemplateTypeChange(e.target.value as TemplateType)}
            >
              <MenuItem value="dm329_technical">
                DM329 Relazione Tecnica
              </MenuItem>
              <MenuItem value="inail">
                INAIL Verifica Periodica
              </MenuItem>
              <MenuItem value="custom">
                Custom (Personalizzato)
              </MenuItem>
            </Select>
          </FormControl>

          {/* Info Template Type */}
          {templateType === 'dm329_technical' && (
            <Alert severity="info">
              <Typography variant="body2">
                <strong>DM329 Relazione Tecnica</strong> - Template per relazioni tecniche su impianti
                a pressione secondo D.M. 329/2004. Include sezioni standard per apparecchiature,
                calcoli PS×V, verifica spessimetrica e valvole di sicurezza.
              </Typography>
            </Alert>
          )}

          {templateType === 'inail' && (
            <Alert severity="info">
              <Typography variant="body2">
                <strong>INAIL Verifica Periodica</strong> - Template per documentazione verifiche
                periodiche INAIL su attrezzature a pressione. Include sezioni specifiche per verbali
                e schede tecniche.
              </Typography>
            </Alert>
          )}

          {templateType === 'custom' && (
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Custom</strong> - Template personalizzato senza struttura predefinita.
                Potrai configurare liberamente tutte le sezioni.
              </Typography>
            </Alert>
          )}
        </Box>
      </Paper>

      {/* Suggerimento */}
      <Alert severity="success" sx={{ mt: 3 }}>
        <Typography variant="body2">
          💡 <strong>Suggerimento:</strong> Scegli un nome chiaro e descrittivo. Potrai sempre
          modificarlo in seguito. Se parti da un template esistente simile, considera di duplicarlo
          invece di crearne uno nuovo.
        </Typography>
      </Alert>
    </Box>
  );
}
