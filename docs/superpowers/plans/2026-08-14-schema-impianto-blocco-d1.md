# Schema d'impianto DM329 — Blocco D1: la tela, la finestra e l'etichetta

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendere la tela dell'editor un foglio bianco come il documento, dare al committente una finestra che può ingrandire e ripartire come vuole, e togliere la scritta «flessibile» dagli archi.

**Architecture:** Tre modifiche indipendenti fra loro, tenute insieme da un solo pezzo nuovo: un modulo che possiede *i numeri della finestra* (schermo intero, dimensioni, quota dell'anteprima) e li fa sopravvivere alla chiusura. Le preferenze vivono in `SchemaImpiantoSection`, che monta il dialog, e scendono nell'editor come props: una sola fonte di verità, come per i capi degli archi. Tutta l'aritmetica — limiti, percentuale del divisorio, dimensione della finestra — sta in funzioni pure collaudate; i componenti fanno solo il gesto.

**Tech Stack:** React 18 + TypeScript (strict:false) + Material UI 6 + @xyflow/react + Vitest (jsdom)

**Spec:** `docs/superpowers/specs/2026-08-14-schema-impianto-blocco-d-design.md`

## Global Constraints

- **NESSUN merge e nessun push su `main`** finché il committente non lo dice esplicitamente. Si lavora solo sul ramo `worktree-schema-impianto-dm329`.
- **Il committente non usa ancora l'editor per i propri schemi**: non esiste alcun layout salvato da preservare, e **nessuna scelta va motivata con la retrocompatibilità**. Un commento che lo facesse affermerebbe il falso.
- **Non rifinire i simboli attuali**: verranno sostituiti dall'import dei blocchi CAD.
- **Ogni test nuovo va visto fallire per MUTAZIONE**, su un'implementazione plausibilmente sbagliata. Un rosso da «funzione non definita» non prova nulla. Nove test verdi che non provavano niente sono stati scoperti così nei due blocchi precedenti.
- **Le prove si producono con una redirezione su file, mai trascrivendo.**
- **Ogni commento toccato descrive il repo com'è a fine task**, non come sarà.
- La suite intera impiega 2-3 minuti e **due esecuzioni concorrenti di Vitest fanno morire il worker**: la lancia solo il controller, una alla volta, in background con redirezione su file.
- Il modulo **non monta componenti React nei test** (`CLAUDE.md`: «no UI test»). I componenti si verificano in pagina; le funzioni pure con Vitest.
- `minZoom={0.1}` è basso apposta: **non alzarlo**.
- Baseline di partenza: **935 test su 76 file verdi**, `tsc --noEmit` pulito, testa `a6974eb`.

---

## Struttura dei file

| File | Responsabilità | Task |
|---|---|---|
| `src/components/schemaImpianto/preferenzeEditor.ts` | **Nuovo.** I numeri della finestra: tipo, valori predefiniti, limiti, lettura/scrittura nel browser, e le due aritmetiche (percentuale del divisorio, dimensione della finestra). | 3 |
| `src/components/schemaImpianto/__tests__/preferenzeEditor.test.ts` | **Nuovo.** Prove del modulo sopra. | 3 |
| `src/components/schemaImpianto/DivisorioAnteprima.tsx` | **Nuovo.** Il gesto di trascinare il divisorio fra tela e anteprima. | 4 |
| `src/components/schemaImpianto/ManigliaRidimensiona.tsx` | **Nuovo.** Il gesto di ridimensionare la finestra. | 5 |
| `src/components/schemaImpianto/SchemaEditor.tsx` | Fondo bianco della tela; pulsante schermo intero; divisorio e maniglia montati; larghezza dell'anteprima dalle preferenze. | 1, 4, 5 |
| `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` | Via l'etichetta «flessibile». | 2 |
| `src/components/relazione/SchemaImpiantoSection.tsx` | Possiede le preferenze (Task 4); il dialog prende dimensioni e schermo intero da lì (Task 5). | 4, 5 |

Perché `preferenzeEditor.ts` e non un hook: le preferenze vengono possedute da `SchemaImpiantoSection` con un normale `useState` e passate all'editor come props. Un hook chiamato in due componenti creerebbe **due stati scollegati** — il dialog largo secondo uno e il divisorio secondo l'altro — che è esattamente la classe di difetto («due fonti per lo stesso dato») che questo modulo ha già pagato due volte.

---

### Task 1: La tela diventa un foglio bianco

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx:733` (il `Box` che contiene `<ReactFlow>`) e `:789` (`<Background>`)

**Interfaces:**
- Consumes: nulla
- Produces: nulla (modifica di sole proprietà di stile)

**Contesto per chi implementa.** La tela di react-flow non ha un fondo proprio: il suo `--xy-background-color-default` è `transparent`, quindi finora si vedeva il `Paper` del tema scuro (`#171d26`) sotto. I simboli e i tubi **sono già neri su bianco** e non vanno toccati: cambia solo il fondo. I comandi di zoom di react-flow sono bianchi con bordo `#eee` e su fondo bianco sparirebbero, quindi vanno bordati.

- [ ] **Step 1: Dare il fondo bianco alla tela e rendere visibili i comandi**

In `SchemaEditor.tsx`, sostituire la riga 733:

```tsx
      <Box sx={{ flex: 1, minWidth: 0, border: 1, borderColor: 'divider' }}>
```

con:

```tsx
      {/* La tela è un foglio, non una finestra sul tema scuro. react-flow lascia trasparente la
          propria pane (`--xy-background-color-default`), quindi senza questo fondo si vedrebbe il
          Paper del dialog: bianco come l'anteprima qui accanto e come il documento consegnato, così
          ciò che si disegna e ciò che si stampa hanno lo stesso aspetto.
          I comandi di zoom di react-flow sono bianchi su bordo #eee e sul foglio sparirebbero: il
          bordo qui sotto li ridà all'occhio senza toccare il foglio di stile della libreria. */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'common.white',
          '& .react-flow__controls': { boxShadow: '0 0 0 1px #c9ced6' },
          '& .react-flow__controls-button': { borderBottomColor: '#c9ced6' },
        }}
      >
```

- [ ] **Step 2: Schiarire i puntini della griglia**

Sostituire la riga 789:

```tsx
          <Background gap={10} />
```

con:

```tsx
          {/* Il grigio predefinito di xyflow (#91919a) è tarato su fondo chiaro ma compete col
              disegno: qui la griglia deve guidare l'occhio, non farsi leggere. */}
          <Background gap={10} color="#c9ced6" />
```

- [ ] **Step 3: Verificare che nulla si sia rotto in compilazione**

```bash
npx tsc --noEmit > /tmp/d1-task1-tsc.txt 2>&1; echo "exit=$?"; cat /tmp/d1-task1-tsc.txt
```

Atteso: `exit=0` e file vuoto.

- [ ] **Step 4: Dichiarare che cosa NON è stato toccato**

Verificare, e riportarlo nel report del task, che restano invariati: il riempimento `#fff` dei nodi (`SchemaNodeSymbol.tsx:94`), il tratto `#000` degli archi (`SchemaEdgeTubazione.tsx:312`), il blu `#1976d2` che resta il colore della **selezione**, il nero delle annotazioni (`TestiLiberi.tsx:171`) e il magenta delle guide (`GuideAllineamento.tsx:29`).

```bash
grep -n "1976d2\|#fff\|#000\|ff4081" src/components/schemaImpianto/SchemaNodeSymbol.tsx src/components/schemaImpianto/SchemaEdgeTubazione.tsx src/components/schemaImpianto/TestiLiberi.tsx src/components/schemaImpianto/GuideAllineamento.tsx > /tmp/d1-task1-colori.txt; cat /tmp/d1-task1-colori.txt
```

Nessun test automatico: è un componente React, e `CLAUDE.md` esclude i test di interfaccia. La verifica è in pagina, nel Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "feat(schema): la tela dell'editor diventa un foglio bianco

react-flow lascia trasparente la propria pane, quindi finora si vedeva il
Paper del tema scuro. Ora il fondo e' bianco come l'anteprima e come il
documento consegnato, i puntini della griglia sono schiariti e i comandi
di zoom hanno un bordo che li rende visibili sul foglio.

Simboli, tubi e colore di selezione non sono toccati: erano gia' neri su
bianco."
```

---

### Task 2: Via la scritta «flessibile» dagli archi

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx:80-88` (commento + `ETICHETTA`), `:301-303` (`puntoEtichetta`/`labelX`/`labelY`), `:362-378` (il `<div>` dell'etichetta)

**Interfaces:**
- Consumes: nulla
- Produces: nulla

**Contesto per chi implementa.** L'etichetta esiste **solo nell'editor**: nel documento il flessibile si riconosce dall'onda (`ondula`) e dalla voce di legenda «Tubazione flessibile» (`renderSvg.ts:249-257`), che restano entrambe. Attenzione a due cose: `SchemaArcoStile` resta importato perché serve ancora alle righe 22 e 286, e `puntoSuTratto` resta importato perché serve ancora alla riga 389 per i segni sul tubo. `EdgeLabelRenderer` resta, perché ospita gomiti e segni.

- [ ] **Step 1: Rimuovere la mappa delle etichette**

Cancellare le righe 80-88 per intero, commento compreso:

```tsx
/**
 * Solo il tratto flessibile porta un'etichetta: le linee condense si riconoscono già dal
 * tratteggio, e ripeterlo su ognuna riempirebbe il disegno di scritte.
 */
const ETICHETTA: Record<SchemaArcoStile, string> = {
  standard: '',
  flessibile: 'flessibile',
  condensa: '',
}
```

- [ ] **Step 2: Rimuovere il punto di mezzeria che serviva solo all'etichetta**

Cancellare le righe 301-303:

```tsx
  const { punto: puntoEtichetta } = puntoSuTratto(polilinea, 0.5)
  const labelX = puntoEtichetta.x
  const labelY = puntoEtichetta.y
```

- [ ] **Step 3: Rimuovere il disegno dell'etichetta**

Cancellare le righe 363-378, lasciando `<EdgeLabelRenderer>` che apre direttamente sul ciclo dei gomiti:

```tsx
        {ETICHETTA[stile] && (
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontSize: 11,
              padding: '1px 4px',
              borderRadius: 3,
              background: '#fff',
              border: '1px solid #bbb',
              pointerEvents: 'none',
            }}
          >
            {ETICHETTA[stile]}
          </div>
        )}
```

Il risultato deve essere:

```tsx
      <EdgeLabelRenderer>
        {punti.map((punto, indice) => (
```

- [ ] **Step 4: Verificare che i due import sopravvissuti servano ancora davvero**

```bash
grep -n "SchemaArcoStile\|puntoSuTratto\|EdgeLabelRenderer\|ETICHETTA\|labelX\|labelY" src/components/schemaImpianto/SchemaEdgeTubazione.tsx > /tmp/d1-task2-import.txt; cat /tmp/d1-task2-import.txt
```

Atteso: nessuna occorrenza di `ETICHETTA`, `labelX`, `labelY`; `SchemaArcoStile` presente all'import e alle righe del campo `stile`; `puntoSuTratto` presente all'import e nel ciclo dei segni; `EdgeLabelRenderer` presente all'import e nel JSX.

- [ ] **Step 5: Compilazione e suite dei componenti**

```bash
npx tsc --noEmit > /tmp/d1-task2-tsc.txt 2>&1; echo "tsc exit=$?"
npx vitest run src/components/schemaImpianto > /tmp/d1-task2-vitest.txt 2>&1; echo "vitest exit=$?"; tail -20 /tmp/d1-task2-vitest.txt
```

Atteso: `tsc exit=0` con file vuoto; `vitest exit=0`. Se un test cade citando l'etichetta, **fermarsi e segnalarlo**: significherebbe che esisteva una copertura che il piano non aveva previsto.

- [ ] **Step 6: Commit**

```bash
git add src/components/schemaImpianto/SchemaEdgeTubazione.tsx
git commit -m "feat(schema): via la scritta \"flessibile\" dagli archi dell'editor

Il committente l'ha giudicata inutile e ingombrante. Non si perde
informazione: l'etichetta esisteva solo sulla tela, mentre nel documento
il flessibile si riconosce dall'onda e dalla voce di legenda, che restano.

Spariscono con lei il punto di mezzeria che serviva solo a posizionarla.
EdgeLabelRenderer resta: ospita gomiti e segni sul tubo."
```

---

### Task 3: I numeri della finestra

**Files:**
- Create: `src/components/schemaImpianto/preferenzeEditor.ts`
- Test: `src/components/schemaImpianto/__tests__/preferenzeEditor.test.ts`

**Interfaces:**
- Consumes: nulla
- Produces:
  - `interface PreferenzeEditor { schermoIntero: boolean; larghezza: number; altezza: number; anteprima: number }`
  - `const PREFERENZE_PREDEFINITE: PreferenzeEditor`
  - `function leggiPreferenze(): PreferenzeEditor`
  - `function scriviPreferenze(preferenze: PreferenzeEditor): void`
  - `function percentualeAnteprima(bordoDestro: number, larghezzaRiga: number, xPuntatore: number): number`
  - `function dimensioneFinestra(x: number, y: number, larghezzaSchermo: number, altezzaSchermo: number): { larghezza: number; altezza: number }`

**Contesto per chi implementa.** L'ambiente dei test è **jsdom** (`vitest.config.ts`), quindi `localStorage` esiste e i test possono scriverci. La casa usa `localStorage` in modo diretto con una chiave stringa (`src/theme/index.tsx:22`): si segue quel modo, aggiungendo però la difesa dai valori illeggibili, perché qui il valore è un oggetto e non una parola sola.

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/components/schemaImpianto/__tests__/preferenzeEditor.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  PREFERENZE_PREDEFINITE,
  dimensioneFinestra,
  leggiPreferenze,
  percentualeAnteprima,
  scriviPreferenze,
} from '../preferenzeEditor'

const CHIAVE = 'schema-impianto-preferenze-editor'

describe('lettura e scrittura delle preferenze', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('senza nulla di salvato restituisce i valori predefiniti', () => {
    expect(leggiPreferenze()).toEqual(PREFERENZE_PREDEFINITE)
  })

  it('rilegge quello che ha scritto', () => {
    scriviPreferenze({ schermoIntero: true, larghezza: 70, altezza: 60, anteprima: 25 })
    expect(leggiPreferenze()).toEqual({ schermoIntero: true, larghezza: 70, altezza: 60, anteprima: 25 })
  })

  // La chiave sopravvive agli aggiornamenti dell'applicazione: un giorno può contenere il
  // formato di una versione precedente, o un valore scritto a mano dagli strumenti per
  // sviluppatori. Nessuno di questi casi deve impedire di aprire l'editor.
  it('con un contenuto illeggibile ripiega sui predefiniti invece di sollevare', () => {
    localStorage.setItem(CHIAVE, 'non sono JSON {{{')
    expect(() => leggiPreferenze()).not.toThrow()
    expect(leggiPreferenze()).toEqual(PREFERENZE_PREDEFINITE)
  })

  it('riporta dentro i limiti un valore fuori scala, senza scartare gli altri', () => {
    localStorage.setItem(CHIAVE, JSON.stringify({ schermoIntero: false, larghezza: 999, altezza: 3, anteprima: 40 }))
    const lette = leggiPreferenze()
    expect(lette.larghezza).toBe(100)
    expect(lette.altezza).toBe(40)
    expect(lette.anteprima).toBe(40)
  })

  it('un campo mancante o di tipo sbagliato prende il predefinito e non trascina gli altri', () => {
    localStorage.setItem(CHIAVE, JSON.stringify({ anteprima: 'molto', larghezza: 55 }))
    const lette = leggiPreferenze()
    expect(lette.anteprima).toBe(PREFERENZE_PREDEFINITE.anteprima)
    expect(lette.schermoIntero).toBe(PREFERENZE_PREDEFINITE.schermoIntero)
    expect(lette.larghezza).toBe(55)
  })
})

