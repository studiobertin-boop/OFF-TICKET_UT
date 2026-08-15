# Schema d'impianto DM329 — il tubo imbocca il TEE dritto

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Far sì che una tubazione collegata a un TEE lo **imbocchi lungo il lato dell'ancora scelta** invece di girare a metà strada, così che la forma a T si formi davvero.

**Architecture:** Il difetto non è nelle coordinate — misurato in pagina: il capo del tubo cade **esattamente** sul centro del pallino, a ogni zoom, su tutti e quattro i lati, in tela e nel documento. È nella **rotta**: `rottaLinea` gira all'ascissa mediana fra i due capi, quindi il montante finisce di lato (misurato: 55 unità) e l'ultimo tratto corre **sovrapposto** al tubo che attraversa il TEE, alla stessa quota. La correzione è dare a `instrada` la nozione di **lato imposto** — da che parte una tubazione deve imboccare un capo — e usarla per costruire una rotta ortogonale con l'asse forzato a quel capo, invece della rotta nativa dello stile. Il pezzo che serve **esiste già**: il Blocco D3 ha reso esplicito il `lato` di ogni ancora della giunzione.

**Tech Stack:** TypeScript (strict:false) + Vitest. Geometria pura in `src/services/schemaImpianto/`, consumata sia dal documento (`renderSvg.ts`) sia dalla tela (`conversioneFlow.ts`).

**Spec:** `docs/superpowers/specs/2026-08-14-schema-impianto-blocco-d-design.md`, sezione «Blocco D3 — il TEE». La frase che questo piano rende vera: «la forma a T (o a croce, o a gomito) la disegnano ora le tubazioni che ci arrivano davvero».

## Global Constraints

- **NESSUN merge e nessun push.** Solo commit locali sul ramo `worktree-schema-impianto-dm329`.
- **Il documento cambia**, per le sole pratiche che hanno un TEE con una tubazione **senza gomiti a mano**. Va **dimostrato, non asserito** (Task 3), con la stessa disciplina del blocco precedente: prima si legge la differenza, poi la si accetta.
- **Tela e documento devono disegnare la STESSA linea.** È l'invariante su cui questo modulo ha già pagato due volte, ed è guardata da `__tests__/instradamentoCondiviso.test.ts` — che oggi **non contiene giunzioni** e va esteso, altrimenti la strada nuova non è coperta dall'accordo.
- **`posizioneAncora` non si tocca**: resta la fonte unica su dove sta un capo di tubo.
- **Ogni test nuovo va visto fallire per MUTAZIONE**, su un'implementazione plausibilmente sbagliata. **Il ripristino si fa da una copia (`cp`), mai con `git checkout`.**
- **Le prove si producono con una redirezione su file, mai trascrivendo.**
- **Ogni commento descrive il repo com'è a fine task** e non afferma più di ciò che è vero senza condizioni: nel blocco precedente sono stati corretti **undici** enunciati falsi, quasi tutti nati nei brief. **Accorciare invece di precisare.**
- **NON eseguire `prettier --write`.** **Localizzare per contenuto, mai per numero di riga.**
- Baseline: testa **`29c245d`**, albero pulito, **1016 test su 83 file verdi**, `tsc --noEmit` pulito.

---

## I fatti misurati che questo piano usa

Misurati in pagina il 15-08-2026 sulla pratica `c6f56ca5`, leggendo il DOM. **Non sono ipotesi.**

