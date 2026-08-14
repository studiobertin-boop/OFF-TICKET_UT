# Schema d'impianto DM329 — Blocco D2: la griglia

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far sì che tutto ciò che il committente piazza a mano finisca **sui punti della griglia**, e che una linea che deve restare dritta resti dritta anche mentre le ancore dei simboli sono ancora fuori griglia.

**Architecture:** Il difetto non è che i gesti ignorino la griglia — misurato: gomiti e apparecchiature ci atterrano già. È che il trascinamento del tratto e quello dell'annotazione agganciano lo **spostamento** e non la **posizione**, sommando un multiplo di 10 a una partenza fuori griglia. La correzione è quindi *far agganciare la posizione risultante*, e vive in **funzioni pure**: un modulo nuovo con l'aritmetica della griglia, che `trascinaTratto` e le operazioni sulle annotazioni consumano. Il secondo magnete — le quote dei due capi del tubo come posizioni buone accanto a quelle della griglia — è la stessa funzione con un elenco di candidati in più.

**Tech Stack:** React 18 + TypeScript (strict:false) + Material UI 6 + @xyflow/react + Vitest (jsdom)

**Spec:** `docs/superpowers/specs/2026-08-14-schema-impianto-blocco-d-design.md`, sezione **Blocco D2** (corretta il 14-08-2026 sui fatti misurati in pagina, commit `abca947`)

## Global Constraints

- **NESSUN merge e nessun push su `main`** finché il committente non lo dice. Solo commit locali sul ramo `worktree-schema-impianto-dm329`.
- **Il committente non usa ancora l'editor per i propri schemi**: nessun layout salvato da preservare, e **nessuna scelta va motivata con la retrocompatibilità**.
- **Il documento consegnato al cliente non deve cambiare.** `git diff <base>..HEAD --stat -- src/services/schemaImpianto/renderSvg.ts src/services/schemaImpianto/layout.ts src/services/schemaImpianto/symbols` deve restare **vuoto**. Questo blocco tocca `src/services/schemaImpianto/tratti.ts`, che il documento **usa**: ogni modifica lì va provata non alterare l'SVG reso — vedi il Task 7.
- **Ogni test nuovo va visto fallire per MUTAZIONE**, su un'implementazione plausibilmente sbagliata. Un rosso da «funzione non definita» non prova nulla. **Dieci test verdi che non provavano niente** sono stati scoperti così in tre blocchi.
- **Le prove si producono con una redirezione su file, mai trascrivendo.**
- **Ogni commento toccato descrive il repo com'è a fine task**, non come sarà. Sedici commenti falsi in due blocchi, e tre introdotti dall'ondata di pulizia del D1: è la classe ricorrente numero due.
- **L'aritmetica non va nei componenti**: il modulo non monta componenti React nei test (`CLAUDE.md`, «no UI test»). Il calcolo sta nei moduli puri perché sia collaudabile.
- **NON eseguire `prettier --write`**: il `.prettierrc` non corrisponde allo stile effettivo del codice e riformatta interi file. È già successo nel D1.
- **Localizzare per contenuto, mai per numero di riga.**
- `minZoom={0.1}` è basso apposta: **non alzarlo**.
- Baseline: **952 test su 77 file verdi**, `tsc --noEmit` pulito, testa `abca947`.

---

## I fatti misurati che questo piano usa

Misurati in pagina il 14-08-2026 sulla pratica `c6f56ca5`, con gesti veri. **Non sono ipotesi: chi implementa può darli per buoni.**

| Gesto | Comportamento | Va corretto? |
|---|---|---|
| Trascinamento delle apparecchiature | posizione assoluta sulla griglia (`snapGrid` di react-flow) | No |
| Creazione del gomito (doppio clic) | atterra in (730, 250), **sulla griglia** | No |
| Trascinamento del gomito | atterra in (780, 170), **sulla griglia** | No |
| Trascinamento del tratto | **726,5 → 776,5**: spostamento di 50 esatti, scarto conservato | **Sì** |
| Trascinamento dell'annotazione | **573,75 → 513,75**: spostamento di 60 esatti, scarto conservato | **Sì** |
| Frecce da tastiera | passo **1**, con Shift **10** | **Sì** |
| Nodo nuovo dalla palette | atterra a y = **585** | **Sì** |
| Annotazione nuova | nasce a y = **573,75** | **Sì** |

E la prova del secondo magnete: sulla tubazione `std-3` il tracciato è
`M 677 260 L 726,5 260 L 726,5 234 L 776 234` — parte da quota 260 e arriva a quota
**234**. Un gomito creato col doppio clic atterra correttamente in (730, 250) e produce
**tre scalini invece di uno**: nessun punto della griglia può raccordare 260 con 234.

---

## Struttura dei file