describe('percentualeAnteprima', () => {
  // Riga larga 1000 che finisce a x=1200: il divisorio a x=900 lascia 300 all'anteprima, il 30%.
  it('misura la parte di riga che resta a destra del divisorio', () => {
    expect(percentualeAnteprima(1200, 1000, 900)).toBe(30)
  })

  it('trascinando oltre il bordo destro non fa sparire l\'anteprima', () => {
    expect(percentualeAnteprima(1200, 1000, 1250)).toBe(15)
  })

  it('trascinando oltre il bordo sinistro non fa sparire la tela', () => {
    expect(percentualeAnteprima(1200, 1000, 100)).toBe(70)
  })
})

describe('dimensioneFinestra', () => {
  // La finestra resta centrata, quindi cresce in tutte le direzioni: metà larghezza è la
  // distanza dell'angolo dal centro dello schermo. Schermo 1000x800, centro (500,400):
  // l'angolo a (900, 720) dà 400*2=800 di larghezza (80%) e 320*2=640 di altezza (80%).
  it('ricava le percentuali dalla distanza dell\'angolo dal centro', () => {
    expect(dimensioneFinestra(900, 720, 1000, 800)).toEqual({ larghezza: 80, altezza: 80 })
  })

  it('non lascia rimpicciolire la finestra sotto il minimo utile', () => {
    expect(dimensioneFinestra(510, 405, 1000, 800)).toEqual({ larghezza: 40, altezza: 40 })
  })

  it('non lascia crescere la finestra oltre lo schermo', () => {
    expect(dimensioneFinestra(2000, 2000, 1000, 800)).toEqual({ larghezza: 100, altezza: 100 })
  })
})
```

- [ ] **Step 2: Eseguire i test e vederli fallire**

```bash
npx vitest run src/components/schemaImpianto/__tests__/preferenzeEditor.test.ts > /tmp/d1-task3-rosso.txt 2>&1; echo "exit=$?"; tail -30 /tmp/d1-task3-rosso.txt
```

Atteso: FALLIMENTO con impossibilità di risolvere `../preferenzeEditor`. **Questo rosso non prova nulla di per sé**: la prova vera è la mutazione dello Step 5.

- [ ] **Step 3: Scrivere il modulo**

Creare `src/components/schemaImpianto/preferenzeEditor.ts`:

```ts
/**
 * I numeri della finestra dell'editor dello schema: schermo intero, dimensioni del dialog e
 * quota di larghezza presa dall'anteprima.
 *
 * Stanno nel browser e non in banca dati perché sono preferenze di visualizzazione di chi
 * disegna, non dati della pratica: due persone che aprono lo stesso schema devono poterlo
 * guardare come preferiscono, e nessuna deve poter cambiare ciò che vede l'altra.
 *
 * L'aritmetica dei due gesti (divisorio e ridimensionamento) sta qui e non nei componenti,
 * perché qui si può collaudare: i componenti del modulo non vengono montati nei test.
 */