| Fatto | Misura |
|---|---|
| Il capo del tubo cade sul centro del pallino | scarto **zero** su entrambi gli assi, a zoom 0,42× e 2,0×, su tutti e quattro i lati, sia per un TEE da spezzamento sia per uno collegato a mano, **e nell'anteprima** |
| La rotta gira a metà strada | `M 272 182 L 327 182 L 327 405 L 382 405` — montante a **x=327**, pallino a **x=382**: **55** unità di lato, metà dei 110 fra i capi |
| L'ultimo tratto è nascosto | orizzontale, lungo 55, a **y=405** — la stessa quota del tubo che attraversa il TEE, quindi sovrapposto |
| Il pallino cade fuori griglia | (382, 405): `mod 10` = 2 e 5, mentre i simboli da auto-layout sono multipli esatti di 10 |
| Le due metà di un tubo spezzato **non** sono toccate | nascono con gomiti espliciti (`fissaLaForma`), e `instrada` con gomiti non vuoti ignora ogni rotta nativa |

**Chi è colpito**: le tubazioni collegate a un TEE **senza gomiti a mano** — cioè i rami tracciati a mano, che è esattamente il caso dello screenshot. Le metà di un tubo spezzato restano com'erano.

---

## Struttura dei file

| File | Responsabilità | Task |
|---|---|---|
| `src/services/schemaImpianto/symbols/index.ts` | **Nuova** `latoImposto(nodo, ancoraId)`: il lato da cui una tubazione deve imboccare quel capo, o `undefined`. Fonte unica, letta da entrambi i disegnatori. | 1 |
| `src/services/schemaImpianto/tratti.ts` | `instrada` accetta i lati imposti e costruisce la rotta con l'asse forzato ai capi che lo impongono. | 1 |
| `src/services/schemaImpianto/__tests__/tratti.test.ts` | Prove della rotta forzata. | 1 |
| `src/components/schemaImpianto/conversioneFlow.ts` | `CapiArco` porta i lati; `capiDegliArchi` li risolve; `polilineaDellArco` li inoltra. | 2 |
| `src/services/schemaImpianto/renderSvg.ts` | Le tre `render*` risolvono i lati e li inoltrano a `instrada`. | 2 |
| `src/components/schemaImpianto/__tests__/instradamentoCondiviso.test.ts` | L'accordo tela/documento esteso a un impianto **con giunzione**. | 2 |
| `src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts` | Ri-basato, se la differenza letta è quella attesa. | 3 |

---

### Task 1: Il lato imposto e la rotta che lo rispetta

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (nuova `latoImposto`)
- Modify: `src/services/schemaImpianto/tratti.ts` (`instrada`, nuova `rottaImboccata`)
- Test: `src/services/schemaImpianto/__tests__/tratti.test.ts` (esistente)

**Interfaces:**
- Consumes: `SchemaLatoAncora`, `ancoraDi` (già in casa dal Blocco D3)
- Produces:
  - `function latoImposto(nodo: SchemaNodo, ancoraId: string): SchemaLatoAncora | undefined` (symbols/index.ts)
  - `interface LatiImposti { da?: SchemaLatoAncora; a?: SchemaLatoAncora }` (tratti.ts)
  - `instrada(stile, pDa, pA, gomiti, quote, lati?: LatiImposti)` — stessa firma più un parametro finale opzionale

**Contesto per chi implementa.** Due nozioni, tenute separate di proposito:

1. **Chi impone un lato.** Solo la **giunzione**: è l'unico simbolo le cui quattro ancore coincidono, e l'unico per cui la forma del disegno (la T) dipende da quale lato si è scelto. `latoImposto` restituisce `undefined` per ogni altro tipo, **anche se un giorno dichiarasse un `lato`** — la condizione è sul tipo, non sulla presenza del campo, così la regola non si allarga in silenzio ad altri simboli cambiando il registro.

2. **Che cosa vuol dire imboccare da un lato.** `alto`/`basso` → l'ultimo (o il primo) segmento è **verticale**; `sx`/`dx` → è **orizzontale**. Non conta il verso, solo l'asse: il verso lo decide da sé la posizione dell'altro capo.

