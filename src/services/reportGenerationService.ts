/**
 * Service per la generazione della Relazione Tecnica DM329 in formato .docx
 */

import {
  Document,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  AlignmentType,
  WidthType,
  VerticalAlign,
  HeadingLevel,
  BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';
import { Packer } from 'docx';

import { RelazioneTecnicaData, ApparecchiaturaFormattata, PlaceholderContext } from '../types/report';
import {
  formatAddress,
  formatSerbatoio,
  formatCompressore,
  formatEssiccatore,
  formatFiltro,
  formatSeparatore,
  pluralize,
  determinaFlags,
} from '../utils/reportUtils';

const STYLES = {
  font: 'Cambria',
  sizes: {
    normal: 22, // 11pt
    title: 30, // 15pt
    coverBox1: 36, // 18pt
    coverCompany: 48, // 24pt
    coverAddress: 32, // 16pt
  },
  margins: {
    top: 1417, // 2.5cm
    bottom: 1417,
    left: 1417,
    right: 850, // 1.5cm
  }
};

/**
 * Genera e scarica la relazione tecnica in formato .docx
 */
export async function generateRelazioneTecnica(data: RelazioneTecnicaData): Promise<void> {
  try {
    console.log('🚀 Inizio generazione relazione tecnica...', data);

    // 1. Prepara i dati
    console.log('📊 Preparazione contesto...');
    const context = buildPlaceholderContext(data);
    console.log('✅ Contesto preparato:', context);

    // 2. Costruisce il documento
    console.log('📝 Costruzione documento DOCX...');
    const doc = buildDocxDocument(context, data);
    console.log('✅ Documento costruito');

    // 3. Genera il blob e scarica
    console.log('💾 Generazione blob...');
    const blob = await Packer.toBlob(doc);
    const fileName = generateFileName(data.cliente.ragione_sociale);
    console.log('⬇️ Download file:', fileName);
    saveAs(blob, fileName);

    console.log('✅ Relazione tecnica generata con successo:', fileName);
  } catch (error) {
    console.error('❌ Errore durante la generazione della relazione tecnica:', error);
    throw new Error('Impossibile generare la relazione tecnica. Controlla i dati inseriti.');
  }
}

/**
 * Genera nome file per il download
 */
function generateFileName(ragioneSociale: string): string {
  const today = new Date();
  const dateStr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${today.getFullYear()}`;
  const clienteClean = ragioneSociale.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  return `Relazione_Tecnica_${clienteClean}_${dateStr}.docx`;
}

/**
 * Costruisce il contesto per la sostituzione dei placeholder
 */
function buildPlaceholderContext(data: RelazioneTecnicaData): PlaceholderContext {
  const { cliente, technicalData, additionalInfo } = data;

  // Parsing indirizzo sede legale
  const sedeLegale = cliente.via
    ? {
      via: cliente.via || '',
      civico: cliente.numero_civico || '',
      cap: cliente.cap || '',
      comune: cliente.comune || '',
      provincia: cliente.provincia || '',
    }
    : { via: '', civico: '', cap: '', comune: '', provincia: '' };

  // Parsing indirizzo sede impianto
  const sedeImpianto = technicalData.indirizzo_impianto_formatted
    ? formatAddress(technicalData.indirizzo_impianto_formatted)
    : { via: '', civico: '', cap: '', comune: '', provincia: '' };

  // Apparecchiature
  const equipmentData = technicalData.equipment_data || {};
  const serbatoi = equipmentData.serbatoi || [];
  const compressori = equipmentData.compressori || [];
  const disoleatori = equipmentData.disoleatori || [];
  const essiccatori = equipmentData.essiccatori || [];
  const scambiatori = equipmentData.scambiatori || [];
  const filtri = equipmentData.filtri || [];
  const recipientiFiltro = equipmentData.recipienti_filtro || [];
  const separatori = equipmentData.separatori || [];

  // Formatta tutte le apparecchiature
  const apparecchiature: ApparecchiaturaFormattata[] = [];

  // Compressori + disoleatori
  compressori.forEach((comp: any) => {
    const diso = disoleatori.find((d: any) => d.compressore_associato === comp.codice);
    apparecchiature.push(...formatCompressore(comp, diso));
  });

  // Serbatoi
  serbatoi.forEach((serb: any) => {
    apparecchiature.push(...formatSerbatoio(serb));
  });

  // Essiccatori + scambiatori
  essiccatori.forEach((ess: any) => {
    const scam = scambiatori.find((s: any) => s.essiccatore_associato === ess.codice);
    apparecchiature.push(...formatEssiccatore(ess, scam));
  });

  // Filtri + recipienti
  filtri.forEach((filt: any) => {
    const rec = recipientiFiltro.find((r: any) => r.filtro_associato === filt.codice);
    apparecchiature.push(...formatFiltro(filt, rec));
  });

  // Separatori
  separatori.forEach((sep: any) => {
    apparecchiature.push(formatSeparatore(sep));
  });

  // Flags
  const flags = determinaFlags(technicalData, additionalInfo.spessimetrica);

  return {
    ragioneSociale: cliente.ragione_sociale,
    sedeLegaleVia: sedeLegale.via,
    sedeLegaleCivico: sedeLegale.civico,
    sedeLegaleCap: sedeLegale.cap,
    sedeLegaleCitta: sedeLegale.comune,
    sedeLegaleProvincia: sedeLegale.provincia,
    sedeImpiantoVia: sedeImpianto.via,
    sedeImpiantoCivico: sedeImpianto.civico,
    sedeImpiantoCap: sedeImpianto.cap,
    sedeImpiantoCitta: sedeImpianto.comune,
    sedeImpiantoProvincia: sedeImpianto.provincia,
    descrizioneAttivita: additionalInfo.descrizioneAttivita,
    numeroCompressori: compressori.length,
    numeroSerbatoi: serbatoi.length,
    numeroEssiccatori: essiccatori.length,
    numeroFiltri: filtri.length,
    numeroSeparatori: separatori.length,
    flags,
    apparecchiature,
  };
}

/**
 * Costruisce il documento .docx completo
 */
function buildDocxDocument(context: PlaceholderContext, data: RelazioneTecnicaData): Document {
  const children: (Paragraph | Table)[] = [];

  // ========== COVER PAGE ==========

  // Box 1: Titolo
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
      },
      children: [
        new TextRun({
          text: 'RELAZIONE TECNICA',
          font: STYLES.font,
          size: STYLES.sizes.coverBox1,
          bold: true,
        }),
        new TextRun({
          text: '\nIMPIANTO ARIA COMPRESSA',
          font: STYLES.font,
          size: STYLES.sizes.coverBox1,
          bold: true,
        }),
        new TextRun({
          text: '\n(Art.6, comma 1, lettera b – D.M. 329/2004)',
          font: STYLES.font,
          size: STYLES.sizes.coverBox1,
          bold: true,
        }),
      ],
    }),
    new Paragraph({ text: '', spacing: { before: 400 } }) // Spacing
  );

  // Box 2: Cliente
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
      },
      children: [
        new TextRun({
          text: `Cliente ${context.ragioneSociale}`,
          font: STYLES.font,
          size: STYLES.sizes.coverCompany,
          bold: true,
        }),
        new TextRun({
          text: `\n${context.sedeLegaleVia}, ${context.sedeLegaleCivico}`,
          font: STYLES.font,
          size: STYLES.sizes.coverAddress,
        }),
        new TextRun({
          text: `\n${context.sedeLegaleCap} ${context.sedeLegaleCitta} (${context.sedeLegaleProvincia})`,
          font: STYLES.font,
          size: STYLES.sizes.coverAddress,
        }),
      ],
    }),
    new Paragraph({ text: '', spacing: { before: 400 } }) // Spacing
  );

  // Box 3: Sito Produttivo
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
      },
      children: [
        new TextRun({
          text: 'Sito produttivo in',
          font: STYLES.font,
          size: STYLES.sizes.coverAddress,
          bold: true,
        }),
        new TextRun({
          text: `\n${context.sedeImpiantoVia}, ${context.sedeImpiantoCivico}`,
          font: STYLES.font,
          size: STYLES.sizes.coverAddress,
        }),
        new TextRun({
          text: `\n${context.sedeImpiantoCap} ${context.sedeImpiantoCitta} (${context.sedeImpiantoProvincia})`,
          font: STYLES.font,
          size: STYLES.sizes.coverAddress,
        }),
      ],
    }),
    new Paragraph({ text: '', spacing: { before: 800 } }) // Spacing
  );

  // Box 4: Revision Table
  children.push(buildRevisionTable(data));

  // Page Break
  children.push(new Paragraph({ text: '', pageBreakBefore: true }));

  // --- SEZIONI ---
  children.push(...buildPremessaSection(context));
  children.push(...buildDescrizioneGeneraleSection(context, data));
  children.push(...buildCaratterizzazioneSection(context));
  children.push(...buildFluidiSection());
  children.push(...buildClassificazioneSection(context, data));
  children.push(...buildAccessoriSicurezzaSection(context, data));
  children.push(...buildConclusioniSection(context));

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: STYLES.margins.top,
              bottom: STYLES.margins.bottom,
              left: STYLES.margins.left,
              right: STYLES.margins.right,
            },
          },
        },
        children,
      },
    ],
    styles: {
      default: {
        document: {
          run: {
            font: STYLES.font,
            size: STYLES.sizes.normal,
          },
        },
        heading1: {
          run: {
            font: STYLES.font,
            size: STYLES.sizes.title,
            bold: true,
            color: '000000',
          },
          paragraph: {
            spacing: { after: 240 },
          },
        },
        heading2: {
          run: {
            font: STYLES.font,
            size: STYLES.sizes.title,
            bold: true,
            color: '000000',
          },
          paragraph: {
            spacing: { before: 240, after: 120 },
          },
        },
        heading3: {
          run: {
            font: STYLES.font,
            size: STYLES.sizes.normal,
            bold: true,
            color: '000000',
          },
          paragraph: {
            spacing: { before: 240, after: 120 },
          },
        },
      },
    },
  });
}

/**
 * Sezione Premessa
 */
function buildPremessaSection(context: PlaceholderContext): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: 'Premessa',
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      // "La presente relazione tecnica si riferisce all’impianto a pressione installato presso il sito produttivo della ditta: [ragione sociale] con sede sociale in San Polo di Piave (VE), CCC n° X, c.a.p. 31020, esercente attività di [descrizione ateco], [placeholder alternativo: ubicato presso la medesima sede sociale (se sede impianto = sede legale) OPPURE in (indirizzo sede impianto)."
      children: [
        new TextRun({
          text: `La presente relazione tecnica si riferisce all'impianto a pressione installato presso il sito produttivo della ditta: ${context.ragioneSociale} con sede sociale in ${context.sedeLegaleCitta} (${context.sedeLegaleProvincia}), ${context.sedeLegaleVia}${context.sedeLegaleCivico ? ', ' + context.sedeLegaleCivico : ''}, c.a.p. ${context.sedeLegaleCap}, esercente attività di ${context.descrizioneAttivita}, `,
        }),
        new TextRun({
          text: context.flags.localeDedicato // Simple heuristic: checking if addresses match roughly or defaulting to printing address
            ? `ubicato presso la medesima sede sociale.`
            : `ubicato in ${context.sedeImpiantoVia}${context.sedeImpiantoCivico ? ' ' + context.sedeImpiantoCivico : ''}, ${context.sedeImpiantoCap} ${context.sedeImpiantoCitta} (${context.sedeImpiantoProvincia}).`
        })
      ]
    }),
    new Paragraph({
      text: 'Essa, coerentemente alla vigente normativa di settore (PED 68/2014/UE, 29/2014/UE e D.M. 329/2004) è finalizzata a descrivere le condizioni di installazione e di esercizio e le misure di sicurezza adottate.',
    }),
    new Paragraph({
      text: 'L\'impianto in oggetto non costituisce "impianto" o "insieme" così come definiti dalla PED e pertanto non risulta necessario l\'intervento di un Organismo Notificato per la certificazione delle attività previste dalla PED. Ogni componente installato risulta infatti dotato di marcatura CE all\'origine.',
    }),
  ];

  if (context.flags.revisioneDiChiarata) {
    paragraphs.push(
      new Paragraph({
        text: `L'attuale revisione del documento è conseguente alla ${context.flags.motivoRevisione || 'richiesta del cliente'}. Vengono verificati i requisiti di sicurezza nelle nuove condizioni operative, con particolare riferimento alle valvole di sicurezza montate al momento della stesura di questa revisione.`,
      })
    );
  }

  if (context.flags.verificheSpessimetriche) {
    paragraphs.push(
      new Paragraph({
        text: 'Ove previsto in base alla tipologia di apparecchiatura ed alla periodicità stabilita dall’ art.3 del D.lgs. 93/2000 (vedasi tabella all’ultima pagina del presente documento), sono state effettuate le verifiche di integrità tramite Controllo Ultrasonoro Spessimetrico, che in tutti i casi hanno fornito esito positivo.',
      })
    );
  } else {
    // Add empty paragraph for spacing
    paragraphs.push(new Paragraph({ text: '' }));
  }

  return paragraphs;
}