export interface PreferenzeEditor {
  schermoIntero: boolean
  /** Larghezza e altezza del dialog, in percentuale dello schermo. */
  larghezza: number
  altezza: number
  /** Quota di larghezza presa dall'anteprima, in percentuale della riga tela+anteprima. */
  anteprima: number
}

export const PREFERENZE_PREDEFINITE: PreferenzeEditor = {
  schermoIntero: false,
  larghezza: 90,
  altezza: 85,
  anteprima: 38,
}

/**
 * Limiti oltre i quali la finestra diventa inservibile: una tela larga il 5% non si disegna e
 * un'anteprima larga il 90% non lascia spazio al disegno.
 */
const LIMITI = {
  larghezza: [40, 100],
  altezza: [40, 100],
  anteprima: [15, 70],
} as const

const CHIAVE = 'schema-impianto-preferenze-editor'

/**
 * Riporta un valore qualunque dentro i suoi limiti. La difesa non è contro il nostro codice ma
 * contro il contenuto del browser: la chiave sopravvive agli aggiornamenti dell'applicazione,
 * quindi può contenere il formato di una versione precedente, un valore scritto a mano dagli
 * strumenti per sviluppatori, o un numero che era legittimo quando i limiti erano altri.
 */
function entroLimiti(valore: unknown, [minimo, massimo]: readonly [number, number], predefinito: number): number {
  if (typeof valore !== 'number' || !Number.isFinite(valore)) return predefinito
  return Math.min(massimo, Math.max(minimo, valore))
}

