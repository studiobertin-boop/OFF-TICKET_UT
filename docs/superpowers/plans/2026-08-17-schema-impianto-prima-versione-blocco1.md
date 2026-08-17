# Schema d'impianto, prima versione conforme — Blocco 1: preferenze e pannello

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare all'operatore un pannello nella finestra SCHEMA IMPIANTO in cui riordinare le
apparecchiature, dire quali scaricano condensa e comporre i gruppi di by-pass, e far sopravvivere
quelle scelte a ogni salvataggio — senza ancora cambiare di un pixel il disegno generato.

**Architecture:** Un campo nuovo `additional_info.schemaPreferenze`, fratello di `schemaLayout`,
scritto e riletto lungo la stessa catena che già porta `collegamentiCompressoriSerbatoi`
(`TechnicalDetails` → `SchemaImpiantoDialog` / `RelazioneDataDialog`). Un risolutore puro traduce
le preferenze salvate — che invecchiano — nell'ordine effettivo, tenendo conto delle
apparecchiature comparse e sparite. In più, i tipi e il risolutore geometrico degli **ancoraggi
dei segni**, che il Blocco 2 userà per posare le valvole a distanza fissa dai vertici invece che a
metà tubo.

**Tech Stack:** React 18 + TypeScript (strict: false) + Material UI 6 + @dnd-kit + Zod + Vitest.

**Spec:** `docs/superpowers/specs/2026-08-17-schema-impianto-prima-versione-design.md`

## Global Constraints

- **Nessun cambiamento al disegno generato.** Alla fine del blocco, le tre fixture SVG
  (`src/services/schemaImpianto/__tests__/fixtures/svgRiferimento*.ts`) devono essere **identiche**.
  Se una cambia, è un difetto di questo blocco, non un aggiornamento.
- **Nessun test di interfaccia** (convenzione di `CLAUDE.md`): la logica provabile va in servizi e
  hook, mai nei componenti.
- `updateAdditionalInfo` sovrascrive l'intera colonna `additional_info`: ogni scrittura parziale
  fa merge esplicito con lo stato corrente, mai un oggetto costruito da zero.
- **`additionalInfoSchema` è un `z.object` senza `passthrough`: Zod scarta le chiavi che non
  conosce.** Un campo nuovo va dichiarato sia in `src/services/relazione/schema.ts` sia nel
  letterale di `RelazioneDataDialog.tsx:161-171`, o sparisce alla prima relazione generata.
- Gate a ogni task: `npx vitest run`, `npx tsc --noEmit`, e
  `npx eslint <percorsi toccati> --max-warnings 0`. Niente `prettier --write`.
- Lingua di commenti, messaggi di commit e testi a schermo: italiano.

## File Structure

| File | Responsabilità |
|---|---|
| `src/services/schemaImpianto/types.ts` (modifica) | `SchemaAncoraggioSegno`; campo `ancoraggio?` su `SchemaSegnoTubo` |
| `src/services/schemaImpianto/tratti.ts` (modifica) | `tDaAncoraggio`: da regola geometrica a `t` |
| `src/services/relazione/types.ts` (modifica) | `SchemaPreferenze`, `SchemaPreferenzeBypass`, campo su `AdditionalInfo` |
| `src/services/relazione/schema.ts` (modifica) | dichiarazione Zod del campo nuovo |
| `src/utils/equipmentCodes.ts` (modifica) | potatura dei riferimenti a codici spariti |
| `src/services/schemaImpianto/preferenze.ts` (nuovo) | risolutore puro: ordine, condense, gruppi, contiguità, impronta |
| `src/pages/TechnicalDetails.tsx` (modifica) | stato `preferenzeSchema`, semina, salvataggio |
| `src/components/relazione/RelazioneDataDialog.tsx` (modifica) | riporta il campo nel letterale salvato |
| `src/components/relazione/SchemaImpiantoDialog.tsx` (modifica) | ospita il pannello |
| `src/components/relazione/PannelloPreferenzeSchema.tsx` (nuovo) | il pannello: tre liste, flag, gruppi |

---

### Task 1: Ancoraggi dei segni — tipi e risolutore geometrico

Un segno sulla tubazione si posiziona oggi con `t`, la frazione della lunghezza della polilinea.
Le convenzioni del committente parlano invece di vertici («un passo di griglia sotto la dorsale»).
Questo task aggiunge il vocabolario e la funzione che lo traduce. **Nessun chiamante lo usa
ancora**: il comportamento resta identico.

**Files:**
- Modify: `src/services/schemaImpianto/types.ts:157-182`
- Modify: `src/services/schemaImpianto/tratti.ts` (in coda a `quoteDeiVertici`, riga ~323)
- Test: `src/services/schemaImpianto/__tests__/tratti.test.ts`

**Interfaces:**
- Produces: `SchemaAncoraggioSegno` (types.ts), `SchemaSegnoTubo.ancoraggio?: SchemaAncoraggioSegno`
- Produces: `tDaAncoraggio(punti: Punto[], ancoraggio: SchemaAncoraggioSegno): number | null` (tratti.ts)

- [ ] **Step 1: Scrivere i test che falliscono**

In coda a `src/services/schemaImpianto/__tests__/tratti.test.ts`, aggiungere `tDaAncoraggio` agli
import già presenti da `'../tratti'` (`puntoSuTratto` è tra quelli: verificarlo, e aggiungerlo se
manca), e questo blocco:

```ts
describe('tDaAncoraggio', () => {
  // Il ponte di un by-pass: sale 80, corre 200, ridiscende 80. Lunghezza totale 360.
  const ponte = [
    { x: 100, y: 300 },
    { x: 100, y: 220 },
    { x: 300, y: 220 },
    { x: 300, y: 300 },
  ]

  it('mette la valvola un passo di griglia PRIMA di un vertice, sul tratto entrante', () => {
    const t = tDaAncoraggio(ponte, { tipo: 'vertice', vertice: 1, scarto: -10 })
    expect(t).not.toBeNull()
    expect(puntoSuTratto(ponte, t as number).punto).toEqual({ x: 100, y: 230 })
  })

  it('mette la valvola un passo DOPO un vertice, sul tratto uscente', () => {
    const t = tDaAncoraggio(ponte, { tipo: 'vertice', vertice: 2, scarto: 10 })
    expect(t).not.toBeNull()
    expect(puntoSuTratto(ponte, t as number).punto).toEqual({ x: 300, y: 230 })
  })

  it('mette la valvola a metà del tratto indicato', () => {
    const t = tDaAncoraggio(ponte, { tipo: 'meta', tratto: 1 })
    expect(t).not.toBeNull()
    expect(puntoSuTratto(ponte, t as number).punto).toEqual({ x: 200, y: 220 })
  })

  it('non scavalca il vertice quando lo scarto è più lungo del tratto', () => {
    // Il tratto entrante nel vertice 1 è lungo 80: uno scarto di 200 si ferma al capo di partenza.
    const t = tDaAncoraggio(ponte, { tipo: 'vertice', vertice: 1, scarto: -200 })
    expect(puntoSuTratto(ponte, t as number).punto).toEqual({ x: 100, y: 300 })
  })

  it('vale null su un vertice che non esiste', () => {
    expect(tDaAncoraggio(ponte, { tipo: 'vertice', vertice: 9, scarto: -10 })).toBeNull()
  })

  it('vale null quando si chiede il tratto prima del primo vertice', () => {
    expect(tDaAncoraggio(ponte, { tipo: 'vertice', vertice: 0, scarto: -10 })).toBeNull()
  })

  it('vale null su un tratto che non esiste', () => {
    expect(tDaAncoraggio(ponte, { tipo: 'meta', tratto: 7 })).toBeNull()
  })

  it('vale null su una polilinea di lunghezza nulla', () => {
    const fermo = [
      { x: 50, y: 50 },
      { x: 50, y: 50 },
    ]
    expect(tDaAncoraggio(fermo, { tipo: 'meta', tratto: 0 })).toBeNull()
  })
})
```