/**
 * Sezione Descrizione Generale
 */
function buildDescrizioneGeneraleSection(
  context: PlaceholderContext,
  _data: RelazioneTecnicaData
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      text: 'Descrizione generale dell\'impianto',
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      text: 'L\'impianto in oggetto è finalizzato alla produzione e distribuzione di aria compressa a servizio delle utenze di produzione.',
    }),
    new Paragraph({
      text: 'Le apparecchiature che compongono l\'impianto in oggetto sono state installate conformemente ai manuali d\'uso e manutenzione forniti dai rispettivi fabbricanti ed in possesso della Ditta, ed utilizzate entro i limiti operativi indicati.',
    })
  );

  // Descrizione locale con placeholder
  const localeText = [
    "L'impianto è alloggiato entro un'area",
    context.flags.localeDedicato ? ' appositamente predisposta' : '',
    context.flags.accessoVietato ? ', accessibile solo al personale autorizzato' : '',
    ', correttamente areata e lontana da sorgenti di calore.'
  ].join('');

  paragraphs.push(new Paragraph({ text: localeText }));

  if (context.flags.localeDedicato) {
    paragraphs.push(
      new Paragraph({
        text: 'Il locale risulta interamente dedicato alla produzione, trattamento e stoccaggio dell\'aria compressa e non vi è presenza, nelle vicinanze delle apparecchiature, di materiale infiammabile. In considerazione del luogo di installazione si escludono scenari incidentali per incendio esterno o riscaldamento incontrollato.',
      })
    );
  }

  // Sezioni principali
  paragraphs.push(
    new Paragraph({
      text: 'Esso è costituito dalle seguenti sezioni principali:',
    }),
    new Paragraph({
      text: `Sezione di pompaggio costituita da n°${context.numeroCompressori} ${pluralize(context.numeroCompressori, 'compressore rotativo', 'compressori rotativi')} a vite${context.numeroCompressori > 0 ? ' a giri fissi / variabili tramite inverter' : ''}`,
      bullet: { level: 0 },
    }),
    new Paragraph({
      text: `Sezione di accumulo ed alimentazione delle linee aria compressa costituita da n°${context.numeroSerbatoi} ${pluralize(context.numeroSerbatoi, 'serbatoio polmone verticale', 'serbatoi polmone verticali')}`,
      bullet: { level: 0 },
    })
  );

  if (context.numeroEssiccatori > 0) {
    paragraphs.push(
      new Paragraph({
        text: `Sezione trattamento aria costituita da n°${context.numeroEssiccatori} ${pluralize(context.numeroEssiccatori, "essiccatore d'aria", "essiccatori d'aria")} a ciclo frigorifero${context.numeroFiltri > 0 ? ` e n°${context.numeroFiltri} ${pluralize(context.numeroFiltri, 'filtro', 'filtri')} di linea` : ''}`,
        bullet: { level: 0 },
      })
    );
  }

  if (context.numeroSeparatori > 0) {
    paragraphs.push(
      new Paragraph({
        text: 'Raccolta e trattamento delle condense tramite separatore acqua olio',
        bullet: { level: 0 },
      })
    );
  }

  paragraphs.push(
    new Paragraph({
      text: 'Raccolta delle condense in tanica dedicata',
      bullet: { level: 0 },
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'L\'impianto è protetto contro i rischi da sovrappressione dalle valvole di sicurezza nel seguito descritte. La portata e la pressione di progetto sono state determinate a partire dalle effettive esigenze produttive della Ditta.',
    }),
    new Paragraph({ text: '' })
  );

  return paragraphs;
}

