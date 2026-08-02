import type { EquipmentCatalogType } from '@/types'
import { parseModello } from '../modelName'
import {
  missingCanonicalSpecs,
  normalizeSpecs,
  readNumericSpec,
} from '../specsNormalization'
import type { CatalogRow, Finding, Rule } from '../types'
import { entityOf, fmt, makeFinding, pressureKey, rowKeyParts } from './shared'

/**
 * Controlli deterministici sulla singola riga di catalogo: tipo assegnato,
 * formato dei dati tecnici, completezza, coerenza fra le due pressioni.
 */

/** La colonna legacy `tipo` è al singolare: basta a dedurre il tipo strutturato. */
const TIPO_LEGACY_MAP: Readonly<Record<string, EquipmentCatalogType>> = {
  serbatoio: 'Serbatoi',
  compressore: 'Compressori',
  disoleatore: 'Disoleatori',
  essiccatore: 'Essiccatori',
  scambiatore: 'Scambiatori',
  filtro: 'Filtri',
  separatore: 'Separatori',
  'valvola di sicurezza': 'Valvole di sicurezza',
  'recipiente filtro': 'Recipienti filtro',
}

function deduceTipo(row: CatalogRow): EquipmentCatalogType | null {
  const raw = (row.tipoLegacy ?? '').trim().toLowerCase()
  if (!raw) return null
  return TIPO_LEGACY_MAP[raw] ?? TIPO_LEGACY_MAP[raw.replace(/i$/, 'o')] ?? null
}

function checkTipoMancante(row: CatalogRow): Finding | null {
  if (row.tipoApparecchiatura) return null

  const dedotto = deduceTipo(row)
  return makeFinding({
    rule: 'TIPO_MANCANTE',
    keyParts: rowKeyParts(row),
    payload: row.tipoLegacy,
    title: `${row.marca} · ${row.modello}`,
    detail: dedotto
      ? `Nessun tipo assegnato: la riga non compare nei menu della scheda dati. Dalla vecchia colonna si deduce «${dedotto}».`
      : 'Nessun tipo assegnato e non deducibile dai dati esistenti: la riga non compare nei menu della scheda dati.',
    entities: [entityOf(row)],
    fix: dedotto
      ? { kind: 'set_tipo', rowId: row.id, tipoApparecchiatura: dedotto }
      : row.usageCount === 0
        ? { kind: 'delete_row', rowId: row.id }
        : { kind: 'manual', hint: 'Assegnare il tipo a mano: la riga è usata in almeno una pratica.' },
  })
}

function checkSpecs(row: CatalogRow): Finding[] {
  if (!row.tipoApparecchiatura) return []

  const out: Finding[] = []
  const norm = normalizeSpecs(row.tipoApparecchiatura, row.specs)

  if (norm.legacyKeysConverted.length > 0) {
    out.push(
      makeFinding({
        rule: 'SPECS_LEGACY',
        keyParts: rowKeyParts(row),
        payload: norm.canonical,
        title: `${row.marca} · ${row.modello}`,
        detail:
          `Dati tecnici nelle vecchie chiavi generiche (${norm.legacyKeysConverted.join(', ')}): ` +
          'non vengono letti dall’autocompilazione della scheda dati. La conversione è automatica e non perde informazioni.',
        entities: [entityOf(row)],
        fix: {
          kind: 'set_specs',
          rowId: row.id,
          patch: norm.canonical,
          removeKeys: norm.legacyKeysConverted,
        },
      })
    )
  }

  const collisioni = norm.unconvertible.filter(u => u.reason === 'collisione')
  if (collisioni.length > 0) {
    out.push(
      makeFinding({
        rule: 'SPECS_LEGACY',
        keyParts: [...rowKeyParts(row), 'collisione'],
        payload: collisioni,
        title: `${row.marca} · ${row.modello}`,
        detail:
          `Vecchia e nuova chiave coesistono con valori diversi (${collisioni
            .map(c => `${c.key} = ${String(c.value)}`)
            .join(', ')}). La conversione automatica sceglierebbe al posto tuo.`,
        entities: [entityOf(row)],
        fix: { kind: 'manual', hint: 'Stabilire quale valore è corretto e cancellare l’altro.' },
      })
    )
  }

  const nonNumerici = norm.unconvertible.filter(u => u.reason === 'non_numerico')
  if (nonNumerici.length > 0) {
    out.push(
      makeFinding({
        rule: 'SPECS_VALORE_NON_NUMERICO',
        keyParts: rowKeyParts(row),
        payload: nonNumerici,
        title: `${row.marca} · ${row.modello}`,
        detail: `Valori attesi numerici ma non convertibili: ${nonNumerici
          .map(c => `${c.key} = «${String(c.value)}»`)
          .join(', ')}.`,
        entities: [entityOf(row)],
        fix: { kind: 'manual', hint: 'Correggere il valore o svuotare il campo.' },
      })
    )
  }

  const mancanti = missingCanonicalSpecs(row.tipoApparecchiatura, row.specs)
  if (mancanti.length > 0) {
    out.push(
      makeFinding({
        rule: 'SPECS_INCOMPLETI',
        keyParts: rowKeyParts(row),
        payload: mancanti.map(d => d.key),
        title: `${row.marca} · ${row.modello}`,
        detail: `Mancano dati necessari alla scheda: ${mancanti
          .map(d => (d.unit ? `${d.label} [${d.unit}]` : d.label))
          .join(', ')}.`,
        entities: [entityOf(row)],
        fix: { kind: 'manual', hint: 'Completare i dati dalla targhetta o dalla documentazione.' },
      })
    )
  }

  return out
}

/**
 * La pressione massima non può essere inferiore a quella di esercizio dichiarata
 * nel nome. Non si corregge mai da soli: nei dati questo scarto nasce sia da
 * errori veri sia da righe con intervallo di pressione in cui è stato registrato
 * l'estremo inferiore anziché quello superiore.
 */
function checkPressioni(row: CatalogRow): Finding | null {
  const parsed = parseModello(row.modello)
  if (parsed.pressioneEsercizio === null) return null

  const psKey = pressureKey(row.tipoApparecchiatura)
  const ps = readNumericSpec(row.tipoApparecchiatura, row.specs, psKey)
  if (ps === null || ps >= parsed.pressioneEsercizio) return null

  return makeFinding({
    rule: 'PS_MINORE_ESERCIZIO',
    keyParts: [...rowKeyParts(row), fmt(parsed.pressioneEsercizio)],
    payload: [parsed.pressioneEsercizio, ps],
    title: `${row.marca} · ${row.modello}`,
    detail:
      `Il nome dichiara ${fmt(parsed.pressioneEsercizio)} bar di esercizio ma i dati tecnici ` +
      `registrano ${fmt(ps)} bar di pressione massima.` +
      (parsed.pattern === 'range'
        ? ' Il nome porta un intervallo: può essere stato registrato l’estremo inferiore.'
        : ''),
    entities: [entityOf(row)],
    fix: {
      kind: 'manual',
      hint: 'Verificare sulla targhetta quale delle due pressioni è corretta prima di modificare.',
    },
  })
}

export const specsIntegrity: Rule = input => {
  const out: Finding[] = []
  for (const row of input.catalog) {
    const tipo = checkTipoMancante(row)
    if (tipo) {
      // Senza tipo non si può dire nulla sui dati tecnici: si segnala solo la causa.
      out.push(tipo)
      continue
    }
    out.push(...checkSpecs(row))
    const pressioni = checkPressioni(row)
    if (pressioni) out.push(pressioni)
  }
  return out
}