- [ ] **Step 2: Lanciare i test e vedere che falliscono**

Run: `npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts`
Expected: FAIL — `tDaAncoraggio is not a function` / errore di importazione.

- [ ] **Step 3: Aggiungere i tipi**

In `src/services/schemaImpianto/types.ts`, **prima** di `export interface SchemaSegnoTubo`
(riga 168), inserire:

```ts
/**
 * Regola geometrica con cui il LAYOUT calcola la `t` di un segno appena generato. Le convenzioni
 * dello studio parlano di vertici («la valvola sta un passo di griglia sotto la dorsale»), non di
 * frazioni di lunghezza, e al momento in cui `buildSchemaModel` semina il segno le posizioni non
 * esistono ancora: il modello dichiara l'intento, il layout lo traduce in un numero.
 *
 * È un'istruzione **di sola andata**: `layoutSchema` la consuma, scrive la `t` e la toglie. Non
 * compare mai in un layout salvato, e per questo il formato su disco non cambia — la stessa
 * divisione già in vigore fra `stileAValle` (dato) e `tronconi` (resa).
 *
 * `scarto` si misura LUNGO la polilinea, non in linea d'aria: negativo verso il capo di partenza
 * (cioè sul tratto entrante nel vertice), positivo verso il capo d'arrivo.
 */
export type SchemaAncoraggioSegno =
  | { tipo: 'vertice'; vertice: number; scarto: number }
  | { tipo: 'meta'; tratto: number }
```

E dentro `SchemaSegnoTubo`, dopo il campo `stileAValle` (riga 181), aggiungere:

```ts
  /**
   * Come il layout deve ricalcolare `t` da questo segno. Assente — il caso di ogni segno posato
   * a mano e di ogni layout salvato — vale la `t` così com'è. Presente e irrisolvibile (vertice
   * inesistente, polilinea di lunghezza nulla): vale comunque la `t`, che i generatori seminano
   * a 0.5 apposta. Una valvola a metà tubo è sbagliata ma visibile e correggibile; un'eccezione
   * a metà generazione no.
   */
  ancoraggio?: SchemaAncoraggioSegno
```

- [ ] **Step 4: Scrivere il risolutore**

In `src/services/schemaImpianto/tratti.ts`, subito dopo `quoteDeiVertici` (riga ~323), aggiungere
`SchemaAncoraggioSegno` all'import di tipi da `'./types'` in testa al file, e la funzione:

```ts
/**
 * La `t` corrispondente a un ancoraggio, sulla polilinea GIÀ RISOLTA — la stessa che disegnerà
 * `renderSvg`, non quella dei soli gomiti. Stessa metrica di `puntoSuTratto`: frazione della
 * lunghezza totale, non del numero di segmenti.
 *
 * `null` quando l'ancoraggio non si applica: vertice o tratto inesistente (`dedup` può aver
 * collassato una rotta, vedi `rottaImboccata`), oppure polilinea di lunghezza nulla. Il chiamante
 * tiene allora la `t` di ripiego che il generatore ha seminato — vedi `SchemaSegnoTubo.ancoraggio`.
 *
 * Lo scarto è bloccato dentro il tratto adiacente al vertice: chiedere «20 unità prima» su un
 * tratto lungo 8 posa il segno sul capo di quel tratto, non oltre l'angolo. Scavalcare un vertice
 * metterebbe la valvola su un tratto con un'altra giacitura, e il simbolo si orienta sulla
 * giacitura locale (`puntoSuTratto` riporta `orizzontale`): uscirebbe ruotato di 90°.
 */
export function tDaAncoraggio(punti: Punto[], ancoraggio: SchemaAncoraggioSegno): number | null {
  if (punti.length < 2) return null
  const lunghezze = punti.slice(1).map((p, i) => Math.hypot(p.x - punti[i].x, p.y - punti[i].y))
  const totale = lunghezze.reduce((s, l) => s + l, 0)
  if (totale === 0) return null

  // Distanza percorsa fino al vertice `i`: `cumulate[i]`.
  const cumulate = [0]
  for (const l of lunghezze) cumulate.push(cumulate[cumulate.length - 1] + l)

  if (ancoraggio.tipo === 'meta') {
    const l = lunghezze[ancoraggio.tratto]
    if (l === undefined) return null
    return (cumulate[ancoraggio.tratto] + l / 2) / totale
  }

  const partenza = cumulate[ancoraggio.vertice]
  if (partenza === undefined) return null
  if (ancoraggio.scarto === 0) return partenza / totale

  // Il tratto su cui lo scarto può muoversi: quello entrante se va all'indietro, quello uscente
  // se va avanti. Assente (si è al primo o all'ultimo vertice): non c'è dove andare.
  const disponibile =
    ancoraggio.scarto < 0 ? lunghezze[ancoraggio.vertice - 1] : lunghezze[ancoraggio.vertice]
  if (disponibile === undefined) return null

  const passo = Math.min(Math.abs(ancoraggio.scarto), disponibile)
  return (partenza + (ancoraggio.scarto < 0 ? -passo : passo)) / totale
}
```

- [ ] **Step 5: Lanciare i test e vedere che passano**

Run: `npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts`
Expected: PASS, tutti.

- [ ] **Step 6: Gate completo**

```bash
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto --max-warnings 0
```
Expected: 1307 test verdi + gli 8 nuovi = 1315; nessun errore di tipo; nessun warning nuovo.
**Le tre fixture SVG devono essere intatte** — `git status` non le nomina.

- [ ] **Step 7: Commit**

