# Schema d'impianto DM329 — Blocco D3: il TEE

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rimpicciolire il pallino del TEE senza riaprire il buco fra tubo e giunzione, e permettere di inserire un TEE **trascinandolo sopra un tubo esistente**, che al rilascio si spezza in due tratti collegati alla giunzione.

**Architecture:** Le due cose sono una sola, in fondo: entrambe dipendono dal **portare le quattro ancore della giunzione al centro del riquadro**. Al centro, i tubi convergono in un punto solo — quindi non c'è buco a qualunque raggio, e il pallino può scendere a diametro 10 — e la scelta di quale ancora usare per ciascuna metà del tubo spezzato diventa indifferente, perché tutte e quattro danno lo stesso punto. Ciò che va salvato è la **presa**: il TEE deve restare afferrabile e collegabile dai quattro lati come oggi. Nasce quindi nel registro dei simboli la nozione di *punto di presa*, distinta dall'ancora, con l'ancora come valore predefinito e **consumata solo dall'interfaccia** — `posizioneAncora` non si tocca. Lo spezzamento vive in un modulo nuovo di **geometria pura** (quale arco è più vicino a un punto; come si spezza un arco in un punto), consumato da un hook dell'editor che segue lo stesso schema di `useGomiti`/`useSegniTubo`/`useTrascinamentoTratto`.

**Tech Stack:** React 18 + TypeScript (strict:false) + Material UI 6 + @xyflow/react + Vitest (jsdom) + @testing-library/react (`renderHook`, senza montare componenti)

**Spec:** `docs/superpowers/specs/2026-08-14-schema-impianto-blocco-d-design.md`, sezione **Blocco D3 — il TEE** (righe 322-393)

## Global Constraints

- **NESSUN merge e nessun push su `main`** finché il committente non lo dice. Solo commit locali sul ramo `worktree-schema-impianto-dm329`. La decisione è stata riconfermata a chiusura del D2, non è decaduta.
- **Il documento consegnato CAMBIA in questo blocco, ma solo dove c'è un TEE.** Non è più il regime del D2 («non cambia di un byte»). Sulle pratiche senza TEE non deve cambiare nulla, e **va dimostrato, non asserito** — Task 6. Le due sole differenze attese, sull'impianto che il TEE ce l'ha, sono: il raggio del pallino (`r="12"` → `r="5"`) e i capi dei tubi che vi arrivano, spostati dal bordo del riquadro al centro (+12 su una coordinata). **Qualunque terza differenza è un difetto**, non un aggiornamento del riferimento.
- **`posizioneAncora` (renderSvg.ts) non si tocca.** Resta la fonte unica su dove sta un capo di tubo. La nozione di *punto di presa* vive **solo nell'interfaccia**: nessuna funzione del documento la chiama. Questo modulo ha già pagato due volte per aver avuto due fonti su «dove sta un capo» — i 5 unità di scarto su ogni capo di ogni tubo e la terza definizione privata dentro `useGomiti`.
- **Ogni test nuovo va visto fallire per MUTAZIONE**, su un'implementazione plausibilmente sbagliata. Un rosso da «funzione non definita» non prova nulla. **Dieci test verdi che non provavano niente** sono stati scoperti così in tre blocchi, e nel D2 la stessa classe è tornata due volte — l'ultima con `agganciaPosizioneGomito`, quattro test verdi su una funzione **irraggiungibile dalla tela**. Quando una funzione nuova ha un chiamante di produzione, va provato che il chiamante la raggiunge con input che la esercitano davvero, non solo che la funzione è giusta.
- **Le prove si producono con una redirezione su file, mai trascrivendo.**
- **Ogni commento toccato descrive il repo com'è a fine task**, non come sarà, e **non più di ciò che è vero senza condizioni**. Nel D2 la serie dei commenti falsi si è fermata a cinque, e ciò che l'ha fermata è stato **accorciare invece di precisare**: quando un commento sbaglia due volte sullo stesso punto, il difetto non è nella precisione ma nella portata.
- **L'aritmetica non va nei componenti**: il calcolo sta nei moduli puri perché sia collaudabile (`CLAUDE.md`, «no UI test»). Gli hook si provano con `renderHook`/`act` **senza montare componenti** — il precedente in casa è `useTrascinamentoTratto.test.ts`, ed è approvato.
- **NON eseguire `prettier --write`**: il `.prettierrc` non corrisponde allo stile effettivo del codice e riformatta interi file. È già successo nel D1.
- **Localizzare per contenuto, mai per numero di riga.**
- `minZoom={0.1}` è basso apposta: **non alzarlo**. `snapGrid={[10, 10]}` resta.
- **Il committente non usa ancora l'editor per i propri schemi**: nessun layout salvato da preservare, e **nessuna scelta va motivata con la retrocompatibilità**.
- Baseline: testa **`b0a538d`**, albero pulito, `tsc --noEmit` pulito, **979 test su 80 file verdi** — eseguita all'apertura del blocco (`exit=0`, 109s), non ripresa dal ledger. Dev server sulla **5176, dal worktree** (PID 24820, `CommandLine` verificato sul percorso del worktree e non del checkout principale).

---

## I fatti misurati che questo piano usa

Letti nel codice il 14-08-2026, alla testa `b0a538d`. **Non sono ipotesi: chi implementa può darli per buoni**, ma li rilegga se un test non torna.

| Fatto | Dove | Perché conta qui |
|---|---|---|
| Giunzione: riquadro **24×24**, quattro ancore sulle **mezzerie dei lati** — `sx (0,12)`, `dx (24,12)`, `alto (12,0)`, `basso (12,24)` | `symbols/index.ts`, `REGISTRO_SIMBOLI.giunzione` | Sono le posizioni che diventano **punti di presa**; le ancore vanno al centro |
| `simboloGiunzione` disegna `<circle cx=12 cy=12 r=12>` — raggio = metà larghezza | `symbols/index.ts` | Scende a `r=5` |
| `latoDi(ancora, dim)` sceglie il lato **col minimo fra le quattro distanze dai bordi**, con `a.d <= b.d` nel `reduce` | `SchemaNodeSymbol.tsx` | Con quattro ancore in (12,12) le distanze sono tutte 12: **restituirebbe `Left` a tutte e quattro** |
| L'handle è disegnato su `left: ancora.x, top: ancora.y` con `translate(-50%,-50%)`; lato = `min(10, min(w,h)/3)` = **8** sulla giunzione | `SchemaNodeSymbol.tsx` | La presa va disegnata sulla **presa**, non sull'ancora; il lato dell'handle non cambia |
| `capiDegliArchi` calcola i capi con `posizioneAncora`, **non** con `sourceX`/`sourceY` | `conversioneFlow.ts` | I capi seguiranno le ancore al centro **senza toccare nulla** |
| `instrada` ignora stile e quote **solo quando i gomiti non sono vuoti** (`tratti.ts`, `if (gomiti && gomiti.length > 0)`) | `tratti.ts` | Una **metà senza gomiti tornerebbe alla rotta nativa del suo stile**: è il motivo per cui lo spezzamento fissa sempre la forma |
| `onNodesChange` scrive in cronologia con `applica` al **primo evento di posizione** del gesto, e da lì in poi usa `aggiornaSenzaCronologia` | `SchemaEditor.tsx` | È ciò che permette **un solo Ctrl+Z** per l'inserimento: vedi Task 4 |
| Il riferimento SVG committato (`fixtures/svgRiferimentoSenzaTesti.ts`) copre compressore + serbatoio orizzontale + utenze: **nessuna giunzione** | `__tests__/fixtures/` | **Non deve cambiare**, ed è la prima prova che le pratiche senza TEE non cambiano |
| `corpoNodo`, `dimensioniLayout`, `calcolaMuro` leggono l'**ingombro** (24×24), mai le ancore | `layout.ts` | Il riquadro non cambia: nessun effetto su tela, muro o dimensioni della pagina |
| `DIMENSIONI.giunzione` è l'unico posto che dichiara il riquadro; `DIMENSIONI_NODO.giunzione` lo rilegge | `symbols/index.ts` | Non si duplica un secondo 24 |

---

## Struttura dei file

| File | Responsabilità | Task |
|---|---|---|
| `src/services/schemaImpianto/types.ts` | `SchemaAncora` acquista `presa?` e `lato?`; nasce `SchemaLatoAncora`. | 1 |
| `src/services/schemaImpianto/symbols/index.ts` | `presaDi(ancora)`, con l'ancora come valore predefinito. | 1 |
| `src/components/schemaImpianto/SchemaNodeSymbol.tsx` | L'handle si disegna sulla **presa**; `latoDi` preferisce il lato dichiarato. | 1 |
| `src/components/schemaImpianto/__tests__/ancorePresa.test.ts` | **Nuovo.** Prove di `presaDi` e `latoDi`, e l'invariante «chi dichiara `presa` dichiara `lato`». | 1, 2 |
| `src/services/schemaImpianto/symbols/index.ts` | Le quattro ancore della giunzione al centro, con presa e lato; pallino a diametro 10. | 2 |
| `src/services/schemaImpianto/__tests__/simboli.test.ts` | I due test che fissavano la geometria vecchia della giunzione, riscritti. | 2 |
| `src/services/schemaImpianto/inserimentoTee.ts` | **Nuovo.** Geometria pura dello spezzamento: arco più vicino a un punto, spezzamento di un arco, identificativi delle due metà. | 3 |
| `src/services/schemaImpianto/__tests__/inserimentoTee.test.ts` | **Nuovo.** Prove del modulo sopra. | 3 |
| `src/components/schemaImpianto/useInserimentoTee.ts` | **Nuovo.** Il gesto: seguire il trascinamento di un TEE, evidenziare il tubo sotto, spezzarlo al rilascio in **un solo passo di cronologia**. | 4 |
| `src/components/schemaImpianto/__tests__/useInserimentoTee.test.ts` | **Nuovo.** Prove dell'hook con `renderHook`, senza montare componenti. | 4 |
| `src/components/schemaImpianto/conversioneFlow.ts` | `fondiDatiArchi` porta anche `evidenziato`. | 5 |
| `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` | `SchemaEdgeData.evidenziato`; il tratto evidenziato si vede. | 5 |
| `src/components/schemaImpianto/SchemaEditor.tsx` | Cablaggio: i tre gestori del trascinamento nodo compongono guide e inserimento. | 5 |
| `src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts` | **Nuovo.** Riferimento SVG di un impianto **con** TEE, generato dal codice nuovo. | 6 |

**Pre-flight scan — le coppie di task che condividono un file.** Chi esegue il Task 2 apra il diff del Task 1 prima di cominciare, e così via:

- `symbols/index.ts`: Task 1 (`presaDi`) e Task 2 (registro + `simboloGiunzione`).
- `SchemaNodeSymbol.tsx`: Task 1 (presa e lato). Nessun altro task lo tocca.
- `__tests__/ancorePresa.test.ts`: creato nel Task 1, **esteso** nel Task 2.
- `conversioneFlow.ts`: Task 5 soltanto — ma il Task 4 ne **legge** `polilineaDellArco` e `capiDellArco`.
- `SchemaEdgeTubazione.tsx`: Task 5 soltanto — il Task 4 ne importa il **tipo** `SchemaEdgeData`.

---

### Task 1: La nozione di punto di presa, senza spostare nulla

