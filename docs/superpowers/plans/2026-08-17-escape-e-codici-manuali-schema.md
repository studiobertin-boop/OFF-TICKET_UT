# Escape che deseleziona, e codici scritti a mano — piano d'attuazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dentro l'editor dello schema d'impianto, Escape toglie la selezione invece di buttare via
il disegno; e le apparecchiature aggiunte a mano dalla palette guadagnano codice e descrizione
modificabili, che il disegno e la tabella riportano.

**Architecture:** due fix indipendenti sullo stesso modulo. Il primo toglie `onClose` al Dialog che
monta l'editor e aggiunge `disableEscapeKeyDown` (senza il quale MUI inghiotte Escape prima che
arrivi al listener dell'editor), poi aggiunge un ramo Escape al gestore tastiera su `window`, che
riusa la deselezione già esistente. Il secondo aggiunge un campo opzionale `codice` a `SchemaNodo`
— **senza toccare l'identificativo interno**, che archi, capi, segni, cronologia e taratura usano —
e fa passare gli otto punti che mostrano il codice per una funzione pura `codiceVisibile`.

**Tech Stack:** React 18 + TypeScript, Material UI 6, `@xyflow/react` (react-flow), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-17-escape-e-codici-manuali-schema-design.md`

## Global Constraints

- **I tre riferimenti SVG committati non devono muoversi di una coordinata.**
  `src/services/schemaImpianto/__tests__/fixtures/svgRiferimento{SenzaTesti,ConTee,ConMuro}.ts`.
  Nessuno dei due fix cambia il disegno. Un riferimento che si muove qui è un difetto, non un
  aggiornamento da accettare: **non rigenerarlo, fermarsi e capire perché.**
- **Tre comandi, tutti, prima di dichiarare finito qualunque task:**
  `npx vitest run` · `npx tsc --noEmit` ·
  `npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0`.
- **Il lint gira a `--max-warnings 0`** sopra tre warning preesistenti (react-refresh su
  `SchemaEditor.tsx` e `SchemaNodeSymbol.tsx`, exhaustive-deps su `TestiLiberi.tsx`). **Non
  esportare funzioni nuove da un file di componente**: fa scattare `react-refresh` e il lint cade.
  È il motivo per cui la logica nuova va in un file di servizio.
- **Niente `prettier --write`:** il `.prettierrc` non corrisponde allo stile del codice.
- **Nessun test di interfaccia per i componenti** (`CLAUDE.md`). La logica provabile si estrae in
  funzioni pure con test propri; il resto si prova in pagina (Task 5).
- **Ogni test nuovo va visto cadere per mutazione.** Si muta l'implementazione, si guarda il test
  fallire, si ripristina **da una copia** (`cp` prima, `cp` indietro), **mai con `git checkout`**.
- **Lunghezza massima di un codice scritto a mano: 6 caratteri.** Vale solo su ciò che si scrive a
  mano; l'id generato da `codiceLibero` non passa dalla validazione.
- **Commenti in italiano**, con accenti corretti, nello stile denso del modulo: dicono *perché*,
  non *cosa*.

---

### Task 1: Escape toglie la selezione, e il fondale non chiude più

**Files:**
- Modify: `src/components/relazione/SchemaImpiantoSection.tsx:244-252` (commento) e `:576-591` (Dialog)
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx:1064-1121` (gestore tastiera) e `:1596-1601` (commento)
- Test: nessuno — è tutto interfaccia, si prova in pagina al Task 5

**Interfaces:**
- Consumes: `deselezionaReactFlow` e `togliAncoraSelezionata`, entrambe già in `SchemaEditor.tsx`
- Produces: niente per i task successivi; è un fix chiuso in sé

- [ ] **Step 1: togliere `onClose` al Dialog dell'editor e aggiungere `disableEscapeKeyDown`**

In `src/components/relazione/SchemaImpiantoSection.tsx`, il Dialog che comincia a riga 576.
Sostituire la riga `onClose={chiudiEditorScartando}` con il commento e la prop qui sotto
(le altre prop del Dialog non cambiano):

```tsx
      <Dialog
        open={editorAperto}
        // Dall'editor non si esce per gesto accidentale: chi disegna per mezz'ora e sfiora Escape
        // non deve perdere tutto. Senza `onClose` il clic sullo sfondo non chiude nulla — stessa
        // strada di `DialogoUscitaTaratura` (BarraTaratura.tsx) — e l'unica uscita senza salvare
        // resta il pulsante «Annulla modifiche».
        //
        // `disableEscapeKeyDown` serve ANCHE senza `onClose`, e il nome inganna: non spegne
        // Escape, smette di rubarlo. Il gestore di MUI (Modal/useModal.js, righe 114-125) chiama
        // `event.stopPropagation()` PRIMA di guardare se `onClose` esiste — «Swallow the event, in
        // case someone is listening for the escape key on the body», dice il loro commento — e lo
        // fa da un handler React sul portale, cioè più in basso del listener su `window` che
        // l'editor usa per i suoi tasti. Senza questa prop, Escape non arriverebbe mai lì dentro e
        // la deselezione sarebbe scritta e inerte.
        disableEscapeKeyDown
        fullScreen={preferenze.schermoIntero}
```

- [ ] **Step 2: riscrivere il commento di `chiudiEditorScartando`**

Stesso file, righe 244-252. Le prime tre righe dichiarano equivalenti tre gesti che non lo sono
più. Sostituire **solo il primo capoverso**, lasciando intatto il secondo (quello sulla taratura
permanente) e il corpo della funzione:

```tsx
  /**
   * Chiude l'editor SCARTANDO. Ci passa solo «Annulla modifiche»: dal 17-08-2026 Escape toglie la
   * selezione invece di chiudere, e il clic sullo sfondo non fa niente (vedi il Dialog più sotto).
   * Buttare via il lavoro deve costare un gesto deliberato, non uno sfiorato.
   *
   * Non disfa la taratura resa PERMANENTE: quella è una scrittura in tabella, dichiarata come tale
   * («vale per ogni pratica dell'applicazione, comprese quelle già consegnate», nel dialogo a tre
   * vie) e decisa a parte da un amministratore. Qui si rimette solo lo strato di questa pratica.
   */
```

- [ ] **Step 3: aggiungere il ramo Escape al gestore tastiera**

In `src/components/schemaImpianto/SchemaEditor.tsx`, dentro `const suTasto = (e: KeyboardEvent) => {`
(riga ~1065). Il blocco va **subito dopo** la guardia `if (scritturaAperta || dialogoUscitaAperto) return`
e **prima** del blocco `if ((e.ctrlKey || e.metaKey) && …)`.