/**
 * Sezione Caratterizzazione Apparecchiature
 */
function buildCaratterizzazioneSection(context: PlaceholderContext): (Paragraph | Table)[] {
  const paragraphs: (Paragraph | Table)[] = [];

  paragraphs.push(
    new Paragraph({
      text: 'Caratterizzazione delle apparecchiature',
      heading: HeadingLevel.HEADING_2,
      pageBreakBefore: true,
    }),
    new Paragraph({
      text: 'Lo schema sotto riportato rappresenta i principali elementi che compongono l\'impianto e la loro logica di assemblaggio:',
    }),
    new Paragraph({
      children: [new TextRun({ text: 'SCHEMA', italics: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 }
    }),
    new Paragraph({
      text: 'Con riferimento alla numerazione dello schema sopra riportato la tabella seguente riassume le caratteristiche delle principali apparecchiature che compongono l\'impianto:',
      spacing: { after: 200 }
    })
  );

  // Tabella caratteristiche apparecchiature
  paragraphs.push(buildEquipmentTable(context.apparecchiature));

  paragraphs.push(
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'La tabella che segue identifica la procedura a cui sono soggette le apparecchiature ai sensi del DM 329/2004:',
      spacing: { after: 200 }
    })
  );

  // Tabella verifiche
  paragraphs.push(buildVerificationTable(context.apparecchiature));

  paragraphs.push(new Paragraph({ text: '' }));

  return paragraphs;
}