export function leggiPreferenze(): PreferenzeEditor {
  let salvato: unknown
  try {
    const grezzo = localStorage.getItem(CHIAVE)
    if (grezzo === null) return PREFERENZE_PREDEFINITE
    salvato = JSON.parse(grezzo)
  } catch {
    return PREFERENZE_PREDEFINITE
  }
  if (typeof salvato !== 'object' || salvato === null) return PREFERENZE_PREDEFINITE
  const letto = salvato as Partial<Record<keyof PreferenzeEditor, unknown>>
  return {
    schermoIntero: typeof letto.schermoIntero === 'boolean' ? letto.schermoIntero : PREFERENZE_PREDEFINITE.schermoIntero,
    larghezza: entroLimiti(letto.larghezza, LIMITI.larghezza, PREFERENZE_PREDEFINITE.larghezza),
    altezza: entroLimiti(letto.altezza, LIMITI.altezza, PREFERENZE_PREDEFINITE.altezza),
    anteprima: entroLimiti(letto.anteprima, LIMITI.anteprima, PREFERENZE_PREDEFINITE.anteprima),
  }
}

export function scriviPreferenze(preferenze: PreferenzeEditor): void {
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(preferenze))
  } catch {
    // Spazio esaurito o scrittura vietata: si perde la preferenza, non la sessione di disegno.
  }
}

/**
 * Quanta parte della riga resta all'anteprima portando il divisorio sotto il puntatore.
 * `bordoDestro` e `larghezzaRiga` vengono dal riquadro della riga tela+anteprima.
 */
export function percentualeAnteprima(bordoDestro: number, larghezzaRiga: number, xPuntatore: number): number {
  const quota = ((bordoDestro - xPuntatore) / larghezzaRiga) * 100
  return entroLimiti(quota, LIMITI.anteprima, PREFERENZE_PREDEFINITE.anteprima)
}

/**
 * Dimensioni della finestra portando il suo angolo in basso a destra nel punto (x, y).
 * Il dialog resta centrato sullo schermo, quindi la finestra cresce in tutte le direzioni
 * insieme: metà larghezza è la distanza dell'angolo dal centro. Calcolarla così invece di
 * inseguire il bordo evita l'inseguimento fra puntatore ed elemento che il ricentraggio
 * produrrebbe a ogni movimento.
 */
export function dimensioneFinestra(
  x: number,
  y: number,
  larghezzaSchermo: number,
  altezzaSchermo: number,
): { larghezza: number; altezza: number } {
  return {
    larghezza: entroLimiti(
      ((x - larghezzaSchermo / 2) * 2 * 100) / larghezzaSchermo,
      LIMITI.larghezza,
      PREFERENZE_PREDEFINITE.larghezza,
    ),
    altezza: entroLimiti(
      ((y - altezzaSchermo / 2) * 2 * 100) / altezzaSchermo,
      LIMITI.altezza,
      PREFERENZE_PREDEFINITE.altezza,
    ),
  }
}
```

- [ ] **Step 4: Eseguire i test e vederli passare**

```bash
npx vitest run src/components/schemaImpianto/__tests__/preferenzeEditor.test.ts > /tmp/d1-task3-verde.txt 2>&1; echo "exit=$?"; tail -20 /tmp/d1-task3-verde.txt
```

Atteso: `exit=0`, 11 test verdi.

- [ ] **Step 5: Provare che i test discriminano — quattro mutazioni, una alla volta**

Per ognuna: applicare la mutazione, eseguire i test **redirigendo su file**, annotare quali cadono, poi **ripristinare** prima della successiva. Nessuna mutazione va committata.

| # | Mutazione | Deve cadere |
|---|---|---|
| 1 | In `entroLimiti`, `return Math.min(massimo, Math.max(minimo, valore))` → `return valore` | «riporta dentro i limiti», i due test di sfondamento del divisorio, i due limiti di `dimensioneFinestra` |
| 2 | In `entroLimiti`, togliere `!Number.isFinite(valore)` dalla guardia e cambiare `typeof valore !== 'number'` in `valore === undefined` | «un campo mancante o di tipo sbagliato prende il predefinito» |
| 3 | In `leggiPreferenze`, togliere il `try`/`catch` attorno a `JSON.parse` | «con un contenuto illeggibile ripiega sui predefiniti» |
| 4 | In `percentualeAnteprima`, invertire il segno: `((xPuntatore - bordoDestro) / larghezzaRiga) * 100` | «misura la parte di riga che resta a destra del divisorio» |

```bash
# esempio per la mutazione 1 — ripetere per ognuna
npx vitest run src/components/schemaImpianto/__tests__/preferenzeEditor.test.ts > /tmp/d1-task3-mutazione1.txt 2>&1; echo "exit=$?"; grep -E "✓|×|failed|passed" /tmp/d1-task3-mutazione1.txt | tail -20
git checkout src/components/schemaImpianto/preferenzeEditor.ts
```

Se una mutazione **non** fa cadere nulla, il test corrispondente non discrimina: va rinforzato prima di procedere, e il fatto va scritto nel report.

- [ ] **Step 6: Verificare che l'albero sia pulito dalle mutazioni**

```bash
git diff --stat > /tmp/d1-task3-albero.txt; cat /tmp/d1-task3-albero.txt
```

Atteso: solo il file nuovo e il test, nessuna riga di mutazione residua.

- [ ] **Step 7: Commit**

```bash
git add src/components/schemaImpianto/preferenzeEditor.ts src/components/schemaImpianto/__tests__/preferenzeEditor.test.ts
git commit -m "feat(schema): i numeri della finestra dell'editor, con le loro difese

