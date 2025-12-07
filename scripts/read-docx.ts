import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';

async function readDocx(filePath: string) {
  try {
    const buffer = fs.readFileSync(filePath);

    // Converti in HTML per preservare formattazione
    const result = await mammoth.convertToHtml({ buffer });

    // Estrai anche il testo semplice
    const textResult = await mammoth.extractRawText({ buffer });

    console.log('='.repeat(80));
    console.log('CONTENUTO HTML (con formattazione):');
    console.log('='.repeat(80));
    console.log(result.value);
    console.log('\n');

    console.log('='.repeat(80));
    console.log('CONTENUTO TESTO (senza formattazione):');
    console.log('='.repeat(80));
    console.log(textResult.value);
    console.log('\n');

    if (result.messages.length > 0) {
      console.log('='.repeat(80));
      console.log('AVVISI/MESSAGGI:');
      console.log('='.repeat(80));
      result.messages.forEach(msg => console.log(msg));
    }

    return {
      html: result.value,
      text: textResult.value,
      messages: result.messages
    };
  } catch (error) {
    console.error('Errore nella lettura del file:', error);
    throw error;
  }
}

// Esegui
const filePath = process.argv[2] || path.join(
  process.cwd(),
  'DOCUMENTAZIONE',
  'RELAZIONE TECNICA_esempio.docx'
);

console.log(`Lettura file: ${filePath}\n`);
readDocx(filePath);