```bash
git add src/services/schemaImpianto/types.ts src/services/schemaImpianto/tratti.ts \
        src/services/schemaImpianto/__tests__/tratti.test.ts \
        docs/superpowers/specs/2026-08-17-schema-impianto-prima-versione-design.md \
        docs/superpowers/plans/2026-08-17-schema-impianto-prima-versione-blocco1.md
git commit -m "feat(schema): un segno può dichiarare dove sta rispetto ai vertici del tubo

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Il campo `schemaPreferenze` sopravvive al salvataggio

Il campo nuovo va dichiarato in **entrambi** i punti che oggi lo cancellerebbero, e il test che lo
protegge si scrive prima ancora che qualcuno lo popoli.

**Files:**
- Modify: `src/services/relazione/types.ts:22-43`
- Modify: `src/services/relazione/schema.ts:9-26`
- Modify: `src/components/relazione/RelazioneDataDialog.tsx:47-82, 161-171`
- Modify: `src/utils/equipmentCodes.ts:267-305`
- Modify: `src/pages/TechnicalDetails.tsx:194-205, 273-300, 730-775`
- Test: `src/services/relazione/__tests__/schemaLayoutPersistito.test.ts`
- Test: `src/utils/__tests__/equipmentCodes.test.ts`

**Interfaces:**
- Consumes: niente dal Task 1.
- Produces: `SchemaPreferenze`, `SchemaPreferenzeBypass` (da `@/services/relazione/types`),
  `AdditionalInfo.schemaPreferenze?: SchemaPreferenze`.
- Produces: prop `preferenze: SchemaPreferenze` e `onPreferenzeChange: (p: SchemaPreferenze) => void`
  su `SchemaImpiantoDialogProps`; prop `schemaPreferenze: SchemaPreferenze` su
  `RelazioneDataDialogProps`.

- [ ] **Step 1: Scrivere i test che falliscono**

In `src/services/relazione/__tests__/schemaLayoutPersistito.test.ts`, in coda al file:

```ts
describe('schemaPreferenze in additional_info', () => {
  // Zod scarta le chiavi che `additionalInfoSchema` non dichiara, e `handleGenera` salva
  // `parsed.data`: un campo non dichiarato sparirebbe alla prima relazione generata. Questo test
  // è la sola guardia contro una perdita silenziosa di lavoro dell'operatore.
  it('conserva le preferenze attraverso il parse', () => {
    const preferenze = {
      ordineStadi: ['F1', 'E1', 'F2'],
      condense: { S1: true, F2: false },
      bypass: [{ id: 'bp1', stadi: ['E1', 'F2'] }],
    }
    const esito = additionalInfoSchema.parse({ descrizioneAttivita: 'prova', schemaPreferenze: preferenze })
    expect(esito.schemaPreferenze).toEqual(preferenze)
  })

  it('resta valido quando le preferenze non ci sono', () => {
    const esito = additionalInfoSchema.parse({ descrizioneAttivita: 'prova' })
    expect(esito.schemaPreferenze).toBeUndefined()
  })
})
```

In `src/utils/__tests__/equipmentCodes.test.ts`, in coda al file (verificando che
`pruneAdditionalInfo` sia fra gli import da `'../equipmentCodes'`, e aggiungendolo se manca):

```ts
describe('pruneAdditionalInfo — schemaPreferenze', () => {
  const codici = new Set(['S1', 'E1', 'F1', 'F2'])

  it('toglie dagli ordini i codici spariti e lo dice', () => {
    const { info, dropped } = pruneAdditionalInfo(
      { schemaPreferenze: { ordineStadi: ['F1', 'F9', 'E1'], ordineSerbatoi: ['S1', 'S7'] } },
      codici
    )
    expect(info.schemaPreferenze?.ordineStadi).toEqual(['F1', 'E1'])
    expect(info.schemaPreferenze?.ordineSerbatoi).toEqual(['S1'])
    expect(dropped).toContain('ordine schema F9')
    expect(dropped).toContain('ordine schema S7')
  })

  it('toglie dalle condense i codici spariti', () => {
    const { info, dropped } = pruneAdditionalInfo(
      { schemaPreferenze: { condense: { S1: true, S9: false } } },
      codici
    )
    expect(info.schemaPreferenze?.condense).toEqual({ S1: true })
    expect(dropped).toContain('condense schema S9')
  })

  it('accorcia un gruppo by-pass che perde un membro ma ne conserva due', () => {
    const { info, dropped } = pruneAdditionalInfo(
      { schemaPreferenze: { bypass: [{ id: 'bp1', stadi: ['E1', 'F9', 'F2'] }] } },
      codici
    )
    expect(info.schemaPreferenze?.bypass).toEqual([{ id: 'bp1', stadi: ['E1', 'F2'] }])
    expect(dropped).toContain('by-pass bp1 → F9')
  })

  it('scarta un gruppo by-pass rimasto senza membri', () => {
    const { info, dropped } = pruneAdditionalInfo(
      { schemaPreferenze: { bypass: [{ id: 'bp1', stadi: ['F8', 'F9'] }] } },
      codici
    )
    expect(info.schemaPreferenze?.bypass).toEqual([])
    expect(dropped).toContain('by-pass bp1')
  })

  it('lascia stare una scheda senza preferenze', () => {
    const { info } = pruneAdditionalInfo({ spessimetrica: ['S1'] }, codici)
    expect(info.schemaPreferenze).toBeUndefined()
  })
})
```

- [ ] **Step 2: Lanciare i test e vedere che falliscono**

Run: `npx vitest run src/services/relazione/__tests__/schemaLayoutPersistito.test.ts src/utils/__tests__/equipmentCodes.test.ts`
Expected: FAIL — `esito.schemaPreferenze` è `undefined` (Zod l'ha scartato) e
`info.schemaPreferenze` non è potato.

- [ ] **Step 3: Dichiarare i tipi**

In `src/services/relazione/types.ts`, **prima** di `export interface AdditionalInfo` (riga 22):

```ts
/** Un gruppo di apparecchiature scavalcate da un solo by-pass. */
export interface SchemaPreferenzeBypass {
  /**
   * Stabile per la vita del gruppo, assegnato alla creazione come primo intero libero (`bp1`,
   * `bp2`, …) e mai riusato. Da qui nascono gli id dei due nodi giunzione del disegno: ricavarli
   * invece dagli stadi scavalcati li renderebbe instabili — riordinare le righe nel pannello
   * cambierebbe l'id, e il layout salvato perderebbe i suoi TEE.
   */
  id: string
  /** Codici degli stadi scavalcati. Devono essere contigui nell'ordine risolto. */
  stadi: string[]
}

/**
 * Scelte dell'operatore sulla forma dello schema, prese nel pannello della finestra SCHEMA
 * IMPIANTO. Sono un INGRESSO della generazione, come `collegamentiCompressoriSerbatoi`, e per
 * questo stanno accanto a `schemaLayout` e non dentro: quello sparisce legittimamente quando si
 * carica un disegno AutoCAD o si preme «Rimuovi», gesti che con queste scelte non c'entrano.
 *
 * Tutto opzionale, tutto ricostruibile: una pratica che non ha mai aperto il pannello genera con
 * i default di sempre. La traduzione da qui all'ordine effettivo la fa `risolviPreferenze`
 * (`services/schemaImpianto/preferenze.ts`), che è anche l'unico vero validatore di questi dati.
 */
