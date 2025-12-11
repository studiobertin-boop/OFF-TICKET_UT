/**
 * Service per gestione template (CRUD, versioning, rendering)
 */

import { supabase } from './supabase';
import { templateEngine } from './templateRenderingEngine';
import type {
  ReportTemplate,
  ReportTemplateVersion,
  CreateTemplateInput,
  UpdateTemplateInput,
  TemplateListFilters,
  TemplateContent
} from '../types/template';

/**
 * Carica lista template con filtri opzionali
 */
export async function listTemplates(
  filters?: TemplateListFilters
): Promise<ReportTemplate[]> {
  let query = supabase
    .from('report_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.template_type) {
    query = query.eq('template_type', filters.template_type);
  }

  if (filters?.is_active !== undefined) {
    query = query.eq('is_active', filters.is_active);
  }

  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Errore caricamento template:', error);
    throw new Error(`Errore caricamento template: ${error.message}`);
  }

  return data || [];
}

/**
 * Carica singolo template per ID
 */
export async function getTemplate(id: string): Promise<ReportTemplate | null> {
  const { data, error } = await supabase
    .from('report_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Errore caricamento template:', error);
    throw new Error(`Errore caricamento template: ${error.message}`);
  }

  return data;
}

/**
 * Crea nuovo template
 */
export async function createTemplate(
  input: CreateTemplateInput,
  userId?: string
): Promise<ReportTemplate> {
  const { data, error } = await supabase
    .from('report_templates')
    .insert({
      name: input.name,
      description: input.description,
      template_type: input.template_type,
      content: input.content as any, // JSONB
      required_data_schema: input.required_data_schema as any,
      created_by: userId,
      version: 1
    })
    .select()
    .single();

  if (error) {
    console.error('Errore creazione template:', error);
    throw new Error(`Errore creazione template: ${error.message}`);
  }

  return data;
}

/**
 * Aggiorna template esistente
 * Incrementa automaticamente versione se content è modificato
 */
export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
  userId?: string
): Promise<ReportTemplate> {
  // Carica template esistente
  const existing = await getTemplate(id);
  if (!existing) {
    throw new Error('Template non trovato');
  }

  // Determina se content è cambiato
  const contentChanged = input.content &&
    JSON.stringify(input.content) !== JSON.stringify(existing.content);

  const updateData: any = {
    ...input,
    updated_at: new Date().toISOString()
  };

  // Rimuovi change_description dall'update (è solo per report_template_versions)
  delete updateData.change_description;

  // Incrementa versione se content è cambiato
  if (contentChanged) {
    updateData.version = existing.version + 1;
  }

  // Se non è specificato content, rimuovilo dall'update
  if (!input.content) {
    delete updateData.content;
  }

  const { data, error } = await supabase
    .from('report_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Errore aggiornamento template:', error);
    throw new Error(`Errore aggiornamento template: ${error.message}`);
  }

  // Crea versione storica se content è cambiato
  if (contentChanged && input.content) {
    await createTemplateVersion(
      id,
      updateData.version,
      input.content,
      userId,
      input.change_description
    );
  }

  return data;
}

/**
 * Elimina template (soft delete -> is_active = false)
 */
export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('report_templates')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    console.error('Errore eliminazione template:', error);
    throw new Error(`Errore eliminazione template: ${error.message}`);
  }
}

/**
 * Elimina permanentemente template
 */
export async function hardDeleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('report_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Errore eliminazione permanente template:', error);
    throw new Error(`Errore eliminazione permanente template: ${error.message}`);
  }
}

/**
 * Duplica template esistente
 */
export async function duplicateTemplate(
  id: string,
  newName: string,
  userId?: string
): Promise<ReportTemplate> {
  const original = await getTemplate(id);
  if (!original) {
    throw new Error('Template originale non trovato');
  }

  return await createTemplate({
    name: newName,
    description: `Copia di: ${original.description || original.name}`,
    template_type: original.template_type,
    content: original.content,
    required_data_schema: original.required_data_schema
  }, userId);
}

/**
 * Carica storico versioni di un template
 */