| File | Responsabilità | Task |
|---|---|---|
| `src/services/schemaImpianto/griglia.ts` | **Nuovo.** L'aritmetica della griglia dell'editor: passo, allineamento, e il magnete che accetta quote preferite. | 1 |
| `src/services/schemaImpianto/__tests__/griglia.test.ts` | **Nuovo.** Prove del modulo sopra. | 1 |
| `src/services/schemaImpianto/tratti.ts` | `trascinaTratto` posa la quota **assoluta** agganciata invece di sommare uno spostamento. | 2 |
| `src/components/schemaImpianto/useTestiLiberi.ts` | `testiConSpostamento` allinea la posizione. | 3 |
| `src/components/schemaImpianto/SchemaEditor.tsx` | Frecce a passo 10/50 con posizione allineata; nodi e annotazioni nuovi allineati. | 4 |
| `src/components/schemaImpianto/useGestoPuntatore.ts` | **Nuovo.** Il pattern comune dei gesti: cattura, guardia «si è mosso davvero», riferimento del primo evento, annullamento. | 5 |
| `src/components/schemaImpianto/SchemaEdgeTubazione.tsx`, `useGomiti.ts`, `useSegniTubo.ts` | Adottano il pattern comune e guadagnano `onPointerCancel`. | 5 |
| `src/components/schemaImpianto/useTrascinamentoTratto.ts` | Un trascinamento che finisce dov'è cominciato restituisce il tubo all'instradamento automatico. | 6 |

---

### Task 1: L'aritmetica della griglia

**Files:**
- Create: `src/services/schemaImpianto/griglia.ts`
- Test: `src/services/schemaImpianto/__tests__/griglia.test.ts`

**Interfaces:**
- Consumes: nulla
- Produces:
  - `const PASSO_GRIGLIA = 10`
  - `function allineaAllaGriglia(valore: number): number`
  - `function agganciaQuota(valore: number, quotePreferite: number[]): number`

**Contesto per chi implementa.** `agganciaQuota` è il cuore del blocco. Ha una proprietà che vale la pena capire prima di scriverla, perché **rende inutile un parametro di tolleranza**: il passo è 10, quindi la distanza dal punto di griglia più vicino non supera mai 5. Una quota preferita vince quindi **se e solo se** dista meno di 5 dal valore grezzo, automaticamente, senza raggio da tarare. A parità di distanza vince la quota preferita, perché il suo scopo è tenere dritta la linea.

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/services/schemaImpianto/__tests__/griglia.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PASSO_GRIGLIA, agganciaQuota, allineaAllaGriglia } from '../griglia'

describe('allineaAllaGriglia', () => {
  it('porta al punto di griglia più vicino', () => {
    expect(allineaAllaGriglia(726.5)).toBe(730)
    expect(allineaAllaGriglia(573.75)).toBe(570)
    expect(allineaAllaGriglia(585)).toBe(590)
  })

  // Un valore già allineato non deve muoversi: è il caso che un arrotondamento
  // sbagliato (per difetto o per eccesso invece che al più vicino) sposterebbe.
  it('lascia fermo ciò che è già sulla griglia', () => {
    expect(allineaAllaGriglia(260)).toBe(260)
    expect(allineaAllaGriglia(0)).toBe(0)
    expect(allineaAllaGriglia(-40)).toBe(-40)
  })

  it('vale anche a sinistra dello zero', () => {
    expect(allineaAllaGriglia(-23)).toBe(-20)
    expect(allineaAllaGriglia(-27)).toBe(-30)
  })

  it('il passo è quello della griglia visibile', () => {
    expect(PASSO_GRIGLIA).toBe(10)
  })
})

describe('agganciaQuota', () => {
  it('senza quote preferite si comporta come la sola griglia', () => {
    expect(agganciaQuota(726.5, [])).toBe(730)
    expect(agganciaQuota(573.75, [])).toBe(570)
  })

  // 234 è la quota di un capo del tubo: dista 2 dal valore grezzo, mentre il punto di
  // griglia più vicino (240) ne dista 6. Vince il capo, e la linea resta dritta.
  it('una quota preferita vicina vince sul punto di griglia', () => {
    expect(agganciaQuota(236, [260, 234])).toBe(234)
  })

  // Qui il valore è lontano da entrambi i capi: comanda la griglia, altrimenti i capi
  // catturerebbero il tratto per tutta la corsa e il gesto diventerebbe inservibile.
  it('lontano dalle quote preferite comanda la griglia', () => {
    expect(agganciaQuota(312, [260, 234])).toBe(310)
  })

  // A parità di distanza vince la quota preferita: il suo scopo è tenere dritta la linea,
  // e il punto di griglia in quel caso non aggiunge nulla. Una sola quota preferita, non
  // due: con due equidistanti il caso non direbbe nulla sul pareggio fra griglia e capo,
  // ma solo su quale delle due il ciclo tiene per ultima.
  it('a parità di distanza vince la quota preferita', () => {
    // 245 dista 5 dal punto di griglia (250) e 5 dalla quota preferita (240).
    expect(agganciaQuota(245, [240])).toBe(240)
  })

  it('sceglie la più vicina fra più quote preferite', () => {
    expect(agganciaQuota(258, [234, 260])).toBe(260)
  })

  it('una quota preferita già sulla griglia non cambia nulla', () => {
    expect(agganciaQuota(261, [260])).toBe(260)
  })
})
```

- [ ] **Step 2: Eseguire i test e vederli fallire**

```bash
npx vitest run src/services/schemaImpianto/__tests__/griglia.test.ts > /tmp/d2-task1-rosso.txt 2>&1; echo "exit=$?"; tail -20 /tmp/d2-task1-rosso.txt
```

Atteso: fallimento per modulo non risolvibile. **Questo rosso non prova nulla**: la prova è lo Step 5.

- [ ] **Step 3: Scrivere il modulo**

Creare `src/services/schemaImpianto/griglia.ts`:

```ts
/**
 * L'aritmetica della griglia dell'EDITOR. Il documento non aggancia nulla: le sue quote
 * nascono dall'auto-layout e dalle ancore dei simboli, e restano quelle. Qui si decide
 * soltanto dove finisce ciò che il committente piazza a mano.
 *
 * Sta fra i servizi e non fra i componenti perché la consuma anche `trascinaTratto`
 * (tratti.ts), e perché il modulo non monta componenti React nei test: un calcolo dentro
 * un componente è un calcolo che nessuno prova.
 */