export interface SchemaPreferenze {
  /** Ordine degli stadi di trattamento. Chi non è nominato segue in coda, nell'ordine di default. */
  ordineStadi?: string[]
  /** Ordine dei serbatoi. Default: per `ubicazione` di scheda. */
  ordineSerbatoi?: string[]
  /**
   * Chi scarica condensa, per codice. Chiave assente = regola per tipo di `scaricaCondensa`
   * (buildSchemaModel.ts): è ciò che rende indolore il passaggio da «selezione per tipo» a «flag
   * per apparecchiatura» sulle pratiche salvate prima che questo campo esistesse.
   */
  condense?: Record<string, boolean>
  bypass?: SchemaPreferenzeBypass[]
}
```

E dentro `AdditionalInfo`, dopo `schemaLayout` (riga 42):

```ts
  /** §2.3 — scelte dell'operatore sulla forma dello schema. Vedi `SchemaPreferenze` qui sopra. */
  schemaPreferenze?: SchemaPreferenze
```

- [ ] **Step 4: Dichiarare il campo a Zod**

In `src/services/relazione/schema.ts`, dopo `schemaLayout` (riga 25):

```ts
  /**
   * Scelte dell'operatore sulla forma dello schema. Struttura libera per Zod, come `schemaLayout`
   * qui sopra e per la stessa ragione: la validazione vera la fa `risolviPreferenze`, che sa
   * scartare un riferimento a un'apparecchiatura sparita senza far fallire l'intero salvataggio.
   * Un `z.object` severo qui bloccherebbe la generazione della relazione per un dato storto in un
   * campo che non la riguarda.
   *
   * DEVE restare dichiarato: questo schema è un `z.object` senza `passthrough`, e `handleGenera`
   * salva `parsed.data` — una chiave non dichiarata viene cancellata in silenzio.
   */
  schemaPreferenze: z.any().optional(),
```

- [ ] **Step 5: Riportare il campo nel letterale del dialog Relazione**

In `src/components/relazione/RelazioneDataDialog.tsx`:

Nell'interfaccia `RelazioneDataDialogProps` (riga ~59), dopo `collegamentiCompressoriSerbatoi`:

```ts
  /** Preferenze dello schema. Questo dialog non le modifica: le ripassa così come sono, perché
   *  `handleGenera` riscrive l'intera colonna `additional_info` e ometterle le cancellerebbe. */
  schemaPreferenze: SchemaPreferenze
```

Aggiungere `SchemaPreferenze` all'import di tipi da `@/services/relazione/types` in testa al file,
e `schemaPreferenze` alla destrutturazione delle prop (riga ~80).

Nel `useMemo` di `additionalInfo` (righe 161-171):

```ts
  const additionalInfo: AdditionalInfo = useMemo(
    () => ({
      descrizioneAttivita: descrizioneAttivita.trim(),
      dataEmissione,
      compressoriGiri: giri,
      spessimetrica,
      collegamentiCompressoriSerbatoi,
      schemaLayout: schemaLayoutDaPersistere,
      schemaPreferenze,
    }),
    [
      descrizioneAttivita,
      dataEmissione,
      giri,
      spessimetrica,
      collegamentiCompressoriSerbatoi,
      schemaLayoutDaPersistere,
      schemaPreferenze,
    ]
  )
```

- [ ] **Step 6: Potare i riferimenti ai codici spariti**

In `src/utils/equipmentCodes.ts`, dentro `pruneAdditionalInfo`, **prima** del `return` finale:

```ts
  // Le preferenze dello schema citano codici di scheda in quattro posti. Si potano tutti, ma non
  // si "aggiusta" mai un gruppo by-pass: la contiguità la ricontrolla `risolviPreferenze`, che ha
  // sott'occhio l'ordine effettivo — qui l'informazione non c'è. Si tiene il campo `undefined`
  // quando non c'era, così una scheda che non ha mai aperto il pannello resta indistinguibile.
  let schemaPreferenze = src.schemaPreferenze
  if (schemaPreferenze) {
    const vivi = (codici: string[] | undefined, etichetta: string) =>
      (codici ?? []).filter((c) => {
        if (codes.has(c)) return true
        dropped.push(`${etichetta} ${c}`)
        return false
      })

    const condense: Record<string, boolean> = {}
    for (const [code, valore] of Object.entries(schemaPreferenze.condense ?? {})) {
      if (codes.has(code)) condense[code] = valore
      else dropped.push(`condense schema ${code}`)
    }

    const bypass = (schemaPreferenze.bypass ?? [])
      .map((gruppo) => ({
        id: gruppo.id,
        stadi: (gruppo.stadi ?? []).filter((c) => {
          if (codes.has(c)) return true
          dropped.push(`by-pass ${gruppo.id} → ${c}`)
          return false
        }),
      }))
      .filter((gruppo) => {
        if (gruppo.stadi.length > 0) return true
        dropped.push(`by-pass ${gruppo.id}`)
        return false
      })

    schemaPreferenze = {
      ...schemaPreferenze,
      ...(schemaPreferenze.ordineStadi ? { ordineStadi: vivi(schemaPreferenze.ordineStadi, 'ordine schema') } : {}),
      ...(schemaPreferenze.ordineSerbatoi
        ? { ordineSerbatoi: vivi(schemaPreferenze.ordineSerbatoi, 'ordine schema') }
        : {}),
      ...(schemaPreferenze.condense ? { condense } : {}),
      ...(schemaPreferenze.bypass ? { bypass } : {}),
    }
  }
```

E cambiare il `return` finale in:

```ts
  return {
    info: { ...src, compressoriGiri, spessimetrica, collegamentiCompressoriSerbatoi, schemaPreferenze },
    dropped,
  }
```

- [ ] **Step 7: Lanciare i test e vedere che passano**

Run: `npx vitest run src/services/relazione/__tests__/schemaLayoutPersistito.test.ts src/utils/__tests__/equipmentCodes.test.ts`
Expected: PASS, tutti.

- [ ] **Step 8: Portare lo stato in pagina**

In `src/pages/TechnicalDetails.tsx`:

Accanto agli altri `useState` dello schema (vicino a `const [collegamenti, setCollegamenti]`):

```ts
  // Le preferenze dello schema stanno qui accanto a `collegamenti`, e per la stessa ragione: le
  // scrive la finestra SCHEMA IMPIANTO, le rilegge la finestra Relazione per non cancellarle
  // generando il .docx.
  const [preferenzeSchema, setPreferenzeSchema] = useState<SchemaPreferenze>({})
