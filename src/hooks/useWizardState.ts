/**
 * Hook per gestione stato Template Wizard
 * Gestisce navigazione step, stato form, validazione
 */

import { useState, useCallback, useMemo } from 'react';
import type {
  WizardState,
  WizardSection,
  WizardValidationResult,
  SaveWizardTemplateOptions
} from '../types/wizard';
import type { TemplateType } from '../types/template';

interface UseWizardStateOptions {
  initialState?: Partial<WizardState>;
  totalSteps?: number;
}

interface UseWizardStateReturn {
  // State
  state: WizardState;
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  canGoNext: boolean;
  canGoBack: boolean;

  // Actions - Base Config (Step 1)
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setTemplateType: (type: TemplateType) => void;

  // Actions - Section Selection (Step 2)
  toggleSection: (sectionId: string) => void;
  setSelectedSections: (sectionIds: string[]) => void;

  // Actions - Section Configuration (Step 3)
  updateSection: (sectionId: string, section: Partial<WizardSection>) => void;
  addSection: (section: WizardSection) => void;
  removeSection: (sectionId: string) => void;
  reorderSections: (sectionIds: string[]) => void;

  // Navigation
  goToStep: (step: number) => void;
  goNext: () => void;
  goBack: () => void;
  reset: () => void;

  // Validation
  validate: () => WizardValidationResult;
  validateCurrentStep: () => boolean;

  // Helpers
  markDirty: () => void;
  markClean: () => void;
}

const DEFAULT_STATE: WizardState = {
  name: '',
  description: '',
  template_type: 'dm329_technical',
  selectedSections: [],
  sections: [],
  currentStep: 0,
  isDirty: false,
  validationErrors: {}
};

const DEFAULT_TOTAL_STEPS = 5; // Base Config, Section Selection, Section Config, Preview, Save

