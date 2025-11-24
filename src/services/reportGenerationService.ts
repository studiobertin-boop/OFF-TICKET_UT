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
  formatApparecchiatureList,
  determinaFlags,
} from '../utils/reportUtils';

/**
 * Genera e scarica la relazione tecnica in formato .docx
 */
export async function generateRelazioneTecnica(data: RelazioneTecnicaData): Promise<void> {
  try {
    // 1. Prepara i dati
    const context = buildPlaceholderContext(data);

    // 2. Costruisce il documento
    const doc = buildDocxDocument(context, data);

    // 3. Genera il blob e scarica
    const blob = await Packer.toBlob(doc);
    const fileName = generateFileName(data.cliente.ragione_sociale);
    saveAs(blob, fileName);

    console.log('Relazione tecnica generata con successo:', fileName);
  } catch (error) {
    console.error('Errore durante la generazione della relazione tecnica:', error);
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
        civico: '',
        cap: cliente.cap || '',
        citta: cliente.citta || '',
        provincia: cliente.provincia || '',
      }
    : { via: '', civico: '', cap: '', citta: '', provincia: '' };

  // Parsing indirizzo sede impianto
  const sedeImpianto = technicalData.indirizzo_impianto_formatted
    ? formatAddress(technicalData.indirizzo_impianto_formatted)
    : { via: '', civico: '', cap: '', citta: '', provincia: '' };

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
    sedeLegaleCitta: sedeLegale.citta,
    sedeLegaleProvincia: sedeLegale.provincia,
    sedeImpiantoVia: sedeImpianto.via,
    sedeImpiantoCivico: sedeImpianto.civico,
    sedeImpiantoCap: sedeImpianto.cap,
    sedeImpiantoCitta: sedeImpianto.citta,
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
  const children: any[] = [];

  // INTESTAZIONE
  children.push(
    new Paragraph({
      text: 'RELAZIONE TECNICA',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: 'IMPIANTO ARIA COMPRESSA',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      text: '(Art.6, comma 1, lettera b – D.M. 329/2004)',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '' }), // Spazio

    // Dati cliente
    new Paragraph({
      children: [
        new TextRun({ text: 'Cliente ', bold: true, italics: true }),
        new TextRun({ text: context.ragioneSociale, bold: true, italics: true }),
      ],
    }),
    new Paragraph({
      text: `${context.sedeLegaleVia}${context.sedeLegaleCivico ? ', ' + context.sedeLegaleCivico : ''}`,
    }),
    new Paragraph({
      text: `${context.sedeLegaleCap} ${context.sedeLegaleCitta} (${context.sedeLegaleProvincia})`,
    }),
    new Paragraph({ text: '' }),

    new Paragraph({
      children: [new TextRun({ text: 'Sito produttivo in', bold: true })],
    }),
    new Paragraph({
      text: `${context.sedeImpiantoVia}${context.sedeImpiantoCivico ? ', ' + context.sedeImpiantoCivico : ''}`,
    }),
    new Paragraph({
      text: `${context.sedeImpiantoCap} ${context.sedeImpiantoCitta} (${context.sedeImpiantoProvincia})`,
    }),
    new Paragraph({ text: '' })
  );

  // PREMESSA
  children.push(...buildPremessaSection(context));

  // DESCRIZIONE GENERALE
  children.push(...buildDescrizioneGeneraleSection(context, data));

  // CARATTERIZZAZIONE APPARECCHIATURE
  children.push(...buildCaratterizzazioneSection(context));

  // CLASSIFICAZIONE APPARECCHIATURE
  children.push(...buildClassificazioneSection(context, data));

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}

/**
 * Sezione Premessa
 */