L'ordine non è stile: più sotto c'è un `if (modoTaratura) { … return }` che chiude con un `return`
incondizionato, e un ramo Escape scritto sotto di quello non verrebbe **mai** raggiunto in modo
taratura.

```ts
      if (scritturaAperta || dialogoUscitaAperto) return
      // Escape toglie la SELEZIONE, e nient'altro. Fino al 17-08-2026 chiudeva l'intero editor
      // scartando ogni modifica, senza chiedere niente: ora il Dialog che lo monta non ha più
      // `onClose` (SchemaImpiantoSection.tsx) e l'uscita senza salvare passa solo da «Annulla
      // modifiche».
      //
      // Sta QUI SOPRA il blocco `modoTaratura`, che chiude con un `return` incondizionato: scritto
      // sotto, in taratura non verrebbe mai raggiunto.
      if (e.key === 'Escape') {
        // In taratura la selezione è un'ancora, non un nodo: si DESELEZIONA, e basta. Non
        // `togliAncoraSelezionata` — quella ELIMINA l'ancora dalla taratura, ed è il gesto di
        // Canc: legarla a Escape lo rendeva distruttivo proprio nel fix che esiste per renderlo
        // innocuo (provato in pagina il 17-08-2026: su un'ancora libera, Escape la cancellava).
        // L'uscita dal MODO resta il dialogo a tre vie: Escape non la avvia e non la scavalca.
        if (modoTaratura) setAncoraSelezionata(null)
        else {
          // Due selezioni, non una: react-flow non conosce muro e annotazioni, che hanno la
          // propria (`selezioneLibera`). Nessuna delle due tocca la cronologia —
          // `deselezionaReactFlow` passa già da `aggiornaSenzaCronologia`.
          deselezionaReactFlow()
          setSelezioneLibera(null)
        }
        return
      }
```

- [ ] **Step 4: dichiarare la dipendenza nuova**

Nello stesso `useEffect`, l'array di dipendenze (riga ~1107) guadagna `deselezionaReactFlow`, in
ordine alfabetico subito dopo `annulla`. `setSelezioneLibera` è un setter di `useState` e non va
dichiarato.

```ts
  }, [
    annulla,
    deselezionaReactFlow,
    dialogoUscitaAperto,
    modoTaratura,
    rimuoviMuro,
    rimuoviTesto,
    scritturaAperta,
    selezione.nodes,
    selezioneLibera,
    sposta,
    taraturaHook,
    togliAncoraSelezionata,
  ])
```

- [ ] **Step 5: accorciare il commento sopra i pulsanti**

Stesso file, righe 1596-1601. Va **accorciato**, non precisato: la frase su Escape sparisce, resta
quella sul modo taratura.

```tsx
        {/* Disabilitati mentre il modo taratura è acceso: non esiste uscita implicita da lì
            (Step 4 del brief) — si esce sempre dal dialogo a tre vie, mai chiudendo l'intero
            editor sotto una taratura ancora indecisa. */}
```

- [ ] **Step 6: NON toccare il commento di `BarraTaratura.tsx`**

Riga 542, sopra `DialogoUscitaTaratura`: dice che senza `onClose` né fondale né Escape chiudono
nulla. **Resta vero** — quel dialogo non ha né `onClose` né `disableEscapeKeyDown`, quindi MUI
continua a inghiottire Escape lì sopra. Verificare con gli occhi che sia ancora così e passare
oltre.

- [ ] **Step 7: i tre comandi**

```bash
npx vitest run
npx tsc --noEmit
npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
```

Atteso: `vitest` verde su 1286 test / 97 file (questo task non ne aggiunge né ne cambia nessuno),
`tsc` silenzioso, `eslint` fermo ai tre warning preesistenti — che a `--max-warnings 0` significa
**uscita diversa da zero con esattamente quei tre**, nessuno in più.

- [ ] **Step 8: commit**

```bash
git add src/components/relazione/SchemaImpiantoSection.tsx src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "fix(schema): Escape toglie la selezione invece di buttare via il disegno"
```

---

### Task 2: il campo `codice` e le regole per sceglierlo

**Files:**
- Modify: `src/services/schemaImpianto/types.ts` (interfaccia `SchemaNodo`)
- Create: `src/services/schemaImpianto/codici.ts`
- Test: `src/services/schemaImpianto/__tests__/codici.test.ts`

**Interfaces:**
- Consumes: `SchemaNodo` da `./types`
- Produces:
  - `LUNGHEZZA_MASSIMA_CODICE: number` (= 6)
  - `codiceVisibile(nodo: Pick<SchemaNodo, 'id' | 'codice'>): string`
  - `codiciOccupati(nodi: SchemaNodo[], escluso?: string): Set<string>`
  - `motivoRifiutoCodice(codice: string, nodi: SchemaNodo[], idNodo: string): string | null`

- [ ] **Step 1: aggiungere `codice` a `SchemaNodo`**

In `src/services/schemaImpianto/types.ts`, dentro `interface SchemaNodo`, subito dopo il campo
`origine`:

```ts
  /**
   * Il codice che l'utente VEDE, quando l'ha scritto a mano: sul disegno dentro il simbolo, e in
   * tabella nella lista apparecchiature. Assente — il caso di ogni nodo di scheda, di ogni layout
   * salvato prima del 17-08-2026 e di ogni nodo manuale mai rinominato — vale `id`, che è ciò che
   * si mostrava prima che questo campo esistesse.
   *
   * Sta a parte dall'`id` di proposito, e non lo rimpiazza: l'`id` è l'identificativo con cui
   * archi, capi, segni, cronologia e taratura si riferiscono al nodo, e sui nodi manuali porta il
   * prefisso `M-` proprio per non collidere con un codice di scheda comparso PIÙ TARDI (vedi
   * `codiceLibero`, SchemaEditor.tsx). Lasciare rinominare l'`id` riaprirebbe quella collisione,
   * che al momento della scrittura non si può nemmeno controllare — il codice rivale ancora non
   * esiste. Questo campo no: al peggio due righe uguali in tabella, visibili e correggibili.
   */
  codice?: string
```

- [ ] **Step 2: scrivere i test, che devono fallire**