export function useWizardState(options: UseWizardStateOptions = {}): UseWizardStateReturn {
  const {
    initialState = {},
    totalSteps = DEFAULT_TOTAL_STEPS
  } = options;

  const [state, setState] = useState<WizardState>({
    ...DEFAULT_STATE,
    ...initialState
  });

  // Computed
  const isFirstStep = state.currentStep === 0;
  const isLastStep = state.currentStep === totalSteps - 1;
  const canGoBack = state.currentStep > 0;

  // Validazione step corrente
  const canGoNext = useMemo(() => {
    switch (state.currentStep) {
      case 0: // Base Config
        return state.name.trim().length > 0;
      case 1: // Section Selection
        return state.selectedSections.length > 0;
      case 2: // Section Configuration
        return state.sections.length > 0 && state.sections.every(s => s.enabled);
      case 3: // Preview
        return true;
      default:
        return false;
    }
  }, [state.currentStep, state.name, state.selectedSections, state.sections]);

  // Actions - Base Config
  const setName = useCallback((name: string) => {
    setState(prev => ({ ...prev, name, isDirty: true }));
  }, []);

  const setDescription = useCallback((description: string) => {
    setState(prev => ({ ...prev, description, isDirty: true }));
  }, []);

  const setTemplateType = useCallback((template_type: TemplateType) => {
    setState(prev => ({ ...prev, template_type, isDirty: true }));
  }, []);

  // Actions - Section Selection
  const toggleSection = useCallback((sectionId: string) => {
    setState(prev => {
      const isSelected = prev.selectedSections.includes(sectionId);
      const newSelected = isSelected
        ? prev.selectedSections.filter(id => id !== sectionId)
        : [...prev.selectedSections, sectionId];

      return {
        ...prev,
        selectedSections: newSelected,
        isDirty: true
      };
    });
  }, []);

  const setSelectedSections = useCallback((sectionIds: string[]) => {
    setState(prev => ({
      ...prev,
      selectedSections: sectionIds,
      isDirty: true
    }));
  }, []);

  // Actions - Section Configuration
  const updateSection = useCallback((sectionId: string, updates: Partial<WizardSection>) => {
    setState(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId ? { ...s, ...updates } : s
      ),
      isDirty: true
    }));
  }, []);

  const addSection = useCallback((section: WizardSection) => {
    setState(prev => ({
      ...prev,
      sections: [...prev.sections, section],
      isDirty: true
    }));
  }, []);

  const removeSection = useCallback((sectionId: string) => {
    setState(prev => ({
      ...prev,
      sections: prev.sections.filter(s => s.id !== sectionId),
      selectedSections: prev.selectedSections.filter(id => id !== sectionId),
      isDirty: true
    }));
  }, []);

  const reorderSections = useCallback((sectionIds: string[]) => {
    setState(prev => {
      const reordered = sectionIds
        .map(id => prev.sections.find(s => s.id === id))
        .filter((s): s is WizardSection => s !== undefined)
        .map((s, index) => ({ ...s, order: index + 1 }));

      return {
        ...prev,
        sections: reordered,
        isDirty: true
      };
    });
  }, []);

  // Navigation
  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < totalSteps) {
      setState(prev => ({ ...prev, currentStep: step }));
    }
  }, [totalSteps]);

  const goNext = useCallback(() => {
    setState(prev => {
      const nextStep = Math.min(prev.currentStep + 1, totalSteps - 1);
      return { ...prev, currentStep: nextStep };
    });
  }, [totalSteps]);

  const goBack = useCallback(() => {
    setState(prev => {
      const prevStep = Math.max(prev.currentStep - 1, 0);
      return { ...prev, currentStep: prevStep };
    });
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  // Validation
  const validateCurrentStep = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    switch (state.currentStep) {
      case 0: // Base Config
        if (!state.name.trim()) {
          errors.name = 'Il nome del template è obbligatorio';
        }
        if (state.name.length > 100) {
          errors.name = 'Il nome del template è troppo lungo (max 100 caratteri)';
        }
        break;

      case 1: // Section Selection
        if (state.selectedSections.length === 0) {
          errors.sections = 'Seleziona almeno una sezione';
        }
        break;

      case 2: // Section Configuration
        if (state.sections.length === 0) {
          errors.sections = 'Configura almeno una sezione';
        }
        break;
    }

    setState(prev => ({ ...prev, validationErrors: errors }));
    return Object.keys(errors).length === 0;
  }, [state.currentStep, state.name, state.selectedSections, state.sections]);

  const validate = useCallback((): WizardValidationResult => {
    const errors: Array<{ section_id?: string; field?: string; message: string }> = [];

    // Validazione nome
    if (!state.name.trim()) {
      errors.push({ field: 'name', message: 'Il nome del template è obbligatorio' });
    }

    // Validazione sezioni
    if (state.sections.length === 0) {
      errors.push({ message: 'Aggiungi almeno una sezione al template' });
    }

    state.sections.forEach(section => {
      if (!section.name.trim()) {
        errors.push({
          section_id: section.id,
          field: 'name',
          message: `La sezione "${section.id}" deve avere un nome`
        });
      }

      // Validazione specifica per tipo sezione
      // TODO: Aggiungere validazioni specifiche per ogni tipo
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }, [state]);

  // Helpers
  const markDirty = useCallback(() => {
    setState(prev => ({ ...prev, isDirty: true }));
  }, []);

  const markClean = useCallback(() => {
    setState(prev => ({ ...prev, isDirty: false }));
  }, []);

  return {
    // State
    state,
    currentStep: state.currentStep,
    totalSteps,
    isFirstStep,
    isLastStep,
    canGoNext,
    canGoBack,

    // Actions - Base Config
    setName,
    setDescription,
    setTemplateType,

    // Actions - Section Selection
    toggleSection,
    setSelectedSections,

    // Actions - Section Configuration
    updateSection,
    addSection,
    removeSection,
    reorderSections,

    // Navigation
    goToStep,
    goNext,
    goBack,
    reset,

    // Validation
    validate,
    validateCurrentStep,

    // Helpers
    markDirty,
    markClean
  };
}