function buildPremessaSection(context: PlaceholderContext): Paragraph[] {
  return [
    new Paragraph({
      text: 'Premessa',
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      text: `La presente relazione tecnica si riferisce all'impianto a pressione installato presso il sito produttivo della ditta: ${context.ragioneSociale} con sede sociale in ${context.sedeLegaleCitta} (${context.sedeLegaleProvincia}), ${context.sedeLegaleVia}${context.sedeLegaleCivico ? ', ' + context.sedeLegaleCivico : ''}, c.a.p. ${context.sedeLegaleCap}, esercente attività di ${context.descrizioneAttivita}.`,
    }),
    new Paragraph({
      text: 'Essa, coerentemente alla vigente normativa di settore (PED 68/2014/UE, 29/2014/UE e D.M. 329/2004) è finalizzata a descrivere le condizioni di installazione e di esercizio e le misure di sicurezza adottate.',
    }),
    new Paragraph({
      text: "L'impianto in oggetto non costituisce \"impianto\" o \"insieme\" così come definiti dalla PED e pertanto non risulta necessario l'intervento di un Organismo Notificato per la certificazione delle attività previste dalla PED. Ogni componente installato risulta infatti dotato di marcatura CE all'origine.",
    }),
    new Paragraph({ text: '' }),
  ];
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
      text: "Descrizione generale dell'impianto",
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      text: "L'impianto in oggetto è finalizzato alla produzione e distribuzione di aria compressa a servizio delle utenze di produzione.",
    }),
    new Paragraph({
      text: "Le apparecchiature che compongono l'impianto in oggetto sono state installate conformemente ai manuali d'uso e manutenzione forniti dai rispettivi fabbricanti ed in possesso della Ditta, ed utilizzate entro i limiti operativi indicati.",
    })
  );

  // Descrizione locale
  const localeDedicatoText = context.flags.localeDedicato ? ' appositamente predisposta' : '';
  const accessoText = context.flags.accessoVietato ? ', accessibile solo al personale autorizzato' : '';

  paragraphs.push(
    new Paragraph({
      text: `L'impianto è alloggiato entro un'area${localeDedicatoText}${accessoText}, correttamente areata e lontana da sorgenti di calore.`,
    })
  );

  if (context.flags.localeDedicato) {
    paragraphs.push(
      new Paragraph({
        text: "Il locale risulta interamente dedicato alla produzione, trattamento e stoccaggio dell'aria compressa e non vi è presenza, nelle vicinanze delle apparecchiature, di materiale infiammabile. In considerazione del luogo di installazione si escludono scenari incidentali per incendio esterno o riscaldamento incontrollato.",
      })
    );
  }

  // Sezioni principali
  paragraphs.push(
    new Paragraph({
      text: 'Esso è costituito dalle seguenti sezioni principali:',
    }),
    new Paragraph({
      text: `Sezione di pompaggio costituita da n°${context.numeroCompressori} ${pluralize(context.numeroCompressori, 'compressore rotativo', 'compressori rotativi')} a vite`,
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
      text: "L'impianto è protetto contro i rischi da sovrappressione dalle valvole di sicurezza nel seguito descritte. La portata e la pressione di progetto sono state determinate a partire dalle effettive esigenze produttive della Ditta.",
    }),
    new Paragraph({ text: '' })
  );

  return paragraphs;
}

/**
 * Sezione Caratterizzazione Apparecchiature
 */
function buildCaratterizzazioneSection(context: PlaceholderContext): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      text: 'Caratterizzazione delle apparecchiature',
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      text: 'Lo schema sotto riportato rappresenta i principali elementi che compongono l\'impianto e la loro logica di assemblaggio:',
    }),
    new Paragraph({
      children: [new TextRun({ text: 'SCHEMA', italics: true })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'Con riferimento alla numerazione dello schema sopra riportato la tabella seguente riassume le caratteristiche delle principali apparecchiature che compongono l\'impianto:',
    }),
    new Paragraph({ text: '' })
  );

  // Tabella caratteristiche apparecchiature
  paragraphs.push(buildEquipmentTable(context.apparecchiature));

  paragraphs.push(
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'La tabella che segue identifica la procedura a cui sono soggette le apparecchiature ai sensi del DM 329/2004:',
    }),
    new Paragraph({ text: '' })
  );

  // Tabella verifiche
  paragraphs.push(buildVerificationTable(context.apparecchiature));

  paragraphs.push(new Paragraph({ text: '' }));

  return paragraphs;
}

/**
 * Crea tabella caratteristiche apparecchiature
 */