Creare `src/services/schemaImpianto/__tests__/codici.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { codiceVisibile, codiciOccupati, motivoRifiutoCodice, LUNGHEZZA_MASSIMA_CODICE } from '../codici'
import type { SchemaNodo } from '../types'

function nodo(parziale: Partial<SchemaNodo> & Pick<SchemaNodo, 'id'>): SchemaNodo {
  return {
    tipo: 'serbatoio',
    etichetta: 'Serbatoio',
    gruppo: 'LINEA_DISTRIBUZIONE',
    valvoleSicurezza: [],
    origine: 'manuale',
    ...parziale,
  }
}

describe('codiceVisibile', () => {
  it('ricade sull\'identificativo quando nessuno ha scritto un codice a mano', () => {
    // Il caso di ogni nodo di scheda e di ogni layout salvato prima del 17-08-2026: senza questo
    // ripiego un disegno già consegnato uscirebbe con le caselle del codice vuote.
    expect(codiceVisibile(nodo({ id: 'M-S1' }))).toBe('M-S1')
    expect(codiceVisibile(nodo({ id: 'S1', origine: 'scheda' }))).toBe('S1')
  })

  it('mostra il codice scritto a mano quando c\'è, e non l\'identificativo interno', () => {
    expect(codiceVisibile(nodo({ id: 'M-S1', codice: 'S9' }))).toBe('S9')
  })
})

describe('codiciOccupati', () => {
  it('conta anche gli accessori e le valvole di sicurezza, che hanno una riga propria in tabella', () => {
    // `righeLista` (renderSvg.ts) stampa una riga per l'accessorio e una per ogni valvola: un
    // codice a mano che collidesse con una di quelle produrrebbe due righe uguali, che è
    // esattamente ciò che questo controllo esiste per impedire.
    const occupati = codiciOccupati([
      nodo({
        id: 'C1',
        origine: 'scheda',
        valvoleSicurezza: [{ codice: 'C1.2', etichetta: 'Valvola' }],
        accessorio: { codice: 'C1.1', etichetta: 'Disoleatore', valvoleSicurezza: [{ codice: 'C1.3', etichetta: 'Valvola' }] },
      }),
    ])
    expect(occupati).toEqual(new Set(['C1', 'C1.1', 'C1.2', 'C1.3']))
  })

  it('conta il codice scritto a mano oltre all\'identificativo, perché entrambi restano visibili', () => {
    expect(codiciOccupati([nodo({ id: 'M-S1', codice: 'S9' })])).toEqual(new Set(['M-S1', 'S9']))
  })

  it('lascia fuori il nodo escluso, o non si potrebbe riconfermare il codice che ha già', () => {
    expect(codiciOccupati([nodo({ id: 'M-S1', codice: 'S9' })], 'M-S1')).toEqual(new Set())
  })
})

describe('motivoRifiutoCodice', () => {
  const tela = [nodo({ id: 'S1', origine: 'scheda' }), nodo({ id: 'M-S1' }), nodo({ id: 'M-F1', codice: 'F9' })]

  it('accetta un codice libero', () => {
    expect(motivoRifiutoCodice('S7', tela, 'M-S1')).toBeNull()
  })

  it('accetta il codice che il nodo ha già: non collide con sé stesso', () => {
    expect(motivoRifiutoCodice('F9', tela, 'M-F1')).toBeNull()
  })

  it('rifiuta un codice di scheda, che comparirebbe due volte in tabella', () => {
    expect(motivoRifiutoCodice('S1', tela, 'M-S1')).toMatch(/già usato/)
  })

  it('rifiuta il codice a mano di un altro nodo', () => {
    expect(motivoRifiutoCodice('F9', tela, 'M-S1')).toMatch(/già usato/)
  })

  it('rifiuta un codice più lungo del limite, che uscirebbe dal simbolo sul disegno', () => {
    expect(motivoRifiutoCodice('A'.repeat(LUNGHEZZA_MASSIMA_CODICE + 1), tela, 'M-S1')).toMatch(/caratteri/)
    expect(motivoRifiutoCodice('A'.repeat(LUNGHEZZA_MASSIMA_CODICE), tela, 'M-S1')).toBeNull()
  })

  it('rifiuta il vuoto e i soli spazi: una casella senza codice non identifica niente', () => {
    expect(motivoRifiutoCodice('', tela, 'M-S1')).not.toBeNull()
    expect(motivoRifiutoCodice('   ', tela, 'M-S1')).not.toBeNull()
  })

  it('non si lascia ingannare dagli spazi ai bordi', () => {
    expect(motivoRifiutoCodice('  S1  ', tela, 'M-S1')).toMatch(/già usato/)
  })
})
```

- [ ] **Step 3: eseguire i test e vederli fallire**

```bash
npx vitest run src/services/schemaImpianto/__tests__/codici.test.ts
```

Atteso: FAIL, `Failed to resolve import "../codici"`.

- [ ] **Step 4: scrivere `codici.ts`**

Creare `src/services/schemaImpianto/codici.ts`:

```ts
/**
 * Il codice che l'utente vede sotto ogni apparecchiatura, e le regole per sceglierne uno a mano.
 *
 * Vive in un file di servizio e non dentro `SchemaEditor.tsx` per due ragioni che tirano nella
 * stessa direzione: è logica pura, quindi provabile, mentre il componente non si prova (CLAUDE.md:
 * nessun test di interfaccia); ed esportare una funzione da un file di componente fa scattare
 * `react-refresh` sul lint, che qui gira a zero warning. `codiceLibero` sta ancora in
 * SchemaEditor.tsx per ragioni storiche ed è l'eccezione, non il modello.
 */
import type { SchemaNodo } from './types'

/**
 * Quanti caratteri può avere un codice scritto a mano. Il codice è disegnato DENTRO il simbolo a
 * corpo fisso (24px sui simboli grandi, 14px sul pacco bombole): più lungo esce dal riquadro, e
 * nessun test se ne accorgerebbe — si vedrebbe solo nel documento consegnato. Sei è la lunghezza
 * del codice d'ufficio più lungo di oggi, `M-SEP1`, e il limite l'ha fissato il committente.
 *
 * Vale SOLO su ciò che si scrive a mano: l'identificativo generato da `codiceLibero` non passa di
 * qui, e un ipotetico `M-SEP10` resta legittimo com'era.
 */
export const LUNGHEZZA_MASSIMA_CODICE = 6

/**
 * Il codice da mostrare: quello scritto a mano se c'è, altrimenti l'identificativo — che per i
 * nodi di scheda È il codice di scheda (C1, S1, ...) e per i manuali è quello d'ufficio (M-S1).
 * Il ripiego non è una cortesia: ogni layout salvato prima del 17-08-2026 non ha il campo.
 */
export function codiceVisibile(nodo: Pick<SchemaNodo, 'id' | 'codice'>): string {
  return nodo.codice ?? nodo.id
}

/**
 * Tutto ciò che occupa già un codice sul disegno o in tabella. Non solo i nodi: `righeLista`
 * (renderSvg.ts) stampa una riga anche per l'accessorio dipendente e una per ogni valvola di
 * sicurezza — quelle del nodo e quelle dell'accessorio — e due righe con lo stesso codice sono
 * peggio del codice d'ufficio che questo fix esiste per sostituire.
 *
 * Di ogni nodo contano ENTRAMBI i codici, l'identificativo e quello a mano: restano visibili tutti
 * e due, il primo finché nessuno rinomina, il secondo da lì in poi.
 *
 * `escluso` è l'identificativo del nodo in modifica: senza, il suo stesso codice risulterebbe
 * occupato e non si potrebbe più confermare il dialogo lasciandolo com'è.
 */
export function codiciOccupati(nodi: SchemaNodo[], escluso?: string): Set<string> {
  const occupati = new Set<string>()
  for (const nodo of nodi) {
    if (nodo.id !== escluso) {
      occupati.add(nodo.id)
      if (nodo.codice) occupati.add(nodo.codice)
    }
    // Accessori e valvole restano occupati anche sul nodo in modifica: un'apparecchiatura non può
    // chiamarsi come la propria valvola di sicurezza.
    for (const v of nodo.valvoleSicurezza) occupati.add(v.codice)
    if (nodo.accessorio) {
      occupati.add(nodo.accessorio.codice)
      for (const v of nodo.accessorio.valvoleSicurezza) occupati.add(v.codice)
    }
  }
  return occupati
}

/**
 * Perché un codice scritto a mano non si può accettare, già in italiano e pronto da mostrare sotto
 * il campo — oppure `null` se va bene.
 *
 * Restituisce la frase e non un booleano perché i tre rifiuti sono guasti diversi, e dirne uno per
 * l'altro manda a correggere la cosa sbagliata: chi ha scritto troppo lungo non deve andare a
 * cercare quale altra apparecchiatura gli ruba il codice.
 */
export function motivoRifiutoCodice(codice: string, nodi: SchemaNodo[], idNodo: string): string | null {
  const pulito = codice.trim()
  if (!pulito) return 'Serve un codice.'
  if (pulito.length > LUNGHEZZA_MASSIMA_CODICE)
    return `Al massimo ${LUNGHEZZA_MASSIMA_CODICE} caratteri: più lungo esce dal simbolo sul disegno.`
  if (codiciOccupati(nodi, idNodo).has(pulito)) return 'Questo codice è già usato.'
  return null
}
```

- [ ] **Step 5: eseguire i test e vederli passare**

```bash
npx vitest run src/services/schemaImpianto/__tests__/codici.test.ts
```

Atteso: PASS, 10 test.

- [ ] **Step 6: vedere ogni test cadere per mutazione**

Copiare l'implementazione **prima** di toccarla, e rimetterla **dalla copia**. Mai
`git checkout`: cancellerebbe anche il resto del lavoro non ancora committato.

```bash
cp src/services/schemaImpianto/codici.ts /tmp/codici.ts.bak
```

Le quattro mutazioni, una alla volta, ripristinando fra l'una e l'altra con
`cp /tmp/codici.ts.bak src/services/schemaImpianto/codici.ts`:

1. `codiceVisibile` → `return nodo.id` — devono cadere i test di `codiceVisibile` e quelli di
   rifiuto sul codice a mano altrui.
2. `codiciOccupati` → togliere il ramo `if (nodo.accessorio)` — deve cadere il test
   sull'accessorio.
3. `motivoRifiutoCodice` → `> LUNGHEZZA_MASSIMA_CODICE` diventa `> LUNGHEZZA_MASSIMA_CODICE + 1` —
   deve cadere il test sulla lunghezza.
4. `motivoRifiutoCodice` → `const pulito = codice` (via il `.trim()`) — devono cadere il test sui
   soli spazi e quello sugli spazi ai bordi.

**Se una mutazione lascia tutto verde, il test corrispondente è verde per la ragione sbagliata:**
fermarsi e correggerlo prima di proseguire. Alla fine `cp /tmp/codici.ts.bak …` e verificare che
`npx vitest run src/services/schemaImpianto/__tests__/codici.test.ts` sia di nuovo verde.

- [ ] **Step 7: i tre comandi**

```bash
npx vitest run
npx tsc --noEmit
npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
```

Atteso: `vitest` verde con **10 test in più** (1296) su **98 file**; `tsc` silenzioso; `eslint`
fermo ai tre warning preesistenti. **I tre riferimenti SVG non si sono mossi:** finora nessuno
legge `codice`, e i test dei riferimenti devono essere passati senza toccarli.

- [ ] **Step 8: commit**

```bash
git add src/services/schemaImpianto/types.ts src/services/schemaImpianto/codici.ts src/services/schemaImpianto/__tests__/codici.test.ts
git commit -m "feat(schema): il codice visibile di un'apparecchiatura si stacca dall'identificativo"
```

---

### Task 3: gli otto punti che mostrano il codice leggono `codiceVisibile`

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts:450,498,550,651,737,787`
- Modify: `src/services/schemaImpianto/renderSvg.ts:220`
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx:501`
- Test: `src/services/schemaImpianto/__tests__/renderSvg.test.ts` (aggiunte), `src/services/schemaImpianto/__tests__/simboli.test.ts` (aggiunte)

**Interfaces:**
- Consumes: `codiceVisibile` da `./codici` (Task 2)
- Produces: niente di nuovo; da qui in poi scrivere `nodo.codice` si vede sul disegno e in tabella

- [ ] **Step 1: scrivere i test, che devono fallire**

In coda a `src/services/schemaImpianto/__tests__/renderSvg.test.ts`, dentro il `describe` di
`righeLista` se ce n'è uno, altrimenti in fondo al file:

```ts
describe('righeLista e il codice scritto a mano', () => {
  it('stampa il codice scritto a mano, non l\'identificativo interno', () => {
    // L'identificativo resta `M-S1` perché archi, capi e segni si riferiscono a lui: cambiarlo
    // riaprirebbe la collisione che il prefisso `M-` esiste per evitare. In tabella però il
    // committente deve leggere il codice che ha scritto.
    const layout: SchemaLayout = {
      nodi: [
        {
          id: 'M-S1',
          codice: 'S9',
          tipo: 'serbatoio',
          etichetta: 'Serbatoio di riserva',
          gruppo: 'LINEA_DISTRIBUZIONE',
          valvoleSicurezza: [],
          origine: 'manuale',
          x: 0,
          y: 0,
        },
      ],
      archi: [],
      muro: null,
      testi: [],
    }
    expect(righeLista(layout)).toEqual([{ sinistra: { codice: 'S9' }, descrizione: 'Serbatoio di riserva' }])
  })

  it('ricade sull\'identificativo quando il codice a mano non c\'è', () => {
    // Ogni layout salvato prima del 17-08-2026, e ogni apparecchiatura di scheda.
    const layout: SchemaLayout = {
      nodi: [
        {
          id: 'M-S1',
          tipo: 'serbatoio',
          etichetta: 'Serbatoio',
          gruppo: 'LINEA_DISTRIBUZIONE',
          valvoleSicurezza: [],
          origine: 'manuale',
          x: 0,
          y: 0,
        },
      ],
      archi: [],
      muro: null,
      testi: [],
    }
    expect(righeLista(layout)[0].sinistra).toEqual({ codice: 'M-S1' })
  })
})
```

In coda a `src/services/schemaImpianto/__tests__/simboli.test.ts`:

```ts
describe('il codice disegnato dentro il simbolo', () => {
  // Il codice non sta solo in tabella: ogni simbolo di apparecchiatura se lo porta scritto dentro.
  // Se `simboloDi` continuasse a leggere l'identificativo, il disegno direbbe `M-S1` e la tabella
  // `S9` — due nomi per la stessa apparecchiatura nello stesso documento.
  const tipi: SchemaNodoTipo[] = ['compressore', 'serbatoio', 'essiccatore', 'filtro', 'separatore', 'tanica', 'pacco_bombole']

  for (const tipo of tipi) {
    it(`${tipo} disegna il codice scritto a mano e non l'identificativo`, () => {
      const nodo: SchemaNodo = {
        id: 'M-X1',
        codice: 'X9',
        tipo,
        etichetta: 'Apparecchiatura',
        gruppo: 'LINEA_DISTRIBUZIONE',
        valvoleSicurezza: [],
        origine: 'manuale',
      }
      const svg = simboloDi(nodo)
      expect(svg, tipo).toContain('>X9<')
      expect(svg, tipo).not.toContain('>M-X1<')
    })
  }
})
```

- [ ] **Step 2: eseguire i test e vederli fallire**

```bash
npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts src/services/schemaImpianto/__tests__/simboli.test.ts
```

Atteso: FAIL — `righeLista` restituisce `{ codice: 'M-S1' }` invece di `'S9'`, e ogni simbolo
contiene `>M-X1<`.

Se un tipo fallisce perché `simboloDi` chiede una firma diversa da quella usata qui, **adattare la
chiamata al test, non l'aspettativa**: il punto è che il codice disegnato sia `X9`.

- [ ] **Step 3: far leggere `codiceVisibile` ai sei simboli**

In `src/services/schemaImpianto/symbols/index.ts`, aggiungere l'import in cima (accanto agli altri
`import type … from '../types'`):

```ts
import { codiceVisibile } from '../codici'
```

Nessun ciclo di import: `codici.ts` importa solo `./types`, che non conosce i simboli.

Poi sostituire `nodo.id` con `codiceVisibile(nodo)` nelle sei righe che lo **disegnano**
— e **solo** in quelle:

| riga | contesto |
|------|----------|
| 450 | compressore senza accessorio: `testo(10, 20, nodo.id, 24, 'start')` |
| 498 | compressore con disoleatore: `testo(larghezza - 10, 20, nodo.id, 24, 'end')` |
| 550 | serbatoio: `const etichettaCodice = testo(xCodice, y + h / 2, nodo.id, 24)` |
| 651 | rombo (essiccatore, filtro, separatore): `testo(cx, …, nodo.id, …)` |
| 737 | tanica: `testo(larghezza / 2, altezza / 2, nodo.id, 20)` |
| 787 | pacco bombole: `testo(6, 12, nodo.id, 14, 'start')` |

Esempio, riga 450:

```ts
    return corpo + girante(larghezza / 2, altezza / 2) + testo(10, 20, codiceVisibile(nodo), 24, 'start')
```

**Non toccare** eventuali altri `nodo.id` del file che non finiscano dentro una `testo(...)`:
servono a identificare, non a mostrare. Verificare con
`grep -n "nodo\.id" src/services/schemaImpianto/symbols/index.ts` che dopo la modifica non ne resti
nessuno dentro una chiamata a `testo`.

- [ ] **Step 4: far leggere `codiceVisibile` a `righeLista`**

In `src/services/schemaImpianto/renderSvg.ts`, aggiungere l'import accanto agli altri:

```ts
import { codiceVisibile } from './codici'
```

e cambiare la riga 220:

```ts
    righe.push({ sinistra: { codice: codiceVisibile(nodo) }, descrizione: nodo.etichetta })
```

Le righe 222-229 (accessorio e valvole) **non si toccano**: quei codici sono derivati dalla scheda e
non si scrivono a mano.

- [ ] **Step 5: far leggere `codiceVisibile` al nome del nodo nell'editor**

In `src/components/schemaImpianto/SchemaEdgeTubazione.tsx`, aggiungere all'import da `@/services`:

```ts
import { codiceVisibile } from '@/services/schemaImpianto/codici'
```

e cambiare la riga 501, dentro `nomeDelNodo`:

```ts
    return nodo.nodo.tipo === 'utenze' ? nodo.nodo.etichetta.replace(/\n/g, ' ') : codiceVisibile(nodo.nodo)
