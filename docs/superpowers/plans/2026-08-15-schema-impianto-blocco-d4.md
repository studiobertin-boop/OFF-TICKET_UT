# Blocco D4 — valvole e muro: piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La linea si interrompe dentro valvole e riduttori, e il muro di separazione smette di essere derivato per diventare un oggetto che il committente aggiunge, sposta e cancella — nell'editor come nel documento.

**Architecture:** Due cambiamenti al documento consegnato, entrambi verificati sullo stesso banco di confronto prima/dopo montato su otto impianti. Il primo è un rettangolo bianco dentro il simbolo della valvola, disegnato prima dei tratti: ricade sull'editor senza una riga in più perché l'editor inietta la stessa stringa SVG del documento. Il secondo toglie `calcolaMuro` da tutti i percorsi automatici e introduce `muroDaAscissa`, che ricostruisce il muro dalla sola ascissa salvata più l'inviluppo verticale corrente del disegno — una sola fonte di verità, perché l'altezza continua ad adattarsi da sé. Sulla tela il muro vive nel portale della viewport, accanto alle annotazioni libere, e condivide con loro una nozione di selezione che il tasto Canc consuma.

**Tech Stack:** TypeScript, React 18, @xyflow/react (react-flow), Vitest. Nessuna dipendenza nuova.

**Spec:** `docs/superpowers/specs/2026-08-14-schema-impianto-blocco-d-design.md`, sezione «Blocco D4 — valvole e muro» (righe 395-489 nella revisione del 14-08-2026; la sezione D3.2 è stata corretta il 15-08-2026 ed è il commit `702a5cc` di questo ramo).

**Ramo:** `worktree-schema-impianto-d4`, worktree `.claude/worktrees/schema-impianto-d4`, nato da `main` (`23a108d`). Baseline verificata prima di cominciare: **86 file, 1073 test, 0 falliti**.

---

## Global Constraints

Valori e regole che valgono per **ogni** task di questo piano. Copiati dalla spec e dalle trappole già pagate nei blocchi precedenti: non sono consigli.

