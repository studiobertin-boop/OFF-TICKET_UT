/**
 * Motore di rendering template Handlebars → DOCX
 * Core del sistema template-based per relazioni tecniche
 */

import Handlebars from 'handlebars';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  VerticalAlign,
  ShadingType,
  PageBreak
} from 'docx';
import { saveAs } from 'file-saver';
import html2pdf from 'html2pdf.js';
import { registerAllHelpers } from '../utils/templateHelpers';
import { evaluateCondition } from '../utils/conditionEvaluator';
import type {
  TemplateContent,
  RenderedData,
  RenderedSection,
  RenderOptions,
  TemplateValidationResult,
  TemplateSection,
  ConditionalBlock,
  BlockVariant
} from '../types/template';

/**
 * Compilatore template Handlebars
 */
class TemplateCompiler {
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    registerAllHelpers();
  }

  /**
   * Registra partials dal template
   */
  registerPartials(partials: Record<string, string>): void {
    Object.entries(partials).forEach(([name, content]) => {
      this.handlebars.registerPartial(name, content);
    });
  }

  /**
   * Registra helper custom dal template
   */
  registerHelpers(helpers: Record<string, string>): void {
    Object.entries(helpers).forEach(([name, funcString]) => {
      try {
        // eslint-disable-next-line no-new-func
        const func = new Function('return ' + funcString)();
        this.handlebars.registerHelper(name, func);
      } catch (error) {
        console.error(`Errore registrazione helper ${name}:`, error);
      }
    });
  }

  /**
   * Compila una sezione del template
   */
  compileSection(section: TemplateSection): HandlebarsTemplateDelegate {
    const templateString = typeof section.template === 'string'
      ? section.template
      : JSON.stringify(section.template);

    return this.handlebars.compile(templateString);
  }

  /**
   * Renderizza template con dati
   */
  render(template: HandlebarsTemplateDelegate, data: any): string {
    return template(data);
  }
}

/**
 * Engine principale di rendering
 */
export class TemplateRenderingEngine {
  private compiler: TemplateCompiler;

  constructor() {
    this.compiler = new TemplateCompiler();
  }

  /**
   * Valida template prima del rendering
   */
  validateTemplate(content: TemplateContent): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Valida sezioni
    if (!content.sections || content.sections.length === 0) {
      errors.push('Template deve avere almeno una sezione');
    }

