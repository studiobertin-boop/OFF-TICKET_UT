/**
 * Un SVG per simbolo, per il confronto affiancato coi blocchi CAD.
 *
 * Emette anche le tre varianti con accessorio annidato (compressore + disoleatore,
 * essiccatore + scambiatore, filtro + recipiente): senza di quelle il confronto mente per
 * omissione — è già successo, e il committente ha dovuto segnalarlo.
 *
 * Uso: `SCHEMA_OUT=<cartella> npx tsx scripts/confronto-simboli.ts`
 */
import { writeFileSync } from 'node:fs'
import { definizioneDi } from '../src/services/schemaImpianto/symbols'
import type { SchemaNodoPosizionato } from '../src/services/schemaImpianto/types'

const OUT = process.env.SCHEMA_OUT ?? '.'
const MARGINE = 30

type Accessorio = { codice: string; etichetta: string; valvoleSicurezza: { codice: string; etichetta: string }[] }
const CASI: [nome: string, chiave: string, codice: string, accessorio: Accessorio | undefined][] = [
  ['compressore', 'compressore', 'C1', undefined],
  ['compressore-disoleatore', 'compressore', 'C1',
    { codice: 'C1.1', etichetta: 'disoleatore', valvoleSicurezza: [{ codice: 'C1.2', etichetta: '' }] }],
  ['serbatoio-verticale', 'serbatoio:VERTICALE', 'S1', undefined],
  ['serbatoio-orizzontale', 'serbatoio:ORIZZONTALE', 'S1', undefined],
  ['essiccatore', 'essiccatore', 'E1', undefined],
  ['essiccatore-scambiatore', 'essiccatore', 'E1',
    { codice: 'E1.1', etichetta: 'scambiatore', valvoleSicurezza: [] }],
  ['filtro', 'filtro', 'F1', undefined],
  ['filtro-recipiente', 'filtro', 'F1', { codice: 'F1.1', etichetta: 'recipiente', valvoleSicurezza: [] }],
  ['separatore', 'separatore', 'SEP', undefined],
  ['tanica', 'tanica', 'RC', undefined],
  ['pacco-bombole', 'pacco_bombole', 'PB1', undefined],
]

for (const [nome, chiave, codice, accessorio] of CASI) {
  const [tipo, orientamento] = chiave.split(':')
  const nodo = {
    id: codice,
    tipo,
    orientamento,
    etichetta: '',
    gruppo: 'ALTRO',
    valvoleSicurezza: chiave.startsWith('serbatoio') ? [{ codice: 'S1.1', etichetta: '' }] : [],
    accessorio,
    origine: 'scheda',
    x: 0,
    y: 0,
  } as unknown as SchemaNodoPosizionato

  const def = definizioneDi(nodo)
  const { larghezza: L, altezza: H } = def.dimensioni
  const pallini = def.ancore
    .map((a) => `<circle cx="${a.x}" cy="${a.y}" r="4" fill="#d32f2f" opacity="0.85" />`)
    .join('')

  writeFileSync(
    `${OUT}/att-${nome}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${L + 2 * MARGINE}" height="${H + 2 * MARGINE}" ` +
      `viewBox="0 0 ${L + 2 * MARGINE} ${H + 2 * MARGINE}">` +
      `<rect width="${L + 2 * MARGINE}" height="${H + 2 * MARGINE}" fill="#fff" />` +
      `<g transform="translate(${MARGINE} ${MARGINE})">${def.disegna(nodo)}${pallini}</g></svg>`
  )
  console.log(nome.padEnd(26), L, 'x', H, '-', def.ancore.length, 'ancore')
}