function buildEquipmentTable(apparecchiature: ApparecchiaturaFormattata[]): any {
  const rows: TableRow[] = [];

  // Header
  rows.push(
    new TableRow({
      tableHeader: true,
      children: [
        createTableCell('Pos.', true),
        createTableCell('Descrizione', true),
        createTableCell('Costruttore e Modello', true),
        createTableCell('Capacità [l]\nAria producibile [l/min]\nPortata scaricata [l/min]', true),
        createTableCell('Pressione massima [bar]\nPressione di taratura [bar]', true),
        createTableCell('Temperatura [°C]', true),
        createTableCell('Categoria', true),
        createTableCell('Anno', true),
        createTableCell('Num. fabbrica', true),
      ],
    })
  );

  // Righe dati
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
function buildVerificationTable(apparecchiature: ApparecchiaturaFormattata[]): any {
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
 * Sezione Classificazione Apparecchiature
 */
function buildClassificazioneSection(
  context: PlaceholderContext,
  data: RelazioneTecnicaData
): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  paragraphs.push(
    new Paragraph({
      text: 'CLASSIFICAZIONE DELLE APPARECCHIATURE E RELATIVI Sistemi di protezione e controllo',
      heading: HeadingLevel.HEADING_2,
    }),
    new Paragraph({
      text: 'Le apparecchiature che compongono l\'impianto sono dotate dei seguenti sistemi di protezione e controllo a garanzia delle condizioni di sicurezza del sistema:',
    }),
    new Paragraph({ text: '' })
  );

  // Sezioni per tipo apparecchiatura (compressori, serbatoi, essiccatori, tubazioni)
  paragraphs.push(...buildCompressoriClassification(context, data));
  paragraphs.push(...buildSerbatoiClassification(context, data));
  paragraphs.push(...buildEssiccatoriClassification(context, data));
  paragraphs.push(...buildTubazioniClassification());

  return paragraphs;
}

/**
 * Classificazione compressori
 */
function buildCompressoriClassification(
  context: PlaceholderContext,
  data: RelazioneTecnicaData
): Paragraph[] {
  // context is reserved for future use
  void context;
  const paragraphs: Paragraph[] = [];
  const compressori = data.technicalData.equipment_data?.compressori || [];
  const disoleatori = data.technicalData.equipment_data?.disoleatori || [];

  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: 'Compressori:', italics: true })],
    }),
    new Paragraph({
      text: 'La regolazione della pressione di esercizio è gestita mediante sonde di pressione e dalle valvole di sicurezza installate internamente per casi di eventuale sovrappressione.',
    }),
    new Paragraph({
      text: 'I compressori sono esclusi dal campo di applicazione del D.M. 329/2004 in base a quanto previsto dall\'Art. 1, punto 3, lettera "L" del D.L. 93/2000.',
    }),
    new Paragraph({ text: 'Nel caso in oggetto:' })
  );

  // Determina quali compressori hanno disoleatore
  const compressoriConDisoleatore = compressori.filter((c: any) =>
    disoleatori.some((d: any) => d.compressore_associato === c.codice)
  );
  const compressoriSenzaDisoleatore = compressori.filter(
    (c: any) => !disoleatori.some((d: any) => d.compressore_associato === c.codice)
  );

  if (compressoriConDisoleatore.length > 0 && compressoriSenzaDisoleatore.length === 0) {
    // Tutti hanno disoleatore
    const codiciDiso = compressoriConDisoleatore
      .map((c: any) => {
        const diso = disoleatori.find((d: any) => d.compressore_associato === c.codice);
        return diso?.codice;
      })
      .filter(Boolean);

    paragraphs.push(
      new Paragraph({
        text: `${pluralize(codiciDiso.length, 'il serbatoio disoleatore a servizio del compressore', 'i serbatoi disoleatori a servizio dei compressori')}, ${pluralize(codiciDiso.length, 'individuato alla posizione', 'individuati alle posizioni')} ${formatApparecchiatureList(codiciDiso)}, ${pluralize(codiciDiso.length, 'ha', 'hanno')} volume superiore a 25 litri e pressione massima ammissibile superiore a 12 bar e pertanto, secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004, ${pluralize(codiciDiso.length, 'risulta soggetto', 'risultano soggetti')} a verifica di messa in servizio.`,
      })
    );
  } else if (compressoriSenzaDisoleatore.length > 0 && compressoriConDisoleatore.length === 0) {
    // Nessuno ha disoleatore
    const codiciComp = compressoriSenzaDisoleatore.map((c: any) => c.codice);
    paragraphs.push(
      new Paragraph({
        text: `${pluralize(codiciComp.length, 'il serbatoio disoleatore a servizio del compressore', 'i serbatoi disoleatori a servizio dei compressori')}, ${pluralize(codiciComp.length, 'individuato alla posizione', 'individuati alle posizioni')} ${formatApparecchiatureList(codiciComp)}, ${pluralize(codiciComp.length, 'ha', 'hanno')} volume inferiore a 25 litri e pertanto ${pluralize(codiciComp.length, 'escluso', 'esclusi')} dal campo di applicazione del D.M. 329/2004 ai sensi dell'art. 2.i del medesimo decreto.`,
      })
    );
  } else {
    // Mix
    paragraphs.push(
      new Paragraph({
        text: 'Alcuni compressori hanno disoleatori soggetti a verifica, mentre altri hanno disoleatori esclusi dal campo di applicazione del D.M. 329/2004.',
        bullet: { level: 0 },
      })
    );
  }

  paragraphs.push(new Paragraph({ text: '' }));

  return paragraphs;
}