/**
 * Crea tabella caratteristiche apparecchiature
 */
function buildEquipmentTable(apparecchiature: ApparecchiaturaFormattata[]): Table {
  const rows: TableRow[] = [];

  // Header strict match
  rows.push(
    new TableRow({
      tableHeader: true,
      children: [
        createTableCell('Pos.', true),
        createTableCell('Descrizione', true),
        createTableCell('Costruttore e Modello', true),
        createTableCell('Capacità [l]\nAria producibile [l/min]\nPortata scaricata [l/min]', true),
        createTableCell('Pressione massima [bar]\nPressione di taratura [bar]', true),
        createTableCell('Tempera-\ntura [°C]', true),
        createTableCell('Cate-\ngoria', true),
        createTableCell('Anno', true),
        createTableCell('Num. fabbrica', true),
      ],
    })
  );

  // Righe dati
  // Use a smaller font for table content to fit
  apparecchiature.forEach((app) => {
    const costruttoreModello = `${app.costruttore}\nModello: ${app.modello}`;
    const capacita = app.capacita ? String(app.capacita) : '';
    const pressione =
      app.pressioneMassima !== undefined
        ? String(app.pressioneMassima)
        : app.pressioneTaratura !== undefined
          ? String(app.pressioneTaratura)
          : '';
    const temperatura = app.temperatura ? String(app.temperatura) : '';
    const categoria = app.categoria || '';
    const anno = app.anno ? String(app.anno) : '';
    const numeroFabbrica = app.numeroFabbrica || '';

    rows.push(
      new TableRow({
        children: [
          createTableCell(app.posizione),
          createTableCell(app.descrizione),
          createTableCell(costruttoreModello),
          createTableCell(capacita),
          createTableCell(pressione),
          createTableCell(temperatura),
          createTableCell(categoria),
          createTableCell(anno),
          createTableCell(numeroFabbrica),
        ],
      })
    );
  });

  return new Table({
    rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  });
}

/**
 * Crea tabella verifiche
 */
function buildVerificationTable(apparecchiature: ApparecchiaturaFormattata[]): Table {
  const rows: TableRow[] = [];

  // Header
  rows.push(
    new TableRow({
      tableHeader: true,
      children: [
        createTableCell('Pos.', true),
        createTableCell('Descrizione', true),
        createTableCell('Costruttore e Modello', true),
        createTableCell('Num. fabbrica', true),
        createTableCell('Dichiaraz. messa in servizio', true),
        createTableCell('Verifica messa in servizio', true),
      ],
    })
  );

  // Raggruppa apparecchiature per tipo verifica
  const groups = raggruppaMissingVerifiche(apparecchiature);

  groups.forEach((group) => {
    const isDichiarazione = group.tipoVerifica === 'dichiarazione';
    const isVerifica = group.tipoVerifica === 'verifica';

    group.apparecchiature.forEach((app, index) => {
      const costruttoreModello = `${app.costruttore}\nModello: ${app.modello}`;

      rows.push(
        new TableRow({
          children: [
            createTableCell(app.posizione),
            createTableCell(app.descrizione),
            createTableCell(costruttoreModello),
            createTableCell(app.numeroFabbrica || ''),
            index === 0
              ? createTableCell(isDichiarazione ? '✓' : '', false, group.apparecchiature.length)
              : null,
            index === 0
              ? createTableCell(isVerifica ? '✓' : '', false, group.apparecchiature.length)
              : null,
          ].filter((cell) => cell !== null) as TableCell[],
        })
      );
    });
  });

  return new Table({
    rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  });
}

/**
 * Raggruppa apparecchiature per tipo verifica (con celle unite)
 */
function raggruppaMissingVerifiche(apparecchiature: ApparecchiaturaFormattata[]): any[] {
  const groups: any[] = [];
  let currentGroup: any = null;

  apparecchiature.forEach((app) => {
    const tipoVerifica = app.verificaInfo?.tipo || 'esclusa';

    if (!currentGroup || currentGroup.tipoVerifica !== tipoVerifica) {
      // Nuovo gruppo
      if (currentGroup) {
        groups.push(currentGroup);
      }
      currentGroup = {
        tipoVerifica,
        apparecchiature: [app],
      };
    } else {
      // Aggiungi al gruppo corrente
      currentGroup.apparecchiature.push(app);
    }
  });

  if (currentGroup) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Crea cella tabella
 */
function createTableCell(text: string, isHeader = false, rowSpan = 1): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: isHeader })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    verticalAlign: VerticalAlign.CENTER,
    rowSpan: rowSpan > 1 ? rowSpan : undefined,
    shading: isHeader ? { fill: 'D9D9D9' } : undefined,
  });
}

/**
 * Sezione Fluidi a Contatto
 */
function buildFluidiSection(): Paragraph[] {
  return [
    new Paragraph({
      text: 'FLUIDI A CONTATTO CON LE APPARECCHIATURE',
      heading: HeadingLevel.HEADING_2,
      pageBreakBefore: true,
    }),
    new Paragraph({
      text: 'Il fluido a contatto con le parti in pressione è ARIA (Gruppo 2 ai sensi dell\'art. 9 del D.Lgs. 93/2000).',
    }),
    new Paragraph({ text: '' }),
  ];
}

/**
 * Sezione Classificazione Apparecchiature
 */
