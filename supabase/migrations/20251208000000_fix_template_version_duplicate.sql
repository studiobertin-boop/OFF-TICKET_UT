-- Fix: Rimuove trigger automatico che causa conflitti con la gestione manuale delle versioni
-- Il versioning è gestito completamente da TypeScript in templateService.ts

-- Rimuove il trigger automatico
DROP TRIGGER IF EXISTS create_template_version_trigger ON report_templates;

-- Rimuove la funzione associata
DROP FUNCTION IF EXISTS create_template_version();

-- Commento esplicativo
COMMENT ON TABLE report_template_versions IS 'Storico versioni dei template - gestito manualmente da templateService.ts';
