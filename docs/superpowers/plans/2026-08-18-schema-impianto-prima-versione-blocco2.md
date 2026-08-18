# Schema d'impianto DM329 — Blocco 2: le convenzioni senza by-pass

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: `superpowers:subagent-driven-development` (consigliata)
> oppure `superpowers:executing-plans`, task per task. I passi usano caselle (`- [ ]`).

**Obiettivo:** la prima versione generata dello schema riproduce il disegno di riferimento
`DOCUMENTAZIONE/relazione/no byass.png` — linea di processo dritta e allineata all'uscita del
serbatoio, stadi adiacenti, mandata compressore agganciata in basso con la valvola sotto la
dorsale, valvole di riserva ai due capi, condense dal flag dell'operatore.

**Architettura:** il modello dichiara l'*intento* (quale ancora, quale valvola, dove sta rispetto
ai vertici), il layout lo traduce in geometria. Le istruzioni `ancoraggio` viaggiano da
`buildSchemaModel` a `layoutSchema` e **non tornano indietro**: il layout le consuma, scrive `t`
numeriche e le toglie. Il formato salvato non cambia di un byte, e `renderSvg`, `conversioneFlow`,
`SchemaEdgeTubazione`, `useSegniTubo` e la serializzazione non si toccano.

**Stack:** TypeScript (strict=false), Vitest, nessuna libreria nuova.

**Specifica:** `docs/superpowers/specs/2026-08-17-schema-impianto-prima-versione-design.md`
**Consegna:** `docs/superpowers/2026-08-18-prossima-sessione-schema-prima-versione.md`
**Riferimenti visivi:** `DOCUMENTAZIONE/relazione/no byass.png` (questo blocco) e
`DOCUMENTAZIONE/relazione/si bypass.png` (Blocco 3). Attenzione al nome del primo: `byass`, non
`bypass` — è un refuso del committente, non correggerlo qui o i link nei documenti si rompono.

**Ramo:** `worktree-schema-prima-versione-blocco1`, worktree
`.claude/worktrees/schema-prima-versione-blocco1`. Il Blocco 2 continua su questo ramo; il merge
simulato si fa alla fine del Blocco 3, non prima.

## Vincoli globali

- **`.env.local` va copiato a mano nel worktree** (è git-ignored) o un file di test fallisce per
  variabili d'ambiente mancanti. Fatto: verificarlo prima di credere a un baseline rosso.
- **Baseline misurato il 18-08-2026 sul commit `68a1d80`: 1353 test verdi, 99 file, `tsc` pulito.**
  Ogni task chiude con questo numero salito o uguale, mai sceso.
- **Il gate, a ogni task:**
  ```
  npx vitest run
  npx tsc --noEmit
  npx eslint <percorsi toccati>
  ```
  Niente `prettier --write`. **Il conto dei warning eslint non è zero ovunque: è «non uno più di
  prima»** — `src/services/schemaImpianto` 0, `src/components/schemaImpianto` 3 (preesistenti),
  `services/relazione` + `components/relazione` + `pages/TechnicalDetails.tsx` +
  `utils/equipmentCodes.ts` 18. Un `--max-warnings 0` su quei percorsi fallisce anche senza toccarli.
- **Nessun test di interfaccia.** La logica provabile va in servizi e hook (`CLAUDE.md`).
- **Un test che fallisce solo perché il modulo non esiste ancora non l'hai visto fallire per la
  ragione giusta.** Dopo il verde, rompi apposta la logica e guarda quali cadono. È la classe di
  difetto numero uno di questo modulo.
- **`GIOCO_FRA_STADI = 0`** in questo blocco. Il valore definitivo si chiude nel Blocco 4,
  guardando il disegno: i rombi portano codoli da 10 unità che sporgono *fuori* dal riquadro
  (`symbols/index.ts:630-632`), quindi a gioco 0 il codolo destro di ogni stadio entra di 10 unità
  nella punta del vicino. Se il disegno lo mostra, il valore giusto è 20 (i codoli si toccano e
  formano il collegamento).
- **L'arco si emette sempre**, anche degenere (lunghezza nulla fra stadi adiacenti): è il tessuto
  che ripara il disegno appena l'operatore separa i due nodi. E **non gli si mette mai un segno**.
- **`t` di ripiego.** Ogni segno ancorato nasce con `t: 0.5`. Se il risolutore torna `null`, la
  valvola compare a metà tubo: sbagliata ma visibile e correggibile. Degradazione voluta, mai
  un'eccezione.
- **Perdere i layout salvati di ORVED e LOWA R&D è accettato** (committente, 18-08-2026). Cade la
  verifica byte-per-byte su quelle pratiche. **`002 test` (`fed244ee`) è la pratica per le prove.**

## I file toccati

| File | Responsabilità dopo il blocco |
|---|---|
| `src/services/schemaImpianto/buildSchemaModel.ts` | esporta `scaricaCondensa`; riceve `PreferenzeRisolte` e `Tarature`; semina gli ancoraggi |
| `src/services/schemaImpianto/preferenze.ts` | `risolviPreferenze` senza parametro di default; `preferenzeRisolteDaScheda` — l'unico ingresso per chi parte dalla scheda |
| `src/services/schemaImpianto/layout.ts` | `catenaDagliArchi`, `pozzoCondense` robusto, linea di processo per ancore, `GIOCO_FRA_STADI` |
| `src/services/schemaImpianto/segniAncorati.ts` | **nuovo** — risolve gli ancoraggi in `t` e li toglie; ultimo passo di `layoutSchema` |
| `src/components/relazione/PannelloPreferenzeSchema.tsx` | usa `preferenzeRisolteDaScheda`: la spunta mostrata è quella che il disegno rispetterà |
| `src/components/relazione/SchemaImpiantoSection.tsx` | legge `schemaPreferenze`, le risolve e le passa al generatore in tutti e due i punti |
| `__tests__/fixtures/svgRiferimentoSenzaTesti.ts`, `…ConMuro.ts` | rigenerate in T4 e T6, col diff letto e annotato |

**`svgRiferimentoConTee` non deve cambiare mai in questo blocco**: costruisce il layout a mano e
non passa da `buildSchemaModel`. Se cambia, **fermarsi**: vuol dire aver toccato i simboli o
l'instradamento, che questo blocco non tocca.

---

## Task 1: il debito — una sola regola per le condense

Oggi `PannelloPreferenzeSchema` passa `() => true` come regola di default e il generatore usa
`scaricaCondensa`, privata in `buildSchemaModel.ts:215-218`. Sono due regole diverse per la stessa
domanda: la spunta mostrata all'operatore mente sul disegno che uscirà. Un compressore a pistoni
senza disoleatore compare spuntato nel pannello e non scarica nel disegno.

Il difetto non si chiude esportando la funzione e basta: `famiglieDaScheda` costruisce nodi
*leggeri* (`nodoLeggero`) **senza `accessorio`**, e `scaricaCondensa` legge proprio
`nodo.accessorio` per decidere sul compressore. Passata così com'è ai nodi leggeri, direbbe «nessun
compressore scarica» — un secondo modo di mentire. Serve che la famiglia porti l'informazione.

**Files:**
- Modify: `src/services/schemaImpianto/buildSchemaModel.ts:213-218` (esportare `scaricaCondensa`)
- Modify: `src/services/schemaImpianto/preferenze.ts:78-113` (`famiglieDaScheda`), `:156-190`
  (`risolviPreferenze`)
- Modify: `src/components/relazione/PannelloPreferenzeSchema.tsx:160-164`
- Test: `src/services/schemaImpianto/__tests__/preferenze.test.ts`

**Interfacce:**
- Produce: `scaricaCondensa(nodo: SchemaNodo): boolean` esportata da `buildSchemaModel.ts`;
  `risolviPreferenze(preferenze: SchemaPreferenze | undefined, famiglie: FamiglieSchema):
  PreferenzeRisolte` (**il terzo parametro sparisce**);
  `preferenzeRisolteDaScheda(scheda: SchedaDatiCompleta, preferenze: SchemaPreferenze | undefined):
  PreferenzeRisolte`.
- Consuma: `famiglieDaScheda`, `SchemaNodo`, `SchedaDatiCompleta` già esistenti.

- [ ] **Passo 1: scrivere il test che fallisce**

In `preferenze.test.ts`, in coda al file, un `describe` nuovo. Il test centrale confronta chi il
pannello mostra spuntato con chi il generatore collega davvero al pozzo — non una funzione con se
stessa:

Gli helper di scheda ci sono già: `makeScheda`, `makeCompressore`, `makeDisoleatore`,
`makeSerbatoio`, `makeFiltro`, `makeDatiImpianto` da `@/services/relazione/__tests__/fixtures`.
Usarli, non costruire letterali con `as unknown as SchedaDatiCompleta`.

