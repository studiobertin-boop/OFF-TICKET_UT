/**
 * Step 2: Selezione Sezioni
 * Checkbox per selezionare sezioni predefinite da includere nel template
 */

import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Paper,
  Chip,
  Grid,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Description as DescriptionIcon,
  TableChart as TableChartIcon,
  Calculate as CalculateIcon,
  Code as CodeIcon
} from '@mui/icons-material';
import { getPredefinedSectionsByType } from '../../../utils/predefinedSections';
import type { TemplateType } from '../../../types/template';
import type { PredefinedSection } from '../../../types/wizard';

interface SectionSelectionStepProps {
  templateType: TemplateType;
  selectedSections: string[];
  onToggleSection: (sectionId: string) => void;
  validationErrors?: Record<string, string>;
}

// Icone per tipo sezione
const getSectionIcon = (type: string) => {
  switch (type) {
    case 'dynamic_text':
    case 'conditional':
      return <DescriptionIcon fontSize="small" />;
    case 'table':
      return <TableChartIcon fontSize="small" />;
    case 'calculation':
      return <CalculateIcon fontSize="small" />;
    default:
      return <CodeIcon fontSize="small" />;
  }
};

// Colore chip per categoria
const getCategoryColor = (category: string) => {
  switch (category) {
    case 'intestazione':
      return 'primary';
    case 'descrizione':
      return 'secondary';
    case 'tabelle':
      return 'info';
    case 'calcoli':
      return 'success';
    case 'conclusioni':
      return 'warning';
    default:
      return 'default';
  }
};

export function SectionSelectionStep({
  templateType,
  selectedSections,
  onToggleSection,
  validationErrors = {}
}: SectionSelectionStepProps) {
  const availableSections = getPredefinedSectionsByType(templateType);

  // Raggruppa sezioni per categoria
  const sectionsByCategory = availableSections.reduce((acc, section) => {
    if (!acc[section.category]) {
      acc[section.category] = [];
    }
    acc[section.category].push(section);
    return acc;
  }, {} as Record<string, PredefinedSection[]>);

  const categoryLabels: Record<string, string> = {
    intestazione: 'Intestazione',
    descrizione: 'Descrizione Impianto',
    tabelle: 'Tabelle Dati',
    calcoli: 'Calcoli e Verifiche',
    conclusioni: 'Conclusioni e Note'
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Seleziona Sezioni
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Scegli quali sezioni includere nel template. Potrai configurarle nel prossimo step.
      </Typography>

      {validationErrors.sections && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {validationErrors.sections}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            Sezioni selezionate: <strong>{selectedSections.length}</strong> / {availableSections.length}
          </Typography>
          {selectedSections.length > 0 && (
            <Chip
              label="Pronte da configurare"
              color="success"
              size="small"
            />
          )}
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.entries(sectionsByCategory).map(([category, sections]) => (
          <Accordion key={category} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="subtitle1" fontWeight="medium">
                  {categoryLabels[category] || category}
                </Typography>
                <Chip
                  label={sections.length}
                  size="small"
                  color={getCategoryColor(category)}
                  sx={{ minWidth: 28 }}
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <FormGroup>
                {sections.map((section) => (
                  <Box
                    key={section.id}
                    sx={{
                      py: 1,
                      px: 2,
                      borderRadius: 1,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedSections.includes(section.id)}
                          onChange={() => onToggleSection(section.id)}
                        />
                      }
                      label={
                        <Box sx={{ ml: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getSectionIcon(section.type)}
                            <Typography variant="body1">
                              {section.name}
                            </Typography>
                            <Chip
                              label={section.type}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {section.description}
                          </Typography>
                          {section.requiredData.length > 0 && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                              📊 Dati richiesti: {section.requiredData.join(', ')}
                            </Typography>
                          )}
                        </Box>
                      }
                      sx={{ alignItems: 'flex-start', width: '100%' }}
                    />
                  </Box>
                ))}
              </FormGroup>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>

      {selectedSections.length === 0 && (
        <Alert severity="info" sx={{ mt: 3 }}>
          <Typography variant="body2">
            💡 <strong>Suggerimento:</strong> Seleziona le sezioni che vuoi includere nel template.
            Per un template DM329 completo, ti consigliamo di selezionare almeno: Intestazione, Premessa,
            Descrizione Generale, Tabella Riepilogo e Conclusioni.
          </Typography>
        </Alert>
      )}

      {selectedSections.length > 0 && (
        <Alert severity="success" sx={{ mt: 3 }}>
          <Typography variant="body2">
            ✓ Hai selezionato {selectedSections.length} sezioni. Nel prossimo step potrai configurarle
            in dettaglio (campi, colonne tabelle, ecc.).
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
