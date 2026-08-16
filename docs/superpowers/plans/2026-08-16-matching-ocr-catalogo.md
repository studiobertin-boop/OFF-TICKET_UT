# Matching OCR ↔ catalogo apparecchiature — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dopo il riconoscimento OCR di una targhetta, riconciliare i dati letti con
`equipment_catalog` e — a seconda dell'esito — applicare la riga trovata, chiedere
all'operatore fra più candidati, oppure compilare dai dati letti come oggi.

**Architecture:** Un modulo puro `src/utils/equipmentMatcher/` esegue normalizzazione,
selezione candidati e decisione senza toccare React né Supabase; le righe di catalogo gli
arrivano da un hook TanStack Query. L'applicazione della riga scelta riusa
`selettoreCatalogo`, già esistente, così l'esito è indistinguibile da una selezione manuale
negli autocomplete — inclusa la registrazione dell'origine, da cui dipendono la scomparsa del
«+» e il controllo di divergenza.

**Tech Stack:** TypeScript, React 18, MUI 6, TanStack Query, Vitest, Supabase.

**Spec:** `docs/superpowers/specs/2026-08-16-matching-ocr-catalogo-design.md`

## Global Constraints

- Lingua di tutta la UI e dei nomi di dominio: **italiano**. I test hanno nomi in italiano,
  come il resto del progetto (`src/utils/__tests__/billingReportRows.test.ts`).
- `strict: false` in TypeScript; interfacce per le props; nessun test di UI (`Vitest` copre
  logica, validazioni, calcoli — convenzione dichiarata in `CLAUDE.md`).
- Conventional Commits.
- Le stringhe di marca nella mappa famiglie vanno scritte **esattamente** come sono a
  catalogo, comprese maiuscole e punteggiatura.
- Soglie: ingresso `0,60`; fascia incerta `0,60 ≤ sim < 1`; esito certo solo con `sim == 1`.
- Tolleranza pressioni: `± 0,05 bar`. Volume: uguaglianza esatta.
- Nessuna chiamata a `search_equipment_fuzzy`: la RPC è rotta in produzione e viene eliminata
  dal Task 9.

---

## Struttura dei file

| file | responsabilità |
|---|---|
| `src/utils/equipmentMatcher/normalizzazione.ts` | canonicalizzazione di marche e modelli, similarità fra stringhe |
| `src/utils/equipmentMatcher/marcheFamiglie.ts` | la mappa delle famiglie produttore e la sua risoluzione |
| `src/utils/equipmentMatcher/compatibilita.ts` | quale dato letto si confronta con quale spec, per tipo, e con che tolleranza |
| `src/utils/equipmentMatcher/index.ts` | `matchEquipment`: selezione candidati, collasso duplicati, decisione |
| `src/utils/equipmentMatcher/__tests__/fixtures.ts` | righe di catalogo reali copiate dalla produzione |
| `src/hooks/useCatalogoPerTipo.ts` | caricamento e cache delle righe di un tipo |
| `src/components/technicalSheet/EquipmentMatchDialog.tsx` | il popup di scelta fra candidati |

La spec nomina un singolo `src/utils/equipmentMatcher.ts`; il piano lo articola in una
cartella perché normalizzazione, mappa dati, compatibilità e decisione hanno cicli di
modifica indipendenti e test propri.

---

### Task 1: Normalizzazione delle stringhe e similarità

**Files:**
- Create: `src/utils/equipmentMatcher/normalizzazione.ts`
- Test: `src/utils/equipmentMatcher/__tests__/normalizzazione.test.ts`

**Interfaces:**
- Consuma: nulla.
- Produce:
  - `normalizzaMarcaStretta(marca: string): string`
  - `normalizzaMarcaFamiglia(marca: string): string`
  - `normalizzaModello(modello: string): string`
  - `similarita(a: string, b: string): number` — 0..1, coefficiente di Dice sui trigrammi

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
// src/utils/equipmentMatcher/__tests__/normalizzazione.test.ts
import { describe, test, expect } from 'vitest'
import {
  normalizzaMarcaStretta,
  normalizzaMarcaFamiglia,
  normalizzaModello,
  similarita,
} from '../normalizzazione'

describe('normalizzaMarcaStretta', () => {
  test('canonicalizza la forma societaria senza perderla', () => {
    expect(normalizzaMarcaStretta('SICC S.p.A.')).toBe('SICC SPA')
    expect(normalizzaMarcaStretta('SICC S.r.L.')).toBe('SICC SRL')
    expect(normalizzaMarcaStretta('SICC TECH s.r.l.')).toBe('SICC TECH SRL')
  })

  test('grafie diverse della stessa forma societaria convergono', () => {
    expect(normalizzaMarcaStretta('FIAC AIR COMPRESSORS S.p.A.'))
      .toBe(normalizzaMarcaStretta('FIAC AIR COMPRESSORS SPA'))
    expect(normalizzaMarcaStretta('BOTTARINI SPA')).toBe('BOTTARINI SPA')
  })

  test('SpA e Srl della stessa azienda restano distinguibili', () => {
    expect(normalizzaMarcaStretta('SICC S.p.A.')).not.toBe(normalizzaMarcaStretta('SICC S.r.L.'))
  })

  test('le parentetiche restano', () => {
    expect(normalizzaMarcaStretta('A.ARIA C S.r.l. (ABAC)')).toBe('A ARIA C SRL (ABAC)')
  })
})

describe('normalizzaMarcaFamiglia', () => {
  test('toglie la forma societaria', () => {
    expect(normalizzaMarcaFamiglia('SICC S.p.A.')).toBe('SICC')
    expect(normalizzaMarcaFamiglia('SICC S.r.L.')).toBe('SICC')
    expect(normalizzaMarcaFamiglia('SICC TECH s.r.l.')).toBe('SICC TECH')
  })

  test('toglie anche le parentetiche', () => {
    expect(normalizzaMarcaFamiglia('A.ARIA C S.r.l. (ABAC)')).toBe('A ARIA C')
  })

  test('SpA e Srl della stessa azienda diventano indistinguibili — è voluto', () => {
    expect(normalizzaMarcaFamiglia('SICC S.p.A.')).toBe(normalizzaMarcaFamiglia('SICC S.r.L.'))
  })
})

describe('normalizzaModello', () => {
  test('i separatori convergono su spazio singolo', () => {
    expect(normalizzaModello('500 - 12783')).toBe('500 12783')
    expect(normalizzaModello('500-12783')).toBe('500 12783')
    expect(normalizzaModello('500/12783')).toBe('500 12783')
    expect(normalizzaModello('500–12783')).toBe('500 12783')  // trattino lungo
    expect(normalizzaModello('500_12783')).toBe('500 12783')
    expect(normalizzaModello('2000  - 12784')).toBe('2000 12784')
  })

  test('maiuscole e spazi ai bordi', () => {
    expect(normalizzaModello('  fonocompact pro 270 f6s ')).toBe('FONOCOMPACT PRO 270 F6S')
  })

  test('modelli diversi restano diversi', () => {
    expect(normalizzaModello('500 - 12783')).not.toBe(normalizzaModello('725 - 12783'))
  })
})