```ts
import { makeCompressore, makeDatiImpianto, makeDisoleatore, makeFiltro, makeScheda, makeSerbatoio } from '@/services/relazione/__tests__/fixtures'
import { buildSchemaModel, scaricaCondensa } from '../buildSchemaModel'
import { famiglieDaScheda, preferenzeRisolteDaScheda } from '../preferenze'

describe('la regola di default delle condense è una sola', () => {
  /** Due compressori, uno solo col disoleatore da cui la condensa esce davvero. */
  const schedaDueCompressori = () =>
    makeScheda({
      compressori: [
        makeCompressore({ codice: 'C1', ha_disoleatore: true }),
        makeCompressore({ codice: 'C2', ha_disoleatore: false }),
      ],
      disoleatori: [makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' })],
      serbatoi: [makeSerbatoio({ codice: 'S1', ubicazione: 'SALA_COMPRESSORI' })],
      filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
    })

  it('la famiglia porta il disoleatore, o la regola non saprebbe su cosa decidere', () => {
    const famiglie = famiglieDaScheda(schedaDueCompressori())
    expect(famiglie.compressori.find((n) => n.id === 'C1')?.accessorio?.codice).toBe('C1.1')
    expect(famiglie.compressori.find((n) => n.id === 'C2')?.accessorio).toBeUndefined()
  })

  it('chi il pannello mostra spuntato è chi il generatore collega al pozzo', () => {
    const scheda = schedaDueCompressori()
    const risolte = preferenzeRisolteDaScheda(scheda, undefined)

    const model = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'] } })
    const collegati = new Set(
      model.archi.filter((a) => a.stile === 'condensa').map((a) => a.da.nodo)
    )

    expect([...risolte.condense].sort()).toEqual([...collegati].sort())
    // E in concreto: C2 non ha disoleatore, quindi non compare da nessuna delle due parti.
    expect(risolte.condense.has('C1')).toBe(true)
    expect(risolte.condense.has('C2')).toBe(false)
  })

  it('la scelta esplicita dell operatore vince sulla regola', () => {
    const scheda = schedaDueCompressori()
    const risolte = preferenzeRisolteDaScheda(scheda, { condense: { C1: false, C2: true } })
    expect(risolte.condense.has('C1')).toBe(false)
    expect(risolte.condense.has('C2')).toBe(true)
  })
})
```

- [ ] **Passo 2: eseguirlo e vederlo fallire**

```
npx vitest run src/services/schemaImpianto/__tests__/preferenze.test.ts
```
Atteso: FAIL — `preferenzeRisolteDaScheda is not a function` e `scaricaCondensa` non esportata.

- [ ] **Passo 3: l'implementazione minima**

In `buildSchemaModel.ts`, cambiare `function scaricaCondensa` in `export function scaricaCondensa`
e allungare il commento che ha già sopra:

```ts
/**
 * Nodi che scaricano condensa nel pozzo di raccolta. Sul compressore la condensa esce dal
 * disoleatore, quindi un compressore che non ne ha (tipicamente a pistoni) resta escluso.
 *
 * Esportata dal 18-08-2026: è la regola di DEFAULT che il pannello delle preferenze mostra
 * spuntata quando l'operatore non ha ancora scelto (`risolviPreferenze`). Una seconda regola
 * scritta nel componente — `() => true`, quella del Blocco 1 — faceva mentire la spunta sul
 * disegno che sarebbe uscito.
 */
export function scaricaCondensa(nodo: SchemaNodo): boolean {
```

In `preferenze.ts`, dare l'accessorio ai compressori leggeri. `nodoLeggero` accetta già un `extra`:

```ts
  const compressori = (scheda.compressori ?? []).map((c) => {
    // Solo la PRESENZA del disoleatore, non la sua etichetta: `scaricaCondensa` legge
    // `Boolean(nodo.accessorio)` e nient'altro. Senza questo campo la regola condivisa
    // risponderebbe «nessun compressore scarica» sui nodi leggeri, cioè mentirebbe al
    // contrario di come mentiva `() => true`.
    const diso = (scheda.disoleatori ?? []).find((d) => d.compressore_associato === c.codice)
    return nodoLeggero(c.codice, 'compressore', 'Compressore', c.marca, {
      accessorio: diso ? { codice: diso.codice, etichetta: 'Serbatoio disoleatore', valvoleSicurezza: [] } : undefined,
    })
  })
```

Togliere il terzo parametro da `risolviPreferenze` e cablarci `scaricaCondensa`:

```ts
import { ordinaCatenaTrattamento, scaricaCondensa } from './buildSchemaModel'

export function risolviPreferenze(
  preferenze: SchemaPreferenze | undefined,
  famiglie: FamiglieSchema
): PreferenzeRisolte {
```
e alla riga della scelta:
```ts
    if (typeof scelta === 'boolean' ? scelta : scaricaCondensa(nodo)) condense.add(nodo.id)
```

In coda a `preferenze.ts`, l'ingresso unico:

```ts
/**
 * Le preferenze che valgono adesso, partendo dalla scheda. **L'unico ingresso** per chi ha in
 * mano una scheda: pannello e generatore devono passare di qui, o le due strade tornerebbero a
 * divergere sul default delle condense — è il difetto che il Blocco 1 aveva lasciato aperto.
 */
export function preferenzeRisolteDaScheda(
  scheda: SchedaDatiCompleta,
  preferenze: SchemaPreferenze | undefined
): PreferenzeRisolte {
  return risolviPreferenze(preferenze, famiglieDaScheda(scheda))
}
```

Nel pannello, `PannelloPreferenzeSchema.tsx`, togliere il commento sul debito e le due `useMemo`
separate:

```ts
  const famiglie = useMemo(() => famiglieDaScheda(scheda), [scheda])
  const risolte = useMemo(() => preferenzeRisolteDaScheda(scheda, preferenze), [scheda, preferenze])
```
(`famiglie` serve ancora per `perId` e per gli elenchi: resta.)

- [ ] **Passo 4: adeguare le 16 chiamate esistenti**

`preferenze.test.ts` chiama `risolviPreferenze` con tre argomenti in 16 punti. Togliere il terzo
argomento a tutte. **Dove il terzo argomento era una regola finta** (`() => false`, `() => true`),
il test cambia significato: leggerlo e decidere se l'atteso va aggiornato o se quel test va
riscritto su `condense` esplicite invece che sul default. Non aggiustare l'atteso per far tornare
il verde.

- [ ] **Passo 5: eseguire il gate**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto src/components/relazione/PannelloPreferenzeSchema.tsx
```
Atteso: verde, test ≥ 1353 + 3.

- [ ] **Passo 6: verificare che i test mordano**

In `scaricaCondensa`, cambiare a mano `return Boolean(nodo.accessorio)` in `return true` e
rieseguire `preferenze.test.ts`: deve cadere «chi il pannello mostra spuntato…». Rimettere a posto.

- [ ] **Passo 7: commit**

```bash
git add src/services/schemaImpianto/buildSchemaModel.ts src/services/schemaImpianto/preferenze.ts \
        src/components/relazione/PannelloPreferenzeSchema.tsx \
        src/services/schemaImpianto/__tests__/preferenze.test.ts
git commit -m "fix(schema): la spunta delle condense nel pannello è la stessa regola del disegno"
```

---

## Task 2: la sequenza della linea si legge dagli archi

`layoutSchema` ri-deriva l'ordine della catena con `ordinaCatenaTrattamento` (layout.ts:205).
Quella funzione non conosce né le preferenze né le giunzioni: dal Task 6 in poi il modello potrà
collegare gli stadi in un ordine e il layout disporli in un altro — cioè un disegno con le linee
incrociate. L'ordine si legge da **chi gli archi collegano**.

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts` (nuova `catenaDagliArchi`, usata in `layoutSchema:205`)
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts`

**Interfacce:**
- Produce: `catenaDagliArchi(model: SchemaModel, pozzo: SchemaNodo | null): SchemaNodo[]`.
- Consuma: `ordinaCatenaTrattamento` (resta, come ripiego e come ordine di default del modello),
  `pozzoCondense`.

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
describe('catenaDagliArchi', () => {
  const stadio = (id: string, tipo: SchemaNodo['tipo'] = 'filtro'): SchemaNodo => ({
    id, tipo, etichetta: id, gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda',
  })
  const aria = (da: string, a: string): SchemaArco => ({
    id: `${da}-${a}`, da: { nodo: da, ancora: 'dx' }, a: { nodo: a, ancora: 'sx' }, stile: 'standard',
  })

  it('segue gli archi, non il rango per tipo', () => {
    // Ordine per rango: prefiltro, essiccatore, filtro → F1, E1, F2. Gli archi dicono altro.
    const model: SchemaModel = {
      nodi: [
        { ...stadio('F1'), prefiltro: true }, stadio('E1', 'essiccatore'), stadio('F2'),
        { id: 'S1', tipo: 'serbatoio', etichetta: 'S1', gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda' },
      ],
      archi: [aria('S1', 'F2'), aria('F2', 'E1'), aria('E1', 'F1'), aria('F1', 'UTENZE')],
    }
    expect(catenaDagliArchi(model, null).map((n) => n.id)).toEqual(['F2', 'E1', 'F1'])
  })

  it('non gira in tondo su un grafo ciclico', () => {
    const model: SchemaModel = {
      nodi: [stadio('F1'), stadio('F2'), { id: 'S1', tipo: 'serbatoio', etichetta: 'S1', gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda' }],
      archi: [aria('S1', 'F1'), aria('F1', 'F2'), aria('F2', 'F1')],
    }
    expect(catenaDagliArchi(model, null).map((n) => n.id)).toEqual(['F1', 'F2'])
  })

  it('appende in coda gli stadi che gli archi non raggiungono, nell ordine di default', () => {
    // F3 è scollegato: senza il ripiego sparirebbe dal disegno, che è peggio di un ordine strano.
    const model: SchemaModel = {
      nodi: [stadio('F1'), stadio('F3'), { id: 'S1', tipo: 'serbatoio', etichetta: 'S1', gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda' }],
      archi: [aria('S1', 'F1')],
    }
    expect(catenaDagliArchi(model, null).map((n) => n.id)).toEqual(['F1', 'F3'])
  })

  it('il pozzo di raccolta resta fuori dalla linea', () => {
    const pozzo = stadio('SEP1', 'separatore')
    const model: SchemaModel = {
      nodi: [stadio('F1'), pozzo, { id: 'S1', tipo: 'serbatoio', etichetta: 'S1', gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda' }],
      archi: [aria('S1', 'F1'), { id: 'c1', da: { nodo: 'F1', ancora: 'basso-out' }, a: { nodo: 'SEP1', ancora: 'sx' }, stile: 'condensa' }],
    }
    expect(catenaDagliArchi(model, pozzo).map((n) => n.id)).toEqual(['F1'])
  })
})
```

- [ ] **Passo 2: eseguirlo e vederlo fallire**

```
npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts -t catenaDagliArchi
```
Atteso: FAIL — `catenaDagliArchi is not a function`.