function buildClassificazioneSection(
  context: PlaceholderContext,
  data: RelazioneTecnicaData
): (Paragraph | Table)[] {
  // context is reserved for future use
  void context;
  const paragraphs: (Paragraph | Table)[] = [];

  paragraphs.push(
    new Paragraph({
      text: 'CLASSIFICAZIONE DELLE APPARECCHIATURE E RELATIVI Sistemi di protezione e controllo',
      heading: HeadingLevel.HEADING_2,
      // pageBreakBefore: true, // Removed per instruction? Wait, user said "before Fluidi", not specifically here, but usually new chapters break. But user said "subito prima del capitolo: FLUIDI". So Fluidi gets the break.
    }),
    new Paragraph({
      text: 'Le apparecchiature che compongono l\'impianto sono dotate dei seguenti sistemi di protezione e controllo a garanzia delle condizioni di sicurezza del sistema:',
    }),
    new Paragraph({ text: '' })
  );

  // COMPRESSORI
  paragraphs.push(...buildCompressoriClassification(data));

  // ESSICCATORI
  paragraphs.push(...buildEssiccatoriClassification(data));

  // SERBATOI
  paragraphs.push(...buildSerbatoiClassification(data));

  // TUBAZIONI
  paragraphs.push(...buildTubazioniClassification());

  return paragraphs;
}

/**
 * Classificazione compressori
 */
function buildCompressoriClassification(data: RelazioneTecnicaData): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const compressori = data.technicalData.equipment_data?.compressori || [];
  const disoleatori = data.technicalData.equipment_data?.disoleatori || [];

  if (compressori.length === 0) return paragraphs;

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: pluralize(compressori.length, 'Compressore:', 'Compressori:'),
          italics: true
        })
      ],
    }),
    new Paragraph({
      text: 'La regolazione della pressione di esercizio è gestita mediante sonde di pressione e dalle valvole di sicurezza installate internamente per casi di eventuale sovrappressione.',
    }),
    new Paragraph({
      text: 'I compressori sono esclusi dal campo di applicazione del D.M. 329/2004 in base a quanto previsto dall\'Art. 1, punto 3, lettera "L" del D.L. 93/2000.',
    }),
    new Paragraph({ text: 'Nel caso in oggetto:' })
  );

  // Group compressors by disoleatore status
  const compStatus = compressori.map((comp: any) => {
    const diso = disoleatori.find((d: any) => d.compressore_associato === comp.codice);
    if (!diso) return { comp, status: 'no_diso' };

    // Check subject condition: V > 25 AND P > 12
    const isSubject = (diso.volume > 25) && (diso.ps_pressione_max > 12);
    return { comp, diso, status: isSubject ? 'subject' : 'exempt' };
  });

  const hasDiso = (c: any) => c.diso !== undefined;

  const single = compressori.length === 1;

  if (single) {
    const item = compStatus[0];
    if (!hasDiso(item) || item.status === 'exempt') {
      // ALTERNATIVA 1
      paragraphs.push(new Paragraph({
        text: `il serbatoio disoleatore a servizio del compressore, individuato alla posizione ${item.comp.codice}, ha volume inferiore a 25 litri e pertanto escluso dal campo di applicazione del D.M. 329/2004 ai sensi dell’art. 2.i del medesimo decreto.`
      }));
    } else {
      // ALTERNATIVA 2
      paragraphs.push(new Paragraph({
        text: `il serbatoio disoleatore a servizio del compressore, individuato alla posizione ${item.diso.codice}, ha volume superiore a 25 litri e pressione massima ammissibile superiore a 12 bar e pertanto, secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, risulta soggetto a verifica di messa in servizio.`
      }));
    }
  } else {
    // Multi
    const allNoDiso = compStatus.every((c: any) => !hasDiso(c) || c.status === 'exempt');
    const allSubject = compStatus.every((c: any) => c.status === 'subject');

    if (allNoDiso) {
      // ALTERNATIVA 3
      const ids = compStatus.map((c: any) => c.comp.codice).join(' e ');
      paragraphs.push(new Paragraph({
        text: `i serbatoi disoleatori a servizio dei compressori individuati alle posizioni ${ids} hanno volume inferiore a 25 litri e pertanto sono esclusi dal campo di applicazione del D.M. 329/2004 ai sensi dell’art. 2.i del medesimo decreto.`
      }));
    } else if (allSubject) {
      // ALTERNATIVA 5
      const ids = compStatus.map((c: any) => c.diso.codice).join(' e ');
      paragraphs.push(new Paragraph({
        text: `i serbatoi disoleatori a servizio dei compressori, individuati alle posizioni ${ids}, hanno volume superiore a 25 litri e pressione massima ammissibile superiore a 12 bar e pertanto, secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, risultano soggetti a verifica di messa in servizio.`
      }));
    } else {
      // ALTERNATIVA 4 (Mixed)
      const exempts = compStatus.filter((c: any) => !hasDiso(c) || c.status === 'exempt');
      const subjects = compStatus.filter((c: any) => c.status === 'subject');

      exempts.forEach((item: any) => {
        paragraphs.push(new Paragraph({
          text: `il serbatoio disoleatore a servizio del compressore, individuato alla posizione ${item.comp.codice}, ha volume inferiore a 25 litri e pertanto escluso dal campo di applicazione del D.M. 329/2004 ai sensi dell’art. 2.i del medesimo decreto.`
        }));
      });

      subjects.forEach((item: any) => {
        paragraphs.push(new Paragraph({
          text: `il serbatoio disoleatore a servizio del compressore, individuato alla posizione ${item.diso.codice}, ha volume superiore a 25 litri e pressione massima ammissibile superiore a 12 bar e pertanto, secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, risulta soggetto a verifica di messa in servizio.`
        }));
      });
    }
  }

  // Placeholder Spessimetrica
  const spessimetrica = data.additionalInfo?.spessimetrica;
  if (spessimetrica) {
    paragraphs.push(new Paragraph({
      text: `In considerazione della data di produzione e delle frequenze delle verifiche di integrità previste dall’ art.3 del D.lgs. 93/2000, il serbatoio disoleatore del compressore [id compressore] è stato sottoposto a verifica spessimetrica, con esito positivo.`
    }));
  }

  paragraphs.push(new Paragraph({ text: '' }));
  return paragraphs;
}