    // Valida ogni sezione
    content.sections.forEach((section, index) => {
      if (!section.id) {
        errors.push(`Sezione ${index + 1} manca di ID`);
      }
      if (!section.template) {
        errors.push(`Sezione ${section.id || index + 1} manca di template`);
      }

      // Valida sintassi Handlebars (tentativo compilazione)
      try {
        const templateString = typeof section.template === 'string'
          ? section.template
          : JSON.stringify(section.template);
        Handlebars.compile(templateString);
      } catch (error) {
        errors.push(`Errore sintassi Handlebars in sezione ${section.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Valida helper custom
    if (content.helpers) {
      Object.entries(content.helpers).forEach(([name, funcString]) => {
        try {
          // eslint-disable-next-line no-new-func
          new Function('return ' + funcString)();
        } catch (error) {
          errors.push(`Helper ${name} contiene codice non valido: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Renderizza template completo a struttura dati intermedia
   */
  renderToData(content: TemplateContent, data: any): RenderedData {
    // Registra partials e helpers
    if (content.partials) {
      this.compiler.registerPartials(content.partials);
    }
    if (content.helpers) {
      this.compiler.registerHelpers(content.helpers);
    }

    // Renderizza ogni sezione
    const renderedSections: RenderedSection[] = content.sections
      .filter(section => section.enabled)
      .map(section => {
        // Gestisci tabelle
        if (section.type === 'table' && typeof section.template === 'object' && !Array.isArray(section.template)) {
          return this.renderTableSection(section, data);
        }

        // Gestisci blocchi condizionali
        if (section.type === 'conditional' && Array.isArray(section.template)) {
          return this.renderConditionalSection(section, data);
        }

        // Gestisci testo normale
        const compiled = this.compiler.compileSection(section);
        const rendered = this.compiler.render(compiled, data);
        return {
          id: section.id,
          title: section.title,
          type: section.type,
          content: rendered
        };
      });

    return {
      sections: renderedSections,
      metadata: content.metadata
    };
  }

  /**
   * Renderizza sezione con blocchi condizionali
   */
  private renderConditionalSection(section: TemplateSection, data: any): RenderedSection {
    if (!Array.isArray(section.template)) {
      throw new Error('Conditional section template deve essere array di ConditionalBlock');
    }

    const blocks = section.template as ConditionalBlock[];
    let renderedContent = '';

    // Processa ogni blocco condizionale
    for (const block of blocks) {
      // Valuta se mostrare l'intero blocco
      if (block.showCondition && !evaluateCondition(block.showCondition, data)) {
        continue; // Salta questo blocco
      }

      // Trova variante da usare
      const variant = this.selectVariant(block, data);
      if (!variant) {
        console.warn(`Nessuna variante valida per blocco ${block.id}`);
        continue;
      }

      // Renderizza contenuto variante con Handlebars
      const compiled = Handlebars.compile(variant.content);
      const rendered = compiled(data);
      renderedContent += rendered;
    }

    return {
      id: section.id,
      title: section.title,
      type: 'paragraph', // Converti conditional → paragraph per DOCX
      content: renderedContent
    };
  }

  /**
   * Seleziona la variante appropriata per un blocco condizionale
   */
  private selectVariant(block: ConditionalBlock, data: any): BlockVariant | null {
    // 1. Cerca prima variante con condizione soddisfatta
    for (const variant of block.variants) {
      if (variant.condition && evaluateCondition(variant.condition, data)) {
        return variant;
      }
    }

    // 2. Se non trovata, usa variante di default specificata
    if (block.defaultVariantId) {
      const defaultVariant = block.variants.find(v => v.id === block.defaultVariantId);
      if (defaultVariant) return defaultVariant;
    }

    // 3. Altrimenti usa prima variante marcata come default
    const defaultVariant = block.variants.find(v => v.isDefault);
    if (defaultVariant) return defaultVariant;

    // 4. Fallback: prima variante senza condizione
    const fallbackVariant = block.variants.find(v => !v.condition);
    if (fallbackVariant) return fallbackVariant;

    // 5. Ultima risorsa: prima variante qualsiasi
    return block.variants[0] || null;
  }

  /**
   * Renderizza sezione tabella
   */
  private renderTableSection(section: TemplateSection, data: any): RenderedSection {
    if (typeof section.template !== 'object' || Array.isArray(section.template)) {
      throw new Error('Table template deve essere oggetto TableTemplate');
    }

    const tableTemplate = section.template as any;

    // Compila template righe
    const rowsTemplate = this.compiler.compileSection({
      ...section,
      template: tableTemplate.rows
    });

    const rowsRendered = this.compiler.render(rowsTemplate, data);

    // Parse JSON risultato (assumiamo che rows template generi JSON array)
    let rows: string[][] = [];
    try {
      // Se il template ha generato JSON
      rows = JSON.parse(rowsRendered);
    } catch {
      // Altrimenti assume sia testo plain con righe separate da newline
      // (gestione fallback - ideale sarebbe JSON)
      rows = rowsRendered.split('\n').map(line =>
        line.split('\t')
      );
    }

    return {
      id: section.id,
      title: section.title,
      type: 'table',
      content: {
        headers: tableTemplate.headers,
        rows,
        style: tableTemplate.style
      }
    };
  }

  /**
   * Converte RenderedData in documento DOCX
   */
  async exportToDOCX(renderedData: RenderedData): Promise<Blob> {
    const { sections, metadata } = renderedData;

    // Costruisci sezioni DOCX
    const docxSections = sections.map(section => {
      const elements: (Paragraph | Table)[] = [];

      // Titolo sezione
      if (section.title) {
        elements.push(
          new Paragraph({
            text: section.title,
            heading: section.type === 'heading' ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 120 }
          })
        );
      }

      // Contenuto
      if (typeof section.content === 'string') {
        // Testo paragrafo - gestisce page break
        const paragraphs = this.convertTextToParagraphs(section.content);
        elements.push(...paragraphs);
      } else {
        // Tabella
        const table = this.createDOCXTable(section.content);
        elements.push(table);
      }

      return elements;
    }).flat();

    // Crea documento
    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: this.convertCmToTwip(metadata?.pageMargins?.top || 2.5),
              bottom: this.convertCmToTwip(metadata?.pageMargins?.bottom || 2.5),
              left: this.convertCmToTwip(metadata?.pageMargins?.left || 2.5),
              right: this.convertCmToTwip(metadata?.pageMargins?.right || 1.5)
            }
          }
        },
        children: docxSections
      }]
    });

    // Genera blob
    return await Packer.toBlob(doc);
  }

  /**
   * Converte RenderedData in documento PDF usando html2pdf.js
   * Questo metodo converte direttamente l'HTML renderizzato in PDF,
   * preservando perfettamente tabelle, formattazione e stili CSS
   */
  async exportToPDF(renderedData: RenderedData): Promise<Blob> {
    const { sections, metadata } = renderedData;

    // Costruisci HTML completo con stili per PDF
    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Cambria', 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #000;
      text-align: justify;
      margin: 0;
      padding: 0;
    }

    h1 {
      font-size: 32pt;
      font-weight: bold;
      margin-top: 0.67em;
      margin-bottom: 0.5em;
      page-break-after: avoid;
    }

    h2 {
      font-size: 24pt;
      font-weight: bold;
      margin-top: 0.75em;
      margin-bottom: 0.5em;
      page-break-after: avoid;
    }

    h3 {
      font-size: 18.72pt;
      font-weight: bold;
      margin-top: 0.83em;
      margin-bottom: 0.5em;
      page-break-after: avoid;
    }

    p {
      margin: 0 0 10pt 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10pt 0;
      page-break-inside: avoid;
    }

    th, td {
      border: 1px solid #CCCCCC;
      padding: 8pt;
      vertical-align: middle;
    }

    th {
      background-color: #E0E0E0;
      font-weight: bold;
      text-align: center;
    }

    td {
      text-align: left;
    }

    .page-break {
      page-break-after: always;
    }

    /* Preserva formattazione inline */
    b, strong {
      font-weight: bold;
    }

    i, em {
      font-style: italic;
    }

    u {
      text-decoration: underline;
    }
  </style>
