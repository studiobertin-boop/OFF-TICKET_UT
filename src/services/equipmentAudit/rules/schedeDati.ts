import { normalizeKey, parseModello } from '../modelName'
import { CANONICAL_SPECS, readSpec } from '../specsNormalization'
import type { CatalogRow, Finding, FindingEntity, Rule, SheetEquipmentRef } from '../types'
import { baseModello, entityOf, makeFinding } from './shared'

/**
 * Confronto fra le apparecchiature censite nelle pratiche e il catalogo.
 *
 * Le schede dati citano il catalogo per stringhe — marca e modello — non per
 * identificativo. È un legame fragile: basta una maiuscola diversa perché
 * un'apparecchiatura realmente censita risulti sconosciuta al catalogo, e con
 * essa si perdano autocompilazione e verifiche.
 *
 * Vincolo di progetto: queste regole non modificano mai le schede. Tutte le
 * correzioni agiscono sul catalogo, che è ciò che il modulo governa.
 */

/** Tolleranza sui confronti numerici, la stessa già in uso nel raffronto col catalogo. */
const EPS = 0.01

function sameValue(a: number | string, b: number | string): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < EPS
  return String(a).trim() === String(b).trim()
}

function sheetEntity(ref: SheetEquipmentRef): FindingEntity {
  return {
    kind: 'sheet',
    id: `${ref.technicalDataId}:${ref.codice}`,
    label: `${ref.codicePratica ?? 'pratica senza codice'} · ${ref.codice}`,
  }
}

function catalogIndex(catalog: CatalogRow[]): Map<string, CatalogRow[]> {
  const index = new Map<string, CatalogRow[]>()
  for (const row of catalog) {
    const key = [
      row.tipoApparecchiatura ?? '',
      normalizeKey(row.marca),
      normalizeKey(baseModello(row)),
    ].join('/')
    const bucket = index.get(key)
    if (bucket) bucket.push(row)
    else index.set(key, [row])
  }
  return index
}