/**
 * Classificazione serbatoi
 */
/**
 * Classificazione serbatoi
 */
function buildSerbatoiClassification(data: RelazioneTecnicaData): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const serbatoi = data.technicalData.equipment_data?.serbatoi || [];

  if (serbatoi.length === 0) return paragraphs;

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: pluralize(serbatoi.length, 'Serbatoio di accumulo:', 'Serbatoi di accumulo:'),
          italics: true,
        }),
      ],
    })
  );

  const single = serbatoi.length === 1;
  const serbStatus = serbatoi.map((s: any) => ({
    serb: s,
    ps_v: (s.volume || 0) * (s.ps_pressione_max || 0),
    isVerifica: ((s.volume || 0) * (s.ps_pressione_max || 0)) > 8000
  }));

  if (single) {
    const item = serbStatus[0];
    paragraphs.push(new Paragraph({
      text: 'Rientra nel campo di applicazione del D.M. 329/2004.'
    }));
    const verificasText = item.isVerifica
      ? `e quindi superiore a 8000. Pertanto, secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, risulta soggetto a verifica di messa in servizio.`
      : `e quindi inferiore a 8000. Pertanto, secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, non risulta soggetto a verifica di messa in servizio ma esclusivamente a dichiarazione di messa in servizio.`;

    paragraphs.push(new Paragraph({
      text: `In particolare, il serbatoio individuato alla posizione ${item.serb.codice} ha volume pari a ${item.serb.volume} litri e pressione massima ammissibile pari a ${item.serb.ps_pressione_max} bar. Il prodotto Ps x V è pari a ${item.ps_v} ${verificasText}`
    }));

    addSerbatoioAccessories(paragraphs, item.serb);

  } else {
    paragraphs.push(new Paragraph({
      text: 'Rientrano nel campo di applicazione del D.M. 329/2004.'
    }));
    paragraphs.push(new Paragraph({
      text: 'Tutti i serbatoi di accumulo presenti sono dotati di valvole di sicurezza opportunamente dimensionate, come dimostrato nel seguito del presente documento.'
    }));

    serbStatus.forEach((item: any) => {
      const verificasText = item.isVerifica
        ? `e quindi superiore a 8000. Pertanto, secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, risulta soggetto a verifica di messa in servizio.`
        : `e quindi inferiore a 8000. Pertanto, secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, non risulta soggetto a verifica di messa in servizio ma esclusivamente a dichiarazione di messa in servizio.`;

      paragraphs.push(new Paragraph({
        text: `il serbatoio individuato alla posizione ${item.serb.codice} ha volume pari a ${item.serb.volume} litri e pressione massima ammissibile pari a ${item.serb.ps_pressione_max} bar. Il prodotto Ps x V è pari a ${item.ps_v} ${verificasText}`
      }));
      addSerbatoioAccessories(paragraphs, item.serb);
    });
  }

  paragraphs.push(new Paragraph({ text: '' }));
  return paragraphs;
}

/**
 * Classificazione essiccatori
 */
function buildEssiccatoriClassification(data: RelazioneTecnicaData): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const essiccatori = data.technicalData.equipment_data?.essiccatori || [];
  const scambiatori = data.technicalData.equipment_data?.scambiatori || [];

  if (essiccatori.length === 0) return paragraphs;

  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: 'Essiccatore a ciclo frigorifero:', italics: true })]
    })
  );

  const essStatus = essiccatori.map((ess: any) => {
    // Try to find associated scambiatore. 
    const scam = scambiatori.find((s: any) => s.codice.startsWith(ess.codice + '.'));
    if (!scam) return { ess, status: 'exempt' };
    const isSubject = (scam.volume > 25) && (scam.ps_pressione_max > 12);
    return { ess, scam, status: isSubject ? 'subject' : 'exempt' };
  });

  const single = essiccatori.length === 1;

  if (single) {
    const item = essStatus[0];
    if (item.status === 'exempt') {
      // Alt 1
      paragraphs.push(new Paragraph({
        text: `Si tratta di una apparecchiatura, individuata alla posizione ${item.ess.codice}, priva di recipienti di volume superiore a 25 litri e pertanto escluso dal campo di applicazione del D.M. 329/2004 ai sensi dell’art. 2.i del medesimo decreto.`
      }));
    } else {
      // Alt 2
      const scamCode = item.scam ? item.scam.codice : '?';
      paragraphs.push(new Paragraph({
        text: `Si tratta di una apparecchiatura, individuata alla posizione ${item.ess.codice}, dotata di uno scambiatore di calore in pressione, individuato alla posizione ${scamCode}, con volume superiore a 25 litri e pressione massima ammissibile superiore a 12 bar e pertanto, secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, risulta soggetto a verifica di messa in servizio.`
      }));
    }
  } else {
    // Multi logic (Simplified for length - can expand if critical)
    const allExempt = essStatus.every((e: any) => e.status === 'exempt');
    const allSubject = essStatus.every((e: any) => e.status === 'subject');

    if (allExempt) {
      const ids = essStatus.map((e: any) => e.ess.codice).join(', ');
      paragraphs.push(new Paragraph({
        text: `Si tratta di apparecchiature, individuate alle posizioni ${ids}, prive di recipienti di volume superiore a 25 litri e pertanto escluse dal campo di applicazione del D.M. 329/2004 ai sensi dell’art. 2.i del medesimo decreto.`
      }));
    } else if (allSubject) {
      const idsE = essStatus.map((e: any) => e.ess.codice).join(', ');
      const idsS = essStatus.map((e: any) => (e.scam ? e.scam.codice : '?')).join(', ');
      paragraphs.push(new Paragraph({
        text: `Si tratta di apparecchiature, individuate alle posizioni ${idsE}, dotate di scambiatori di calore in pressione, individuati alle posizioni ${idsS}, con volume superiore a 25 litri e pressione massima ammissibile superiore a 12 bar e pertanto, secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, risulta soggetto a verifica di messa in servizio.`
      }));
    } else {
      // Mixed
      essStatus.forEach((item: any) => {
        if (item.status === 'exempt') {
          paragraphs.push(new Paragraph({
            text: `l’essiccatore ${item.ess.codice} è una apparecchiatura, individuata alla posizione ${item.ess.codice}, priva di recipienti di volume superiore a 25 litri e pertanto escluso dal campo di applicazione del D.M. 329/2004 ai sensi dell’art. 2.i del medesimo decreto.`
          }));
        } else {
          paragraphs.push(new Paragraph({
            text: `l’essiccatore ${item.ess.codice} è una apparecchiatura, individuata alla posizione ${item.ess.codice}, dotata di uno scambiatore di calore in pressione, individuato alla posizione ${item.scam ? item.scam.codice : '?'}, con volume superiore a 25 litri e pressione massima ammissibile superiore a 12 bar e pertanto, secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, risulta soggetto a verifica di messa in servizio.`
          }));
        }
      });
    }
  }

  paragraphs.push(new Paragraph({ text: '' }));
  return paragraphs;
}


