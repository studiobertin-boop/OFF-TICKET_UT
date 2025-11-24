import { useState, useEffect } from 'react';
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
} from '@mui/material';
import { DM329TechnicalData, Request, Customer } from '@/types';
import { ReportGenerationInput } from '@/types/report';
import { generateRelazioneTecnica } from '@/services/reportGenerationService';
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
  const [descrizioneAttivita, setDescrizioneAttivita] = useState('');
  const [compressoriGiri, setCompressoriGiri] = useState<Record<string, 'fissi' | 'variabili'>>({});
  const [spessimetrica, setSpessimetrica] = useState<string[]>([]);
  const [collegamentiCompressoriSerbatoi, setCollegamentiCompressoriSerbatoi] = useState<
    Record<string, string[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estrai apparecchiature dai dati tecnici
  const equipmentData = technicalData.equipment_data || {};
  const compressori = equipmentData.compressori || [];
  const serbatoi = equipmentData.serbatoi || [];
  const disoleatori = equipmentData.disoleatori || [];
  const scambiatori = equipmentData.scambiatori || [];
  const recipientiFiltro = equipmentData.recipienti_filtro || [];

  // Lista apparecchiature disponibili per spessimetrica
  const apparecchiaturePerSpessimetrica = [
    ...serbatoi.map((s: any) => s.codice),
    ...disoleatori.map((d: any) => d.codice),
    ...scambiatori.map((s: any) => s.codice),
    ...recipientiFiltro.map((r: any) => r.codice),
  ];

  // Inizializza compressoriGiri e collegamenti
  useEffect(() => {
    if (open) {
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

    setLoading(true);
    setError(null);

    try {
      const inputData: ReportGenerationInput = {
        descrizioneAttivita: descrizioneAttivita.trim(),
        compressoriGiri,
        spessimetrica,
        collegamentiCompressoriSerbatoi,
      };

      await generateRelazioneTecnica({
        cliente: customer,
        technicalData,
        request,
        additionalInfo: inputData,
      });

      toast.success('Relazione tecnica generata con successo!');
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