- **`posizioneAncora` (`renderSvg.ts`) non si tocca.** È l'unica fonte di verità su dove sta un capo di tubo. Questo modulo ha già pagato due volte per averne avute due.
- **Niente `prettier --write`**: il `.prettierrc` del repo non corrisponde allo stile del codice e riformatterebbe file estranei al task.
- **Ogni test nuovo va visto cadere per mutazione** su un'implementazione plausibilmente sbagliata, prima di dichiararlo buono. Un test che passa per la ragione sbagliata è la classe di difetto numero uno di questo modulo: dieci nel Blocco C2, quattro nel D3, tre nella correzione dell'imbocco. **Quando una mutazione non fa cadere nulla, il difetto è nel test, non nella mutazione.**
- **Le mutazioni si ripristinano da una copia** (`cp file file.bak` prima, `cp file.bak file` dopo), **mai con `git checkout`**: le mutazioni si applicano prima del commit, quindi su un file tracciato `git checkout` butterebbe via l'implementazione insieme alla mutazione. È successo davvero.
- **Ogni commento toccato descrive il repo a fine task**, mai come sarà. I commenti falsi sono la classe di difetto numero due: quindici corretti nel lavoro sul Blocco D, quasi tutti nati nei brief di chi coordinava. La regola che li ferma è **accorciare invece di precisare**: quando un commento sbaglia due volte sullo stesso punto, il difetto è nella portata, non nella formulazione.
- **Chi implementa verifica le affermazioni del brief** che riceve — che un file esista, che una funzione si comporti come è scritto. Più di dieci enunciati falsi sono stati intercettati così nei blocchi precedenti. Questo piano non fa eccezione: se un numero di riga o una firma qui dentro non corrisponde al repo, si segnala invece di adattarsi in silenzio.
- **`diff` sempre con `--strip-trailing-cr`**: senza, un confronto fra un file estratto con `git archive` e un file di lavoro segnala differenze che sono solo il fine-riga.
- **Non si pubblica.** Nessun `git push`, nessun merge su `main`, finché il committente non lo chiede. Il push su `main` fa partire il deploy in produzione da solo. E quando quel momento arriverà: **`git fetch` per primo**, prima di simulare qualunque merge.
- **Il dev server sta sulla 5176 e deve girare dal worktree**, non dal checkout principale. Si verifica con `Get-CimInstance Win32_Process | Where-Object CommandLine -like '*vite*'`: se il processo ha come cwd il checkout principale, si sta provando codice che non è il proprio.
- **Commit in italiano**, Conventional Commits, apostrofo tipografico evitato nel messaggio (l'ambiente lo ha già maltrattato in passato: usare `'` semplice).

### Vocabolario, per non inventarne uno nuovo

| Termine | Cosa indica esattamente |
|---|---|
| **segno** | Valvola di intercettazione o riduttore di pressione posati *sul tubo* (`SchemaSegnoTubo`), non nodi. |
| **muro** | `SchemaMuroSeparazione { x, yMin, yMax }` — dopo questo blocco, `x` è dato salvato, `yMin`/`yMax` sono derivati. |
| **varco** | Interruzione del muro dove una tubazione lo attraversa. Non è dato: `renderSvg` lo ricava dalle rotte effettive. |
| **banco** | Il confronto prima/dopo su otto impianti, montato per l'occasione e **non committato**. |
| **pin / riferimento** | Le fixture `svgRiferimento*.ts`, committate, che fissano l'SVG di un impianto un elemento per riga. |

---

## Struttura dei file

**Servizi (il documento):**

| File | Responsabilità dopo il blocco |
|---|---|
| `src/services/schemaImpianto/symbols/index.ts` | `valvolaIntercettazione` disegna il rettangolo bianco; nasce `TRATTEGGIO_CONDENSE`, unica fonte del tratteggio condense. |
| `src/services/schemaImpianto/tratti.ts` | Accoglie `quoteAttraversamento`, che oggi è privata in `renderSvg.ts`: da qui la vedono documento e tela senza copie. |
| `src/services/schemaImpianto/layout.ts` | `layoutSchema` non produce più il muro; nasce `muroDaAscissa`; `calcolaMuro` resta come **sola proposta** di ascissa per il pulsante della barra. |
| `src/services/schemaImpianto/persistenza.ts` | `LayoutSalvato.muroX` (sola ascissa); `deserializzaLayout` e `riconcilia` ricostruiscono il muro da lì. |
| `src/services/schemaImpianto/renderSvg.ts` | Espone `varchiDelMuro`, così la tela apre i varchi con la funzione del documento e non con una copia. |

**Editor (la tela):**

| File | Responsabilità dopo il blocco |
|---|---|
| `src/components/schemaImpianto/useMuro.ts` | **Nuovo.** Funzioni pure + hook per aggiungere, spostare e togliere il muro. Modellato su `useTestiLiberi.ts`. |
| `src/components/schemaImpianto/MuroSeparazione.tsx` | **Nuovo.** Il muro sulla tela, nel portale della viewport, disegnato con `simboloMuro`. Modellato su `TestiLiberi.tsx`. |
| `src/components/schemaImpianto/SchemaEditor.tsx` | `StatoEditor.muroX`; pulsante «Muro» in barra; selezione degli oggetti liberi e Canc. |
| `src/components/schemaImpianto/TestiLiberi.tsx` | L'annotazione si seleziona a clic (serve a farle raggiungere il Canc). |
| `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` | Il tratteggio condense legge `TRATTEGGIO_CONDENSE`. |
| `src/components/schemaImpianto/conversioneFlow.ts` | `flowALayout` riceve `muroX` e ne ricava il muro. |

**Fixture:**

| File | |
|---|---|
| `__tests__/fixtures/svgRiferimentoSenzaTesti.ts` | Ri-basata due volte (Task 3 e Task 5), ogni volta con la differenza letta prima. |
| `__tests__/fixtures/svgRiferimentoConTee.ts` | Idem. |
| `__tests__/fixtures/svgRiferimentoConMuro.ts` | **Nuova** (Task 6): estende la copertura del pin al muro, che oggi nessun riferimento intercetta. |

---

## Nota sull'ordine, e una deroga dichiarata alla spec

La spec chiede «**un unico** ri-basamento del riferimento SVG, letto differenza per differenza», perché i due cambiamenti condividono la stessa verifica. Questo piano ne fa **due** — uno dopo il rettangolo bianco (Task 3), uno dopo il muro manuale (Task 5) — e la ragione è che va nella direzione più severa, non in quella più comoda: due diff piccoli, ognuno con **una sola** classe di differenza attesa, si leggono davvero uno per uno; un diff unico con due classi di differenze intrecciate è esattamente la situazione in cui una terza differenza non attesa scivola dentro perché «sarà l'altra modifica». Il banco resta uno solo e montato una volta sola, che è la parte costosa.

Conseguenza pratica: **ogni task di questo piano finisce coi test committati verdi**, incluso il riferimento committato. Non ci sono commit intermedi con test rossi in cronologia.

> **Il banco è un'eccezione, e di proposito.** Dal Task 3 al Task 5 il banco (`banco.temp.test.ts`, non tracciato) è **rosso**: è lo strumento che misura un cambiamento voluto, non una rete che deve restare verde. Un task che lo trovasse verde dove il piano lo dà per rosso avrebbe un problema — il contrario, no. *Corretto il 15-08-2026: le prime stesure degli Step 7 del Task 3 e Step 5 del Task 5 dicevano «0 falliti» per la suite intera, che è impossibile finché il banco è montato.*

---

### Task 1: Il banco sugli otto impianti, e la prova che discrimina

Nessun cambiamento di produzione. Costruisce lo strumento con cui i Task 3 e 5 si giudicano e **lo prova prima di fidarsene**. Il banco è impalcatura: **non si committa**, e sopravvive nel worktree fino al Task 5 che lo smonta.

**Files:**
- Create (non committato): `src/services/schemaImpianto/__tests__/banco.temp.test.ts`
- Create (non committato): `src/services/schemaImpianto-base/` — copia dei servizi al commit di partenza

**Interfaces:**
- Produces: il file `banco.temp.test.ts` con `CASI` leggibile a occhio nudo; i Task 3 e 5 lo rieseguono senza modificarlo.

- [ ] **Step 1: Estrarre la copia dei servizi alla base del blocco**

La copia va **dentro `src`**, non in `/tmp`: da fuori l'albero dei sorgenti gli import relativi e l'alias `@/` non si risolvono.

```bash
BASE=$(git rev-parse --short HEAD); echo "base=$BASE"
rm -rf /tmp/d4-estratto && mkdir -p /tmp/d4-estratto
git archive "$BASE" src/services/schemaImpianto | tar -x -C /tmp/d4-estratto
cp -r /tmp/d4-estratto/src/services/schemaImpianto src/services/schemaImpianto-base
rm -rf src/services/schemaImpianto-base/__tests__
ls src/services/schemaImpianto-base/
```

Atteso: `agganci.ts allineamento.ts buildSchemaModel.ts griglia.ts layout.ts persistenza.ts rasterize.ts renderSvg.ts symbols tratti.ts types.ts`. Annotare `$BASE` nel report: serve nei messaggi di commit dei Task 3 e 5.

- [ ] **Step 2: Scrivere il banco con gli otto casi**

Otto impianti, scelti perché **ogni cosa che questo blocco tocca compaia in almeno due di essi**. I primi sei sono quelli del banco del D3; il settimo e l'ottavo esistono apposta per il D4, e senza di loro il banco non vedrebbe né il rettangolo bianco su un montante né un muro con più varchi.

| # | Caso | Perché c'è |
|---|---|---|
| 1 | Impianto minimo: compressore + serbatoio orizzontale | Il caso di ogni pratica piccola |
| 2 | Catena completa: compressore, serbatoio verticale, essiccatore, filtro | Il caso tipico |
| 3 | Due serbatoi sullo stesso compressore | Due mandate flessibili |
| 4 | Con separatore e tanica (corsia condense) | **Le uniche linee condense del banco** — nessun riferimento committato le copre |
| 5 | Due compressori | Muro con inviluppo più alto |
| 6 | Con un TEE su una linea aria | Il lavoro del D3, che non deve muoversi |
| 7 | Con valvola di intercettazione **e** riduttore, uno su un tratto orizzontale e uno su un montante verticale | **Il caso del D4.1**: senza, il rettangolo bianco non si vede in nessuna delle due orientazioni |
| 8 | Impianto largo con **tre** tubi che attraversano il muro, più due annotazioni libere | **Il caso del D4.2**: varchi multipli, e il muro che sparisce |

I layout si scrivono riusando le fixture già presenti in `renderSvg.test.ts` (`svgMinimo()`, `layoutConTesti([])`, `layoutConTee()`) e in `layout.test.ts` — leggerle e imitarle, non inventare una forma nuova. I casi 7 e 8 si costruiscono dal caso 2 aggiungendo `segni` agli archi (caso 7) e nodi/annotazioni (caso 8). Verificare i nomi: sono quelli visti nel repo al 15-08-2026, e se una fixture non esiste più si usa la sua erede invece di ricrearla.

> **Nota aggiunta il 15-08-2026, dopo la correzione del banco (vedi sopra):** la forma corretta del banco parte **dalla scheda** — `CASI: { nome; scheda }[]`, non `{ nome; layout }[]` — perché ogni pipeline deve inforcare la catena al primo stadio che il blocco tocca. I casi 7 e 8 così come descritti in questa tabella (segni aggiunti a mano sugli archi per il 7; nodi, gomiti **e le due annotazioni libere** per l'8) appartengono al **primo** banco (quello con `{ nome; layout }[]`, `SchemaLayout` costruiti a mano dopo `layoutSchema`) e **non sono riproducibili** dalla forma corretta così com'è scritta qui: una scheda non ha un campo che dica «metti un riduttore qui» o «aggiungi questa annotazione», e `layoutSchema` produce sempre `testi: []`. Il Task 5 (in coda), rileggendo la scomparsa del muro sui casi 5 e 8, ha dovuto ridefinire l'8 come «tre attraversamenti, senza le due annotazioni»: i gomiti a mano che impongono le tre quote di attraversamento sono stati riprodotti mutando il `SchemaLayout` **dopo** averlo costruito dalla scheda (fra `layoutSchema(...)` e `renderSvg(...)`, non dentro la scheda) — quella via resta aperta; le due annotazioni no, perché non c'è un `layout.testi` da riportare finché non lo si scrive a mano, ed è proprio questo passo manuale che il banco corretto vuole evitare per restare fedele alla catena vera.

```ts
import { describe, expect, it } from 'vitest'
import { buildSchemaModel } from '../buildSchemaModel'
import { layoutSchema } from '../layout'
import { renderSvg } from '../renderSvg'
// La copia dei servizi alla base del blocco, estratta in `schemaImpianto-base/` allo Step 1.
import { buildSchemaModel as buildPrima } from '../../schemaImpianto-base/buildSchemaModel'
import { layoutSchema as layoutPrima } from '../../schemaImpianto-base/layout'
import { renderSvg as renderPrima } from '../../schemaImpianto-base/renderSvg'

const CASI: { nome: string; scheda: /* la scheda dati del caso */ }[] = [
  /* gli otto casi della tabella qui sopra */
]

describe('banco di confronto D4', () => {
  for (const caso of CASI) {
    it(`${caso.nome}`, () => {
      // OGNI lato costruisce il layout col PROPRIO `layoutSchema`, non con quello attuale
      // condiviso: vedi la nota qui sotto.
      expect(renderSvg(layoutSchema(buildSchemaModel(caso.scheda)))).toBe(
        renderPrima(layoutPrima(buildPrima(caso.scheda)))
      )
    })
  }
})
```

> **Perché ogni lato costruisce il proprio layout, e non se ne condivide uno.** *Corretto il 15-08-2026, dopo che è successo davvero.* La prima stesura di questo piano faceva rendere ai due `renderSvg` **lo stesso** oggetto `SchemaLayout`, forma ereditata dal banco del Blocco D3 — dove era corretta, perché lì il cambiamento viveva tutto dentro `renderSvg`. Nel D4 metà del cambiamento vive **a monte**, in `layoutSchema`: appena questa smette di produrre il muro, un layout condiviso arriva **già privo di muro a entrambi i lati**, e il banco misura zero differenze proprio sul cambiamento più pervasivo del blocco — quello che la spec dice esplicitamente che «passerebbe inosservato affidandosi al solo riferimento committato». Uno strumento che non vede la cosa che deve misurare non dà un esito più forte: non dà nessun esito. Ne segue anche che ogni verifica fatta su quel confronto — comprese le dimensioni di pagina — non risponde alla domanda che conta.
>
> **Regola generale, da portarsi dietro:** il banco deve inforcare la catena **al primo stadio che il blocco tocca**, non all'ultimo. Se il blocco cambia il modello, si parte dalla scheda; se cambia il layout, si parte dal modello; se cambia solo il disegno, si parte dal layout.

- [ ] **Step 3: Verificare che gli otto casi partano verdi**

```bash
npx vitest run src/services/schemaImpianto/__tests__/banco.temp.test.ts > /tmp/d4-banco-partenza.txt 2>&1; echo "exit=$?"; tail -20 /tmp/d4-banco-partenza.txt
```

Atteso: `8 passed`. Un caso rosso qui significa che la copia non è allineata alla base, o che il layout del caso non è costruibile: si insegue prima di andare avanti.

- [ ] **Step 4: Provare che il banco discrimina — la mutazione finta**

Un banco che non si è visto fallire non prova nulla, esattamente come un test. La mutazione è una **sostituzione di stringa sull'uscita**, con una guardia che fallisce se la sostituzione non avviene — nel D2 la prima mutazione tentata (inserire codice dopo la firma) dava `no tests` per un errore di compilazione e non provava nulla, perché la graffa intercettata era quella di un parametro con valore predefinito.

Copiare il file **prima**:

```bash
cp src/services/schemaImpianto/renderSvg.ts /tmp/d4-renderSvg.bak
```

Poi, nel punto in cui `renderSvg` ritorna la stringa, sostituire il `return`:

```ts
  // MUTAZIONE TEMPORANEA — da togliere
  const mutato = svg.replace('<svg', '<svg data-mutazione="1"')
  if (mutato === svg) throw new Error('la mutazione non ha morso: la sostituzione non e avvenuta')
  return mutato
```

```bash
npx vitest run src/services/schemaImpianto/__tests__/banco.temp.test.ts > /tmp/d4-banco-mutato.txt 2>&1; echo "exit=$?"; grep -cE "×|✕" /tmp/d4-banco-mutato.txt
```

Atteso: **tutti e otto rossi**. Sette su otto significa che un caso non arriva a `renderSvg`, e quel caso non sta provando niente.

- [ ] **Step 5: Ripristinare, e riverificare il verde**

```bash
cp /tmp/d4-renderSvg.bak src/services/schemaImpianto/renderSvg.ts
git diff --stat src/services/schemaImpianto/renderSvg.ts
npx vitest run src/services/schemaImpianto/__tests__/banco.temp.test.ts 2>&1 | tail -5
```

Atteso: `git diff --stat` vuoto, `8 passed`.

- [ ] **Step 6: Nessun commit, ma l'albero va dichiarato**

```bash
git status --short
```

Atteso: `?? src/services/schemaImpianto-base/` e `?? src/services/schemaImpianto/__tests__/banco.temp.test.ts`, e **nient'altro di modificato**. Nel report: l'hash della base, i nomi degli otto casi, e la conferma della mutazione (otto rossi, poi otto verdi).

---

### Task 2: Il tratteggio delle condense ha una sola fonte (D4.3)

La coda del Blocco C1: `'8 6'` sulla tela contro `'10 7'` nel documento. **Vince il documento**, perché è quello che si consegna al cliente. Invece di correggere il numero in un punto, il numero diventa una costante esportata dai simboli e i tre punti che lo usano la leggono — stesso principio già applicato al carattere delle annotazioni (`TestiLiberi.tsx` legge `FONT` e `TESTO_LIBERO` invece di riscriverli), e per la stessa ragione: una divergenza corretta a mano si riapre alla prima modifica.

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (accanto a `TRATTO`, riga 20, e `campioneTubazione`, riga 181)
- Modify: `src/services/schemaImpianto/renderSvg.ts` (`renderLineaCondense`, riga 135)
- Modify: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` (riga 352)
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`

**Interfaces:**
- Produces: `export const TRATTEGGIO_CONDENSE = '10 7'` da `@/services/schemaImpianto/symbols`.

**Cosa NON tocca, e va lasciato stare:** `simboloUtenze` (riga 460) disegna il proprio codolo con `stroke-dasharray="10 7"`. È lo stesso numero per coincidenza, non la stessa cosa: quel tratteggio dice «la linea prosegue fuori dal disegno», non «questa è una condensa». Unificarlo sarebbe un commento falso scritto in codice.

- [ ] **Step 1: Scrivere il test che fallisce**

In `simboli.test.ts`, accanto ai test già presenti su `campioneTubazione`:

```ts
  // La tela (SchemaEdgeTubazione.tsx) e il documento devono tratteggiare le condense allo stesso
  // modo: fino al Blocco D4 la tela usava '8 6' e il documento '10 7', e su fondo nero la
  // differenza non si notava. Il test fissa la costante, non il numero scritto due volte.
  it('il campione di legenda delle condense usa la costante del tratteggio', () => {
    expect(campioneTubazione('condensa')).toContain(`stroke-dasharray="${TRATTEGGIO_CONDENSE}"`)
    expect(TRATTEGGIO_CONDENSE).toBe('10 7')
  })
```

- [ ] **Step 2: Eseguire il test e vederlo fallire**

```bash
npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts 2>&1 | tail -15
```

Atteso: FAIL, `TRATTEGGIO_CONDENSE` non definita.

- [ ] **Step 3: Introdurre la costante e i tre usi**

In `symbols/index.ts`, accanto a `TRATTO`:

```ts
/**
 * Tratteggio delle linee condense, unica fonte per il documento e per la tela dell'editor.
 * Fino al Blocco D4 il numero era scritto due volte con due valori diversi ('10 7' qui, '8 6' in
 * SchemaEdgeTubazione.tsx): finche' la tela era nera la differenza non si notava, su fondo bianco
 * il confronto con l'anteprima e' immediato. Non e' il tratteggio del codolo del terminale utenze
 * (`simboloUtenze`), che porta lo stesso numero per coincidenza e vuol dire un'altra cosa.
 */
export const TRATTEGGIO_CONDENSE = '10 7'
```

`campioneTubazione` (riga 181) e `renderLineaCondense` (`renderSvg.ts`, riga 135) interpolano la costante. In `SchemaEdgeTubazione.tsx` (riga 352):

```ts
          strokeDasharray: stile === 'condensa' ? TRATTEGGIO_CONDENSE : undefined,
```

aggiungendo `TRATTEGGIO_CONDENSE` all'import già presente da `@/services/schemaImpianto/symbols` (riga 15).

- [ ] **Step 4: Eseguire i test e vederli passare**

```bash
npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts 2>&1 | tail -8
npx tsc --noEmit 2>&1 | tail -5
```

Atteso: tutto verde, `tsc` senza uscita.

- [ ] **Step 5: Il banco deve restare tutto verde — è la prova che il documento non cambia**

Questo è il punto del task che vale davvero: nessun riferimento committato copre le linee condense (lo dice l'intestazione di `svgRiferimentoSenzaTesti.ts`), quindi **il pin non può accorgersi di un errore qui**. Il banco sì, perché il caso 4 le ha.

```bash
npx vitest run src/services/schemaImpianto/__tests__/banco.temp.test.ts 2>&1 | tail -5
```

Atteso: `8 passed`. Un caso rosso qui significa che la costante ha cambiato il documento, e va inseguito fino alla causa prima di committare.

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/renderSvg.ts src/components/schemaImpianto/SchemaEdgeTubazione.tsx src/services/schemaImpianto/__tests__/simboli.test.ts
git commit -m "fix(schema): il tratteggio delle condense e' uno solo, e vince il documento

La tela tratteggiava le linee condense a '8 6' e il documento a '10 7'.
Finche' la tela era nera la differenza non si notava; su fondo bianco il
confronto con l'anteprima e' immediato. Vince il documento, perche' e' quello
che si consegna, e il numero diventa una costante che i tre punti leggono
invece di riscriverla — stesso principio del carattere delle annotazioni.

Il documento non cambia di un byte: verificato sul banco di confronto degli
otto impianti, che a differenza dei riferimenti committati copre anche le
linee condense.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Il rettangolo bianco dentro valvola e riduttore (D4.1)

Il primo dei due cambiamenti al documento. Un rettangolo bianco dentro il simbolo, disegnato **prima** dei tratti, dimensionato esattamente sull'ingombro della farfalla e orientato con essa. Vale per la valvola di intercettazione e — gratis, perché `riduttorePressione` la costruisce sopra — per il riduttore.

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts:120-132` (`valvolaIntercettazione`)
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`
- Modify: `src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoSenzaTesti.ts`
- Modify: `src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts`

**Interfaces:**
- Consumes: il banco del Task 1, ancora montato.
- Produces: nessuna firma nuova. `valvolaIntercettazione(x, y, orientamento)` e `riduttorePressione(x, y, orientamento)` restano quelle.

**Il limite, dichiarato e non nascosto:** il rettangolo bianco cancella *tutto* ciò che ha sotto, non solo il tubo. Una valvola che capitasse esattamente sul muro divisorio gli farebbe un buco nel tratteggio. La mitigazione è il dimensionamento **esatto** sull'ingombro della farfalla, non un'unità di più. Nota di conforto già verificata nel codice: dove un tubo attraversa il muro c'è già un varco aperto di 44 unità (`simboloMuro`, `larghezzaVarco`), quindi nella pratica il caso si risolve quasi sempre da sé.

- [ ] **Step 1: Scrivere i test che falliscono**

In `simboli.test.ts`:

```ts
  // Osservazione 6 del committente: «la linea attraversa la valvola invece di interrompersi».
  // Il rettangolo bianco va PRIMA dei tratti, o coprirebbe la farfalla invece del tubo, ed e'
  // esattamente grande quanto la farfalla: ogni unita' in piu' e' disegno altrui cancellato.
  it('la valvola di intercettazione copre il tubo con un rettangolo bianco, prima dei tratti', () => {
    const svg = valvolaIntercettazione(100, 50)
    expect(svg.indexOf('fill="#fff"')).toBeLessThan(svg.indexOf('<path'))
    expect(svg).toContain('<rect x="91" y="42" width="18" height="16" fill="#fff" stroke="none" />')
  })

  it('il rettangolo bianco ruota con la farfalla sul montante', () => {
    expect(valvolaIntercettazione(100, 50, 'verticale')).toContain(
      '<rect x="92" y="41" width="16" height="18" fill="#fff" stroke="none" />'
    )
  })

  // Il riduttore non ha una copertura sua: costruisce sopra la valvola, quindi la eredita. Se un
  // giorno smettesse di farlo, questo test lo dice prima che lo dica il documento del cliente.
  it('il riduttore di pressione eredita la copertura della valvola', () => {
    expect(riduttorePressione(100, 50)).toContain('fill="#fff"')
  })
```

I numeri vengono da `l = 9`, `h = 8` della funzione: orizzontale `x-l = 91`, `y-h = 42`, `2l = 18`, `2h = 16`; verticale con `l` e `h` scambiati.

- [ ] **Step 2: Eseguire i test e vederli fallire**

```bash
npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts 2>&1 | tail -20
```

Atteso: tre FAIL, tutti per rettangolo assente.

- [ ] **Step 3: Implementare**

In `valvolaIntercettazione`, dopo il calcolo di `d` e prima del `return`:

```ts
  // Il tubo passa SOTTO la valvola e il disegno tecnico vuole che si interrompa: invece di
  // spezzare la polilinea a una lunghezza d'arco data — matematica fragile sui flessibili, che
  // non sono polilinee ma onde di curve quadratiche — la si copre con un rettangolo bianco
  // grande esattamente quanto la farfalla. Va PRIMA dei tratti, o coprirebbe la farfalla stessa.
  // Copre tutto cio' che ha sotto, non solo il tubo: e' il motivo per cui non e' un'unita' piu'
  // grande dell'ingombro.
  const [larghezza, altezza] = orientamento === 'orizzontale' ? [l, h] : [h, l]
  const copertura = `<rect x="${x - larghezza}" y="${y - altezza}" width="${larghezza * 2}" height="${altezza * 2}" fill="#fff" stroke="none" />`
  return copertura + traccia(d)
```

- [ ] **Step 4: Eseguire i test e vederli passare, poi provare che mordono**

```bash
npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts 2>&1 | tail -8
cp src/services/schemaImpianto/symbols/index.ts /tmp/d4-symbols.bak
```

Mutazione A: `return traccia(d) + copertura` (l'ordine sbagliato, che è l'errore plausibile) → il primo test deve cadere.
Mutazione B: `larghezza * 2 + 2` → il primo e il secondo devono cadere.

```bash
cp /tmp/d4-symbols.bak src/services/schemaImpianto/symbols/index.ts
```

- [ ] **Step 5: Leggere le differenze sul banco, una per una**

```bash
npx vitest run src/services/schemaImpianto/__tests__/banco.temp.test.ts > /tmp/d4-banco-t3.txt 2>&1; echo "exit=$?"; grep -E "✓|×|✕" /tmp/d4-banco-t3.txt
```

Attesi rossi: **i casi che hanno segni** — il 7 di sicuro, e ogni altro su cui `buildSchemaModel` semina una valvola di default sulle mandate flessibili. Verdi: i casi senza alcun segno. Se un caso **senza** segni è rosso, è un difetto, non un aggiornamento da accettare.

Scrivere i due SVG di un caso rosso su file (con una `writeFileSync` temporanea nel banco) e leggerli un elemento per riga:

```bash
sed 's/></>\n</g' /tmp/d4-t3-prima.svg > /tmp/d4-t3-prima.righe
sed 's/></>\n</g' /tmp/d4-t3-dopo.svg  > /tmp/d4-t3-dopo.righe
diff --strip-trailing-cr /tmp/d4-t3-prima.righe /tmp/d4-t3-dopo.righe > /tmp/d4-t3-differenza.txt; echo "exit=$?"; cat /tmp/d4-t3-differenza.txt
```

Le differenze ammesse sono **tre classi, e solo tre**:

1. Un `<rect ... fill="#fff" stroke="none" />` **davanti a** ogni farfalla di valvola e riduttore posata su un tubo.
2. Lo stesso rettangolo **nelle righe di legenda** della valvola e del riduttore: `righeLegenda` (`renderSvg.ts`, righe 241-245) le disegna con le stesse funzioni, e la legenda sta dentro l'SVG. È **atteso** ma va visto: su fondo bianco non si nota, e chi non lo prevedesse lo scambierebbe per una differenza non spiegata.
3. Nient'altro. **Nessuna coordinata di tubo, nessuna dimensione di pagina, nessuna riga di tabella deve muoversi**: il simbolo non è cresciuto, e `dimensioniLayout` non lo legge comunque.

Scrivere nel report l'elenco delle differenze lette, coi numeri.

- [ ] **Step 6: Ri-basare i due riferimenti committati**

Entrambi i riferimenti hanno una valvola (in `svgRiferimentoSenzaTesti.ts` è la riga `<path d="M 231 82 L 231 98 L 240 90 Z M 249 82 L 249 98 L 240 90 Z" …>`, la farfalla verticale sulla mandata), quindi entrambi i test cadono — ed è la prova che il pin fa il suo lavoro su questo cambiamento.

```bash
npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts 2>&1 | tail -10
```

Rigenerare **dal codice nuovo**, non ritoccando a mano il vecchio: rendere gli stessi layout dei due test (`layoutConTesti([])` e `layoutConTee()` in `renderSvg.test.ts`), spezzare un elemento per riga, sostituire gli array.

La riga «Generato l'ultima volta dal commit …» va aggiornata con l'hash del commit che contiene il cambiamento, **in un commit di seguito**. *Corretto il 15-08-2026: la prima stesura diceva «si committa, poi si corregge quella riga e si fa `git commit --amend`», che chiede una cosa impossibile — l'amend cambia l'hash, quindi la fixture citerebbe per costruzione un commit che non esiste più. È successo davvero, e l'hash pre-amend era raggiungibile solo dal reflog: l'intestazione della fixture rimanda al messaggio di quel commit, quindi l'istruzione era morta.*

- [ ] **Step 7: Suite intera e commit**

```bash
npx vitest run 2>&1 | tail -6
npx tsc --noEmit 2>&1 | tail -5
```

Atteso: 0 falliti. (Il banco gira insieme agli altri: finché non lo si smonta al Task 5 il conteggio dei file è 87, non 86.)

```bash
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/__tests__/simboli.test.ts src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoSenzaTesti.ts src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts
git commit -m "feat(schema): la linea si interrompe dentro valvole e riduttori

Osservazione 6 del committente. Un rettangolo bianco dentro il simbolo,
disegnato prima dei tratti e grande esattamente quanto la farfalla: il tubo
passa sotto e viene coperto, senza spezzare la polilinea a una lunghezza
d'arco data — matematica fragile proprio sui flessibili, che non sono
polilinee ma onde, e che sono gli archi su cui la valvola nasce di default.

Il riduttore la eredita perche' costruisce sopra la valvola.

Differenze sul documento, lette una per una sul banco degli otto impianti:
il rettangolo davanti a ogni farfalla posata su un tubo, e lo stesso
rettangolo nelle due righe di legenda che disegnano gli stessi simboli.
Nessuna coordinata di tubo e nessuna dimensione di pagina si e' mossa.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `muroDaAscissa` e i varchi condivisi (funzioni pure)

Prepara il terreno al Task 5 senza ancora cambiare il documento. Tre funzioni, tutte collaudabili senza montare nulla.

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts:75-109`
- Modify: `src/services/schemaImpianto/tratti.ts` (accoglie `quoteAttraversamento`)
- Modify: `src/services/schemaImpianto/renderSvg.ts:61-74` (la cede) e in fondo (espone `varchiDelMuro`)
- Test: `src/services/schemaImpianto/__tests__/layout.test.ts`, `.../tratti.test.ts`, `.../renderSvg.test.ts`

**Interfaces:**
- Produces:
  - `export function muroDaAscissa(x: number, nodi: SchemaNodoPosizionato[]): SchemaMuroSeparazione | null` (`layout.ts`)
  - `export function quoteAttraversamento(punti: Punto[], x: number): number[]` (`tratti.ts`)
  - `export function varchiDelMuro(layout: SchemaLayout): number[]` (`renderSvg.ts`)
- `calcolaMuro` resta esportata con la firma di oggi.

**La decisione di progetto, e perché:** del muro si salva **la sola ascissa**. L'estensione verticale si ricava al disegno dall'inviluppo delle apparecchiature, come già oggi. Salvare anche l'altezza creerebbe una seconda fonte di verità destinata a divergere al primo nodo spostato — la stessa classe di errore per cui esiste la nota su `posizioneAncora`. `muroDaAscissa` e `calcolaMuro` condividono quindi **lo stesso** inviluppo, estratto in un aiutante privato: due regole diverse su «cosa il muro deve separare» sarebbero di nuovo due fonti.

- [ ] **Step 1: Scrivere i test che falliscono**

In `layout.test.ts`, accanto al `describe` di `calcolaMuro`:

```ts
  describe('muroDaAscissa', () => {
    // Dal Blocco D4 il muro e' un oggetto del committente e di lui si salva la sola ascissa:
    // l'altezza continua ad adattarsi al disegno, e salvarla sarebbe una seconda fonte di verita'.
    it('tiene l ascissa data e ricava l altezza dall inviluppo, col margine di calcolaMuro', () => {
      const compressore = { ...base, id: 'C1', gruppo: 'SALA_COMPRESSORI', tipo: 'compressore', x: 40, y: 200 }
      const serbatoio = { ...base, id: 'S1', gruppo: 'LINEA_DISTRIBUZIONE', tipo: 'serbatoio', x: 400, y: 100 }
      const muro = muroDaAscissa(333, [compressore, serbatoio])
      expect(muro.x).toBe(333)
      expect(muro.yMin).toBe(100 - MARGINE_SUPERIORE / 2)
      expect(muro.yMax).toBe(200 + DIMENSIONI_NODO.compressore.altezza + MARGINE_SUPERIORE / 2)
    })

    // Il terminale utenze e' un raccordo, non un'apparecchiatura da separare: stessa esclusione di
    // calcolaMuro, e per la stessa ragione — due regole diverse sarebbero di nuovo due fonti.
    it('non lascia che il terminale utenze allarghi l inviluppo', () => {
      const compressore = { ...base, id: 'C1', gruppo: 'SALA_COMPRESSORI', tipo: 'compressore', x: 40, y: 200 }
      const utenze = { ...base, id: 'UTENZE', gruppo: 'LINEA_DISTRIBUZIONE', tipo: 'utenze', x: 900, y: 900 }
      expect(muroDaAscissa(333, [compressore, utenze])).toEqual(muroDaAscissa(333, [compressore]))
    })

    // Un disegno senza apparecchiature non ha inviluppo: un muro alto zero, o alto quanto il
    // margine, sarebbe un segno nel vuoto.
    it('non produce un muro se non c e nulla da separare', () => {
      expect(muroDaAscissa(333, [])).toBeNull()
    })
  })
```

In `tratti.test.ts`:

```ts
  // Trasferita qui da renderSvg.ts nel Blocco D4: la tela dell'editor deve aprire i varchi con la
  // STESSA funzione del documento, e per importarla non puo' dipendere dal modulo che rende l'SVG.
  describe('quoteAttraversamento', () => {
    it('trova le quote dei tratti orizzontali che scavalcano la verticale', () => {
      const punti = [{ x: 0, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 90 }, { x: 200, y: 90 }]
      expect(quoteAttraversamento(punti, 50)).toEqual([10])
      expect(quoteAttraversamento(punti, 150)).toEqual([90])
    })

    it('non conta un tratto verticale, che il muro non lo attraversa mai', () => {
      expect(quoteAttraversamento([{ x: 50, y: 0 }, { x: 50, y: 100 }], 50)).toEqual([])
    })
  })
```

In `renderSvg.test.ts`:

```ts
  // `varchiDelMuro` esiste perche' la tela dell'editor apra i varchi con la funzione del
  // documento e non con una copia: e' la stessa `renderArchi` che rende l'SVG, di cui si tiene
  // solo l'altra meta' del risultato.
  it('varchiDelMuro riporta le quote a cui i tubi attraversano il muro', () => {
    const layout = layoutConMuro()
    const varchi = varchiDelMuro(layout)
    expect(varchi.length).toBeGreaterThan(0)
    // Il varco non e' solo calcolato: e' davvero aperto nel muro disegnato (larghezzaVarco/2 = 22).
    for (const y of varchi) expect(renderSvg(layout)).toContain(`y="${y - 22}"`)
  })
```

`layoutConMuro()` si scrive accanto alle altre fixture del file: un impianto con `muro` valorizzato e **almeno due** tubazioni che ne scavalcano l'ascissa (due servono al Task 6, che riusa questa stessa fixture per il pin e deve coprire anche la fusione dei varchi vicini).

- [ ] **Step 2: Eseguire i test e vederli fallire**

```bash
npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts src/services/schemaImpianto/__tests__/tratti.test.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts 2>&1 | tail -20
```

Atteso: FAIL per funzioni non definite.

- [ ] **Step 3: Implementare**

In `layout.ts`, estrarre l'inviluppo che `calcolaMuro` calcola già e farlo usare a entrambe:

```ts
/**
 * Inviluppo verticale delle apparecchiature che un muro separa, allargato sopra e sotto dello
 * stesso margine usato sopra le apparecchiature nel resto del disegno. Il terminale utenze non
 * conta: e' un raccordo, non qualcosa da separare (stesso motivo per cui `ordinaCatenaTrattamento`
 * e `pozzoCondense` lo ignorano). Uno solo per `calcolaMuro` e `muroDaAscissa`, o «cosa il muro
 * deve separare» tornerebbe ad avere due definizioni.
 */
function inviluppoVerticale(nodi: SchemaNodoPosizionato[]): { yMin: number; yMax: number } | null {
  const rilevanti = nodi.filter((n) => n.tipo !== 'utenze')
  if (rilevanti.length === 0) return null
  return {
    yMin: Math.min(...rilevanti.map((n) => n.y)) - MARGINE_SUPERIORE / 2,
    yMax: Math.max(...rilevanti.map((n) => n.y + DIMENSIONI_NODO[n.tipo].altezza)) + MARGINE_SUPERIORE / 2,
  }
}

/**
 * Il muro dalla sola ascissa salvata. Dal Blocco D4 il muro e' un oggetto che il committente
 * aggiunge e sposta, ma la sua altezza continua ad adattarsi al disegno: si salva la sola `x`, e
 * l'estensione verticale si ricava qui a ogni ricostruzione. Salvare anche l'altezza sarebbe una
 * seconda fonte di verita', destinata a divergere al primo nodo spostato.
 */
export function muroDaAscissa(x: number, nodi: SchemaNodoPosizionato[]): SchemaMuroSeparazione | null {
  const inviluppo = inviluppoVerticale(nodi)
  return inviluppo ? { x, ...inviluppo } : null
}
```

`calcolaMuro` conserva la propria regola sui due gruppi (serve ancora: dal Task 7 propone l'ascissa al pulsante della barra) e per l'altezza chiama `inviluppoVerticale([...inSala, ...inLinea])`. Il suo commento di testa va **accorciato**, non precisato — la frase «si disegna solo se…» descriveva un muro che si disegnava da sé, e dal Task 5 non è più vero:

> «Ascissa **proposta** per il muro di separazione, dal bordo destro della sala compressori. Dal Blocco D4 nessun percorso automatico la usa per disegnare: la usa il pulsante della barra, che propone un punto sensato e lascia decidere.»

`quoteAttraversamento` si sposta in `tratti.ts` **identica**, con `export`, e `renderSvg.ts` la importa da lì. In `renderSvg.ts`, accanto alla funzione principale:

```ts
/**
 * Le quote a cui le tubazioni attraversano il muro, per chi deve disegnarlo senza rendere tutto
 * l'SVG — la tela dell'editor (`MuroSeparazione.tsx`). E' la stessa `renderArchi` del documento,
 * di cui si tiene l'altra meta' del risultato: una copia della sua logica di instradamento
 * aprirebbe sulla tela varchi in punti diversi da quelli del .docx consegnato.
 */
export function varchiDelMuro(layout: SchemaLayout): number[] {
  return renderArchi(layout, quoteInstradamento(layout)).varchi
}
```

- [ ] **Step 4: Eseguire i test e vederli passare, poi provare che mordono**

```bash
npx vitest run src/services/schemaImpianto/__tests__/layout.test.ts src/services/schemaImpianto/__tests__/tratti.test.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts 2>&1 | tail -10
cp src/services/schemaImpianto/layout.ts /tmp/d4-layout.bak
cp src/services/schemaImpianto/tratti.ts /tmp/d4-tratti.bak
```

Mutazioni (ripristino con `cp`, **mai** `git checkout`: i due file sono tracciati e l'implementazione andrebbe persa insieme alla mutazione):

1. `muroDaAscissa` ignora `x` e usa `0` → il primo test deve cadere.
2. `inviluppoVerticale` perde il filtro su `'utenze'` → il secondo test deve cadere. **Guardare anche i test esistenti di `calcolaMuro`**: se restano tutti verdi, quel filtro non era coperto nemmeno prima, e va detto nel report.
3. In `quoteAttraversamento`, `a.y === b.y` → `a.x === b.x` → i due test di `tratti.test.ts` devono cadere.

- [ ] **Step 5: Il documento non è cambiato — banco e suite**

```bash
npx vitest run src/services/schemaImpianto/__tests__/banco.temp.test.ts 2>&1 | tail -5
npx vitest run 2>&1 | tail -6
npx tsc --noEmit 2>&1 | tail -5
```

Atteso: banco `8 passed` (questo task **non** cambia il documento: sposta funzioni e ne aggiunge), suite verde.

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/layout.ts src/services/schemaImpianto/tratti.ts src/services/schemaImpianto/renderSvg.ts src/services/schemaImpianto/__tests__/layout.test.ts src/services/schemaImpianto/__tests__/tratti.test.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts
git commit -m "feat(schema): il muro sa ricostruirsi dalla sola ascissa

Prepara il muro manuale del Blocco D4 senza ancora cambiare il documento.

`muroDaAscissa` tiene la x che le viene data e ricava l'altezza
dall'inviluppo corrente delle apparecchiature: del muro si salvera' la sola
ascissa, perche' l'altezza continua ad adattarsi al disegno e salvarla
sarebbe una seconda fonte di verita' destinata a divergere. L'inviluppo e'
estratto e condiviso con `calcolaMuro`, per non avere due definizioni di
cosa il muro debba separare.

`quoteAttraversamento` passa in tratti.ts e `varchiDelMuro` la espone al
resto: la tela dovra' aprire i varchi con la funzione del documento, non
con una copia.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Il muro esce dai percorsi automatici e si salva (D4.2, parte servizi)

Il cambiamento più invasivo del blocco. Da qui in poi **ogni pratica smette di avere il muro** finché il committente non lo aggiunge.

**Files:**
- Modify: `src/services/schemaImpianto/layout.ts:187` (`layoutSchema`)
- Modify: `src/services/schemaImpianto/persistenza.ts:6, 14-33, 48-52, 252`
- Modify: `src/components/schemaImpianto/conversioneFlow.ts:55-95` (`flowALayout`)
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (il solo chiamante di `flowALayout`)
- Test: `src/services/schemaImpianto/__tests__/persistenza.test.ts`, `.../layout.test.ts`
- Modify: le due fixture `svgRiferimento*.ts`
- Delete: il banco e la copia dei servizi

**Interfaces:**
- Consumes: `muroDaAscissa` dal Task 4.
- Produces: `LayoutSalvato.muroX?: number`; `flowALayout(nodes, edges, testi, muroX)` — quarto parametro **obbligatorio**, `number | null`.

**Perché il quarto parametro è obbligatorio e non ha un valore predefinito:** è la stessa ragione per cui `testi` lo è. Con `strict: false`, un valore predefinito lascerebbe passare in silenzio un chiamante che dimentica il muro — ed è esattamente il difetto per cui `SchemaLayout.testi` è stato reso obbligatorio nel Blocco C2, scoperto perché `flowALayout` (un percorso di produzione, non un test) perdeva le annotazioni di un disegno riaperto.

**Perché non serve alzare `VERSIONE`:** `muroX` è un campo nuovo e opzionale, non un cambio di formato — stesso trattamento di `testi`. Un salvataggio scritto prima di questo blocco non ce l'ha, e alla riapertura risulterà **senza muro**: che è precisamente il comportamento chiesto dal committente, non una perdita di dati. Alzare la versione, al contrario, butterebbe via l'intero layout salvato di ogni pratica.

- [ ] **Step 1: Scrivere i test che falliscono**

In `persistenza.test.ts`:

```ts
  // Dal Blocco D4 il muro e' un oggetto del committente: si salva la sua ascissa, e l'altezza si
  // ricava al disegno. Un salvataggio scritto prima non ha `muroX` e si riapre senza muro — che
  // e' cio' che il committente ha chiesto («di default non va disegnato»), non una perdita.
  it('salva del muro la sola ascissa', () => {
    const layout = { ...layoutMinimo(), muro: { x: 333, yMin: 10, yMax: 900 } }
    const salvato = serializzaLayout(layout)
    expect(salvato.muroX).toBe(333)
    expect(JSON.stringify(salvato)).not.toContain('yMin')
  })

  it('ricostruisce il muro dall ascissa salvata, con l altezza di adesso', () => {
    const salvato = { ...serializzaLayout(layoutMinimo()), muroX: 333 }
    const riletto = deserializzaLayout(salvato)
    expect(riletto.muro).toEqual(muroDaAscissa(333, salvato.nodi))
    expect(riletto.muro.x).toBe(333)
  })

  it('un salvataggio senza ascissa del muro si riapre senza muro', () => {
    expect(deserializzaLayout(serializzaLayout(layoutMinimo())).muro).toBeNull()
  })

  // Il muro e' manuale per definizione, quindi sta nella stessa categoria dei nodi 'manuale' e
  // delle annotazioni: la scheda dati non lo conosce e non ha titolo per cancellarlo.
  it('la riconciliazione con la scheda non porta via il muro', () => {
    const salvato = { ...serializzaLayout(layoutMinimo()), muroX: 333 }
    expect(riconcilia(salvato, modelloMinimo()).layout.muro.x).toBe(333)
  })
```

**Attenzione alla fixture del terzo test:** `layoutMinimo()` deve avere apparecchiature in **entrambi** i gruppi, altrimenti quel test resterebbe verde anche con la vecchia `calcolaMuro` (che su un solo gruppo restituiva già `null`) e passerebbe per la ragione sbagliata. Se non le ha, si estende — ed è la stessa verifica che la mutazione 2 dello Step 4 impone.

In `layout.test.ts`:

```ts
  // Osservazione 8 del committente: «di default non va disegnato, lo aggiungo solo se serve».
  // Da qui in poi ogni pratica nasce senza muro — la conseguenza piu' visibile del Blocco D4.
  it('l auto-layout non disegna piu il muro', () => {
    expect(layoutSchema(modelloConSalaELinea()).muro).toBeNull()
  })
```

- [ ] **Step 2: Eseguire i test e vederli fallire**

```bash
npx vitest run src/services/schemaImpianto/__tests__/persistenza.test.ts src/services/schemaImpianto/__tests__/layout.test.ts 2>&1 | tail -20
```

Atteso: cinque FAIL.

- [ ] **Step 3: Implementare**

`layoutSchema` (riga 187): `muro: null`, col commento che dice perché — «Dal Blocco D4 il muro e' un oggetto del committente, non un derivato: nasce solo quando lo aggiunge dalla barra».

`persistenza.ts`:

```ts
export interface LayoutSalvato {
  versione: number
  nodi: SchemaNodoPosizionato[]
  archi: SchemaArco[]
  testi?: SchemaTestoLibero[]
  /**
   * Ascissa del muro di separazione. Assente: nessun muro — il caso di ogni salvataggio scritto
   * prima del Blocco D4, e di ogni pratica finche' il committente non lo aggiunge. Campo nuovo e
   * opzionale, non un cambio di formato: per questo non alza `VERSIONE`, che invece butterebbe
   * via l'intero layout salvato. Del muro si salva SOLO l'ascissa: l'altezza si ricava al disegno
   * (`muroDaAscissa`, layout.ts).
   */
  muroX?: number
}
```

`serializzaLayout`: `...(layout.muro ? { muroX: layout.muro.x } : {})` — il campo si **omette** invece di scrivere `undefined`, così il JSON persistito resta pulito.

`deserializzaLayout`: `muro: typeof salvato.muroX === 'number' ? muroDaAscissa(salvato.muroX, salvato.nodi) : null`.

`riconcilia` (riga 252): stessa espressione, sui `nodi` riconciliati, col commento sul perché sopravvive — sulla falsariga di quello dei testi due righe sopra.

L'intestazione del file (riga 6) dice oggi «Il muro non si salva — è derivato dalle posizioni e si ricalcola»: è diventata falsa e va **riscritta**, non ampliata → «Del muro si salva la sola ascissa: l'altezza resta derivata dalle posizioni».

`conversioneFlow.ts`, `flowALayout`: quarto parametro `muroX: number | null`, e `muro: muroX === null ? null : muroDaAscissa(muroX, nodi)`. Il commento di testa dice oggi «Il muro non è modificabile nell'editor, ma la sua posizione sì»: falso da questo task, e va **accorciato** → «Il muro arriva dallo stato dell'editor come sola ascissa, e riprende qui l'altezza dal disegno corrente». Il chiamante in `SchemaEditor.tsx` (`layoutCorrente`) passa `null` per ora: il Task 8 gli darà lo stato vero.

- [ ] **Step 4: Eseguire i test e vederli passare, poi provare che mordono**

```bash
npx vitest run src/services/schemaImpianto/__tests__/persistenza.test.ts src/services/schemaImpianto/__tests__/layout.test.ts 2>&1 | tail -10
cp src/services/schemaImpianto/persistenza.ts /tmp/d4-persistenza.bak
```

Mutazioni (ripristino con `cp`):
1. `serializzaLayout` scrive anche `muroYMin: layout.muro?.yMin` → il primo test deve cadere.
2. `deserializzaLayout` ignora `salvato.muroX` e usa `calcolaMuro(salvato.nodi)` → il secondo **e** il terzo devono cadere. Se il terzo resta verde, la fixture non ha entrambi i gruppi popolati e il test non stava provando ciò che dice: correggere la fixture, non la mutazione.
3. `riconcilia` torna a `calcolaMuro(nodi)` → il quarto deve cadere.

- [ ] **Step 5: Leggere le differenze sul banco, una per una**

```bash
npx vitest run src/services/schemaImpianto/__tests__/banco.temp.test.ts > /tmp/d4-banco-t5.txt 2>&1; echo "exit=$?"; grep -E "✓|×|✕" /tmp/d4-banco-t5.txt
```

Atteso: **rossi tutti i casi che il muro ce l'avevano** (quelli con apparecchiature in entrambi i gruppi: sicuramente il 2, il 5 e l'8), verdi gli altri. Il caso 8 è quello da leggere per esteso, perché ha tre varchi:

```bash
sed 's/></>\n</g' /tmp/d4-t5-prima.svg > /tmp/d4-t5-prima.righe
sed 's/></>\n</g' /tmp/d4-t5-dopo.svg  > /tmp/d4-t5-dopo.righe
diff --strip-trailing-cr /tmp/d4-t5-prima.righe /tmp/d4-t5-dopo.righe > /tmp/d4-t5-differenza.txt; echo "exit=$?"; cat /tmp/d4-t5-differenza.txt
```

Le differenze ammesse sono **due classi, e solo due**:

1. La **scomparsa** dell'intero gruppo del muro: i `<rect>` dei tronconi e i `<path>` del tratteggio a 45°. Nessun residuo.
2. Nient'altro. In particolare **le dimensioni della pagina non devono cambiare**: verificare `width`/`height`/`viewBox` sulla prima riga dei due file. Se cambiano, `dimensioniLayout` teneva conto del muro e la sua scomparsa ha ristretto il disegno — sarebbe un effetto vero e da capire, non da accettare.

Nessuna tubazione, nessun simbolo, nessuna riga di tabella o legenda deve muoversi.

- [ ] **Step 6: Ri-basare i due riferimenti, e smontare il banco**

Stessa disciplina del Task 3: rigenerare dal codice nuovo, un elemento per riga, e aggiornare la riga «Generato l'ultima volta dal commit …» **in un commit di seguito** — vedi la nota sull'hash nel Task 3, Step 6: un `--amend` cambia l'hash e la fixture finirebbe a citare un commit che non esiste più.

L'intestazione di `svgRiferimentoSenzaTesti.ts` dice: «Non intercetta quindi un cambiamento che tocchi solo il muro di separazione o le linee condense: nessuno dei due compare in questo disegno.» Resta **vera** e va lasciata così: sarà il Task 6 a coprire il muro, con una fixture sua.

```bash
rm -rf src/services/schemaImpianto-base /tmp/d4-estratto
rm -f src/services/schemaImpianto/__tests__/banco.temp.test.ts
npx vitest run 2>&1 | tail -6
npx tsc --noEmit 2>&1 | tail -5
git status --short
```

Atteso: suite verde e di nuovo su **86 file**, `git status` che mostra solo i file di questo task — nessun residuo di impalcatura.

- [ ] **Step 7: Commit**

```bash
git add src/services/schemaImpianto/layout.ts src/services/schemaImpianto/persistenza.ts src/components/schemaImpianto/conversioneFlow.ts src/components/schemaImpianto/SchemaEditor.tsx src/services/schemaImpianto/__tests__/persistenza.test.ts src/services/schemaImpianto/__tests__/layout.test.ts src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoSenzaTesti.ts src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts
git commit -m "feat(schema): il muro non si disegna piu' da solo

Osservazione 8 del committente: «di default non va disegnato, lo aggiungo
solo se serve». `calcolaMuro` esce da tutti i percorsi automatici —
auto-layout, rilettura del salvataggio, riconciliazione con la scheda,
conversione dall'editor — e resta solo come proposta di ascissa per il
pulsante che arrivera' con la tela.

Del muro si salva la sola ascissa (`LayoutSalvato.muroX`, campo nuovo e
opzionale: non alza VERSIONE, che butterebbe via i layout salvati).
L'altezza continua ad adattarsi al disegno.

CONSEGUENZA DA DICHIARARE: da questo commit ogni pratica si apre senza
muro, incluse quelle gia' salvate, finche' il committente non lo aggiunge.

Differenze sul documento, lette una per una sul banco degli otto impianti:
la sola scomparsa del gruppo del muro. Le dimensioni della pagina non sono
cambiate, e nessuna tubazione si e' mossa.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

> **Misurato il 15-08-2026: la prima lettura del banco (Step 5 sopra) era cieca, e la scomparsa del muro è stata poi osservata davvero.** Nota che porta i numeri alla diagnosi strutturale del Task 1 qui sopra («il banco deve inforcare la catena al primo stadio che tocca»).
>
> La prima esecuzione di questo Step 5 costruiva il layout **una sola volta**, con l'attuale `layoutSchema` (già senza muro dal Task 3 del piano di implementazione), e passava **lo stesso oggetto** sia a `renderSvg` sia a `renderSvgPrima`. Il muro non arrivava mai a nessuno dei due lati: la scomparsa del muro — il cambiamento più pervasivo del blocco — non era misurata da nulla, e nemmeno il confronto sulle dimensioni di pagina era una domanda vera (due renderer sullo stesso input, ovviamente uguali). Il commit `5cfe586` porta ancora, nel suo messaggio, la conseguenza di quella misura cieca («Differenze sul documento… nessuna oltre al rettangolo bianco già noto») — non riscritta all'indietro apposta, perché cancellarla renderebbe la storia meno vera, non più pulita.
>
> Il banco è stato rimontato con le due catene **separate fino in fondo** — modello (`buildSchemaModel`), layout (`layoutSchema`) e render (`renderSvg`), ognuna dalla propria versione (`schemaImpianto/` per "dopo", `schemaImpianto-base/` per "prima") — e **provato discriminante prima di fidarsene**: un confronto diretto fra le due pipeline vere, non mutate, e una sostituzione di stringa sull'uscita di `renderSvg` con guardia che avrebbe fallito se non avesse morso. Su entrambi i casi verificati (5 e 8, gli unici due — fra gli otto originali — con un'apparecchiatura esplicita in `LINEA_DISTRIBUZIONE`), entrambe le prove hanno confermato che le due pipeline producono output davvero diversi.
>
> **Un avvertimento su cosa "caso 5" e "caso 8" significano qui, e non nel banco del Task 1.** Ogni pipeline riparte **dalla scheda dati** (`buildSchemaModel` → `layoutSchema` → `renderSvg`), non da un `SchemaLayout` scritto a mano: è la correzione strutturale stessa. Il caso 5 coincide con l'esemplare del Task 1, perché la scheda lo esprime per intero. Il caso 8 **no**: il Task 1 lo definiva come «tre tubi che attraversano il muro **più due annotazioni libere**» (`testi`), aggiunte a mano dopo `layoutSchema` — cosa che una scheda non può portare, perché `layoutSchema` produce sempre `testi: []`. L'esemplare qui misurato è quindi il caso 8 **senza** quelle due annotazioni. I gomiti a mano che forzano tre quote di attraversamento distinte (`arco.punti` su C2→S1 e C3→S1, la stessa configurazione del Task 1) **sono stati riprodotti** su entrambi i lati, perché quelli un chiamante del layout può ancora imporli dopo la costruzione, senza bisogno di un `testi` che la scheda non dà.
>
> **Esito vero, letto riga per riga (`diff --strip-trailing-cr` su SVG spezzati un elemento per riga):**
> - **Caso 5** (due compressori, un serbatoio in linea — un attraversamento): spariscono **2 tronconi** (`<rect>`, spessore 14) e **1 tratteggio** (`<path stroke-width="1">` a 45°). Compaiono 3 `<rect fill="#fff" stroke="none">`, il rettangolo bianco del Task 3, già noto. Nient'altro: 87 righe totali su entrambi i lati (3 tolte, 3 messe).
> - **Caso 8** (tre compressori sullo stesso serbatoio in linea, coi gomiti a mano che impongono tre attraversamenti a quote diverse — senza le due annotazioni, per la ragione appena detta): spariscono **4 tronconi** e **1 tratteggio**, cioè **3 varchi** (quattro tronconi pieni separati da tre aperture — verificato contando i `<rect>` di spessore 14 rimasti nel lato "prima": 4, non 2). Compaiono 4 `<rect fill="#fff" stroke="none">`, sempre il rettangolo bianco del Task 3. Nient'altro: 101 righe "prima", 100 "dopo" (5 tolte, 4 messe).
> - **Dimensioni di pagina: invariate su entrambi i lati, per ciascun caso.** Caso 5: `width="1000" height="796" viewBox="0 0 1000 796"` identico prima/dopo. Caso 8 (senza le due annotazioni, come misurato qui): `width="1220" height="830" viewBox="0 0 1220 830"` identico prima/dopo — **diverso** dagli `1220×940` di una prima lettura ancora precedente a questa nota, che aveva usato l'esemplare del Task 1 con le due annotazioni incluse. Verificato che la causa è **quella**, non i gomiti: rifacendo il caso 8 senza annotazioni ma con gli stessi gomiti l'altezza resta 830 su entrambi i lati (con o senza gomiti, `dimensioniLayout` non li legge affatto — non dipendono da `layout.archi`); rimettendo le due annotazioni (`testi: [{y:40,...}, {y:480,...}]`) sullo stesso layout, la riga `<svg>` torna a `height="940"`. La conclusione sul muro non dipende in nessun modo da questo: `calcolaMuro` e `muroDaAscissa` non leggono mai `layout.testi`, e `dimensioniLayout` (layout.ts) calcola `maxX`/`maxY` solo da `layout.nodi` e `layout.testi` — mai da `layout.muro` — quindi la sua presenza o assenza non sposta la pagina in nessuno dei due casi.
> - **Nessuna tubazione si è mossa.** Nessuna riga di diff contiene `marker-end="url(#freccia)"` (la firma di un tratto di tubazione). I varchi spariscono **insieme** ai tronconi — non hanno una voce propria nel diff, perché sono gli spazi vuoti fra un troncone e l'altro, e quello spazio sparisce quando sparisce il muro intero — ma i tubi che li attraversavano restano bit-identici fra le due versioni.
>
> Nessun cambiamento di codice è scaturito da questa misura: la conclusione sul comportamento (solo il muro sparisce, nient'altro si muove) era già giusta, semplicemente non era ancora stata osservata da nulla.

---

### Task 6: Il riferimento committato copre anche il muro

Chiude il punto 5 della procedura di verifica della spec: «estendere la copertura del pin al muro, o annotare esplicitamente che resta scoperto — se il muro esce dal disegno senza che nulla se ne accorga, il prossimo blocco lavora senza rete su un elemento appena diventato modificabile a mano». Si estende, non si annota: il muro è appena diventato l'elemento più esposto del disegno.

**Files:**
- Create: `src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConMuro.ts`
- Modify: `src/services/schemaImpianto/__tests__/renderSvg.test.ts`

**Interfaces:**
- Consumes: `layoutConMuro()`, la fixture scritta al Task 4.
- Produces: `RIGHE_SVG_RIFERIMENTO_CON_MURO: string[]` e `SVG_RIFERIMENTO_CON_MURO: string` — la stessa coppia esportata dalle due fixture esistenti (leggerle e imitarle esattamente).

- [ ] **Step 1: Scrivere il test, che fallisce perché la fixture non esiste**

In `renderSvg.test.ts`, accanto agli altri due test di riferimento e con lo stesso taglio:

```ts
  // Riferimento ESTERNO al codice corrente, non un self-comparison. Copre l'unico elemento che
  // gli altri due non toccano: il muro, e con lui i varchi che le tubazioni gli aprono. Dal
  // Blocco D4 il muro e' modificabile a mano, quindi e' l'elemento piu' esposto del disegno, e
  // senza questo pin la sua scomparsa da un impianto passerebbe inosservata.
  it('un impianto col muro resta identico al riferimento', () => {
    expect(renderSvg(layoutConMuro())).toBe(SVG_RIFERIMENTO_CON_MURO)
  })
```

Verificare che `layoutConMuro()` copra **almeno due varchi**: con uno solo il pin non vedrebbe la fusione dei varchi vicini di `simboloMuro`. Se ne copre uno, estenderla.

- [ ] **Step 2: Eseguire e vedere fallire**

```bash
npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts 2>&1 | tail -10
```

Atteso: FAIL, modulo non trovato.

- [ ] **Step 3: Generare la fixture dal codice nuovo**

Sul modello **esatto** di `svgRiferimentoSenzaTesti.ts`: intestazione che dice cosa copre e cosa no, la disciplina dell'elemento per riga, il paragrafo su quando è legittimo aggiornarlo, e la riga «Generato l'ultima volta dal commit …». Generare rendendo `layoutConMuro()` col codice corrente e spezzando un elemento per riga — mai comporre a mano.

- [ ] **Step 4: Eseguire e vedere passare**

```bash
npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts 2>&1 | tail -8
cp src/services/schemaImpianto/symbols/index.ts /tmp/d4-symbols-t6.bak
```

- [ ] **Step 5: Provare che il riferimento nuovo discrimina**

Non basta che sia verde: va provato che **si accorge** del muro. Due mutazioni in `simboloMuro`:

1. `const spessore = 14` → `16`. Il test nuovo deve cadere; gli **altri due riferimenti devono restare verdi** (non hanno muro).
2. `const larghezzaVarco = 44` → `40`. Il test nuovo deve cadere — è la prova che il pin copre i varchi e non solo la muratura.

```bash
npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts > /tmp/d4-t6-mut.txt 2>&1; echo "exit=$?"; grep -E "✓|×|✕" /tmp/d4-t6-mut.txt
cp /tmp/d4-symbols-t6.bak src/services/schemaImpianto/symbols/index.ts
```

- [ ] **Step 6: Suite intera e commit**

```bash
npx vitest run 2>&1 | tail -6
git add src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConMuro.ts src/services/schemaImpianto/__tests__/renderSvg.test.ts
git commit -m "test(schema): il riferimento SVG copre anche il muro e i suoi varchi

Nessuno dei due riferimenti committati intercettava il muro — annotato
nell'intestazione del piu' vecchio — proprio mentre il Blocco D4 lo rendeva
l'elemento piu' esposto del disegno, aggiungibile e cancellabile a mano.

Provato discriminante su due mutazioni: lo spessore della muratura e la
larghezza del varco. Gli altri due riferimenti restano verdi sotto le stesse
mutazioni, come devono: il muro non compare nei loro impianti.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `useMuro` — aggiungere, spostare e togliere il muro (funzioni pure + hook)

La logica dell'editor, isolata come `useTestiLiberi.ts`, `useGomiti.ts`, `useSegniTubo.ts` e `useTrascinamentoTratto.ts` — e per lo stesso duplice motivo: non far crescere `SchemaEditor.tsx`, e perché questo modulo non monta componenti React nei test (`CLAUDE.md`, «no UI test»), quindi tutto ciò che va provato deve stare in funzioni pure fuori dall'hook.

**Files:**
- Create: `src/components/schemaImpianto/useMuro.ts`
- Create: `src/components/schemaImpianto/__tests__/useMuro.test.ts`

**Interfaces:**
- Consumes: `calcolaMuro`, `DIMENSIONI_NODO` (`layout.ts`), `allineaAllaGriglia`, `PASSO_GRIGLIA` (`griglia.ts`).
- Produces:
  - `export function ascissaProposta(nodi: SchemaNodoPosizionato[]): number`
  - `export function ascissaSpostata(x: number): number`
  - `export interface StatoConMuro { muroX: number | null }`
  - `export function useMuro<T extends StatoConMuro>(applica, aggiornaSenzaCronologia): { aggiungiMuro, spostaMuro, rimuoviMuro }`
  - `aggiungiMuro(proposta: (corrente: T) => number): void` · `spostaMuro(x: number, concluso: boolean): void` · `rimuoviMuro(): void`

- [ ] **Step 1: Scrivere i test che falliscono**

```ts
import { describe, expect, it } from 'vitest'
import { calcolaMuro, DIMENSIONI_NODO } from '@/services/schemaImpianto/layout'
import { PASSO_GRIGLIA } from '@/services/schemaImpianto/griglia'
import { ascissaProposta, ascissaSpostata } from '../useMuro'

describe('ascissaProposta', () => {
  // Il pulsante della barra non chiede al committente dove mettere il muro: lo propone dove
  // stava prima che diventasse manuale — il bordo destro della sala compressori — e lo lascia
  // spostare. E' l'unico uso rimasto di `calcolaMuro`.
  it('propone il bordo destro della sala compressori, come faceva il muro automatico', () => {
    const nodi = [compressoreIn(40), serbatoioInLinea(600)]
    expect(ascissaProposta(nodi)).toBe(calcolaMuro(nodi).x)
  })

  // Un disegno con la sola sala, o con la sola linea, non ha un bordo fra i due gruppi: il muro
  // nasce comunque, perche' il committente l'ha chiesto, ma in spazio libero — un muro che
  // nascesse sopra le apparecchiature sembrerebbe un difetto invece di una proposta.
  it('propone un punto libero anche quando non c e un bordo fra i due gruppi', () => {
    const soloSala = [compressoreIn(40)]
    expect(calcolaMuro(soloSala)).toBeNull()
    const proposta = ascissaProposta(soloSala)
    expect(proposta % PASSO_GRIGLIA).toBe(0)
    expect(proposta).toBeGreaterThan(40 + DIMENSIONI_NODO.compressore.larghezza)
  })

  it('propone comunque un punto sulla griglia su un disegno vuoto', () => {
    expect(ascissaProposta([]) % PASSO_GRIGLIA).toBe(0)
  })
})

describe('ascissaSpostata', () => {
  // Il muro si posa sui punti della griglia, come tutto cio' che si piazza a mano (decisione 3
  // del 14-08-2026). Si allinea qui, dove i test lo raggiungono, non nel componente.
  it('posa il muro sul punto di griglia piu vicino', () => {
    expect(ascissaSpostata(573)).toBe(570)
    expect(ascissaSpostata(576)).toBe(580)
  })
})
```

*(`compressoreIn` / `serbatoioInLinea` sono due aiutanti locali al file di test, sul modello delle fixture di `layout.test.ts`. Verificare i due valori attesi di `ascissaSpostata` contro l'implementazione vera di `allineaAllaGriglia`: se arrotonda diversamente da «al più vicino», sono i numeri del test a essere sbagliati, non la funzione.)*

- [ ] **Step 2: Eseguire e vedere fallire**

```bash
npx vitest run src/components/schemaImpianto/__tests__/useMuro.test.ts 2>&1 | tail -15
```

Atteso: FAIL, modulo non trovato.

- [ ] **Step 3: Implementare**

```ts
/**
 * Il muro di separazione sulla tela: aggiungerlo, spostarlo in orizzontale, toglierlo. Isolato
 * dall'editor per lo stesso motivo di useTestiLiberi.ts — e perche' questo file non monta
 * componenti React nei test (CLAUDE.md, «no UI test»): tutto quel che va provato sta nelle due
 * funzioni pure qui sotto, non nell'hook.
 *
 * Dello stato dell'editor il muro occupa un solo numero, `muroX`: l'altezza si ricava al disegno
 * (`muroDaAscissa`, layout.ts) e non va tenuta da nessuna parte.
 */
export function ascissaProposta(nodi: SchemaNodoPosizionato[]): number {
  // Dove il muro stava da solo prima del Blocco D4, quando c'e' un bordo fra i due gruppi da cui
  // dedurlo; altrimenti a destra di tutto il disegno, che e' spazio libero.
  const automatico = calcolaMuro(nodi)
  if (automatico) return allineaAllaGriglia(automatico.x)
  const bordo = nodi.length > 0 ? Math.max(...nodi.map((n) => n.x + DIMENSIONI_NODO[n.tipo].larghezza)) : 0
  return allineaAllaGriglia(bordo + 60)
}

export function ascissaSpostata(x: number): number {
  return allineaAllaGriglia(x)
}
```

L'hook segue `useTestiLiberi` nella struttura, comprese le cautele che lì sono commentate e che valgono identiche qui:

- `aggiungiMuro` accetta la proposta **come funzione dello stato**, non come numero: chi la calcola dal disegno corrente deve leggere i nodi che il reducer sta per aggiornare, non quelli catturati nella chiusura del render.
- `spostaMuro` manda in cronologia **il primo** evento del gesto e non gli altri (`trascinamentoMuroAvviato`, un `useRef`): durante un trascinamento arrivano molti eventi al secondo, e la cronologia è profonda 10.
- `aggiungiMuro` e `rimuoviMuro` sono gesti singoli: sempre in cronologia.

- [ ] **Step 4: Eseguire e vedere passare, poi provare che i test mordono**

```bash
npx vitest run src/components/schemaImpianto/__tests__/useMuro.test.ts 2>&1 | tail -8
cp src/components/schemaImpianto/useMuro.ts /tmp/d4-useMuro.bak
```

Mutazioni: in `ascissaProposta` ignorare `automatico` e usare sempre il ramo del bordo → il primo test deve cadere; in `ascissaSpostata` restituire `x` → il test dell'allineamento deve cadere. Ripristino con `cp`.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit 2>&1 | tail -5
git add src/components/schemaImpianto/useMuro.ts src/components/schemaImpianto/__tests__/useMuro.test.ts
git commit -m "feat(schema): la logica del muro manuale, fuori dall'editor

Aggiungere, spostare in orizzontale e togliere il muro, isolato come gli
altri quattro hook della tela: SchemaEditor.tsx e' gia' segnalato come file
da non far crescere, e la logica va dove i test la raggiungono senza montare
componenti.

Dello stato dell'editor il muro occupa un solo numero. Il pulsante della
barra propone il bordo destro della sala compressori — l'unico uso rimasto
di `calcolaMuro` — e lascia spostare.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Il muro sulla tela — si vede, si aggiunge, si trascina

«Si vede nell'editor» è **metà dell'osservazione 8**, non un contorno: il committente ha detto «è visibile in anteprima e non nell'editor, non posso spostarlo né eliminarlo».

**Files:**
- Create: `src/components/schemaImpianto/MuroSeparazione.tsx`
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (`StatoEditor`, barra, portale, `layoutCorrente`)

**Interfaces:**
- Consumes: `useMuro` (Task 7), `simboloMuro` e `varchiDelMuro` (Task 4), `flowALayout` a quattro parametri (Task 5).
- Produces: `MuroSeparazioneProps { muro: SchemaMuroSeparazione; varchi: number[]; selezionato: boolean; onSposta: (x: number, concluso: boolean) => void; onSeleziona: () => void }`

**Nessun test automatico**, come per `TestiLiberi.tsx` e `GuideAllineamento.tsx`: è un componente React e questo modulo non ne monta nei test. La verifica è in pagina, qui allo Step 3 e al Task 10. La logica provabile è già tutta nel Task 7.

- [ ] **Step 1: Il componente**

Sul modello di `TestiLiberi.tsx`, di cui va letto per intero il trascinamento prima di scriverne un altro:

```tsx
/**
 * Il muro di separazione come si vede e si maneggia sulla tela. Disegnato con `simboloMuro` — la
 * STESSA funzione del documento — e coi varchi di `varchiDelMuro`, per la stessa ragione per cui
 * TestiLiberi.tsx legge il carattere dai simboli invece di sceglierselo: la tela e il .docx
 * devono mostrare la stessa cosa, e una copia diverge al primo ritocco.
 *
 * Si trascina in orizzontale soltanto: l'altezza non e' un dato del muro, si ricava dal disegno
 * (`muroDaAscissa`, layout.ts), quindi non c'e' nulla da afferrare in verticale.
 *
 * Componente a parte, come GuideAllineamento e TestiLiberi. Nessun test automatico: e' un
 * componente React (CLAUDE.md, «no UI test»); la logica provata sta in useMuro.ts.
 */
```

- Trascinamento con **cattura del puntatore**, non listener globali (stesso pattern di `SchemaGomito` e `TestoLibero`): il gesto regge anche se il cursore esce per un attimo.
- Scostamento di presa congelato al `pointerdown` (`scostamentoRef`), o il muro salterebbe col bordo sotto il cursore al primo pixel.
- Solo la `x` viaggia: `onSposta(screenToFlowPosition({ x: e.clientX, y: e.clientY }).x - scostamentoRef.current, concluso)`.
- `className="nopan"`, o trascinare il muro panoramizzerebbe la tela.
- Il corpo si disegna con `dangerouslySetInnerHTML` sull'uscita di `simboloMuro(muro.x, muro.yMin, muro.yMax, varchi)`, come `SchemaEdgeTubazione` fa già coi segni.
- **Selezionato**: un contorno visibile attorno all'ingombro. Senza un segno di selezione, il Canc del Task 9 cancellerebbe qualcosa che l'utente non vede selezionato.

- [ ] **Step 2: Cablarlo nell'editor**

- `StatoEditor` acquista `muroX: number | null` accanto a `testi`, **col commento che dice perché è un numero e non un oggetto** (l'altezza si ricava; tenerla qui sarebbe una seconda fonte).
- L'inizializzazione dello stato legge `layout.muro?.x ?? null`.
- `layoutCorrente` passa `stato.muroX` come quarto argomento a `flowALayout` (al Task 5 riceveva `null` provvisorio).
- Nel `ViewportPortal`, accanto a `<TestiLiberi …>`:

```tsx
            {layoutCorrente.muro && (
              <MuroSeparazione
                muro={layoutCorrente.muro}
                varchi={varchiMuro}
                selezionato={false}
                onSposta={spostaMuro}
                onSeleziona={() => {}}
              />
            )}
```

con `const varchiMuro = useMemo(() => (layoutCorrente.muro ? varchiDelMuro(layoutCorrente) : []), [layoutCorrente])`.

*(`selezionato` e `onSeleziona` restano inerti in questo task e il Task 9 li collega: un componente che non compila a metà task non serve a nessuno.)*

- Nella barra, accanto al pulsante «Testo» (righe 758-776), un pulsante **«Muro»** con tooltip: «Il muro fra sala compressori e linea di distribuzione: si trascina in orizzontale, si cancella col tasto Canc». **Disabilitato quando il muro c'è già** (`stato.muroX !== null`): il muro è uno solo, e due sovrapposti sarebbero indistinguibili. `onClick={() => aggiungiMuro((s) => ascissaProposta(nodiDi(s)))}`, dove `nodiDi` ricava i `SchemaNodoPosizionato` da `s.nodes` come fa già `flowALayout`.

- [ ] **Step 3: Compilare, e vedere il muro in pagina**

```bash
npx tsc --noEmit 2>&1 | tail -5
npx vitest run 2>&1 | tail -6
```

Poi, con il dev server **del worktree** sulla 5176 — verificarlo, non darlo per fatto:

```powershell
Get-CimInstance Win32_Process | Where-Object CommandLine -like '*vite*' | Select-Object ProcessId, CommandLine
```

Aprire una pratica con `browser_navigate` **esplicito** (cinque prove manuali hanno già visto non funzionare ciò che una navigazione esplicita ha visto funzionare al primo gesto), aprire l'editor e verificare **misurando nel DOM**, non a occhio:

1. All'apertura **non c'è muro** — conseguenza del Task 5, e questa è la prima volta che la si vede.
2. Il pulsante «Muro» lo fa comparire, e si disabilita.
3. Il muro si trascina in orizzontale e **non** in verticale.
4. Trascinandolo su una tubazione **il varco si apre da solo** e lo segue.
5. L'anteprima accanto mostra lo stesso muro nello stesso punto.

`browser_drag` **non è affidabile** su react-flow: usare una sequenza di mosse a più passi. Le coordinate della tela non sono quelle dello schermo: misurare leggendo il DOM. **Escape chiude l'editor scartando le modifiche** (i dati in banca dati restano intatti): è la via d'uscita sicura.

- [ ] **Step 4: Commit**

```bash
git add src/components/schemaImpianto/MuroSeparazione.tsx src/components/schemaImpianto/SchemaEditor.tsx
git commit -m "feat(schema): il muro si vede e si trascina nell'editor

Meta' dell'osservazione 8: «e' visibile in anteprima e non nell'editor, non
posso spostarlo». Ora si aggiunge dalla barra, si vede sulla tela e si
trascina in orizzontale sulla griglia — in verticale no, perche' l'altezza
non e' un dato del muro ma si ricava dal disegno.

Disegnato con `simboloMuro` e coi varchi di `varchiDelMuro`: le stesse
funzioni del documento, non copie, cosi' i varchi si aprono sulla tela dove
si aprono nel .docx.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Il Canc cancella il muro — e finalmente anche le annotazioni (D4.2 e D4.4)

Il muro e le annotazioni non sono nodi di react-flow, quindi `deleteKeyCode` non li vede. Serve una nozione di selezione per gli oggetti che vivono nel portale. Il D4.4 chiude qui la coda del Blocco C2: le annotazioni si eliminavano solo dal loro dialogo, e con un muro che si cancella col Canc l'incoerenza diventerebbe stridente.

**Files:**
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx` (stato di selezione, `useEffect` della tastiera alla riga 570, `onPaneClick`, `onSelectionChange`)
- Modify: `src/components/schemaImpianto/TestiLiberi.tsx` (clic che seleziona, contorno di selezione)
- Modify: `src/components/schemaImpianto/MuroSeparazione.tsx` (aggancio di `selezionato`/`onSeleziona`)

**Interfaces:**
- Produces: `type SelezioneLibera = { tipo: 'muro' } | { tipo: 'testo'; id: string } | null`, stato locale di `SchemaEditor`; `TestiLiberiProps` acquista `selezionato: string | null` e `onSeleziona: (id: string) => void`.

**Perché la selezione sta in `useState` e non in `StatoEditor`:** `StatoEditor` è ciò su cui lavora la cronologia. Una selezione dentro lo stato renderebbe *selezionare* un passo di Ctrl+Z, e cinque clic riempirebbero una cronologia profonda 10 senza aver modificato il disegno.

**Perché la selezione libera si azzera quando react-flow seleziona qualcosa, e non viceversa:** un verso solo, così non esiste il caso in cui un Canc cancella sia un nodo sia il muro.

- [ ] **Step 1: La selezione**

In `SchemaEditor`:

```tsx
  // Muro e annotazioni non sono nodi di react-flow, quindi `deleteKeyCode` non li vede e la
  // selezione della tela non li comprende: qui accanto vive la loro. In `useState` e non in
  // `StatoEditor`, che e' cio' su cui lavora la cronologia — selezionare non deve diventare un
  // passo di Ctrl+Z.
  const [selezioneLibera, setSelezioneLibera] = useState<SelezioneLibera>(null)
```

- Dove già si aggiorna `selezione` (`onSelectionChange`): se `nodes.length > 0 || edges.length > 0`, `setSelezioneLibera(null)`.
- `onPaneClick` sulla tela: `setSelezioneLibera(null)`.

- [ ] **Step 2: Il Canc**

`deleteKeyCode={['Delete', 'Backspace']}` resta com'è: si occupa di nodi e archi. Nel `useEffect` della tastiera (riga 570), **prima** dei tasti freccia:

```tsx
      // Il dialog di scrittura di un'annotazione e' un Modal MUI e ferma gli eventi sul proprio
      // root, ma questo listener sta su `window`: senza questa guardia un Backspace dentro il
      // campo cancellerebbe l'annotazione invece di un carattere. Verificato in pagina, non dedotto.
      if (scrittura) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selezioneLibera) {
        if (selezioneLibera.tipo === 'muro') rimuoviMuro()
        else rimuoviTesto(selezioneLibera.id)
        setSelezioneLibera(null)
        return
      }