**Files:**
- Modify: `src/services/schemaImpianto/types.ts` (`SchemaAncora`)
- Modify: `src/services/schemaImpianto/symbols/index.ts` (nuova `presaDi`)
- Modify: `src/components/schemaImpianto/SchemaNodeSymbol.tsx` (`latoDi`, posizione dell'handle, commento di `latoHandle`)
- Test: `src/components/schemaImpianto/__tests__/ancorePresa.test.ts` (**nuovo**)

**Interfaces:**
- Consumes: nulla
- Produces:
  - `type SchemaLatoAncora = 'sx' | 'dx' | 'alto' | 'basso'` (types.ts)
  - `SchemaAncora.presa?: { x: number; y: number }` e `SchemaAncora.lato?: SchemaLatoAncora`
  - `function presaDi(ancora: SchemaAncora): { x: number; y: number }` (symbols/index.ts)
  - `latoDi(ancora, dim)` con la stessa firma: preferisce `ancora.lato`, altrimenti deduce come oggi

**Contesto per chi implementa.** Questo task **non sposta nessuna ancora e non cambia nessun disegno**: introduce solo la distinzione fra *dove arriva il tubo* (l'ancora) e *dove si afferra il simbolo* (la presa), con la presa che per ogni simbolo esistente coincide con l'ancora. A fine task la suite intera dev'essere verde **senza aver toccato un solo test preesistente** — riferimento SVG committato compreso. Se qualcosa cade, è un difetto di questo task, non un aggiornamento da fare.

Il `lato` esiste perché la spec lo chiede a chiare lettere: «con quattro ancore coincidenti, la funzione che deduce il lato di react-flow dalla posizione dell'ancora diventa degenere. Il lato va reso **esplicito** nella definizione dell'ancora, non dedotto». La deduzione resta com'è per tutti gli altri simboli: si aggiunge una scorciatoia davanti, non una seconda strada.

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/components/schemaImpianto/__tests__/ancorePresa.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Position } from '@xyflow/react'
import { REGISTRO_SIMBOLI, presaDi } from '@/services/schemaImpianto/symbols'
import type { SchemaAncora } from '@/services/schemaImpianto/types'
import { latoDi } from '../SchemaNodeSymbol'

const RIQUADRO = { larghezza: 100, altezza: 60 }

describe('presaDi', () => {
  // Il caso di ogni simbolo esistente: nessuna presa dichiarata, si afferra sull'ancora.
  it('senza presa dichiarata restituisce l’ancora', () => {
    const ancora: SchemaAncora = { id: 'sx', x: 6, y: 49, accetta: ['aria'] }
    expect(presaDi(ancora)).toEqual({ x: 6, y: 49 })
  })

  it('con la presa dichiarata restituisce quella, non l’ancora', () => {
    const ancora: SchemaAncora = { id: 'sx', x: 12, y: 12, accetta: ['aria'], presa: { x: 0, y: 12 } }
    expect(presaDi(ancora)).toEqual({ x: 0, y: 12 })
  })

  // Il valore restituito non deve essere l'oggetto `presa` stesso né l'ancora: chi lo riceve
  // lo usa per costruire uno stile, e una mutazione accidentale corromperebbe il registro,
  // che è un modulo condiviso da documento ed editor.
  it('non restituisce l’oggetto del registro', () => {
    const ancora: SchemaAncora = { id: 'sx', x: 12, y: 12, accetta: ['aria'], presa: { x: 0, y: 12 } }
    expect(presaDi(ancora)).not.toBe(ancora.presa)
  })
})

describe('latoDi', () => {
  // La deduzione di sempre, che deve restare intatta per tutti i simboli senza `lato`.
  it('senza lato dichiarato deduce il bordo più vicino', () => {
    expect(latoDi({ id: 'sx', x: 6, y: 30, accetta: ['aria'] }, RIQUADRO)).toBe(Position.Left)
    expect(latoDi({ id: 'dx', x: 94, y: 30, accetta: ['aria'] }, RIQUADRO)).toBe(Position.Right)
    expect(latoDi({ id: 'alto', x: 50, y: 4, accetta: ['aria'] }, RIQUADRO)).toBe(Position.Top)
    expect(latoDi({ id: 'basso', x: 50, y: 56, accetta: ['aria'] }, RIQUADRO)).toBe(Position.Bottom)
  })

  // Il lato dichiarato vince anche quando la deduzione direbbe altro: è il caso della
  // giunzione, dove le quattro ancore coincidono e la deduzione è degenere.
  it('il lato dichiarato vince sulla deduzione', () => {
    // Annotata, non dedotta: senza il tipo esplicito `accetta` diventerebbe `string[]`, che
    // non è assegnabile a `SchemaTipoAggancio[]` — la costante non ha un tipo contestuale
    // come lo hanno gli argomenti passati direttamente a `latoDi`.
    const alCentro: SchemaAncora = { id: 'x', x: 50, y: 30, accetta: ['aria'] }
    expect(latoDi({ ...alCentro, lato: 'basso' }, RIQUADRO)).toBe(Position.Bottom)
    expect(latoDi({ ...alCentro, lato: 'dx' }, RIQUADRO)).toBe(Position.Right)
    expect(latoDi({ ...alCentro, lato: 'alto' }, RIQUADRO)).toBe(Position.Top)
    expect(latoDi({ ...alCentro, lato: 'sx' }, RIQUADRO)).toBe(Position.Left)
  })
})

describe('il registro dei simboli', () => {
  // Regola del registro: la deduzione di `latoDi` lavora sull'ANCORA, non sulla presa —
  // quindi un attacco che dichiara una presa altrove senza dichiarare il lato finirebbe
  // appoggiato al lato sbagliato, in silenzio.
  it('ogni ancora che dichiara una presa dichiara anche il lato', () => {
    const conPresa = Object.values(REGISTRO_SIMBOLI).flatMap((d) => d.ancore.filter((a) => a.presa))
    expect(conPresa.every((a) => Boolean(a.lato))).toBe(true)
  })
})
```

> **Nota per chi implementa:** l'ultimo test è **vacuamente vero** a fine Task 1 (nessuna presa esiste ancora nel registro) e diventa sostanziale nel Task 2. È scritto qui perché è la regola che rende sicura la nozione introdotta qui; dichiaralo nel report come «vacuo a questo task, esercitato nel Task 2».

- [ ] **Step 2: Eseguire i test e vederli fallire**

```bash
npx vitest run src/components/schemaImpianto/__tests__/ancorePresa.test.ts > /tmp/d3-task1-rosso.txt 2>&1; echo "exit=$?"; tail -20 /tmp/d3-task1-rosso.txt
```

Atteso: fallimento per `presaDi` non esportata. **Questo rosso non prova nulla**: la prova è lo Step 6.

- [ ] **Step 3: Allargare `SchemaAncora`**

In `src/services/schemaImpianto/types.ts`, sopra `SchemaAncora`, aggiungere:

```ts
/**
 * Lato del riquadro d'ingombro su cui affacciare la maniglia di un attacco sulla tela.
 * I nomi sono quelli dei lati, gli stessi che il registro usa già come id delle ancore della
 * giunzione. Vive qui e non come `Position` di @xyflow/react perché il registro dei simboli è
 * un servizio: il documento non conosce react-flow, e la traduzione la fa `latoDi`
 * (SchemaNodeSymbol.tsx), l'unico punto che ha diritto di conoscere entrambi i vocabolari.
 */
export type SchemaLatoAncora = 'sx' | 'dx' | 'alto' | 'basso'
```

e, dentro `SchemaAncora`, dopo `accetta`:

```ts
  /**
   * Dove si AFFERRA questo attacco sulla tela dell'editor, quando è diverso da dove il tubo ci
   * arriva. Assente per ogni simbolo tranne la giunzione: si afferra sull'ancora stessa.
   *
   * È una nozione di sola INTERFACCIA. Il documento non la legge mai: `posizioneAncora`
   * (renderSvg.ts) resta l'unica fonte su dove sta un capo di tubo, e questo modulo ha già
   * pagato due volte per averne avute due. Se la presa fosse sbagliata si vedrebbe subito sulla
   * tela; se lo fosse l'ancora, finirebbe nel .docx del cliente.
   */
  presa?: { x: number; y: number }
  /**
   * Lato su cui appoggiare la maniglia. Assente: lo deduce `latoDi` (SchemaNodeSymbol.tsx) dal
   * bordo più vicino all'ancora. Va dichiarato ogni volta che si dichiara una `presa`, perché
   * la deduzione guarda l'ANCORA e la presa sta altrove — e diventa addirittura degenere
   * quando più ancore coincidono, come le quattro della giunzione, tutte al centro del riquadro.
   */
  lato?: SchemaLatoAncora
```

- [ ] **Step 4: Aggiungere `presaDi` al registro**

In `src/services/schemaImpianto/symbols/index.ts`, accanto ad `ancoraDi`:

```ts
/**
 * Dove si afferra un attacco sulla tela dell'editor. Coincide con l'ancora per ogni simbolo
 * tranne la giunzione, le cui ancore stanno tutte al centro del pallino mentre le prese
 * restano sulle mezzerie dei lati del riquadro.
 *
 * Restituisce sempre un oggetto nuovo: il chiamante ne ricava uno stile CSS, e il registro è
 * condiviso fra documento ed editor — una mutazione accidentale lo corromperebbe per entrambi.
 */
export function presaDi(ancora: SchemaAncora): { x: number; y: number } {
  return ancora.presa ? { x: ancora.presa.x, y: ancora.presa.y } : { x: ancora.x, y: ancora.y }
}
```

- [ ] **Step 5: L'handle si disegna sulla presa, e il lato dichiarato vince**

In `src/components/schemaImpianto/SchemaNodeSymbol.tsx`:

Aggiungere all'import dei simboli `presaDi`, e a quello dei tipi `SchemaLatoAncora`:

```tsx
import { ancoreDi, dimensioniDi, presaDi, simboloDi } from '@/services/schemaImpianto/symbols'
import type { SchemaAncora, SchemaLatoAncora, SchemaNodo } from '@/services/schemaImpianto/types'
```

Sostituire il corpo di `latoDi` (la firma non cambia) con:

```tsx
/** Traduzione fra il vocabolario del registro (un servizio, che non conosce react-flow) e
 *  quello della tela. È l'unico punto che ha diritto di conoscerli entrambi. */
const LATO_REACT_FLOW: Record<SchemaLatoAncora, Position> = {
  sx: Position.Left,
  dx: Position.Right,
  alto: Position.Top,
  basso: Position.Bottom,
}

export function latoDi(ancora: SchemaAncora, dim: { larghezza: number; altezza: number }): Position {
  // Il lato dichiarato vince: la deduzione qui sotto guarda l'ancora, ed è degenere quando più
  // ancore coincidono — le quattro della giunzione stanno tutte al centro del riquadro, a
  // distanza uguale da tutti e quattro i bordi, e il `reduce` le appoggerebbe tutte a sinistra.
  if (ancora.lato) return LATO_REACT_FLOW[ancora.lato]
  const distanze = [
    { lato: Position.Left, d: ancora.x },
    { lato: Position.Right, d: dim.larghezza - ancora.x },
    { lato: Position.Top, d: ancora.y },
    { lato: Position.Bottom, d: dim.altezza - ancora.y },
  ]
  return distanze.reduce((a, b) => (a.d <= b.d ? a : b)).lato
}
```

Nel corpo del componente, sostituire la riga che posiziona l'handle:

```tsx
        const stile = { ...stileAncora, left: ancora.x, top: ancora.y, transform: 'translate(-50%, -50%)' }
```

con:

```tsx
        // Sulla PRESA, non sull'ancora: sulla giunzione le due cose divergono — i tubi arrivano
        // al centro del pallino, ma il simbolo si afferra e si collega dalle mezzerie dei lati,
        // dove le maniglie stanno larghe invece di sovrapporsi (`presaDi`, symbols/index.ts).
        const presa = presaDi(ancora)
        const stile = { ...stileAncora, left: presa.x, top: presa.y, transform: 'translate(-50%, -50%)' }
```

E correggere il docblock di `latoHandle`, che oggi dice **il falso** già adesso — «quattro ancore agli angoli del riquadro»: stanno sulle mezzerie dei lati, non agli angoli. Sostituire quella proposizione con «quattro punti di presa sulle mezzerie dei lati del riquadro». Il resto del commento (l'handle da 10px che si sovrapponeva al vicino, il limite che sugli altri simboli non scatta mai) resta vero e non si tocca.

- [ ] **Step 6: Verde, e provare che i test discriminano — tre mutazioni, una alla volta**

```bash
npx vitest run src/components/schemaImpianto/__tests__/ancorePresa.test.ts > /tmp/d3-task1-verde.txt 2>&1; echo "exit=$?"; tail -12 /tmp/d3-task1-verde.txt
npx vitest run > /tmp/d3-task1-suite.txt 2>&1; echo "suite exit=$?"; tail -8 /tmp/d3-task1-suite.txt
npx tsc --noEmit > /tmp/d3-task1-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d3-task1-tsc.txt
```

Atteso: i test nuovi verdi (6 casi), la **suite intera verde con 985 test su 81 file** — cioè i 979 di partenza più i 6 nuovi, e **nessun test preesistente toccato**. Se un test preesistente cade, fermati e riferisci: questo task non deve cambiare nessun disegno.

Per ogni mutazione: applicare, eseguire **redirigendo su file**, annotare quali test cadono, **ripristinare**. Nessuna mutazione va committata.

| # | Mutazione | Deve cadere |
|---|---|---|
| 1 | In `presaDi`, restituire sempre `{ x: ancora.x, y: ancora.y }` (presa ignorata) | «con la presa dichiarata restituisce quella» |
| 2 | In `latoDi`, togliere la scorciatoia sul lato dichiarato | «il lato dichiarato vince sulla deduzione» (tre casi su quattro: `sx` no, perché la deduzione al centro dà comunque `Left` — **dillo nel report**) |
| 3 | In `presaDi`, restituire `ancora.presa` invece di una copia | «non restituisce l’oggetto del registro» |

```bash
# esempio per la mutazione 1 — ripetere per ognuna
npx vitest run src/components/schemaImpianto/__tests__/ancorePresa.test.ts > /tmp/d3-task1-mut1.txt 2>&1; echo "exit=$?"; grep -E "✓|×|failed|passed" /tmp/d3-task1-mut1.txt | tail -15
git checkout src/services/schemaImpianto/symbols/index.ts src/components/schemaImpianto/SchemaNodeSymbol.tsx
```

- [ ] **Step 7: Albero pulito e commit**

```bash
git diff --stat > /tmp/d3-task1-albero.txt; cat /tmp/d3-task1-albero.txt
git add src/services/schemaImpianto/types.ts src/services/schemaImpianto/symbols/index.ts src/components/schemaImpianto/SchemaNodeSymbol.tsx src/components/schemaImpianto/__tests__/ancorePresa.test.ts
git commit -m "feat(schema): il registro distingue il punto di presa dall'ancora

L'ancora dice dove arriva il tubo, la presa dove si afferra il simbolo sulla
tela. Per ogni simbolo esistente coincidono, e nessun disegno cambia.

E' una nozione di sola interfaccia: posizioneAncora resta la fonte unica su
dove sta un capo di tubo, e questo modulo ha gia' pagato due volte per averne
avute due.

Il lato di react-flow diventa dichiarabile perche' la deduzione guarda
l'ancora: chi dichiara una presa altrove finirebbe appoggiato al lato
sbagliato, in silenzio."
```

---

### Task 2: Le ancore della giunzione al centro, il pallino a diametro 10

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (`simboloGiunzione`, `REGISTRO_SIMBOLI.giunzione`)
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts` (esistente, `describe('giunzione')`)
- Test: `src/components/schemaImpianto/__tests__/ancorePresa.test.ts` (creato nel Task 1)

**Interfaces:**
- Consumes: `SchemaAncora.presa`, `SchemaAncora.lato`, `presaDi` (Task 1)
- Produces: `const DIAMETRO_GIUNZIONE = 10` (symbols/index.ts); il registro della giunzione con ancore in `(12, 12)` e prese sulle mezzerie

**Contesto per chi implementa.** È l'osservazione 4 del committente. Il pallino è grande `r=12` per una ragione precisa: tocca le quattro ancore poste sui bordi e **non lascia buco fra il tubo e la giunzione**. Rimpicciolirlo e basta riaprirebbe quel buco; rimpicciolire tutto il riquadro è già stato provato e **scartato** nel Blocco C2 (a 16×16 gli handle coprivano il 72% del nodo e i quattro attacchi finivano a 3 px l'uno dall'altro a zoom tipico).

La soluzione è separare le due cose: le **ancore** vanno al centro `(12, 12)` — i tubi convergono lì e il buco non esiste per costruzione, a qualunque raggio — e i **punti di presa** restano dove sono oggi, sulle mezzerie dei lati.

**Questo task cambia il documento**, ma solo per gli impianti che hanno un TEE. Il riferimento SVG committato non ne ha, quindi il suo test **deve restare verde senza toccarlo**: è la prima prova, a costo zero, che le pratiche senza TEE non cambiano. La prova completa è nel Task 6.

- [ ] **Step 1: Riscrivere i due test che fissano la geometria vecchia**

In `src/services/schemaImpianto/__tests__/simboli.test.ts`, dentro `describe('giunzione')`, i due test `'gli attacchi stanno sui bordi del riquadro, il pallino al centro'` e `'il pallino tocca esattamente le ancore: né un buco né una sporgenza fuori dal riquadro'` **cristallizzano il comportamento che questo task cambia di proposito**: vanno sostituiti, non aggiustati. Gli altri due (`'è un punto pieno senza monconi'`, `'ha quattro attacchi, uno per lato, tutti sull’aria'`) restano intatti.

Sostituirli con:

```ts
  it('le quattro ancore stanno tutte al centro: i tubi convergono in un punto solo', () => {
    const { larghezza, altezza } = REGISTRO_SIMBOLI.giunzione.dimensioni
    // Il centro va ricavato dalle dimensioni del registro, non scritto a mano: se l'ingombro
    // cambia, il test deve seguirlo senza bisogno di essere riscritto.
    for (const ancora of REGISTRO_SIMBOLI.giunzione.ancore) {
      expect(ancora).toMatchObject({ x: larghezza / 2, y: altezza / 2 })
    }
    const svg = simboloGiunzione(nodo)
    expect(Number(/cx="([\d.]+)"/.exec(svg)![1])).toBe(larghezza / 2)
    expect(Number(/cy="([\d.]+)"/.exec(svg)![1])).toBe(altezza / 2)
  })

  it('i punti di presa restano sulle mezzerie dei lati: il TEE si afferra come prima', () => {
    const { larghezza, altezza } = REGISTRO_SIMBOLI.giunzione.dimensioni
    const per = (id: string) => REGISTRO_SIMBOLI.giunzione.ancore.find((a) => a.id === id)!
    expect(per('sx').presa).toEqual({ x: 0, y: altezza / 2 })
    expect(per('dx').presa).toEqual({ x: larghezza, y: altezza / 2 })
    expect(per('alto').presa).toEqual({ x: larghezza / 2, y: 0 })
    expect(per('basso').presa).toEqual({ x: larghezza / 2, y: altezza })
  })

  it('il pallino ha il diametro dei punti di ancoraggio delle apparecchiature, e contiene le ancore', () => {
    // Il vincolo vecchio — raggio uguale a metà larghezza, per toccare le ancore sui bordi —
    // non esiste più: le ancore stanno nel CENTRO del pallino, quindi non c'è buco a nessun
    // raggio, ed è precisamente ciò che permette al pallino di rimpicciolire (osservazione 4).
    const raggio = Number(/r="([\d.]+)"/.exec(simboloGiunzione(nodo))![1])
    expect(raggio).toBe(DIAMETRO_GIUNZIONE / 2)
    expect(DIAMETRO_GIUNZIONE).toBe(10)
    expect(raggio).toBeLessThan(REGISTRO_SIMBOLI.giunzione.dimensioni.larghezza / 2)
  })
```

Aggiungere `DIAMETRO_GIUNZIONE` all'import da `../symbols` in testa al file (l'import di `REGISTRO_SIMBOLI` e `simboloGiunzione` c'è già).

E in `src/components/schemaImpianto/__tests__/ancorePresa.test.ts`, dentro `describe('il registro dei simboli')`, aggiungere il caso che rende sostanziale il lato dichiarato:

```ts
  // Il caso che il lato esplicito esiste per risolvere: le quattro ancore coincidono, quindi
  // la deduzione le appoggerebbe tutte allo stesso lato e i quattro handle finirebbero
  // sovrapposti — con `connectionMode` Strict, tre attacchi su quattro diventerebbero
  // irraggiungibili.
  it('i quattro attacchi della giunzione finiscono su quattro lati diversi', () => {
    const dim = REGISTRO_SIMBOLI.giunzione.dimensioni
    const lati = REGISTRO_SIMBOLI.giunzione.ancore.map((a) => latoDi(a, dim))
    expect(new Set(lati).size).toBe(4)
    expect(lati).toEqual([Position.Left, Position.Right, Position.Top, Position.Bottom])
  })
```

> **Nota per chi implementa:** l'ultima asserzione dipende dall'**ordine** delle ancore nel registro (`sx`, `dx`, `alto`, `basso`). È voluto: quell'ordine è già fissato dal test `'ha quattro attacchi, uno per lato'`, che lo confronta ordinato. Se non torna, **leggi il registro e adatta il test al codice vero, dichiarandolo nel report** — mai il contrario.

- [ ] **Step 2: Vedere il rosso, e che sia GEOMETRICO**

```bash
npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts src/components/schemaImpianto/__tests__/ancorePresa.test.ts > /tmp/d3-task2-rosso.txt 2>&1; echo "exit=$?"; grep -E "ancore stanno|punti di presa|pallino ha il diametro|quattro lati|expected|received" /tmp/d3-task2-rosso.txt | head -30
```

Atteso: fallimenti con **numeri**, non con «non definito» — `0` invece di `12` per l'ancora `sx`, `12` invece di `5` per il raggio. `DIAMETRO_GIUNZIONE` non esiste ancora e farà cadere l'import: **è il solo rosso non geometrico ammesso qui**, e sparisce allo Step 3.

- [ ] **Step 3: Spostare le ancore e rimpicciolire il pallino**

In `src/services/schemaImpianto/symbols/index.ts`, sostituire l'intero docblock e il corpo di `simboloGiunzione`:

```ts
/**
 * Diametro del pallino della giunzione: lo stesso dei punti di ancoraggio delle
 * apparecchiature sulla tela (`LATO_HANDLE`, SchemaNodeSymbol.tsx), come chiesto dal
 * committente. Il numero è ripetuto qui invece di essere importato perché questo è un
 * servizio, che il documento usa e che non deve dipendere dai componenti: il legame è
 * scritto, non cablato.
 */
export const DIAMETRO_GIUNZIONE = 10

/**
 * Giunzione (TEE): un punto pieno, senza monconi. Fino al Blocco B disegnava tre tratti verso
 * sinistra, destra e basso, che restavano visibili anche quando nessuna tubazione ci arrivava
 * e fissavano il ramo di diramazione verso il basso; il committente ha chiesto un attacco
 * libero da qualunque lato, e la forma a T (o a croce, o a gomito) la disegnano ora le
 * tubazioni che ci arrivano davvero.
 *
 * Il pallino sta al centro del riquadro, dove stanno anche le quattro ancore: i tubi
 * convergono tutti lì, quindi fra la fine di un tubo e la giunzione non c'è buco a nessun
 * raggio. È questo a permettergli di essere piccolo — fino al Blocco D2 il raggio era metà
 * della larghezza del riquadro, l'unico valore che toccasse le ancore quando stavano sui bordi.
 */
export function simboloGiunzione(_nodo: SchemaNodo): string {
  const { larghezza, altezza } = DIMENSIONI.giunzione
  return `<circle cx="${larghezza / 2}" cy="${altezza / 2}" r="${DIAMETRO_GIUNZIONE / 2}" fill="#000" />`
}
```

E sostituire la voce `giunzione` di `REGISTRO_SIMBOLI`:

```ts
  giunzione: {
    dimensioni: DIMENSIONI.giunzione,
    // Quattro attacchi sempre disponibili, uno per lato: non c'è un «davanti», quindi non
    // c'è nulla da ruotare. Gli id sono i nomi dei quattro lati: sx/dx/alto/basso.
    //
    // Le ANCORE stanno tutte al centro: i tubi convergono in un punto solo, e fra tubo e
    // giunzione non resta buco a nessun raggio — è ciò che permette al pallino di scendere a
    // `DIAMETRO_GIUNZIONE` (osservazione 4 del committente). I PUNTI DI PRESA restano sulle
    // mezzerie dei lati, dove le ancore stavano fino al Blocco D2: il TEE si afferra e si
    // collega esattamente come prima, con le maniglie larghe invece che sovrapposte.
    //
    // Il `lato` è dichiarato perché con quattro ancore coincidenti la deduzione di `latoDi`
    // (SchemaNodeSymbol.tsx) è degenere: le appoggerebbe tutte e quattro a sinistra.
    ancore: [
      { id: 'sx', x: 12, y: 12, accetta: ['aria'], presa: { x: 0, y: 12 }, lato: 'sx' },
      { id: 'dx', x: 12, y: 12, accetta: ['aria'], presa: { x: 24, y: 12 }, lato: 'dx' },
      { id: 'alto', x: 12, y: 12, accetta: ['aria'], presa: { x: 12, y: 0 }, lato: 'alto' },
      { id: 'basso', x: 12, y: 12, accetta: ['aria'], presa: { x: 12, y: 24 }, lato: 'basso' },
    ],
    disegna: simboloGiunzione,
  },
```

- [ ] **Step 4: Verde, suite intera, e il riferimento SVG committato**

```bash
npx vitest run > /tmp/d3-task2-verde.txt 2>&1; echo "exit=$?"; tail -8 /tmp/d3-task2-verde.txt
npx tsc --noEmit > /tmp/d3-task2-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d3-task2-tsc.txt
git diff --stat -- src/services/schemaImpianto/__tests__/fixtures/ > /tmp/d3-task2-fixture.txt; cat /tmp/d3-task2-fixture.txt
```

Atteso: **suite intera verde**, `tsc` pulito, e l'ultimo comando che stampa **niente** — il riferimento SVG committato non è stato toccato **e il suo test è verde lo stesso**, perché quell'impianto non ha giunzioni. Se il test del riferimento cade, **fermati e riferisci**: significa che qualcosa cambia anche dove il TEE non c'è, cioè l'opposto di quel che questo blocco promette.

Se cade invece un test di `renderSvg`, `layout` o `conversioneFlow` che **contiene una giunzione**, è legittimo aggiornarlo — ma **la ragione va scritta**, e i numeri nuovi devono essere quelli attesi (capi spostati di +12 su una coordinata, raggio 5).

- [ ] **Step 5: Provare che i test discriminano — quattro mutazioni**

| # | Mutazione | Deve cadere |
|---|---|---|
| 1 | Rimettere le ancore sui bordi (`sx` a `x: 0`, ecc.) lasciando le prese | «le quattro ancore stanno tutte al centro» |
| 2 | `r` di nuovo a `larghezza / 2` | «il pallino ha il diametro dei punti di ancoraggio» |
| 3 | Togliere `lato` alle quattro ancore | «i quattro attacchi della giunzione finiscono su quattro lati diversi» **e** «ogni ancora che dichiara una presa dichiara anche il lato» |
| 4 | Togliere `presa` all'ancora `alto` | «i punti di presa restano sulle mezzerie dei lati» |

Se una mutazione **non** fa cadere nulla, il test corrispondente non discrimina: rinforzalo prima di procedere e **dichiaralo nel report**.

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/__tests__/simboli.test.ts src/components/schemaImpianto/__tests__/ancorePresa.test.ts
git commit -m "feat(schema): il pallino del TEE scende a diametro 10, la presa resta dov'era

Osservazione 4 del committente. Il raggio era meta' della larghezza perche'
doveva toccare le ancore poste sui bordi: rimpicciolirlo e basta avrebbe
riaperto il buco fra tubo e giunzione, e rimpicciolire il riquadro e' gia'
stato provato e scartato nel Blocco C2.

Le quattro ancore vanno al centro, dove i tubi convergono in un punto solo:
il buco non esiste piu' per costruzione, a qualunque raggio. I quattro punti
di presa restano sulle mezzerie dei lati, quindi il TEE si afferra e si
collega come prima.

Il documento cambia solo dove c'e' un TEE: il riferimento SVG committato,
che non ne ha, resta verde senza essere toccato."
```

---

### Task 3: La geometria pura dello spezzamento

**Files:**
- Create: `src/services/schemaImpianto/inserimentoTee.ts`
- Test: `src/services/schemaImpianto/__tests__/inserimentoTee.test.ts` (**nuovo**)

**Interfaces:**
- Consumes: `tSuTratto`, `puntoSuTratto`, `Punto` da `./tratti`; `SchemaSegnoTubo` da `./types`
- Produces:
  - `const TOLLERANZA_INSERIMENTO = 20`
  - `function arcoPiuVicino(archi: { id: string; polilinea: Punto[] }[], punto: Punto, tolleranza?: number): string | null`
  - `interface MetaArco { punti: Punto[]; segni: SchemaSegnoTubo[] }`
  - `function spezzaArco(polilinea: Punto[], segni: SchemaSegnoTubo[], puntoLibero: Punto): { centro: Punto; primo: MetaArco; secondo: MetaArco }`
  - `function idDelleMeta(base: string, esistenti: Set<string>): [string, string]`

**Contesto per chi implementa.** Sono le due funzioni che la spec chiama «qual è l'arco più vicino a questo punto, entro una tolleranza» e «spezza questo arco in questo punto», più il terzo pezzo che serve al chiamante: i due identificativi delle metà.

Tre cose vanno capite prima di scrivere:

1. **Il taglio si proietta sulla polilinea.** Il TEE viene rilasciato *vicino* al tubo, non sopra. `spezzaArco` restituisce `centro`, cioè il punto della polilinea più vicino a quello libero: è lì che il chiamante dovrà **ricentrare il nodo**, così le due metà si incontrano esattamente sul tubo e il disegno non fa scalini.

2. **Nessuna metà può restare senza gomiti.** `instrada` ignora la rotta nativa **solo quando i gomiti non sono vuoti** (`tratti.ts`): una metà con `punti: []` tornerebbe alla rotta nativa del suo stile — per il flessibile una salita fino al collettore, per le condense un passaggio dalla corsia — cioè tutt'altra forma da quella su cui il committente ha appena posato il TEE. Quando fra i due capi della metà non cade nessun vertice, il tratto è **dritto per costruzione** (il taglio è caduto dentro un segmento) e basta un gomito nel suo **punto medio**: sta esattamente sulla linea, quindi la forma disegnata non cambia di un pixel, e la fissa.

3. **La `t` dei segni è una frazione della lunghezza totale**, non del numero di segmenti (`puntoSuTratto`/`tSuTratto`, tratti.ts). Le due metà hanno lunghezze diverse, quindi la `t` di ogni segno va **rimappata** sulla metà in cui cade. Le forme delle due metà sono identiche a quelle dei rispettivi pezzi dell'originale (punto 2), quindi la rimappatura è esatta e non un'approssimazione.

Le distanze punto-segmento **esistono già in due copie** nel repo (`useGomiti.ts` e `useTrascinamentoTratto.ts`, entrambe con la ragione scritta): **non aggiungerne una terza.** `tSuTratto` fa già la proiezione con la stessa formula, ed è già collaudata.

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/services/schemaImpianto/__tests__/inserimentoTee.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TOLLERANZA_INSERIMENTO, arcoPiuVicino, idDelleMeta, spezzaArco } from '../inserimentoTee'
import type { Punto } from '../tratti'
import type { SchemaSegnoTubo } from '../types'

/**
 * La rotta `standard` fra due capi disallineati: gira a metà strada (`rottaLinea`, tratti.ts).
 * Lunghezze: 150 + 100 + 150 = 400, quindi il vertice (150,0) sta a t=0,375 e (150,100) a
 * t=0,625.
 */
const ROTTA: Punto[] = [
  { x: 0, y: 0 },
  { x: 150, y: 0 },
  { x: 150, y: 100 },
  { x: 300, y: 100 },
]

describe('arcoPiuVicino', () => {
  const archi = [
    { id: 'std-1', polilinea: ROTTA },
    { id: 'std-2', polilinea: [{ x: 0, y: 500 }, { x: 300, y: 500 }] },
  ]

  it('sceglie l’arco su cui il punto cade', () => {
    expect(arcoPiuVicino(archi, { x: 80, y: 3 })).toBe('std-1')
    expect(arcoPiuVicino(archi, { x: 80, y: 497 })).toBe('std-2')
  })

  // Senza la tolleranza, QUALUNQUE rilascio spezzerebbe il tubo meno lontano: si potrebbe
  // spostare un TEE da una parte all'altra della tela e trovarselo innestato su un tubo che
  // non si stava puntando.
  it('nessun arco se il punto è lontano da tutti', () => {
    expect(arcoPiuVicino(archi, { x: 80, y: 250 })).toBeNull()
  })

  it('la tolleranza è inclusiva sul bordo', () => {
    expect(arcoPiuVicino(archi, { x: 80, y: TOLLERANZA_INSERIMENTO })).toBe('std-1')
    expect(arcoPiuVicino(archi, { x: 80, y: TOLLERANZA_INSERIMENTO + 0.5 })).toBeNull()
  })

  it('senza archi non sceglie nulla', () => {
    expect(arcoPiuVicino([], { x: 0, y: 0 })).toBeNull()
  })
})

describe('spezzaArco', () => {
  it('il centro sta sulla polilinea, non dove è stato rilasciato il TEE', () => {
    // Rilascio 6 unità a destra del montante: il TEE deve innestarsi SUL tubo, o le due metà
    // partirebbero da un punto che il tubo non tocca e il disegno farebbe uno scalino.
    const { centro } = spezzaArco(ROTTA, [], { x: 156, y: 50 })
    expect(centro).toEqual({ x: 150, y: 50 })
  })

  it('i vertici si dividono fra le due metà secondo dove cade il taglio', () => {
    const { primo, secondo } = spezzaArco(ROTTA, [], { x: 150, y: 50 })
    expect(primo.punti).toEqual([{ x: 150, y: 0 }])
    expect(secondo.punti).toEqual([{ x: 150, y: 100 }])
  })

  // Il punto 2 del contesto: una metà senza gomiti tornerebbe alla rotta nativa del suo
  // stile. Il gomito nel punto medio sta esattamente sul segmento, quindi fissa la forma
  // senza cambiarla.
  it('una metà senza vertici viene fissata con un gomito nel suo punto medio', () => {
    const { centro, primo, secondo } = spezzaArco(ROTTA, [], { x: 80, y: 0 })
    expect(centro).toEqual({ x: 80, y: 0 })
    expect(primo.punti).toEqual([{ x: 40, y: 0 }])
    expect(secondo.punti).toEqual([
      { x: 150, y: 0 },
      { x: 150, y: 100 },
    ])
  })

  it('i segni vanno alla metà su cui cadono, con la t rimappata su quella metà', () => {
    const segni: SchemaSegnoTubo[] = [
      { id: 'v1', tipo: 'valvola_intercettazione', t: 0.25 },
      { id: 'r1', tipo: 'riduttore_pressione', t: 0.75 },
    ]
    const { primo, secondo } = spezzaArco(ROTTA, segni, { x: 150, y: 50 }) // taglio a t = 0,5
    expect(primo.segni).toEqual([{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.5 }])
    expect(secondo.segni).toEqual([{ id: 'r1', tipo: 'riduttore_pressione', t: 0.5 }])
  })

  // Rilascio proprio sul capo di partenza: la prima metà è lunga zero. Non deve produrre
  // NaN — una t divisa per zero finirebbe nel layout salvato e da lì nel documento.
  it('un taglio sul capo di partenza non produce quote non numeriche', () => {
    const segni: SchemaSegnoTubo[] = [{ id: 'v1', tipo: 'valvola_intercettazione', t: 0.25 }]
    const { primo, secondo } = spezzaArco(ROTTA, segni, { x: 0, y: 0 })
    expect(primo.segni).toEqual([])
    expect(secondo.segni).toEqual(segni)
    expect(primo.punti.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))).toBe(true)
  })
})

describe('idDelleMeta', () => {
  it('deriva due identificativi dal nome dell’arco spezzato', () => {
    expect(idDelleMeta('std-3', new Set(['std-3']))).toEqual(['std-3-a', 'std-3-b'])
  })

  // Spezzare due volte lo stesso tubo non deve produrre due archi con lo stesso id: react-flow
  // ne renderebbe uno solo, e il layout salvato perderebbe l'altro in silenzio.
  it('evita gli identificativi già presi', () => {
    expect(idDelleMeta('std-3', new Set(['std-3', 'std-3-a', 'std-3-b']))).toEqual(['std-3-a2', 'std-3-b2'])
  })
})
```

- [ ] **Step 2: Eseguire i test e vederli fallire**

```bash
npx vitest run src/services/schemaImpianto/__tests__/inserimentoTee.test.ts > /tmp/d3-task3-rosso.txt 2>&1; echo "exit=$?"; tail -20 /tmp/d3-task3-rosso.txt
```

Atteso: fallimento per modulo non risolvibile. **Questo rosso non prova nulla**: la prova è lo Step 5.

- [ ] **Step 3: Scrivere il modulo**

Creare `src/services/schemaImpianto/inserimentoTee.ts`:

```ts
/**
 * Inserire un TEE su un tubo esistente: le due funzioni pure sotto il gesto (osservazione 5
 * del committente). Il gesto vero — trascinare il simbolo, evidenziare il tubo sotto,
 * rilasciare — sta in `useInserimentoTee.ts`, fra i componenti; qui c'è solo la geometria, che
 * si collauda senza DOM.
 *
 * Sta fra i servizi e non fra i componenti per la stessa ragione di `griglia.ts`: un calcolo
 * dentro un componente è un calcolo che nessuno prova.
 */
import { puntoSuTratto, tSuTratto, type Punto } from './tratti'
import type { SchemaSegnoTubo } from './types'

/**
 * Quanto lontano dal tubo può cadere il centro del TEE perché il rilascio lo spezzi, in unità
 * del disegno. Poco meno del riquadro del simbolo (24×24): il pallino deve sovrapporsi
 * visibilmente al tubo. Senza soglia, QUALUNQUE rilascio spezzerebbe il tubo meno lontano
 * della tela, anche a mezzo disegno di distanza.
 */
export const TOLLERANZA_INSERIMENTO = 20

/**
 * L'arco più vicino a `punto`, se ce n'è uno entro `tolleranza`; `null` altrimenti. A parità
 * di distanza vince il primo dell'elenco: un pareggio esatto fra due tubi è una coincidenza
 * senza una risposta migliore dell'altra, e sceglierne una qualunque è meglio che non
 * spezzare nulla.
 *
 * La distanza si ricava da `tSuTratto` + `puntoSuTratto` (tratti.ts) invece che da una formula
 * scritta qui: la proiezione punto-segmento esiste già in due copie nel repo, e una terza
 * sarebbe la terza definizione della stessa cosa in un modulo che ha già pagato per averne
 * avute due.
 */
export function arcoPiuVicino(
  archi: { id: string; polilinea: Punto[] }[],
  punto: Punto,
  tolleranza: number = TOLLERANZA_INSERIMENTO
): string | null {
  let migliore: { id: string; distanza: number } | null = null
  for (const arco of archi) {
    if (arco.polilinea.length < 2) continue
    const proiezione = puntoSuTratto(arco.polilinea, tSuTratto(arco.polilinea, punto)).punto
    const distanza = Math.hypot(punto.x - proiezione.x, punto.y - proiezione.y)
    if (!migliore || distanza < migliore.distanza) migliore = { id: arco.id, distanza }
  }
  return migliore && migliore.distanza <= tolleranza ? migliore.id : null
}

/** Una delle due metà di un arco spezzato: la sua rotta e i segni che le sono toccati. */
export interface MetaArco {
  /**
   * Gomiti che fissano la forma della metà, in coordinate assolute. **Mai vuoto**: vedi
   * `fissaLaForma` qui sotto.
   */
  punti: Punto[]
  segni: SchemaSegnoTubo[]
}

/**
 * Spezza un arco nel punto della sua polilinea più vicino a `puntoLibero` — dove il committente
 * ha rilasciato il TEE. Restituisce anche quel punto (`centro`): è lì che va ricentrata la
 * giunzione, così le due metà si incontrano esattamente sul tubo.
 *
 * Conserva ciò che è stato fatto a mano: i gomiti e i segni vanno alla metà su cui cadono
 * geometricamente. Lo stile non compare qui perché non si divide — il chiamante lo copia
 * identico su entrambe.
 */
export function spezzaArco(
  polilinea: Punto[],
  segni: SchemaSegnoTubo[],
  puntoLibero: Punto
): { centro: Punto; primo: MetaArco; secondo: MetaArco } {
  const tTaglio = tSuTratto(polilinea, puntoLibero)
  const centro = puntoSuTratto(polilinea, tTaglio).punto
  const ts = quoteDeiVertici(polilinea)
  const interni = polilinea.slice(1, -1).map((p, i) => ({ p, t: ts[i + 1] }))

  return {
    centro,
    primo: {
      punti: fissaLaForma(polilinea[0], interni.filter((v) => v.t < tTaglio).map((v) => v.p), centro),
      segni: tTaglio <= 0 ? [] : segni.filter((s) => s.t <= tTaglio).map((s) => ({ ...s, t: s.t / tTaglio })),
    },
    secondo: {
      punti: fissaLaForma(centro, interni.filter((v) => v.t > tTaglio).map((v) => v.p), polilinea[polilinea.length - 1]),
      segni:
        tTaglio <= 0
          ? segni.map((s) => ({ ...s }))
          : tTaglio >= 1
            ? []
            : segni.filter((s) => s.t > tTaglio).map((s) => ({ ...s, t: (s.t - tTaglio) / (1 - tTaglio) })),
    },
  }
}

/** La `t` di ogni vertice della polilinea, con la stessa metrica di `puntoSuTratto`: frazione
 *  della lunghezza totale, non del numero di segmenti. */
function quoteDeiVertici(punti: Punto[]): number[] {
  const lunghezze = punti.slice(1).map((p, i) => Math.hypot(p.x - punti[i].x, p.y - punti[i].y))
  const totale = lunghezze.reduce((s, l) => s + l, 0)
  const ts = [0]
  let percorsa = 0
  for (const l of lunghezze) {
    percorsa += l
    ts.push(totale === 0 ? 0 : percorsa / totale)
  }
  return ts
}

/**
 * I gomiti che fissano la forma di una metà. **Mai vuoti**: `instrada` (tratti.ts) ignora la
 * rotta nativa solo quando i gomiti non lo sono, quindi una metà con `punti: []` tornerebbe
 * alla rotta nativa del suo stile — per il flessibile una salita fino al collettore, per le
 * condense un passaggio dalla corsia: tutt'altra forma da quella su cui il committente ha
 * appena posato il TEE.
 *
 * Quando fra i due capi non cade nessun vertice il tratto è dritto per costruzione — il taglio
 * è caduto dentro un segmento — e basta un gomito nel punto medio: sta esattamente sulla
 * linea, quindi la forma disegnata non cambia, e la fissa.
 */
function fissaLaForma(da: Punto, gomiti: Punto[], a: Punto): Punto[] {
  if (gomiti.length > 0) return gomiti
  return [{ x: (da.x + a.x) / 2, y: (da.y + a.y) / 2 }]
}

/**
 * I due identificativi per le metà di `base`, scelti fra quelli non ancora presi. Parlanti
 * come quelli che sostituiscono (`std-3` → `std-3-a`, `std-3-b`), e unici: due archi con lo
 * stesso id sulla tela ne farebbero rendere uno solo a react-flow, e il layout salvato
 * perderebbe l'altro in silenzio.
 */
export function idDelleMeta(base: string, esistenti: Set<string>): [string, string] {
  const presi = new Set(esistenti)
  const libero = (suffisso: string): string => {
    let candidato = `${base}-${suffisso}`
    for (let i = 2; presi.has(candidato); i++) candidato = `${base}-${suffisso}${i}`
    presi.add(candidato)
    return candidato
  }
  return [libero('a'), libero('b')]
}
```

- [ ] **Step 4: Eseguire i test e vederli passare**

```bash
npx vitest run src/services/schemaImpianto/__tests__/inserimentoTee.test.ts > /tmp/d3-task3-verde.txt 2>&1; echo "exit=$?"; tail -12 /tmp/d3-task3-verde.txt
npx tsc --noEmit > /tmp/d3-task3-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d3-task3-tsc.txt
```

Atteso: `exit=0`, **11** test verdi (quattro su `arcoPiuVicino`, cinque su `spezzaArco`, due su `idDelleMeta`).

- [ ] **Step 5: Provare che i test discriminano — cinque mutazioni, una alla volta**

| # | Mutazione | Deve cadere |
|---|---|---|
| 1 | In `arcoPiuVicino`, restituire `migliore?.id ?? null` senza confrontare la tolleranza | «nessun arco se il punto è lontano da tutti» e «la tolleranza è inclusiva sul bordo» |
| 2 | In `arcoPiuVicino`, `distanza <= tolleranza` → `distanza < tolleranza` | «la tolleranza è inclusiva sul bordo» |
| 3 | In `spezzaArco`, usare `puntoLibero` invece di `centro` come capo delle due metà | «il centro sta sulla polilinea» |
| 4 | In `fissaLaForma`, restituire `[]` quando non ci sono gomiti | «una metà senza vertici viene fissata con un gomito nel suo punto medio» |
| 5 | Nei segni del `secondo`, lasciare `s.t` invece di rimapparla | «i segni vanno alla metà su cui cadono, con la t rimappata» |

```bash
# esempio per la mutazione 1 — ripetere per ognuna
npx vitest run src/services/schemaImpianto/__tests__/inserimentoTee.test.ts > /tmp/d3-task3-mut1.txt 2>&1; echo "exit=$?"; grep -E "✓|×|failed|passed" /tmp/d3-task3-mut1.txt | tail -15
git checkout src/services/schemaImpianto/inserimentoTee.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/inserimentoTee.ts src/services/schemaImpianto/__tests__/inserimentoTee.test.ts
git commit -m "feat(schema): la geometria pura dell'inserimento del TEE su un tubo

Quale arco e' piu' vicino a un punto entro una tolleranza, e come si spezza un
arco in un punto conservando gomiti e segni sulla meta' giusta.

Il taglio si proietta sulla polilinea: il TEE si rilascia vicino al tubo, non
sopra, e le due meta' devono incontrarsi esattamente su di esso.

Nessuna meta' resta senza gomiti: instrada ignora la rotta nativa solo quando
ce ne sono, e una meta' vuota tornerebbe alla rotta nativa del suo stile —
tutt'altra forma da quella su cui il TEE e' stato appena posato."
```

---

### Task 4: Il gesto — trascinare il TEE sopra un tubo

**Files:**
- Create: `src/components/schemaImpianto/useInserimentoTee.ts`
- Test: `src/components/schemaImpianto/__tests__/useInserimentoTee.test.ts` (**nuovo**)

**Interfaces:**
- Consumes: `arcoPiuVicino`, `spezzaArco`, `idDelleMeta` da `@/services/schemaImpianto/inserimentoTee` (Task 3); `polilineaDellArco`, `type CapiArco` da `./conversioneFlow`; `posizioneAncora` da `@/services/schemaImpianto/renderSvg`; `type SchemaEdgeData` da `./SchemaEdgeTubazione`
- Produces:
  ```ts
  function useInserimentoTee<T extends { nodes: Node[]; edges: Edge[] }>(
    stato: T,
    applica: (p: T | ((c: T) => T)) => void,
    aggiornaSenzaCronologia: (p: T | ((c: T) => T)) => void,
    quote: QuoteInstradamento,
    capi: Map<string, CapiArco>
  ): {
    arcoEvidenziato: string | null
    iniziaTrascinamento: (nodo: Node) => void
    seguiTrascinamento: (nodo: Node, nodiTrascinati: Node[]) => void
    concludiTrascinamento: (nodo: Node, nodiTrascinati: Node[]) => void
  }
  ```

**Contesto per chi implementa.** Il gesto deciso dal committente: si aggiunge il TEE dalla barra come oggi, poi lo si **trascina sopra un tubo**; mentre ci passa sopra il tubo si evidenzia, e al rilascio si spezza in due tratti collegati alla giunzione.

Quattro cose vanno capite prima di scrivere.

**1. Il centro del TEE si legge con `posizioneAncora`, non ricalcolando 12.** Dopo il Task 2 le quattro ancore stanno tutte al centro, quindi `posizioneAncora(nodoPosizionato, 'sx')` **è** il centro — la stessa funzione che usa il documento, e nessun secondo posto dove il 12 è scritto. Per la stessa ragione, ricentrare il nodo sul tubo significa `position = centro − (ancora.x, ancora.y)`, con l'ancora letta da `ancoraDi`.

**2. Quale delle quattro ancore usare per ciascuna metà è cosmetico** — la spec lo dice a chiare lettere: sono tutte al centro, danno lo stesso punto. Usa `sx` per il capo che arriva e `dx` per quello che riparte, e non complicarlo.

**3. Un solo Ctrl+Z, e il modo per ottenerlo non è scrivere una voce di cronologia: è NON scriverne una seconda.** `onNodesChange` (SchemaEditor.tsx) scrive già in cronologia con `applica` al **primo evento di posizione** del gesto, quando lo stato è ancora quello di partenza — TEE dov'era, tubo intero. Se lo spezzamento ne scrivesse un'altra, servirebbero **due** Ctrl+Z: il primo per disfare lo spezzamento, il secondo per riportare il TEE dov'era. Lo spezzamento va quindi scritto con `aggiornaSenzaCronologia`, **appoggiandosi alla voce che il trascinamento ha già lasciato**.

Con un'eccezione, che è il motivo per cui l'hook riceve **anche** `applica`: un TEE già fermo sopra un tubo, premuto e rilasciato **senza muoverlo**, non produce alcun evento di posizione e quindi **nessuna voce di cronologia** — lo spezzamento sarebbe irreversibile. Per questo `iniziaTrascinamento` congela la posizione di partenza e `concludiTrascinamento` sceglie: **si è mosso → `aggiornaSenzaCronologia`; non si è mosso → `applica`.** In entrambi i casi, esattamente un passo.

**4. Un arco che ha già questo TEE per capo non è un candidato.** Senza l'esclusione, trascinare un TEE già innestato lungo il suo stesso tubo lo rispezzerebbe a ogni rilascio, moltiplicando gli archi.

Le tre trappole che la spec elenca, e perché questo disegno le evita — **verificale, non fidarti**: `addEdge` di react-flow **scarta i duplicati**, e qui non si usa (gli archi si scrivono in `s.edges` direttamente, con id resi unici da `idDelleMeta`); `onlyRenderVisibleElements` toglie dal DOM i nodi fuori vista, e qui tutto si calcola dallo stato, mai dal DOM; **il layer del portale vince sempre il clic sul tubo sottostante**, e qui il gesto non è un clic sul tubo ma un trascinamento del nodo, che react-flow instrada sui propri gestori senza passare dal tubo.

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/components/schemaImpianto/__tests__/useInserimentoTee.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import type { QuoteInstradamento } from '@/services/schemaImpianto/tratti'
import type { SchemaNodo, SchemaSegnoTubo } from '@/services/schemaImpianto/types'
import type { CapiArco } from '../conversioneFlow'
import type { SchemaEdgeData } from '../SchemaEdgeTubazione'
import { useInserimentoTee } from '../useInserimentoTee'
import { useSchemaHistory } from '../useSchemaHistory'

/**
 * Un impianto ridotto all'osso: due nodi qualunque collegati da un tubo `standard`, più un TEE
 * libero. I capi dell'arco sono passati espliciti (come fa `SchemaEditor` con `capiDegliArchi`),
 * quindi la geometria dei due nodi di estremità non conta: conta solo la polilinea che ne esce,
 * `rottaLinea` fra (0,0) e (300,100) — la stessa ROTTA dei test di `inserimentoTee`.
 */
interface Stato {
  nodes: Node[]
  edges: Edge[]
}

const QUOTE: QuoteInstradamento = { yCollettore: -100, yCorsiaCondense: 400 }
const CAPI = new Map<string, CapiArco>([['std-1', { da: { x: 0, y: 0 }, a: { x: 300, y: 100 } }]])

function nodoDati(id: string, tipo: SchemaNodo['tipo']): { nodo: SchemaNodo } {
  return {
    nodo: { id, tipo, etichetta: id, gruppo: 'LINEA_DISTRIBUZIONE', valvoleSicurezza: [], origine: 'manuale' },
  }
}

/** Il TEE parte lontano dal tubo: `position` è l'angolo del riquadro, il centro è +12/+12. */
function statoIniziale(segni?: SchemaSegnoTubo[], punti?: { x: number; y: number }[]): Stato {
  return {
    nodes: [
      { id: 'A', type: 'simbolo', position: { x: 0, y: 0 }, data: nodoDati('A', 'compressore') },
      { id: 'B', type: 'simbolo', position: { x: 300, y: 100 }, data: nodoDati('B', 'serbatoio') },
      { id: 'M-G1', type: 'simbolo', position: { x: 600, y: 600 }, data: nodoDati('M-G1', 'giunzione') },
    ],
    edges: [
      {
        id: 'std-1',
        source: 'A',
        target: 'B',
        sourceHandle: 'alto-out',
        targetHandle: 'sx',
        type: 'tubazione',
        data: { stile: 'standard', punti, segni } satisfies SchemaEdgeData,
      },
    ],
  }
}

function monta(iniziale: Stato) {
  return renderHook(() => {
    const storia = useSchemaHistory<Stato>(iniziale)
    const inserimento = useInserimentoTee(
      storia.stato,
      storia.applica,
      storia.aggiornaSenzaCronologia,
      QUOTE,
      CAPI
    )
    return { ...storia, ...inserimento }
  })
}

type Hook = ReturnType<typeof monta>

/** Sposta il TEE (come farebbe `applyNodeChanges` durante il trascinamento) e notifica l'hook. */
function trascina(hook: Hook, verso: { x: number; y: number }) {
  act(() => {
    const tee = hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!
    hook.result.current.iniziaTrascinamento(tee)
    hook.result.current.aggiornaSenzaCronologia((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === 'M-G1' ? { ...n, position: verso } : n)),
    }))
  })
  act(() => {
    const tee = hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!
    hook.result.current.seguiTrascinamento(tee, [tee])
  })
}