Quando almeno un capo impone un lato, **la rotta nativa dello stile non si usa**. Non è una perdita: un arco che tocca una giunzione è un ramo tracciato a mano, mentre le rotte native (il collettore del flessibile, la corsia delle condense) servono agli archi dell'auto-layout fra apparecchiature. E i **gomiti a mano continuano a vincere su tutto**, come già oggi: le due metà di un tubo spezzato non sono toccate da questo task.

- [ ] **Step 1: Scrivere i test che falliscono**

Aggiungere in `src/services/schemaImpianto/__tests__/tratti.test.ts`, in un `describe` nuovo. Leggi prima il file e riusa le sue costanti (`QUOTE_INDIFFERENTE` e simili) invece di inventarne di parallele; se i nomi non corrispondono, **adatta al file vero e dichiaralo nel report**.

```ts
describe('instrada con un lato imposto', () => {
  const QUOTE = { yCollettore: 0, yCorsiaCondense: 500 }

  // Il caso misurato in pagina: un ramo che scende su un TEE posato su un tubo
  // orizzontale. Senza il lato imposto la rotta gira a metà strada (x mediana 327) e
  // l'ultimo tratto corre sovrapposto al tubo passante; con il lato imposto il ramo
  // scende dritto nella giunzione e la T si forma.
  it('un capo che impone il lato alto viene imboccato in verticale', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { a: 'alto' })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 382, y: 182 },
      { x: 382, y: 405 },
    ])
  })

  it('un capo che impone un lato laterale viene imboccato in orizzontale', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { a: 'sx' })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 272, y: 405 },
      { x: 382, y: 405 },
    ])
  })

  // Il lato imposto sul capo di PARTENZA vincola il primo segmento, non l'ultimo.
  it('un lato imposto in partenza vincola il primo segmento', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { da: 'basso' })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 272, y: 405 },
      { x: 382, y: 405 },
    ])
  })

  // Due giunzioni sullo stesso tubo: entrambi i vincoli vanno rispettati. Assi diversi
  // bastano a una spezzata a un angolo solo.
  it('due lati imposti su assi diversi danno un angolo solo', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { da: 'basso', a: 'sx' })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 272, y: 405 },
      { x: 382, y: 405 },
    ])
  })

  // Assi uguali: servono due angoli, e la piega sta a metà fra i due capi sull'asse
  // imposto — la scelta simmetrica, l'unica che non privilegia un capo sull'altro.
  it('due lati imposti sullo stesso asse danno una piega a metà', () => {
    const punti = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { da: 'basso', a: 'alto' })
    expect(punti).toEqual([
      { x: 272, y: 182 },
      { x: 272, y: 293.5 },
      { x: 382, y: 293.5 },
      { x: 382, y: 405 },
    ])
  })

  // Capi già allineati sull'asse imposto: nessun vertice intermedio, una linea dritta.
  it('capi già allineati non producono vertici inutili', () => {
    const punti = instrada('standard', { x: 382, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { a: 'alto' })
    expect(punti).toEqual([
      { x: 382, y: 182 },
      { x: 382, y: 405 },
    ])
  })

  // I gomiti a mano vincono su tutto, lato imposto compreso: è la regola di sempre, ed
  // è ciò che lascia intatte le due metà di un tubo spezzato, che nascono con gomiti.
  it('i gomiti a mano vincono anche sul lato imposto', () => {
    const gomiti = [{ x: 300, y: 300 }]
    const conLato = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, gomiti, QUOTE, { a: 'alto' })
    const senzaLato = instrada('standard', { x: 272, y: 182 }, { x: 382, y: 405 }, gomiti, QUOTE)
    expect(conLato).toEqual(senzaLato)
  })

  // Senza lati imposti nulla cambia: è ciò che tiene invariato il disegno di ogni
  // pratica che un TEE non ce l'ha.
  it('senza lati imposti la rotta resta quella dello stile', () => {
    const conOggettoVuoto = instrada('standard', { x: 0, y: 0 }, { x: 300, y: 100 }, undefined, QUOTE, {})
    const senzaParametro = instrada('standard', { x: 0, y: 0 }, { x: 300, y: 100 }, undefined, QUOTE)
    expect(conOggettoVuoto).toEqual(senzaParametro)
    expect(senzaParametro).toEqual(rottaLinea({ x: 0, y: 0 }, { x: 300, y: 100 }))
  })

  // Il lato imposto vince anche sugli stili con una rotta nativa lontana: un ramo
  // condense su una giunzione non deve passare dalla corsia comune.
  it('vale anche per gli stili con rotta nativa propria', () => {
    const punti = instrada('condensa', { x: 272, y: 182 }, { x: 382, y: 405 }, undefined, QUOTE, { a: 'alto' })
    expect(punti.some((p) => p.y === QUOTE.yCorsiaCondense)).toBe(false)
    expect(punti[punti.length - 1]).toEqual({ x: 382, y: 405 })
  })
})
```

