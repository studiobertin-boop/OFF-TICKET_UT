/**
 * Tavola di confronto dei simboli del registro coi blocchi CAD di riferimento
 * (`DOCUMENTAZIONE/relazione/Blocchi.pdf`).
 *
 * Non è un test: è uno strumento manuale. Affianca in un unico SVG tutti i simboli del
 * registro, ciascuno col proprio nome e con le ancore evidenziate da un pallino colorato
 * per tipo accettato, così il committente può segnare a colpo d'occhio quali non
 * corrispondono ancora ai suoi blocchi.
 *
 * Uso: `SCHEMA_OUT=<cartella> npx tsx scripts/tavola-simboli.ts`
 */
import { writeFileSync } from 'node:fs'
import { REGISTRO_SIMBOLI } from '../src/services/schemaImpianto/symbols'
import type { SchemaNodoPosizionato } from '../src/services/schemaImpianto/types'

const OUT = process.env.SCHEMA_OUT ?? '.'
const COLORE: Record<string, string> = {
  aria: '#1976d2',
  condensa: '#d32f2f',
  valvola_sicurezza: '#2e7d32',
}

function emettiTavola(): void {
  let x = 40
  const parti: string[] = []

  for (const [chiave, def] of Object.entries(REGISTRO_SIMBOLI)) {
    const nodo = {
      id: chiave.startsWith('serbatoio') ? 'S1' : 'X1',
      tipo: chiave.split(':')[0],
      orientamento: chiave.split(':')[1],
      etichetta: '',
      gruppo: 'ALTRO',
      valvoleSicurezza: [{ codice: 'S1.1', etichetta: '' }],
      origine: 'scheda',
      x: 0,
      y: 0,
    } as unknown as SchemaNodoPosizionato

    const pallini = def.ancore
      .map(
        (a) =>
          `<circle cx="${a.x}" cy="${a.y}" r="5" fill="${COLORE[a.accetta[0]]}" />` +
          `<text x="${a.x + 8}" y="${a.y}" font-size="10" font-family="Arial">${a.id}</text>`
      )
      .join('')

    parti.push(
      `<g transform="translate(${x} 80)">${def.disegna(nodo)}${pallini}</g>`,
      `<text x="${x}" y="60" font-size="14" font-family="Arial">${chiave}</text>`
    )
    x += def.dimensioni.larghezza + 90
  }

  writeFileSync(
    `${OUT}/tavola.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="420" viewBox="0 0 ${x} 420">` +
      `<rect width="${x}" height="420" fill="#fff" />${parti.join('')}</svg>`
  )
  console.log(`Tavola scritta in ${OUT}/tavola.svg`)
}

emettiTavola()