/**
 * Classificazione serbatoi
 */
function buildSerbatoiClassification(
  context: PlaceholderContext,
  data: RelazioneTecnicaData
): Paragraph[] {
  // context is reserved for future use
  void context;
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
    }),
    new Paragraph({
      text: `${pluralize(serbatoi.length, 'Rientra', 'Rientrano')} nel campo di applicazione del D.M. 329/2004.`,
    })
  );

  serbatoi.forEach((serb: any) => {
    const verificaInfo = serb.valvola_sicurezza
      ? determinaVerificaSerbatoio(serb.volume, serb.ps_pressione_max)
      : { tipo: 'esclusa', motivazione: '' };

    paragraphs.push(
      new Paragraph({
        text: `Il serbatoio individuato alla posizione ${serb.codice} ha volume pari a ${serb.volume || '?'} litri e pressione massima ammissibile pari a ${serb.ps_pressione_max || '?'} bar. ${verificaInfo.motivazione}. ${verificaInfo.tipo === 'verifica' ? 'Risulta soggetto a verifica di messa in servizio.' : 'Non risulta soggetto a verifica di messa in servizio ma esclusivamente a dichiarazione di messa in servizio.'}`,
      })
    );
  });

  paragraphs.push(new Paragraph({ text: '' }));

  return paragraphs;
}

/**
 * Classificazione essiccatori
 */
function buildEssiccatoriClassification(
  context: PlaceholderContext,
  data: RelazioneTecnicaData
): Paragraph[] {
  // context is reserved for future use
  void context;
  const paragraphs: Paragraph[] = [];
  const essiccatori = data.technicalData.equipment_data?.essiccatori || [];

  if (essiccatori.length === 0) return paragraphs;

  paragraphs.push(
    new Paragraph({
      text: 'Essiccatore a ciclo frigorifero:',
      heading: HeadingLevel.HEADING_3,
    }),
    new Paragraph({
      text: `${pluralize(essiccatori.length, 'Si tratta di una apparecchiatura', 'Si tratta di apparecchiature')}, ${pluralize(essiccatori.length, 'individuata alla posizione', 'individuate alle posizioni')} ${formatApparecchiatureList(essiccatori.map((e: any) => e.codice))}, dotata di scambiatori di calore in pressione soggetti a verifica di messa in servizio secondo quanto disposto dal combinato degli artt. 4 e 5 del DM329/2004.`,
    }),
    new Paragraph({ text: '' })
  );

  return paragraphs;
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

function determinaVerificaSerbatoio(volume: number, pressioneMax: number): any {
  const psxv = volume * pressioneMax;
  if (psxv > 8000) {
    return {
      tipo: 'verifica',
      motivazione: `Il prodotto Ps x V è pari a ${psxv.toFixed(0)} e quindi superiore a 8000`,
    };
  } else {
    return {
      tipo: 'dichiarazione',
      motivazione: `Il prodotto Ps x V è pari a ${psxv.toFixed(0)} e quindi inferiore a 8000`,
    };
  }
}