</head>
<body>
`;

    // Processa ogni sezione
    sections.forEach(section => {
      // Titolo sezione
      if (section.title) {
        const headingTag = section.type === 'heading' ? 'h1' : 'h2';
        htmlContent += `<${headingTag}>${section.title}</${headingTag}>\n`;
      }

      // Contenuto
      if (typeof section.content === 'string') {
        // Converti markup tabelle in HTML
        let processedContent = this.convertTextTablesToHTML(section.content);

        // Gestisci page break
        processedContent = processedContent.replace(/\[PAGE_BREAK\]/g, '<div class="page-break"></div>');

        htmlContent += processedContent + '\n';
      } else {
        // Tabella già strutturata (da section type='table')
        const { headers, rows } = section.content;
        htmlContent += '<table>\n';
        htmlContent += '<thead><tr>\n';
        headers.forEach((header: string) => {
          htmlContent += `<th>${header}</th>\n`;
        });
        htmlContent += '</tr></thead>\n<tbody>\n';
        rows.forEach((row: string[]) => {
          htmlContent += '<tr>\n';
          row.forEach((cell: string) => {
            htmlContent += `<td>${cell}</td>\n`;
          });
          htmlContent += '</tr>\n';
        });
        htmlContent += '</tbody>\n</table>\n';
      }
    });

    htmlContent += `