/** Stesso passo della griglia visibile e dello `snapGrid` di react-flow. */
export const PASSO_GRIGLIA = 10

export function allineaAllaGriglia(valore: number): number {
  return Math.round(valore / PASSO_GRIGLIA) * PASSO_GRIGLIA
}

/**
 * Porta `valore` sulla posizione buona più vicina, dove le posizioni buone sono i punti
 * della griglia PIÙ le `quotePreferite` — tipicamente le quote dei due capi di un tubo.
 *
 * Serve perché le ancore dei simboli sono ancora fuori griglia (`y=49`, `x=117`… nel
 * registro): un tubo che parte da quota 260 e arriva a quota 234 non può essere raccordato
 * da alcun punto della griglia, e agganciare solo alla griglia PEGGIORA il disegno invece
 * di migliorarlo. Quando il committente porterà le ancore sui punti giusti, le due famiglie
 * di candidati coincideranno e questa funzione diventerà indistinguibile da
 * `allineaAllaGriglia`: non è un debito da disfare.
 *
 * Nessun raggio di tolleranza da tarare, e non è una svista: col passo a 10 la distanza dal
 * punto di griglia più vicino non supera mai 5, quindi una quota preferita vince se e solo
 * se dista meno di 5 — la soglia esiste già, implicita nella geometria. A parità vince la
 * quota preferita, perché il punto di griglia lì non aggiunge nulla mentre lei tiene dritta
 * la linea.
 */
export function agganciaQuota(valore: number, quotePreferite: number[]): number {
  let migliore = allineaAllaGriglia(valore)
  let distanzaMigliore = Math.abs(valore - migliore)
  for (const quota of quotePreferite) {
    const distanza = Math.abs(valore - quota)
    if (distanza <= distanzaMigliore) {
      migliore = quota
      distanzaMigliore = distanza
    }
  }
  return migliore
}
```

- [ ] **Step 4: Eseguire i test e vederli passare**

```bash
npx vitest run src/services/schemaImpianto/__tests__/griglia.test.ts > /tmp/d2-task1-verde.txt 2>&1; echo "exit=$?"; tail -12 /tmp/d2-task1-verde.txt
```

Atteso: `exit=0`, **10** test verdi (quattro su `allineaAllaGriglia`, sei su `agganciaQuota`).

- [ ] **Step 5: Provare che i test discriminano — quattro mutazioni, una alla volta**

Per ognuna: applicare, eseguire **redirigendo su file**, annotare quali test cadono, **ripristinare**. Nessuna mutazione va committata.

| # | Mutazione | Deve cadere |
|---|---|---|
| 1 | `Math.round` → `Math.floor` in `allineaAllaGriglia` | «porta al punto più vicino» e «vale anche a sinistra dello zero» |
| 2 | In `agganciaQuota`, non considerare affatto `quotePreferite` (ciclo rimosso) | «una quota preferita vicina vince», «a parità di distanza», «sceglie la più vicina fra più quote» |
| 3 | In `agganciaQuota`, `distanza <= distanzaMigliore` → `distanza < distanzaMigliore` | «a parità di distanza vince la quota preferita» |
| 4 | In `agganciaQuota`, invertire la preferenza: partire dalla prima quota preferita e considerare la griglia solo se più vicina in senso stretto | «lontano dalle quote preferite comanda la griglia» |

```bash
# esempio per la mutazione 1 — ripetere per ognuna
npx vitest run src/services/schemaImpianto/__tests__/griglia.test.ts > /tmp/d2-task1-mut1.txt 2>&1; echo "exit=$?"; grep -E "✓|×|failed|passed" /tmp/d2-task1-mut1.txt | tail -15
git checkout src/services/schemaImpianto/griglia.ts
```

Se una mutazione **non** fa cadere nulla, il test corrispondente non discrimina: rinforzalo prima di procedere e **dichiaralo nel report**.

- [ ] **Step 6: Albero pulito e commit**

```bash
git diff --stat > /tmp/d2-task1-albero.txt; cat /tmp/d2-task1-albero.txt
git add src/services/schemaImpianto/griglia.ts src/services/schemaImpianto/__tests__/griglia.test.ts
git commit -m "feat(schema): l'aritmetica della griglia dell'editor

allineaAllaGriglia porta al punto piu' vicino; agganciaQuota accetta anche
le quote dei capi di un tubo come posizioni buone.

Il secondo magnete serve perche' le ancore dei simboli sono ancora fuori
griglia: un tubo che parte da quota 260 e arriva a 234 non puo' essere
raccordato da alcun punto della griglia, e agganciare solo a quella
peggiorerebbe il disegno invece di migliorarlo.