```

Il commento sopra (righe 495-497) dice «l'id (C1, S1...) è quello che il committente vede scritto
dentro l'apparecchiatura»: correggerlo in «il codice (C1, S1...)», perché da qui in poi id e codice
possono divergere.

- [ ] **Step 6: eseguire i test e vederli passare**

```bash
npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts src/services/schemaImpianto/__tests__/simboli.test.ts
```

Atteso: PASS.

- [ ] **Step 7: vedere i test nuovi cadere per mutazione**

```bash
cp src/services/schemaImpianto/renderSvg.ts /tmp/renderSvg.ts.bak
cp src/services/schemaImpianto/symbols/index.ts /tmp/symbols-index.ts.bak
```

Due mutazioni, una alla volta, ripristinando dalla copia fra l'una e l'altra:

1. `renderSvg.ts:220` torna a `nodo.id` — deve cadere il primo test nuovo di `righeLista` e
   **restare verde** il secondo (quello del ripiego): se cade anche lui, il ripiego non è provato.
2. `symbols/index.ts:550` (serbatoio) torna a `nodo.id` — deve cadere **solo** il caso `serbatoio`
   del ciclo, non tutti e sette: se ne cade più d'uno, il ciclo non sta provando i simboli
   separatamente.

Ripristinare entrambi dalla copia e verificare il verde.

- [ ] **Step 8: i tre comandi, e il controllo sui riferimenti**

```bash
npx vitest run
npx tsc --noEmit
npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
git diff --stat src/services/schemaImpianto/__tests__/fixtures/
```

Atteso: `vitest` verde; `tsc` silenzioso; `eslint` ai tre warning preesistenti; e soprattutto
**`git diff --stat` sui fixture non stampa nulla**. I nodi dei riferimenti non hanno `codice`,
quindi `codiceVisibile` ricade sull'id e il disegno è identico carattere per carattere. **Se un
riferimento si è mosso, fermarsi:** significa che una sostituzione ha toccato un punto che non
mostrava il codice, e va capito quale — non rigenerato.

- [ ] **Step 9: commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/renderSvg.ts src/components/schemaImpianto/SchemaEdgeTubazione.tsx src/services/schemaImpianto/__tests__/renderSvg.test.ts src/services/schemaImpianto/__tests__/simboli.test.ts
git commit -m "feat(schema): disegno e tabella mostrano il codice scritto a mano"
```

---

### Task 4: il doppio clic apre codice e descrizione

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` — import, commento `:323`, stato
  `scrittura` `:330-334`, `onNodeDoubleClick` `:1130-1141`, validazione `:1157`,
  `confermaScrittura` `:1159-1199`, dialogo `:1616-1680`
- Test: nessuno — è tutto interfaccia, si prova in pagina al Task 5. La logica provabile sta già in
  `codici.ts` (Task 2).

**Interfaces:**
- Consumes: `codiceVisibile`, `motivoRifiutoCodice`, `LUNGHEZZA_MASSIMA_CODICE` da `codici.ts`;
  `nodiDi(stato)`, già funzione di modulo in `SchemaEditor.tsx`
- Produces: niente per i task successivi

- [ ] **Step 1: import**

In cima a `src/components/schemaImpianto/SchemaEditor.tsx`, accanto agli altri import da
`@/services/schemaImpianto`:

```ts
import { codiceVisibile, motivoRifiutoCodice, LUNGHEZZA_MASSIMA_CODICE } from '@/services/schemaImpianto/codici'
```

- [ ] **Step 2: correggere il commento sopra lo stato `scrittura`, e allargare lo stato**

Riga 323 e seguenti. Il commento oggi dice che le etichette delle apparecchiature non si possono
cambiare perché la riconciliazione le riscrive: **è vero solo per i nodi di origine `scheda`**.
Sostituire il commento e il tipo dello stato con:

```ts
  // Il dialog di scrittura, uno solo per tre bersagli.
  //
  // «terminale»: la scritta del terminale utenze, e solo quella.
  //
  // «apparecchiatura»: codice e descrizione di ciò che l'utente ha aggiunto a mano dalla palette,
  // e solo di quello. Le apparecchiature di SCHEDA restano fuori: la loro etichetta viene dalla
  // scheda dati e la riconciliazione la riscrive alla riapertura (è la regola che tiene la §2.3
  // aggiornata quando si corregge marca o modello), quindi permettere di cambiarla qui sarebbe una
  // modifica che si perde in silenzio. Sui nodi di origine `manuale` quella riscrittura non
  // avviene — `riconcilia` li lascia passare intatti (persistenza.ts) — ed è esattamente ciò che
  // rende possibile modificarli. Il codice cambia in `nodo.codice`, non nell'identificativo: vedi
  // il commento su `SchemaNodo.codice` (types.ts) per il perché.
  //
  // «testo»: un'annotazione libera. Con `id` a `null` è un'annotazione che ancora non esiste:
  // si scrive prima e si crea alla conferma (vedi `confermaScrittura`).
  const [scrittura, setScrittura] = useState<{
    bersaglio: 'terminale' | 'testo' | 'apparecchiatura'
    id: string | null
    valore: string
    /** Solo per «apparecchiatura»: il codice in composizione. */
    codice?: string
  } | null>(null)
```

- [ ] **Step 3: aprire il dialogo anche sulle apparecchiature manuali**

Sostituire `onNodeDoubleClick` (riga 1130) per intero:

```ts
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, nodo: Node) => {
      // Spento in modo taratura come ogni altro comando d'impianto: `elementsSelectable={false}`
      // non ferma questo gestore (react-flow lo chiama comunque), e riscrivere il terminale
      // scriverebbe nella cronologia dell'IMPIANTO, che lì non ha via di ritorno.
      if (modoTaratura) return
      const dati = (nodo.data as SchemaNodeData).nodo
      if (dati.tipo === 'utenze') {
        setScrittura({ bersaglio: 'terminale', id: nodo.id, valore: dati.etichetta })
        return
      }
      // Solo ciò che l'utente ha aggiunto a mano — le apparecchiature di scheda le riscrive la
      // riconciliazione — e non la giunzione: il TEE è un pallino che non porta scritte sul
      // disegno e che `righeLista` salta, quindi un codice suo non comparirebbe da nessuna parte.
      if (dati.origine !== 'manuale' || dati.tipo === 'giunzione') return
      setScrittura({ bersaglio: 'apparecchiatura', id: nodo.id, valore: dati.etichetta, codice: codiceVisibile(dati) })
    },
    [modoTaratura]
  )
```

- [ ] **Step 4: la validazione del codice, e le dizioni del pulsante**

Sotto `const scrittaValida = …` (riga 1157), aggiungere:

```ts
  // Il rifiuto del codice, già in italiano e pronto da mostrare, oppure `null`. Solo per
  // «apparecchiatura»: gli altri due bersagli non hanno un codice da controllare.
  const rifiutoCodice =
    scrittura?.bersaglio === 'apparecchiatura'
      ? motivoRifiutoCodice(scrittura.codice ?? '', nodiDi(stato), scrittura.id ?? '')
      : null
  // Vale sia per il pulsante sia per la scorciatoia da tastiera: senza la seconda, Ctrl+Invio
  // scavalcherebbe il pulsante spento e scriverebbe un codice doppio.
  const scritturaConfermabile = scrittaValida && rifiutoCodice === null
  const dizioneConferma =
    scrittura === null
      ? ''
      : scrittura.bersaglio === 'apparecchiatura'
        ? 'Salva'
        : scrittura.bersaglio === 'terminale'
          ? 'Cambia scritta'
          : scrittura.id === null
            ? 'Aggiungi'
            : 'Salva'
