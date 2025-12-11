import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Typography,
  Divider,
  RadioGroup,
  Radio,
} from '@mui/material';
import { DM329TechnicalData, Request, Customer } from '@/types';
import { ReportGenerationInput } from '@/types/report';
import { generateRelazioneTecnica } from '@/services/reportGenerationService';
import { listTemplates, renderTemplateAndDownload } from '@/services/templateService';
import { buildDM329PlaceholderContext } from '@/utils/templateDataBuilder';
import type { ReportTemplate } from '@/types/template';
import toast from 'react-hot-toast';

interface GenerateReportDialogProps {
  open: boolean;
  onClose: () => void;
  technicalData: DM329TechnicalData;
  request: Request;
  customer: Customer;
}

/**
 * Dialog per raccogliere informazioni aggiuntive prima della generazione della relazione tecnica
 */
export const GenerateReportDialog = ({
  open,
  onClose,
  technicalData,
  request,
  customer,
}: GenerateReportDialogProps) => {
  const [generationMode, setGenerationMode] = useState<'legacy' | 'template'>('template');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [descrizioneAttivita, setDescrizioneAttivita] = useState('');
  const [compressoriGiri, setCompressoriGiri] = useState<Record<string, 'fissi' | 'variabili'>>({});
  const [spessimetrica, setSpessimetrica] = useState<string[]>([]);
  const [collegamentiCompressoriSerbatoi, setCollegamentiCompressoriSerbatoi] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estrai apparecchiature dai dati tecnici usando useMemo per evitare ricreazione ad ogni render
  const equipmentData = technicalData.equipment_data || {};
  const compressori = useMemo(() => equipmentData.compressori || [], [equipmentData.compressori]);
  const serbatoi = useMemo(() => equipmentData.serbatoi || [], [equipmentData.serbatoi]);
  const disoleatori = useMemo(() => equipmentData.disoleatori || [], [equipmentData.disoleatori]);
  const scambiatori = useMemo(() => equipmentData.scambiatori || [], [equipmentData.scambiatori]);
  const recipientiFiltro = useMemo(() => equipmentData.recipienti_filtro || [], [equipmentData.recipienti_filtro]);

  // Lista apparecchiature disponibili per spessimetrica
  const apparecchiaturePerSpessimetrica = useMemo(() => [
    ...serbatoi.map((s: any) => s.codice),
    ...disoleatori.map((d: any) => d.codice),
    ...scambiatori.map((s: any) => s.codice),
    ...recipientiFiltro.map((r: any) => r.codice),
  ], [serbatoi, disoleatori, scambiatori, recipientiFiltro]);

  // Ref per tracciare se abbiamo già inizializzato per questo dialog open
  const hasInitializedRef = useRef(false);

  // Carica template disponibili quando dialog si apre
  useEffect(() => {
    if (open) {
      loadAvailableTemplates();
    }
  }, [open]);

  async function loadAvailableTemplates() {
    setLoadingTemplates(true);
    try {
      const data = await listTemplates({
        template_type: 'dm329_technical',
        is_active: true
      });
      setTemplates(data);

      // Seleziona automaticamente il primo template se disponibile
      if (data.length > 0) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (err) {
      console.error('Errore caricamento template:', err);
      // Se non ci sono template, fallback a legacy mode
      setGenerationMode('legacy');
    } finally {
      setLoadingTemplates(false);
    }
  }

  // Inizializza compressoriGiri e collegamenti
  useEffect(() => {
    if (open && !hasInitializedRef.current) {
      hasInitializedRef.current = true;

      // Inizializza compressori giri
      const initialGiri: Record<string, 'fissi' | 'variabili'> = {};
      compressori.forEach((c: any) => {
        initialGiri[c.codice] = 'fissi'; // Default
      });
      setCompressoriGiri(initialGiri);

      // Inizializza collegamenti (default: tutti connessi a tutti)
      const initialCollegamenti: Record<string, string[]> = {};
      compressori.forEach((c: any) => {
        initialCollegamenti[c.codice] = []; // Default vuoto, utente seleziona
      });
      setCollegamentiCompressoriSerbatoi(initialCollegamenti);
    }

    // Reset ref quando dialog si chiude
    if (!open) {
      hasInitializedRef.current = false;
    }
  }, [open, compressori]);

  const handleClose = () => {
    setDescrizioneAttivita('');
    setCompressoriGiri({});
    setSpessimetrica([]);
    setCollegamentiCompressoriSerbatoi({});
    setError(null);
    onClose();
  };

  const handleToggleSpessimetrica = (codice: string) => {
    setSpessimetrica((prev) =>
      prev.includes(codice) ? prev.filter((c) => c !== codice) : [...prev, codice]
    );
  };

  const handleCollegamentoChange = (compressoreCodice: string, serbatoiSelezionati: string[]) => {
    setCollegamentiCompressoriSerbatoi((prev) => ({
      ...prev,
      [compressoreCodice]: serbatoiSelezionati,
    }));
  };

  const handleGenerate = async () => {
    // Validazione
    if (!descrizioneAttivita.trim()) {
      setError('La descrizione attività è obbligatoria');
      return;
    }

    if (generationMode === 'template' && !selectedTemplateId) {
      setError('Seleziona un template');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const inputData: ReportGenerationInput = {
        descrizioneAttivita: descrizioneAttivita.trim(),
        compressoriGiri,
        spessimetrica,
        collegamentiCompressoriSerbatoi,
      };

      if (generationMode === 'template') {
        // Nuovo sistema basato su template
        const fileName = `Relazione_Tecnica_${customer.ragione_sociale.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`;

        // Costruisci contesto completo placeholder
        const templateData = buildDM329PlaceholderContext(
          customer,
          technicalData,
          request,
          inputData
        );

        await renderTemplateAndDownload(selectedTemplateId, templateData, fileName);
        toast.success('Relazione tecnica generata con successo (template)!');
      } else {
        // Sistema legacy
        await generateRelazioneTecnica({
          cliente: customer,
          technicalData,
          request,
          additionalInfo: inputData,
        });
        toast.success('Relazione tecnica generata con successo (legacy)!');
      }

      handleClose();
    } catch (err: any) {
      console.error('Errore generazione relazione:', err);
      setError(err.message || 'Errore durante la generazione della relazione');
      toast.error('Errore durante la generazione della relazione');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Genera Relazione Tecnica - Informazioni Aggiuntive</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Selezione Modalità Generazione */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Modalità Generazione
            </Typography>
            <FormControl component="fieldset">
              <RadioGroup
                value={generationMode}
                onChange={(e) => setGenerationMode(e.target.value as 'legacy' | 'template')}
              >
                <FormControlLabel
                  value="template"
                  control={<Radio />}
                  label="Template (nuovo sistema)"
                  disabled={loadingTemplates || templates.length === 0}
                />
                <FormControlLabel
                  value="legacy"
                  control={<Radio />}
                  label="Sistema legacy"
                />
              </RadioGroup>
            </FormControl>
          </Grid>

          {/* Selezione Template */}
          {generationMode === 'template' && (
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Seleziona Template *</InputLabel>
                <Select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  label="Seleziona Template *"
                  disabled={loadingTemplates}
                >
                  {loadingTemplates ? (
                    <MenuItem value="">
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      Caricamento template...
                    </MenuItem>
                  ) : templates.length === 0 ? (
                    <MenuItem value="" disabled>
                      Nessun template disponibile
                    </MenuItem>
                  ) : (
                    templates.map((template) => (
                      <MenuItem key={template.id} value={template.id}>
                        {template.name} (v{template.version})
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            </Grid>
          )}

          <Grid item xs={12}>
            <Divider />
          </Grid>

          {/* Descrizione Attività */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Descrizione Attività / Codice ATECO *"
              value={descrizioneAttivita}
              onChange={(e) => setDescrizioneAttivita(e.target.value)}
              placeholder="es. fabbricazione di prodotti in plastica"
              multiline
              rows={2}
              helperText="Inserisci la descrizione dell'attività aziendale o il codice ATECO"
              required
            />
          </Grid>

          <Grid item xs={12}>
            <Divider />
          </Grid>

          {/* Compressori - Tipo Giri */}
          {compressori.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Tipo Giri Compressori
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Indica per ciascun compressore se ha giri fissi o variabili (tramite inverter)
              </Typography>
              <Grid container spacing={2}>
                {compressori.map((comp: any) => (
                  <Grid item xs={12} sm={6} key={comp.codice}>
                    <FormControl fullWidth size="small">
                      <InputLabel>{comp.codice}</InputLabel>
                      <Select
                        value={compressoriGiri[comp.codice] || 'fissi'}
                        onChange={(e) =>
                          setCompressoriGiri({
                            ...compressoriGiri,
                            [comp.codice]: e.target.value as 'fissi' | 'variabili',
                          })
                        }
                        label={comp.codice}
                      >
                        <MenuItem value="fissi">Giri fissi</MenuItem>
                        <MenuItem value="variabili">Giri variabili (inverter)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}

          {compressori.length > 0 && (
            <Grid item xs={12}>
              <Divider />
            </Grid>
          )}

          {/* Collegamenti Compressori-Serbatoi */}
          {compressori.length > 0 && serbatoi.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Collegamenti Compressori - Serbatoi
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Indica quali serbatoi sono collegati a ciascun compressore
              </Typography>
              <Grid container spacing={2}>
                {compressori.map((comp: any) => (
                  <Grid item xs={12} key={comp.codice}>
                    <FormControl fullWidth size="small">
                      <InputLabel>{`${comp.codice} collegato a`}</InputLabel>
                      <Select
                        multiple
                        value={collegamentiCompressoriSerbatoi[comp.codice] || []}
                        onChange={(e) =>
                          handleCollegamentoChange(comp.codice, e.target.value as string[])
                        }
                        label={`${comp.codice} collegato a`}
                        renderValue={(selected) => (selected as string[]).join(', ')}
                      >
                        {serbatoi.map((serb: any) => (
                          <MenuItem key={serb.codice} value={serb.codice}>
                            <Checkbox
                              checked={
                                (collegamentiCompressoriSerbatoi[comp.codice] || []).indexOf(
                                  serb.codice
                                ) > -1
                              }
                            />
                            {serb.codice} - {serb.marca || 'n/d'} {serb.modello || ''}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          )}

          {apparecchiaturePerSpessimetrica.length > 0 && (
            <Grid item xs={12}>
              <Divider />
            </Grid>
          )}

          {/* Apparecchiature sottoposte a spessimetrica */}
          {apparecchiaturePerSpessimetrica.length > 0 && (
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Verifiche Spessimetriche
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Seleziona le apparecchiature sottoposte a verifica spessimetrica (se applicabile)
              </Typography>
              <FormGroup>
                <Grid container spacing={1}>
                  {apparecchiaturePerSpessimetrica.map((codice) => (
                    <Grid item xs={12} sm={6} md={4} key={codice}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={spessimetrica.includes(codice)}
                            onChange={() => handleToggleSpessimetrica(codice)}
                          />
                        }
                        label={codice}
                      />
                    </Grid>
                  ))}
                </Grid>
              </FormGroup>
            </Grid>
          )}
        </Grid>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Annulla
        </Button>
        <Button
          onClick={handleGenerate}
          variant="contained"
          color="primary"
          disabled={loading || !descrizioneAttivita.trim()}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading ? 'Generazione...' : 'Genera Relazione'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