describe('similarita', () => {
  test('stringhe identiche danno 1', () => {
    expect(similarita('500 12783', '500 12783')).toBe(1)
  })

  test('stringhe senza nulla in comune danno 0', () => {
    expect(similarita('ABCDEF', 'XYZWQ')).toBe(0)
  })

  test('stringhe simili stanno in mezzo, e sotto la soglia di certezza', () => {
    const s = similarita('500 12783', '725 12783')
    expect(s).toBeGreaterThan(0)
    expect(s).toBeLessThan(1)
  })

  test('è simmetrica', () => {
    expect(similarita('FONOCOMPACT PRO 270 F6S', 'FONOCOMPACT PRO 270 F5 5S'))
      .toBe(similarita('FONOCOMPACT PRO 270 F5 5S', 'FONOCOMPACT PRO 270 F6S'))
  })

  test('stringa vuota dà 0 senza esplodere', () => {
    expect(similarita('', 'QUALCOSA')).toBe(0)
    expect(similarita('', '')).toBe(0)
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npx vitest run src/utils/equipmentMatcher/__tests__/normalizzazione.test.ts`
Expected: FAIL — «Failed to resolve import "../normalizzazione"».

- [ ] **Step 3: Scrivere l'implementazione**

```ts
// src/utils/equipmentMatcher/normalizzazione.ts

/**
 * Forme societarie riconosciute, nella grafia canonica con cui vengono riscritte.
 *
 * Il confronto avviene sul token già ripulito dai punti: «S.p.A.», «SPA» e «S.P.A.»
 * arrivano tutte qui come `SPA`.
 */
const FORME_SOCIETARIE = new Set([
  'SPA', 'SRL', 'SRLS', 'SAS', 'SNC', 'SS',
  'GMBH', 'SE', 'NV', 'BV', 'AG', 'LTD', 'LTDA', 'INC', 'CO', 'KG', 'AB', 'OY',
])

/** Toglie i punti dentro le sigle, uniforma i separatori e collassa gli spazi. */
const ripulisci = (valore: string): string =>
  valore
    .toUpperCase()
    .replace(/[​-‍﻿]/g, '')   // zero-width dell'OCR
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Marca canonicalizzata **conservando** la forma societaria.
 *
 * È il livello con cui si decide se la targhetta indica una ragione sociale precisa:
 * `SICC S.p.A.` e `SICC S.r.L.` restano diverse, come devono.
 */
export function normalizzaMarcaStretta(marca: string): string {
  if (!marca) return ''
  const token = ripulisci(marca).split(' ')
  const fusi: string[] = []
  for (const t of token) {
    // «S P A» torna «SPA»: i punti sono già diventati spazi, e le singole lettere
    // vanno ricomposte prima di poterle riconoscere come forma societaria.
    const ultimo = fusi[fusi.length - 1]
    if (t.length === 1 && ultimo && ultimo.length <= 3 && /^[A-Z]+$/.test(ultimo) && FORME_SOCIETARIE.has(ultimo + t)) {
      fusi[fusi.length - 1] = ultimo + t
      continue
    }
    if (t.length === 1 && ultimo && ultimo.length <= 2 && /^[A-Z]+$/.test(ultimo)) {
      fusi[fusi.length - 1] = ultimo + t
      continue
    }
    fusi.push(t)
  }
  return fusi.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Marca ridotta al solo nome commerciale: forma societaria e parentetiche rimosse.
 *
 * Serve unicamente a risolvere la famiglia produttore. Non è un criterio di scarto:
 * `SICC S.p.A.` e `SICC S.r.L.` collassano qui sulla stessa stringa, ed è intenzionale.
 */
export function normalizzaMarcaFamiglia(marca: string): string {
  if (!marca) return ''
  const senzaParentesi = marca.replace(/\([^)]*\)/g, ' ')
  return normalizzaMarcaStretta(senzaParentesi)
    .split(' ')
    .filter((t) => t && !FORME_SOCIETARIE.has(t))
    .join(' ')
    .trim()
}

/**
 * Modello canonicalizzato.
 *
 * A catalogo lo stesso serbatoio compare come `500 - 12783`, `500-12783` e `725/12783`:
 * il separatore non porta informazione e va tolto di mezzo, o due grafie della stessa
 * voce si leggono come modelli diversi.
 */
export function normalizzaModello(modello: string): string {
  if (!modello) return ''
  return modello
    .toUpperCase()
    .replace(/[​-‍﻿]/g, '')
    .replace(/[-–—/_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Trigrammi di una stringa, con imbottitura ai bordi come fa `pg_trgm`. */
const trigrammi = (valore: string): Set<string> => {
  const insieme = new Set<string>()
  if (!valore) return insieme
  const imbottito = `  ${valore} `
  for (let i = 0; i < imbottito.length - 2; i++) insieme.add(imbottito.slice(i, i + 3))
  return insieme
}

/**
 * Somiglianza fra due stringhe: coefficiente di Dice sui trigrammi, 0..1.
 *
 * È la stessa misura di `pg_trgm`, qui in TypeScript perché la decisione vive nel
 * browser e dev'essere testabile senza database.
 */
export function similarita(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const ta = trigrammi(a)
  const tb = trigrammi(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let comuni = 0
  for (const t of ta) if (tb.has(t)) comuni++
  return (2 * comuni) / (ta.size + tb.size)
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/utils/equipmentMatcher/__tests__/normalizzazione.test.ts`
Expected: PASS, tutti.

Se `normalizzaMarcaStretta('A.ARIA C S.r.l. (ABAC)')` non produce esattamente
`A ARIA C SRL (ABAC)`, aggiustare la ricomposizione delle sigle a lettera singola finché il
test passa: `A.ARIA` deve diventare `A ARIA` (due token distinti), mentre `S.r.l.` deve
ricomporsi in `SRL`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/equipmentMatcher/normalizzazione.ts src/utils/equipmentMatcher/__tests__/normalizzazione.test.ts
git commit -m "feat(matching): normalizzazione di marche e modelli con similarità a trigrammi"
```

---

### Task 2: Mappa delle famiglie produttore

**Files:**
- Create: `src/utils/equipmentMatcher/marcheFamiglie.ts`
- Test: `src/utils/equipmentMatcher/__tests__/marcheFamiglie.test.ts`

**Interfaces:**
- Consuma: `normalizzaMarcaFamiglia` dal Task 1.
- Produce:
  - `FAMIGLIE_MARCHE: Famiglia[]` con `interface Famiglia { famiglia: string; marche: string[] }`
  - `risolviFamiglia(marca: string): string[] | null` — le ragioni sociali della famiglia
    cui la marca appartiene, `null` se non ne risolve alcuna

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
// src/utils/equipmentMatcher/__tests__/marcheFamiglie.test.ts
import { describe, test, expect } from 'vitest'
import { FAMIGLIE_MARCHE, risolviFamiglia } from '../marcheFamiglie'
import { MARCHE_A_CATALOGO } from './fixtures'

describe('risolviFamiglia', () => {
  test('una ragione sociale completa risolve la sua famiglia', () => {
    expect(risolviFamiglia('SICC TECH s.r.l.')).toContain('SICC S.p.A.')
    expect(risolviFamiglia('SICC TECH s.r.l.')).toContain('SICC TECH s.r.l.')
  })

  test('una marca parziale risolve comunque la famiglia', () => {
    const famiglia = risolviFamiglia('SICC')
    expect(famiglia).not.toBeNull()
    expect(famiglia).toHaveLength(4)
  })

  test('collega ragioni sociali senza alcuna somiglianza testuale', () => {
    expect(risolviFamiglia('CECCATO ARIA COMPRESSA S.R.L.')).toContain('A.ARIA C S.r.l. (ABAC)')
    expect(risolviFamiglia('A.ARIA C')).toContain('CECCATO ARIA COMPRESSA S.R.L.')
  })

  test('una marca fuori mappa non risolve nulla', () => {
    expect(risolviFamiglia('KAESER KOMPRESSOREN SE')).toBeNull()
    expect(risolviFamiglia('')).toBeNull()
  })
})

describe('coerenza della mappa col catalogo', () => {
  test('ogni marca elencata esiste davvero a catalogo', () => {
    const mancanti = FAMIGLIE_MARCHE
      .flatMap((f) => f.marche)
      .filter((m) => !MARCHE_A_CATALOGO.includes(m))
    expect(mancanti).toEqual([])
  })

  test('nessuna marca appartiene a due famiglie', () => {
    const tutte = FAMIGLIE_MARCHE.flatMap((f) => f.marche)
    expect(tutte).toHaveLength(new Set(tutte).size)
  })
})
```

- [ ] **Step 2: Creare le fixture**

```ts
// src/utils/equipmentMatcher/__tests__/fixtures.ts
import type { EquipmentCatalogItem } from '@/types'

/**
 * Le marche presenti a catalogo in produzione al 2026-08-16.
 *
 * Serve al test di coerenza della mappa famiglie: una marca rinominata o scritta con un
 * refuso deve emergere come test rosso, non degradare il matching in silenzio.
 */
export const MARCHE_A_CATALOGO = [
  'KAESER KOMPRESSOREN SE', 'CECCATO ARIA COMPRESSA S.R.L.', 'A.ARIA C S.r.l. (ABAC)',
  'AIR COM S.r.l.', 'A.S.T.R.A. REFRIGERANTI S.R.L.', 'SIAP sas', 'SICC TECH s.r.l.',
  'SICC S.p.A.', 'SICC S.r.L.', 'WORTHINGTON-CREYSSENSAC', 'FRIULAIR S.r.l.',
  'ATLAS COPCO AIRPOWER N.V.', 'PARISE COMPRESSORI SRL', 'POWER SYSTEM SRL',
  'FINI - FNA S.p.A.', 'CO.INOX S.r.l.', 'S.E.A. S.p.A.', 'BOTTARINI SPA', 'COMPAIR',
  'BEHALTER-WERK BURGAU GMBH', 'EURE SHANGHAI MACHINERY EQUIPMENT Co. Ltd.',
  'BEKO TECHNOLOGIES S.r.l.', 'CORDIVARI S.r.l.', 'CSC srl', 'ELBI S.p.A.', 'SICC TECH',
  'ZANI s.r.l.', 'AIRTEAMS - AIR.COMP', 'ALUP KOMPRESSOREN', 'FIAC', 'INGERSOLL-RAND CO.LTD',
  'KTC s.r.l.', 'MANNESMANN DEMAG', 'BOMECA srl', 'EFEREST GmbH', 'ZEIDLER & UHL',
  'FIAC AIR COMPRESSORS S.p.A.',
]

const riga = (
  id: string, marca: string, modello: string,
  specs: Record<string, any>, usage_count = 0
): EquipmentCatalogItem => ({
  id, tipo: '', marca, modello, specs, usage_count,
  is_active: true, is_user_defined: false,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
})

/**
 * Serbatoi SICC realmente a catalogo, famiglia «12783».
 *
 * Due proprietà di questo insieme guidano il matching e vanno conservate copiandolo:
 * `500 - 12783` esiste sotto tre ragioni sociali con specs identiche, e `SICC TECH s.r.l.`
 * ne ha due righe proprie (`500-12783` e `500 - 12783`) che differiscono solo per il
 * separatore.
 */
export const SERBATOI_SICC: EquipmentCatalogItem[] = [
  riga('sicc-tech-500-nospazi', 'SICC TECH s.r.l.', '500-12783',   { ps: 11, ts: '-10 ÷ +120', volume: 500, categoria_ped: 'IV' }),
  riga('sicc-tech-500',         'SICC TECH s.r.l.', '500 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 500, categoria_ped: 'IV' }, 3),
  riga('sicc-tech-725',         'SICC TECH s.r.l.', '725 - 12783', { ps: 11, ts: 120,          volume: 725, categoria_ped: 'IV' }, 1),
  riga('sicc-tech-270',         'SICC TECH s.r.l.', '270 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 270, categoria_ped: 'III' }),
  riga('sicc-tech-900',         'SICC TECH s.r.l.', '900 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 900, categoria_ped: 'IV' }),
  riga('sicc-spa-500',          'SICC S.p.A.',      '500 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 500, categoria_ped: 'IV' }),
  riga('sicc-spa-725',          'SICC S.p.A.',      '725 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 725, categoria_ped: 'IV' }),
  riga('sicc-spa-270',          'SICC S.p.A.',      '270 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 270, categoria_ped: 'III' }),
  riga('sicc-srl-500',          'SICC S.r.L.',      '500 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 500, categoria_ped: 'IV' }),
  riga('sicc-srl-725',          'SICC S.r.L.',      '725 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 725, categoria_ped: 'IV' }),
  riga('sicc-tech-nudo-725',    'SICC TECH',        '725/12783',   { ps: 10.8, ts: '-10 ÷+120', volume: 725, categoria_ped: 'IV' }),
]

/**
 * Compressori CECCATO: lo stesso modello sotto le due ragioni sociali della famiglia, con
 * specs *diverse* — e l'OCR del compressore non estrae il FAD, quindi non può distinguerle.
 */
export const COMPRESSORI_CECCATO: EquipmentCatalogItem[] = [
  riga('abac-fono-270',    'A.ARIA C S.r.l. (ABAC)',        'FONOCOMPACT PRO 270 F6S',   { fad: 660,  pressione_max: 11 }),
  riga('ceccato-fono-270', 'CECCATO ARIA COMPRESSA S.R.L.', 'FONOCOMPACT PRO 270 F6S',   { fad: 1010, pressione_max: 11 }),
  riga('ceccato-fono-f55', 'CECCATO ARIA COMPRESSA S.R.L.', 'FONOCOMPACT PRO 270 F5 5S', { fad: 653,  pressione_max: 11 }),
  riga('ceccato-fono-500', 'CECCATO ARIA COMPRESSA S.R.L.', 'FONOCOMPACT PRO 500 F10XSE',{ fad: 1200, pressione_max: 11 }),
]

/** Un filtro: tipo privo di discriminanti tecnici nell'estrazione OCR. */
export const FILTRI: EquipmentCatalogItem[] = [
  riga('filtro-uno', 'AIR COM S.r.l.', 'AC 0035', { ps: 16, ts: '-10 ÷ +120' }),
]
```

- [ ] **Step 3: Eseguire i test e verificare che falliscano**

Run: `npx vitest run src/utils/equipmentMatcher/__tests__/marcheFamiglie.test.ts`
Expected: FAIL — «Failed to resolve import "../marcheFamiglie"».

- [ ] **Step 4: Scrivere l'implementazione**

```ts
// src/utils/equipmentMatcher/marcheFamiglie.ts
import { normalizzaMarcaFamiglia } from './normalizzazione'

export interface Famiglia {
  /** Nome di comodo, usato solo nei messaggi e nei test. */
  famiglia: string
  /** Ragioni sociali, scritte **esattamente** come stanno a catalogo. */
  marche: string[]
}

/**
 * Ragioni sociali che appartengono allo stesso produttore.
 *
 * Un'azienda che cambia forma o denominazione lascia a catalogo righe sotto entrambi i
 * nomi, e lo stesso modello può stare sotto l'uno o sotto l'altro a seconda dell'anno di
 * fabbricazione. Per SICC la successione è leggibile dal nome; per CECCATO no —
 * `CECCATO ARIA COMPRESSA` e `A.ARIA C` non hanno un carattere in comune, e nessuna misura
 * di somiglianza potrà mai collegarle. Per questo la mappa è scritta a mano.
 *
 * Aggiungere una famiglia significa modificare questo file: è un evento raro, e passando
 * da qui resta tracciato in git accanto al test che ne verifica la coerenza col catalogo.
 */
export const FAMIGLIE_MARCHE: Famiglia[] = [
  { famiglia: 'SICC',    marche: ['SICC S.p.A.', 'SICC S.r.L.', 'SICC TECH s.r.l.', 'SICC TECH'] },
  { famiglia: 'CECCATO', marche: ['CECCATO ARIA COMPRESSA S.R.L.', 'A.ARIA C S.r.l. (ABAC)'] },
  { famiglia: 'FIAC',    marche: ['FIAC', 'FIAC AIR COMPRESSORS S.p.A.'] },
]

/**
 * Le ragioni sociali della famiglia cui appartiene `marca`, oppure `null`.
 *
 * Il confronto è al livello famiglia (forma societaria rimossa) e accetta il contenimento:
 * una targhetta che dice solo `SICC` risolve la famiglia perché `SICC` è il nome di
 * `SICC S.p.A.` ed è contenuto in `SICC TECH`. Si preferisce sempre la corrispondenza
 * esatta, così `FIAC` non viene attratto da una famiglia il cui nome lo contenga.
 */
export function risolviFamiglia(marca: string): string[] | null {
  const cercata = normalizzaMarcaFamiglia(marca)
  if (!cercata) return null

  const normalizzate = FAMIGLIE_MARCHE.map((f) => ({
    marche: f.marche,
    nomi: f.marche.map(normalizzaMarcaFamiglia),
  }))

  const esatta = normalizzate.find((f) => f.nomi.includes(cercata))
  if (esatta) return esatta.marche

  const perContenimento = normalizzate.find((f) =>
    f.nomi.some((n) => n.startsWith(`${cercata} `) || cercata.startsWith(`${n} `))
  )
  return perContenimento ? perContenimento.marche : null
}
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

Run: `npx vitest run src/utils/equipmentMatcher/__tests__/marcheFamiglie.test.ts`
Expected: PASS, tutti e sei.

- [ ] **Step 6: Commit**

```bash
git add src/utils/equipmentMatcher/marcheFamiglie.ts src/utils/equipmentMatcher/__tests__/
git commit -m "feat(matching): mappa delle famiglie produttore con test di coerenza sul catalogo"
```

---

### Task 3: Compatibilità tecnica fra targhetta e riga di catalogo

**Files:**
- Create: `src/utils/equipmentMatcher/compatibilita.ts`
- Test: `src/utils/equipmentMatcher/__tests__/compatibilita.test.ts`

**Interfaces:**
- Consuma: `readSpec` da `@/services/equipmentAudit`; `EquipmentKind` e `EQUIPMENT_DEFS` da
  `@/components/technicalSheet/table/equipmentConfig`.
- Produce:
  - `interface ConfrontoSpec { campo: string; etichetta: string; valoreCatalogo: number | string | null; valoreLetto: number | null; esito: 'conferma' | 'diverge' | 'non_letto' }`
  - `confrontaSpecs(kind: EquipmentKind, datiOcr: OCRExtractedData, riga: EquipmentCatalogItem): ConfrontoSpec[]`
  - `eCompatibile(confronti: ConfrontoSpec[]): boolean` — nessun `diverge`
  - `haConferme(confronti: ConfrontoSpec[]): boolean` — almeno un `conferma`

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
// src/utils/equipmentMatcher/__tests__/compatibilita.test.ts
import { describe, test, expect } from 'vitest'
import { confrontaSpecs, eCompatibile, haConferme } from '../compatibilita'
import { SERBATOI_SICC, COMPRESSORI_CECCATO, FILTRI } from './fixtures'

const serbatoio500Tech = SERBATOI_SICC.find((r) => r.id === 'sicc-tech-500')!
const compressoreAbac = COMPRESSORI_CECCATO.find((r) => r.id === 'abac-fono-270')!

describe('confrontaSpecs — serbatoio', () => {
  test('volume e PS uguali confermano', () => {
    const c = confrontaSpecs('serbatoio', { volume: 500, pressione_max: 11 }, serbatoio500Tech)
    expect(c.find((x) => x.campo === 'volume')?.esito).toBe('conferma')
    expect(c.find((x) => x.campo === 'ps')?.esito).toBe('conferma')
    expect(eCompatibile(c)).toBe(true)
    expect(haConferme(c)).toBe(true)
  })

  test('volume diverso diverge', () => {
    const c = confrontaSpecs('serbatoio', { volume: 725, pressione_max: 11 }, serbatoio500Tech)
    expect(c.find((x) => x.campo === 'volume')?.esito).toBe('diverge')
    expect(eCompatibile(c)).toBe(false)
  })

  test('PS oltre la tolleranza diverge', () => {
    const c = confrontaSpecs('serbatoio', { volume: 500, pressione_max: 11.5 }, serbatoio500Tech)
    expect(c.find((x) => x.campo === 'ps')?.esito).toBe('diverge')
    expect(eCompatibile(c)).toBe(false)
  })

  test('PS dentro la tolleranza di ±0,05 bar conferma', () => {
    const c = confrontaSpecs('serbatoio', { volume: 500, pressione_max: 11.02 }, serbatoio500Tech)
    expect(c.find((x) => x.campo === 'ps')?.esito).toBe('conferma')
    expect(eCompatibile(c)).toBe(true)
  })

  test('un dato non letto non contraddice, ma non conferma', () => {
    const c = confrontaSpecs('serbatoio', { volume: 500 }, serbatoio500Tech)
    expect(c.find((x) => x.campo === 'ps')?.esito).toBe('non_letto')
    expect(eCompatibile(c)).toBe(true)
    expect(haConferme(c)).toBe(true)   // il volume conferma
  })

  test('targhetta muta sui dati tecnici: compatibile ma senza conferme', () => {
    const c = confrontaSpecs('serbatoio', {}, serbatoio500Tech)
    expect(eCompatibile(c)).toBe(true)
    expect(haConferme(c)).toBe(false)
  })

  test('TS non entra mai nel confronto: l\'OCR non lo estrae', () => {
    const c = confrontaSpecs('serbatoio', { volume: 500, pressione_max: 11 }, serbatoio500Tech)
    expect(c.some((x) => x.campo === 'ts')).toBe(false)
  })
})

describe('confrontaSpecs — compressore', () => {
  test('la PS si confronta con specs.pressione_max, non con specs.ps', () => {
    const c = confrontaSpecs('compressore', { pressione_max: 11 }, compressoreAbac)
    expect(c.find((x) => x.campo === 'pressione_max')?.esito).toBe('conferma')
    expect(eCompatibile(c)).toBe(true)
  })

  test('il volume letto non si confronta: l\'OCR del compressore non estrae il FAD', () => {
    const c = confrontaSpecs('compressore', { pressione_max: 11, volume: 999 }, compressoreAbac)
    expect(c.some((x) => x.campo === 'fad')).toBe(false)
    expect(eCompatibile(c)).toBe(true)
  })
})

describe('confrontaSpecs — filtro', () => {
  test('nessun campo confrontabile: compatibile e senza conferme', () => {
    const c = confrontaSpecs('filtro', { pressione_max: 16 }, FILTRI[0])
    expect(eCompatibile(c)).toBe(true)
    expect(haConferme(c)).toBe(false)
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npx vitest run src/utils/equipmentMatcher/__tests__/compatibilita.test.ts`
Expected: FAIL — «Failed to resolve import "../compatibilita"».

- [ ] **Step 3: Scrivere l'implementazione**

```ts
// src/utils/equipmentMatcher/compatibilita.ts
import { readSpec } from '@/services/equipmentAudit'
import { EQUIPMENT_DEFS, type EquipmentKind } from '@/components/technicalSheet/table/equipmentConfig'
import type { EquipmentCatalogItem } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'

/** Scostamento ammesso fra la pressione letta e quella a catalogo, in bar. */
const TOLLERANZA_PRESSIONE = 0.05

export interface ConfrontoSpec {
  /** Chiave di `specs` a catalogo. */
  campo: string
  /** Come si chiama nel popup. */
  etichetta: string
  valoreCatalogo: number | string | null
  valoreLetto: number | null
  esito: 'conferma' | 'diverge' | 'non_letto'
}

/**
 * Cosa l'OCR sa leggere di questo tipo, e con quale spec di catalogo va confrontato.
 *
 * Non è la stessa cosa di `specsMap`: lì c'è tutto ciò che il catalogo dichiara, qui solo
 * ciò che una targhetta può smentire. `ts` non compare mai — lo schema di estrazione non lo
 * prevede — e sui compressori manca il volume, perché l'OCR del compressore non estrae il
 * FAD: su quel tipo l'unico discriminante tecnico è la pressione.
 */
const CAMPI_CONFRONTABILI: Record<EquipmentKind, { campo: string; etichetta: string; da: 'volume' | 'pressione_max'; tolleranza: number }[]> = {
  serbatoio:   [{ campo: 'volume', etichetta: 'Volume', da: 'volume', tolleranza: 0 },
                { campo: 'ps', etichetta: 'PS', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE }],
  disoleatore: [{ campo: 'volume', etichetta: 'Volume', da: 'volume', tolleranza: 0 },
                { campo: 'ps', etichetta: 'PS', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE }],
  scambiatore: [{ campo: 'volume', etichetta: 'Volume', da: 'volume', tolleranza: 0 },
                { campo: 'ps', etichetta: 'PS', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE }],
  recipiente:  [{ campo: 'volume', etichetta: 'Volume', da: 'volume', tolleranza: 0 },
                { campo: 'ps', etichetta: 'PS', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE }],
  compressore: [{ campo: 'pressione_max', etichetta: 'Pressione max', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE }],
  essiccatore: [{ campo: 'ps', etichetta: 'PS', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE }],
  valvola:     [{ campo: 'ptar', etichetta: 'Ptar', da: 'pressione_max', tolleranza: TOLLERANZA_PRESSIONE }],
  filtro:      [],
  separatore:  [],
}

/**
 * La pressione che la targhetta dichiara, per il tipo dato.
 *
 * Sulle valvole non c'è un campo numerico: l'estrazione restituisce `diametro_pressione`,
 * una stringa come `1/2" 13 bar` da cui la taratura va ricavata.
 */
const pressioneLetta = (kind: EquipmentKind, dati: OCRExtractedData): number | null => {
  if (kind === 'valvola') {
    const grezzo = dati.diametro_pressione
    if (!grezzo) return null
    const m = grezzo.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*bar/i)
    return m ? Number(m[1]) : null
  }
  return dati.pressione_max ?? null
}

/**
 * Confronta, campo per campo, ciò che la targhetta dichiara con ciò che la riga di catalogo
 * afferma. Un dato che l'OCR non ha letto vale `non_letto`: una targhetta rovinata riduce la
 * certezza, non deve escludere candidati.
 */
export function confrontaSpecs(
  kind: EquipmentKind,
  datiOcr: OCRExtractedData,
  riga: EquipmentCatalogItem
): ConfrontoSpec[] {
  const def = EQUIPMENT_DEFS[kind]
  return CAMPI_CONFRONTABILI[kind].map(({ campo, etichetta, da, tolleranza }) => {
    const valoreCatalogo = readSpec(def.catalogType, riga.specs ?? {}, campo) as number | string | null
    const valoreLetto = da === 'volume' ? (datiOcr.volume ?? null) : pressioneLetta(kind, datiOcr)

    if (valoreLetto === null || valoreCatalogo === null || valoreCatalogo === '') {
      return { campo, etichetta, valoreCatalogo, valoreLetto, esito: 'non_letto' as const }
    }

    const numeroCatalogo = Number(valoreCatalogo)
    if (Number.isNaN(numeroCatalogo)) {
      return { campo, etichetta, valoreCatalogo, valoreLetto, esito: 'non_letto' as const }
    }

    const combacia = Math.abs(numeroCatalogo - valoreLetto) <= tolleranza
    return {
      campo, etichetta, valoreCatalogo, valoreLetto,
      esito: combacia ? ('conferma' as const) : ('diverge' as const),
    }
  })
}

/** Nessun dato letto contraddice questa riga. */
export const eCompatibile = (confronti: ConfrontoSpec[]): boolean =>
  !confronti.some((c) => c.esito === 'diverge')

/** Almeno un dato letto conferma attivamente questa riga. */
export const haConferme = (confronti: ConfrontoSpec[]): boolean =>
  confronti.some((c) => c.esito === 'conferma')
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/utils/equipmentMatcher/__tests__/compatibilita.test.ts`
Expected: PASS. Se `readSpec` non è esportato da `@/services/equipmentAudit`, importarlo da
`@/services/equipmentAudit/specsNormalization`, dove è definito (riga 429).

- [ ] **Step 5: Commit**

```bash
git add src/utils/equipmentMatcher/compatibilita.ts src/utils/equipmentMatcher/__tests__/compatibilita.test.ts
git commit -m "feat(matching): confronto fra dati letti dalla targhetta e specs di catalogo"
```

---

### Task 4: `matchEquipment` — candidati, collasso, decisione

**Files:**
- Create: `src/utils/equipmentMatcher/index.ts`
- Test: `src/utils/equipmentMatcher/__tests__/matchEquipment.test.ts`

**Interfaces:**
- Consuma: tutto dai Task 1-3.
- Produce:
  - `matchEquipment(kind: EquipmentKind, datiOcr: OCRExtractedData, righe: EquipmentCatalogItem[]): RisultatoMatch`
  - i tipi `RisultatoMatch`, `Candidato`, `MotivoAmbiguita` (definiti sotto)

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
// src/utils/equipmentMatcher/__tests__/matchEquipment.test.ts
import { describe, test, expect } from 'vitest'
import { matchEquipment } from '../index'
import { SERBATOI_SICC, COMPRESSORI_CECCATO, FILTRI } from './fixtures'

describe('esito certo', () => {
  test('ragione sociale completa, modello esatto, volume e PS confermati', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH s.r.l.', modello: '500-12783', volume: 500, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('certo')
    if (r.esito !== 'certo') return
    expect(r.candidato.riga.marca).toBe('SICC TECH s.r.l.')
    // Le due righe TECH `500-12783` e `500 - 12783` sono la stessa cosa: si collassano,
    // e sopravvive quella più usata.
    expect(r.candidato.riga.id).toBe('sicc-tech-500')
  })
})

describe('esito ambiguo', () => {
  test('marca parziale: una ragione sociale per candidato', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC', modello: '500-12783', volume: 500, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('piu_candidati')
    expect(r.candidati.map((c) => c.riga.marca).sort())
      .toEqual(['SICC S.p.A.', 'SICC S.r.L.', 'SICC TECH s.r.l.'])
  })

  test('PS divergente su candidato unico', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH s.r.l.', modello: '500-12783', volume: 500, pressione_max: 11.5 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('divergenza_specs')
    expect(r.candidati[0].confronti.find((c) => c.campo === 'ps')?.esito).toBe('diverge')
  })

  test('modello somigliante ma non identico non basta per la certezza', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH', modello: '725/1278', volume: 725, pressione_max: 10.8 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('somiglianza_incerta')
  })

  test('la targhetta dà una ragione sociale, il modello sta solo sotto un\'altra', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'SICC TECH s.r.l.', modello: '725/12783', volume: 725, pressione_max: 10.8 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.motivo).toBe('ragione_sociale_altra')
    expect(r.candidati.some((c) => c.riga.marca === 'SICC TECH')).toBe(true)
  })

  test('famiglia senza somiglianza testuale: entrambe le ragioni sociali CECCATO', () => {
    const r = matchEquipment('compressore',
      { marca: 'A.ARIA C', modello: 'FONOCOMPACT PRO 270 F6S', pressione_max: 11 },
      COMPRESSORI_CECCATO)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati.map((c) => c.riga.marca).sort())
      .toEqual(['A.ARIA C S.r.l. (ABAC)', 'CECCATO ARIA COMPRESSA S.R.L.'])
  })

  test('tipo senza discriminanti tecnici non raggiunge mai la certezza', () => {
    const r = matchEquipment('filtro',
      { marca: 'AIR COM S.r.l.', modello: 'AC 0035' },
      FILTRI)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati).toHaveLength(1)
  })

  test('solo il modello leggibile: si cerca su tutto il tipo', () => {
    const r = matchEquipment('serbatoio',
      { modello: '500 - 12783', volume: 500, pressione_max: 11 },
      SERBATOI_SICC)

    expect(r.esito).toBe('ambiguo')
    if (r.esito !== 'ambiguo') return
    expect(r.candidati.length).toBeGreaterThanOrEqual(3)
  })
})

describe('esito nessuno', () => {
  test('marca e modello fuori catalogo', () => {
    const r = matchEquipment('serbatoio',
      { marca: 'KAESER KOMPRESSOREN SE', modello: 'XYZ-999', volume: 500 },
      SERBATOI_SICC)
    expect(r.esito).toBe('nessuno')
  })

  test('modello vuoto', () => {
    const r = matchEquipment('serbatoio', { marca: 'SICC S.p.A.' }, SERBATOI_SICC)
    expect(r.esito).toBe('nessuno')
  })

  test('catalogo vuoto', () => {
    const r = matchEquipment('serbatoio', { marca: 'SICC', modello: '500-12783' }, [])
    expect(r.esito).toBe('nessuno')
  })
})

describe('ordinamento e limite dei candidati', () => {
  test('al massimo cinque candidati, i più somiglianti per primi', () => {
    const r = matchEquipment('serbatoio', { modello: '12783' }, SERBATOI_SICC)
    if (r.esito !== 'ambiguo') return
    expect(r.candidati.length).toBeLessThanOrEqual(5)
    const sim = r.candidati.map((c) => c.simModello)
    expect([...sim].sort((a, b) => b - a)).toEqual(sim)
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

Run: `npx vitest run src/utils/equipmentMatcher/__tests__/matchEquipment.test.ts`
Expected: FAIL — «Failed to resolve import "../index"».

- [ ] **Step 3: Scrivere l'implementazione**

```ts
// src/utils/equipmentMatcher/index.ts
import { normalizzaMarcaStretta, normalizzaModello, similarita } from './normalizzazione'
import { risolviFamiglia } from './marcheFamiglie'
import { confrontaSpecs, eCompatibile, haConferme, type ConfrontoSpec } from './compatibilita'
import { EQUIPMENT_DEFS, type EquipmentKind } from '@/components/technicalSheet/table/equipmentConfig'
import type { EquipmentCatalogItem } from '@/types'
import type { OCRExtractedData } from '@/types/ocr'

/** Sotto questa somiglianza di modello una riga non è nemmeno un candidato. */
const SOGLIA_INGRESSO = 0.6
/** Quanti candidati ha senso mostrare nel popup. */
const MAX_CANDIDATI = 5

export interface Candidato {
  riga: EquipmentCatalogItem
  simModello: number
  /** La targhetta dà la ragione sociale completa e coincide con quella della riga. */
  marcaEsatta: boolean
  confronti: ConfrontoSpec[]
}

export type MotivoAmbiguita =
  | 'ragione_sociale_altra'
  | 'divergenza_specs'
  | 'piu_candidati'
  | 'somiglianza_incerta'

export type RisultatoMatch =
  | { esito: 'certo'; candidato: Candidato }
  | { esito: 'ambiguo'; candidati: Candidato[]; motivo: MotivoAmbiguita }
  | { esito: 'nessuno' }

/**
 * Riconduce ciò che l'OCR ha letto a una riga di `equipment_catalog`.
 *
 * Funzione pura: riceve le righe già caricate e non conosce né React né Supabase. È il
 * punto in cui si decide se la scheda si compila da sola, se serve una domanda
 * all'operatore, o se l'apparecchiatura è davvero sconosciuta.
 */
export function matchEquipment(
  kind: EquipmentKind,
  datiOcr: OCRExtractedData,
  righe: EquipmentCatalogItem[]
): RisultatoMatch {
  const modelloLetto = normalizzaModello(datiOcr.modello ?? '')
  if (!modelloLetto || righe.length === 0) return { esito: 'nessuno' }

  const marcaLetta = datiOcr.marca ?? ''
  const marcaStretta = normalizzaMarcaStretta(marcaLetta)

  // 1. Restrizione stretta: se la targhetta dichiara una ragione sociale precisa, si cerca
  //    solo lì. Una targhetta che dice «SICC TECH s.r.l.» non fa guardare le righe SpA.
  const strette = marcaStretta
    ? righe.filter((r) => normalizzaMarcaStretta(r.marca) === marcaStretta)
    : []

  const valuta = (insieme: EquipmentCatalogItem[]): Candidato[] =>
    insieme
      .map((riga) => ({
        riga,
        simModello: similarita(modelloLetto, normalizzaModello(riga.modello)),
        marcaEsatta: Boolean(marcaStretta) && normalizzaMarcaStretta(riga.marca) === marcaStretta,
        confronti: confrontaSpecs(kind, datiOcr, riga),
      }))
      .filter((c) => c.simModello >= SOGLIA_INGRESSO)

  let candidati = valuta(strette)
  let daAltraRagioneSociale = false

  // 2. Ripiego alla famiglia. Serve in due casi: la targhetta è parziale e non ha
  //    selezionato nulla, oppure ha selezionato righe in cui quel modello non c'è. Nel
  //    secondo caso i candidati trovati altrove portano una contraddizione che va vista.
  if (candidati.length === 0) {
    const famiglia = risolviFamiglia(marcaLetta)
    const insieme = famiglia
      ? righe.filter((r) => famiglia.includes(r.marca))
      : righe   // marca illeggibile o fuori mappa: si cerca su tutto il tipo
    candidati = valuta(insieme)
    daAltraRagioneSociale = strette.length > 0 && candidati.length > 0
  }

  if (candidati.length === 0) return { esito: 'nessuno' }

  // 3. Collasso dei duplicati: stessa ragione sociale e stesse specs sono la stessa
  //    apparecchiatura scritta due volte (a catalogo `500-12783` e `500 - 12783` convivono).
  //    Fra ragioni sociali diverse non si collassa mai: quella è la scelta dell'operatore.
  const def = EQUIPMENT_DEFS[kind]
  const chiaveSpecs = Object.keys(def.specsMap)
  const impronta = (c: Candidato) =>
    [normalizzaMarcaStretta(c.riga.marca), ...chiaveSpecs.map((k) => String((c.riga.specs ?? {})[k] ?? ''))].join('|')

  const perImpronta = new Map<string, Candidato>()
  for (const c of candidati) {
    const chiave = impronta(c)
    const gia = perImpronta.get(chiave)
    if (!gia || (c.riga.usage_count ?? 0) > (gia.riga.usage_count ?? 0)) perImpronta.set(chiave, c)
  }
  candidati = [...perImpronta.values()]

  const compatibili = candidati.filter((c) => eCompatibile(c.confronti))
  const ordina = (a: Candidato, b: Candidato) =>
    b.simModello - a.simModello || (b.riga.usage_count ?? 0) - (a.riga.usage_count ?? 0)

  // 4. Certezza: un solo candidato compatibile, modello identico, e almeno un dato tecnico
  //    che lo conferma. Tutto il resto passa dall'operatore.
  if (
    !daAltraRagioneSociale &&
    compatibili.length === 1 &&
    compatibili[0].simModello === 1 &&
    haConferme(compatibili[0].confronti)
  ) {
    return { esito: 'certo', candidato: compatibili[0] }
  }

  const mostrati = (compatibili.length > 0 ? compatibili : candidati).sort(ordina).slice(0, MAX_CANDIDATI)

  const motivo: MotivoAmbiguita = daAltraRagioneSociale
    ? 'ragione_sociale_altra'
    : compatibili.length === 0
      ? 'divergenza_specs'
      : compatibili.length > 1
        ? 'piu_candidati'
        : 'somiglianza_incerta'

  return { esito: 'ambiguo', candidati: mostrati, motivo }
}

export type { ConfrontoSpec } from './compatibilita'
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

Run: `npx vitest run src/utils/equipmentMatcher/`
Expected: PASS, tutti i file.

Se il test «modello somigliante ma non identico» risultasse `nessuno` invece di `ambiguo`, la
similarità fra `725 1278` e `725 12783` è sotto `0,60`: abbassare la soglia a `0,55` e
annotarlo, oppure scegliere nel test un troncamento più lieve. **Non** alzare la soglia oltre
`0,60` senza rieseguire l'intero file: renderebbe `nessuno` casi che devono restare `ambiguo`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/equipmentMatcher/index.ts src/utils/equipmentMatcher/__tests__/matchEquipment.test.ts
git commit -m "feat(matching): matchEquipment con collasso dei duplicati e decisione a tre esiti"
```

---

### Task 5: Caricamento delle righe di catalogo per tipo

**Files:**
- Modify: `src/services/api/equipmentCatalog.ts` (aggiungere `findByTipo` accanto a
  `findByMarche`, riga 130)
- Create: `src/hooks/useCatalogoPerTipo.ts`

**Interfaces:**
- Consuma: `supabase` da `@/services/supabase`.
- Produce:
  - `equipmentCatalogApi.findByTipo(tipo: EquipmentCatalogType): Promise<EquipmentCatalogItem[]>`
  - `useCatalogoPerTipo(tipo: EquipmentCatalogType | undefined): { righe: EquipmentCatalogItem[]; loading: boolean }`
  - `caricaCatalogoPerTipo(queryClient, tipo): Promise<EquipmentCatalogItem[]>` — per il
    batch, che ha bisogno delle righe fuori da un componente

- [ ] **Step 1: Aggiungere il metodo API**

```ts
// src/services/api/equipmentCatalog.ts — subito dopo findByMarche (riga ~152)

  /**
   * Tutte le righe attive di un tipo.
   *
   * Il matching della targhetta ha bisogno dell'insieme intero, non di un sottoinsieme per
   * marca: la marca letta può essere parziale o assente, e il candidato giusto va cercato
   * anche sotto ragioni sociali che la targhetta non nomina. Il tipo più popoloso è
   * «Compressori» con 639 righe: un payload che sta in cache senza problemi.
   */
  async findByTipo(tipo: EquipmentCatalogType): Promise<EquipmentCatalogItem[]> {
    const { data, error } = await supabase
      .from('equipment_catalog')
      .select('*')
      .eq('tipo_apparecchiatura', tipo)
      .eq('is_active', true)

    if (error) throw error

    return (data ?? []) as EquipmentCatalogItem[]
  },
```

- [ ] **Step 2: Creare l'hook**

```ts
// src/hooks/useCatalogoPerTipo.ts
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { equipmentCatalogApi } from '@/services/api/equipmentCatalog'
import type { EquipmentCatalogItem, EquipmentCatalogType } from '@/types'

const chiave = (tipo: EquipmentCatalogType) => ['catalogo-per-tipo', tipo] as const
const STALE = 5 * 60 * 1000

/**
 * Le righe di catalogo di un tipo, per il matching della targhetta.
 *
 * Sta in cache come `useVariantiModello`: tutte le righe della tabella dello stesso tipo
 * condividono la richiesta, che parte una volta sola per scheda.
 */
export function useCatalogoPerTipo(tipo: EquipmentCatalogType | undefined) {
  const { data, isLoading } = useQuery({
    queryKey: chiave(tipo!),
    queryFn: () => equipmentCatalogApi.findByTipo(tipo!),
    enabled: Boolean(tipo),
    staleTime: STALE,
  })

  return { righe: (data ?? []) as EquipmentCatalogItem[], loading: isLoading }
}

/**
 * Le righe di **tutti** i tipi presenti in tabella, indicizzate per tipo.
 *
 * La tabella mostra righe di tipi diversi e il numero di hook chiamati da un componente
 * deve restare costante fra un render e l'altro: `useQueries` prende l'elenco dei tipi
 * come dato e resta una sola chiamata, mentre un `useCatalogoPerTipo` per riga
 * violerebbe le regole degli hook appena una riga viene aggiunta o eliminata.
 */
export function useCatalogoPerTipi(tipi: EquipmentCatalogType[]) {
  const risultati = useQueries({
    queries: tipi.map((tipo) => ({
      queryKey: chiave(tipo),
      queryFn: () => equipmentCatalogApi.findByTipo(tipo),
      staleTime: STALE,
    })),
  })

  const perTipo = {} as Record<EquipmentCatalogType, EquipmentCatalogItem[]>
  tipi.forEach((tipo, i) => {
    perTipo[tipo] = (risultati[i]?.data ?? []) as EquipmentCatalogItem[]
  })
  return perTipo
}

/**
 * Le stesse righe, fuori da un componente.
 *
 * Il batch elabora N targhette dentro un handler e non può montare un hook per ciascuna:
 * passando dal `QueryClient` condivide però la stessa cache degli hook, quindi un tipo già
 * caricato dalla tabella non viene richiesto una seconda volta.
 */
export function caricaCatalogoPerTipo(
  queryClient: QueryClient,
  tipo: EquipmentCatalogType
): Promise<EquipmentCatalogItem[]> {
  return queryClient.fetchQuery({
    queryKey: chiave(tipo),
    queryFn: () => equipmentCatalogApi.findByTipo(tipo),
    staleTime: STALE,
  })
}
```

L'import in testa al file diventa:

```ts
import { useQueries, useQuery, type QueryClient } from '@tanstack/react-query'
```

- [ ] **Step 3: Verificare che il progetto compili**

Run: `npx tsc --noEmit`
Expected: nessun errore nei due file toccati.

- [ ] **Step 4: Commit**

```bash
git add src/services/api/equipmentCatalog.ts src/hooks/useCatalogoPerTipo.ts
git commit -m "feat(matching): caricamento in cache delle righe di catalogo per tipo"
```

---

### Task 6: Il popup di scelta fra candidati

**Files:**
- Create: `src/components/technicalSheet/EquipmentMatchDialog.tsx`

**Interfaces:**
- Consuma: `Candidato`, `MotivoAmbiguita`, `ConfrontoSpec` dal Task 4.
- Produce: il componente `EquipmentMatchDialog` con queste props:

```ts
interface EquipmentMatchDialogProps {
  open: boolean
  /** Che cosa la targhetta dichiara, per l'intestazione. */
  datiOcr: OCRExtractedData
  candidati: Candidato[]
  motivo: MotivoAmbiguita
  /** Da quale file arriva questa targhetta; mostrato nel batch. */
  origine?: string
  /** Posizione nella coda del batch, es. «2 di 5». */
  passo?: { corrente: number; totale: number }
  onScegli: (candidato: Candidato) => void
  onScarta: () => void
}
```

- [ ] **Step 1: Scrivere il componente**

```tsx
// src/components/technicalSheet/EquipmentMatchDialog.tsx
import { useState, useEffect } from 'react'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Radio, RadioGroup, Paper, Typography,
} from '@mui/material'
import type { Candidato, ConfrontoSpec, MotivoAmbiguita } from '@/utils/equipmentMatcher'
import type { OCRExtractedData } from '@/types/ocr'

interface EquipmentMatchDialogProps {
  open: boolean
  datiOcr: OCRExtractedData
  candidati: Candidato[]
  motivo: MotivoAmbiguita
  origine?: string
  passo?: { corrente: number; totale: number }
  onScegli: (candidato: Candidato) => void
  onScarta: () => void
}

const AVVISO: Record<MotivoAmbiguita, string> = {
  ragione_sociale_altra:
    'La targhetta dichiara una ragione sociale, ma questo modello è a catalogo solo sotto un\'altra della stessa azienda. O il catalogo è incompleto, o la lettura è imprecisa.',
  divergenza_specs:
    'I dati letti dalla targhetta non coincidono con quelli a catalogo. Verifica quale dei due è corretto prima di scegliere.',
  piu_candidati:
    'Più voci di catalogo corrispondono a questa targhetta. Le ragioni sociali appartengono alla stessa azienda in epoche diverse: scegli quella riportata sul certificato.',
  somiglianza_incerta:
    'Il modello letto somiglia a questa voce di catalogo ma non coincide esattamente.',
}

/** Riga di confronto fra ciò che dice la targhetta e ciò che dice il catalogo. */
const Confronto = ({ c }: { c: ConfrontoSpec }) => {
  if (c.esito === 'non_letto') {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
        {c.etichetta} {c.valoreCatalogo ?? '—'} <em>(da catalogo)</em>
      </Typography>
    )
  }
  const diverge = c.esito === 'diverge'
  return (
    <Typography
      variant="caption"
      sx={{ mr: 2, color: diverge ? 'error.main' : 'success.main', fontWeight: diverge ? 700 : 400 }}
    >
      {c.etichetta} {c.valoreCatalogo} {diverge ? '✗' : '✓'}
      {diverge && (
        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
          {' '}targhetta: {c.valoreLetto}
        </Box>
      )}
    </Typography>
  )
}

/**
 * Scelta fra le voci di catalogo che possono corrispondere alla targhetta appena letta.
 *
 * Il confronto è mostrato campo per campo perché la decisione si prende sui numeri: due
 * ragioni sociali della stessa azienda portano spesso lo stesso modello, e l'unica cosa che
 * le distingue sono i dati tecnici — quando li distinguono.
 */
export const EquipmentMatchDialog = ({
  open, datiOcr, candidati, motivo, origine, passo, onScegli, onScarta,
}: EquipmentMatchDialogProps) => {
  const [scelto, setScelto] = useState<string>('')

  // La coda del batch riusa lo stesso dialog per targhette diverse: senza azzerare, la
  // selezione della precedente resterebbe accesa sulla successiva.
  useEffect(() => {
    setScelto(candidati.length === 1 ? candidati[0].riga.id : '')
  }, [candidati])

  const letto = [
    datiOcr.marca, datiOcr.modello,
    datiOcr.volume != null ? `${datiOcr.volume} L` : null,
    datiOcr.pressione_max != null ? `${datiOcr.pressione_max} bar` : null,
    datiOcr.n_fabbrica ? `matr. ${datiOcr.n_fabbrica}` : null,
    datiOcr.anno ? String(datiOcr.anno) : null,
  ].filter(Boolean).join(' · ')

  const candidatoScelto = candidati.find((c) => c.riga.id === scelto)

  return (
    <Dialog open={open} onClose={onScarta} maxWidth="md" fullWidth>
      <DialogTitle>
        Corrispondenza a catalogo
        {passo && (
          <Chip label={`${passo.corrente} di ${passo.totale}`} size="small" sx={{ ml: 1 }} />
        )}
      </DialogTitle>

      <DialogContent>
        <Alert severity={motivo === 'divergenza_specs' ? 'warning' : 'info'} sx={{ mb: 2 }}>
          {AVVISO[motivo]}
        </Alert>

        {origine && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            File: {origine}
          </Typography>
        )}

        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'background.default' }}>
          <Typography variant="caption" color="text.secondary">Dalla targhetta</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{letto || '—'}</Typography>
        </Paper>

        <RadioGroup value={scelto} onChange={(e) => setScelto(e.target.value)}>
          {candidati.map((c) => (
            <Paper key={c.riga.id} variant="outlined" sx={{ p: 1, mb: 1 }}>
              <FormControlLabel
                value={c.riga.id}
                control={<Radio size="small" />}
                sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
                label={
                  <Box sx={{ pt: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {c.riga.marca}
                      <Box component="span" sx={{ fontWeight: 400, ml: 1 }}>{c.riga.modello}</Box>
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      {c.confronti.map((x) => <Confronto key={x.campo} c={x} />)}
                    </Box>
                  </Box>
                }
              />
            </Paper>
          ))}
        </RadioGroup>
      </DialogContent>

      <DialogActions>
        <Button onClick={onScarta}>Nessuno di questi</Button>
        <Button
          variant="contained"
          disabled={!candidatoScelto}
          onClick={() => candidatoScelto && onScegli(candidatoScelto)}
        >
          Usa selezionato
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificare che compili**

Run: `npx tsc --noEmit`
Expected: nessun errore.

- [ ] **Step 3: Commit**

```bash
git add src/components/technicalSheet/EquipmentMatchDialog.tsx
git commit -m "feat(matching): popup di scelta fra le voci di catalogo corrispondenti"
```

---

### Task 7: Integrazione nel pulsante fotocamera della riga

**Files:**
- Modify: `src/components/technicalSheet/table/UnifiedEquipmentTable.tsx`
  (`applyOcr` righe 127-154, `EqRowProps` righe 168-194, montaggio di `SingleOCRButton`
  riga 299, `selettoreCatalogo` righe 594-605)
- Modify: `src/components/technicalSheet/SingleOCRButton.tsx` (rimuovere il dialog di
  normalizzazione, righe 4-5, 71-75, 88-89, 138-200, 240-252)

**Interfaces:**
- Consuma: `matchEquipment` (Task 4), `useCatalogoPerTipo` (Task 5),
  `EquipmentMatchDialog` (Task 6), `selettoreCatalogo` (esistente).
- Produce: nessuna nuova interfaccia pubblica.

- [ ] **Step 1: Semplificare `SingleOCRButton`**

Il componente torna a fare una cosa sola: leggere il file e restituire i dati. Rimuovere
l'import di `NormalizationSuggestionDialog` e di `requiresNormalizationConfirmation`
(righe 4-5), l'interfaccia `NormalizationDialogData` (righe 71-75), gli stati
`showNormalizationDialog` e `normalizationData` (righe 88-89), gli handler
`handleNormalizationConfirm` e `handleNormalizationCancel` (righe 171-200) e il blocco JSX
del dialog (righe 240-252).

Il corpo di `handleFileChange` che oggi decide sulla normalizzazione (righe 138-165) diventa:

```tsx
    if (result.success && result.data) {
      onOCRComplete(result.data)
    }
```

- [ ] **Step 2: Sostituire `applyOcr` con un applicatore che passa dal matching**

In `UnifiedEquipmentTable.tsx`, `applyOcr` resta **invariata**: è ancora la strada del caso
C. Si aggiunge accanto, dentro il componente `EqRow`, la logica che decide se usarla.

`EqRowProps` guadagna una prop:

```ts
  /** Riceve i dati letti dalla targhetta e decide se agganciarli al catalogo. */
  onOcrLetto: (dati: OCRExtractedData) => void
```

e il montaggio del pulsante (riga 299) diventa:

```tsx
          <SingleOCRButton
            equipmentType={ocr.equipmentType}
            equipmentIndex={ocr.equipmentIndex}
            componentType={ocr.componentType}
            onOCRComplete={onOcrLetto}
          />
```

- [ ] **Step 3: Cablare matching e dialog nel componente tabella**

Nel corpo di `UnifiedEquipmentTable`, accanto a `selettoreCatalogo` (riga 594):

```tsx
  /** Targhetta in attesa di una decisione dell'operatore. */
  const [daScegliere, setDaScegliere] = useState<{
    datiOcr: OCRExtractedData
    candidati: Candidato[]
    motivo: MotivoAmbiguita
    def: EquipmentTypeDef
    base: string
    applica: (specs: Record<string, any>, item?: EquipmentCatalogItem) => void
  } | null>(null)

  /**
   * Dati appena letti da una targhetta: si tenta di ricondurli a una voce di catalogo.
   *
   * L'aggancio riusa `selettoreCatalogo`, lo stesso applicatore della selezione manuale:
   * è ciò che registra l'origine, e dall'origine dipendono la scomparsa del «+» e il
   * controllo di divergenza. Scrivere i valori a mano li lascerebbe orfani, che è
   * esattamente il difetto che questa modifica corregge.
   */
  const ocrLetto = (
    def: EquipmentTypeDef,
    base: string,
    applica: (specs: Record<string, any>, item?: EquipmentCatalogItem) => void,
    righeCatalogo: EquipmentCatalogItem[]
  ) => (dati: OCRExtractedData) => {
    const esito = matchEquipment(def.kind, dati, righeCatalogo)

    if (esito.esito === 'certo') {
      applicaCandidato(def, base, dati, esito.candidato, applica)
      return
    }
    if (esito.esito === 'ambiguo') {
      setDaScegliere({ datiOcr: dati, candidati: esito.candidati, motivo: esito.motivo, def, base, applica })
      return
    }
    applyOcr(def, base, dati, setValue)
  }

  /**
   * Applica la voce scelta e ci sovrascrive i dati propri dell'esemplare.
   *
   * Marca, modello e dati tecnici vengono dal catalogo; numero di fabbrica e anno stanno
   * sulla targhetta e solo lì — appartengono a quell'esemplare, non al modello.
   */
  const applicaCandidato = (
    def: EquipmentTypeDef,
    base: string,
    dati: OCRExtractedData,
    candidato: Candidato,
    applica: (specs: Record<string, any>, item?: EquipmentCatalogItem) => void
  ) => {
    setValue(`${base}.marca`, candidato.riga.marca)
    setValue(`${base}.modello`, candidato.riga.modello)
    applica((candidato.riga.specs ?? {}) as Record<string, any>, candidato.riga)
    if (dati.n_fabbrica) setValue(`${base}.n_fabbrica`, dati.n_fabbrica)
    if (dati.anno) setValue(`${base}.anno`, dati.anno)
    void equipmentCatalogApi.incrementUsage(candidato.riga.id)
  }
```

E il dialog, accanto a `UpdateCatalogDialog` (righe 1035-1043):

```tsx
      {daScegliere && (
        <EquipmentMatchDialog
          open
          datiOcr={daScegliere.datiOcr}
          candidati={daScegliere.candidati}
          motivo={daScegliere.motivo}
          onScegli={(c) => {
            applicaCandidato(daScegliere.def, daScegliere.base, daScegliere.datiOcr, c, daScegliere.applica)
            setDaScegliere(null)
          }}
          onScarta={() => {
            applyOcr(daScegliere.def, daScegliere.base, daScegliere.datiOcr, setValue)
            setDaScegliere(null)
          }}
        />
      )}
```

Le righe di catalogo arrivano da `useCatalogoPerTipi`, **una sola chiamata** nel corpo di
`UnifiedEquipmentTable`. Non va invocato dentro `EqRow`: quel componente è istanziato per
riga, e il numero di hook cambierebbe a ogni aggiunta o eliminazione di apparecchiatura —
che è precisamente ciò che le regole degli hook vietano.

```tsx
  /** I tipi che compaiono in questa tabella, stabili fra i render. */
  const tipiInTabella = useMemo(
    () => [...new Set(Object.values(EQUIPMENT_DEFS).map((d) => d.catalogType))],
    []
  )
  const catalogoPerTipo = useCatalogoPerTipi(tipiInTabella)
```

e la prop passata a ogni `EqRow`:

```tsx
  onOcrLetto={ocrLetto(def, base, selettoreCatalogo(def, base, rowKey, identita), catalogoPerTipo[def.catalogType] ?? [])}
```

- [ ] **Step 4: Verificare che compili e che la suite resti verde**

Run: `npx tsc --noEmit`
Expected: nessun errore.

Run: `npx vitest run`
Expected: 1099 test passati più quelli nuovi dei Task 1-4, 0 fallimenti.

- [ ] **Step 5: Commit**

```bash
git add src/components/technicalSheet/table/UnifiedEquipmentTable.tsx src/components/technicalSheet/SingleOCRButton.tsx
git commit -m "feat(matching): il pulsante fotocamera aggancia la targhetta al catalogo"
```

---

### Task 8: Integrazione nel batch

**Files:**
- Modify: `src/components/technicalSheet/TechnicalSheetForm.tsx`
  (`handleBatchOCRComplete`, righe 305-509)

**Interfaces:**
- Consuma: `matchEquipment` (Task 4), `caricaCatalogoPerTipo` (Task 5),
  `EquipmentMatchDialog` (Task 6).
- Produce: nessuna nuova interfaccia pubblica.

- [ ] **Step 1: Risolvere il matching prima di scrivere nel form**

`handleBatchOCRComplete` diventa asincrona e antepone una fase di riconciliazione. La
struttura attuale — ordinamento per `applyOrder`, scrittura per codice, `normalizeSchedaCodes`
e `reset` finale — **non cambia**: cambia solo che i dati scritti possono provenire dal
catalogo anziché dalla targhetta.

```tsx
  /** Esito del matching per ciascun file, risolto prima di toccare il form. */
  type DecisioneBatch = { item: BatchOCRItem; candidato: Candidato | null }

  const handleBatchOCRComplete = async (results: BatchOCRResult, items: BatchOCRItem[]) => {
    const completati = items.filter((i) => i.status === 'completed' && i.result?.data)

    // 1. Matching di tutte le targhette. I casi certi si risolvono qui; gli ambigui si
    //    accodano e vengono chiesti tutti insieme, invece di interrompere l'elaborazione
    //    una foto per volta.
    const decisioni: DecisioneBatch[] = []
    const daChiedere: { item: BatchOCRItem; candidati: Candidato[]; motivo: MotivoAmbiguita }[] = []

    for (const item of completati) {
      const tipo = item.parsedType as EquipmentCatalogType | null
      const kind = item.parsedComponentType === 'valvola_sicurezza'
        ? 'valvola'
        : tipo ? KIND_PER_CATALOG_TYPE[tipo] : undefined
      if (!kind || !tipo) { decisioni.push({ item, candidato: null }); continue }

      const righe = await caricaCatalogoPerTipo(queryClient, tipo)
      const esito = matchEquipment(kind, item.result!.data!, righe)

      if (esito.esito === 'certo') decisioni.push({ item, candidato: esito.candidato })
      else if (esito.esito === 'ambiguo') daChiedere.push({ item, candidati: esito.candidati, motivo: esito.motivo })
      else decisioni.push({ item, candidato: null })
    }

    // 2. Coda delle ambiguità: una scheda per volta, con l'indicazione del file.
    //    Chiudere a metà vale «nessuno di questi» per le rimanenti — i campi si compilano
    //    coi dati letti e non si perde nulla.
    const scelte = await risolviCoda(daChiedere)
    decisioni.push(...scelte)

    // 3. Scrittura nel form: unica, come prima.
    applicaDecisioniAlForm(decisioni)
  }
```

`KIND_PER_CATALOG_TYPE` è l'inverso di `EQUIPMENT_DEFS[k].catalogType`, da costruire una
volta in `equipmentConfig.ts`:

```ts
/** Da tipo di catalogo al `kind` che lo descrive. Inverso di `EQUIPMENT_DEFS[k].catalogType`. */
export const KIND_PER_CATALOG_TYPE = Object.fromEntries(
  Object.values(EQUIPMENT_DEFS).map((d) => [d.catalogType, d.kind])
) as Record<EquipmentCatalogType, EquipmentKind>
```

- [ ] **Step 1b: La coda delle ambiguità**

`risolviCoda` mostra il dialog una volta per ambiguità e restituisce le scelte solo quando
la coda è esaurita. Il ponte fra un dialog — che comunica per callback — e un `await` è una
promessa il cui `resolve` viene conservato in un ref:

```tsx
  /** Ambiguità in attesa di risposta, con il resolver della promessa che le sta aspettando. */
  const [coda, setCoda] = useState<{ item: BatchOCRItem; candidati: Candidato[]; motivo: MotivoAmbiguita }[]>([])
  const [posizione, setPosizione] = useState(0)
  const risoltoreCoda = useRef<((scelte: DecisioneBatch[]) => void) | null>(null)
  const scelteFinora = useRef<DecisioneBatch[]>([])

  /**
   * Presenta le ambiguità una per volta e si sblocca a coda esaurita.
   *
   * Chiudere il dialog a metà non annulla il batch: le targhette rimaste valgono «nessuno
   * di questi» e i loro campi si compilano coi dati letti, come se il catalogo non le
   * conoscesse. Nessun file viene perso per una finestra chiusa.
   */
  const risolviCoda = (
    ambigue: { item: BatchOCRItem; candidati: Candidato[]; motivo: MotivoAmbiguita }[]
  ): Promise<DecisioneBatch[]> => {
    if (ambigue.length === 0) return Promise.resolve([])
    scelteFinora.current = []
    setCoda(ambigue)
    setPosizione(0)
    return new Promise((resolve) => { risoltoreCoda.current = resolve })
  }

  /** Registra la decisione sulla targhetta corrente e passa alla successiva, o chiude. */
  const avanzaCoda = (candidato: Candidato | null) => {
    scelteFinora.current.push({ item: coda[posizione].item, candidato })
    const prossima = posizione + 1
    if (prossima < coda.length) { setPosizione(prossima); return }

    const scelte = scelteFinora.current
    setCoda([])
    setPosizione(0)
    risoltoreCoda.current?.(scelte)
    risoltoreCoda.current = null
  }
```

e il dialog, montato accanto agli altri in `TechnicalSheetForm`:

```tsx
      {coda.length > 0 && (
        <EquipmentMatchDialog
          open
          datiOcr={coda[posizione].item.result!.data!}
          candidati={coda[posizione].candidati}
          motivo={coda[posizione].motivo}
          origine={coda[posizione].item.filename}
          passo={{ corrente: posizione + 1, totale: coda.length }}
          onScegli={(c) => avanzaCoda(c)}
          onScarta={() => avanzaCoda(null)}
        />
      )}
```

- [ ] **Step 1c: La scrittura nel form**

`applicaDecisioniAlForm` è il corpo che oggi sta nelle righe 343-493 di
`handleBatchOCRComplete`, estratto in una funzione e con una sola differenza: itera su
`decisioni` invece che su `orderedItems`, e ricava `data` da `decisione.item.result.data`.
Restano identici — e vanno spostati senza modifiche — l'ordinamento `applyOrder`, la
risoluzione delle valvole per codice del proprietario, la risoluzione del padre per i tipi
dipendenti, il `mergeOcrData` sugli esistenti e la coppia finale
`normalizeSchedaCodes` + `reset`. L'ordinamento va applicato a `decisioni`:

```tsx
  const applicaDecisioniAlForm = (decisioni: DecisioneBatch[]) => {
    const skipped: string[] = []
    const ordinate = [...decisioni].sort((a, b) => applyOrder(a.item) - applyOrder(b.item))

    ordinate.forEach((decisione) => {
      const item = decisione.item
      // …corpo esistente delle righe 343-481, con `data = item.result!.data!` e il record
      //   costruito come allo Step 2…
    })

    const { scheda: normalized } = normalizeSchedaCodes(getValues())
    reset(normalized, { keepDirty: true })
  }
```

- [ ] **Step 2: Costruire il record da scrivere a partire dalla decisione**

Nel ciclo che oggi costruisce `newEquipment` (righe 412-426), quando la decisione porta un
candidato i valori vengono dal catalogo:

```tsx
      const specs = (decisione.candidato?.riga.specs ?? {}) as Record<string, any>
      const def = EQUIPMENT_DEFS[kind]

      const newEquipment: any = decisione.candidato
        ? {
            marca: decisione.candidato.riga.marca,
            modello: decisione.candidato.riga.modello,
            // Dati propri dell'esemplare: restano quelli letti.
            n_fabbrica: data.n_fabbrica || '',
            anno: data.anno || undefined,
            ...Object.fromEntries(
              Object.entries(def.specsMap)
                .map(([specKey, field]) => [field, readSpec(def.catalogType, specs, specKey)])
                .filter(([, v]) => v !== null)
            ),
          }
        : {
            marca: data.marca || '',
            modello: data.modello || '',
            n_fabbrica: data.n_fabbrica || '',
            anno: data.anno || undefined,
            volume: data.volume || undefined,
            pressione_max: data.pressione_max || undefined,
            materiale_n: data.materiale_n || undefined,
          }
```

- [ ] **Step 3: Aggiornare il riepilogo finale**

Nell'`alert()` di riepilogo (righe 496-506), sostituire la voce `Normalizzati` con il
conteggio degli agganci:

```tsx
      `Agganciate a catalogo: ${decisioni.filter((d) => d.candidato).length}\n` +
```

- [ ] **Step 4: Verificare che compili e che la suite resti verde**

Run: `npx tsc --noEmit`
Expected: nessun errore.

Run: `npx vitest run`
Expected: tutti verdi.

- [ ] **Step 5: Commit**

```bash
git add src/components/technicalSheet/TechnicalSheetForm.tsx src/components/technicalSheet/table/equipmentConfig.ts
git commit -m "feat(matching): il batch aggancia al catalogo e raccoglie le ambiguità a fine elaborazione"
```

---

### Task 9: Rimozione del codice sostituito

**Files:**
- Delete: `src/utils/equipmentNormalizer.ts`
- Delete: `src/components/technicalSheet/NormalizationSuggestionDialog.tsx`
- Modify: `src/hooks/useOCRAnalysis.ts` (rimuovere `normalizeOCRData` righe 172-212 e
  `requiresNormalizationConfirmation` righe 265-279, e la chiamata a riga 192)
- Modify: `src/services/api/equipmentCatalog.ts` (rimuovere `searchFuzzy`, riga 205)
- Modify: `supabase/functions/analyze-equipment-nameplate/index.ts` (rimuovere
  `searchFuzzyMatches` righe 371-400, la chiamata riga 174 e il campo `fuzzy_matches`)
- Create: `supabase/migrations/20260816000000_drop_search_equipment_fuzzy.sql`

- [ ] **Step 1: Verificare che non restino consumatori**

Run:
```bash
grep -rn "searchFuzzy\|normalizeEquipment\|requiresNormalizationConfirmation\|NormalizationSuggestionDialog\|marca_normalized\|modello_normalized" src/ supabase/
```
Expected: solo occorrenze nei file elencati sopra. Ogni altro riscontro va risolto prima di
cancellare.

- [ ] **Step 2: Rimuovere il codice**

Cancellare i due file, i metodi e le funzioni indicati. In `src/types/ocr.ts`, rimuovere i
campi `marca_normalized` e `modello_normalized` da `OCRExtractedData` (righe 92-93), e
`normalizedMarca`/`normalizedModello` da `BatchOCRItem` (righe 167-168), insieme a
`fuzzy_matches` da `OCRAnalysisResponse` (riga 38). `NormalizedField` e `FuzzyMatch` restano
solo se qualcosa li usa ancora: verificarlo con `grep` e cancellarli altrimenti.

- [ ] **Step 3: Scrivere la migrazione**

```sql
-- supabase/migrations/20260816000000_drop_search_equipment_fuzzy.sql
--
-- `search_equipment_fuzzy` è rotta da sempre in produzione: la RETURNS TABLE dichiara
-- `created_at TIMESTAMP` mentre la colonna è `TIMESTAMPTZ`, e ogni chiamata solleva
-- 42804 «structure of query does not match function result type». I due soli consumatori
-- — `equipmentCatalogApi.searchFuzzy` e `searchFuzzyMatches` nella edge function —
-- ricevevano quindi sempre l'errore, che veniva assorbito senza risultati.
--
-- Il matching della targhetta ora avviene lato client su `equipment_catalog` caricato per
-- tipo (`src/utils/equipmentMatcher/`), dove è coperto da test. La funzione non ha più
-- consumatori e viene eliminata invece che riparata.

DROP FUNCTION IF EXISTS search_equipment_fuzzy(TEXT, equipment_catalog_type, INTEGER);

-- Verifica: attesa 0 righe.
--   SELECT proname FROM pg_proc WHERE proname = 'search_equipment_fuzzy';
```

- [ ] **Step 4: Applicare la migrazione in produzione**

Via Management API con `curl` e `SUPABASE_ACCESS_TOKEN` da `.env.local` (`urllib` è bloccato
da Cloudflare — vedi `CLAUDE.md`). Il `project_ref` è la parte iniziale di
`VITE_SUPABASE_URL` (`https://<ref>.supabase.co`):

```sh
#!/bin/sh
# eseguire dalla radice del worktree
. ./.env.local
REF=$(printf '%s' "$VITE_SUPABASE_URL" | sed -e 's#https://##' -e 's#\.supabase\.co.*##')

curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"DROP FUNCTION IF EXISTS search_equipment_fuzzy(TEXT, equipment_catalog_type, INTEGER);"}'

echo
echo "--- verifica: attesa lista vuota ---"
curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT proname FROM pg_proc WHERE proname = '"'"'search_equipment_fuzzy'"'"';"}'
```

La verifica deve restituire `[]`. Non stampare mai il valore del token.

- [ ] **Step 5: Verificare che compili e che la suite resti verde**

Run: `npx tsc --noEmit && npx vitest run`
Expected: nessun errore, tutti i test verdi.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(matching): rimuove normalizzazione e RPC fuzzy sostituite dal matcher"
```

---

## Verifica finale prima del merge

- [ ] `npx vitest run` — tutti verdi, compresi i nuovi file del matcher
- [ ] `npx tsc --noEmit` — nessun errore
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Prova manuale sul singolo pulsante fotocamera: una targhetta SICC già a catalogo deve
      aprire il popup con le ragioni sociali, e alla scelta il «+» non deve comparire
- [ ] Prova manuale sul batch con più file
- [ ] `git fetch` e simulazione del merge con `git merge-tree` contro `origin/main`
      aggiornato, prima di pubblicare — sono attivi altri worktree, fra cui
      `rifiniture-dich-valvole-ocr-pdf`, che tocca la stessa area OCR