function rilascia(hook: Hook) {
  act(() => {
    const tee = hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!
    hook.result.current.concludiTrascinamento(tee, [tee])
  })
}

function archi(hook: Hook): Edge[] {
  return hook.result.current.stato.edges
}

describe('useInserimentoTee', () => {
  // Il TEE va portato col CENTRO sul montante verticale (x=150): position = centro − (12,12).
  const SUL_MONTANTE = { x: 138, y: 38 }

  it('A. il tubo sotto il TEE si evidenzia mentre lo si trascina, e si spegne quando ci si allontana', () => {
    const hook = monta(statoIniziale())
    trascina(hook, SUL_MONTANTE)
    expect(hook.result.current.arcoEvidenziato).toBe('std-1')

    trascina(hook, { x: 600, y: 600 })
    expect(hook.result.current.arcoEvidenziato).toBeNull()
  })

  it('B. al rilascio il tubo si spezza in due tratti collegati alla giunzione, che si ricentra sul tubo', () => {
    const hook = monta(statoIniziale())
    trascina(hook, SUL_MONTANTE)
    rilascia(hook)

    expect(archi(hook)).toHaveLength(2)
    expect(archi(hook).map((e) => e.id)).toEqual(['std-1-a', 'std-1-b'])
    // La prima metà arriva alla giunzione, la seconda ne riparte: il verso del tubo si conserva.
    expect(archi(hook)[0]).toMatchObject({ source: 'A', sourceHandle: 'alto-out', target: 'M-G1' })
    expect(archi(hook)[1]).toMatchObject({ source: 'M-G1', target: 'B', targetHandle: 'sx' })
    // Ricentrata SUL tubo: centro (150, 50) meno l'ancora (12, 12).
    const tee = hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!
    expect(tee.position).toEqual({ x: 138, y: 38 })
    expect(hook.result.current.arcoEvidenziato).toBeNull()
  })

  it('C. lo stile del tubo si conserva su entrambe le metà', () => {
    const hook = monta(statoIniziale())
    act(() => {
      hook.result.current.aggiornaSenzaCronologia((s) => ({
        ...s,
        edges: s.edges.map((e) => ({ ...e, data: { ...(e.data as SchemaEdgeData), stile: 'condensa' } })),
      }))
    })
    trascina(hook, SUL_MONTANTE)
    rilascia(hook)

    expect(archi(hook).map((e) => (e.data as SchemaEdgeData).stile)).toEqual(['condensa', 'condensa'])
  })

  it('D. valvole e riduttori vanno alla metà su cui cadono', () => {
    const segni: SchemaSegnoTubo[] = [
      { id: 'v1', tipo: 'valvola_intercettazione', t: 0.25 },
      { id: 'r1', tipo: 'riduttore_pressione', t: 0.75 },
    ]
    const hook = monta(statoIniziale(segni))
    trascina(hook, SUL_MONTANTE)
    rilascia(hook)

    expect((archi(hook)[0].data as SchemaEdgeData).segni!.map((s) => s.id)).toEqual(['v1'])
    expect((archi(hook)[1].data as SchemaEdgeData).segni!.map((s) => s.id)).toEqual(['r1'])
  })

  it('E. un solo Ctrl+Z disfa tutto: il tubo torna intero e il TEE dov’era', () => {
    const hook = monta(statoIniziale())
    trascina(hook, SUL_MONTANTE)
    rilascia(hook)
    expect(archi(hook)).toHaveLength(2)

    act(() => hook.result.current.annulla())
    expect(archi(hook)).toHaveLength(1)
    expect(archi(hook)[0].id).toBe('std-1')
    expect(hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!.position).toEqual({ x: 600, y: 600 })
    expect(hook.result.current.puoAnnullare).toBe(false)
  })

  it('F. un TEE premuto e rilasciato senza muoverlo scrive comunque una voce di cronologia', () => {
    // Il caso che `aggiornaSenzaCronologia` da solo renderebbe irreversibile: nessun evento di
    // posizione, quindi `onNodesChange` non ha scritto nulla su cui appoggiarsi.
    const iniziale = statoIniziale()
    iniziale.nodes = iniziale.nodes.map((n) => (n.id === 'M-G1' ? { ...n, position: { x: 138, y: 38 } } : n))
    const hook = monta(iniziale)

    act(() => {
      const tee = hook.result.current.stato.nodes.find((n) => n.id === 'M-G1')!
      hook.result.current.iniziaTrascinamento(tee)
      hook.result.current.concludiTrascinamento(tee, [tee])
    })

    expect(archi(hook)).toHaveLength(2)
    expect(hook.result.current.puoAnnullare).toBe(true)
    act(() => hook.result.current.annulla())
    expect(archi(hook)).toHaveLength(1)
  })

  it('G. un rilascio lontano da ogni tubo non cambia nulla', () => {
    const hook = monta(statoIniziale())
    trascina(hook, { x: 600, y: 300 })
    rilascia(hook)

    expect(archi(hook)).toHaveLength(1)
    expect(hook.result.current.puoAnnullare).toBe(false)
  })

  it('H. un tubo che ha già questo TEE per capo non è un candidato', () => {
    const iniziale = statoIniziale()
    iniziale.edges[0] = { ...iniziale.edges[0], target: 'M-G1', targetHandle: 'sx' }
    const hook = monta(iniziale)

    trascina(hook, SUL_MONTANTE)
    expect(hook.result.current.arcoEvidenziato).toBeNull()
    rilascia(hook)
    expect(archi(hook)).toHaveLength(1)
  })

  it('I. un trascinamento multiplo non inserisce nulla', () => {
    const hook = monta(statoIniziale())
    act(() => {
      const nodi = hook.result.current.stato.nodes
      const tee = nodi.find((n) => n.id === 'M-G1')!
      hook.result.current.iniziaTrascinamento(tee)
      hook.result.current.concludiTrascinamento(tee, [tee, nodi[0]])
    })
    expect(archi(hook)).toHaveLength(1)
  })

  it('J. un nodo che non è una giunzione non spezza niente', () => {
    const hook = monta(statoIniziale())
    act(() => {
      const compressore = hook.result.current.stato.nodes.find((n) => n.id === 'A')!
      hook.result.current.iniziaTrascinamento(compressore)
      hook.result.current.seguiTrascinamento(compressore, [compressore])
      hook.result.current.concludiTrascinamento(compressore, [compressore])
    })
    expect(hook.result.current.arcoEvidenziato).toBeNull()
    expect(archi(hook)).toHaveLength(1)
  })
})
```

> **Nota per chi implementa:** i numeri di `SUL_MONTANTE` e della posizione ricentrata dipendono dalla rotta `standard` fra (0,0) e (300,100), che gira a metà strada — quindi il montante sta in x=150 e il centro del taglio in (150, 50). **Verificalo eseguendo il test e leggendo il messaggio di fallimento**, invece di darlo per buono. Se la forma non corrisponde, **adatta la fixture al codice vero e dichiaralo nel report** — mai il contrario.

- [ ] **Step 2: Vedere il rosso**

```bash
npx vitest run src/components/schemaImpianto/__tests__/useInserimentoTee.test.ts > /tmp/d3-task4-rosso.txt 2>&1; echo "exit=$?"; tail -20 /tmp/d3-task4-rosso.txt
```

Atteso: fallimento per modulo non risolvibile. **Questo rosso non prova nulla**: la prova è lo Step 5.

- [ ] **Step 3: Scrivere l'hook**

Creare `src/components/schemaImpianto/useInserimentoTee.ts`:

```ts
/**
 * Inserire un TEE su un tubo esistente: si trascina la giunzione sopra una tubazione, che si
 * evidenzia mentre ci si passa sopra, e al rilascio si spezza in due tratti collegati alla
 * giunzione (osservazione 5 del committente). Logica isolata in un hook suo per lo stesso
 * motivo di `useGomiti.ts`: SchemaEditor.tsx è già segnalato come file da non far crescere.
 *
 * La geometria — quale arco è più vicino, come si spezza — sta in `inserimentoTee.ts`, fra i
 * servizi, dove si collauda senza DOM. Qui c'è solo il gesto.
 */