```

Aggiungere `SchemaPreferenze` all'import di tipi da `@/services/relazione/types`.

Nell'effetto di semina (righe 194-205), dopo `setSchemaLayoutSalvato(...)`:

```ts
    setPreferenzeSchema(info.schemaPreferenze ?? {})
```

In `handleCloseSchemaDialog` (righe 273-300), dentro l'oggetto passato a `pruneAdditionalInfo`:

```ts
          schemaPreferenze: preferenzeSchema,
```

e aggiungere `preferenzeSchema` all'array di dipendenze di `useCallback` in coda (riga ~300).

Nel JSX, su `<RelazioneDataDialog>` (riga ~741) aggiungere:

```tsx
            schemaPreferenze={preferenzeSchema}
```

e su `<SchemaImpiantoDialog>` (riga ~765):

```tsx
            preferenze={preferenzeSchema}
            onPreferenzeChange={setPreferenzeSchema}
```

- [ ] **Step 9: Accettare le prop nella finestra SC**

In `src/components/relazione/SchemaImpiantoDialog.tsx`, aggiungere a `SchemaImpiantoDialogProps`
(con l'import di `SchemaPreferenze`):

```ts
  preferenze: SchemaPreferenze
  onPreferenzeChange: (preferenze: SchemaPreferenze) => void
```

**Non destrutturarle ancora**: il pannello che le consuma arriva nel Task 4, e destrutturare una
prop inutilizzata fa fallire il gate eslint. In questo step si tocca il **solo** tipo delle prop.

- [ ] **Step 10: Gate completo**

```bash
npx vitest run
npx tsc --noEmit
npx eslint src/services/relazione src/services/schemaImpianto src/components/relazione src/pages/TechnicalDetails.tsx src/utils/equipmentCodes.ts --max-warnings 0
```
Expected: tutto verde; nessuna fixture SVG toccata.

- [ ] **Step 11: Verifica dal vivo che il campo sopravvive davvero**

Il test copre Zod. Questo copre la catena intera, che è dove il difetto vivrebbe. Su una pratica di
prova (**non** ORVED né LOWA R&D):

```bash
# leggere additional_info prima
curl -s "$VITE_SUPABASE_URL/rest/v1/dm329_technical_data?select=additional_info&request_id=eq.<ID>" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Poi in pagina: aprire SC, chiudere, generare la relazione dalla finestra R, e rileggere. Il campo
`schemaPreferenze` (anche solo `{}`) deve esserci **dopo** la generazione.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(schema): le scelte sulla forma del disegno sopravvivono al salvataggio

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Il risolutore delle preferenze

Le preferenze invecchiano: un'apparecchiatura sparisce, un'altra compare, un gruppo by-pass perde
la contiguità. Questo modulo traduce ciò che è salvato in ciò che vale adesso. È dove sta tutta la
logica del pannello, così il componente resta muto.

**Files:**
- Create: `src/services/schemaImpianto/preferenze.ts`
- Test: `src/services/schemaImpianto/__tests__/preferenze.test.ts`

**Interfaces:**
- Consumes: `SchemaPreferenze` (Task 2); `SchemaNodo` (`./types`).
- Produces:

```ts
export interface PreferenzeRisolte {
  ordineStadi: string[]
  ordineSerbatoi: string[]
  condense: Set<string>
  bypass: { id: string; stadi: string[] }[]
  bypassScartati: string[]
}
export function risolviPreferenze(
  preferenze: SchemaPreferenze | undefined,
  stadiDiDefault: SchemaNodo[],
  serbatoiDiDefault: SchemaNodo[],
  scaricaDiDefault: (nodo: SchemaNodo) => boolean
): PreferenzeRisolte
export function ordinaPerElenco<T extends { id: string }>(elementi: T[], salvato: string[] | undefined): T[]
export function contigui(codici: string[], ordine: string[]): boolean
export function prossimoIdBypass(gruppi: { id: string }[]): string
export function improntaPreferenze(risolte: PreferenzeRisolte): string
```

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/services/schemaImpianto/__tests__/preferenze.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  contigui,
  improntaPreferenze,
  ordinaPerElenco,
  prossimoIdBypass,
  risolviPreferenze,
} from '../preferenze'
import type { SchemaNodo } from '../types'

const nodo = (id: string, tipo: SchemaNodo['tipo'] = 'filtro'): SchemaNodo => ({
  id,
  tipo,
  etichetta: id,
  gruppo: 'SALA_COMPRESSORI',
  valvoleSicurezza: [],
  origine: 'scheda',
})

const stadi = [nodo('F1'), nodo('E1', 'essiccatore'), nodo('F2'), nodo('F3')]
const serbatoi = [nodo('S1', 'serbatoio'), nodo('S2', 'serbatoio')]
const scaricaSempre = () => true

describe('ordinaPerElenco', () => {
  it('segue l’elenco e mette in coda chi non è nominato', () => {
    expect(ordinaPerElenco(stadi, ['F2', 'F1']).map((n) => n.id)).toEqual(['F2', 'F1', 'E1', 'F3'])
  })

  it('tiene fra loro l’ordine di default per chi non è nominato', () => {
    // E1 e F3 non sono nell'elenco: devono restare nell'ordine in cui arrivano, non invertirsi.
    expect(ordinaPerElenco(stadi, ['F2']).map((n) => n.id)).toEqual(['F2', 'F1', 'E1', 'F3'])
  })

  it('ignora un elenco che nomina chi non c’è', () => {
    expect(ordinaPerElenco(stadi, ['F9', 'E1']).map((n) => n.id)).toEqual(['E1', 'F1', 'F2', 'F3'])
  })

  it('senza elenco lascia l’ordine di default', () => {
    expect(ordinaPerElenco(stadi, undefined).map((n) => n.id)).toEqual(['F1', 'E1', 'F2', 'F3'])
  })
})

describe('contigui', () => {
  const ordine = ['F1', 'E1', 'F2', 'F3']
  it('riconosce un intervallo attaccato', () => {
    expect(contigui(['E1', 'F2'], ordine)).toBe(true)
  })
  it('riconosce un intervallo con un buco', () => {
    expect(contigui(['F1', 'F2'], ordine)).toBe(false)
  })
  it('non si fa ingannare dall’ordine in cui sono elencati', () => {
    expect(contigui(['F2', 'E1'], ordine)).toBe(true)
  })
  it('un solo elemento è sempre contiguo', () => {
    expect(contigui(['F2'], ordine)).toBe(true)
  })
  it('un elenco vuoto non è un intervallo', () => {
    expect(contigui([], ordine)).toBe(false)
  })
})

describe('prossimoIdBypass', () => {
  it('parte da bp1', () => {
    expect(prossimoIdBypass([])).toBe('bp1')
  })
  it('prende il primo intero libero, non il successivo del massimo', () => {
    expect(prossimoIdBypass([{ id: 'bp1' }, { id: 'bp3' }])).toBe('bp2')
  })
  it('non si confonde con un id che non segue la forma', () => {
    expect(prossimoIdBypass([{ id: 'bp1' }, { id: 'vecchio' }])).toBe('bp2')
  })
})