> **Nota per chi implementa:** i primi due casi vengono dai numeri veri misurati in pagina (montante a 327 contro pallino a 382). Il caso «piega a metà» produce `293.5`, cioè `(182 + 405) / 2`: se il tuo codice arrotonda, **il test cade** — non arrotondare, la geometria di questo modulo lavora in numeri pieni e l'arrotondamento è resa grafica (`ondula` ha il suo).

- [ ] **Step 2: Vedere il rosso, e che sia GEOMETRICO**

```bash
npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts > /tmp/tee-task1-rosso.txt 2>&1; echo "exit=$?"; grep -A 8 "lato imposto" /tmp/tee-task1-rosso.txt | head -40
```

Atteso: fallimenti con **numeri** — la rotta a metà strada invece di quella imboccata. Un rosso da «parametro inatteso» significa che `instrada` non accetta ancora il parametro: è ammesso solo prima dello Step 4.

- [ ] **Step 3: `latoImposto` nel registro**

In `src/services/schemaImpianto/symbols/index.ts`, accanto ad `ancoraDi`:

```ts
/**
 * Il lato da cui una tubazione deve imboccare questo capo, quando il capo lo impone;
 * `undefined` quando la rotta è libera di arrivare come vuole.
 *
 * Lo impone la sola **giunzione**: è l'unico simbolo le cui quattro ancore coincidono — stanno
 * tutte al centro del pallino — quindi l'unico per cui il disegno non può dedurre da che parte
 * il tubo entra, ed è anche l'unico la cui forma (la T, o la croce, o il gomito) è disegnata
 * per intero dalle tubazioni che vi arrivano.
 *
 * La condizione è sul TIPO e non sulla presenza del campo `lato`: così la regola non si allarga
 * in silenzio ad altri simboli il giorno che uno di loro dichiarasse un lato per ragioni sue.
 *
 * La leggono entrambi i disegnatori — il documento (`renderSvg.ts`) e la tela
 * (`capiDegliArchi`, conversioneFlow.ts) — perché disegnino la stessa linea.
 */
export function latoImposto(nodo: SchemaNodo, ancoraId: string): SchemaLatoAncora | undefined {
  if (nodo.tipo !== 'giunzione') return undefined
  return ancoraDi(nodo, ancoraId)?.lato
}
```

Aggiungere `SchemaLatoAncora` all'import dei tipi in testa al file, se non c'è già.

- [ ] **Step 4: La rotta imboccata, in `tratti.ts`**

Aggiungere l'import del tipo (`SchemaLatoAncora` da `./types`) e, sopra `instrada`:

