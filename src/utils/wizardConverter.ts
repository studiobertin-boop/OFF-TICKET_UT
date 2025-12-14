/**
 * Utility per convertire WizardSection in TemplateSection
 * Converte configurazione wizard in formato template per rendering
 */

import type {
  WizardSection,
  DynamicTextConfig,
  TableConfig,
  CalculationConfig,
  ConditionalConfig,
  TableColumn
} from '../types/wizard';
import type {
  TemplateSection,
  TemplateContent,
  TableTemplate,
  TableStyle as TemplateTableStyle
} from '../types/template';

/**
 * Converte una singola WizardSection in TemplateSection
 */
export function convertWizardSection(wizardSection: WizardSection): TemplateSection {
  const { id, name, enabled, order, type, config } = wizardSection;

  let templateContent: string | TableTemplate;

  switch (type) {
    case 'dynamic_text': {
      const dynamicConfig = config as DynamicTextConfig;
      // Converti template visuale in template Handlebars
      let handlebarsTemplate = dynamicConfig.template_visual;
      
      // Sostituisci i placeholder visuali con sintassi Handlebars
      dynamicConfig.field_mappings.forEach(mapping => {
        handlebarsTemplate = handlebarsTemplate.replace(
          new RegExp(mapping.placeholder.replace(/[{}]/g, '\$&'), 'g'),
          `{{${mapping.path}}}`
        );
      });

      templateContent = handlebarsTemplate;
      break;
    }

    case 'table': {
      const tableConfig = config as TableConfig;
      // Crea TableTemplate
      const visibleColumns = tableConfig.columns.filter(col => col.visible);

      // Converti stile stringa wizard in oggetto TableStyle template
      const tableStyle: TemplateTableStyle = {
        headerBackgroundColor: '#f0f0f0',
        borders: tableConfig.show_borders,
        cellPadding: 5,
        width: '100%'
      };

      templateContent = {
        headers: visibleColumns.map(col => col.label),
        rows: generateTableRowTemplate(tableConfig.data_source, visibleColumns),
        style: tableStyle
      };
      break;
    }

    case 'calculation': {
      const calcConfig = config as CalculationConfig;
      // Converti in template Handlebars con helper personalizzato
      const helperName = `calculate_${calcConfig.calculation_type}`;
      const dataSource = calcConfig.apply_to_item || calcConfig.apply_to;
      
      templateContent = calcConfig.output_template ||
        `{{${helperName} ${dataSource}}}`;
      break;
    }

    case 'conditional': {
      const condConfig = config as ConditionalConfig;
      // Converti in blocco {{#if}} Handlebars
      let handlebarsTemplate = '';

      condConfig.variants.forEach((variant, index) => {
        if (variant.condition) {
          const conditionHelper = convertConditionToHandlebars(variant.condition);
          if (index === 0) {
            handlebarsTemplate += `{{#if ${conditionHelper}}}\n${variant.text}\n`;
          } else {
            handlebarsTemplate += `{{else if ${conditionHelper}}}\n${variant.text}\n`;
          }
        } else {
          // Variante default
          handlebarsTemplate += `{{else}}\n${variant.text}\n`;
        }
      });
      handlebarsTemplate += '{{/if}}';

      templateContent = handlebarsTemplate;
      break;
    }

    default:
      templateContent = `<!-- Sezione ${name} non supportata -->`;
  }

  return {
    id,
    title: name,
    enabled,
    type: mapWizardTypeToTemplateType(type),
    template: templateContent,
    order: order || 0
  };
}

/**
 * Genera template Handlebars per righe tabella
 */
function generateTableRowTemplate(dataSource: string, columns: TableColumn[]): string {
  const columnTemplates = columns.map(col => {
    if (col.template) {
      // Template personalizzato per colonna
      let template = col.template;
      // Converti {campo} in {{this.campo}}
      template = template.replace(/{(\w+)}/g, '{{this.$1}}');
      return template;
    }
    return `{{this.${col.field}}}`;
  });

  return `{{#each ${dataSource}}}
  <tr>
    ${columnTemplates.map(t => `<td>${t}</td>`).join('\n    ')}
  </tr>
{{/each}}`;
}

/**
 * Converte condizione wizard in helper Handlebars
 */
function convertConditionToHandlebars(condition: any): string {
  const { field, operator, value } = condition;

  switch (operator) {
    case 'eq':
      return `(eq ${field} ${JSON.stringify(value)})`;
    case 'ne':
      return `(ne ${field} ${JSON.stringify(value)})`;
    case 'gt':
      return `(gt ${field} ${value})`;
    case 'gte':
      return `(gte ${field} ${value})`;
    case 'lt':
      return `(lt ${field} ${value})`;
    case 'lte':
      return `(lte ${field} ${value})`;
    default:
      return field;
  }
}

/**
 * Mappa tipo wizard a tipo template
 */
function mapWizardTypeToTemplateType(wizardType: string): 'paragraph' | 'table' | 'custom' | 'heading' | 'conditional' {
  switch (wizardType) {
    case 'dynamic_text':
      return 'paragraph';
    case 'table':
      return 'table';
    case 'conditional':
      return 'conditional';
    case 'calculation':
      return 'custom';
    default:
      return 'paragraph';
  }
}

/**
 * Converte configurazione wizard completa in TemplateContent
 */
export function convertWizardToTemplateContent(
  wizardSections: WizardSection[]
): TemplateContent {
  const enabledSections = wizardSections
    .filter(s => s.enabled)
    .sort((a, b) => a.order - b.order);

  const templateSections = enabledSections.map(convertWizardSection);

  return {
    format: 'docx',
    sections: templateSections,
    metadata: {
      pageMargins: {
        top: 2.5,
        bottom: 2.5,
        left: 2.5,
        right: 2.5
      },
      defaultFont: 'Arial',
      defaultFontSize: 11
    }
  };
}

/**
 * Estrae dati richiesti dalle sezioni wizard
 */
export function extractRequiredDataFromWizardSections(
  wizardSections: WizardSection[]
): string[] {
  const requiredFields = new Set<string>();

  wizardSections.forEach(section => {
    const config = section.config as any;

    // Estrai da field_mappings (dynamic_text)
    if (config.field_mappings) {
      config.field_mappings.forEach((mapping: any) => {
        const rootField = mapping.path.split('.')[0];
        requiredFields.add(rootField);
      });
    }

    // Estrai da data_source (table)
    if (config.data_source) {
      requiredFields.add(config.data_source);
    }

    // Estrai da apply_to (calculation)
    if (config.apply_to) {
      requiredFields.add(config.apply_to);
    }

    // Estrai da variants (conditional)
    if (config.variants) {
      config.variants.forEach((variant: any) => {
        if (variant.condition?.field) {
          const rootField = variant.condition.field.split('.')[0];
          requiredFields.add(rootField);
        }
      });
    }
  });

  return Array.from(requiredFields);
}