Nessun raggio di tolleranza da tarare: col passo a 10 la distanza dal punto
di griglia non supera mai 5, quindi la soglia esiste gia' implicita."
```

---

### Task 2: Il tratto si posa sulla griglia invece di scivolare

**Files:**
- Modify: `src/services/schemaImpianto/tratti.ts` (`trascinaTratto`)
- Test: `src/services/schemaImpianto/__tests__/tratti.test.ts` (esistente)

**Interfaces:**
- Consumes: `agganciaQuota` da `./griglia` (Task 1)
- Produces: `trascinaTratto` con la stessa firma; cambia solo dove posa il tratto

**Contesto per chi implementa.** Oggi `trascinaTratto` calcola `p.y + delta.y` (o `p.x + delta.x`): somma uno spostamento a una quota di partenza che può essere fuori griglia, e lo scarto sopravvive per sempre — **misurato: 726,5 finisce a 776,5**. La correzione è posare la **quota assoluta** agganciata.

Il tratto è ortogonale per costruzione, quindi ha **una sola** coordinata condivisa dai due capi: quella si sposta, l'altra no. Le quote preferite sono quelle dei due capi del tubo (`pDa` e `pA`) **sull'asse che si muove**.

- [ ] **Step 1: Scrivere i test che falliscono**

Aggiungere in `src/services/schemaImpianto/__tests__/tratti.test.ts`, dentro il `describe` di `trascinaTratto` (o in uno nuovo se non esiste):

Le due costanti `STILE_INDIFFERENTE` e `QUOTE_INDIFFERENTE` esistono già in quel file ed è il modo di casa; l'indice del tratto si trova con `findIndex` sulla polilinea risolta, **non si scrive a mano** — anche questo è il modo di casa, e c'è un commento nel file che spiega perché.

```ts
  // Il difetto misurato in pagina: un tratto che parte da una quota fuori griglia ci
  // restava per sempre, perché si sommava uno spostamento invece di posare una quota.
  // Il montante a x=126,5 è il caso vero, rimpicciolito: in pagina era x=726,5.
  it('posa il tratto sulla griglia anche partendo da una quota fuori griglia', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 300, y: 100 }
    const gomiti = [
      { x: 126.5, y: 0 },
      { x: 126.5, y: 100 },
    ]
    const full = polilineaConGomiti(pDa, gomiti, pA)
    const indiceTratto = full.findIndex((p, i) => full[i + 1] && p.x === full[i + 1].x && p.x === 126.5)
    expect(indiceTratto).toBeGreaterThanOrEqual(0)

    const nuovi = trascinaTratto(STILE_INDIFFERENTE, pDa, pA, gomiti, QUOTE_INDIFFERENTE, indiceTratto, { x: 33, y: 0 })

    // 126,5 + 33 = 159,5: il punto di griglia più vicino è 160, e le ascisse dei due capi
    // (0 e 300) sono lontanissime, quindi qui comanda la griglia.
    expect(nuovi).toContainEqual({ x: 160, y: 0 })
    expect(nuovi).toContainEqual({ x: 160, y: 100 })
    expect(nuovi.some((p) => p.x === 159.5)).toBe(false)
  })

  // Il secondo magnete. Senza, nessun punto della griglia potrebbe raccordare un tubo che
  // arriva a un'ascissa fuori griglia, ed è la situazione normale finché le ancore dei
  // simboli stanno dove stanno.
  it('preferisce l’ascissa di un capo quando è più vicina del punto di griglia', () => {
    const pDa = { x: 0, y: 0 }
    const pA = { x: 234, y: 100 }
    // Rotta standard: il montante verticale sta a metà strada, in x = 117.
    const full = polilineaConGomiti(pDa, [], pA)
    const nuovi = trascinaTratto(STILE_INDIFFERENTE, pDa, pA, undefined, QUOTE_INDIFFERENTE, 1, { x: 116, y: 0 })

    // 117 + 116 = 233. Il punto di griglia più vicino è 230, a distanza 3; l'ascissa del
    // capo di arrivo è 234, a distanza 1: vince il capo, e il montante finisce esattamente
    // sotto il bocchello invece che tre unità a sinistra.
    expect(nuovi.some((p) => p.x === 234)).toBe(true)
    expect(nuovi.some((p) => p.x === 230)).toBe(false)
    expect(full.length).toBeGreaterThan(0)
  })
```

> **Nota per chi implementa:** `QuoteInstradamento` è `{ yCollettore, yCorsiaCondense }` — verificato. La rotta `standard` è `rottaLinea`, che gira a metà strada, quindi con capi in x=0 e x=234 il montante nasce in x=117: **verificalo** eseguendo il test e leggendo il messaggio di fallimento, invece di darlo per buono. Se la forma non corrisponde, **adatta la fixture al codice vero e dichiaralo nel report** — mai il contrario.

- [ ] **Step 2: Vedere il rosso, e che sia GEOMETRICO**

```bash
npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts > /tmp/d2-task2-rosso.txt 2>&1; echo "exit=$?"; grep -A 6 "posa il tratto" /tmp/d2-task2-rosso.txt | head -20
```

Atteso: il primo test fallisce con **159,5 invece di 160** — un fallimento geometrico, non «funzione non definita». Se il messaggio non contiene quei numeri, la fixture non sta esercitando il caso: correggila prima di procedere.

- [ ] **Step 3: Correggere `trascinaTratto`**

Sostituire il blocco che calcola lo spostamento:

```ts
  const orizzontale = a.y === b.y
  const sposta = (p: Punto): Punto => (orizzontale ? { x: p.x, y: p.y + delta.y } : { x: p.x + delta.x, y: p.y })
  const nuovoA = sposta(a)
  const nuovoB = sposta(b)