```ts
/** Da che lato una tubazione deve imboccare i suoi due capi, quando quei capi lo impongono. */
export interface LatiImposti {
  da?: SchemaLatoAncora
  a?: SchemaLatoAncora
}

/** Asse lungo cui corre il segmento che imbocca un lato: non conta il verso, che lo decide
 *  da sé la posizione dell'altro capo. */
function verticale(lato: SchemaLatoAncora): boolean {
  return lato === 'alto' || lato === 'basso'
}

/**
 * Rotta che rispetta i lati imposti ai capi. Sostituisce la rotta nativa dello stile quando
 * almeno un capo impone un lato — cioè quando un capo è una giunzione (`latoImposto`,
 * symbols/index.ts).
 *
 * Non è una perdita rispetto alle rotte native: un arco che tocca una giunzione è un ramo
 * tracciato a mano, mentre il collettore del flessibile e la corsia delle condense servono agli
 * archi dell'auto-layout fra apparecchiature. Ed è ciò che fa formare la T: senza, la spezzata
 * gira a metà strada e l'ultimo tratto corre sovrapposto al tubo che attraversa la giunzione —
 * misurato in pagina, montante a 55 unità di lato dal pallino.
 */
function rottaImboccata(pDa: Punto, pA: Punto, lati: LatiImposti): Punto[] {
  const vDa = lati.da ? verticale(lati.da) : undefined
  const vA = lati.a ? verticale(lati.a) : undefined

  // Un capo solo impone: basta un angolo, posato in modo che il segmento imboccante corra
  // sull'asse richiesto.
  if (vDa === undefined) return dedup([pDa, vA ? { x: pA.x, y: pDa.y } : { x: pDa.x, y: pA.y }, pA])
  if (vA === undefined) return dedup([pDa, vDa ? { x: pDa.x, y: pA.y } : { x: pA.x, y: pDa.y }, pA])

  // Due capi su assi diversi: un angolo solo li soddisfa entrambi.
  if (vDa !== vA) return dedup([pDa, vDa ? { x: pDa.x, y: pA.y } : { x: pA.x, y: pDa.y }, pA])

  // Due capi sullo stesso asse: servono due angoli, e la piega sta a metà — la scelta
  // simmetrica, l'unica che non privilegia un capo sull'altro.
  if (vDa) {
    const yMedia = (pDa.y + pA.y) / 2
    return dedup([pDa, { x: pDa.x, y: yMedia }, { x: pA.x, y: yMedia }, pA])
  }
  const xMedia = (pDa.x + pA.x) / 2
  return dedup([pDa, { x: xMedia, y: pDa.y }, { x: xMedia, y: pA.y }, pA])
}

/** Toglie i vertici coincidenti col precedente: capi già allineati sull'asse imposto non
 *  devono produrre un angolo che non esiste. */
function dedup(punti: Punto[]): Punto[] {
  return punti.filter((p, i, arr) => i === 0 || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y)
}
```

E in `instrada`, dopo la riga dei gomiti a mano e **prima** delle rotte native:

```ts
export function instrada(
  stile: SchemaArcoStile,
  pDa: Punto,
  pA: Punto,
  gomiti: Punto[] | undefined,
  quote: QuoteInstradamento,
  lati?: LatiImposti
): Punto[] {
  if (gomiti && gomiti.length > 0) return polilineaConGomiti(pDa, gomiti, pA)
  // I lati imposti vengono prima delle rotte native dello stile: vedi `rottaImboccata`.
  if (lati && (lati.da || lati.a)) return rottaImboccata(pDa, pA, lati)
  if (stile === 'flessibile') return rottaFlessibile(pDa, pA, quote.yCollettore)
  if (stile === 'condensa') return rottaCondensa(pDa, pA, quote.yCorsiaCondense)
  return rottaLinea(pDa, pA)
}
```

E aggiornare il docblock di `instrada`, che oggi dice «I gomiti imposti a mano vincono su ogni rotta nativa»: resta vero, e va detto che ora fra i due c'è un terzo caso.

- [ ] **Step 5: Verde e mutazioni**

```bash
npx vitest run src/services/schemaImpianto > /tmp/tee-task1-verde.txt 2>&1; echo "exit=$?"; tail -10 /tmp/tee-task1-verde.txt
npx tsc --noEmit > /tmp/tee-task1-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/tee-task1-tsc.txt
```