- [ ] **Passo 3: l'implementazione**

In `layout.ts`, subito sopra `layoutSchema`:

```ts
/**
 * La sequenza della linea di processo, letta da CHI GLI ARCHI COLLEGANO e non ri-derivata per
 * rango di tipo. `ordinaCatenaTrattamento` non conosce le preferenze dell'operatore né le
 * giunzioni di un by-pass: dal 18-08-2026 il modello può collegare gli stadi in un ordine che
 * quella funzione non saprebbe riprodurre, e disporli con due regole diverse significa disegnare
 * le linee incrociate. Resta l'ordine di DEFAULT dentro `buildSchemaModel`, che è il posto dove
 * un ordine va deciso; qui si legge quello deciso.
 *
 * Si parte dal serbatoio di testa e si seguono gli archi d'aria. Il `visto` non è una cautela di
 * stile: un layout riaperto e ricollegato a mano nell'editor può contenere un ciclo, e senza si
 * girerebbe in tondo per sempre.
 *
 * Gli stadi che gli archi non raggiungono si appendono in coda nell'ordine di default: uno stadio
 * scollegato (l'operatore ha cancellato una tubazione) è meglio disegnarlo in fondo che non
 * disegnarlo affatto.
 */
export function catenaDagliArchi(model: SchemaModel, pozzo: SchemaNodo | null): SchemaNodo[] {
  const perId = new Map(model.nodi.map((n) => [n.id, n]))
  const inLinea = (n: SchemaNodo): boolean =>
    n.id !== pozzo?.id &&
    (n.tipo === 'essiccatore' || n.tipo === 'filtro' || n.tipo === 'separatore' || n.tipo === 'giunzione')

  const successore = new Map<string, string>()
  for (const arco of model.archi) {
    // Solo l'aria: le condense corrono su una rete propria e non dicono nulla sull'ordine
    // della linea. Il primo vince — con due uscite dallo stesso nodo il disegno è comunque
    // ambiguo, e sceglierne una in silenzio è meglio che fermarsi.
    if (arco.stile === 'condensa') continue
    if (!successore.has(arco.da.nodo)) successore.set(arco.da.nodo, arco.a.nodo)
  }

  const serbatoioDiTesta = model.nodi.find((n) => n.tipo === 'serbatoio')
  const catena: SchemaNodo[] = []
  const visto = new Set<string>()
  let corrente = serbatoioDiTesta ? successore.get(serbatoioDiTesta.id) : undefined
  while (corrente && !visto.has(corrente)) {
    visto.add(corrente)
    const nodo = perId.get(corrente)
    if (nodo && inLinea(nodo)) catena.push(nodo)
    corrente = successore.get(corrente)
  }

  const presi = new Set(catena.map((n) => n.id))
  const orfani = ordinaCatenaTrattamento(model.nodi, pozzo).filter((n) => !presi.has(n.id))
  return [...catena, ...orfani]
}
```

In `layoutSchema`, sostituire la riga 205:
```ts
  const catena = catenaDagliArchi(model, pozzo)
```

- [ ] **Passo 4: eseguire il gate**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto
```
Atteso: verde. **Le tre fixture SVG non devono cambiare**: per il modello di oggi gli archi
seguono già `ordinaCatenaTrattamento`, quindi il risultato è identico. Se una cambia, il refactor
non è a comportamento invariato — fermarsi e capire perché.

- [ ] **Passo 5: verificare che i test mordano**

Rimettere `ordinaCatenaTrattamento(model.nodi, pozzo)` al posto della chiamata nuova dentro
`layoutSchema` e rieseguire: «segue gli archi, non il rango per tipo» deve cadere. Rimettere.

- [ ] **Passo 6: commit**

```bash
git add src/services/schemaImpianto/layout.ts src/services/schemaImpianto/__tests__/layout.test.ts
git commit -m "refactor(schema): l'ordine della linea si legge dagli archi, non dal rango per tipo"
```

---

## Task 3: il pozzo di raccolta non dipende più dal ricevere condensa

`pozzoCondense` (layout.ts:35-53) riconosce un separatore come pozzo solo se *riceve* condensa. Col
flag per apparecchiatura l'operatore può spegnerle tutte: il separatore non riceverebbe più nulla,
`pozzoCondense` tornerebbe `null`, e `catenaDagliArchi` (Task 2) lo prenderebbe fra gli orfani
trascinandolo dentro la catena di trattamento — un'apparecchiatura che salta dalla corsia bassa
alla linea di processo perché è stata tolta una spunta. Difetto reso raggiungibile dal Blocco 1.

La regola diventa: **è pozzo se nessun arco d'aria lo tocca**.

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts:29-53`
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts`

**Interfacce:**
- Produce: `toccatoDaAria(id: string, model: Pick<SchemaModel, 'archi'>): boolean` esportata;
  `pozzoCondense` invariata nella firma.
- `riceveSoloCondensa` sparisce se non ha altri chiamanti — verificarlo con
  `grep -rn "riceveSoloCondensa" src/` prima di toglierla.

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
describe('pozzoCondense quando le condense sono tutte spente', () => {
  const sep: SchemaNodo = { id: 'SEP1', tipo: 'separatore', etichetta: 'SEP1', gruppo: 'LINEA_DISTRIBUZIONE', valvoleSicurezza: [], origine: 'scheda' }
  const s1: SchemaNodo = { id: 'S1', tipo: 'serbatoio', etichetta: 'S1', gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda' }

  it('resta il pozzo anche se non riceve più nulla', () => {
    // L'operatore ha tolto ogni spunta: il separatore non ha più archi entranti. Prima del
    // 18-08-2026 tornava null e il separatore finiva in mezzo alla linea di processo.
    const model = { nodi: [sep, s1], archi: [{ id: 'ut', da: { nodo: 'S1', ancora: 'dx' }, a: { nodo: 'UTENZE', ancora: 'in' }, stile: 'standard' as const }] }
    expect(pozzoCondense(model.nodi, model)?.id).toBe('SEP1')
  })

  it('non è il pozzo se l aria lo attraversa, cioè se è uno stadio di linea', () => {
    const model = {
      nodi: [sep, s1],
      archi: [
        { id: 'a1', da: { nodo: 'S1', ancora: 'dx' }, a: { nodo: 'SEP1', ancora: 'sx' }, stile: 'standard' as const },
        { id: 'c1', da: { nodo: 'S1', ancora: 'basso-out' }, a: { nodo: 'SEP1', ancora: 'sx' }, stile: 'condensa' as const },
      ],
    }
    expect(pozzoCondense(model.nodi, model)).toBeNull()
  })

  it('un arco d aria USCENTE basta a escluderlo, non solo uno entrante', () => {
    const model = {
      nodi: [sep, s1],
      archi: [{ id: 'a1', da: { nodo: 'SEP1', ancora: 'dx' }, a: { nodo: 'UTENZE', ancora: 'in' }, stile: 'standard' as const }],
    }
    expect(pozzoCondense(model.nodi, model)).toBeNull()
  })
})
```

- [ ] **Passo 2: eseguirlo e vederlo fallire**

```
npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts -t "condense sono tutte spente"
```
Atteso: FAIL sul primo (torna `null`) e sul terzo (nessun arco entrante → oggi lo direbbe pozzo).

- [ ] **Passo 3: l'implementazione**

Sostituire `riceveSoloCondensa` con:

```ts
/**
 * Vero se una tubazione d'aria tocca il nodo, in entrata o in uscita. È il criterio con cui si
 * distingue un separatore che TRATTA l'aria di linea da uno che RACCOGLIE condensa.
 *
 * Fino al 18-08-2026 il criterio era «riceve solo condensa», che guarda gli archi entranti: col
 * flag per apparecchiatura l'operatore può spegnere ogni scarico, e un pozzo senza più archi
 * entranti smetteva di essere riconosciuto — finendo trascinato dentro la catena di trattamento,
 * in disaccordo con gli archi. Guardare l'aria invece della condensa è la stessa domanda posta
 * dalla parte che non dipende dalle spunte.
 *
 * Il caso limite noto: un separatore di linea a cui l'operatore stacca a mano, nell'editor, tutte
 * e due le tubazioni d'aria diventa un pozzo, e la corsia condense si riquota su di lui. È un
 * disegno già incoerente di suo, e la lettura scelta è quella che non dipende da una spunta.
 */
export function toccatoDaAria(id: string, model: Pick<SchemaModel, 'archi'>): boolean {
  return model.archi.some((a) => a.stile !== 'condensa' && (a.da.nodo === id || a.a.nodo === id))
}
```
e in `pozzoCondense`:
```ts
    nodi.find((n) => n.tipo === 'tanica' || (n.tipo === 'separatore' && !toccatoDaAria(n.id, archi))) ??
```