export async function getTemplateVersions(
  templateId: string
): Promise<ReportTemplateVersion[]> {
  const { data, error } = await supabase
    .from('report_template_versions')
    .select('*')
    .eq('template_id', templateId)
    .order('version', { ascending: false });

  if (error) {
    console.error('Errore caricamento versioni:', error);
    throw new Error(`Errore caricamento versioni: ${error.message}`);
  }

  return data || [];
}

/**
 * Crea nuova versione manualmente
 */
async function createTemplateVersion(
  templateId: string,
  version: number,
  content: TemplateContent,
  userId?: string,
  description?: string
): Promise<ReportTemplateVersion> {
  const { data, error } = await supabase
    .from('report_template_versions')
    .insert({
      template_id: templateId,
      version,
      content: content as any,
      changed_by: userId,
      change_description: description
    })
    .select()
    .single();

  if (error) {
    console.error('Errore creazione versione:', error);
    throw new Error(`Errore creazione versione: ${error.message}`);
  }

  return data;
}

/**
 * Ripristina template a versione precedente
 */
export async function rollbackToVersion(
  templateId: string,
  versionNumber: number,
  userId?: string
): Promise<ReportTemplate> {
  // Carica versione target
  const { data: versionData, error: versionError } = await supabase
    .from('report_template_versions')
    .select('*')
    .eq('template_id', templateId)
    .eq('version', versionNumber)
    .single();

  if (versionError || !versionData) {
    throw new Error(`Versione ${versionNumber} non trovata`);
  }

  // Aggiorna template con contenuto della versione
  return await updateTemplate(
    templateId,
    {
      content: versionData.content,
      change_description: `Rollback a versione ${versionNumber}`
    },
    userId
  );
}

/**
 * Renderizza template con dati e scarica DOCX
 */
export async function renderTemplateAndDownload(
  templateId: string,
  data: any,
  fileName: string
): Promise<void> {
  // Carica template
  const template = await getTemplate(templateId);
  if (!template) {
    throw new Error('Template non trovato');
  }

  if (!template.is_active) {
    throw new Error('Template non attivo');
  }

  // Renderizza e scarica
  await templateEngine.renderAndDownload(
    template.content,
    data,
    fileName
  );
}

/**
 * Renderizza template e restituisce blob (senza download)
 */
export async function renderTemplateToBlob(
  templateId: string,
  data: any
): Promise<Blob> {
  const template = await getTemplate(templateId);
  if (!template) {
    throw new Error('Template non trovato');
  }

  const renderedData = templateEngine.renderToData(template.content, data);
  return await templateEngine.exportToDOCX(renderedData);
}

/**
 * Valida template
 */
export async function validateTemplate(templateId: string) {
  const template = await getTemplate(templateId);
  if (!template) {
    throw new Error('Template non trovato');
  }

  return templateEngine.validateTemplate(template.content);
}

/**
 * Esporta template in JSON per backup
 */
export async function exportTemplateToJSON(templateId: string): Promise<string> {
  const template = await getTemplate(templateId);
  if (!template) {
    throw new Error('Template non trovato');
  }

  return JSON.stringify(template, null, 2);
}

/**
 * Importa template da JSON
 */
export async function importTemplateFromJSON(
  jsonString: string,
  userId?: string
): Promise<ReportTemplate> {
  const templateData = JSON.parse(jsonString);

  // Rimuovi campi auto-generati
  delete templateData.id;
  delete templateData.created_at;
  delete templateData.updated_at;
  delete templateData.created_by;

  return await createTemplate({
    name: templateData.name + ' (Importato)',
    description: templateData.description,
    template_type: templateData.template_type,
    content: templateData.content,
    required_data_schema: templateData.required_data_schema
  }, userId);
}

/**
 * Cerca template per tipo e restituisce quello di default (più recente attivo)
 */
export async function getDefaultTemplate(
  templateType: string
): Promise<ReportTemplate | null> {
  const templates = await listTemplates({
    template_type: templateType as any,
    is_active: true
  });

  return templates.length > 0 ? templates[0] : null;
}