function addSerbatoioAccessories(paragraphs: Paragraph[], serb: any) {
  const scarico = serb.scaricatore_condensa === 'Manuale' ? 'manuale' : 'automatico';
  paragraphs.push(new Paragraph({
    text: `È completo di scaricatore di condensa ${scarico} per prevenire l’accumulo di acqua in grado di originare fenomeni di corrosione localizzata. ${serb.finitura_interna === 'Zincato' ? 'I fenomeni di corrosione sono inoltre minimizzati dalla finitura superficiale zincata. ' : ''}${serb.finitura_interna === 'Vitroflex' ? 'I fenomeni di corrosione sono inoltre minimizzati dalla finitura superficiale vetrificata. ' : ''}Risulta inoltre ${serb.ancorato ? 'ancorato a terra, ' : ''}dotato di manometro di controllo della pressione${(serb.manometro_fondo_scala && serb.manometro_segno_rosso) ? ' riportante fondo scala a ' + serb.manometro_fondo_scala + ' bar e segno rosso a ' + serb.manometro_segno_rosso + ' bar.' : '.'}`
  }));
}

/**
 * Classificazione tubazioni
 */
function buildTubazioniClassification(): Paragraph[] {
  return [
    new Paragraph({
      text: 'Tubazioni:',
      heading: HeadingLevel.HEADING_3,
    }),
    new Paragraph({
      text: 'Tutte le tubazioni destinate a contenere aria compressa hanno DN≤80mm e pertanto escluse dal campo di applicazione del D.M. 329/2004 ai sensi dell\'art. 2.i del medesimo decreto.',
    }),
    new Paragraph({ text: '' }),
  ];
}

/**
 * Build revision table for cover page
 */