```

con:

```ts
  const orizzontale = a.y === b.y
  // Si posa la quota ASSOLUTA agganciata, non si somma uno spostamento: sommare conserva
  // per sempre lo scarto di una partenza fuori griglia — misurato in pagina, un tratto a
  // x=726,5 trascinato di 50 finiva a 776,5. Le quote dei due capi entrano fra le posizioni
  // buone perché le ancore dei simboli sono ancora fuori griglia, e senza di loro un tubo
  // fra quote 260 e 234 non potrebbe mai essere raccordato dritto (agganciaQuota, griglia.ts).
  const quotaGrezza = orizzontale ? a.y + delta.y : a.x + delta.x
  const quotaNuova = agganciaQuota(quotaGrezza, orizzontale ? [pDa.y, pA.y] : [pDa.x, pA.x])
  const sposta = (p: Punto): Punto => (orizzontale ? { x: p.x, y: quotaNuova } : { x: quotaNuova, y: p.y })
  const nuovoA = sposta(a)
  const nuovoB = sposta(b)
```

Aggiungere l'import in testa al file:

```ts
import { agganciaQuota } from './griglia'
```

E aggiornare il docblock di `trascinaTratto`, che oggi dice «si sposta la sola coordinata condivisa dai due capi»: resta vero, ma va detto che ora la si **posa agganciata** invece di traslarla.

- [ ] **Step 4: Verde e suite dei servizi**

```bash
npx vitest run src/services/schemaImpianto > /tmp/d2-task2-verde.txt 2>&1; echo "exit=$?"; tail -12 /tmp/d2-task2-verde.txt
npx tsc --noEmit > /tmp/d2-task2-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d2-task2-tsc.txt
```

Atteso: tutto verde. **Se un test preesistente di `trascinaTratto` cade, fermati e riferisci**: potrebbe essere una fixture che cristallizzava il comportamento vecchio (legittima da aggiornare, con la ragione scritta) oppure un difetto vero della correzione. Non aggiornare una fixture senza dire perché.

- [ ] **Step 5: Provare che i test nuovi discriminano**

| # | Mutazione | Deve cadere |
|---|---|---|
| 1 | `agganciaQuota(quotaGrezza, …)` → `quotaGrezza` (nessun aggancio) | «posa il tratto sulla griglia anche partendo da una quota fuori griglia» |
| 2 | Passare `[]` come quote preferite | il test del secondo magnete, se la fixture lo esercita davvero |

Se la mutazione 2 **non** fa cadere nulla, dillo: significa che la fixture del secondo magnete non esercita il ramo, e va rifatta perché lo eserciti.

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/tratti.ts src/services/schemaImpianto/__tests__/tratti.test.ts
git commit -m "fix(schema): il tratto trascinato si posa sulla griglia invece di scivolare

Sommava uno spostamento a una quota di partenza fuori griglia, e lo scarto
sopravviveva per sempre: misurato in pagina, un tratto a x=726,5 trascinato
di 50 finiva a 776,5.

Ora posa la quota assoluta agganciata, con le quote dei due capi del tubo fra
le posizioni buone: senza quelle, un tubo fra quota 260 e quota 234 non
potrebbe essere raccordato dritto da alcun punto della griglia."
```

---

### Task 3: L'annotazione si posa sulla griglia

**Files:**
- Modify: `src/components/schemaImpianto/useTestiLiberi.ts` (`testiConSpostamento`)
- Test: `src/components/schemaImpianto/__tests__/useTestiLiberi.test.ts` (esistente)

**Interfaces:**
- Consumes: `allineaAllaGriglia` da `@/services/schemaImpianto/griglia` (Task 1)
- Produces: `testiConSpostamento` con la stessa firma

**Contesto per chi implementa.** Stesso difetto del tratto, stessa forma: **misurato, 573,75 finisce a 513,75**. La posizione arriva già calcolata dal componente; qui la si allinea prima di scriverla nello stato. Niente quote preferite: un'annotazione non deve restare allineata a nulla.

- [ ] **Step 1: Scrivere il test che fallisce**

Aggiungere in `src/components/schemaImpianto/__tests__/useTestiLiberi.test.ts`:

```ts
  // Il difetto misurato in pagina: la posizione si spostava di un multiplo di 10 ma
  // conservava per sempre lo scarto di partenza (573,75 → 513,75).
  it('posa l’annotazione sulla griglia anche partendo da una posizione fuori griglia', () => {
    const testi = [{ id: 'T1', x: 40, y: 573.75, contenuto: 'nota' }]
    expect(testiConSpostamento(testi, 'T1', { x: 150, y: 513.75 })).toEqual([
      { id: 'T1', x: 150, y: 510, contenuto: 'nota' },
    ])
  })
```

- [ ] **Step 2: Vedere il rosso**

```bash
npx vitest run src/components/schemaImpianto/__tests__/useTestiLiberi.test.ts > /tmp/d2-task3-rosso.txt 2>&1; echo "exit=$?"; grep -A 8 "posa l" /tmp/d2-task3-rosso.txt | head -20
```

Atteso: fallimento con **513,75 invece di 510**.

- [ ] **Step 3: Allineare la posizione**

In `useTestiLiberi.ts`, sostituire:

```ts
export function testiConSpostamento(
  testi: SchemaTestoLibero[],
  id: string,
  posizione: { x: number; y: number }
): SchemaTestoLibero[] {
  return testi.map((t) => (t.id === id ? { ...t, x: posizione.x, y: posizione.y } : t))
}
```

con:

```ts
/**
 * L'annotazione si posa sui punti della griglia. Si allinea qui e non nel componente perché
 * qui i test la raggiungono, e si allinea la posizione ASSOLUTA e non lo spostamento: il
 * componente calcola la posizione sommando uno spostamento già quantizzato a una posizione di
 * partenza che quantizzata non è, quindi lo scarto sopravviverebbe a ogni trascinamento —
 * misurato in pagina, un'annotazione a y=573,75 spostata di 60 finiva a 513,75.
 *
 * Nessuna quota preferita, a differenza del tratto (`agganciaQuota`, griglia.ts):
 * un'annotazione non deve restare allineata a nulla, va dove il committente la mette.
 */
export function testiConSpostamento(
  testi: SchemaTestoLibero[],
  id: string,
  posizione: { x: number; y: number }
): SchemaTestoLibero[] {
  return testi.map((t) =>
    t.id === id ? { ...t, x: allineaAllaGriglia(posizione.x), y: allineaAllaGriglia(posizione.y) } : t
  )
}
```

Aggiungere l'import:

```ts
import { allineaAllaGriglia } from '@/services/schemaImpianto/griglia'
```

- [ ] **Step 4: Verde e mutazione**

```bash
npx vitest run src/components/schemaImpianto > /tmp/d2-task3-verde.txt 2>&1; echo "exit=$?"; tail -10 /tmp/d2-task3-verde.txt
```

Mutazione obbligatoria: allineare **solo la x** e lasciare la y grezza. Deve far cadere il test nuovo. Redirigi su file, poi ripristina.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/useTestiLiberi.ts src/components/schemaImpianto/__tests__/useTestiLiberi.test.ts
git commit -m "fix(schema): l'annotazione trascinata si posa sulla griglia

Stesso difetto del tratto: si spostava di un multiplo di 10 ma conservava lo
scarto di partenza. Misurato, y=573,75 spostata di 60 finiva a 513,75.

Nessuna quota preferita, a differenza del tratto: un'annotazione non deve
restare allineata a nulla."
```

---

### Task 4: Frecce da tastiera, nodi e annotazioni nuovi

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (`PASSI`, `sposta`, e le due posizioni di nascita)

**Interfaces:**
- Consumes: `allineaAllaGriglia`, `PASSO_GRIGLIA` da `@/services/schemaImpianto/griglia` (Task 1)
- Produces: nulla

**Contesto per chi implementa.** Tre punti, tutti misurati:
- le frecce spostano di **1**, con Shift di **10**;
- un nodo nuovo dalla palette atterra a **y = 585**;
- un'annotazione nuova nasce a **y = 573,75**.

Le ultime due nascono da `piedeDelDisegno()`, che somma altezze tipografiche arrotondate.

Il committente ha chiesto che il piazzamento sia consentito **solo** sui punti della griglia: le frecce passano quindi a **10**, con Shift a **50**, e la posizione risultante va allineata — perché un nodo che partisse fuori griglia resterebbe fuori griglia a ogni passo, esattamente come il tratto.

- [ ] **Step 1: Correggere il commento di `PASSI`, che afferma il falso**

Il commento dice oggi:

```tsx
/** Spostamento per una pressione di freccia, in pixel di griglia: coerente con `snapGrid`. */
```

**È falso**, e lo è già adesso: i valori di `PASSI` sono `±1`, cioè un decimo del passo di `snapGrid`. Sostituiscilo con qualcosa di vero dopo la modifica, per esempio:

```tsx
/**
 * Direzione di una pressione di freccia: la lunghezza la mette `fattore` qui sotto, un passo
 * di griglia intero (cinque con Shift). Non si scende sotto la griglia: il committente ha
 * chiesto che il piazzamento sia consentito solo sui suoi punti, e un passo da un'unità era
 * il modo più rapido per uscirne senza accorgersene.
 */
```

- [ ] **Step 2: Portare le frecce a passo di griglia**

Sostituire, nel gestore dei tasti:

```tsx
        const fattore = e.shiftKey ? 10 : 1
```

con:

```tsx
        const fattore = e.shiftKey ? PASSO_GRIGLIA * 5 : PASSO_GRIGLIA
```

- [ ] **Step 3: Allineare la posizione risultante, non lo spostamento**

Dentro `sposta`, sostituire:

```tsx
          // Le coordinate vivono solo in position.
          const x = n.position.x + dx
          const y = n.position.y + dy
          return { ...n, position: { x, y } }
```

con:

```tsx
          // Le coordinate vivono solo in position. Si allinea la posizione RISULTANTE e non
          // lo spostamento: un'apparecchiatura che partisse fuori griglia — l'auto-layout ne
          // produce, E1 e F1 nascono a y=185 — ci resterebbe a ogni passo, sommando multipli
          // di 10 a uno scarto che non se ne va. È lo stesso difetto del tratto trascinato.
          const x = allineaAllaGriglia(n.position.x + dx)
          const y = allineaAllaGriglia(n.position.y + dy)
          return { ...n, position: { x, y } }