describe('risolviPreferenze', () => {
  it('senza preferenze usa i default', () => {
    const r = risolviPreferenze(undefined, stadi, serbatoi, scaricaSempre)
    expect(r.ordineStadi).toEqual(['F1', 'E1', 'F2', 'F3'])
    expect(r.ordineSerbatoi).toEqual(['S1', 'S2'])
    expect([...r.condense].sort()).toEqual(['E1', 'F1', 'F2', 'F3', 'S1', 'S2'])
    expect(r.bypass).toEqual([])
    expect(r.bypassScartati).toEqual([])
  })

  it('una condensa spenta a mano vince sul default', () => {
    const r = risolviPreferenze({ condense: { F2: false } }, stadi, serbatoi, scaricaSempre)
    expect(r.condense.has('F2')).toBe(false)
    expect(r.condense.has('F1')).toBe(true)
  })

  it('una condensa accesa a mano vince su un default negativo', () => {
    const r = risolviPreferenze({ condense: { F2: true } }, stadi, serbatoi, () => false)
    expect([...r.condense]).toEqual(['F2'])
  })

  it('tiene un gruppo by-pass ancora contiguo', () => {
    const r = risolviPreferenze({ bypass: [{ id: 'bp1', stadi: ['E1', 'F2'] }] }, stadi, serbatoi, scaricaSempre)
    expect(r.bypass).toEqual([{ id: 'bp1', stadi: ['E1', 'F2'] }])
    expect(r.bypassScartati).toEqual([])
  })

  it('riordina i membri del gruppo secondo l’ordine risolto', () => {
    const r = risolviPreferenze({ bypass: [{ id: 'bp1', stadi: ['F2', 'E1'] }] }, stadi, serbatoi, scaricaSempre)
    expect(r.bypass[0].stadi).toEqual(['E1', 'F2'])
  })

  it('scarta un gruppo che ha perso la contiguità e lo riporta', () => {
    // Riordinando gli stadi, E1 e F2 non sono più attaccati.
    const r = risolviPreferenze(
      { ordineStadi: ['E1', 'F1', 'F2', 'F3'], bypass: [{ id: 'bp1', stadi: ['E1', 'F2'] }] },
      stadi,
      serbatoi,
      scaricaSempre
    )
    expect(r.bypass).toEqual([])
    expect(r.bypassScartati).toEqual(['bp1'])
  })

  it('accorcia un gruppo che nomina un’apparecchiatura sparita', () => {
    const r = risolviPreferenze({ bypass: [{ id: 'bp1', stadi: ['E1', 'F9'] }] }, stadi, serbatoi, scaricaSempre)
    expect(r.bypass.map((g) => g.stadi)).toEqual([['E1']])
    expect(r.bypassScartati).toEqual([])
  })

  it('regge preferenze storte senza sollevare', () => {
    const storte = { ordineStadi: 'F1', condense: null, bypass: [{ id: 'bp1' }] } as never
    expect(() => risolviPreferenze(storte, stadi, serbatoi, scaricaSempre)).not.toThrow()
  })
})

describe('improntaPreferenze', () => {
  it('non cambia quando l’ordine di due chiavi cambia', () => {
    const a = risolviPreferenze({ condense: { F1: true, F2: false } }, stadi, serbatoi, scaricaSempre)
    const b = risolviPreferenze({ condense: { F2: false, F1: true } }, stadi, serbatoi, scaricaSempre)
    expect(improntaPreferenze(a)).toBe(improntaPreferenze(b))
  })

  it('cambia quando cambia l’ordine degli stadi', () => {
    const a = risolviPreferenze(undefined, stadi, serbatoi, scaricaSempre)
    const b = risolviPreferenze({ ordineStadi: ['F2'] }, stadi, serbatoi, scaricaSempre)
    expect(improntaPreferenze(a)).not.toBe(improntaPreferenze(b))
  })
})
```

- [ ] **Step 2: Lanciare i test e vedere che falliscono**

Run: `npx vitest run src/services/schemaImpianto/__tests__/preferenze.test.ts`
Expected: FAIL — il modulo `../preferenze` non esiste.

- [ ] **Step 3: Scrivere il modulo**

Creare `src/services/schemaImpianto/preferenze.ts`:

```ts
/**
 * Traduzione delle scelte salvate dall'operatore (`additional_info.schemaPreferenze`) in ciò che
 * vale adesso, sulla scheda com'è adesso. Funzioni pure: qui vive tutta la logica del pannello
 * della finestra SCHEMA IMPIANTO, così il componente resta muto e provabile per lettura.
 *
 * Le preferenze invecchiano — un'apparecchiatura sparisce, un'altra compare, un gruppo by-pass
 * perde la contiguità — e questo modulo è l'unico posto che sa cosa farne. `pruneAdditionalInfo`
 * (utils/equipmentCodes.ts) toglie prima i riferimenti a codici che la scheda non ha più; qui si
 * fa il resto, che richiede di sapere l'ORDINE, informazione che lì non c'è.
 *
 * Difensivo di proposito: `schemaPreferenze` è dichiarato `z.any()` a Zod, quindi un dato storto
 * arriva fin qui invece di far fallire il salvataggio. Meglio ignorarlo che sollevare a metà
 * generazione dello schema.
 */
import type { SchemaPreferenze } from '@/services/relazione/types'
import type { SchemaNodo } from './types'

export interface PreferenzeRisolte {
  /** Codici degli stadi di trattamento, nell'ordine in cui vanno disegnati da sinistra a destra. */
  ordineStadi: string[]
  ordineSerbatoi: string[]
  /** Chi scarica condensa. Un `Set` e non una mappa: il default è già stato applicato. */
  condense: Set<string>
  /** Gruppi ancora validi, coi membri riordinati secondo `ordineStadi`. */
  bypass: { id: string; stadi: string[] }[]
  /** Id dei gruppi caduti perché non più contigui: da dire all'operatore, non da riparare. */
  bypassScartati: string[]
}

const elenco = (valore: unknown): string[] =>
  Array.isArray(valore) ? valore.filter((v): v is string => typeof v === 'string') : []

/**
 * Ordina secondo l'elenco salvato: prima chi è nominato, nell'ordine in cui è nominato, poi chi
 * non lo è — e questi ultimi **fra loro nell'ordine di default**, non in ordine di arrivo. Senza
 * quest'ultima regola due filtri aggiunti insieme comparirebbero invertiti, e l'operatore
 * dovrebbe riordinare qualcosa che non ha mai toccato.
 */