</body>
</html>
`;

    // Configurazione html2pdf
    // Margini: 2.5cm top/bottom/left, 1.5cm right
    const options = {
      margin: [
        metadata?.pageMargins?.top || 2.5,    // top
        metadata?.pageMargins?.right || 1.5,   // right
        metadata?.pageMargins?.bottom || 2.5,  // bottom
        metadata?.pageMargins?.left || 2.5     // left
      ] as [number, number, number, number],
      filename: 'document.pdf',
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true
      },
      jsPDF: {
        unit: 'cm' as const,
        format: 'a4' as const,
        orientation: 'portrait' as const
      }
    };

    // Converti HTML in PDF
    const pdfBlob = await html2pdf()
      .set(options)
      .from(htmlContent)
      .outputPdf('blob');

    return pdfBlob;
  }

  /**
   * Converte testo HTML in paragrafi DOCX, gestendo formattazione
   */
  private convertTextToParagraphs(html: string): (Paragraph | Table)[] {
    const paragraphs: (Paragraph | Table)[] = [];

    // Split per page break marker
    const sections = html.split('[PAGE_BREAK]');

    sections.forEach((sectionHtml, index) => {
      // Parse HTML e converti in paragrafi DOCX
      const sectionParagraphs = this.parseHTMLToParagraphs(sectionHtml);
      paragraphs.push(...sectionParagraphs);

      // Aggiungi page break dopo ogni sezione tranne l'ultima
      if (index < sections.length - 1) {
        paragraphs.push(
          new Paragraph({
            children: [new PageBreak()],
            spacing: { after: 0 }
          })
        );
      }
    });

    return paragraphs;
  }

  /**
   * Parse HTML e converti in array di elementi DOCX (Paragraph o Table)
   */
  private parseHTMLToParagraphs(html: string): (Paragraph | Table)[] {
    const paragraphs: (Paragraph | Table)[] = [];

    // Prima converti il markup [[TABLE:...]] in HTML
    html = this.convertTextTablesToHTML(html);

    // Usa DOMParser per parsing robusto
    if (typeof DOMParser === 'undefined') {
      // Fallback senza DOMParser
      const textRuns = this.parseInlineHTML(html);
      if (textRuns.length > 0) {
        paragraphs.push(new Paragraph({ children: textRuns, spacing: { after: 120 } }));
      }
      return paragraphs;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
      const body = doc.body;

      // Itera sui figli diretti del body (ogni child = un paragrafo potenziale)
      body.childNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          const tagName = element.tagName.toLowerCase();

          // Gestisci tabelle
          if (tagName === 'table') {
            const table = this.parseHTMLTable(element);
            if (table) {
              paragraphs.push(table);
            }
            return;
          }

          // Skip elementi non-paragrafo
          if (tagName !== 'div' && tagName !== 'h1' && tagName !== 'h2' && tagName !== 'h3' && tagName !== 'p') {
            return;
          }

          // Estrai attributi e classi
          const style = element.getAttribute('style') || '';
          const className = element.getAttribute('class') || '';

          // Estrai allineamento da stile inline o da classe Quill
          let alignment = this.extractTextAlign(style);
          if (alignment === AlignmentType.LEFT) {
            alignment = this.extractTextAlignFromClass(className);
          }

          const lineHeight = this.extractLineHeight(style);

          // Determina se è un heading tramite classi Quill
          const headingLevel = this.extractHeadingLevel(className);

          // Determina tipo di heading e dimensioni
          let fontSize: number | undefined;
          let isBold = false;
          let spacingBefore = 0;

          if (tagName === 'h1' || headingLevel === 1) {
            fontSize = 64; // 32pt * 2 half-points
            isBold = true;
            spacingBefore = 320; // 0.67em
          } else if (tagName === 'h2' || headingLevel === 2) {
            fontSize = 48; // 24pt * 2 half-points
            isBold = true;
            spacingBefore = 280; // 0.75em
          } else if (tagName === 'h3' || headingLevel === 3) {
            fontSize = 37; // 18.72pt * 2 half-points
            isBold = true;
            spacingBefore = 240; // 0.83em
          }

          // Parse contenuto interno
          // Per gli headings, passa gli stili di base che verranno applicati
          let textRuns = this.parseInlineHTML(element.innerHTML, className, {
            bold: isBold,
            fontSize: fontSize
          });

          // Verifica che ci sia almeno un TextRun con contenuto reale (non solo spazi)
          // Controlliamo il contenuto HTML originale invece della struttura interna del TextRun
          const htmlContent = element.innerHTML.replace(/<br>/gi, '').replace(/&nbsp;/g, ' ').trim();

          // Rimuovi anche i tag HTML per ottenere solo il testo
          const textContent = htmlContent.replace(/<[^>]*>/g, '').trim();
          const hasRealContent = textContent.length > 0;

          // Non creare paragrafo se è vuoto o contiene solo spazi/br
          if (!hasRealContent) {
            return;
          }

          const paragraph = new Paragraph({
            children: textRuns,
            alignment,
            spacing: {
              after: 120,
              line: lineHeight ? Math.round(lineHeight * 240) : undefined,
              before: spacingBefore || undefined
            }
          });

          paragraphs.push(paragraph);
        } else if (node.nodeType === Node.TEXT_NODE) {
          // Testo diretto (fuori da tag)
          const text = node.textContent?.trim();
          if (text) {
            paragraphs.push(
              new Paragraph({
                children: [new TextRun(text)],
                alignment: AlignmentType.JUSTIFIED,
                spacing: { after: 120 }
              })
            );
          }
        }
      });
    } catch (error) {
      console.warn('HTML parsing failed:', error);
      // Fallback
      const textRuns = this.parseInlineHTML(html);
      if (textRuns.length > 0) {
        paragraphs.push(new Paragraph({ children: textRuns, alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 } }));
      }
    }

    return paragraphs.length > 0 ? paragraphs : [new Paragraph({ children: [new TextRun(' ')] })];
  }

  /**
   * Decode HTML entities (converte &lt; in <, &gt; in >, ecc.)
   */
  private decodeHTMLEntities(text: string): string {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  /**
   * Converti markup [[TABLE:id:headers::rows]] in HTML
   * IMPORTANTE: Le celle possono contenere HTML inline (es. <b>, <i>, <span style="color:red">)
   * che verrà preservato e convertito correttamente in DOCX/PDF
   */
  private convertTextTablesToHTML(html: string): string {
    const tableRegex = /\[\[TABLE:([^:]+):([^:]+)::(.+?)\]\]/gs;

    return html.replace(tableRegex, (fullMatch, _tableId, headersStr, rowsStr) => {
      try {
        // Decode HTML entities per recuperare i tag HTML originali
        const decodedHeaders = this.decodeHTMLEntities(headersStr);
        const decodedRows = this.decodeHTMLEntities(rowsStr);

        // Split headers - NON fare trim per preservare spazi in HTML
        const headers = decodedHeaders.split('|').filter((cell: string) => cell.length >= 0);

        // Split rows - preserva HTML interno
        const rows = decodedRows.split('||')
          .map((rowStr: string) => rowStr.split('|').filter((cell: string) => cell.length >= 0))
          .filter((row: string[]) => row.length > 0);

        let tableHTML = '<table>';

        if (headers.length > 0) {
          tableHTML += '<thead><tr>';
          headers.forEach((cell: string) => {
            // Il contenuto può includere tag HTML che devono rimanere intatti
            tableHTML += `<th>${cell}</th>`;
          });
          tableHTML += '</tr></thead>';
        }

        if (rows.length > 0) {
          tableHTML += '<tbody>';
          rows.forEach((row: string[]) => {
            tableHTML += '<tr>';
            row.forEach((cell: string) => {
              // Inserisci HTML decodificato direttamente
              tableHTML += `<td>${cell}</td>`;
            });
            tableHTML += '</tr>';
          });
          tableHTML += '</tbody>';
        }

        tableHTML += '</table>';
        return tableHTML;
      } catch (error) {
        console.error('Error parsing table markup:', error);
        return fullMatch;
      }
    });
  }

  /**
   * Parse tabella HTML e converti in Table DOCX
   */
  private parseHTMLTable(tableElement: Element): Table | null {
    try {
      const rows: TableRow[] = [];

      // Processa tutte le righe (thead + tbody)
      const allRows = Array.from(tableElement.querySelectorAll('tr'));

      allRows.forEach((tr) => {
        const cells: TableCell[] = [];
        const cellElements = Array.from(tr.querySelectorAll('td, th'));

        cellElements.forEach((cell) => {
          const isHeader = cell.tagName.toLowerCase() === 'th';

          // FIX: Usa innerHTML per preservare formattazione (bold, italic, color, ecc.)
          const cellHTML = cell.innerHTML || '';

          // Parse HTML inline per preservare la formattazione
          const cellTextRuns = this.parseInlineHTML(cellHTML, '', {
            bold: isHeader,
            fontSize: undefined
          });

          const tableCell = new TableCell({
            children: [new Paragraph({
              children: cellTextRuns,  // Array di TextRun con formattazione preservata
              alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT
            })],
            shading: isHeader ? {
              type: ShadingType.SOLID,
              color: 'E0E0E0'
            } : undefined,
            verticalAlign: VerticalAlign.CENTER,
            margins: {
              top: 100,
              bottom: 100,
              left: 100,
              right: 100
            }
          });

          cells.push(tableCell);
        });

        if (cells.length > 0) {
          rows.push(new TableRow({ children: cells }));
        }
      });

      if (rows.length === 0) return null;

      return new Table({
        rows,
        width: {
          size: 100,
          type: WidthType.PERCENTAGE
        },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' }
        }
      });
    } catch (error) {
      console.error('Error parsing HTML table:', error);
      return null;
    }
  }

  /**
   * Estrai heading level da classi Quill (es. ql-header-1, ql-header-2)
   */
  private extractHeadingLevel(className: string): number | undefined {
    const match = /ql-header-(\d)/.exec(className);
    return match ? parseInt(match[1], 10) : undefined;
  }

  /**
   * Estrai text-align da classi Quill (es. ql-align-center, ql-align-justify)
   */
  private extractTextAlignFromClass(className: string): typeof AlignmentType[keyof typeof AlignmentType] {
    if (className.includes('ql-align-center')) return AlignmentType.CENTER;
    if (className.includes('ql-align-right')) return AlignmentType.RIGHT;
    if (className.includes('ql-align-justify')) return AlignmentType.JUSTIFIED;
    // Default giustificato invece di sinistra
    return AlignmentType.JUSTIFIED;
  }

  /**
   * Estrai font-family da classi Quill (es. ql-font-cambria, ql-font-arial)
   */
  private extractFontFamilyFromClass(className: string): string | undefined {
    const match = /ql-font-(\w+)/.exec(className);
    if (!match) return undefined;

    const fontClass = match[1];
    // Mappa font Quill a font DOCX
    const fontMap: Record<string, string> = {
      'cambria': 'Cambria',
      'arial': 'Arial',
      'times': 'Times New Roman',
      'courier': 'Courier New'
    };

    return fontMap[fontClass] || 'Cambria';
  }

  /**
   * Parse HTML inline (span, b, i, u) e converti in TextRuns
   * Gestisce tag annidati e formattazioni combinate
   */
  private parseInlineHTML(
    html: string,
    parentClassName?: string,
    baseStyle?: { bold?: boolean; fontSize?: number }
  ): TextRun[] {
    const runs: TextRun[] = [];

    // Remove newlines
    let text = html.replace(/\n/g, ' ');

    // Estrai font del paragrafo dalle classi del genitore
    const parentFont = parentClassName ? this.extractFontFamilyFromClass(parentClassName) : undefined;

    // Usa DOMParser per gestire correttamente tag annidati
    if (typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${text}</div>`, 'text/html');
        const rootNode = doc.body.firstChild;

        if (rootNode) {
          this.parseNode(rootNode, runs, {
            bold: baseStyle?.bold || false,
            italic: false,
            underline: false,
            fontSize: baseStyle?.fontSize,
            fontFamily: parentFont || 'Cambria',
            color: undefined
          });
        }
      } catch (error) {
        console.warn('DOMParser failed, using fallback', error);
        // Fallback: usa testo plain con font del genitore
        if (text.trim()) {
          runs.push(new TextRun({
            text: text.trim(),
            font: parentFont || 'Cambria',
            bold: baseStyle?.bold,
            size: baseStyle?.fontSize
          }));
        }
      }
    } else {
      // Fallback per ambienti senza DOMParser
      if (text.trim()) {
        runs.push(new TextRun({
          text: text.trim(),
          font: parentFont || 'Cambria',
          bold: baseStyle?.bold,
          size: baseStyle?.fontSize
        }));
      }
    }

    return runs.length > 0 ? runs : [new TextRun(' ')];
  }

  /**
   * Parse ricorsivo di nodo HTML in TextRuns
   */
  private parseNode(
    node: Node,
    runs: TextRun[],
    parentStyle: {
      bold: boolean;
      italic: boolean;
      underline: boolean;
      fontSize?: number;
      fontFamily?: string;
      color?: string;
    }
  ): void {
    if (node.nodeType === Node.TEXT_NODE) {
      // Nodo testo
      const text = node.textContent || '';

      // Preserva il testo anche se è solo spazi (importante per separare parole)
      if (text) {
        runs.push(
          new TextRun({
            text: text,
            bold: parentStyle.bold,
            italics: parentStyle.italic,
            underline: parentStyle.underline ? {} : undefined,
            size: parentStyle.fontSize,
            font: parentStyle.fontFamily,
            color: parentStyle.color
          })
        );
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Nodo elemento
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      // Determina stili da questo tag
      const currentStyle = { ...parentStyle };

      if (tagName === 'b' || tagName === 'strong') {
        currentStyle.bold = true;
      } else if (tagName === 'i' || tagName === 'em') {
        currentStyle.italic = true;
      } else if (tagName === 'u') {
        currentStyle.underline = true;
      } else if (tagName === 'span') {
        // Estrai stili da attributi span
        const style = element.getAttribute('style') || '';
        const className = element.getAttribute('class') || '';

        const fontSize = this.extractFontSize(style);
        const fontFamily = this.extractFontFamily(style);
        const color = this.extractColor(style);

        if (fontSize) currentStyle.fontSize = fontSize;
        if (fontFamily) {
          currentStyle.fontFamily = fontFamily;
        } else {
          // Se non c'è font inline, prova dalle classi Quill
          const fontFromClass = this.extractFontFamilyFromClass(className);
          if (fontFromClass) currentStyle.fontFamily = fontFromClass;
        }
        if (color) currentStyle.color = color;
      }

      // Parse ricorsivo dei figli
      node.childNodes.forEach(child => {
        this.parseNode(child, runs, currentStyle);
      });
    }
  }

  /**
   * Estrai text-align da attributi HTML
   */
  private extractTextAlign(attributes: string): typeof AlignmentType[keyof typeof AlignmentType] {
    const match = /text-align:\s*(left|center|right|justify)/i.exec(attributes);
    if (!match) return AlignmentType.JUSTIFIED; // Default giustificato

    switch (match[1].toLowerCase()) {
      case 'center': return AlignmentType.CENTER;
      case 'right': return AlignmentType.RIGHT;
      case 'justify': return AlignmentType.JUSTIFIED;
      case 'left': return AlignmentType.LEFT;
      default: return AlignmentType.JUSTIFIED;
    }
  }

  /**
   * Estrai line-height da attributi HTML
   */
  private extractLineHeight(attributes: string): number | undefined {
    const match = /line-height:\s*([\d.]+)/i.exec(attributes);
    return match ? parseFloat(match[1]) : undefined;
  }

  /**
   * Estrai font-size da attributi HTML (ritorna half-points per DOCX)
   */
  private extractFontSize(attributes: string): number | undefined {
    const match = /font-size:\s*([\d.]+)pt/i.exec(attributes);
    if (!match) return undefined;
    // DOCX usa half-points (1pt = 2 half-points)
    return Math.round(parseFloat(match[1]) * 2);
  }

  /**
   * Estrai font-family da attributi HTML
   */
  private extractFontFamily(attributes: string): string | undefined {
    const match = /font-family:\s*['"]?([^'";\)]+)['"]?/i.exec(attributes);
    if (!match) return undefined;
    // Prendi solo il primo font della lista
    return match[1].split(',')[0].trim().replace(/['"]/g, '');
  }

  /**
   * Estrai color da attributi HTML (ritorna hex senza #)
   */
  private extractColor(attributes: string): string | undefined {
    const match = /color:\s*#?([0-9a-fA-F]{6})/i.exec(attributes);
    return match ? match[1].toUpperCase() : undefined;
  }

  /**
   * Crea tabella DOCX da dati renderizzati
   */
  private createDOCXTable(tableData: any): Table {
    const { headers, rows, style } = tableData;

    // Header row
    const headerRow = new TableRow({
      children: headers.map((header: string) =>
        new TableCell({
          children: [new Paragraph({
            children: [new TextRun({ text: header, bold: true })],
            alignment: AlignmentType.CENTER
          })],
          shading: {
            type: ShadingType.SOLID,
            color: style?.headerBackgroundColor || 'D9D9D9'
          },
          verticalAlign: VerticalAlign.CENTER
        })
      )
    });

    // Data rows
    const dataRows = rows.map((row: string[]) =>
      new TableRow({
        children: row.map(cell =>
          new TableCell({
            children: [new Paragraph(cell || '')],
            verticalAlign: VerticalAlign.CENTER
          })
        )
      })
    );

    return new Table({
      rows: [headerRow, ...dataRows],
      width: {
        size: 100,
        type: WidthType.PERCENTAGE
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, size: 1 }
      }
    });
  }

  /**
   * Converte cm in twip (1/20 di punto)
   */
  private convertCmToTwip(cm: number): number {
    return Math.round(cm * 567); // 1 cm = 567 twip
  }

  /**
   * Rendering completo e download diretto DOCX
   */
  async renderAndDownload(
    content: TemplateContent,
    data: any,
    fileName: string
  ): Promise<void> {
    // Valida template
    const validation = this.validateTemplate(content);
    if (!validation.valid) {
      throw new Error(`Template non valido:\n${validation.errors.join('\n')}`);
    }

    // Renderizza
    const renderedData = this.renderToData(content, data);

    // Esporta DOCX
    const blob = await this.exportToDOCX(renderedData);

    // Download
    saveAs(blob, fileName);
  }

  /**
   * Rendering completo e download diretto PDF
   */
  async renderAndDownloadPDF(
    content: TemplateContent,
    data: any,
    fileName: string
  ): Promise<void> {
    // Valida template
    const validation = this.validateTemplate(content);
    if (!validation.valid) {
      throw new Error(`Template non valido:\n${validation.errors.join('\n')}`);
    }

    // Renderizza
    const renderedData = this.renderToData(content, data);

    // Esporta PDF
    const blob = await this.exportToPDF(renderedData);

    // Download
    saveAs(blob, fileName);
  }
}

/**
 * Istanza singleton
 */
export const templateEngine = new TemplateRenderingEngine();

/**
 * Helper function per rendering rapido
 */
export async function renderTemplate(options: RenderOptions): Promise<Blob> {
  if (!options.templateContent) {
    throw new Error('templateContent è richiesto');
  }

  const engine = new TemplateRenderingEngine();
  const renderedData = engine.renderToData(options.templateContent, options.data);
  return await engine.exportToDOCX(renderedData);
}