**Se un test preesistente di `instrada` o di `renderSvg` cade, fermati e riferisci**: senza lati imposti nulla deve cambiare, e questo task non ne passa ancora da nessun chiamante.

Copia integra prima di cominciare (`cp src/services/schemaImpianto/tratti.ts /tmp/tee-task1-integro.ts`), ripristino con `cp`.

| # | Mutazione | Deve cadere |
|---|---|---|
| 1 | In `instrada`, spostare il ramo dei lati **dopo** le rotte native | i primi tre casi, e «vale anche per gli stili con rotta nativa propria» |
| 2 | In `verticale`, restituire sempre `true` | «un capo che impone un lato laterale» |
| 3 | Nel ramo «assi diversi», usare l'angolo opposto | «due lati imposti su assi diversi» |
| 4 | Togliere `dedup` | «capi già allineati non producono vertici inutili» |
| 5 | Spostare il ramo dei lati **prima** dei gomiti a mano | «i gomiti a mano vincono anche sul lato imposto» |

A mutazioni finite, verifica che l'integro torni verde prima di committare.

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/tratti.ts src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/__tests__/tratti.test.ts
git commit -m "feat(schema): una tubazione imbocca il TEE dal lato dell'ancora scelta

La rotta girava a meta' strada fra i due capi, quindi il montante finiva di
lato — misurato in pagina, 55 unita' — e l'ultimo tratto correva sovrapposto
al tubo che attraversa la giunzione: la forma a T non si formava mai, che e'
invece il modo in cui la specifica vuole sia disegnata.

Il lato imposto lo dichiara la sola giunzione, ed e' l'unica che ne ha
bisogno: le sue quattro ancore coincidono, quindi il disegno non puo' dedurre
da che parte il tubo entra. I gomiti a mano continuano a vincere su tutto."
```

---

### Task 2: I due disegnatori passano i lati, e restano d'accordo

**Files:**
- Modify: `src/components/schemaImpianto/conversioneFlow.ts` (`CapiArco`, `capiDegliArchi`, `polilineaDellArco`)
- Modify: `src/services/schemaImpianto/renderSvg.ts` (le tre `render*`)
- Test: `src/components/schemaImpianto/__tests__/instradamentoCondiviso.test.ts` (esistente)

**Interfaces:**
- Consumes: `latoImposto`, `LatiImposti`, `instrada(..., lati?)` (Task 1)
- Produces: `CapiArco` con un campo `lati?: LatiImposti`

**Contesto per chi implementa.** Questo è il task in cui si rompe l'invariante più cara del modulo, se lo si sbaglia: **tela e documento devono disegnare la stessa linea**. Passano già dalla stessa `instrada` sugli stessi capi; ora devono passare anche gli **stessi lati**, e li devono risolvere con la **stessa** funzione (`latoImposto`), non ognuno a modo suo.

Il test dell'accordo esiste già — `__tests__/instradamentoCondiviso.test.ts` — ma il suo impianto **non contiene giunzioni**, quindi oggi non copre affatto la strada nuova. Estenderlo è la parte che conta di più di questo task.

- [ ] **Step 1: Estendere il test dell'accordo, e vederlo fallire**

Leggi il file: costruisce un layout, lo converte con `layoutAFlow`, fonde i dati con `fondiDatiArchi` e confronta la polilinea della tela con quella del documento. **Riusa la sua forma**; non inventarne una parallela.

Aggiungi al layout di prova una **giunzione** con almeno una tubazione che vi arriva **senza gomiti a mano**, dal lato `alto`, con l'altro capo **spostato lateralmente** — è la configurazione misurata in pagina, quella che senza il lato imposto gira a metà strada. Poi aggiungi il caso che prova l'accordo su quell'arco.

Prima di scrivere l'asserzione, **esegui e leggi**: se la polilinea della tela e quella del documento coincidono già (perché nessuno dei due passa ancora i lati), il test è verde e non prova nulla. Il modo di renderlo discriminante è confrontare la polilinea con quella **attesa** — imboccata — oltre che con l'altra. Dichiara nel report come l'hai reso discriminante.

- [ ] **Step 2: La tela**

In `conversioneFlow.ts`:

```ts
export interface CapiArco {
  da: Punto
  a: Punto
  /**
   * I lati da cui la tubazione deve imboccare i due capi, quando quei capi lo impongono
   * (`latoImposto`, symbols/index.ts). Viaggiano insieme ai capi e per la stessa ragione:
   * un arco non ha, né deve avere, una vista sui nodi — e il documento li risolve con la
   * stessa funzione, perché le due linee restino la stessa linea.
   */
  lati?: LatiImposti
}
```

In `capiDegliArchi`, accanto ai due `posizioneAncora` già presenti:

```ts
    capi.set(arco.id, {
      da: posizioneAncora(nodoDa, arco.da.ancora),
      a: posizioneAncora(nodoA, arco.a.ancora),
      lati: { da: latoImposto(nodoDa, arco.da.ancora), a: latoImposto(nodoA, arco.a.ancora) },
    })