export const schedeDati: Rule = input => {
  if (!input.options.includeSheets) return []

  const findings: Finding[] = []
  const index = catalogIndex(input.catalog)
  const marcheCatalogo = new Map<string, string>()
  for (const row of input.catalog) {
    if (!marcheCatalogo.has(normalizeKey(row.marca))) {
      marcheCatalogo.set(normalizeKey(row.marca), row.marca)
    }
  }

  /** Divergenze accumulate per riga di catalogo e campo, per decidere il fix a valle. */
  const divergenze = new Map<
    string,
    { row: CatalogRow; key: string; valori: Array<{ ref: SheetEquipmentRef; value: number | string }> }
  >()

  const assenti = new Map<string, { refs: SheetEquipmentRef[] }>()

  for (const ref of input.sheets) {
    if (!ref.marca || !ref.modello) continue

    const base = parseModello(ref.modello).base
    const lookup = [ref.catalogType, normalizeKey(ref.marca), normalizeKey(base)].join('/')
    const matches = index.get(lookup) ?? []
    const attivi = matches.filter(r => r.isActive)

    if (matches.length === 0) {
      // La marca esiste a catalogo ma scritta diversamente: è un problema di
      // grafia, non un'apparecchiatura mancante.
      const marcaCanonica = marcheCatalogo.get(normalizeKey(ref.marca))
      if (marcaCanonica && marcaCanonica !== ref.marca) {
        findings.push(
          makeFinding({
            rule: 'SCHEDA_MARCA_NON_NORMALIZZATA',
            scope: 'scheda',
            keyParts: [normalizeKey(ref.marca), ref.marca],
            payload: ref.marca,
            title: `${ref.marca} → ${marcaCanonica}`,
            detail: `La pratica scrive la marca «${ref.marca}», il catalogo «${marcaCanonica}».`,
            entities: [sheetEntity(ref)],
            fix: {
              kind: 'manual',
              hint: 'Allineare la grafia nella scheda dati: il modulo non modifica le pratiche.',
            },
          })
        )
        continue
      }

      const k = `${ref.catalogType}/${normalizeKey(ref.marca)}/${normalizeKey(base)}`
      const entry = assenti.get(k)
      if (entry) entry.refs.push(ref)
      else assenti.set(k, { refs: [ref] })
      continue
    }

    // Con più varianti dello stesso modello non si sa quale sia stata usata.
    const target = attivi.length === 1 ? attivi[0] : matches.length === 1 ? matches[0] : null
    if (!target) continue

    const defs = CANONICAL_SPECS[ref.catalogType] ?? []
    for (const def of defs) {
      // Solo i campi numerici sono confrontabili in modo affidabile: il TS a
      // catalogo è spesso un intervallo («-10 ÷ +120») mentre la scheda porta un
      // valore singolo, e dichiararli divergenti sarebbe rumore.
      if (def.kind !== 'number') continue

      const sheetValue = ref.values[def.key]
      if (sheetValue === undefined) continue

      const catalogValue = readSpec(target.tipoApparecchiatura, target.specs, def.key)
      if (catalogValue === null) continue
      if (sameValue(sheetValue, catalogValue)) continue

      const k = `${target.id}/${def.key}`
      const entry = divergenze.get(k)
      if (entry) entry.valori.push({ ref, value: sheetValue })
      else divergenze.set(k, { row: target, key: def.key, valori: [{ ref, value: sheetValue }] })
    }
  }

  for (const { refs } of assenti.values()) {
    const first = refs[0]
    findings.push(
      makeFinding({
        rule: 'SCHEDA_MODELLO_ASSENTE',
        scope: 'scheda',
        keyParts: [first.catalogType, normalizeKey(first.marca!), normalizeKey(first.modello!)],
        payload: first.values,
        title: `${first.marca} · ${first.modello}`,
        detail:
          `Censita in ${refs.length === 1 ? 'una pratica' : `${refs.length} pratiche`} ma assente dal catalogo: ` +
          'non è riutilizzabile né verificabile.',
        entities: refs.map(sheetEntity),
        fix: {
          kind: 'create_row',
          row: {
            tipoApparecchiatura: first.catalogType,
            marca: first.marca!,
            modello: parseModello(first.modello!).base,
            specs: first.values,
          },
        },
      })
    )
  }

  for (const { row, key, valori } of divergenze.values()) {
    const catalogValue = readSpec(row.tipoApparecchiatura, row.specs, key)
    const def = (CANONICAL_SPECS[row.tipoApparecchiatura!] ?? []).find(d => d.key === key)
    const etichetta = def ? (def.unit ? `${def.label} [${def.unit}]` : def.label) : key
    const concordi = valori.every(v => sameValue(v.value, valori[0].value))

    findings.push(
      makeFinding({
        rule: 'SCHEDA_SPECS_DIVERGENTI',
        scope: 'scheda',
        keyParts: [`${normalizeKey(row.marca)}/${normalizeKey(baseModello(row))}`, key],
        payload: [catalogValue, ...valori.map(v => v.value)],
        title: `${row.marca} · ${row.modello} — ${etichetta}`,
        detail:
          `Il catalogo registra ${String(catalogValue)}, le pratiche ` +
          `${valori.map(v => `${v.ref.codicePratica ?? '—'}: ${String(v.value)}`).join(', ')}.` +
          (concordi ? '' : ' Le pratiche non concordano fra loro.'),
        entities: [entityOf(row), ...valori.map(v => sheetEntity(v.ref))],
        fix: concordi
          ? { kind: 'set_specs', rowId: row.id, patch: { [key]: valori[0].value } }
          : {
              kind: 'manual',
              hint: 'Le pratiche riportano valori diversi fra loro: stabilire quale sia corretto prima di aggiornare il catalogo.',
            },
      })
    )
  }

  return findings
}