import { useCallback, useRef, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import {
  arcoPiuVicino,
  idDelleMeta,
  spezzaArco,
} from '@/services/schemaImpianto/inserimentoTee'
import { posizioneAncora } from '@/services/schemaImpianto/renderSvg'
import { ancoraDi } from '@/services/schemaImpianto/symbols'
import type { Punto, QuoteInstradamento } from '@/services/schemaImpianto/tratti'
import { polilineaDellArco, type CapiArco } from './conversioneFlow'
import type { SchemaEdgeData } from './SchemaEdgeTubazione'
import type { SchemaNodeData } from './SchemaNodeSymbol'

interface StatoConNodiEdArchi {
  nodes: Node[]
  edges: Edge[]
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

/**
 * Quale delle quattro ancore della giunzione usare per le due metà. È una scelta COSMETICA:
 * dal Blocco D3 stanno tutte al centro del pallino e danno lo stesso punto (`posizioneAncora`),
 * quindi non c'è nulla da decidere in base alla direzione del tubo.
 */
const ANCORA_IN_ARRIVO = 'sx'
const ANCORA_IN_PARTENZA = 'dx'

/** Il centro del pallino di una giunzione posizionata. Passa da `posizioneAncora` — la stessa
 *  funzione del documento — invece di sommare a mano metà riquadro: dal Blocco D3 le quattro
 *  ancore stanno al centro, quindi quel punto È il centro, e non ne esiste una seconda fonte. */
function centroDellaGiunzione(nodo: Node): Punto {
  const { nodo: schema } = nodo.data as SchemaNodeData
  return posizioneAncora({ ...schema, x: nodo.position.x, y: nodo.position.y }, ANCORA_IN_ARRIVO)
}

function eUnaGiunzione(nodo: Node): boolean {
  return (nodo.data as SchemaNodeData | undefined)?.nodo?.tipo === 'giunzione'
}

export function useInserimentoTee<T extends StatoConNodiEdArchi>(
  stato: T,
  applica: Aggiorna<T>,
  aggiornaSenzaCronologia: Aggiorna<T>,
  quote: QuoteInstradamento,
  capi: Map<string, CapiArco>
) {
  const [arcoEvidenziato, setArcoEvidenziato] = useState<string | null>(null)
  // Posizione del TEE all'inizio del gesto: decide, alla conclusione, se il trascinamento ha
  // già lasciato una voce di cronologia su cui appoggiarsi. Vedi `concludiTrascinamento`.
  const posizioneInizialeRef = useRef<Punto | null>(null)

  /**
   * I tubi su cui questo TEE può innestarsi, con la polilinea che la tela DISEGNA
   * (`polilineaDellArco`, la stessa che passa da `instrada`): agganciarsi a una forma diversa
   * da quella vista significherebbe spezzare il tubo dove l'utente non l'ha puntato.
   *
   * Le quote vanno infilate a mano nei dati. `stato.edges` è lo stato GREZZO, non l'elenco
   * fuso da `fondiDatiArchi` che la tela riceve: qui `data.quote` non c'è, e senza,
   * `polilineaDellArco` ripiega sul raccordo a un angolo solo — una forma che il tubo non ha
   * mai avuto. È lo stesso ripiego che il suo docblock chiama «rete di sicurezza per il tipo,
   * non un caso previsto», e questo è precisamente un chiamante che non deve toccarlo.
   *
   * Un tubo che ha già questo TEE per capo è escluso: senza, trascinare una giunzione già
   * innestata lungo il suo stesso tubo lo rispezzerebbe a ogni rilascio.
   */
  const candidati = useCallback(
    (idTee: string) =>
      stato.edges
        .filter((e) => e.source !== idTee && e.target !== idTee)
        .flatMap((e) => {
          const capiArco = capi.get(e.id)
          if (!capiArco) return []
          const data = { ...(e.data as SchemaEdgeData), quote }
          return [{ id: e.id, polilinea: polilineaDellArco(capiArco, data) }]
        }),
    [stato.edges, capi, quote]
  )

  /** L'arco che il TEE sta sorvolando, o `null`. Unico punto che decide: lo consultano sia
   *  l'evidenziazione durante il gesto sia lo spezzamento al rilascio, e due risposte diverse
   *  farebbero spezzare un tubo diverso da quello evidenziato. */
  const arcoSotto = useCallback(
    (nodo: Node, nodiTrascinati: Node[]): string | null => {
      // Un trascinamento multiplo sposta un blocco di simboli, non innesta un TEE.
      if (nodiTrascinati.length !== 1 || !eUnaGiunzione(nodo)) return null
      return arcoPiuVicino(candidati(nodo.id), centroDellaGiunzione(nodo))
    },
    [candidati]
  )

  const iniziaTrascinamento = useCallback((nodo: Node) => {
    posizioneInizialeRef.current = { x: nodo.position.x, y: nodo.position.y }
  }, [])

  const seguiTrascinamento = useCallback(
    (nodo: Node, nodiTrascinati: Node[]) => {
      setArcoEvidenziato(arcoSotto(nodo, nodiTrascinati))
    },
    [arcoSotto]
  )

  const concludiTrascinamento = useCallback(
    (nodo: Node, nodiTrascinati: Node[]) => {
      const iniziale = posizioneInizialeRef.current
      posizioneInizialeRef.current = null
      setArcoEvidenziato(null)

      const arcoId = arcoSotto(nodo, nodiTrascinati)
      if (!arcoId) return

      // Tutto ciò che serve si calcola QUI, fuori dall'updater: quello dev'essere puro, perché
      // React può invocarlo zero, una o più volte in momenti che questo gestore non controlla
      // (è la stessa ragione scritta in useTrascinamentoTratto.ts).
      const arco = stato.edges.find((e) => e.id === arcoId)
      const capiArco = capi.get(arcoId)
      if (!arco || !capiArco) return
      const data = arco.data as SchemaEdgeData
      // Le quote infilate qui come in `candidati`, e per la stessa ragione: la polilinea su cui
      // si taglia dev'essere la STESSA su cui si è deciso quale tubo evidenziare, o si
      // spezzerebbe un tubo in un punto diverso da quello mostrato.
      const { centro, primo, secondo } = spezzaArco(
        polilineaDellArco(capiArco, { ...data, quote }),
        data.segni ?? [],
        centroDellaGiunzione(nodo)
      )
      const [idPrimo, idSecondo] = idDelleMeta(arcoId, new Set(stato.edges.map((e) => e.id)))
      const ancora = ancoraDi((nodo.data as SchemaNodeData).nodo, ANCORA_IN_ARRIVO)
      const posizione = { x: centro.x - (ancora?.x ?? 0), y: centro.y - (ancora?.y ?? 0) }

      // Un solo passo di Ctrl+Z, e si ottiene NON scrivendo una seconda voce di cronologia.
      // `onNodesChange` (SchemaEditor.tsx) ne ha già scritta una al primo evento di posizione
      // del trascinamento, quando lo stato era ancora quello di partenza: TEE dov'era e tubo
      // intero. Appoggiarsi a quella significa un solo passo; scriverne un'altra ne
      // richiederebbe due — uno per il tubo, uno per la posizione.
      //
      // L'eccezione è un TEE già fermo sopra un tubo, premuto e rilasciato senza muoverlo:
      // nessun evento di posizione, quindi nessuna voce su cui appoggiarsi, e lo spezzamento
      // sarebbe irreversibile. Lì la voce va scritta qui.
      const siEMosso = !iniziale || iniziale.x !== nodo.position.x || iniziale.y !== nodo.position.y
      const aggiorna = siEMosso ? aggiornaSenzaCronologia : applica

      aggiorna((s) => ({
        ...s,
        nodes: s.nodes.map((n) => (n.id === nodo.id ? { ...n, position: posizione } : n)),
        edges: [
          ...s.edges.filter((e) => e.id !== arcoId),
          {
            ...arco,
            id: idPrimo,
            target: nodo.id,
            targetHandle: ANCORA_IN_ARRIVO,
            data: { stile: data.stile, punti: primo.punti, segni: primo.segni } satisfies SchemaEdgeData,
          },
          {
            ...arco,
            id: idSecondo,
            source: nodo.id,
            sourceHandle: ANCORA_IN_PARTENZA,
            data: { stile: data.stile, punti: secondo.punti, segni: secondo.segni } satisfies SchemaEdgeData,
          },
        ],
      }))
    },
    [arcoSotto, stato.edges, capi, applica, aggiornaSenzaCronologia]
  )

  return { arcoEvidenziato, iniziaTrascinamento, seguiTrascinamento, concludiTrascinamento }
}
```

> **Nota per chi implementa — il punto più facile da sbagliare qui.** `polilineaDellArco` legge le quote dai **dati dell'arco**, e in questo hook non ci sono: `stato.edges` è lo stato grezzo, mentre le quote le infila `fondiDatiArchi` nell'elenco che va alla tela. Senza `{ ...data, quote }` la funzione **non fallisce**: ripiega in silenzio sul raccordo a un angolo solo, una forma che il tubo non ha mai avuto — il TEE si innesterebbe dove il tubo non passa, o non si innesterebbe affatto. Il test A cade con `arcoEvidenziato` a `null`: se lo vedi fallire così, è questo. **Non ripiegare aggiungendo un valore predefinito** in `polilineaDellArco`: quel ripiego esiste per intercettare in silenzio un chiamante distratto, e renderlo comodo lo trasformerebbe in una trappola.

- [ ] **Step 4: Verde**

```bash
npx vitest run src/components/schemaImpianto/__tests__/useInserimentoTee.test.ts > /tmp/d3-task4-verde.txt 2>&1; echo "exit=$?"; tail -14 /tmp/d3-task4-verde.txt
npx tsc --noEmit > /tmp/d3-task4-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d3-task4-tsc.txt
npx vitest run src/components/schemaImpianto > /tmp/d3-task4-componenti.txt 2>&1; echo "exit=$?"; tail -8 /tmp/d3-task4-componenti.txt
```

Atteso: **10** test verdi (A-J), `tsc` pulito, il resto dei componenti verde.

- [ ] **Step 5: Provare che i test discriminano — cinque mutazioni**

| # | Mutazione | Deve cadere |
|---|---|---|
| 1 | In `concludiTrascinamento`, usare sempre `aggiornaSenzaCronologia` | F, «premuto e rilasciato senza muoverlo» |
| 2 | Usare sempre `applica` | E, «un solo Ctrl+Z disfa tutto» (ne servirebbero due) |
| 3 | In `candidati`, togliere il filtro su `source`/`target` | H, «un tubo che ha già questo TEE per capo» |
| 4 | In `arcoSotto`, togliere il controllo su `nodiTrascinati.length` | I, «un trascinamento multiplo» |
| 5 | Non ricentrare il nodo (lasciare `n.position` invariata) | B, «la giunzione si ricentra sul tubo» |

- [ ] **Step 6: Commit**

```bash
git add src/components/schemaImpianto/useInserimentoTee.ts src/components/schemaImpianto/__tests__/useInserimentoTee.test.ts
git commit -m "feat(schema): il TEE trascinato su un tubo lo spezza in due tratti

Osservazione 5 del committente. Al rilascio la giunzione si ricentra sul tubo
e le due meta' ne conservano lo stile, i gomiti a mano e i segni, ognuno sulla
meta' su cui cade.

Un solo passo di Ctrl+Z, e si ottiene NON scrivendo una seconda voce di
cronologia: onNodesChange ne ha gia' scritta una al primo evento di posizione,
quando il tubo era intero e il TEE dov'era. L'eccezione e' un TEE premuto e
rilasciato senza muoverlo, che non produce alcun evento di posizione: li' la
voce si scrive qui, o lo spezzamento sarebbe irreversibile."
```

---

### Task 5: Il cablaggio e l'evidenziazione del tubo

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` (`SchemaEdgeData`, stile di `BaseEdge`)
- Modify: `src/components/schemaImpianto/conversioneFlow.ts` (`fondiDatiArchi`)
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (i tre gestori del trascinamento nodo)
- Test: `src/components/schemaImpianto/__tests__/fondiDatiArchi.test.ts` (esistente)

**Interfaces:**
- Consumes: `useInserimentoTee` (Task 4)
- Produces: `SchemaEdgeData.evidenziato?: boolean`; `fondiDatiArchi(..., arcoEvidenziato: string | null)`

**Contesto per chi implementa.** L'ultimo pezzo del gesto: far vedere quale tubo si spezzerà, e attaccare l'hook alla tela.

L'evidenziazione passa da `fondiDatiArchi` e non da un `map` in più dentro `SchemaEditor`, perché quella funzione **è** il punto unico dove i tre elenchi di archi si fondono, ed è dove si provano le invarianti che proteggono dai ripieghi (il suo docblock lo dice). Un secondo posto che tocca i dati degli archi è esattamente ciò che quella funzione esiste per impedire.

`SchemaEditor` passa già `onNodeDrag`/`onNodeDragStop` a `<ReactFlow>` da `useGuideAllineamento`: vanno **composti**, non sostituiti, e va aggiunto `onNodeDragStart`, che oggi non c'è.

- [ ] **Step 1: Il campo e la resa dell'evidenziazione**

In `src/components/schemaImpianto/SchemaEdgeTubazione.tsx`, dentro `SchemaEdgeData`, dopo `capi`:

```ts
  /**
   * Vero mentre un TEE trascinato sta sorvolando QUESTO tubo: al rilascio si spezzerà qui
   * (`useInserimentoTee.ts`). Lo infila `fondiDatiArchi` (conversioneFlow.ts) insieme a quote
   * e capi. È un aiuto visivo per il gesto in corso, non un dato del disegno: non entra nel
   * layout e il documento non lo vede.
   */
  evidenziato?: boolean
```

E nello stile di `BaseEdge`, sostituire:

```tsx
        style={{
          stroke: selected ? '#1976d2' : '#000',
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: stile === 'condensa' ? '8 6' : undefined,
        }}
```

con:

```tsx
        style={{
          // L'evidenziazione vince sulla selezione: durante un gesto conta vedere DOVE il TEE
          // si innesterà, e un tubo può benissimo essere insieme selezionato e sorvolato.
          stroke: edgeData?.evidenziato ? '#ed6c02' : selected ? '#1976d2' : '#000',
          strokeWidth: edgeData?.evidenziato ? 4 : selected ? 3 : 2,
          strokeDasharray: stile === 'condensa' ? '8 6' : undefined,
        }}
```

- [ ] **Step 2: Scrivere il test che fallisce**

In `src/components/schemaImpianto/__tests__/fondiDatiArchi.test.ts` — leggerlo prima, per riusare le sue fixture e il suo modo di costruire gli archi invece di inventarne un secondo — aggiungere:

```ts
  it('marca come evidenziato solo l’arco sorvolato dal TEE', () => {
    const fusi = fondiDatiArchi(edgesBase, edgesSegni, edgesTrascinamento, QUOTE, CAPI, 'e2')
    expect(fusi.map((e) => (e.data as SchemaEdgeData).evidenziato)).toEqual([false, true])
  })

  it('senza TEE sorvolante nessun arco è evidenziato', () => {
    const fusi = fondiDatiArchi(edgesBase, edgesSegni, edgesTrascinamento, QUOTE, CAPI, null)
    expect(fusi.every((e) => (e.data as SchemaEdgeData).evidenziato === false)).toBe(true)
  })
```

> **Nota per chi implementa:** i nomi `edgesBase`, `edgesSegni`, `edgesTrascinamento`, `QUOTE`, `CAPI` e gli id `e1`/`e2` sono quelli **presunti** del file esistente. **Leggilo e usa i suoi nomi veri**, adattando la fixture al codice — e se il file monta un solo arco, aggiungine uno secondo con lo stesso stile del file. Dichiaralo nel report.

```bash
npx vitest run src/components/schemaImpianto/__tests__/fondiDatiArchi.test.ts > /tmp/d3-task5-rosso.txt 2>&1; echo "exit=$?"; tail -20 /tmp/d3-task5-rosso.txt
```

- [ ] **Step 3: `fondiDatiArchi` porta anche l'evidenziazione**

In `src/components/schemaImpianto/conversioneFlow.ts`, aggiungere il parametro e il campo:

```ts
export function fondiDatiArchi(
  edgesConGomitiBase: Edge[],
  edgesConSegni: Edge[],
  edgesConTrascinamento: Edge[],
  quote: QuoteInstradamento,
  capiPerArco: Map<string, CapiArco>,
  /** L'arco che un TEE trascinato sta sorvolando (`useInserimentoTee.ts`), o `null`. */
  arcoEvidenziato: string | null
): Edge[] {
  return edgesConGomitiBase.map((e, i) => ({
    ...e,
    data: {
      ...e.data,
      ...edgesConSegni[i]?.data,
      ...edgesConTrascinamento[i]?.data,
      quote,
      capi: capiPerArco.get(e.id),
      evidenziato: e.id === arcoEvidenziato,
    } as SchemaEdgeData,
  }))
}
```

Il parametro è **obbligatorio**, non con valore predefinito `null`, per la stessa ragione per cui `testi` è obbligatorio in `flowALayout`: un valore predefinito lascerebbe un chiamante futuro spegnere l'evidenziazione in silenzio. E il docblock della funzione, che elenca «le due cose che un arco non può ricavarsi da solo», va aggiornato: ora sono tre.

- [ ] **Step 4: Cablare l'hook nell'editor**

In `src/components/schemaImpianto/SchemaEditor.tsx`:

Importare l'hook accanto agli altri (`import { useInserimentoTee } from './useInserimentoTee'`) e istanziarlo **dopo** `quote` e `capi`, accanto a `useGuideAllineamento`:

```tsx
  // Inserire un TEE su un tubo esistente: logica isolata in un hook suo (vedi
  // useInserimentoTee.ts), stesso motivo di useGomiti.ts. Riceve `quote` e `capi` perché deve
  // ricostruire la STESSA polilinea che la tela disegna: agganciarsi a una forma diversa
  // spezzerebbe il tubo dove l'utente non l'ha puntato.
  const {
    arcoEvidenziato,
    iniziaTrascinamento: iniziaTrascinamentoTee,
    seguiTrascinamento: seguiTrascinamentoTee,
    concludiTrascinamento: concludiTrascinamentoTee,
  } = useInserimentoTee(stato, applica, aggiornaSenzaCronologia, quote, capi)
```

Passare `arcoEvidenziato` a `fondiDatiArchi` (e aggiungerlo alle dipendenze dell'`useMemo`):

```tsx
  const edgesConGomiti = useMemo(
    () => fondiDatiArchi(edgesConGomitiBase, edgesConSegni, edgesConTrascinamento, quote, capi, arcoEvidenziato),
    [edgesConGomitiBase, edgesConSegni, edgesConTrascinamento, quote, capi, arcoEvidenziato]
  )
```

Comporre i gestori del trascinamento — le guide di allineamento e l'inserimento del TEE guardano lo **stesso** gesto e devono vederlo entrambi:

```tsx
  // Guide di allineamento e inserimento del TEE guardano lo stesso trascinamento: i gestori si
  // compongono, non si sostituiscono. `onNodeDragStart` non c'era: serve all'inserimento per
  // sapere se il gesto ha mosso il nodo — e quindi se `onNodesChange` ha già scritto la voce di
  // cronologia su cui appoggiarsi (vedi useInserimentoTee.ts).
  const suInizioTrascinamentoNodo = useCallback(
    (_e: React.MouseEvent, nodo: Node) => iniziaTrascinamentoTee(nodo),
    [iniziaTrascinamentoTee]
  )
  const suTrascinamentoNodo = useCallback(
    (e: React.MouseEvent, nodo: Node, nodi: Node[]) => {
      onNodeDrag(e, nodo, nodi)
      seguiTrascinamentoTee(nodo, nodi)
    },
    [onNodeDrag, seguiTrascinamentoTee]
  )
  const suFineTrascinamentoNodo = useCallback(
    (_e: React.MouseEvent, nodo: Node, nodi: Node[]) => {
      onNodeDragStop()
      concludiTrascinamentoTee(nodo, nodi)
    },
    [onNodeDragStop, concludiTrascinamentoTee]
  )
```

e sostituire, su `<ReactFlow>`:

```tsx
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
```

con:

```tsx
          onNodeDragStart={suInizioTrascinamentoNodo}
          onNodeDrag={suTrascinamentoNodo}
          onNodeDragStop={suFineTrascinamentoNodo}
```

- [ ] **Step 5: Verde, compilazione e mutazione**

```bash
npx vitest run > /tmp/d3-task5-verde.txt 2>&1; echo "exit=$?"; tail -8 /tmp/d3-task5-verde.txt
npx tsc --noEmit > /tmp/d3-task5-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d3-task5-tsc.txt
```

Mutazione obbligatoria: in `fondiDatiArchi`, `evidenziato: true` fisso. Deve far cadere «senza TEE sorvolante nessun arco è evidenziato». Redirigi su file, poi ripristina.

Nessun test automatico sul cablaggio di `SchemaEditor`: è un componente React, e `CLAUDE.md` esclude i test di interfaccia. La verifica è in pagina, nel Task 7.

- [ ] **Step 6: Commit**

```bash
git add src/components/schemaImpianto/SchemaEdgeTubazione.tsx src/components/schemaImpianto/conversioneFlow.ts src/components/schemaImpianto/SchemaEditor.tsx src/components/schemaImpianto/__tests__/fondiDatiArchi.test.ts
git commit -m "feat(schema): il tubo sotto il TEE trascinato si evidenzia

Passa da fondiDatiArchi e non da un map in piu' dentro SchemaEditor: quella
funzione e' il punto unico dove i dati degli archi si fondono, ed e' dove si
provano le invarianti che proteggono dai ripieghi.

Guide di allineamento e inserimento del TEE guardano lo stesso trascinamento,
quindi i gestori si compongono. onNodeDragStart non c'era: serve a sapere se
il gesto ha mosso il nodo, e quindi se una voce di cronologia esiste gia'."
```

---

### Task 6: L'effetto sul documento, letto differenza per differenza

**Files:**
- Create: `src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts`
- Modify: `src/services/schemaImpianto/__tests__/renderSvg.test.ts` (un test nuovo)

**Interfaces:**
- Consumes: tutto quanto sopra
- Produces: `export const SVG_RIFERIMENTO_CON_TEE: string` (e le righe da cui è composto)

**Contesto per chi implementa.** La spec chiede che l'effetto sul documento sia **dimostrato, non asserito**: «sulle pratiche senza TEE non cambia nulla… con la sola differenza attesa sull'impianto che il TEE ce l'ha», e che il riferimento committato sia ri-basato **già in questo blocco**, limitatamente al TEE, con la disciplina «prima si legge la differenza, poi la si accetta».

Il riferimento oggi committato (`svgRiferimentoSenzaTesti.ts`) copre un impianto **senza** giunzioni: la sua parte del lavoro è **non cambiare**, e il suo test è già verde dal Task 2. Ciò che manca è un riferimento che il TEE ce l'abbia, e che quindi si accorga di un ritocco futuro alla sua geometria: è quello che questo task aggiunge.

**Trappola già pagata nel D2, da non ripagare:** un `diff` diretto fra file estratti con `git show` e file di lavoro segnala differenze che sono **solo il fine-riga**. Usare `--strip-trailing-cr`. Chi non se ne accorgesse concluderebbe il falso opposto.

- [ ] **Step 1: Il banco di confronto prima/dopo, e la prova che discrimina**

Estrarre la cartella dei servizi alla base del blocco e rendere gli **stessi** impianti con le due versioni, confrontando le stringhe:

La copia va **dentro `src`**, come nel D2 (`schemaImpianto-base/`), non in `/tmp`: da fuori l'albero dei sorgenti gli import relativi e gli alias `@/` non si risolvono.

```bash
cd "$(git rev-parse --show-toplevel)"
rm -rf /tmp/d3-estratto && mkdir -p /tmp/d3-estratto
git archive b0a538d src/services/schemaImpianto | tar -x -C /tmp/d3-estratto
cp -r /tmp/d3-estratto/src/services/schemaImpianto src/services/schemaImpianto-base
rm -rf src/services/schemaImpianto-base/__tests__
ls src/services/schemaImpianto-base/
```

Costruire un banco con **sei casi**, i cinque del D2 più uno nuovo: impianto minimo; catena completa (compressore, serbatoio verticale, essiccatore, filtro); due serbatoi sullo stesso compressore; con separatore (corsia condense); due compressori; **un impianto con un TEE su una linea aria**.

Il banco è un file di prova temporaneo, `src/services/schemaImpianto/__tests__/banco.temp.test.ts`, **che non va committato**: rende ogni caso con le due versioni e scrive l'esito su file. La forma:

```ts
import { describe, expect, it } from 'vitest'
import { renderSvg } from '../renderSvg'
// La copia dei servizi alla base del blocco (`b0a538d`), estratta in `schemaImpianto-base/`.
import { renderSvg as renderSvgPrima } from '../../schemaImpianto-base/renderSvg'
import type { SchemaLayout } from '../types'

const CASI: { nome: string; layout: SchemaLayout }[] = [
  /* i sei layout, riusando le fixture già presenti in renderSvg.test.ts e layout.test.ts */
]

describe('banco di confronto D3', () => {
  for (const caso of CASI) {
    it(`${caso.nome}`, () => {
      expect(renderSvg(caso.layout)).toBe(renderSvgPrima(caso.layout))
    })
  }
})
```

**Prima di fidarsi del banco, provare che discrimina**: applicare alla `renderSvg` **nuova** una sostituzione di stringa (`<svg` → `<svg data-mutazione="1"`), con una guardia che fallisce se la sostituzione non avviene, e verificare che **tutti e sei** i casi diventino rossi. Poi ripristinare. Nel D2 la prima mutazione tentata — inserire codice dopo la firma — dava `no tests` per un errore di compilazione e **non provava nulla**: la graffa intercettata era quella di un parametro con valore predefinito.

Atteso, a banco provato: **cinque casi su sei verdi**, e il sesto — quello col TEE — **rosso**. Salvare i due SVG di quel caso su file per lo Step 2:

```bash
npx vitest run src/services/schemaImpianto/__tests__/banco.temp.test.ts > /tmp/d3-banco-esito.txt 2>&1; echo "exit=$?"; tail -20 /tmp/d3-banco-esito.txt
```

- [ ] **Step 2: Leggere la differenza, e accettarla solo se è quella attesa**

Scrivere i due SVG del caso col TEE su file (dal banco, con una `writeFileSync` temporanea o copiando dall'esito di vitest) e confrontarli **un elemento per riga**, o il diff sarà una riga tolta e una messa da ottomila caratteri:

```bash
# un elemento SVG per riga, così il diff è leggibile da un umano
sed 's/></>\n</g' /tmp/d3-tee-prima.svg > /tmp/d3-tee-prima.righe
sed 's/></>\n</g' /tmp/d3-tee-dopo.svg  > /tmp/d3-tee-dopo.righe
diff --strip-trailing-cr /tmp/d3-tee-prima.righe /tmp/d3-tee-dopo.righe > /tmp/d3-differenza-tee.txt; echo "exit=$?"; cat /tmp/d3-differenza-tee.txt
```

Le differenze ammesse sono **due, e solo due**:

1. Il pallino: `r="12"` → `r="5"` nel `<g>` della giunzione.
2. I capi dei tubi che arrivano alla giunzione, spostati dal bordo del riquadro al **centro**: +12 su una coordinata per ogni capo che tocca la giunzione. Lo scarto **non resta al capo** — `rottaLinea` ricava `xMedia` dai capi e lo propaga ai vertici intermedi — quindi è normale vedere cambiare anche i vertici di quelle polilinee. Verificare che ogni vertice cambiato appartenga a un tubo che tocca la giunzione.

**Qualunque terza differenza è un difetto**, non un aggiornamento da accettare: in particolare, nulla deve cambiare nella tabella, nella legenda, nel muro o nelle dimensioni della pagina — il riquadro d'ingombro della giunzione è rimasto 24×24 e `dimensioniLayout` legge quello.

Scrivere nel report l'elenco delle differenze lette, con i numeri.

- [ ] **Step 3: Il riferimento committato del TEE**

Creare `src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts` **sul modello esatto di `svgRiferimentoSenzaTesti.ts`**: leggerne l'intestazione e riprodurne la disciplina — un elemento SVG per riga (un `<rect>`/`<line>`/`<text>`/`<path>`/`<g>` top-level per voce), il commento su quando è legittimo aggiornarlo, e la riga «Generato l'ultima volta dal commit …» con l'hash del commit di questo task.

Il layout coperto: **compressore + serbatoio + una giunzione con almeno due tubi che vi arrivano da lati diversi** — è il minimo che fissi sia il raggio del pallino sia i capi convergenti al centro. Generarlo dal codice **nuovo**, non ritoccando a mano il vecchio.

Aggiungere in `renderSvg.test.ts`, accanto al test del riferimento esistente e con lo stesso taglio:

```ts
  // Riferimento ESTERNO al codice corrente, non un self-comparison: `renderSvg(x) === renderSvg(x)`
  // non discrimina nulla. Fissa la geometria del TEE decisa nel Blocco D3 — pallino a diametro
  // 10 e tubi che convergono nel centro — che senza di questo nessun test del documento vede.
  it('un impianto con un TEE resta identico al riferimento', () => {
    expect(renderSvg(layoutConTee())).toBe(SVG_RIFERIMENTO_CON_TEE)
  })
```

con `layoutConTee()` scritta accanto alle altre fixture del file, nello stesso stile.

- [ ] **Step 4: Provare che il riferimento nuovo discrimina**

Non basta che sia verde: va provato che **si accorge** di un cambiamento del TEE. Mutazione: riportare `DIAMETRO_GIUNZIONE` a 24. Il test nuovo deve cadere, e quello del riferimento **senza** TEE deve restare verde. Redirigi su file, poi ripristina.

```bash
npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts > /tmp/d3-task6-mut.txt 2>&1; echo "exit=$?"; grep -E "✓|×|failed|passed" /tmp/d3-task6-mut.txt | tail -15
git checkout src/services/schemaImpianto/symbols/index.ts
```

- [ ] **Step 5: Smontare il banco e commit**

Il banco e la copia dei servizi **non si committano**: sono impalcatura. `git status --short` deve mostrare solo i due file del riferimento.

```bash
rm -rf src/services/schemaImpianto-base /tmp/d3-estratto
rm -f src/services/schemaImpianto/__tests__/banco.temp.test.ts
git status --short > /tmp/d3-task6-albero.txt; cat /tmp/d3-task6-albero.txt
git add src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts
git commit -m "test(schema): il riferimento SVG copre anche un impianto col TEE

Il riferimento committato non aveva giunzioni, quindi nessun test del
documento si sarebbe accorto di un ritocco alla loro geometria: quello vecchio
resta verde senza essere toccato — ed e' la prova che le pratiche senza TEE
non cambiano — e accanto ne nasce uno che il TEE ce l'ha.

Le due sole differenze del blocco sul documento, lette una per una sul banco
di confronto prima/dopo: il raggio del pallino e i capi dei tubi che ora
convergono nel centro della giunzione."
```

---

### Task 7: Suite, verifica in pagina e resoconto

Lo esegue **il controller**.

- [ ] **Step 1: Suite intera, una sola esecuzione**

```bash
npx vitest run > /tmp/d3-finale-vitest.txt 2>&1; echo "exit=$?"; tail -6 /tmp/d3-finale-vitest.txt
npx tsc --noEmit > /tmp/d3-finale-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d3-finale-tsc.txt
```

Vitest muore su esecuzioni concorrenti: **una sola alla volta**. Un timeout infrastrutturale isolato non è un fallimento del codice — si rilancia il solo file.

- [ ] **Step 2: Verifica in pagina**

Pratica `c6f56ca5-d57b-408c-a4e5-69a207812b0d` → «Genera relazione» → «Rifinisci schema», sul dev server **5176 dal worktree** (verificare il `CommandLine` del processo, non solo la porta). **Mai premere «Genera comunque .docx»**; chiudere con «Annulla modifiche» + «Annulla»; verificare in banca dati prima e dopo, **confrontando i campi di `additional_info` uno per uno e non il timestamp** — `updated_at` si muove da sé, per il salvataggio continuo della scheda.

Attenzione ai **dialoghi impilati**: identificarli per titolo, non con `querySelector` sul primo. `[role="separator"]` prende anche i `Divider` della barra strumenti. Diversi pulsanti hanno un'icona invece del testo.

Se un gesto sembra ignorare una modifica appena fatta, **riprovare con un `page.goto` esplicito** prima di sospettare il codice: nel D2 cinque prove manuali hanno visto non funzionare ciò che un `page.goto` su un profilo pulito ha visto funzionare al primo gesto, con lo stesso codice.

Da misurare, uno per uno:

1. **Il pallino è piccolo e non lascia buco**: aggiungere un TEE dalla palette, collegarci due tubi da lati diversi. Atteso: il pallino è visibilmente più piccolo del riquadro e **i tubi arrivano al suo centro**, senza interruzione fra la fine del tubo e il pallino.
2. **La presa non è cambiata**: il TEE si afferra e si trascina, e si può tracciare una tubazione **da ognuno dei quattro lati**. Atteso: quattro maniglie distinte e larghe, come prima.
3. **L'evidenziazione**: trascinare un TEE sopra un tubo. Atteso: il tubo cambia colore mentre ci si passa sopra, e torna nero quando ci si allontana.
4. **Lo spezzamento**: rilasciare. Atteso: **due tubi al posto di uno**, giunzione ricentrata **sul** tubo, e il tracciato disegnato **non salta** — la forma resta quella di prima del rilascio.
5. **Lo stile si conserva**: ripetere su una linea **condense** e su una **flessibile**. Atteso: entrambe le metà conservano tratteggio/onda.
6. **I segni vanno alla metà giusta**: posare una valvola su un tubo, poi spezzarlo di là dalla valvola. Atteso: la valvola resta dov'era, sulla metà su cui cadeva.
7. **Un solo Ctrl+Z**: dopo lo spezzamento, un Ctrl+Z solo deve riportare il tubo intero **e** il TEE dov'era.
8. **Nulla di rotto**: gomiti, segni sul tubo, trascinamento del tratto, magnete e frecce continuano a funzionare; l'**anteprima** accanto alla tela mostra il TEE piccolo come la tela.

- [ ] **Step 3: Ledger e resoconto al committente**

Scrivere il ledger in `.superpowers/sdd/2026-08-14-schema-impianto-blocco-d3/progress.md` e il resoconto. **Non dichiarare funzionante ciò che non si è visto funzionare**: nel D2 un'aggiunta è stata scambiata per funzionante mentre era codice morto, e la lezione è costata due giri.

---

## Cosa questo piano NON fa

- **Non tocca `posizioneAncora`**: resta la fonte unica su dove sta un capo di tubo.
- **Non porta le ancore degli altri simboli sulla griglia**: lo farà il committente rifacendo la libreria. Il secondo magnete del D2 è ciò che tiene dritto il disegno nel frattempo.
- **Non tocca valvole e muro**: sono il Blocco D4. In particolare **il fix del muro `b0a538d` non è il D4.2** — quello era una correzione di dominio (solo il serbatoio può stare fuori sala compressori), il D4.2 è «il muro diventa un oggetto editabile».
- **Non rende il TEE staccabile**: togliere un TEE da un tubo e ricucire le due metà in una sola tubazione non è nella spec.
- **Non aggancia alla griglia la giunzione inserita su un tubo**: si posa **sul tubo**, che è ciò che il gesto chiede; agganciarla alla griglia la staccherebbe dalla linea.
- **Non integra su `main`.**

## Code lasciate aperte di proposito, da portare al committente nel Task 7

- Le due metà nascono con **gomiti espliciti**, quindi non seguono più il riassestamento automatico delle quote quando si spostano le apparecchiature. È il prezzo di conservare la forma su cui il TEE è stato posato, ed è una scelta, non una svista.
- Un TEE inserito su un tubo si posa **fuori griglia** se il tubo è fuori griglia.