```

E in `polilineaDellArco`, inoltrare `capi.lati` a `instrada`.

- [ ] **Step 3: Il documento**

In `renderSvg.ts`, in **tutte e tre** le `render*` (`renderMandataCompressore`, `renderMandataLinea`, `renderLineaCondense`) — hanno già `da`, `ancoraDa`, `a`, `ancoraA` — sostituire la chiamata:

```ts
  const punti = instrada(stile, pDa, pA, gomiti, quote)
```

con:

```ts
  const punti = instrada(stile, pDa, pA, gomiti, quote, {
    da: latoImposto(da, ancoraDa),
    a: latoImposto(a, ancoraA),
  })
```

Aggiungere `latoImposto` all'import da `./symbols`.

- [ ] **Step 4: Verde, compilazione, e l'accordo**

```bash
npx vitest run > /tmp/tee-task2-verde.txt 2>&1; echo "exit=$?"; tail -8 /tmp/tee-task2-verde.txt
npx tsc --noEmit > /tmp/tee-task2-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/tee-task2-tsc.txt
```

**Il test del riferimento SVG col TEE cadrà**: è atteso, ed è il Task 3 a leggerne la differenza e a decidere. **Non ri-basarlo qui** e non toccare la fixture. Riferisci quali test cadono e con quali numeri.

Il riferimento **senza** TEE deve invece restare verde: quell'impianto non ha giunzioni. Se cade, fermati e riferisci.

Mutazione obbligatoria: in `renderSvg`, passare `{}` invece dei lati risolti. Deve far cadere il test dell'accordo — se non lo fa, quel test non copre la giunzione e va rinforzato.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/conversioneFlow.ts src/services/schemaImpianto/renderSvg.ts src/components/schemaImpianto/__tests__/instradamentoCondiviso.test.ts
git commit -m "feat(schema): tela e documento risolvono insieme il lato di imbocco del TEE

Entrambi passavano gia' dalla stessa instrada sugli stessi capi; ora passano
anche gli stessi lati, risolti dalla stessa latoImposto e non ognuno a modo
proprio. L'accordo fra i due disegni e' esteso a un impianto con giunzione,
che il test non copriva affatto."
```

---

### Task 3: La differenza sul documento, letta e accettata

**Files:**
- Modify: `src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts`

**Contesto per chi implementa.** Il documento cambia, e va letto prima di essere accettato. Le differenze **attese** sono una sola classe: le polilinee delle tubazioni che toccano una giunzione **senza gomiti a mano**, che ora la imboccano invece di girare a metà strada. **Qualunque altra differenza è un difetto**: la tabella, la legenda, il muro, le dimensioni della pagina, i simboli e ogni tubazione che una giunzione non la tocca devono restare identici.