```

- [ ] **Step 5: il ramo di scrittura in `confermaScrittura`**

Dentro `confermaScrittura` (riga 1159): estendere la destrutturazione a `codice`, e inserire il
ramo nuovo **subito prima** di `if (bersaglio === 'terminale')`:

```ts
    const { bersaglio, id, codice } = scrittura
```

```ts
    if (bersaglio === 'apparecchiatura') {
      const scritto = (codice ?? '').trim()
      applica((s) => ({
        ...s,
        nodes: s.nodes.map((n) => {
          if (n.id !== id) return n
          const dati = (n.data as SchemaNodeData).nodo
          return {
            ...n,
            data: {
              ...(n.data as SchemaNodeData),
              nodo: {
                ...dati,
                etichetta: contenuto,
                // Torna ASSENTE se coincide con l'identificativo d'ufficio: così un nodo mai
                // rinominato e uno rinominato al proprio codice restano indistinguibili nel
                // salvato, e non nasce un salvato che dice due volte la stessa cosa.
                //
                // E assente anche se vuoto, che dall'interfaccia non può arrivare (il pulsante è
                // spento) ma qui costerebbe caro: `codiceVisibile` ripiega con `??`, che una
                // stringa vuota non la intercetta — il simbolo resterebbe senza codice e la
                // tabella con la casella bianca.
                codice: scritto && scritto !== n.id ? scritto : undefined,
              },
            } satisfies SchemaNodeData,
          }
        }),
      }))
      return
    }
```

Un solo `applica`: codice e descrizione entrano insieme, e **un solo Ctrl+Z li riporta indietro
entrambi** — la stessa regola già scritta nel commento sopra.

- [ ] **Step 6: il secondo campo nel dialogo**

Nel Dialog di scrittura (riga ~1616). Tre modifiche.

Il titolo:

```tsx
        <DialogTitle>
          {scrittura?.bersaglio === 'testo'
            ? 'Testo sul disegno'
            : scrittura?.bersaglio === 'apparecchiatura'
              ? 'Codice e descrizione'
              : 'Scritta del terminale'}
        </DialogTitle>
```

Il `DialogContent`, con il campo del codice davanti a quello del testo:

```tsx
        <DialogContent>
          {scrittura?.bersaglio === 'apparecchiatura' && (
            <TextField
              autoFocus
              fullWidth
              margin="dense"
              label="Codice"
              error={rifiutoCodice !== null}
              helperText={
                rifiutoCodice ??
                `Compare dentro il simbolo sul disegno e nella lista apparecchiature. Al massimo ${LUNGHEZZA_MASSIMA_CODICE} caratteri.`
              }
              value={scrittura.codice ?? ''}
              onChange={(e) => setScrittura((s) => (s ? { ...s, codice: e.target.value } : s))}
            />
          )}
          <TextField
            // Il fuoco va al campo del codice quando c'è: è il primo dei due.
            autoFocus={scrittura?.bersaglio !== 'apparecchiatura'}
            fullWidth
            margin="dense"
            label={scrittura?.bersaglio === 'apparecchiatura' ? 'Descrizione' : 'Testo'}
            // La descrizione è una riga sola: in tabella ne entra una, e un a capo scritto qui
            // sparirebbe senza dirlo. Gli altri due bersagli restano multi-riga dal Blocco C2.
            {...(scrittura?.bersaglio === 'apparecchiatura' ? {} : { multiline: true, minRows: 2, maxRows: 8 })}
            helperText={
              scrittura?.bersaglio === 'apparecchiatura'
                ? 'La riga che compare nella lista apparecchiature, per esempio «Serbatoio di riserva 500 l».'
                : scrittura?.bersaglio === 'testo'
                  ? 'Una scritta libera sul disegno, per esempio «Locale compressori». Invio va a capo, Ctrl+Invio conferma (oppure usa il pulsante qui sotto).'
                  : 'Per esempio «Utenze aria», «Utenze azoto». Invio va a capo, Ctrl+Invio conferma (oppure usa il pulsante qui sotto).'
            }
            value={scrittura?.valore ?? ''}
            onChange={(e) => setScrittura((s) => (s ? { ...s, valore: e.target.value } : s))}
          />
        </DialogContent>
```

E il pulsante di conferma:

```tsx
          <Button variant="contained" onClick={confermaScrittura} disabled={!scritturaConfermabile}>
            {dizioneConferma}
          </Button>
```

- [ ] **Step 7: chiudere la scorciatoia da tastiera sul codice rifiutato**

Nell'`onKeyDown` del Dialog (riga ~1638), l'ultima riga usa `scrittaValida`, che non sa niente del
codice. Sostituirla:

```tsx
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && scritturaConfermabile) confermaScrittura()
```

Senza questo, Ctrl+Invio scavalcherebbe il pulsante spento e scriverebbe un codice doppio.

- [ ] **Step 8: i tre comandi**

```bash
npx vitest run
npx tsc --noEmit
npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
git diff --stat src/services/schemaImpianto/__tests__/fixtures/
```

Atteso: `vitest` verde; `tsc` silenzioso; `eslint` ai tre warning preesistenti — **attenzione a
`react-hooks/exhaustive-deps`** su `confermaScrittura`, la cui lista di dipendenze non cambia
(`scrittura` c'è già e porta con sé `codice`); e `git diff --stat` sui fixture di nuovo vuoto.

- [ ] **Step 9: commit**

```bash
git add src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "feat(schema): codice e descrizione si cambiano sulle apparecchiature aggiunte a mano"
```

---

### Task 5: la prova in pagina

**Files:** nessuno da modificare, salvo i difetti che la prova trova.

**Interfaces:**
- Consumes: tutto quanto sopra, in esecuzione

Con 1286 test verdi, l'ultima sessione ha trovato in pagina due descrizioni che uscivano dal bordo
della tabella e due frasi che promettevano cose non più vere. **Questo task non è una formalità.**

- [ ] **Step 1: avviare il dev server e verificare da dove gira**

Il `--port` non è una prova: risalire sempre al processo proprietario della porta. **Su questa
macchina la 5173 è di un altro progetto** (`CLAUDE CODE\APP-AMICI`), verificato il 17-08-2026:
puntarci il browser mostrerebbe l'applicazione sbagliata, con un aspetto abbastanza simile da non
accorgersene subito.

Prima si guarda cosa c'è già in ascolto:

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -ge 5170 -and $_.LocalPort -le 5200 } | ForEach-Object { $p = Get-CimInstance Win32_Process -Filter "ProcessId = $($_.OwningProcess)"; "$($_.LocalPort) -> $($p.CommandLine)" }
```