function buildRevisionTable(_data: RelazioneTecnicaData): Table {
  const today = new Date();
  const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${today.getFullYear()}`;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 10, color: '000000' },
      bottom: { style: BorderStyle.SINGLE, size: 10, color: '000000' },
      left: { style: BorderStyle.SINGLE, size: 10, color: '000000' },
      right: { style: BorderStyle.SINGLE, size: 10, color: '000000' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
      insideVertical: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
    },
    rows: [
      // Signature row
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                text: "L'Utilizzatore",
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 400 },
              }),
              new Paragraph({
                text: '________________________',
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            columnSpan: 2,
            margins: { top: 100, bottom: 100 },
          }),
          new TableCell({
            children: [
              new Paragraph({
                text: 'Il Tecnico',
                alignment: AlignmentType.CENTER,
                spacing: { before: 100, after: 400 },
              }),
              new Paragraph({
                text: '________________________',
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
              }),
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100 },
          }),
        ],
      }),
      // Header row
      new TableRow({
        tableHeader: true,
        children: [
          createTableCell('DATA', true),
          createTableCell('REV.', true),
          createTableCell('OGGETTO', true),
        ],
      }),
      // Empty rows
      new TableRow({
        children: [
          createTableCell('-'),
          createTableCell(''),
          createTableCell(''),
        ],
      }),
      new TableRow({
        children: [
          createTableCell('-'),
          createTableCell(''),
          createTableCell(''),
        ],
      }),
      new TableRow({
        children: [
          createTableCell('-'),
          createTableCell(''),
          createTableCell(''),
        ],
      }),
      // Current date row
      new TableRow({
        children: [
          createTableCell(dateStr),
          createTableCell('0'),
          createTableCell('prima emissione'),
        ],
      }),
    ],
  });
}

/**
 * Sezione Dispositivi di protezione (Accessori di sicurezza)
 */
function buildAccessoriSicurezzaSection(
  context: PlaceholderContext,
  data: RelazioneTecnicaData
): (Paragraph | Table)[] {
  // context is reserved for future use
  void context;
  const paragraphs: (Paragraph | Table)[] = [];
  const valvole = data.technicalData.equipment_data?.valvole_sicurezza || [];

  paragraphs.push(
    new Paragraph({
      text: 'DISPOSITIVI DI PROTEZIONE (Accessori di sicurezza)',
      heading: HeadingLevel.HEADING_2,
      pageBreakBefore: true,
    }),
    new Paragraph({
      text: 'Come desumibile dalle dichiarazioni di conformità rilasciate dai Fabbricanti, gli accessori di sicurezza installati a protezione delle apparecchiatura a pressione risultano idonei per il fluido contenuto e per le condizioni di esercizio.',
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'Verifica portata di scarico',
      heading: HeadingLevel.HEADING_3,
    }),
    new Paragraph({
      text: 'Dalle verifiche condotte, la portata di scarico garantita dalle valvole di sicurezza risulta superiore alla massima portata elaborabile dai compressori o dalla capacità di generazione del sistema e pertanto la verifica risulta soddisfatta.'
    }),
    new Paragraph({ text: '' })
  );

  // Table 1: Verifica Portata
  const rowsPortata: TableRow[] = [];
  rowsPortata.push(
    new TableRow({
      tableHeader: true,
      children: [
        createTableCell('Pos.', true),
        createTableCell('n.f. valvola', true),
        createTableCell('Apparecchiature connesse', true),
        createTableCell('Portata massima da elaborare [kg/h]', true),
        createTableCell('Portata scaricata [kg/h]', true),
        createTableCell('Adeguato', true),
      ],
    })
  );

  if (valvole.length > 0) {
    valvole.forEach((v: any) => {
      rowsPortata.push(new TableRow({
        children: [
          createTableCell(v.codice || '-'),
          createTableCell(v.numero_fabbrica || '-'),
          createTableCell(v.apparecchiatura_protetta || '-'),
          createTableCell(String(v.portata_max_elaborabile || '-')),
          createTableCell(String(v.portata_scaricata || '-')),
          createTableCell('SI'),
        ]
      }));
    });
  } else {
    rowsPortata.push(new TableRow({ children: [createTableCell('-'), createTableCell('-'), createTableCell('-'), createTableCell('-'), createTableCell('-'), createTableCell('-')] }));
  }

  paragraphs.push(
    new Table({ rows: rowsPortata, width: { size: 100, type: WidthType.PERCENTAGE } }),
    new Paragraph({ text: '' }),
    new Paragraph({
      children: [new TextRun({
        text: 'Regole di compilazione della tabella:',
        italics: true,
        size: 20
      })],
    }),
    new Paragraph({
      text: 'La colonna "Adeguato" è spuntata se il valore della colonna "Portata scaricata" è maggiore del valore riportato nella colonna "Portata massima da elaborare".',
      bullet: { level: 0 }
    }),
    new Paragraph({ text: '' })
  );

  // Table 2: Verifica Pressione
  paragraphs.push(
    new Paragraph({
      text: 'Verifica pressione di taratura',
      heading: HeadingLevel.HEADING_3,
    }),
    new Paragraph({
      text: 'La pressione di taratura delle valvole risulta adeguata alla pressione massima ammissibile delle attrezzature protette e la verifica risulta positiva.',
    }),
    new Paragraph({ text: '' })
  );

  const rowsPressione: TableRow[] = [];
  rowsPressione.push(
    new TableRow({
      tableHeader: true,
      children: [
        createTableCell('Pos.', true),
        createTableCell('n.f. valvola', true),
        createTableCell('Apparecchiature connesse', true),
        createTableCell('Pressione massima recipiente [bar]', true),
        createTableCell('PS [bar]', true),
        createTableCell('Pressione di taratura [bar]', true),
        createTableCell('Adeguato', true),
      ],
    })
  );

  if (valvole.length > 0) {
    valvole.forEach((v: any) => {
      rowsPressione.push(new TableRow({
        children: [
          createTableCell(v.codice || '-'),
          createTableCell(v.numero_fabbrica || '-'),
          createTableCell(v.apparecchiatura_protetta || '-'),
          createTableCell(String(v.pressione_max_recipiente || '-')),
          createTableCell(String(v.ps_recipiente || '-')),
          createTableCell(String(v.pressione_taratura || '-')),
          createTableCell('SI'),
        ]
      }));
    });
  } else {
    rowsPressione.push(new TableRow({ children: [createTableCell('-'), createTableCell('-'), createTableCell('-'), createTableCell('-'), createTableCell('-'), createTableCell('-'), createTableCell('-')] }));
  }

  paragraphs.push(
    new Table({ rows: rowsPressione, width: { size: 100, type: WidthType.PERCENTAGE } }),
    new Paragraph({ text: '' })
  );

  return paragraphs;
}

/**
 * Sezione Conclusioni
 */
function buildConclusioniSection(context: PlaceholderContext): (Paragraph | Table)[] {
  // context is reserved for future use
  void context;
  return [
    new Paragraph({
      text: 'CONCLUSIONI',
      heading: HeadingLevel.HEADING_2,
      pageBreakBefore: true,
    }),
    new Paragraph({
      text: 'Dall’esame della documentazione tecnica esibita e/o reperita, si attesta che, per quanto concerne le verifiche di competenza:',
    }),
    new Paragraph({
      text: 'le attrezzature a pressione e gli insiemi descritti in premessa, risultano installati in conformità alle disposizioni legislative vigenti (D.M. 329/04) e idonei all’esercizio.',
      bullet: { level: 0 }
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'Verifiche periodiche',
      heading: HeadingLevel.HEADING_3,
      pageBreakBefore: true,
    }),
    new Paragraph({
      text: 'Le attrezzature rientranti nel campo di applicazione del D.M. 329/2004 sono soggette a riqualificazione periodica secondo le scadenze riportate nella tabella seguente.',
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          tableHeader: true,
          children: [createTableCell('Descrizione', true), createTableCell('riqualificazione', true), createTableCell('Integrità', true)]
        }),
        new TableRow({ children: [createTableCell('Recipienti per gas compressi non corrosivi (Aria compressa)'), createTableCell('Decennale'), createTableCell('Decennale')] }),
        new TableRow({ children: [createTableCell('Tubazioni per gas compressi non corrosivi (Aria compressa)'), createTableCell('Decennale'), createTableCell('Decennale')] })
      ]
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'ALLEGATI',
      heading: HeadingLevel.HEADING_2,
      pageBreakBefore: true,
    }),
    new Paragraph({
      text: 'Alla presente relazione tecnica si allegano:',
    }),
    new Paragraph({
      text: 'Layout dell’impianto con identificazione delle attrezzature;',
      bullet: { level: 0 }
    }),
    new Paragraph({
      text: 'Schema P&Id;',
      bullet: { level: 0 }
    }),
    new Paragraph({
      text: 'Dichiarazione di conformità dell’insieme (ove prevista);',
      bullet: { level: 0 }
    }),
    new Paragraph({
      text: 'Verifiche di integrità (ove previste).',
      bullet: { level: 0 }
    }),
    new Paragraph({ text: '' }),
  ];
}