- [ ] **Step 1: Il riferimento senza TEE deve restare verde e intatto**

```bash
npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts > /tmp/tee-task3-riferimenti.txt 2>&1; echo "exit=$?"; grep -E "✓|×" /tmp/tee-task3-riferimenti.txt | tail -20
git diff --stat -- src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoSenzaTesti.ts
```

L'ultimo comando deve stampare **niente**. È la prova che le pratiche senza TEE non cambiano.

- [ ] **Step 2: Leggere la differenza sul riferimento col TEE**

Il test del riferimento col TEE cade: leggine il messaggio, e confronta atteso e ottenuto **un elemento per riga** (`sed 's/></>\n</g'`, come nel blocco precedente; e `--strip-trailing-cr` se confronti file estratti da git). Elenca **ogni riga cambiata** e assegnala alla classe attesa. Se una riga non vi rientra — un `<g>` di simbolo, una riga di tabella, il `viewBox` — **fermati e riferisci senza toccare la fixture**.

- [ ] **Step 3: Ri-basare, con la stessa disciplina dell'intestazione**

Se e solo se la differenza è quella attesa: rigenera le righe cambiate dal codice **nuovo**, tenendo la forma un elemento per riga, e aggiorna nell'intestazione la riga «Generato l'ultima volta dal commit …» col genitore di questo commit — è il precedente già in uso nel file. Il motivo va nel messaggio di commit, non ripetuto nell'intestazione.

- [ ] **Step 4: Suite intera e commit**

```bash
npx vitest run > /tmp/tee-task3-finale.txt 2>&1; echo "exit=$?"; tail -6 /tmp/tee-task3-finale.txt
npx tsc --noEmit > /tmp/tee-task3-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/tee-task3-tsc.txt
git status --short
```

```bash
git add src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts
git commit -m "test(schema): ri-basa il riferimento col TEE sull'imbocco dal lato dell'ancora

Cambiate le sole polilinee delle tubazioni che toccano la giunzione senza
gomiti a mano: ora la imboccano invece di girare a meta' strada. Simboli,
tabella, legenda, muro e dimensioni della pagina identici, e il riferimento
senza TEE non e' stato toccato."
```

---

### Task 4: Verifica in pagina

Lo esegue **il controller**, con gli stessi vincoli di sempre: pratica `c6f56ca5`, dev server **5176 dal worktree**, `browser_navigate` esplicito, mai «Genera comunque .docx», chiusura con «Annulla modifiche» + «Annulla», e confronto in banca dati **campo per campo** prima e dopo.

Da misurare:

1. **La T si forma.** Un ramo collegato al lato `alto` di un TEE posato su un tubo orizzontale **scende dritto** nella giunzione. Misura: l'ascissa del montante deve coincidere con quella del pallino, contro le 55 unità di scarto misurate prima.
2. **Vale per tutti e quattro i lati**, con l'asse giusto: `alto`/`basso` in verticale, `sx`/`dx` in orizzontale.
3. **Le due metà di un tubo spezzato non sono cambiate**: nascono con gomiti a mano, che vincono su tutto.
4. **L'anteprima concorda con la tela** — è la prova in pagina che i due disegni sono rimasti la stessa linea.
5. **Nulla di rotto**: gomiti, segni, trascinamento del tratto, evidenziazione e spezzamento continuano a funzionare.

---

## Cosa questo piano NON fa

- **Non aggancia il TEE alla griglia**: resta la scelta già registrata, perché agganciarlo lo staccherebbe dal tubo su cui è stato innestato. Con l'imbocco dritto il disallineamento residuo smette di leggersi come un errore.
- **Non tocca la punta di freccia sul pallino**: è la domanda di disegno lasciata aperta al committente.
- **Non cambia le rotte native** per gli archi che una giunzione non la toccano.
- **Non integra su `main`.**