```

Aggiungere in testa al file:

```tsx
import { PASSO_GRIGLIA, allineaAllaGriglia } from '@/services/schemaImpianto/griglia'
```

- [ ] **Step 4: Far nascere nodi e annotazioni sulla griglia**

Ci sono **due** posizioni di nascita, entrambe della forma `{ x: 40, y: piedeDelDisegno(...) + 40 }`: una per il nodo aggiunto dalla palette, una per l'annotazione nuova. `piedeDelDisegno` somma altezze che comprendono quella tipografica del terminale utenze, arrotondata per eccesso, quindi produce quote arbitrarie — **misurato: y=585 per il nodo, y=573,75 per l'annotazione**.

Allinea la coordinata risultante in entrambe con `allineaAllaGriglia`. Non toccare `piedeDelDisegno`: quella calcola dove finisce il disegno, ed è giusta com'è.

- [ ] **Step 3: Verificare in compilazione**

```bash
npx tsc --noEmit > /tmp/d2-task4-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d2-task4-tsc.txt
npx vitest run src/components/schemaImpianto > /tmp/d2-task4-vitest.txt 2>&1; echo "vitest exit=$?"; tail -8 /tmp/d2-task4-vitest.txt
```

Nessun test automatico nuovo: è un componente React, e `CLAUDE.md` esclude i test di interfaccia. La verifica è in pagina, nel Task 7.

- [ ] **Step 4: Commit**

```bash
git add src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "fix(schema): frecce a passo di griglia, nodi e annotazioni allineati alla nascita

Le frecce spostavano di 1 unita' (10 con Shift), quindi il modo piu' rapido
per uscire dalla griglia senza accorgersene; ora 10 e 50, con la posizione
risultante allineata e non solo lo spostamento.

Nodi e annotazioni nuovi nascevano dove li metteva piedeDelDisegno, che somma
altezze tipografiche: misurato, y=585 e y=573,75."
```

---

### Task 5: Il pattern comune dei gesti, e l'annullamento del puntatore

**Files:**
- Create: `src/components/schemaImpianto/useGestoPuntatore.ts`
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` (i gesti del gomito, del segno e del tratto)

**Interfaces:**
- Consumes: nulla
- Produces: `useGestoPuntatore(...)` — la forma esatta la decide chi implementa, dopo aver letto i quattro gesti

**Contesto per chi implementa.** È il debito che la revisione finale del Blocco C2 ha lasciato scritto, con una raccomandazione vincolante: **chiuderlo tutto insieme, estraendo prima il pattern comune**, perché correggerlo in tre punti sparsi senza test di interfaccia rischierebbe più di quanto renda.

Il difetto: manca `onPointerCancel` nei gesti più vecchi. Quando il sistema revoca il puntatore — una gesture del sistema operativo, un tocco che diventa scorrimento — la cattura resta alzata e **il trascinamento successivo diventa invisibile a Ctrl+Z**, perché il riferimento «primo evento del gesto» non viene mai riarmato.

**Prima di scrivere codice, conta i gesti e dillo nel report.** Le fonti si contraddicono: il ledger del C2 dice tre gesti scoperti, quello del D1 dice quattro. I due gesti nati nel D1 (divisorio e maniglia) ce l'hanno già, e le annotazioni pure. Vai a vedere e riporta l'elenco vero.

Il modello da seguire è quello già collaudato sulle annotazioni: l'annullamento chiude il gesto **come il rilascio**, rilasciando la cattura solo se presente e consegnando **l'ultima posizione vista durante il gesto** — non quella dell'evento di annullamento, che non è un movimento e porterebbe coordinate qualsiasi.

Nel pattern comune entrano anche le due cose che oggi sono in quattro copie: la guardia «si è mosso davvero» e il riferimento «primo evento del gesto».

- [ ] **Step 1: Leggere i quattro gesti e riferire che cosa hanno in comune**

Leggi `SchemaEdgeTubazione.tsx` (gomito, segno, area di trascinamento del tratto), `DivisorioAnteprima.tsx` e `ManigliaRidimensiona.tsx`. **Scrivi nel report** la tabella: per ogni gesto, se ha `onPointerCancel`, se ha la guardia «si è mosso», dove tiene il riferimento del primo evento. È il presupposto dell'estrazione: senza, si estrae un pattern che non combacia.

- [ ] **Step 2: Estrarre il pattern comune**

Scrivi `useGestoPuntatore.ts` sulla forma che i gesti hanno davvero, non su quella che ti aspettavi. Vincoli:
- rilascio e annullamento chiudono allo stesso modo;
- l'annullamento consegna l'**ultima posizione vista**, non quella del proprio evento;
- il riferimento del primo evento si **riarma a fine gesto**, altrimenti il secondo trascinamento non entra più in cronologia.

- [ ] **Step 3: Adottarlo nei gesti scoperti**

Uno alla volta, verificando la compilazione dopo ognuno.

- [ ] **Step 4: Verificare**

```bash
npx tsc --noEmit > /tmp/d2-task5-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d2-task5-tsc.txt
npx vitest run src/components/schemaImpianto > /tmp/d2-task5-vitest.txt 2>&1; echo "vitest exit=$?"; tail -8 /tmp/d2-task5-vitest.txt
```

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/useGestoPuntatore.ts src/components/schemaImpianto/SchemaEdgeTubazione.tsx
git commit -m "refactor(schema): un solo pattern per i gesti del puntatore, con l'annullamento

Chiude il debito che la revisione finale del Blocco C2 aveva lasciato: senza
onPointerCancel, un trascinamento revocato dal sistema lasciava alzata la
cattura e rendeva il trascinamento successivo invisibile a Ctrl+Z.