Se una porta risponde già **dal percorso del lavoro in corso**, si riusa quella. Altrimenti se ne
sceglie una libera e si verifica di nuovo, con lo stesso comando, che sia davvero la propria.
**Un dev server avviato in background da un comando che poi si chiude muore con lui**, e uno
avviato da un worktree precedente sopravvive alla sessione che l'ha acceso: il 17-08-2026 se n'è
trovato uno vivo sulla 5180, orfano da giorni, che teneva in ostaggio i file del suo worktree.

- [ ] **Step 2: chiedere le credenziali al committente ed entrare**

L'API di amministrazione Supabase per generare una sessione è bloccata dal classificatore: **le
credenziali vanno chieste**, non aggirate. Aprire una pratica con layout salvato — ORVED
(`a8bbdbe1-f7ad-40d9-86a0-9483b5dcc7f4`) o LOWA R&D (`c6f56ca5-d57b-408c-a4e5-69a207812b0d`) — e da
lì l'editor dello schema.

- [ ] **Step 3: i sette controlli su Escape**

1. Selezionare un'apparecchiatura, premere Escape: la selezione se ne va, **il disegno resta,
   l'editor resta aperto**.
2. Selezionare il muro, Escape: si deseleziona. Idem con un'annotazione.
3. Clic sullo sfondo, fuori dalla finestra: **non succede niente**.
4. Aprire il dialogo di scrittura (doppio clic sul terminale utenze), Escape: chiude **solo**
   quello, e il resto dell'editor è intatto.
5. Entrare in modo taratura, aprire il dialogo a tre vie, Escape: **non chiude niente**.
6. In modo taratura, selezionare un'ancora, Escape: toglie l'ancora, **il modo resta acceso**.
7. «Annulla modifiche»: esce ancora, e scarta.

- [ ] **Step 4: i cinque controlli sul codice**

I dialoghi si impilano: identificarli **per titolo**, mai `.first()` su un selettore largo.
React Flow non rende i nodi fuori dalla vista: **adattare lo zoom prima di contare** i
`.react-flow__node`. `browser_drag` non è affidabile su react-flow: usare `page.mouse.down()`,
`move` ripetuti, `up`.

8. Aggiungere un serbatoio dalla palette, doppio clic sopra: si apre «Codice e descrizione».
   Cambiarli entrambi e salvare. Il nuovo codice compare **sia dentro il simbolo sia in tabella**:
   leggere il **sorgente** dell'anteprima (`img[alt="Anteprima del disegno finale"]`, è un SVG in
   chiaro come data URI), non l'immagine.
9. Riaprire il dialogo e scrivere un codice già usato da un'apparecchiatura di scheda: il pulsante
   resta spento e sotto il campo si legge il perché. Poi scriverne uno di sette caratteri: stessa
   cosa, con un messaggio **diverso**.
10. Ctrl+Z dopo un cambio riuscito: codice e descrizione tornano indietro **insieme**, con un colpo
    solo.
11. Doppio clic su un'apparecchiatura di scheda e su un TEE aggiunto a mano: **non succede niente**.
12. Doppio clic sul terminale utenze: si apre il campo unico di sempre, «Scritta del terminale».

- [ ] **Step 5: ripulire e riverificare l'assenza**

Uscire con «Annulla modifiche», poi «Annulla» sul dialogo della relazione. Se qualcosa è stato
scritto sul database, cancellarlo e **riverificare l'assenza con una query diretta** — `curl`, mai
`urllib`, credenziali da `.env.local`, e non stampare mai le chiavi. Le pratiche con un layout
salvato devono restare **due**:

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/dm329_technical_data?select=id&additional_info->schemaLayout=not.is.null" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Atteso: esattamente `a8bbdbe1-f7ad-40d9-86a0-9483b5dcc7f4` e `c6f56ca5-d57b-408c-a4e5-69a207812b0d`.

- [ ] **Step 6: riferire al committente cosa la prova ha trovato**

Elencare i punti passati e quelli caduti. **Un punto caduto è lavoro, non una nota:** si corregge e
si riprova, non si annota e si va avanti.

- [ ] **Step 7: fermarsi prima di pubblicare**

```bash
git fetch
git merge-tree $(git merge-base HEAD origin/main) HEAD origin/main
```

Il diff da solo inganna, e su questo repo ha già ingannato: **simulare il merge**. Poi **fermarsi**.
Non si pubblica senza il via esplicito del committente — il push su `main` fa partire il deploy da
solo.

A deploy verificato **sul bundle in produzione, non solo sullo stato «READY»**, aggiungere a
`DOCUMENTAZIONE/fixes.md` al massimo due righe: cosa cambia per chi usa l'applicazione e, per il
difetto, cosa succedeva prima. Niente nomi di funzione, niente numeri di commit.

---

## Cosa è andato diversamente

**La prova in pagina ha trovato un difetto vero, con 1307 test verdi.** In modo taratura Escape era
legato a `togliAncoraSelezionata`, che non deseleziona: **elimina** l'ancora dalla taratura, ed è il
gesto di Canc. Provato su ORVED il 17-08-2026: su un'ancora libera Escape la **cancellava**; su una
con una tubazione attaccata faceva comparire il messaggio d'errore di Canc, fuori contesto. Escape
distruttivo, dentro il fix che esiste per renderlo innocuo. Corretto in `setAncoraSelezionata(null)`;
`togliAncoraSelezionata` resta al servizio di Canc, dov'era.

L'errore era nato dal titolo della domanda posta al committente — «toglie l'ancora selezionata» —
letto come nome di funzione invece che come «toglie la selezione», che è quel che la descrizione
diceva.

**Il muro non si prova col colore.** Selezionandolo non cambia tratto: si prova per comportamento —
selezione, Escape, Canc, e il muro deve **sopravvivere**; poi selezione e Canc senza Escape, e deve
**sparire**. Senza il secondo passo il primo è vacuo, perché «sopravvive» starebbe anche per «il
clic non aveva selezionato nulla».

**La mutazione su `codiceVisibile` fa cadere un test, non due** come diceva il Task 2:
`motivoRifiutoCodice` legge `nodo.codice` attraverso `codiciOccupati`, non attraverso
`codiceVisibile`. Le due funzioni sono provate separatamente, ed è meglio così.

**`codiciOccupati` rifiuta anche i codici delle valvole di sicurezza**, verificato in pagina: `S1.1`
viene respinto. Era la parte del progetto di cui non si aveva la prova.