export function ordinaPerElenco<T extends { id: string }>(elementi: T[], salvato: string[] | undefined): T[] {
  const posizione = new Map(elenco(salvato).map((id, i) => [id, i]))
  return elementi
    .map((elemento, difetto) => ({ elemento, difetto, scelto: posizione.get(elemento.id) }))
    .sort((a, b) => {
      if (a.scelto !== undefined && b.scelto !== undefined) return a.scelto - b.scelto
      if (a.scelto !== undefined) return -1
      if (b.scelto !== undefined) return 1
      return a.difetto - b.difetto
    })
    .map((v) => v.elemento)
}

/**
 * Vero se i codici occupano posizioni consecutive nell'ordine dato. È la condizione perché un
 * by-pass sia disegnabile: due soli TEE, uno prima del primo scavalcato e uno dopo l'ultimo, non
 * possono saltare un'apparecchiatura in mezzo e rimetterla in linea.
 */
export function contigui(codici: string[], ordine: string[]): boolean {
  if (codici.length === 0) return false
  const posizioni = codici.map((c) => ordine.indexOf(c))
  if (posizioni.some((p) => p < 0)) return false
  const min = Math.min(...posizioni)
  const max = Math.max(...posizioni)
  return max - min + 1 === new Set(posizioni).size
}

/**
 * Il primo intero libero, non il successivo del massimo: sciogliendo `bp2` e ricreando un gruppo,
 * l'operatore si ritrova `bp2` invece di `bp3`, e gli id non crescono senza fine su una pratica
 * ritoccata a lungo.
 */
export function prossimoIdBypass(gruppi: { id: string }[]): string {
  const presi = new Set(
    gruppi.map((g) => Number(/^bp(\d+)$/.exec(g.id)?.[1])).filter((n) => Number.isInteger(n))
  )
  let n = 1
  while (presi.has(n)) n++
  return `bp${n}`
}

export function risolviPreferenze(
  preferenze: SchemaPreferenze | undefined,
  stadiDiDefault: SchemaNodo[],
  serbatoiDiDefault: SchemaNodo[],
  scaricaDiDefault: (nodo: SchemaNodo) => boolean
): PreferenzeRisolte {
  const p = (preferenze ?? {}) as SchemaPreferenze
  const stadi = ordinaPerElenco(stadiDiDefault, p.ordineStadi)
  const ordineStadi = stadi.map((n) => n.id)
  const ordineSerbatoi = ordinaPerElenco(serbatoiDiDefault, p.ordineSerbatoi).map((n) => n.id)

  // Chiave assente = regola per tipo: è ciò che rende indolore il passaggio da «selezione per
  // tipo» a «flag per apparecchiatura» su una pratica salvata prima che il pannello esistesse.
  const scelte = p.condense && typeof p.condense === 'object' ? p.condense : {}
  const condense = new Set<string>()
  for (const nodo of [...serbatoiDiDefault, ...stadiDiDefault]) {
    const scelta = scelte[nodo.id]
    if (typeof scelta === 'boolean' ? scelta : scaricaDiDefault(nodo)) condense.add(nodo.id)
  }

  const bypass: { id: string; stadi: string[] }[] = []
  const bypassScartati: string[] = []
  for (const gruppo of Array.isArray(p.bypass) ? p.bypass : []) {
    if (!gruppo || typeof gruppo.id !== 'string') continue
    // Riordinati secondo l'ordine risolto, non secondo com'erano salvati: l'operatore può aver
    // riordinato le righe dopo aver creato il gruppo, e il disegno segue l'ordine, non la memoria.
    const membri = ordineStadi.filter((id) => elenco(gruppo.stadi).includes(id))
    if (membri.length === 0) continue
    if (!contigui(membri, ordineStadi)) {
      bypassScartati.push(gruppo.id)
      continue
    }
    bypass.push({ id: gruppo.id, stadi: membri })
  }

  return { ordineStadi, ordineSerbatoi, condense, bypass, bypassScartati }
}

/**
 * Impronta stabile delle preferenze risolte, per dire all'operatore «il disegno salvato è stato
 * generato con altre scelte: premi Rigenera da capo». Non entra in nessun calcolo geometrico.
 * Le chiavi si ordinano perché due oggetti uguali scritti in ordine diverso devono dare la stessa
 * impronta, o l'avviso comparirebbe da solo.
 */
export function improntaPreferenze(risolte: PreferenzeRisolte): string {
  return JSON.stringify({
    stadi: risolte.ordineStadi,
    serbatoi: risolte.ordineSerbatoi,
    condense: [...risolte.condense].sort(),
    bypass: risolte.bypass.map((g) => ({ id: g.id, stadi: g.stadi })),
  })
}
```

- [ ] **Step 4: Lanciare i test e vedere che passano**

Run: `npx vitest run src/services/schemaImpianto/__tests__/preferenze.test.ts`
Expected: PASS, tutti.

- [ ] **Step 5: Gate completo**

```bash
npx vitest run
npx tsc --noEmit
npx eslint src/services/schemaImpianto --max-warnings 0
```

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/preferenze.ts src/services/schemaImpianto/__tests__/preferenze.test.ts
git commit -m "feat(schema): le scelte salvate si traducono in ciò che vale sulla scheda di adesso

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Il pannello nella finestra SCHEMA IMPIANTO

Tre liste, una per famiglia: compressori (solo condense), serbatoi (ordine + condense), linea di
trattamento (ordine + condense + by-pass). Una lista sola permetterebbe di trascinare un
compressore in mezzo ai filtri, gesto che il disegno non sa rendere.

**Files:**
- Create: `src/components/relazione/PannelloPreferenzeSchema.tsx`
- Modify: `src/components/relazione/SchemaImpiantoDialog.tsx:93-135`
- Test: nessuno (vedi Global Constraints — la logica sta in `preferenze.ts`, già coperta)

**Interfaces:**
- Consumes: `risolviPreferenze`, `contigui`, `prossimoIdBypass` (Task 3); prop `preferenze` /
  `onPreferenzeChange` (Task 2).
- Produces: `export default function PannelloPreferenzeSchema(props: PannelloPreferenzeSchemaProps)`

```ts
export interface PannelloPreferenzeSchemaProps {
  scheda: SchedaDatiCompleta
  preferenze: SchemaPreferenze
  onChange: (preferenze: SchemaPreferenze) => void
}
```

- [ ] **Step 1: Scrivere il componente**

Creare `src/components/relazione/PannelloPreferenzeSchema.tsx`, con questa intestazione:

```tsx
/**
 * Pannello delle scelte sulla forma dello schema: ordine delle apparecchiature, chi scarica
 * condensa, quali stanno sotto lo stesso by-pass.
 *
 * Non tocca il disegno. Scrive solo `additional_info.schemaPreferenze`, e l'effetto si vede
 * premendo «Rigenera da capo»: decisione del committente, perché il disegno può essere già stato
 * rifinito a mano e nessun gesto in questo pannello deve poter buttare via quel lavoro.
 *
 * Tre liste separate per famiglia, non una sola: la contiguità che un by-pass richiede ha senso
 * solo dentro la linea di trattamento, e una lista unica permetterebbe di trascinare un
 * compressore in mezzo ai filtri — un gesto che il disegno non sa rendere.
 *
 * Nessuna logica qui: ordine, contiguità e id dei gruppi vengono da `preferenze.ts`, che è
 * provabile senza DOM (il progetto non scrive test di interfaccia).
 */