Estratto prima il pattern comune, come raccomandato: la guardia \"si e' mosso
davvero\" e il riferimento del primo evento erano in quattro copie."
```

---

### Task 6: Un trascinamento a vuoto restituisce il tubo all'instradamento automatico

**Files:**
- Modify: `src/components/schemaImpianto/useTrascinamentoTratto.ts`

**Interfaces:**
- Consumes: quanto sopra
- Produces: nulla

**Contesto per chi implementa.** È la domanda aperta #1 del Blocco C1, decisa dal committente e registrata nella spec. Il primo evento di un trascinamento ha spostamento zero, quindi `trascinaTratto` materializza **l'intera rotta automatica in gomiti a mano** prima ancora che il tubo si muova; da quell'istante l'arco non segue più il riassestamento delle quote quando si spostano le apparecchiature. Decisione: **un trascinamento che finisce dov'è cominciato restituisce il tubo all'instradamento automatico**, cioè lascia `punti` vuoto.

Attenzione a non confondere «finisce dov'è cominciato» con «non si è mosso»: il gesto può muoversi e tornare indietro, e va trattato come un gesto a vuoto.

- [ ] **Step 1: Riconoscere il gesto a vuoto**

Nell'hook, tieni la posizione del primo evento del gesto. All'evento conclusivo, se la posizione finale coincide con quella iniziale, scrivi `punti: []` — l'arco torna alla rotta nativa — invece del risultato di `trascinaTratto`.

> Nota: con l'aggancio del Task 2 «coincide» va inteso **dopo l'allineamento**, perché due posizioni diverse di pochi pixel producono ora la stessa quota. Decidi la forma e spiegala nel commento.

- [ ] **Step 2: Verificare**

```bash
npx tsc --noEmit > /tmp/d2-task6-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d2-task6-tsc.txt
npx vitest run src/components/schemaImpianto > /tmp/d2-task6-vitest.txt 2>&1; echo "vitest exit=$?"; tail -8 /tmp/d2-task6-vitest.txt
```

- [ ] **Step 3: Commit**

```bash
git add src/components/schemaImpianto/useTrascinamentoTratto.ts
git commit -m "feat(schema): un trascinamento a vuoto ridà il tubo all'instradamento automatico

Il primo evento del gesto ha spostamento zero, quindi materializzava l'intera
rotta automatica in gomiti a mano prima ancora che il tubo si muovesse, e da
li' l'arco non seguiva piu' il riassestamento delle quote.

Decisione del committente, registrata nella specifica del Blocco D."
```

---

### Task 7: Suite, invarianza del documento e verifica in pagina

Lo esegue **il controller**.

- [ ] **Step 1: Suite intera, una sola esecuzione**

```bash
npx vitest run > /tmp/d2-finale-vitest.txt 2>&1; echo "exit=$?"; tail -6 /tmp/d2-finale-vitest.txt
npx tsc --noEmit > /tmp/d2-finale-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d2-finale-tsc.txt
```

- [ ] **Step 2: PROVARE che il documento consegnato non è cambiato**

Questo blocco tocca `tratti.ts`, che **il documento usa**: qui non basta guardare il diff dei file, come nel D1.

Rendere l'SVG di più impianti prima e dopo il blocco e confrontare le stringhe. Il documento **non deve cambiare di un byte**: `trascinaTratto` è usata solo dal gesto dell'editor, e nessun percorso del render la invoca — ma va **dimostrato**, non asserito. Prima di fidarsi del banco, **provare che discrimina**: una modifica finta a `renderSvg` deve far arrossare tutti i casi.

- [ ] **Step 3: Verifica in pagina**

Pratica `c6f56ca5-d57b-408c-a4e5-69a207812b0d` → «Genera relazione» → «Rifinisci schema». **Mai premere «Genera comunque .docx»**; chiudere con «Annulla modifiche» + «Annulla»; verificare in banca dati prima e dopo. Attenzione ai **dialoghi impilati**: identificarli per titolo, non con `querySelector` sul primo. E `[role="separator"]` prende anche i `Divider` della barra strumenti.

Da rimisurare, uno per uno, con gli stessi gesti che hanno prodotto i numeri di partenza:

1. **Il tratto**: afferrare il verticale a x=726,5 di `std-3` e trascinarlo. Atteso: una quota **multipla di 10**, non 776,5.
2. **Il magnete**: trascinare un tratto fin quasi alla quota di un capo. Atteso: ci si posa esattamente sopra, e la linea diventa **dritta**.
3. **L'annotazione**: crearne una e trascinarla. Atteso: posizione multipla di 10, e **nascita** su griglia.
4. **Le frecce**: selezionare un'apparecchiatura e premere una freccia. Atteso: passo 10; con Shift 50.
5. **Il nodo nuovo**: aggiungerne uno dalla palette. Atteso: y multipla di 10.
6. **Il gesto a vuoto**: afferrare un tratto, muoverlo e riportarlo dov'era. Atteso: l'arco torna alla rotta automatica, e spostando un'apparecchiatura si riassesta.
7. **Nulla di rotto**: gomiti, segni sul tubo e Ctrl+Z continuano a funzionare.

- [ ] **Step 4: Ledger e resoconto al committente**

---

## Cosa questo piano NON fa

- **Non porta le ancore dei simboli sulla griglia**: lo farà il committente rifacendo la libreria. Il secondo magnete è ciò che rende il disegno corretto nel frattempo.
- **Non aggancia l'instradamento automatico**: il committente ha scelto di lasciarlo com'è, perché arrotondarlo cambierebbe il disegno di ogni pratica.
- **Non tocca TEE, valvole e muro**: sono i blocchi D3 e D4.
- **Non integra su `main`.**
