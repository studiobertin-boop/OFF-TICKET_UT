-- Tabella per i template di relazioni
CREATE TABLE report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  description text,
  template_type varchar(50) NOT NULL, -- 'dm329_technical' | 'inail' | 'custom'

  -- Contenuto template (struttura JSON con sezioni, partials, helpers)
  content jsonb NOT NULL,

  -- Metadata
  is_active boolean DEFAULT true,
  version integer DEFAULT 1,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Schema dati richiesti per la validazione
  required_data_schema jsonb
);

-- Tabella per lo storico versioni dei template
CREATE TABLE report_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES report_templates(id) ON DELETE CASCADE,
  version integer NOT NULL,
  content jsonb NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  change_description text,
  created_at timestamptz DEFAULT now(),

  UNIQUE(template_id, version)
);

-- Indici per performance
CREATE INDEX idx_templates_type ON report_templates(template_type);
CREATE INDEX idx_templates_active ON report_templates(is_active);
CREATE INDEX idx_templates_created_by ON report_templates(created_by);
CREATE INDEX idx_versions_template ON report_template_versions(template_id, version DESC);

-- RLS Policies

-- Report Templates: Admin e Tecnici possono vedere tutti i template attivi
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on templates"
  ON report_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY "Tecnici can read active templates"
  ON report_templates
  FOR SELECT
  TO authenticated
  USING (
    is_active = true AND
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'tecnico')
    )
  );

-- Template Versions: Solo admin possono vedere lo storico
ALTER TABLE report_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything on template versions"
  ON report_template_versions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Trigger per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_report_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_report_template_updated_at
  BEFORE UPDATE ON report_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_report_template_updated_at();

-- Trigger per creare automaticamente una versione quando si salva un template
CREATE OR REPLACE FUNCTION create_template_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo se il contenuto è cambiato e non è un nuovo inserimento
  IF (TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content) THEN
    INSERT INTO report_template_versions (template_id, version, content, changed_by)
    VALUES (NEW.id, NEW.version, NEW.content, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_template_version_trigger
  AFTER INSERT OR UPDATE ON report_templates
  FOR EACH ROW
  EXECUTE FUNCTION create_template_version();

-- Commenti per documentazione
COMMENT ON TABLE report_templates IS 'Template per la generazione di documenti (relazioni tecniche, etc.)';
COMMENT ON TABLE report_template_versions IS 'Storico versioni dei template per audit e rollback';
COMMENT ON COLUMN report_templates.content IS 'Struttura JSON contenente sezioni, partials Handlebars, e custom helpers';
COMMENT ON COLUMN report_templates.template_type IS 'Tipologia template: dm329_technical, inail, custom, etc.';
COMMENT ON COLUMN report_templates.required_data_schema IS 'Schema JSON dei dati richiesti per validare il rendering';