```

Contenuto funzionale, in ordine:

1. Costruire le tre famiglie dalla scheda, con lo stesso ordine di default che userà il
   generatore. I `SchemaNodo` finti servono solo a riusare `risolviPreferenze`: bastano `id`,
   `tipo` ed `etichetta`.
   ```tsx
   // Serbatoi: SALA_COMPRESSORI in testa, LINEA_DISTRIBUZIONE dopo (decisione del committente).
   // `sort` è stabile in ES2019+: dentro ciascun gruppo resta l'ordine di scheda.
   const rangoUbicazione = (s: Serbatoio) => (s.ubicazione === 'LINEA_DISTRIBUZIONE' ? 1 : 0)
   ```
   Gli stadi seguono lo stesso rango di `ordinaCatenaTrattamento`: prefiltri (`tipo === 'PREFILTRO'`)
   → essiccatori → filtri di linea → separatori.

2. Risolvere: `const risolte = useMemo(() => risolviPreferenze(preferenze, stadi, serbatoi, () => true), [...])`.
   Il quarto argomento è `() => true` **solo in questo blocco**: il pannello mostra la casella
   spuntata per ogni apparecchiatura che può scaricare. Vedi «Debito lasciato di proposito».

3. Tre `<DndContext>` + `<SortableContext>`, uno per lista, sul modello di
   `src/components/admin/FieldSchemaBuilder.tsx:28-42, 311-335`. `arrayMove` riscrive
   `ordineStadi` / `ordineSerbatoi` **completi**, non parziali: così l'ordine mostrato è sempre
   quello salvato, e non dipende da quali righe sono state trascinate.

4. Ogni riga: maniglia di trascinamento, codice, etichetta, e una `Checkbox` «Condense» che scrive
   `condense[id]` **esplicito** (`true` o `false`), senza mai togliere la chiave — toglierla
   farebbe tornare il default, e la spunta si rimetterebbe da sola sotto le dita dell'operatore.

5. Nella sola lista degli stadi: una `Checkbox` di selezione a sinistra, e sotto la lista una barra
   con «Crea by-pass», abilitata solo se `contigui(selezionati, risolte.ordineStadi)`. Alla
   pressione:
   ```tsx
   onChange({
     ...preferenze,
     bypass: [...risolte.bypass, { id: prossimoIdBypass(risolte.bypass), stadi: selezionati }],
   })
   ```
   Le righe di un gruppo portano un `Box` con `borderLeft: '3px solid'` e, sulla prima riga del
   gruppo, un `Chip` col nome e una `IconButton` «Sciogli» che rimuove quel gruppo da `bypass`.

6. Se `risolte.bypassScartati.length > 0`, un `Alert severity="warning"`: «Un by-pass è stato
   sciolto perché le apparecchiature che scavalcava non sono più una alla fine dell'altra: …».

- [ ] **Step 2: Montarlo nella finestra SC**

In `src/components/relazione/SchemaImpiantoDialog.tsx`, fra il `GruppoCampi` dei collegamenti
(che finisce a riga ~124) e `<SchemaImpiantoSection …/>` (riga ~126):

```tsx
        <GruppoCampi titolo="Ordine e opzioni delle apparecchiature">
          <PannelloPreferenzeSchema scheda={scheda} preferenze={preferenze} onChange={onPreferenzeChange} />
        </GruppoCampi>
```

Destrutturare finalmente `preferenze` e `onPreferenzeChange` dalle prop (il tipo è già a posto dal
Task 2). Portare il `Dialog` da `maxWidth="md"` a `maxWidth="lg"`: tre liste con flag e gruppi non
stanno in `md` senza andare a capo.

- [ ] **Step 3: Gate completo**

```bash
npx vitest run
npx tsc --noEmit
npx eslint src/components/relazione src/services/schemaImpianto --max-warnings 0
```
Expected: verde. **Le fixture SVG intatte**: questo task non tocca il disegno.

- [ ] **Step 4: Verifica in pagina**

Avviare il dev server (`npm run dev`; **verificare quale processo tiene la porta** — in questo
progetto la 5173 è di un altro progetto e i server dei worktree sopravvivono alla sessione che li
ha accesi). Su una pratica di prova, **non** ORVED (`a8bbdbe1-…`) né LOWA R&D (`c6f56ca5-…`):

1. Aprire SC: le tre liste compaiono, con le apparecchiature della scheda nell'ordine di default.
2. Trascinare due stadi, spegnere una condensa, creare un by-pass su due righe attaccate.
3. Chiudere e riaprire: tutto com'era.
4. Ricaricare la pagina: tutto com'era.
5. Generare la relazione da «R» e riaprire SC: **tutto com'era** (è il passo che smaschera la
   cancellazione di Zod, se qualcosa nel Task 2 è sfuggito).
6. Selezionare due righe **non** attaccate: «Crea by-pass» resta spento.
7. Creare un by-pass, poi trascinare un'apparecchiatura in mezzo al gruppo: compare l'avviso e il
   gruppo sparisce.
8. **Il disegno non deve essere cambiato in nessuno di questi passaggi.**

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(schema): l'ordine, le condense e i by-pass si scelgono in finestra

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Chiusura del blocco

- [ ] `npx vitest run` — tutto verde, e le tre fixture SVG mai toccate (`git log --stat` non le
      nomina in nessuno dei quattro commit).
- [ ] Aprire ORVED e LOWA R&D, chiudere senza toccare nulla, e verificare che `additional_info`
      sia **identico byte per byte** a prima (leggere prima e dopo via API REST e confrontare).
- [ ] Annotare in coda al piano un paragrafo «cosa è andato diversamente», come da prassi del
      modulo.
- [ ] **Non fondere ancora su `main`**: il Blocco 2 continua su questo stesso ramo. Il merge
      simulato con `git merge-tree` contro `origin/main` aggiornato si fa alla fine del Blocco 3.

## Debito lasciato di proposito

- `PannelloPreferenzeSchema` passa `() => true` come regola di default per le condense. Il Blocco 2
  rende `scaricaCondensa` una funzione condivisa: a quel punto **pannello e generatore devono
  passare la stessa**, o la spunta mostrata all'operatore mentirebbe sul disegno che uscirà. È il
  primo lavoro del Blocco 2.
- `improntaPreferenze` esiste ma nessuno la chiama: l'avviso «le preferenze sono cambiate, rigenera»
  arriva nel Blocco 3 insieme a `LayoutSalvato.preferenzeApplicate`.
- `tDaAncoraggio` esiste ma nessuno la chiama: la usa `segniAncorati.ts` nel Blocco 2.
