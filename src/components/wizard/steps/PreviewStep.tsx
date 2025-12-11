/**
 * Step 4: Preview Template
 * Mostra anteprima configurazione e permette test rendering
 */

import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  Divider
} from '@mui/material';
import {
  Description as DescriptionIcon,
  TableChart as TableChartIcon,
  Calculate as CalculateIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import type { WizardSection } from '../../../types/wizard';

interface PreviewStepProps {
  name: string;
  description: string;
  templateType: string;
  sections: WizardSection[];
}

// Icona per tipo sezione
const getSectionIcon = (type: string) => {
  switch (type) {
    case 'dynamic_text':
    case 'conditional':
      return <DescriptionIcon />;
    case 'table':
      return <TableChartIcon />;
    case 'calculation':
      return <CalculateIcon />;
    default:
      return <DescriptionIcon />;
  }
};

// Label tipo sezione
const getSectionTypeLabel = (type: string) => {
  switch (type) {
    case 'dynamic_text':
      return 'Testo Dinamico';
    case 'table':
      return 'Tabella';
    case 'calculation':
      return 'Calcolo';
    case 'conditional':
      return 'Condizionale';
    default:
      return type;
  }
};

export function PreviewStep({
  name,
  description,
  templateType,
  sections
}: PreviewStepProps) {
  const enabledSections = sections.filter(s => s.enabled);

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Anteprima Template
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Verifica la configurazione del template prima di salvarlo
      </Typography>

      {/* Info Template */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Informazioni Generali
        </Typography>
        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 2 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="medium">
            Nome:
          </Typography>
          <Typography variant="body1">{name}</Typography>

          <Typography variant="body2" color="text.secondary" fontWeight="medium">
            Tipo:
          </Typography>
          <Chip
            label={templateType}
            color="primary"
            size="small"
            sx={{ width: 'fit-content' }}
          />

          {description && (
            <>
              <Typography variant="body2" color="text.secondary" fontWeight="medium">
                Descrizione:
              </Typography>
              <Typography variant="body2">{description}</Typography>
            </>
          )}

          <Typography variant="body2" color="text.secondary" fontWeight="medium">
            Sezioni:
          </Typography>
          <Typography variant="body1">
            {enabledSections.length} sezioni configurate
          </Typography>
        </Box>
      </Paper>

      {/* Lista Sezioni */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Sezioni Template
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Le sezioni verranno renderizzate nell'ordine mostrato
        </Typography>
        <Divider sx={{ my: 2 }} />

        {enabledSections.length === 0 ? (
          <Alert severity="warning">
            Nessuna sezione configurata. Torna indietro per aggiungere sezioni al template.
          </Alert>
        ) : (
          <List>
            {enabledSections.map((section, index) => (
              <ListItem
                key={section.id}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  mb: 1,
                  bgcolor: 'background.default'
                }}
              >
                <ListItemIcon>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      mr: 1
                    }}
                  >
                    {index + 1}
                  </Box>
                </ListItemIcon>
                {getSectionIcon(section.type)}
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" fontWeight="medium">
                        {section.name}
                      </Typography>
                      <Chip
                        label={getSectionTypeLabel(section.type)}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                      {section.enabled && (
                        <CheckCircleIcon color="success" fontSize="small" />
                      )}
                    </Box>
                  }
                  secondary={`ID: ${section.id}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Paper>

      {/* Info Salvataggio */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          💡 <strong>Prossimo step:</strong> Nel passo finale potrai salvare il template come bozza
          o attivarlo immediatamente. Una volta salvato, potrai sempre modificarlo o creare nuove versioni.
        </Typography>
      </Alert>

      {/* Warning se mancano sezioni */}
      {enabledSections.length < 3 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="body2">
            ⚠️ Il template contiene poche sezioni ({enabledSections.length}). Per una relazione
            completa, considera di aggiungere più sezioni tornando al passo di selezione.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
