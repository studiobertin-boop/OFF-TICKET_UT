/**
 * Pannello preview live del template renderizzato
 */

import { Box, Paper, Typography, Alert, CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import Handlebars from 'handlebars';
import { registerAllHelpers } from '../../utils/templateHelpers';

interface LivePreviewPanelProps {
  templateString: string;
  sampleData: any;
  height?: string;
}

export function LivePreviewPanel({
  templateString,
  sampleData,
  height = '600px'
}: LivePreviewPanelProps) {
  const [rendered, setRendered] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Registra helper al mount
  useEffect(() => {
    registerAllHelpers();
  }, []);

  // Renderizza template con debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      renderTemplate();
    }, 500); // Debounce 500ms

    return () => clearTimeout(timeoutId);
  }, [templateString, sampleData]);

  async function renderTemplate() {
    if (!templateString.trim()) {
      setRendered('');
      setError(null);
      return;
    }

    setIsRendering(true);
    setError(null);

    try {
      // Compila template
      const template = Handlebars.compile(templateString);

      // Renderizza con dati sample
      let result = template(sampleData);

      // Post-processa il risultato per migliorare la preview
      result = postProcessPreview(result);

      setRendered(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRendered('');
    } finally {
      setIsRendering(false);
    }
  }


  /**
   * Decode HTML entities (converte &lt; in <, &gt; in >, ecc.)
   */
  function decodeHTMLEntities(text: string): string {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  /**
   * Converti markup [[TABLE:...]] in HTML per preview
   * IMPORTANTE: Preserva HTML inline nelle celle per preview formattata
   */
  function convertTableMarkupToHTML(html: string): string {
    const tableRegex = /\[\[TABLE:([^:]+):([^:]+)::(.+?)\]\]/g;

    return html.replace(tableRegex, (match, _tableId, headersStr, rowsStr) => {
      try {
        // Decode HTML entities per recuperare i tag HTML originali
        const decodedHeaders = decodeHTMLEntities(headersStr);
        const decodedRows = decodeHTMLEntities(rowsStr);

        // Split - NON fare trim per preservare HTML inline
        const headers = decodedHeaders.split('|').filter((cell: string) => cell.length >= 0);
        const rows = decodedRows.split('||')
          .map((rowStr: string) => rowStr.split('|').filter((cell: string) => cell.length >= 0))
          .filter((row: string[]) => row.length > 0);

        let tableHTML = '<table style="border-collapse: collapse; width: 100%; margin: 10px 0; border: 1px solid #ddd;">';

        if (headers.length > 0) {
          tableHTML += '<thead><tr>';
          headers.forEach((cell: string) => {
            // Preserva HTML nelle celle per il preview
            tableHTML += `<th style="border: 1px solid #ddd; padding: 8px; background-color: #f5f5f5; font-weight: bold; text-align: center;">${cell}</th>`;
          });
          tableHTML += '</tr></thead>';
        }

        if (rows.length > 0) {
          tableHTML += '<tbody>';
          rows.forEach((row: string[]) => {
            tableHTML += '<tr>';
            row.forEach((cell: string) => {
              // Preserva HTML nelle celle per il preview
              tableHTML += `<td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>`;
            });
            tableHTML += '</tr>';
          });
          tableHTML += '</tbody>';
        }

        tableHTML += '</table>';
        return tableHTML;
      } catch (error) {
        console.error('Error parsing table markup:', error);
        return match;
      }
    });
  }

  /**
   * Post-processa il testo renderizzato per migliorare la preview
   */
  function postProcessPreview(html: string): string {
    // Converti markup tabelle in HTML
    html = convertTableMarkupToHTML(html);

    // Converti Quill HTML mantenendo tutta la formattazione
    let processed = html;

    // Gestisci <h1>, <h2>, <h3> con classi (header + align)
    processed = processed
      .replace(/<h1 class="ql-align-center"([^>]*)>([\s\S]*?)<\/h1>/g, '<h1 style="text-align: center"$1>$2</h1>')
      .replace(/<h1 class="ql-align-right"([^>]*)>([\s\S]*?)<\/h1>/g, '<h1 style="text-align: right"$1>$2</h1>')
      .replace(/<h1 class="ql-align-justify"([^>]*)>([\s\S]*?)<\/h1>/g, '<h1 style="text-align: justify"$1>$2</h1>')
      .replace(/<h2 class="ql-align-center"([^>]*)>([\s\S]*?)<\/h2>/g, '<h2 style="text-align: center"$1>$2</h2>')
      .replace(/<h2 class="ql-align-right"([^>]*)>([\s\S]*?)<\/h2>/g, '<h2 style="text-align: right"$1>$2</h2>')
      .replace(/<h2 class="ql-align-justify"([^>]*)>([\s\S]*?)<\/h2>/g, '<h2 style="text-align: justify"$1>$2</h2>')
      .replace(/<h3 class="ql-align-center"([^>]*)>([\s\S]*?)<\/h3>/g, '<h3 style="text-align: center"$1>$2</h3>')
      .replace(/<h3 class="ql-align-right"([^>]*)>([\s\S]*?)<\/h3>/g, '<h3 style="text-align: right"$1>$2</h3>')
      .replace(/<h3 class="ql-align-justify"([^>]*)>([\s\S]*?)<\/h3>/g, '<h3 style="text-align: justify"$1>$2</h3>');

    // Gestisci <p> con classi + eventuali stili esistenti
    // Prima converti le classi in stili
    processed = processed
      .replace(/<p class="ql-align-center"([^>]*)>/g, (match, rest) => {
        if (rest.includes('style=')) {
          return match.replace(/style="/, 'style="text-align: center; ');
        }
        return `<p style="text-align: center"${rest}>`;
      })
      .replace(/<p class="ql-align-right"([^>]*)>/g, (match, rest) => {
        if (rest.includes('style=')) {
          return match.replace(/style="/, 'style="text-align: right; ');
        }
        return `<p style="text-align: right"${rest}>`;
      })
      .replace(/<p class="ql-align-justify"([^>]*)>/g, (match, rest) => {
        if (rest.includes('style=')) {
          return match.replace(/style="/, 'style="text-align: justify; ');
        }
        return `<p style="text-align: justify"${rest}>`;
      });

    // Converti classi Quill size in stili inline (supporta multilinea)
    processed = processed
      .replace(/<span class="ql-size-small">([\s\S]*?)<\/span>/g, '<span style="font-size: 9pt">$1</span>')
      .replace(/<span class="ql-size-large">([\s\S]*?)<\/span>/g, '<span style="font-size: 14pt">$1</span>')
      .replace(/<span class="ql-size-huge">([\s\S]*?)<\/span>/g, '<span style="font-size: 18pt">$1</span>');

    // Converti classi Quill font in stili inline (supporta multilinea)
    processed = processed
      .replace(/<span class="ql-font-cambria">([\s\S]*?)<\/span>/g, '<span style="font-family: Cambria, serif">$1</span>')
      .replace(/<span class="ql-font-arial">([\s\S]*?)<\/span>/g, '<span style="font-family: Arial, sans-serif">$1</span>')
      .replace(/<span class="ql-font-times">([\s\S]*?)<\/span>/g, '<span style="font-family: \'Times New Roman\', serif">$1</span>')
      .replace(/<span class="ql-font-courier">([\s\S]*?)<\/span>/g, '<span style="font-family: \'Courier New\', monospace">$1</span>');

    // Converti <strong>, <em>, <u> in tag standard (supporta multilinea)
    processed = processed
      .replace(/<strong>([\s\S]*?)<\/strong>/g, '<b>$1</b>')
      .replace(/<em>([\s\S]*?)<\/em>/g, '<i>$1</i>')
      .replace(/<u>([\s\S]*?)<\/u>/g, '<u>$1</u>'); // mantieni underline

    // Converti <p>, <h1>, <h2>, <h3> in <div> mantenendo tutti gli stili (supporta multilinea)
    processed = processed
      .replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/g, '<h1$1>$2</h1>\n')
      .replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/g, '<h2$1>$2</h2>\n')
      .replace(/<h3([^>]*)>([\s\S]*?)<\/h3>/g, '<h3$1>$2</h3>\n')
      .replace(/<p([^>]*)>([\s\S]*?)<\/p>/g, '<div$1>$2</div>\n')
      .replace(/<br\s*\/?>/gi, '\n');

    // Decodifica entità HTML
    processed = processed
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');

    return processed;
  }

  return (
    <Box
      sx={{
        height,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <Typography variant="subtitle2" fontWeight="bold">
          Live Preview
          {isRendering && (
            <CircularProgress size={16} sx={{ ml: 1, verticalAlign: 'middle' }} />
          )}
        </Typography>
      </Box>

      {/* Content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          bgcolor: 'background.default'
        }}
      >
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">
              Errore rendering:
            </Typography>
            <Typography variant="body2" component="pre" sx={{ mt: 1, whiteSpace: 'pre-wrap' }}>
              {error}
            </Typography>
          </Alert>
        ) : rendered ? (
          <Box>
            {rendered.split('[PAGE_BREAK]').map((pageContent, pageIndex, pages) => (
              <Box key={pageIndex}>
                <Paper
                  elevation={2}
                  sx={{
                    p: 3,
                    bgcolor: 'background.paper',
                    fontFamily: 'Cambria, serif',
                    fontSize: '11pt',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    minHeight: '400px',
                    mb: pageIndex < pages.length - 1 ? 2 : 0,
                    '& span': {
                      fontFamily: 'inherit'
                    },
                    '& b, & strong': {
                      fontWeight: 'bold'
                    },
                    '& i, & em': {
                      fontStyle: 'italic'
                    },
                    '& u': {
                      textDecoration: 'underline'
                    },
                    '& div': {
                      margin: 0,
                      fontFamily: 'inherit',
                      textAlign: 'inherit'
                    },
                    '& h1': {
                      fontSize: '32pt',
                      fontWeight: 'bold',
                      marginTop: '0.67em',
                      marginBottom: '0.67em',
                      lineHeight: 1.2
                    },
                    '& h2': {
                      fontSize: '24pt',
                      fontWeight: 'bold',
                      marginTop: '0.75em',
                      marginBottom: '0.75em',
                      lineHeight: 1.3
                    },
                    '& h3': {
                      fontSize: '18.72pt',
                      fontWeight: 'bold',
                      marginTop: '0.83em',
                      marginBottom: '0.83em',
                      lineHeight: 1.4
                    },
                    '& table': {
                      borderCollapse: 'collapse',
                      width: '100%',
                      margin: '10px 0',
                      border: '1px solid #ddd'
                    },
                    '& th': {
                      border: '1px solid #ddd',
                      padding: '8px',
                      backgroundColor: '#f5f5f5',
                      fontWeight: 'bold',
                      textAlign: 'center'
                    },
                    '& td': {
                      border: '1px solid #ddd',
                      padding: '8px'
                    }
                  }}
                  dangerouslySetInnerHTML={{ __html: pageContent }}
                />
                {pageIndex < pages.length - 1 && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      my: 2,
                      color: 'text.secondary'
                    }}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        height: '1px',
                        bgcolor: 'divider',
                        mx: 2
                      }}
                    />
                    <Typography variant="caption" sx={{ px: 2, fontStyle: 'italic' }}>
                      Interruzione di Pagina (Pagina {pageIndex + 2})
                    </Typography>
                    <Box
                      sx={{
                        flex: 1,
                        height: '1px',
                        bgcolor: 'divider',
                        mx: 2
                      }}
                    />
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            La preview apparirà qui...
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/**
 * Dati di esempio per preview DM329
 */
export const SAMPLE_DM329_DATA = {
  cliente: {
    ragione_sociale: 'ACME S.p.A.',
    sede_legale: {
      via: 'Via Roma',
      civico: '10',
      cap: '20100',
      comune: 'Milano',
      provincia: 'MI'
    }
  },
  sito_impianto: {
    via: 'Via delle Industrie',
    civico: '25',
    cap: '20020',
    comune: 'Arese',
    provincia: 'MI'
  },
  data_sopralluogo: '2024-12-01',
  nome_tecnico: 'Ing. Mario Rossi',
  descrizione_attivita: 'Fabbricazione di prodotti in plastica',
  dati_impianto: {
    locale_dedicato: true,
    accesso_locale_vietato: true,
    aria_aspirata: ['Esterno'],
    raccolta_condense: ['Disoleatori'],
    lontano_materiale_infiammabile: true
  },
  serbatoi: [
    {
      codice: 'S1',
      marca: 'Atlas Copco',
      modello: 'LV 500',
      volume: 500,
      ps_pressione_max: 13,
      ps_x_volume: 6500,
      ts_temperatura: 80,
      categoria_ped: 'II',
      anno: 2015,
      numero_fabbrica: '12345/2015',
      scarico: 'AUTOMATICO',
      finitura_interna: 'ZINCATO',
      ancorato_terra: true
    },
    {
      codice: 'S2',
      marca: 'Atlas Copco',
      modello: 'LV 1000',
      volume: 1000,
      ps_pressione_max: 13,
      ps_x_volume: 13000,
      ts_temperatura: 80,
      categoria_ped: 'III',
      anno: 2018,
      numero_fabbrica: '67890/2018',
      scarico: 'AUTOMATICO',
      finitura_interna: 'ZINCATO',
      ancorato_terra: true
    }
  ],
  compressori: [
    {
      codice: 'C1',
      marca: 'Kaeser',
      modello: 'ASD 37',
      volume_aria_prodotto: 3700,
      pressione_max: 13,
      anno: 2018,
      numero_fabbrica: 'A12345',
      tipo_giri: 'variabili (inverter)'
    }
  ],
  disoleatori: [
    {
      codice: 'C1.1',
      compressore_associato: 'C1',
      marca: 'Kaeser',
      modello: 'OSD 35',
      volume: 35,
      ps_pressione_max: 16,
      categoria_ped: 'I'
    }
  ],
  essiccatori: [],
  scambiatori: [],
  filtri: [],
  recipienti_filtro: [],
  separatori: [],
  valvole_sicurezza: [
    {
      codice: 'S1',
      numero_fabbrica: 'VS-123',
      pressione_taratura: 13,
      volume_aria_scaricato: 5000,
      portata_max_elaborabile: 300,
      portata_scaricata: 250,
      apparecchiatura_protetta: 'Serbatoio S1',
      ps_recipiente: 13
    }
  ],
  collegamenti_compressori_serbatoi: {
    C1: ['S1', 'S2']
  },
  spessimetrica: [],
  flags: {
    locale_dedicato: true,
    accesso_vietato: true,
    verifiche_spessimetriche: false,
    revisione_dichiarata: false
  }
};