Schermo intero, dimensioni del dialog e quota dell'anteprima sopravvivono
alla chiusura. Stanno nel browser perche' sono preferenze di chi disegna,
non dati della pratica.

L'aritmetica dei due gesti che arrivano nei task seguenti - divisorio e
ridimensionamento - sta qui e non nei componenti, perche' qui si collauda:
il modulo non monta componenti React nei test.

Un contenuto illeggibile o fuori scala nella chiave del browser ripiega sui
predefiniti invece di impedire l'apertura dell'editor."
```

---

### Task 4: Il divisorio fra tela e anteprima

**Files:**
- Create: `src/components/schemaImpianto/DivisorioAnteprima.tsx`
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (props nuove, riga 732 e seguenti, riga 801)
- Modify: `src/components/relazione/SchemaImpiantoSection.tsx` (diventa il proprietario delle preferenze)

**Interfaces:**
- Consumes: `percentualeAnteprima`, `leggiPreferenze`, `scriviPreferenze`, `PreferenzeEditor` da `./preferenzeEditor` (Task 3)
- Produces:
  - `function DivisorioAnteprima({ onCambia }: { onCambia: (percentuale: number) => void }): JSX.Element`
  - `SchemaEditorProps` guadagna `preferenze: PreferenzeEditor` e `onCambiaPreferenze: (parziale: Partial<PreferenzeEditor>) => void`
  - `SchemaImpiantoSection` guadagna lo stato `preferenze` e la funzione `cambiaPreferenze`, che il Task 5 riusa senza ricrearli

**Contesto per chi implementa.** Il gesto usa la **cattura del puntatore**, come gli altri gesti del modulo (`SchemaGomito`, `SchemaEdgeTubazione.tsx:102-160`): il trascinamento resta valido anche se il cursore esce un attimo dal divisorio, senza montare listener sulla finestra. **`onPointerCancel` va messo dalla nascita**: la sua assenza è il debito noto lasciato dal blocco precedente in tre gesti su quattro, e un gesto nuovo non deve aggiungersi alla lista.

Il divisorio misura il **proprio elemento genitore**, che è la riga `<Stack direction="row">` di `SchemaEditor.tsx:732`: va quindi montato come figlio diretto di quella riga, fra la tela e l'anteprima.

- [ ] **Step 1: Scrivere il componente**

Creare `src/components/schemaImpianto/DivisorioAnteprima.tsx`:

```tsx
/**
 * Il divisorio fra la tela e l'anteprima: si afferra e si trascina per decidere quanto spazio
 * dare al disegno e quanto alla resa finale.
 *
 * L'aritmetica sta in `percentualeAnteprima` (preferenzeEditor.ts) perché lì si può collaudare;
 * qui resta il solo gesto. La misura viene dal riquadro del genitore, cioè dalla riga che
 * contiene tela e anteprima: il divisorio va montato come suo figlio diretto.
 */
import { useCallback } from 'react'
import { Box } from '@mui/material'
import { percentualeAnteprima } from './preferenzeEditor'

interface DivisorioAnteprimaProps {
  /** Chiamata a ogni movimento con la nuova quota dell'anteprima, già entro i limiti. */
  onCambia: (percentuale: number) => void
}

export function DivisorioAnteprima({ onCambia }: DivisorioAnteprimaProps) {
  const suPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Senza questo il browser comincia una selezione di testo e il trascinamento si impunta.
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const suPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      const riga = e.currentTarget.parentElement?.getBoundingClientRect()
      if (!riga || riga.width === 0) return
      onCambia(percentualeAnteprima(riga.right, riga.width, e.clientX))
    },
    [onCambia],
  )

  // Rilascio e annullamento chiudono il gesto allo stesso modo. L'annullamento arriva quando il
  // sistema revoca il puntatore (una gesture del sistema operativo, un tocco che diventa
  // scorrimento): senza questo ramo la cattura resterebbe alzata e il divisorio continuerebbe a
  // seguire il puntatore anche a dito sollevato.
  const suFineGesto = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label="Larghezza dell’anteprima"
      onPointerDown={suPointerDown}
      onPointerMove={suPointerMove}
      onPointerUp={suFineGesto}
      onPointerCancel={suFineGesto}
      sx={{
        flex: '0 0 auto',
        width: 8,
        cursor: 'col-resize',
        bgcolor: 'divider',
        touchAction: 'none',
        '&:hover': { bgcolor: 'primary.main' },
      }}
    />
  )
}
```

- [ ] **Step 2: Aggiungere le due props all'editor**

In `SchemaEditor.tsx`, dentro `SchemaEditorProps` (righe 139-144), aggiungere dopo `noteTubazioni`:

```tsx
  /**
   * Le regolazioni della finestra. Le possiede chi monta il dialog (SchemaImpiantoSection),
   * perché il dialog e l'editor devono leggere gli stessi numeri: tenerne una copia qui
   * significherebbe due stati scollegati, con la finestra larga secondo l'uno e il divisorio
   * secondo l'altro.
   */
  preferenze: PreferenzeEditor
  onCambiaPreferenze: (parziale: Partial<PreferenzeEditor>) => void