- [ ] **Passo 4: eseguire il gate**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto
```
Atteso: verde, fixture invariate. Se `riceveSoloCondensa` era importata altrove, aggiornare quei
punti invece di lasciare la funzione morta.

- [ ] **Passo 5: verificare che i test mordano**

Rimettere `!toccatoDaAria(...)` a `riceveSoloCondensa(...)` e rieseguire: devono cadere il primo e
il terzo test. Rimettere.

- [ ] **Passo 6: commit**

```bash
git add src/services/schemaImpianto/layout.ts src/services/schemaImpianto/__tests__/layout.test.ts
git commit -m "fix(schema): il pozzo condense si riconosce dall'aria che non lo tocca, non dalle spunte"
```

---

## Task 4: la linea di processo si dispone per ancore

Oggi la catena si dispone per riquadri (`disponiInRiga`): passo `larghezza + PASSO_ORIZZONTALE` =
110 + 60 = 170, e ogni nodo centrato su `yCentroSerbatoi`. Ne escono due difetti che l'operatore
corregge a mano su ogni pratica: gli stadi sono staccati (nei riferimenti si toccano, passo 100) e
la linea nasce con un gomito, perché l'ancora `sx` del primo stadio sta 55 unità sotto l'ancora
`dx` del serbatoio.

Le due convenzioni sono la stessa cosa detta due volte: **si dispone per ancore**. L'ancora `sx` di
ogni stadio cade sulla quota della linea; l'avanzamento è `ancoraDx.x − ancoraSxProssimo.x + gioco`.

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts:176-260` (`disponiInRiga` resta per compressori,
  serbatoi e raccolta; nuova `disponiCatenaPerAncore`; `layoutSchema`)
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts`
- Rigenerare: `__tests__/fixtures/svgRiferimentoSenzaTesti.ts`, `__tests__/fixtures/svgRiferimentoConMuro.ts`

**Interfacce:**
- Produce: `GIOCO_FRA_STADI` (esportata, valore `0`); `quotaLineaProcesso(serbatoi:
  SchemaNodoPosizionato[], ripiego: number, libreria: Tarature): number`.
- Consuma: `ancoraDi` da `./symbols`, `catenaDagliArchi` (Task 2).

- [ ] **Passo 1: scrivere il test che fallisce**

L'helper `schedaConTreStadi` va scritto una volta in `layout.test.ts`, accanto a `schedaTrePiuUno`,
e riusato dal Task 6 (importandolo, o duplicandolo se i due file non condividono già helper —
verificare come fa `schedaTrePiuUno` oggi):

```ts
/** Un compressore, un serbatoio verticale, tre stadi: il caso minimo con una linea di processo. */
function schedaConTreStadi() {
  return makeScheda({
    compressori: [makeCompressore({ codice: 'C1' })],
    disoleatori: [makeDisoleatore({ codice: 'C1.1', compressore_associato: 'C1' })],
    serbatoi: [makeSerbatoio({ codice: 'S1', orientamento: 'VERTICALE' })],
    filtri: [makeFiltro({ codice: 'F1', tipo: 'PREFILTRO' }), makeFiltro({ codice: 'F2', tipo: 'LINEA' })],
    essiccatori: [makeEssiccatore({ codice: 'E1' })],
    dati_impianto: makeDatiImpianto({ raccolta_condense: 'tanica' }),
  })
}
```
Verificare col tipo `Filtro` che `'LINEA'` sia il valore giusto per un filtro non prefiltro
(`grep -n "PREFILTRO" src/types/technicalSheet.ts`): l'unica cosa che conta è che **non** sia
`PREFILTRO`, così `ordinaCatenaTrattamento` produce F1 → E1 → F2.

```ts
describe('la linea di processo si dispone per ancore', () => {
  const scheda = schedaConTreStadi()
  const layout = () => layoutSchema(buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi: { C1: ['S1'] } }))

  it('l ancora sx di ogni stadio sta sulla quota dell ancora dx del serbatoio', () => {
    const l = layout()
    const serbatoio = l.nodi.find((n) => n.tipo === 'serbatoio')!
    const quota = posizioneAncora(serbatoio, 'dx').y
    for (const stadio of l.nodi.filter((n) => n.tipo === 'filtro' || n.tipo === 'essiccatore')) {
      expect(posizioneAncora(stadio, 'sx').y).toBe(quota)
    }
  })

  it('l ancora dx di uno stadio coincide con l ancora sx del successivo', () => {
    const l = layout()
    const stadi = l.nodi.filter((n) => n.tipo === 'filtro' || n.tipo === 'essiccatore')
    expect(stadi.length).toBeGreaterThan(1)
    for (let i = 0; i < stadi.length - 1; i++) {
      expect(posizioneAncora(stadi[i + 1], 'sx').x).toBe(posizioneAncora(stadi[i], 'dx').x + GIOCO_FRA_STADI)
    }
  })

  it('il terminale utenze sta sulla stessa quota, così la linea vi entra dritta', () => {
    const l = layout()
    const serbatoio = l.nodi.find((n) => n.tipo === 'serbatoio')!
    const utenze = l.nodi.find((n) => n.tipo === 'utenze')!
    expect(posizioneAncora(utenze, 'in').y).toBe(posizioneAncora(serbatoio, 'dx').y)
  })

  it('senza serbatoi la quota ripiega su quella di prima, invece di sollevare', () => {
    const model: SchemaModel = { nodi: [{ id: 'F1', tipo: 'filtro', etichetta: 'F1', gruppo: 'SALA_COMPRESSORI', valvoleSicurezza: [], origine: 'scheda' }], archi: [] }
    expect(() => layoutSchema(model)).not.toThrow()
    expect(layoutSchema(model).nodi[0].y).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Passo 2: eseguirlo e vederlo fallire**

```
npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts -t "per ancore"
```
Atteso: FAIL — quota sfalsata di 55 unità e passo 170 invece di 100.

- [ ] **Passo 3: l'implementazione**

In `layout.ts`, accanto alle altre costanti di passo:

```ts
/**
 * Spazio fra l'ancora `dx` di uno stadio e l'ancora `sx` del successivo. **Zero**: il committente
 * vuole le ancore coincidenti (passo 100 invece dei 170 di prima, convenzione 3).
 *
 * Da guardare nel Blocco 4, non da decidere qui: i rombi portano codoli da 10 unità che sporgono
 * fuori dal riquadro (`simboloRombo`, symbols/index.ts), quindi a gioco 0 il codolo destro di ogni
 * stadio entra di 10 unità nella punta del vicino. Se il disegno lo mostra, il valore giusto è 20
 * — i codoli si toccano e formano il collegamento, che è ciò che si vede nei due riferimenti.
 */
export const GIOCO_FRA_STADI = 0
```

La disposizione per ancore:

```ts
/**
 * La catena di trattamento disposta per ANCORE e non per riquadri: l'ancora `sx` di ogni stadio
 * cade sulla quota della linea, e l'avanzamento è la distanza fra l'ancora `dx` di uno e la `sx`
 * del successivo. È la convenzione 3 e la 4 insieme — sono la stessa regola detta sull'asse x e
 * sull'asse y.
 *
 * Il ripiego sul riquadro (`dim.altezza / 2`, `dim.larghezza`) vale per un simbolo che non
 * dichiara quelle ancore: mai per i tre rombi, che le hanno tutte, ma una taratura permanente può
 * sostituire l'elenco delle ancore (`ancoreDi`) e non c'è nulla che le imponga di tenerle.
 */
function disponiCatenaPerAncore(
  nodi: SchemaNodo[],
  xIniziale: number,
  quotaLinea: number,
  libreria: Tarature = {}
): { posizionati: SchemaNodoPosizionato[]; xFinale: number } {
  let x = xIniziale
  const posizionati = nodi.map((nodo) => {
    const dim = dimensioniDi(nodo, libreria)
    const sx = ancoraDi(nodo, 'sx', libreria)
    const dx = ancoraDi(nodo, 'dx', libreria)
    const collocato = posiziona(nodo, x, quotaLinea - (sx?.y ?? dim.altezza / 2))
    x = collocato.x + (dx?.x ?? dim.larghezza) + GIOCO_FRA_STADI
    return collocato
  })
  // `xFinale` resta la regola di sempre — bordo destro dell'ultimo riquadro più il passo — e non
  // l'ascissa dell'ultima ancora: la usano il terminale utenze e la corsia condense, e stringerla
  // qui sposterebbe anche loro. La compattezza in larghezza è il Blocco 4.
  const ultimo = posizionati[posizionati.length - 1]
  const xFinale = ultimo
    ? ultimo.x + dimensioniDi(ultimo, libreria).larghezza + PASSO_ORIZZONTALE
    : xIniziale
  return { posizionati, xFinale }
}

/**
 * Quota su cui corre la linea di processo: quella dell'ancora `dx` del serbatoio di testa
 * (convenzione 4). Fino al 18-08-2026 la catena era centrata sulla mezzeria dei serbatoi, 55 unità
 * più in basso, e la linea nasceva con un gomito che nei disegni di riferimento non c'è —
 * raddrizzato a mano su ogni pratica.
 *
 * Senza serbatoi si ripiega sulla quota di prima: un impianto di soli stadi non ha un'uscita a cui
 * allinearsi, e sollevare la linea al bordo del foglio sarebbe peggio che lasciarla dov'era.
 */
export function quotaLineaProcesso(
  serbatoi: SchemaNodoPosizionato[],
  ripiego: number,
  libreria: Tarature = {}
): number {
  const testa = serbatoi[0]
  if (!testa) return ripiego
  const dx = ancoraDi(testa, 'dx', libreria)
  return dx ? testa.y + dx.y : ripiego
}
```

In `layoutSchema`, sostituire la riga della catena e quella del terminale:

```ts
  const quotaLinea = quotaLineaProcesso(rigaSerbatoi.posizionati, yCentroSerbatoi, libreria)
  const rigaCatena = disponiCatenaPerAncore(catena, rigaSerbatoi.xFinale, quotaLinea, libreria)
  …
  const posizionatiUtenze = utenze.map((n) =>
    posiziona(n, rigaCatena.xFinale, quotaLinea - dimensioniDi(n, libreria).altezza)
  )
```

Aggiungere `ancoraDi` all'import da `./symbols`.

- [ ] **Passo 4: eseguire i test e leggere cosa cade**

```
npx vitest run
```
Atteso: verdi i nuovi; **rosse due fixture** (`svgRiferimentoSenzaTesti`, `svgRiferimentoConMuro`) e
i test di `layout.test.ts` che fissavano le vecchie coordinate. **`svgRiferimentoConTee` deve
restare verde**: se cade, fermarsi.

Gli attesi numerici in `layout.test.ts` vanno aggiornati **uno per uno, leggendoli**: uno stadio si
sposta di 5 unità in verticale (riquadro 110, ancora a 50, centro a 55) e di 55 in su rispetto alla
mezzeria dei serbatoi; il terminale utenze si sposta di 100 sul serbatoio orizzontale. Un atteso che
si sposta di un valore che non sai spiegare è un difetto, non un aggiornamento.

- [ ] **Passo 5: rigenerare le due fixture**

Procedura dall'header delle fixture stesse — **rendere col codice nuovo, spezzare per elemento,
leggere il diff, annotare in testa perché**, e mai per far tornare verde un test. Uno script
usa-e-getta nello scratchpad:

```ts
// scratchpad/rigenera-fixture.test.ts — da cancellare dopo l'uso
import { writeFileSync } from 'node:fs'
it('scrive l SVG corrente su disco', () => {
  const svg = renderSvg(layoutConTesti([]))   // lo stesso layout del test che confronta
  writeFileSync('scratchpad/senza-testi.svg', svg.replace(/></g, '>\n<'))
})
```
Poi confrontare a mano con la fixture attuale (`diff`), verificare che le differenze siano **solo**
le coordinate della linea di processo e del terminale, e riscrivere l'array un elemento per riga.
In testa alla fixture aggiungere il paragrafo «Generato di nuovo al commit …» con il motivo.

- [ ] **Passo 6: eseguire il gate**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto
```

- [ ] **Passo 7: verificare che i test mordano**

Rimettere `GIOCO_FRA_STADI` a 60 e rieseguire: deve cadere «l ancora dx di uno stadio coincide…».
Rimettere `quotaLinea` a `yCentroSerbatoi`: deve cadere «l ancora sx di ogni stadio…». Rimettere.

- [ ] **Passo 8: commit**

```bash
git add src/services/schemaImpianto/layout.ts src/services/schemaImpianto/__tests__/
git commit -m "feat(schema): la linea di processo nasce dritta e con gli stadi adiacenti"
```

---

## Task 5: gli ancoraggi diventano `t`, e non escono dal layout

`SchemaAncoraggioSegno` e `tDaAncoraggio` esistono dal Blocco 1 e **nessuno li chiama**. Questo task
li mette in funzione, come **ultimo passo** di `layoutSchema`, e fissa il contratto di sola andata:
`ancoraggio` entra nel layout e non ne esce. È ciò che tiene invariato il formato salvato.

**Files:**
- Create: `src/services/schemaImpianto/segniAncorati.ts`
- Create: `src/services/schemaImpianto/__tests__/segniAncorati.test.ts`
- Modify: `src/services/schemaImpianto/layout.ts` (ultima riga di `layoutSchema`)

**Interfacce:**
- Produce: `risolviSegniAncorati(layout: SchemaLayout, quote: QuoteInstradamento, libreria?:
  Tarature): SchemaLayout`. **Le quote arrivano dal chiamante**, non se le calcola: è ciò che
  tiene `segniAncorati.ts` fuori dal ciclo con `layout.ts` (vedi sotto).
- Consuma: `instrada`, `tDaAncoraggio` (`tratti.ts`), `latoImposto` (`symbols`), `posizioneAncora`
  (`renderSvg.ts`), `QuoteInstradamento` (tipo, `tratti.ts`).

**Attenzione alla circolarità:** `layout.ts` importerà `segniAncorati.ts`, quindi `segniAncorati.ts`
**non deve importare `layout.ts`** — per questo riceve le quote come parametro invece di chiamare
`quoteInstradamento`. Resta un ramo lungo: `segniAncorati` → `renderSvg` (per `posizioneAncora`) →
`layout` → `segniAncorati`. Se si manifesta, **spostare `posizioneAncora` in `symbols/index.ts` e
riesportarla da `renderSvg`** per compatibilità con gli importatori attuali: è geometria dei
simboli, sta lì meglio che nel render, e `corpoNodo` — la sola cosa che oggi la lega a `layout` —
va spostata insieme o passata come argomento. Un ciclo ESM qui si manifesta come `undefined is not
a function` a runtime, **non** come errore di `tsc`: la prova è il Passo 5, non la compilazione.

- [ ] **Passo 1: scrivere il test che fallisce**

Il layout si costruisce a mano — nodi a coordinate note, non passando da `layoutSchema`: così
l'atteso si calcola sulla polilinea vera invece di dipendere dalla disposizione automatica, che i
Task 4 e 6 stanno muovendo sotto i piedi.

```ts
import { describe, it, expect } from 'vitest'
import { instrada, tDaAncoraggio } from '../tratti'
import { risolviSegniAncorati } from '../segniAncorati'
import { posizioneAncora } from '../renderSvg'
import type { SchemaAncoraggioSegno, SchemaLayout, SchemaNodoPosizionato } from '../types'

const QUOTE = { yCollettore: 100, yCorsiaCondense: 900 }

const compressore: SchemaNodoPosizionato = {
  id: 'C1', tipo: 'compressore', etichetta: 'C1', gruppo: 'SALA_COMPRESSORI',
  valvoleSicurezza: [], origine: 'scheda', x: 40, y: 400,
}
const serbatoio: SchemaNodoPosizionato = {
  id: 'S1', tipo: 'serbatoio', etichetta: 'S1', gruppo: 'SALA_COMPRESSORI', orientamento: 'VERTICALE',
  valvoleSicurezza: [], origine: 'scheda', x: 300, y: 220,
}

/** Compressore → serbatoio, un arco flessibile con un solo segno. */
function layoutConMandata(ancoraggio?: SchemaAncoraggioSegno, t = 0.5): SchemaLayout {
  return {
    nodi: [compressore, serbatoio],
    archi: [
      {
        id: 'flex-1',
        da: { nodo: 'C1', ancora: 'alto-out' },
        a: { nodo: 'S1', ancora: 'sx-basso' },
        stile: 'flessibile',
        segni: [{ id: 'segno-1', tipo: 'valvola_intercettazione', t, stileAValle: 'standard', ancoraggio }],
      },
    ],
    muro: null,
    testi: [],
  }
}

/** La stessa polilinea che disegnerà `renderSvg` — vedi `renderArco`, renderSvg.ts:121-126. */
function puntiDellaMandata() {
  return instrada(
    'flessibile',
    posizioneAncora(compressore, 'alto-out'),
    posizioneAncora(serbatoio, 'sx-basso'),
    undefined,
    QUOTE,
    { da: undefined, a: undefined }
  )
}

describe('risolviSegniAncorati', () => {
  it('mette la valvola un passo di griglia sotto la dorsale, non a metà tubo', () => {
    const layout = layoutConMandata({ tipo: 'vertice', vertice: 1, scarto: -10 })
    const risolto = risolviSegniAncorati(layout, QUOTE)
    const atteso = tDaAncoraggio(puntiDellaMandata(), { tipo: 'vertice', vertice: 1, scarto: -10 })!
    expect(risolto.archi[0].segni![0].t).toBeCloseTo(atteso, 10)
    expect(risolto.archi[0].segni![0].t).not.toBe(0.5)
  })

  it('nessun ancoraggio esce dal layout: il formato salvato non cambia', () => {
    const risolto = risolviSegniAncorati(layoutConMandata({ tipo: 'vertice', vertice: 1, scarto: -10 }), QUOTE)
    for (const arco of risolto.archi) {
      for (const segno of arco.segni ?? []) {
        // `not.toHaveProperty`, non `toBeUndefined`: la chiave va TOLTA, non messa a undefined —
        // `JSON.stringify` la ometterebbe comunque, ma `toEqual` su un layow riletto no.
        expect(segno).not.toHaveProperty('ancoraggio')
      }
    }
  })

  it('un ancoraggio irrisolvibile lascia la t di ripiego invece di sollevare', () => {
    // Vertice 9 su una polilinea che ne ha 5: `tDaAncoraggio` torna null.
    const risolto = risolviSegniAncorati(layoutConMandata({ tipo: 'vertice', vertice: 9, scarto: -10 }), QUOTE)
    expect(risolto.archi[0].segni![0].t).toBe(0.5)
  })

  it('non tocca i segni posati a mano, che non dichiarano ancoraggio', () => {
    const risolto = risolviSegniAncorati(layoutConMandata(undefined, 0.73), QUOTE)
    expect(risolto.archi[0].segni![0].t).toBe(0.73)
  })
})
```

E il test del contratto, in `layout.test.ts`, che è quello che vale davvero:

```ts
it('layoutSchema non lascia uscire nessuna istruzione di ancoraggio', () => {
  const model = buildSchemaModel({ scheda: schedaTrePiuUno(), collegamentiCompressoriSerbatoi: { C1: ['S1'], C2: ['S1'], C3: ['S1'] } })
  const segni = layoutSchema(model).archi.flatMap((a) => a.segni ?? [])
  expect(segni.length).toBeGreaterThan(0)   // o passerebbe su un insieme vuoto
  expect(segni.every((s) => s.ancoraggio === undefined)).toBe(true)
})
```

**Questo test è verde per la ragione sbagliata finché il Task 6 non esiste**: oggi nessun segno
dichiara un ancoraggio, quindi «nessuno ne porta uno in uscita» è vero senza che la funzione faccia
nulla. Lo si scrive adesso perché è qui che il contratto si stabilisce, ma **acquista valore solo
al Task 6** — dove va rieseguito e guardato. Al Passo 6 di questo task lo si mette alla prova
seminando a mano un ancoraggio sul modello.

- [ ] **Passo 2: eseguirlo e vederlo fallire**

```
npx vitest run src/services/schemaImpianto/__tests__/segniAncorati.test.ts
```
Atteso: FAIL — modulo inesistente. **Non basta:** questo è esattamente il caso di un test che
fallisce per la ragione sbagliata. Dopo il verde, il Passo 6.

- [ ] **Passo 3: l'implementazione**

```ts
/**
 * Traduzione degli ancoraggi in `t` numeriche, ultimo passo del layout.
 *
 * Le convenzioni dello studio parlano di vertici — «la valvola sta un passo di griglia sotto la
 * dorsale» — e al momento in cui `buildSchemaModel` semina il segno le posizioni non esistono
 * ancora. Il modello dichiara l'intento, qui diventa un numero.
 *
 * **Contratto di sola andata.** `ancoraggio` entra e non esce: si legge, si scrive `t`, si toglie.
 * È la ragione per cui il formato salvato non cambia di un byte e `renderSvg`, `conversioneFlow`,
 * `SchemaEdgeTubazione`, `useSegniTubo` e la serializzazione non si toccano. La stessa divisione
 * già in vigore fra `stileAValle` (dato) e `tronconi` (resa).
 *
 * *Alternativa scartata: ancoraggio vivo, ririsolto a ogni disegno. Rimetterebbe la valvola al suo
 * posto ogni volta che l'operatore la trascina.*
 *
 * La polilinea si ricalcola **con la stessa chiamata di `renderArco`** (renderSvg.ts:121-126), non
 * con una approssimazione: una formula diversa metterebbe la valvola dove il tubo non passa.
 */
export function risolviSegniAncorati(
  layout: SchemaLayout,
  quote: QuoteInstradamento,
  libreria: Tarature = {}
): SchemaLayout {
  const perId = new Map(layout.nodi.map((n) => [n.id, n]))
  const archi = layout.archi.map((arco) => {
    if (!arco.segni?.some((s) => s.ancoraggio)) return arco
    const da = perId.get(arco.da.nodo)
    const a = perId.get(arco.a.nodo)
    // Un capo mancante non è un disegno da riparare qui: i segni tengono la `t` di ripiego.
    const punti =
      da && a
        ? instrada(arco.stile, posizioneAncora(da, arco.da.ancora, libreria), posizioneAncora(a, arco.a.ancora, libreria), arco.punti, quote, {
            da: latoImposto(da, arco.da.ancora, libreria),
            a: latoImposto(a, arco.a.ancora, libreria),
          })
        : null
    return {
      ...arco,
      segni: arco.segni.map((segno) => {
        if (!segno.ancoraggio) return segno
        const t = punti ? tDaAncoraggio(punti, segno.ancoraggio) : null
        const { ancoraggio: _consumato, ...resto } = segno
        return { ...resto, t: t ?? segno.t }
      }),
    }
  })
  return { ...layout, archi }
}
```

In `layoutSchema`, l'ultima riga diventa:

```ts
  const layout: SchemaLayout = { nodi, archi: model.archi, muro: null, testi: [] }
  // Ultimo passo, non uno dei primi: gli ancoraggi si risolvono sulla polilinea vera, che esiste
  // solo dopo che ogni nodo ha la sua posizione.
  return risolviSegniAncorati(layout, quoteInstradamento(layout, libreria), libreria)
```

- [ ] **Passo 4: eseguire il gate**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto
```
Atteso: verde, **fixture invariate** — nel modello di oggi nessun segno dichiara ancora un
ancoraggio (li semina il Task 6), quindi `risolviSegniAncorati` non ha nulla da fare. Se una
fixture cambia adesso, la funzione sta toccando segni che non doveva.

- [ ] **Passo 5: la prova che non ci sono cicli ESM**

```
npx vitest run src/services/schemaImpianto/__tests__/
```
Un ciclo si manifesta come `undefined is not a function` su `posizioneAncora` o `instrada`, non
come errore di `tsc`. Se compare, applicare lo spostamento di `posizioneAncora` descritto sopra.

- [ ] **Passo 6: verificare che i test mordano**

Nel corpo di `risolviSegniAncorati`, togliere la destrutturazione e restituire
`{ ...segno, t: t ?? segno.t }`: deve cadere «nessun ancoraggio esce dal layout». Poi far tornare
`tDaAncoraggio` sempre `null`: deve cadere «mette la valvola un passo di griglia sotto la dorsale».
Rimettere entrambe.

- [ ] **Passo 7: commit**

```bash
git add src/services/schemaImpianto/segniAncorati.ts src/services/schemaImpianto/layout.ts \
        src/services/schemaImpianto/__tests__/
git commit -m "feat(schema): il layout traduce gli ancoraggi in posizioni, e non se li porta via"
```

---

## Task 6: il modello dice dove vanno le valvole e da dove esce la mandata

Il task che chiude le convenzioni 1, 2, 6 e 7. `buildSchemaModel` riceve le preferenze risolte e la
libreria dei simboli.

**Files:**
- Modify: `src/services/schemaImpianto/buildSchemaModel.ts` (`BuildSchemaModelInput`, `buildArchi`,
  `buildSchemaModel`)
- Test: `src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts`
- Rigenerare: le due fixture SVG (di nuovo: cambiano le valvole)

**Interfacce:**
- Consuma: `PreferenzeRisolte` (Task 1) **come tipo soltanto** — `import type { PreferenzeRisolte }
  from './preferenze'`. Un import di valore chiuderebbe un ciclo, perché `preferenze.ts` importa
  `ordinaCatenaTrattamento` e `scaricaCondensa` da qui; `import type` sparisce in compilazione.
- Produce: `BuildSchemaModelInput` con due campi nuovi, entrambi opzionali:
  ```ts
  export interface BuildSchemaModelInput {
    scheda: SchedaDatiCompleta
    collegamentiCompressoriSerbatoi: Record<string, string[]>
    /** Preferenze GIÀ RISOLTE (`preferenzeRisolteDaScheda`). Assenti: i default di sempre. */
    preferenze?: PreferenzeRisolte
    /** Serve a leggere l'ESISTENZA delle ancore, mai la loro geometria (vedi `ancoraMandata`). */
    libreria?: Tarature
  }
  ```

**La trappola da non sbagliare:** `sx-basso` **non esiste sul serbatoio orizzontale**
(`symbols/index.ts:1012-1017`), e una taratura permanente può toglierlo anche al verticale. La
convenzione 2 si scrive «l'ancora bassa se il simbolo ce l'ha, altrimenti `sx`». Senza, si finisce
nel ripiego di `posizioneAncora` (renderSvg.ts:81-84), che attacca il tubo al centro del corpo del
serbatoio: sbagliato ma plausibile, il peggior tipo di errore.

- [ ] **Passo 1: scrivere il test che fallisce**

```ts
describe('le convenzioni grafiche dello studio', () => {
  // `schedaConTreStadi` e `schedaOrizzontale` come nel Task 4: un compressore col disoleatore, un
  // serbatoio, F1 → E1 → F2. La seconda cambia solo l'orientamento del serbatoio.
  const input = (extra = {}) => ({ scheda: schedaConTreStadi(), collegamentiCompressoriSerbatoi: { C1: ['S1'] }, ...extra })

  it('la mandata del compressore si aggancia in basso al serbatoio verticale', () => {
    const m = buildSchemaModel(input())
    expect(m.archi.find((a) => a.stile === 'flessibile')!.a.ancora).toBe('sx-basso')
  })

  it('ma sull orizzontale, che non ha quell ancora, resta sx invece di finire al centro del corpo', () => {
    const scheda = makeScheda({
      compressori: [makeCompressore({ codice: 'C1' })],
      serbatoi: [makeSerbatoio({ codice: 'S1', orientamento: 'ORIZZONTALE' })],
      dati_impianto: makeDatiImpianto({ raccolta_condense: 'Nessuna' }),
    })
    const m = buildSchemaModel(input({ scheda }))
    expect(m.archi.find((a) => a.stile === 'flessibile')!.a.ancora).toBe('sx')
  })

  it('la valvola della mandata sta un passo sotto la dorsale, e da lì in su il tubo è rigido', () => {
    const m = buildSchemaModel(input())
    const segno = m.archi.find((a) => a.stile === 'flessibile')!.segni![0]
    expect(segno.ancoraggio).toEqual({ tipo: 'vertice', vertice: 1, scarto: -10 })
    expect(segno.stileAValle).toBe('standard')
    expect(segno.t).toBe(0.5)   // il ripiego, se la geometria non si risolve
  })

  it('fra due stadi consecutivi non c è più la valvola d ufficio', () => {
    const m = buildSchemaModel(input())
    const fraStadi = m.archi.filter((a) => a.stile === 'standard' && a.da.nodo.startsWith('F') && a.a.nodo.startsWith('F'))
    expect(fraStadi.length).toBeGreaterThan(0)
    expect(fraStadi.every((a) => (a.segni ?? []).length === 0)).toBe(true)
  })

  it('la valvola di riserva sta all uscita del serbatoio e prima delle utenze', () => {
    const m = buildSchemaModel(input())
    const uscita = m.archi.find((a) => a.da.nodo === 'S1' && a.stile === 'standard')!
    const utenze = m.archi.find((a) => a.a.nodo === 'UTENZE')!
    for (const arco of [uscita, utenze]) {
      expect(arco.segni).toHaveLength(1)
      expect(arco.segni![0].ancoraggio).toEqual({ tipo: 'meta', tratto: 0 })
    }
  })

  it('le condense seguono il flag dell operatore, non più il tipo', () => {
    const risolte = preferenzeRisolteDaScheda(schedaConTreStadi(), { condense: { F1: false, S1: true } })
    const m = buildSchemaModel(input({ preferenze: risolte }))
    const scarichi = m.archi.filter((a) => a.stile === 'condensa').map((a) => a.da.nodo)
    expect(scarichi).not.toContain('F1')
    expect(scarichi).toContain('S1')
  })

  it('senza preferenze si comporta come prima: le condense per tipo', () => {
    const m = buildSchemaModel(input())
    const scarichi = m.archi.filter((a) => a.stile === 'condensa').map((a) => a.da.nodo)
    expect(scarichi).toContain('F1')
  })

  it('l ordine degli stadi scelto dall operatore diventa l ordine in cui gli archi li collegano', () => {
    const risolte = preferenzeRisolteDaScheda(schedaConTreStadi(), { ordineStadi: ['F2', 'E1', 'F1'] })
    const m = buildSchemaModel(input({ preferenze: risolte }))
    expect(m.archi.find((a) => a.da.nodo === 'S1' && a.stile === 'standard')!.a.nodo).toBe('F2')
    expect(m.archi.find((a) => a.da.nodo === 'F2' && a.stile === 'standard')!.a.nodo).toBe('E1')
    expect(m.archi.find((a) => a.da.nodo === 'E1' && a.stile === 'standard')!.a.nodo).toBe('F1')
  })
})
```

- [ ] **Passo 2: eseguirlo e vederlo fallire**

```
npx vitest run src/services/schemaImpianto/__tests__/buildSchemaModel.test.ts -t "convenzioni grafiche"
```
Atteso: FAIL su tutti tranne «senza preferenze si comporta come prima».

- [ ] **Passo 3: l'implementazione**

In `buildArchi`, l'ancora della mandata:

```ts
/**
 * L'ancora del serbatoio a cui arriva la mandata del compressore: quella BASSA, come nei disegni
 * di riferimento — la dorsale scende con un gradino e si aggancia al fianco in basso, non a 160
 * unità più in alto (convenzione 2).
 *
 * Si legge l'ESISTENZA dell'ancora, mai la sua geometria: `sx-basso` non c'è sul serbatoio
 * ORIZZONTALE (symbols/index.ts), e una taratura permanente può toglierlo anche al verticale.
 * Chiederlo comunque farebbe ripiegare `posizioneAncora` sul centro del corpo del serbatoio —
 * un tubo attaccato in mezzo alla pancia: sbagliato ma plausibile, il peggior tipo di errore.
 */
function ancoraMandata(serbatoio: SchemaNodo | undefined, libreria: Tarature): string {
  if (!serbatoio) return 'sx'
  return ancoraDi(serbatoio, 'sx-basso', libreria) ? 'sx-basso' : 'sx'
}
```

I segni, con la loro `t` di ripiego a 0.5:

```ts
  /** Valvola di intercettazione un passo di griglia sotto il vertice dato (convenzioni 1 e 5). */
  const valvolaSottoIlVertice = (vertice: number, stileAValle?: SchemaArcoStile): SchemaSegnoTubo[] => [
    { id: prossimoId('segno'), tipo: 'valvola_intercettazione', t: 0.5, stileAValle,
      ancoraggio: { tipo: 'vertice', vertice, scarto: -10 } },
  ]
  /** Valvola di riserva, a metà del primo tratto (convenzione 6). */
  const valvolaDiRiserva = (): SchemaSegnoTubo[] => [
    { id: prossimoId('segno'), tipo: 'valvola_intercettazione', t: 0.5, ancoraggio: { tipo: 'meta', tratto: 0 } },
  ]
```

L'arco della mandata usa `valvolaSottoIlVertice(1, 'standard')` e `ancoraMandata(...)`; gli archi
fra stadi consecutivi perdono `segni` del tutto (`segni` assente, non `[]`: è il caso di ogni arco
senza segni già oggi); l'arco serbatoio→primo stadio e quello verso `UTENZE` prendono
`valvolaDiRiserva()`, ciascuno **se il capo che tocca non è scavalcato da un by-pass**:

```ts
  // Convenzione 6: la valvola di riserva è quella che l'operatore userebbe per isolare la
  // sezione. Con un by-pass che scavalca il primo stadio la sua valvola c'è già sul ponte, e
  // metterne una seconda a 10 unità di distanza è ciò che nei riferimenti non si vede.
  // Nel Blocco 2 `bypass` è sempre vuoto: entrambe le valvole ci sono sempre.
  const scavalcati = new Set((input.preferenze?.bypass ?? []).flatMap((g) => g.stadi))
  const primoScavalcato = catenaLinea.length > 0 && scavalcati.has(catenaLinea[0].id)
  const ultimoScavalcato = catenaLinea.length > 0 && scavalcati.has(catenaLinea[catenaLinea.length - 1].id)
```

L'ordine della catena e le condense:

```ts
  // L'ordine scelto dall'operatore vince su quello di default; senza preferenze, `ordineStadi` è
  // assente e resta `ordinaCatenaTrattamento` — il generatore di sempre.
  const catenaDiDefault = ordinaCatenaTrattamento(nodi, raccoltaCondense)
  const catenaLinea = input.preferenze
    ? input.preferenze.ordineStadi
        .map((id) => catenaDiDefault.find((n) => n.id === id))
        .filter((n): n is SchemaNodo => Boolean(n))
    : catenaDiDefault
```
e nel ciclo delle condense:
```ts
      // Il flag per apparecchiatura, con la regola per tipo come default (`risolviPreferenze` l'ha
      // già applicata): dal 18-08-2026 la selezione non è più per tipo (convenzione 7).
      if (input.preferenze ? input.preferenze.condense.has(nodo.id) : scaricaCondensa(nodo)) {
```

In `buildSchemaModel`, l'array `nodi` va costruito nell'ordine risolto per compressori e serbatoi
(è quello che `layoutSchema` legge per disporre le due righe):

```ts
  // L'ordine dell'array è l'ordine del disegno: `layoutSchema` filtra per tipo e dispone in fila
  // nell'ordine in cui li trova qui. Riordinare a valle, nel layout, vorrebbe dire avere due
  // ordinamenti — ed è esattamente il difetto che `catenaDagliArchi` è nato per chiudere.
  const perElenco = (elenco: string[] | undefined, elementi: SchemaNodo[]): SchemaNodo[] =>
    elenco ? [...elementi].sort((a, b) => elenco.indexOf(a.id) - elenco.indexOf(b.id)) : elementi
```
applicato a compressori e serbatoi con `input.preferenze?.ordineCompressori` /
`?.ordineSerbatoi`. **Attenzione:** `indexOf` torna `-1` per un id non nominato, che lo porterebbe
in testa. `risolviPreferenze` restituisce elenchi **completi** (contengono ogni apparecchiatura di
scheda), quindi il caso non si presenta — ma il commento va scritto, perché la prossima persona che
passa di qui non lo sa.

- [ ] **Passo 4: eseguire i test e rigenerare le fixture**

Cambiano di nuovo `svgRiferimentoSenzaTesti` e `svgRiferimentoConMuro`: le valvole si spostano e
quella fra stadi sparisce. Stessa procedura del Task 4, Passo 5 — diff letto, motivo annotato in
testa. **`svgRiferimentoConTee` invariata.**

Nel diff, verificare **in concreto** che la valvola della mandata non sia più a metà del tubo: il
`<path>` della farfalla deve stare vicino al vertice della dorsale, non a mezza strada fra
compressore e serbatoio. È la prova che `risolviSegniAncorati` (Task 5) è davvero in circuito.

- [ ] **Passo 5: eseguire il gate**

```
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto
```

- [ ] **Passo 6: verificare che i test mordano**

Far tornare `ancoraMandata` sempre `'sx-basso'` e rieseguire: deve cadere «ma sull orizzontale…».
Rimettere `segni: segnoValvolaDiDefault()` sugli archi fra stadi: deve cadere «fra due stadi
consecutivi…». Rimettere.

- [ ] **Passo 7: commit**

```bash
git add src/services/schemaImpianto/buildSchemaModel.ts src/services/schemaImpianto/__tests__/
git commit -m "feat(schema): mandata agganciata in basso, valvole di riserva ai capi, condense dal flag"
```

---

## Task 7: il cablaggio in pagina, e la prova dal vivo

Il generatore accetta le preferenze dal Task 6 ma **nessuno gliele passa**: finché non si cabla,
il pannello del Blocco 1 continua a scrivere scelte che il disegno ignora.

**Files:**
- Modify: `src/components/relazione/SchemaImpiantoSection.tsx:300-350` (i due `buildSchemaModel`)
- Test: nessuno nuovo (è interfaccia; la logica è già coperta da `preferenze.test.ts`)

- [ ] **Passo 1: leggere da dove arrivano le preferenze**

`grep -n "schemaPreferenze" src/components/relazione/*.tsx` — nel Blocco 1 il campo è già letto e
passato a `PannelloPreferenzeSchema`. Risalire a chi lo tiene (`RelazioneDataDialog` o la sezione
stessa) e usare **quella** fonte, senza aggiungerne una seconda.

- [ ] **Passo 2: risolvere una volta sola e passare a tutti e due i punti**

```ts
  // Le stesse preferenze che il pannello mostra, risolte una volta sola: due risoluzioni in due
  // punti divergerebbero al primo ritocco di `preferenzeRisolteDaScheda`.
  const preferenzeRisolte = useMemo(
    () => preferenzeRisolteDaScheda(scheda, schemaPreferenze),
    [scheda, schemaPreferenze]
  )
```
e nei due punti:
```ts
    const modello = buildSchemaModel({ scheda, collegamentiCompressoriSerbatoi, preferenze: preferenzeRisolte, libreria })
```

- [ ] **Passo 3: verificare la guardia di prima generazione**

`preferenzeRisolte` entra fra le dipendenze dell'effetto (obbligatorio con `exhaustive-deps`).
**Un cambio di preferenze non deve MAI ridisegnare da sé** — è una promessa fatta al committente:
l'effetto si vede solo con «Rigenera da capo». La guardia è `generazioneTentata.current`, che è un
`useRef` e non si azzera al rieseguire dell'effetto: regge. **Verificarlo leggendo il codice, non
assumendolo**, e in pagina al Passo 5.

- [ ] **Passo 4: eseguire il gate**

```
npx vitest run
npx tsc --noEmit
npx eslint src/components/relazione src/services/schemaImpianto
```
Il conto dei warning su `components/relazione` fa parte dei 18 tollerati: confrontarlo col commit
base, non con zero.

- [ ] **Passo 5: la prova in pagina — non è facoltativa**

Con 1353 test verdi, nel Blocco 1 la prova dal vivo ha trovato due difetti. È la terza volta per
questo modulo. Sulla pratica **`002 test` (`fed244ee`)**, creata apposta dal committente:

1. Avviare il dev server dal worktree (verificare quale processo tiene la porta: la 5173 è di un
   altro progetto) e aprire la pratica.
2. Aprire la finestra SCHEMA IMPIANTO, premere **«Rigenera da capo»**, e mettere il disegno a
   fianco di `DOCUMENTAZIONE/relazione/no byass.png`. Guardare, nell'ordine:
   - la linea di processo è **dritta** dall'uscita del serbatoio fino alle utenze, senza il gomito;
   - gli stadi si **toccano** (e se i codoli si compenetrano, annotarlo per il Blocco 4: è il caso
     in cui `GIOCO_FRA_STADI` va a 20);
   - la mandata del compressore si aggancia al **fianco basso** del serbatoio, con la valvola un
     passo sotto la dorsale e il tratto **rigido** sopra di essa, flessibile sotto;
   - c'è una valvola **all'uscita del serbatoio** e una **prima delle utenze** (quest'ultima manca
     nel disegno di riferimento: il committente l'ha dimenticata, la convenzione la prevede — non
     dedurre dal disegno che non ci vada);
   - **non** ci sono più valvole a metà dei tratti fra stadi.
3. Togliere una spunta «condense» nel pannello e verificare che **il disegno non si muova**.
   Premere «Rigenera da capo»: solo adesso la linea tratteggiata sparisce.
4. Riordinare due stadi per trascinamento (da tastiera: focus sulla maniglia, `Space`, frecce,
   `Space` — `browser_drag` non è affidabile), rigenerare, e verificare che gli archi seguano il
   nuovo ordine **senza incrociarsi**.
5. Chiudere la finestra, riaprirla: le preferenze sono ancora quelle scelte (il test di Zod del
   Blocco 1 lo garantisce, ma questo è il percorso vero).
6. **Spegnere il dev server a fine sessione**: i server dei worktree sopravvivono alla sessione che
   li ha accesi.

Ciò che si vede e non torna va annotato **nel piano**, in coda, prima di correggerlo: è il materiale
del Blocco 4.

- [ ] **Passo 6: commit**

```bash
git add src/components/relazione/SchemaImpiantoSection.tsx
git commit -m "feat(schema): il disegno generato segue le preferenze scelte in finestra"
```

---

## Verifica di fine blocco

1. `npx vitest run` verde, conto dei test **≥ 1353**.
2. `npx tsc --noEmit` pulito.
3. eslint: non un warning più del commit base sui percorsi toccati.
4. Le tre fixture: due rigenerate con diff letto e **annotato in testa**, `svgRiferimentoConTee`
   **invariata**.
5. La prova in pagina del Task 7 fatta, con l'esito scritto in coda a questo piano.
6. **Nessun merge, nessun push:** il Blocco 3 continua su questo ramo, e il merge simulato con
   `git merge-tree` contro un `origin/main` appena `fetch`ato si fa alla fine del Blocco 3.

## Cosa è andato diversamente

**Task 1–3** — come previsto. Nel Task 2 la prima stesura dei test aveva due buchi trovati con la
prova «rompi apposta e guarda»: nessuno fissava che *`layoutSchema`* usasse `catenaDagliArchi` (i
test la chiamavano tutti direttamente), e il filtro sulle condense non era discriminato da nessun
caso. Due test aggiunti. Nel Task 3, il test sull'arco d'aria uscente passava già con la regola
vecchia: rafforzato col caso che separa davvero le due letture — un separatore che riceve condensa
*e* ha l'uscita d'aria verso le utenze.

**Task 4, due sorprese.**

1. **`svgRiferimentoConTee` è cambiata**, e la consegna diceva di fermarsi. Ci si è fermati, e la
   premessa si è rivelata **sbagliata**: quella fixture *non* costruisce il layout a mano — parte
   da `layoutSchema(buildSchemaModel(…))` e costruisce a mano solo la giunzione. Il diff è di due
   righe, la stessa causa delle altre due fixture. Nessun simbolo né instradamento toccati. La
   regola «se cambia, fermarsi» ha comunque fatto il suo lavoro: ha imposto di guardare.
2. **Il vertice doppio.** Con la linea dritta, `rottaLinea` produceva `L 690 360 L 690 360` — due
   vertici coincidenti più uno collineare. Prima del Blocco 2 non capitava mai (le quote
   differivano sempre di 55); ora è il caso normale. Non basta `dedup` (toglie i coincidenti, non
   i collineari): il caso dritto è esplicito. Conta perché un tratto di lunghezza nulla è un
   tranello per gli ancoraggi del Task 6, che contano vertici e tratti.

Due test di `renderSvg` avevano perso il loro oggetto e sono stati riscritti, non aggiustati: «la
freccia orientata come il tratto» ora usa la mandata del compressore (l'arco verso le utenze è
dritto e non ha più due giaciture) e «la mandata di linea gira a metà strada» sposta un nodo per
ricreare il caso con la piega, che ora si ottiene solo trascinando nell'editor. Aggiunto il test
del caso dritto, che è il nuovo normale.

Il test «l'ancora dx coincide con la sx del successivo» usa `GIOCO_FRA_STADI` nell'asserzione:
prova la *regola*, non il *valore* — voluto, il valore si chiude nel Blocco 4. Il numero della
convenzione 3 è fissato da un test separato (passo 100 + gioco).

**Task 5.** L'anello `layout` → `segniAncorati` → `renderSvg` → `layout` **c'è** ma non si
manifesta: regge sull'hoisting delle dichiarazioni di funzione, provato dal file di test che
importa `segniAncorati` per primo (il caso peggiore). Annotato nel modulo insieme alla cura, che
resta da applicare se qualcuno converte `corpoNodo` o `posizioneAncora` in una `const`. La
destrutturazione con scarto (`const { ancoraggio: _consumato, ...resto }`) lasciava un warning
eslint su un percorso che deve stare a zero: sostituita da copia più `delete`, che oltre a non
lasciare warning non perde i campi che qualcuno aggiungerà al segno.

**Task 6.** Quattro test di `renderSvg` avevano perso il loro oggetto perché le valvole sono
cambiate di posto, e sono stati **riscritti, non aggiustati**: «due tratti di tipo diverso» ora
costruisce il «prima» togliendo lo `stileAValle` (che adesso nasce già lì); «il flessibile
ondulato» misura il troncone a segni tolti; «la discesa della mandata» pure, perché il vertice del
collettore è finito nel pezzo rigido; `layoutConSegno([])` doveva svuotare **tutti** gli archi, non
solo il primo — la valvola di riserva verso le utenze vanificava il caso «nessuna valvola».

Il generatore delle fixture ha sbagliato due volte prima di dare un diff leggibile: al primo giro
tagliava a profondità 0 e produceva **una riga sola** (proprio ciò che l'header vieta), al secondo
accorpava `</g>` col fratello successivo. Il taglio giusto è a profondità 1, con emissione anche
alla chiusura di un figlio. Vale la pena rifarlo così la prossima volta: il diff finale è di 3
righe tolte e 6 aggiunte per fixture, tutto leggibile.

**La prova visiva.** Fatta sulla pratica `002 test` (`fed244ee`) — 2 compressori, 1 serbatoio, 2
essiccatori, 3 filtri, 1 separatore — generando lo schema dalla **scheda vera letta dal DB** e
rasterizzando l'SVG con `sharp` (il browser MCP non rispondeva). Esito: **combacia con
`no byass.png`** su tutte le convenzioni del blocco — linea dritta, stadi adiacenti (passo 100),
aggancio `sx-basso`, montante flessibile fino alla valvola e rigido sopra, valvole di riserva ai
due capi, nessuna valvola fra stadi, condense verso il separatore.

**Da guardare nel Blocco 4:** lo spazio fra i compressori e il serbatoio, e fra serbatoio e primo
stadio, resta più largo che nel riferimento. È la convenzione 8 (compattezza in larghezza), che il
Blocco 4 chiude con `PASSO_COMPRESSORI`/`PASSO_SERBATOI` separati — **non** toccando
`PASSO_ORIZZONTALE`, condiviso con `calcolaMuro`.

**La prova interattiva, fatta il 18-08-2026** su `002 test` con un login vero. Nessun difetto
trovato — è la prima volta per questo modulo. Cinque cose verificate:

1. **La spunta non mente più.** In finestra: `C1=no C2=no S1=SI E1=SI E2=SI F1=SI F2=SI F3=SI
   SEP1=no` — i due compressori sono senza disoleatore, e col `() => true` del Blocco 1 sarebbero
   comparsi spuntati. L'elenco coincide con gli archi condensa che il generatore emette.
2. **Un cambio di spunta non ridisegna.** Tolta la spunta a F2: il blob dell'anteprima resta
   **identico** (`a7fab88d-…`). La guardia `generazioneTentata` regge davvero.
3. **«Rigenera da capo» applica.** Nuovo blob, e il disegno passa da 1610×1242 a **1478×1353** —
   più stretto, come deve essere con gli stadi adiacenti. F2 perde la linea condense.
4. **Il riordino da tastiera funziona** (focus sulla maniglia, `Space`, frecce, `Space`) e non
   tocca il disegno. Dopo «Rigenera», gli archi seguono il nuovo ordine `E1 → E2 → F3 → F1 → F2`
   **senza incrociarsi** — è la prova in pagina di `catenaDagliArchi` — e la lista apparecchiature
   segue la stessa sequenza, come la specifica prevedeva per `righeLista`.
5. **Il dato salvato è pulito.** Riletto da Supabase dopo la chiusura: `schemaPreferenze` scritte
   (Zod non le cancella), gli stadi tutti alla **stessa quota `y=170`**, e **zero segni con
   `ancoraggio` residuo** nel layout — il contratto di sola andata regge fino al disco.

Stato della pratica ripristinato (spunta e ordine rimessi, rigenerato). Un solo errore in console,
preesistente e in `EquipmentAutocomplete`: estraneo a questo lavoro.
