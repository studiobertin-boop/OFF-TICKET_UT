/**
 * Template Wizard - Sistema guidato per creazione template
 * Wizard multi-step senza codice per utenti non tecnici
 */

import { useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { useWizardState } from '../hooks/useWizardState';
import { BaseConfigStep } from '../components/wizard/steps/BaseConfigStep';
import { SectionSelectionStep } from '../components/wizard/steps/SectionSelectionStep';
import { PreviewStep } from '../components/wizard/steps/PreviewStep';
import { getPredefinedSectionsByType } from '../utils/predefinedSections';
import toast from 'react-hot-toast';

const STEPS = [
  { label: 'Configurazione', description: 'Nome e tipo template' },
  { label: 'Sezioni', description: 'Seleziona contenuti' },
  { label: 'Configurazione', description: 'Personalizza sezioni' },
  { label: 'Anteprima', description: 'Verifica e salva' }
];

export function TemplateWizard() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const wizard = useWizardState({
    totalSteps: STEPS.length
  });

  // Carica template se in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      // TODO: Implementare caricamento template esistente
      console.log('Loading template:', id);
    }
  }, [isEditMode, id]);

  // Inizializza sezioni quando cambiano le selezioni
  useEffect(() => {
    console.log('useEffect triggered:', {
      selectedSections: wizard.state.selectedSections,
      sectionsLength: wizard.state.sections.length,
      templateType: wizard.state.template_type
    });

    // Controlla se ci sono sezioni selezionate ma non ancora configurate
    const selectedIds = wizard.state.selectedSections;
    const configuredIds = wizard.state.sections.map(s => s.id);
    const missingIds = selectedIds.filter(id => !configuredIds.includes(id));

    if (missingIds.length > 0) {
      console.log('Initializing missing sections:', missingIds);

      // Crea sezioni wizard dalle sezioni predefinite selezionate
      const predefinedSections = getPredefinedSectionsByType(wizard.state.template_type);
      console.log('Available predefined sections:', predefinedSections.length);

      const newSections = missingIds.map((sectionId, index) => {
        const predefined = predefinedSections.find(s => s.id === sectionId);
        console.log(`Mapping section ${sectionId}:`, predefined ? 'found' : 'NOT FOUND');

        if (!predefined) return null;

        return {
          id: sectionId,
          name: predefined.name,
          enabled: true,
          order: configuredIds.length + index + 1,
          type: predefined.type,
          config: predefined.defaultConfig
        };
      }).filter(Boolean);

      console.log('New sections to add:', newSections.length);

      // Aggiunge tutte le sezioni in un batch
      newSections.forEach(section => {
        if (section) {
          console.log('Adding section:', section.name);
          wizard.addSection(section);
        }
      });
    }

    // Rimuovi sezioni deselezionate
    const sectionsToRemove = configuredIds.filter(id => !selectedIds.includes(id));
    sectionsToRemove.forEach(id => {
      console.log('Removing deselected section:', id);
      wizard.removeSection(id);
    });
  }, [wizard.state.selectedSections, wizard.state.template_type]);

  // Handlers
  const handleNext = () => {
    if (!wizard.canGoNext) {
      toast.error('Completa i campi obbligatori prima di continuare');
      return;
    }

    if (wizard.validateCurrentStep()) {
      wizard.goNext();
    } else {
      toast.error('Correggi gli errori prima di continuare');
    }
  };

  const handleBack = () => {
    wizard.goBack();
  };

  const handleCancel = () => {
    if (wizard.state.isDirty) {
      const confirmed = window.confirm(
        'Hai modifiche non salvate. Sei sicuro di voler uscire?'
      );
      if (!confirmed) return;
    }
    navigate('/templates');
  };

  const handleSave = async () => {
    const validation = wizard.validate();

    if (!validation.valid) {
      toast.error('Correggi gli errori prima di salvare');
      console.error('Validation errors:', validation.errors);
      return;
    }

    try {
      // TODO: Implementare salvataggio template
      console.log('Saving template:', {
        name: wizard.state.name,
        description: wizard.state.description,
        template_type: wizard.state.template_type,
        sections: wizard.state.sections
      });

      toast.success('Template salvato con successo!');
      wizard.markClean();
      navigate('/templates');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Errore durante il salvataggio');
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (wizard.currentStep) {
      case 0: // Base Config
        return (
          <BaseConfigStep
            name={wizard.state.name}
            description={wizard.state.description}
            templateType={wizard.state.template_type}
            onNameChange={wizard.setName}
            onDescriptionChange={wizard.setDescription}
            onTemplateTypeChange={wizard.setTemplateType}
            validationErrors={wizard.state.validationErrors}
          />
        );

      case 1: // Section Selection
        return (
          <SectionSelectionStep
            templateType={wizard.state.template_type}
            selectedSections={wizard.state.selectedSections}
            onToggleSection={wizard.toggleSection}
            validationErrors={wizard.state.validationErrors}
          />
        );

      case 2: // Section Configuration
        return (
          <Box sx={{ maxWidth: 900, mx: 'auto' }}>
            <Typography variant="h5" gutterBottom>
              Configurazione Sezioni
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Le sezioni selezionate useranno la configurazione predefinita
            </Typography>

            <Alert severity="info" sx={{ mt: 3, mb: 3 }}>
              <Typography variant="body2">
                <strong>Nota:</strong> La configurazione dettagliata delle sezioni (personalizzazione campi,
                colonne tabelle, ecc.) sarà disponibile nella Fase 2. Per ora, ogni sezione usa la
                configurazione predefinita ottimizzata per relazioni DM329.
              </Typography>
            </Alert>

            {wizard.state.sections.length > 0 ? (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Sezioni Configurate ({wizard.state.sections.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                  {wizard.state.sections.map((section, index) => (
                    <Box
                      key={section.id}
                      sx={{
                        p: 2,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.default'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box
                          sx={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 'bold'
                          }}
                        >
                          {index + 1}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body1" fontWeight="medium">
                            {section.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Tipo: {section.type} • Configurazione predefinita
                          </Typography>
                        </Box>
                        <Chip label="✓ Pronta" color="success" size="small" />
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Paper>
            ) : (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Nessuna sezione configurata. Le sezioni verranno inizializzate automaticamente
                  dalle selezioni dello step precedente.
                </Typography>
              </Alert>
            )}

            <Alert severity="success" sx={{ mt: 3 }}>
              <Typography variant="body2">
                ✓ Tutte le sezioni sono pronte. Clicca "Avanti" per vedere l'anteprima finale.
              </Typography>
            </Alert>
          </Box>
        );

      case 3: // Preview
        return (
          <PreviewStep
            name={wizard.state.name}
            description={wizard.state.description}
            templateType={wizard.state.template_type}
            sections={wizard.state.sections}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleCancel}
          sx={{ mb: 2 }}
        >
          Torna ai Template
        </Button>
        <Typography variant="h4" gutterBottom>
          {isEditMode ? 'Modifica Template' : 'Crea Nuovo Template'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Crea template relazioni senza scrivere codice
        </Typography>
      </Box>

      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={wizard.currentStep} alternativeLabel>
          {STEPS.map((step, index) => (
            <Step key={step.label}>
              <StepLabel
                optional={
                  <Typography variant="caption">{step.description}</Typography>
                }
              >
                {step.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {/* Step Content */}
      <Paper sx={{ p: 4, mb: 3, minHeight: 400 }}>
        {renderStepContent()}
      </Paper>

      {/* Navigation Buttons */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            {wizard.state.isDirty && (
              <Typography variant="caption" color="warning.main">
                ⚠️ Modifiche non salvate
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleCancel}
            >
              Annulla
            </Button>

            {wizard.canGoBack && (
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handleBack}
              >
                Indietro
              </Button>
            )}

            {!wizard.isLastStep ? (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={handleNext}
                disabled={!wizard.canGoNext}
              >
                Avanti
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                startIcon={<SaveIcon />}
                onClick={handleSave}
              >
                Salva Template
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Debug Info (solo in dev) */}
      {process.env.NODE_ENV === 'development' && (
        <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.900' }}>
          <Typography
            variant="caption"
            component="pre"
            sx={{
              fontSize: '0.7rem',
              color: 'grey.100',
              fontFamily: 'monospace'
            }}
          >
            {JSON.stringify({
              step: wizard.currentStep,
              name: wizard.state.name,
              selectedSections: wizard.state.selectedSections,
              totalSections: wizard.state.sections.length,
              canGoNext: wizard.canGoNext,
              isDirty: wizard.state.isDirty
            }, null, 2)}
          </Typography>
        </Paper>
      )}
    </Container>
  );
}