```

Aggiungere l'import in testa al file, sotto gli altri import locali:

```tsx
import { DivisorioAnteprima } from './DivisorioAnteprima'
import type { PreferenzeEditor } from './preferenzeEditor'
```

E cambiare la firma alla riga 181:

```tsx
function SchemaEditorInterno({ layout, noteTubazioni, onConferma, onAnnulla, preferenze, onCambiaPreferenze }: SchemaEditorProps) {
```

- [ ] **Step 3: Montare il divisorio e legare la larghezza dell'anteprima**

In `SchemaEditor.tsx`, subito **dopo** la chiusura del `<Box>` della tela (riga 796, `</Box>`) e **prima** di `{anteprima && (`, inserire:

```tsx
      {anteprima && <DivisorioAnteprima onCambia={(anteprima) => onCambiaPreferenze({ anteprima })} />}
```

E alla riga 801 sostituire la larghezza fissa:

```tsx
            width: '38%',
```

con:

```tsx
            width: `${preferenze.anteprima}%`,
```

- [ ] **Step 4: Aggiornare il commento di `minZoom`, che ora afferma il falso**

Il commento alle righe 751-765 dice che il riquadro della tela è «metà dialog, l'altra metà è l'anteprima». Con il divisorio quella proporzione la decide il committente. Sostituire la frase interessata (riga 753-754):

```tsx
          // un riquadro da ~530px — metà dialog, l'altra metà è l'anteprima — richiede circa
```

con:

```tsx
          // un riquadro da ~530px — quanto resta accanto all'anteprima, la cui larghezza il
          // committente decide col divisorio, quindi la tela può essere anche più stretta —
          // richiede circa
```

- [ ] **Step 5: Verificare che le props nuove siano davvero obbligatorie**

```bash
npx tsc --noEmit > /tmp/d1-task4-tsc-atteso-rosso.txt 2>&1; echo "exit=$?"; cat /tmp/d1-task4-tsc-atteso-rosso.txt
```

Atteso in questo istante: **FALLIMENTO** con `TS2739`/`TS2741` su `SchemaImpiantoSection.tsx`, che monta `<SchemaEditor>` senza le due props nuove.

> Se invece `tsc` esce 0, **fermarsi**: significa che le props non sono davvero obbligatorie (un `?` di troppo) e nessuno costringerà chi monta l'editor a passarle. È esattamente il difetto che il blocco precedente ha trovato due volte con i parametri a valore predefinito, e che si chiude solo rendendo il campo obbligatorio e lasciando che `tsc` mostri da sé i chiamanti da sistemare.

Lo Step 6 chiude questo rosso: **il task non finisce con il ramo rotto.**

- [ ] **Step 6: Dare le preferenze a chi monta il dialog**

In `SchemaImpiantoSection.tsx`, aggiungere l'import:

```tsx
import { leggiPreferenze, scriviPreferenze, type PreferenzeEditor } from '@/components/schemaImpianto/preferenzeEditor'
```

Aggiungere lo stato subito dopo la dichiarazione di `editorAperto`:

```tsx
  // Le regolazioni della finestra stanno qui, non nell'editor, perché servono a due consumatori:
  // il Dialog per le proprie dimensioni (dal prossimo task) e l'editor per il divisorio. Una
  // copia per parte significherebbe finestra e divisorio che si contraddicono.
  const [preferenze, setPreferenze] = useState<PreferenzeEditor>(leggiPreferenze)
  const cambiaPreferenze = useCallback((parziale: Partial<PreferenzeEditor>) => {
    setPreferenze((precedenti) => {
      const aggiornate = { ...precedenti, ...parziale }
      scriviPreferenze(aggiornate)
      return aggiornate
    })
  }, [])
```

> Verificare che `useState` e `useCallback` siano già importati da `react` in testa al file; se `useCallback` non c'è, aggiungerlo all'import esistente.

Poi passare le due props all'editor, dentro il `<Dialog>` di riga 367 (che per il resto **non si tocca in questo task**):

```tsx
            <SchemaEditor
              layout={layout}
              noteTubazioni={note}
              preferenze={preferenze}
              onCambiaPreferenze={cambiaPreferenze}
              onAnnulla={() => setEditorAperto(false)}
```

- [ ] **Step 7: Compilare e far girare la suite dei componenti**

```bash
npx tsc --noEmit > /tmp/d1-task4-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d1-task4-tsc.txt
npx vitest run src/components/schemaImpianto > /tmp/d1-task4-vitest.txt 2>&1; echo "vitest exit=$?"; tail -20 /tmp/d1-task4-vitest.txt
```

Atteso: `tsc exit=0` con file **vuoto** e `vitest exit=0`.

- [ ] **Step 8: Commit**

```bash
git add src/components/schemaImpianto/DivisorioAnteprima.tsx src/components/schemaImpianto/SchemaEditor.tsx src/components/relazione/SchemaImpiantoSection.tsx
git commit -m "feat(schema): divisorio trascinabile fra tela e anteprima

L'anteprima aveva il 38% fisso. Ora il committente decide quanto spazio
dare al disegno e quanto alla resa finale.

Il gesto nasce con onPointerCancel: la sua assenza e' il debito che il
blocco precedente ha lasciato in tre gesti su quattro, e un gesto nuovo non
si aggiunge alla lista.

L'aritmetica sta in preferenzeEditor.ts, dove i test la raggiungono.

Le preferenze le possiede SchemaImpiantoSection, che monta il dialog: dal
prossimo task servono anche a lui per le dimensioni della finestra, e due
copie si contraddirebbero."
```

---

### Task 5: Schermo intero e ridimensionamento della finestra

**Files:**
- Create: `src/components/schemaImpianto/ManigliaRidimensiona.tsx`
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (barra strumenti, barra inferiore)
- Modify: `src/components/relazione/SchemaImpiantoSection.tsx:367-382`

**Interfaces:**
- Consumes: `dimensioneFinestra` da `./preferenzeEditor` (Task 3); `SchemaEditorProps.preferenze`/`onCambiaPreferenze` e lo stato `preferenze`/`cambiaPreferenze` di `SchemaImpiantoSection` (Task 4)
- Produces:
  - `function ManigliaRidimensiona({ onCambia }: { onCambia: (dimensione: { larghezza: number; altezza: number }) => void }): JSX.Element`

**Contesto per chi implementa.** Il dialog MUI centra il proprio `Paper`. La maniglia non insegue il bordo — inseguirlo con l'elemento che si ricentra a ogni movimento fa tremare la finestra — ma calcola le dimensioni dalla **distanza dell'angolo dal centro dello schermo**: `dimensioneFinestra` lo fa già. La maniglia va in fondo alla barra inferiore, dopo «Conferma schema», che è l'angolo in basso a destra della finestra; sovrapporla al `Paper` la farebbe cadere proprio sopra quel pulsante.

- [ ] **Step 1: Scrivere la maniglia**

Creare `src/components/schemaImpianto/ManigliaRidimensiona.tsx`:

```tsx
/**
 * La maniglia che ridimensiona la finestra dell'editor. Sta in fondo alla barra inferiore, cioè
 * nell'angolo in basso a destra della finestra: sovrapporla al Paper del dialog la farebbe
 * cadere sopra il pulsante di conferma.
 *
 * L'aritmetica sta in `dimensioneFinestra` (preferenzeEditor.ts), che ricava le percentuali
 * dalla distanza dell'angolo dal centro dello schermo invece di inseguire il bordo: il dialog è
 * centrato, e un elemento che si ricentra mentre lo si trascina insegue il puntatore.
 */
import { useCallback } from 'react'
import { SouthEast as ManigliaIcon } from '@mui/icons-material'
import { Box, Tooltip } from '@mui/material'
import { dimensioneFinestra } from './preferenzeEditor'

interface ManigliaRidimensionaProps {
  onCambia: (dimensione: { larghezza: number; altezza: number }) => void
}

export function ManigliaRidimensiona({ onCambia }: ManigliaRidimensionaProps) {
  const suPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const suPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
      onCambia(dimensioneFinestra(e.clientX, e.clientY, window.innerWidth, window.innerHeight))
    },
    [onCambia],
  )

  // Come per il divisorio: rilascio e annullamento chiudono il gesto allo stesso modo, così una
  // revoca del puntatore da parte del sistema non lascia la cattura alzata.
  const suFineGesto = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  return (
    <Tooltip title="Trascina per ridimensionare la finestra">
      <Box
        onPointerDown={suPointerDown}
        onPointerMove={suPointerMove}
        onPointerUp={suFineGesto}
        onPointerCancel={suFineGesto}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'nwse-resize',
          color: 'text.secondary',
          touchAction: 'none',
          pl: 1,
          '&:hover': { color: 'text.primary' },
        }}
      >
        <ManigliaIcon fontSize="small" />
      </Box>
    </Tooltip>
  )
}
```

- [ ] **Step 2: Aggiungere il pulsante «schermo intero» alla barra dell'editor**

In `SchemaEditor.tsx`, aggiungere agli import delle icone (righe 42-53) le due voci:

```tsx
  Fullscreen as SchermoInteroIcon,
  FullscreenExit as SchermoInteroEsciIcon,