```

Aggiungere `scrittura`, `selezioneLibera`, `rimuoviMuro` e `rimuoviTesto` ai dipendenti dell'effetto — **verificandoli uno per uno**: un dipendente dimenticato qui produce una chiusura stantia che cancella l'oggetto sbagliato.

*(La guardia `if (scrittura) return` va messa **dopo** il ramo di Ctrl+Z se si vuole che l'annullamento resti disponibile a dialog aperto, o prima se non lo si vuole. Decidere provando in pagina quale dei due comportamenti non sorprende, e scriverlo nel commento.)*

- [ ] **Step 3: Il clic che seleziona, e il segno che si vede**

In `TestiLiberi.tsx`: `onSeleziona` fra le props, chiamata al `pointerdown` (non al `click`, che il trascinamento mangia), e un contorno tratteggiato quando l'annotazione è quella selezionata. In `MuroSeparazione.tsx`: collegare `selezionato`/`onSeleziona`, già previsti al Task 8. Il doppio clic sull'annotazione continua a riaprirla in scrittura: la selezione non gli toglie nulla.

- [ ] **Step 4: Verificare in pagina — sei gesti, misurati**

```bash
npx tsc --noEmit 2>&1 | tail -5
npx vitest run 2>&1 | tail -6
```

Sul dev server **del worktree**, con `browser_navigate` esplicito:

1. Clic sul muro → si vede selezionato; Canc → sparisce; il pulsante «Muro» torna attivo.
2. Ctrl+Z → il muro torna, **nella stessa ascissa**.
3. Clic su un'annotazione → selezionata; Canc → sparisce.
4. Clic sulla tela vuota → la selezione si spegne; Canc → **non succede nulla**.
5. Selezionare un nodo dopo aver selezionato il muro → il muro si deseleziona; Canc → cancella **solo** il nodo.
6. Doppio clic su un'annotazione, Backspace nel campo → **cancella un carattere**, l'annotazione resta.

I dialoghi si impilano: identificarli **per titolo**, mai col primo `querySelector`. Diversi pulsanti hanno un'icona invece del testo. `[role="separator"]` prende anche i `Divider` della barra.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/SchemaEditor.tsx src/components/schemaImpianto/TestiLiberi.tsx src/components/schemaImpianto/MuroSeparazione.tsx
git commit -m "feat(schema): il Canc cancella muro e annotazioni

Muro e annotazioni non sono nodi di react-flow, quindi la selezione della
tela non li comprende e `deleteKeyCode` non li vedeva: le annotazioni si
eliminavano solo dal loro dialogo (coda del Blocco C2), e col muro che si
cancella col Canc l'incoerenza sarebbe diventata stridente. Ora hanno una
selezione loro, che si spegne appena react-flow ne fa una sua — un verso
solo, cosi' un Canc non cancella mai due cose insieme.

La selezione sta fuori dallo stato su cui lavora la cronologia: selezionare
non e' un passo di Ctrl+Z.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: La prova su una pratica vera, e il pregio del D4.1 verificato

L'ultimo task non scrive codice di produzione: verifica in pagina ciò che finora è provato solo nei test, e in particolare **l'affermazione che la spec chiede di non dare per scontata**.

**Files:** nessuno di produzione. Solo il report.

- [ ] **Step 1: Il dev server è quello giusto**

```powershell
Get-CimInstance Win32_Process | Where-Object CommandLine -like '*vite*' | Select-Object ProcessId, CommandLine
```

Deve girare dal worktree `schema-impianto-d4`. Se gira dal checkout principale, si sta per provare codice che non è il proprio: fermarlo e riavviarlo dal worktree, sulla 5176.

- [ ] **Step 2: Il pregio del D4.1, verificato e non dato per scontato**

La spec dice: «Ricade automaticamente sull'editor senza una riga di codice in più, perché l'editor inietta la stessa stringa SVG del documento. È il pregio principale della soluzione, e va **verificato**, non dato per scontato.» Nessuna riga dell'editor è stata toccata per il D4.1 in tutto questo piano: se l'affermazione fosse falsa, si scopre adesso.

Su una pratica con almeno una valvola: aprire l'editor e verificare che **sulla tela** la tubazione si interrompa dentro la farfalla, sia su un tratto orizzontale sia su un montante. Confrontare con l'anteprima accanto. Se sulla tela il tubo passa ancora attraverso, l'affermazione della spec è falsa e **va detto**: sarebbe lavoro in più, non un dettaglio da sistemare in silenzio.

- [ ] **Step 3: Le due attese del blocco, su dati veri**

1. **Ogni pratica si apre senza muro** — inclusa una salvata prima di questo blocco. È la conseguenza più visibile, e questa è la prima volta che la si vede su dati veri.
2. Aggiunto il muro e confermato, **riaprendo la pratica il muro è ancora lì**, nella stessa ascissa, con l'altezza adattata al disegno. Poi spostare un'apparecchiatura in alto e verificare che **il muro si allunghi da sé**: è il senso di salvare la sola ascissa.
3. Il `.docx` generato contiene il muro dove la tela lo mostra.

**Cautela obbligatoria, già pagata:** un selettore troppo largo ha scritto nel campo ATECO di una pratica vera. Chiudere con «Annulla modifiche» + «Annulla»; **mai** «Genera comunque .docx» se non è il gesto che si sta provando; verificare in banca dati prima e dopo con la Data API (credenziali in `.env.local`, che non si stampano).

- [ ] **Step 4: La suite intera, l'ultima volta**

```bash
npx vitest run 2>&1 | tail -6
npx tsc --noEmit 2>&1 | tail -5
git status --short
git log --oneline main..HEAD
```

Atteso: suite verde, `tsc` muto, albero pulito (nessun residuo di impalcatura: né `schemaImpianto-base/`, né `banco.temp.test.ts`), e **dieci commit** sul ramo: la correzione della spec, questo piano, e gli otto dei task (il Task 1 non committa e il Task 10 nemmeno).

- [ ] **Step 5: Scrivere la dichiarazione di consegna**

Non è un commit: è il testo da portare al committente, e la spec lo pretende — «va dichiarato in consegna, non scoperto». Deve dire, in italiano e senza gergo:

- Che **da questo rilascio ogni pratica si apre senza muro**, comprese quelle già salvate, e che il muro si aggiunge dalla barra quando serve. È ciò che ha chiesto.
- Che la linea ora si interrompe dentro valvole e riduttori, sulla tela come nel documento.
- Che il muro si trascina in orizzontale e si cancella col Canc, e che il Canc ora cancella anche le annotazioni libere.
- Che **l'altezza del muro continua ad adattarsi da sé** al disegno: non c'è nulla da regolare, e spostando un'apparecchiatura il muro la segue.

---

## Domande aperte, che questo piano non chiude

Nessuna blocca il D4. Vanno portate al committente quando capita, non risolte d'iniziativa.

- Le due metà di un tubo spezzato da un TEE nascono con gomiti espliciti, quindi non seguono più il riassestamento automatico delle quote quando si spostano le apparecchiature.
- Un TEE innestato su un tubo fuori griglia si posa fuori griglia, e alla prima spinta successiva del mouse `snapGrid` lo riporta sui multipli di 10 staccandolo dal tubo.
- Un TEE su una linea condense produce due archi condensa su ancore che dichiarano di accettare solo aria.
- Trascinare a mano il montante di un ramo che finisce su un TEE rifà il difetto dell'imbocco in miniatura: è la regola per cui i gomiti a mano vincono su tutto.
- Il riferimento SVG col TEE copre il ramo tracciato a mano e non quello dello spezzamento reale, che passa da `fissaLaForma`.
- Spazi multipli in un'annotazione (l'SVG li collassa), e «Rigenera da capo» che butta via anche le annotazioni.
- **Nuova, da questo piano:** con il muro manuale un impianto potrebbe averne **due**, se un giorno servisse. Il pulsante oggi lo impedisce: non è stato chiesto e non è stato costruito.

## Decisioni del committente, da non ridiscutere

1. **La punta di freccia sul pallino del TEE va bene così** (deciso il 15-08-2026): il marker del tubo entrante è largo 12 contro un pallino di 10, quindi lo copre, e il committente ha scelto di tenerla perché porta l'informazione del verso del flusso. **Non riproporlo.**
2. Il test di interfaccia `SchemaGomito.test.tsx` **resta**: deroga approvata a `CLAUDE.md` («no UI test») perché quel difetto viveva nel confine fra il componente e l'API di react-flow. Non è un'apertura generale: gli hook si provano con `renderHook`, senza montare componenti.
3. **Il doppio clic sul tubo continua a creare un gomito**, non un TEE: valutato e scartato il 14-08-2026.