```

e aggiungere l'import del componente nuovo accanto a quello del divisorio:

```tsx
import { ManigliaRidimensiona } from './ManigliaRidimensiona'
```

Poi, nella barra strumenti subito **dopo** il pulsante «Anteprima» (righe 722-729) e **prima** della chiusura `</Stack>` di riga 730, inserire:

```tsx
        <Tooltip title={preferenze.schermoIntero ? 'Riporta la finestra alle sue dimensioni' : 'Porta la finestra a tutto schermo'}>
          <IconButton size="small" onClick={() => onCambiaPreferenze({ schermoIntero: !preferenze.schermoIntero })}>
            {preferenze.schermoIntero ? <SchermoInteroEsciIcon fontSize="small" /> : <SchermoInteroIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
```

- [ ] **Step 3: Montare la maniglia in fondo alla barra inferiore**

In `SchemaEditor.tsx`, sostituire la barra inferiore (righe 821-826):

```tsx
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ p: 1 }}>
        <Button onClick={onAnnulla}>Annulla modifiche</Button>
        <Button variant="contained" onClick={conferma}>
          Conferma schema
        </Button>
      </Stack>
```

con:

```tsx
      <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center" sx={{ p: 1 }}>
        <Button onClick={onAnnulla}>Annulla modifiche</Button>
        <Button variant="contained" onClick={conferma}>
          Conferma schema
        </Button>
        {/* A tutto schermo non c'è nulla da ridimensionare, e una maniglia che non fa niente
            fa credere che il gesto sia rotto. */}
        {!preferenze.schermoIntero && (
          <ManigliaRidimensiona onCambia={(dimensione) => onCambiaPreferenze(dimensione)} />
        )}
      </Stack>
```

- [ ] **Step 4: Legare le dimensioni della finestra alle preferenze**

Lo stato `preferenze` e la funzione `cambiaPreferenze` **esistono già** in `SchemaImpiantoSection.tsx` dal Task 4: non vanno ricreati. Qui cambia solo il `<Dialog>` dell'editor, che finora ignorava quei numeri.

Sostituire l'apertura del dialog e il `DialogContent`:

```tsx
      <Dialog open={editorAperto} onClose={() => setEditorAperto(false)} fullWidth maxWidth="xl">
        <DialogTitle>Rifinisci lo schema d’impianto</DialogTitle>
        <DialogContent dividers sx={{ height: '75vh', p: 0 }}>
```

con:

```tsx
      {/* La finestra non ha più una taglia fissa: le dimensioni arrivano dalle preferenze, e il
          DialogContent si limita a riempire ciò che resta fra titolo e bordo. Il Paper di MUI è
          già una colonna flex, quindi `flex: 1` più `minHeight: 0` bastano a farlo cedere
          l'altezza all'editor invece di gonfiarsi oltre la finestra. */}
      <Dialog
        open={editorAperto}
        onClose={() => setEditorAperto(false)}
        fullScreen={preferenze.schermoIntero}
        maxWidth={false}
        PaperProps={{
          sx: preferenze.schermoIntero
            ? undefined
            : {
                width: `${preferenze.larghezza}vw`,
                height: `${preferenze.altezza}vh`,
                maxWidth: 'none',
                maxHeight: 'none',
              },
        }}
      >
        <DialogTitle>Rifinisci lo schema d’impianto</DialogTitle>
        <DialogContent dividers sx={{ p: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>
```

Il corpo del `DialogContent` — il `{layout && <SchemaEditor … />}` con le props già cablate nel Task 4 — **resta identico**.

- [ ] **Step 5: Compilare e far girare la suite dei componenti**

```bash
npx tsc --noEmit > /tmp/d1-task5-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d1-task5-tsc.txt
npx vitest run src/components/schemaImpianto > /tmp/d1-task5-vitest.txt 2>&1; echo "vitest exit=$?"; tail -20 /tmp/d1-task5-vitest.txt
```

Atteso: `tsc exit=0` con file **vuoto** e `vitest exit=0`.

- [ ] **Step 6: Commit**

```bash
git add src/components/schemaImpianto/ManigliaRidimensiona.tsx src/components/schemaImpianto/SchemaEditor.tsx src/components/relazione/SchemaImpiantoSection.tsx
git commit -m "feat(schema): la finestra dell'editor si ingrandisce e si ridimensiona

Pulsante a tutto schermo nella barra e maniglia di ridimensionamento in
fondo a quella inferiore, al posto di maxWidth=xl con altezza fissa 75vh.

Le dimensioni si ricavano dalla distanza dell'angolo dal centro dello
schermo: il dialog e' centrato, e inseguire il bordo con un elemento che si
ricentra a ogni movimento fa tremare la finestra.

Le preferenze vivono in SchemaImpiantoSection, che monta il dialog, e
scendono nell'editor come props: il Dialog e l'editor leggono gli stessi
numeri, non due copie che si contraddicono."
```

---

### Task 6: Suite intera, verifica in pagina e ledger

**Files:**
- Create: `.superpowers/sdd/2026-08-14-schema-impianto-blocco-d1/progress.md` (se l'esecutore non l'ha già creato)

**Interfaces:**
- Consumes: tutto quanto sopra
- Produces: nulla

Questo task lo esegue **il controller**, non un implementatore: contiene l'unica esecuzione della suite intera e l'unico accesso al browser.

- [ ] **Step 1: Suite intera, una sola esecuzione**

```bash
npx vitest run > /tmp/d1-finale-vitest.txt 2>&1; echo "exit=$?"; tail -15 /tmp/d1-finale-vitest.txt
npx tsc --noEmit > /tmp/d1-finale-tsc.txt 2>&1; echo "tsc exit=$?"; cat /tmp/d1-finale-tsc.txt
```

Atteso: **946 test su 77 file** (i 935 della baseline più gli 11 del Task 3), `exit=0`, `tsc` pulito e albero pulito.

- [ ] **Step 2: Provare che il documento generato non è cambiato**

Il D1 non deve toccare il disegno consegnato: nessuna delle sue modifiche entra in `renderSvg`. Va **dimostrato**, non asserito, perché il test di invarianza committato copre un impianto solo.

```bash
npx vitest run src/services/schemaImpianto > /tmp/d1-finale-servizi.txt 2>&1; echo "exit=$?"; tail -10 /tmp/d1-finale-servizi.txt
git diff a6974eb --stat -- src/services > /tmp/d1-finale-servizi-diff.txt; cat /tmp/d1-finale-servizi-diff.txt
```

Atteso: suite dei servizi verde e **diff vuoto su `src/services`**. Se `src/services` risulta toccato, fermarsi: il D1 non ha ragione di entrarci.

- [ ] **Step 3: Verifica in pagina**

Dev server sulla porta 5176 (verificare prima se è già attivo con `netstat -ano | grep :5176`; altrimenti `npm run dev -- --port 5176 --strictPort` dentro il worktree).

Pratica `c6f56ca5-d57b-408c-a4e5-69a207812b0d` (LOWA R&D SRL) → `http://localhost:5176/requests/<id>/technical-details` → «Genera relazione» → «Rifinisci schema».

**Regole di sicurezza, tutte già pagate:**
- **Mai premere «Genera comunque .docx»**: scrive su una pratica di produzione.
- I dialoghi sono **impilati**: un selettore troppo largo (`.first()` su `textarea`) scrive nel campo del dialogo sottostante. È successo, sul campo ATECO di una pratica vera.
- Chiudere con «Annulla modifiche» + «Annulla», poi **verificare in banca dati** (`dm329_technical_data`, `additional_info.schemaLayout`) che non sia rimasto nulla.

Da verificare, uno per uno:

1. La tela è **bianca** con tubi e simboli neri; i puntini della griglia si vedono ma non competono; i comandi di zoom sono visibili.
2. Nessun arco flessibile porta la scritta «flessibile»; l'onda c'è ancora e la legenda dell'anteprima dice ancora «Tubazione flessibile».
3. Il **divisorio** si trascina in entrambe le direzioni; l'anteprima non sparisce del tutto né mangia la tela.
4. Il pulsante **schermo intero** porta la finestra a tutto schermo e la riporta indietro; a tutto schermo la maniglia non c'è.
5. La **maniglia** ridimensiona la finestra senza tremolii, e la finestra resta centrata.
6. **Chiudendo e riaprendo l'editor**, le tre regolazioni sono quelle lasciate.
7. La tela **continua a funzionare**: si sposta un nodo, si crea un gomito col doppio clic, si trascina un tratto, e l'anteprima segue.

Ognuno dei sette va **misurato o fotografato**, non giudicato a memoria.

- [ ] **Step 4: Scrivere il ledger**

Nel `progress.md` del workspace vanno le cose che git non registra: le cause vere dei difetti trovati in corsa, le mutazioni che non hanno discriminato, le decisioni prese fuori dal piano e il perché. **È la fonte di verità per la sessione successiva.**

- [ ] **Step 5: Riferire al committente**

Riportare l'esito dei sette punti e chiedere se il D1 va bene prima di aprire il D2. La sua verifica vale più di qualunque revisione: nei tre blocchi precedenti ha trovato in cinque minuti difetti che nove task, quattro revisioni e novecento test avevano solo sfiorato.

---

## Cosa questo piano NON fa

- **Non tocca `src/services/schemaImpianto/`**: il documento consegnato non cambia nel D1.
- **Non tocca la griglia, il TEE, le valvole e il muro**: sono i blocchi D2, D3 e D4.
- **Non estrae il pattern comune dei gesti**: lo fa il D2, che tocca tutti e quattro i gesti esistenti. I due gesti nuovi di questo blocco nascono però già con `onPointerCancel`, così il D2 ne trova due in meno da sistemare.
- **Non integra su `main`.**
