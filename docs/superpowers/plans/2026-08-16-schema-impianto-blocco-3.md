# Blocco 3 — la libreria dei simboli, fedele ai blocchi CAD e tarabile dall'editor

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: usa `superpowers:subagent-driven-development`
> (consigliata) oppure `superpowers:executing-plans` per attuare questo piano task per task.
> Gli step usano caselle (`- [ ]`) per il tracciamento.

**Goal:** rifare i simboli dello schema d'impianto fedeli ai blocchi CAD del committente, e
rendere ancore, proporzioni e origine di ciascun simbolo tarabili da lui dall'editor, con
tre strati (fabbrica → permanente → questa pratica).

**Architettura:** il registro dei simboli resta la fonte unica che alimenta tela e
documento. Sopra di esso si inserisce una libreria risolta, passata **come parametro
esplicito** alle sei porte del registro; la sagoma viene traslata e scalata da una
trasformazione, mentre le ancore si dichiarano già in coordinate finali sui multipli di 10.
L'ingombro del nodo smette di essere dichiarato e diventa l'inviluppo calcolato di sagoma
trasformata e ancore.

**Tech Stack:** TypeScript, React 18, @xyflow/react, Vitest, Supabase (PostgreSQL + RLS),
SVG generato a mano, PyMuPDF per leggere i blocchi CAD.

**Spec:** `docs/superpowers/specs/2026-08-16-schema-impianto-blocco-3-design.md`

## Global Constraints

- **Nessun test di interfaccia** sui componenti: `CLAUDE.md` dice «no UI test», la logica
  provabile sta negli hook e nei servizi. Unica deroga storica: `SchemaGomito.test.tsx`.
- **Niente `prettier --write`**: il `.prettierrc` non corrisponde allo stile del codice.
- **Le mutazioni si ripristinano da una copia** (`cp` prima, `cp` indietro), **mai con
  `git checkout`**: su un file tracciato butterebbe via l'implementazione.
- **Un riferimento SVG non si aggiorna per far tornare verde un test.** Se cade, prima si
  legge la differenza e si verifica che rientri in quella attesa dal task.
- **Ogni test nuovo va visto cadere per mutazione**, e va messo sulla porta più esterna che
  la produzione usa, mai sulla funzione interna.
- **Non si pubblica su `main` senza il via esplicito del committente.** Il push fa partire
  il deploy da solo.
- `PASSO_GRIGLIA = 10` (`src/services/schemaImpianto/griglia.ts`) è il passo su cui **tutte**
  le ancore devono cadere.
- `LayoutSalvato.VERSIONE` resta **1**: alzarla butterebbe via il layout salvato di ogni
  pratica.
- `Blocchi.pdf` è **git-ignored** e vive solo nel worktree principale:
  `C:\Users\FrancescoBertin\Desktop\CLAUDE CODE\OFF-TICKET_UT\DOCUMENTAZIONE\relazione\Blocchi.pdf`.
- La pagina di quel PDF ha **`rotation: 270`**: i rettangoli di `get_drawings()` vanno
  moltiplicati per `page.rotation_matrix` prima di essere usati, altrimenti finiscono tutti
  in una banda sola.

---

## Struttura dei file

**Nuovi:**

| file | responsabilità |
|---|---|
| `scripts/blocchi-cad.py` | legge `Blocchi.pdf`, isola le 19 voci, ne stampa le misure e le salva ritagliate |
| `scripts/confronto-simboli.ts` | rende ogni simbolo del registro in un SVG per file, comprese le varianti con accessorio |
| `src/services/schemaImpianto/libreria.ts` | i tre strati, la loro risoluzione, «torna a default» — dati puri |
| `src/services/schemaImpianto/__tests__/libreria.test.ts` | test della risoluzione |
| `src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoSimboliCad.ts` | riferimento SVG dopo il ridisegno |
| `src/components/schemaImpianto/useTaratura.ts` | i gesti della taratura, senza react-flow |
| `src/components/schemaImpianto/__tests__/useTaratura.test.ts` | test dei gesti |
| `src/components/schemaImpianto/BarraTaratura.tsx` | interruttore, aggiunta/rimozione ancore, dialogo a tre vie |
| `supabase/migrations/<timestamp>_schema_simboli.sql` | tabella della taratura permanente + RLS |
| `src/services/schemaImpianto/tarature.ts` | lettura e scrittura della tabella |

**Modificati:**

| file | cosa cambia |
|---|---|
| `src/services/schemaImpianto/symbols/index.ts` | sagome ridisegnate; le sei porte accettano la libreria; `dimensioniDi` calcola l'inviluppo |
| `src/services/schemaImpianto/types.ts` | tipi della trasformazione e della libreria |
| `src/services/schemaImpianto/layout.ts`, `agganci.ts`, `allineamento.ts`, `renderSvg.ts`, `tratti.ts`, `persistenza.ts` | passano la libreria alle porte |
| `src/components/schemaImpianto/SchemaEditor.tsx`, `SchemaNodeSymbol.tsx`, `conversioneFlow.ts`, `useInserimentoTee.ts` | idem, più il modo taratura |
| `src/components/relazione/SchemaImpiantoSection.tsx` | idem — è **questa** la sorgente della catena del documento (chiama `layoutSchema` + `renderSvg`), non `pdfCompose/raster.ts`, che è rasterizzazione generica per il fascicolo e non tocca `schemaImpianto`. Scoperto durante il Task 7 |

---

## Nota sull'ordine

Il ridisegno delle sagome (Task 3 e 4) viene **prima** della taratura: tarare ancore su
sagome destinate a cambiare significherebbe farlo due volte. Lo strumento di confronto
(Task 1) e il banco (Task 2) vengono prima di tutto, perché sono ciò che dice se il
ridisegno ha funzionato — senza di essi la specifica di questo blocco ha già affermato il
falso una volta, ed è stato il committente a scoprirlo.

**Sui task di ridisegno non troverai coordinate pronte.** Non sono state inventate di
proposito: si misurano col Task 1 sui tracciati veri. Ogni task porta i rapporti già noti
come criterio di accettazione, e il confronto affiancato come prova. Lo stesso vale per i
Task 12 e 13, dove il codice non è scritto per esteso: sono interfaccia e geometria, e
`CLAUDE.md` vieta i test di interfaccia — la logica provabile è già stata estratta nei task
precedenti (`useTaratura`, `libreria`), che quel codice sono e che i test ce l'hanno.

---

### Task 1: Lo strumento di confronto col CAD

**Files:**
- Create: `scripts/blocchi-cad.py`
- Create: `scripts/confronto-simboli.ts`
- Modify: nessuno

**Interfaces:**
- Consumes: `REGISTRO_SIMBOLI`, `definizioneDi` da `src/services/schemaImpianto/symbols`
- Produces: `scripts/blocchi-cad.py --misure` (stampa le misure), `--ritagli <cartella>`
  (salva `cad-<nome>.png`); `SCHEMA_OUT=<cartella> npx tsx scripts/confronto-simboli.ts`
  (salva `att-<nome>.svg`)

- [ ] **Step 1: Scrivere lo script che legge i blocchi**

Crea `scripts/blocchi-cad.py`. Le 19 voci si isolano raggruppando i tracciati per stacco
verticale; la soglia di 12 punti è stata verificata a mano e produce i 17 gruppi attesi
(le tubazioni rigida e flessibile e le due valvole cadono a coppie nello stesso gruppo).

```python
"""Legge Blocchi.pdf: isola le voci della tavola, ne stampa le misure, le ritaglia.

La pagina ha rotation 270: i rect di get_drawings() sono nello spazio non ruotato e
vanno moltiplicati per page.rotation_matrix, altrimenti finiscono tutti in una banda.
Il committente ha confermato che i blocchi sono tutti alla stessa scala fra loro:
i rapporti stampati qui sono quindi confrontabili fra un blocco e l'altro.
"""
import argparse, os, sys
import pymupdf

SRC = os.environ.get(
    "BLOCCHI_PDF",
    r"C:\Users\FrancescoBertin\Desktop\CLAUDE CODE\OFF-TICKET_UT\DOCUMENTAZIONE\relazione\Blocchi.pdf",
)
NOMI = ["compressore", "compressore-disoleatore", "serbatoio-verticale", "serbatoio-orizzontale",
        "essiccatore", "filtro", "filtro-recipiente", "essiccatore-scambiatore", "tanica",
        "separatore", "pacco-bombole", "riduttore", "valvole", "tubazioni", "muro", "freccia",
        "linea-condense"]

def gruppi(page):
    M = page.rotation_matrix
    box = [d["rect"] * M for d in page.get_drawings()]
    box = [r for r in box if r.width < 900 and r.height < 900]
    box.sort(key=lambda r: r.y0)
    fuori, corrente = [], [box[0]]
    for r in box[1:]:
        if r.y0 - max(x.y1 for x in corrente) > 12:
            fuori.append(corrente); corrente = [r]
        else:
            corrente.append(r)
    fuori.append(corrente)
    return fuori

def rettangolo(g):
    return pymupdf.Rect(min(r.x0 for r in g), min(r.y0 for r in g),
                        max(r.x1 for r in g), max(r.y1 for r in g))

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--misure", action="store_true")
    p.add_argument("--ritagli", metavar="CARTELLA")
    a = p.parse_args()

    page = pymupdf.open(SRC)[0]
    g = gruppi(page)
    if len(g) != len(NOMI):
        print(f"attesi {len(NOMI)} gruppi, trovati {len(g)}: la soglia di stacco va rivista",
              file=sys.stderr)
        sys.exit(1)

    base = rettangolo(g[NOMI.index("essiccatore")]).width
    for nome, gruppo in zip(NOMI, g):
        r = rettangolo(gruppo)
        if a.misure:
            print(f"{nome:26} {r.width:7.1f} x {r.height:7.1f}   "
                  f"rapporti sul rombo: {r.width/base:5.2f} x {r.height/base:5.2f}")
        if a.ritagli:
            clip = pymupdf.Rect(r.x0 - 20, r.y0 - 30, r.x1 + 20, r.y1 + 20) & page.rect
            page.get_pixmap(clip=clip, dpi=300).save(os.path.join(a.ritagli, f"cad-{nome}.png"))

main()
```

- [ ] **Step 2: Verificare che i 17 gruppi escano e le misure siano quelle attese**

Run: `python scripts/blocchi-cad.py --misure`
Expected: 17 righe. Controlla tre valori, che sono la prova che la matrice di rotazione è
stata applicata: `compressore` ≈ `53.4 x 53.3` (rapporti `1.17 x 1.17`),
`serbatoio-orizzontale` ≈ `128.5 x 59.5` (`2.82 x 1.31`), `tanica` ≈ `35.5 x 17.8`
(`0.78 x 0.39`). Se esce un solo gruppo con altezza ~137, la moltiplicazione per
`page.rotation_matrix` manca.

- [ ] **Step 3: Scrivere lo script che rende i simboli, varianti annidate comprese**

Crea `scripts/confronto-simboli.ts`. `scripts/tavola-simboli.ts` resta com'è: quello
affianca tutti i simboli in un SVG solo per una lettura d'insieme, questo ne emette uno per
file perché il confronto col CAD si fa a coppie.

```typescript
/**
 * Un SVG per simbolo, per il confronto affiancato coi blocchi CAD.
 *
 * Emette anche le tre varianti con accessorio annidato (compressore + disoleatore,
 * essiccatore + scambiatore, filtro + recipiente): senza di quelle il confronto mente per
 * omissione — è già successo, e il committente ha dovuto segnalarlo.
 *
 * Uso: `SCHEMA_OUT=<cartella> npx tsx scripts/confronto-simboli.ts`
 */
import { writeFileSync } from 'node:fs'
import { definizioneDi } from '../src/services/schemaImpianto/symbols'
import type { SchemaNodoPosizionato } from '../src/services/schemaImpianto/types'

const OUT = process.env.SCHEMA_OUT ?? '.'
const MARGINE = 30

type Accessorio = { codice: string; etichetta: string; valvoleSicurezza: { codice: string; etichetta: string }[] }
const CASI: [nome: string, chiave: string, codice: string, accessorio: Accessorio | undefined][] = [
  ['compressore', 'compressore', 'C1', undefined],
  ['compressore-disoleatore', 'compressore', 'C1',
    { codice: 'C1.1', etichetta: 'disoleatore', valvoleSicurezza: [{ codice: 'C1.2', etichetta: '' }] }],
  ['serbatoio-verticale', 'serbatoio:VERTICALE', 'S1', undefined],
  ['serbatoio-orizzontale', 'serbatoio:ORIZZONTALE', 'S1', undefined],
  ['essiccatore', 'essiccatore', 'E1', undefined],
  ['essiccatore-scambiatore', 'essiccatore', 'E1',
    { codice: 'E1.1', etichetta: 'scambiatore', valvoleSicurezza: [] }],
  ['filtro', 'filtro', 'F1', undefined],
  ['filtro-recipiente', 'filtro', 'F1', { codice: 'F1.1', etichetta: 'recipiente', valvoleSicurezza: [] }],
  ['separatore', 'separatore', 'SEP', undefined],
  ['tanica', 'tanica', 'RC', undefined],
  ['pacco-bombole', 'pacco_bombole', 'PB1', undefined],
]

for (const [nome, chiave, codice, accessorio] of CASI) {
  const [tipo, orientamento] = chiave.split(':')
  const nodo = {
    id: codice,
    tipo,
    orientamento,
    etichetta: '',
    gruppo: 'ALTRO',
    valvoleSicurezza: chiave.startsWith('serbatoio') ? [{ codice: 'S1.1', etichetta: '' }] : [],
    accessorio,
    origine: 'scheda',
    x: 0,
    y: 0,
  } as unknown as SchemaNodoPosizionato

  const def = definizioneDi(nodo)
  const { larghezza: L, altezza: H } = def.dimensioni
  const pallini = def.ancore
    .map((a) => `<circle cx="${a.x}" cy="${a.y}" r="4" fill="#d32f2f" opacity="0.85" />`)
    .join('')

  writeFileSync(
    `${OUT}/att-${nome}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${L + 2 * MARGINE}" height="${H + 2 * MARGINE}" ` +
      `viewBox="0 0 ${L + 2 * MARGINE} ${H + 2 * MARGINE}">` +
      `<rect width="${L + 2 * MARGINE}" height="${H + 2 * MARGINE}" fill="#fff" />` +
      `<g transform="translate(${MARGINE} ${MARGINE})">${def.disegna(nodo)}${pallini}</g></svg>`
  )
  console.log(nome.padEnd(26), L, 'x', H, '-', def.ancore.length, 'ancore')
}
```

- [ ] **Step 4: Verificare che escano gli undici SVG**

Run: `npx tsx scripts/confronto-simboli.ts`
Expected: undici righe stampate, undici file `att-*.svg` nella cartella corrente. I nomi dei
casi corrispondono uno a uno ai nomi dei ritagli dello Step 1, così l'abbinamento non si
indovina.

- [ ] **Step 5: Commit**

```bash
git add scripts/blocchi-cad.py scripts/confronto-simboli.ts
git commit -m "tools(schema): leggere i blocchi CAD e affiancarli ai simboli resi"
```

---

### Task 2: Il banco di confronto sulla catena intera, provato discriminante

**Files:**
- Create: `src/services/schemaImpianto/__tests__/bancoSimboli.test.ts`
- Test: lo stesso file

**Interfaces:**
- Consumes: `layoutSchema` (`layout.ts`), `renderSvg` (`renderSvg.ts`), `buildSchemaModel`
  (`buildSchemaModel.ts`), e gli helper di scheda da
  `@/services/relazione/__tests__/fixtures` (`makeScheda`, `makeCompressore`,
  `makeSerbatoio`) — gli stessi che `renderSvg.test.ts` già importa da lì
- Produces: nessuna API; è il banco che i Task 3, 4, 6 e 7 useranno per misurare i propri
  effetti

Il banco **non** confronta due `renderSvg` sullo stesso oggetto layout. Ogni lato
ricostruisce la catena per intero — scheda → `layoutSchema` → `renderSvg` — perché il
ridisegno cambia gli ingombri, e quindi cambia il layout: un banco montato a valle
misurerebbe zero differenze proprio sul cambiamento più pervasivo. È l'errore che il
Blocco D4 ha già pagato.

**Cosa misura e cosa no.** Questo banco prova due cose: che la catena intera sia
deterministica, e che un cambiamento di ingombro arrivi fino all'SVG. **Non** è un confronto
prima/dopo del ridisegno: quello è affidato ai **riferimenti SVG committati**, congelati nel
tempo, che cadono quando il disegno cambia. Non cercare qui un raffronto storico che non c'è.

- [ ] **Step 1: Scrivere il banco e la sua prova di discriminazione**

```typescript
/**
 * Banco del Blocco 3: misura quanto un impianto cambia da capo a fondo.
 *
 * Ogni lato costruisce la catena INTERA (scheda → layoutSchema → renderSvg). Confrontare
 * due renderSvg sullo stesso layout misurerebbe zero proprio dove il Blocco 3 lavora di
 * più — le dimensioni dei simboli, che entrano nel layout prima del disegno.
 */
import { describe, it, expect } from 'vitest'
import { layoutSchema } from '../layout'
import { renderSvg } from '../renderSvg'
import { buildSchemaModel } from '../buildSchemaModel'
import { makeScheda, makeCompressore, makeSerbatoio } from '@/services/relazione/__tests__/fixtures'

function catena(scheda: ReturnType<typeof makeScheda>): string {
  return renderSvg(layoutSchema(buildSchemaModel(scheda)))
}

describe('banco del Blocco 3', () => {
  const scheda = makeScheda({
    compressori: [makeCompressore({ ha_disoleatore: true })],
    serbatoi: [makeSerbatoio({ orientamento: 'VERTICALE' })],
  })

  it('la catena intera è deterministica: due passate danno lo stesso SVG', () => {
    expect(catena(scheda)).toBe(catena(scheda))
  })

  it('DISCRIMINA: un cambiamento negli ingombri arriva fino all SVG', () => {
    // Prova che il banco vede ciò che deve vedere. Senza questo test, un banco montato
    // troppo a valle resterebbe verde per tutto il blocco e non lo saprebbe nessuno.
    const primaDelCambio = catena(scheda)
    const conSerbatoioOrizzontale = catena(
      makeScheda({
        compressori: [makeCompressore({ ha_disoleatore: true })],
        serbatoi: [makeSerbatoio({ orientamento: 'ORIZZONTALE' })],
      })
    )
    expect(conSerbatoioOrizzontale).not.toBe(primaDelCambio)
  })
})
```

- [ ] **Step 2: Eseguire e verificare che passi**

Run: `npx vitest run src/services/schemaImpianto/__tests__/bancoSimboli.test.ts`
Expected: 2 PASS. Se `makeScheda` chiede campi che qui non sono passati, guarda come li
compila `renderSvg.test.ts` in `svgMinimo` e allineati a quello — non creare una seconda
copia degli helper.

- [ ] **Step 3: Vederlo cadere per mutazione**

Copia il file dei simboli, poi cambia un ingombro:

```bash
cp src/services/schemaImpianto/symbols/index.ts /tmp/symbols.bak
```

In `DIMENSIONI`, porta `tanica` da `{ larghezza: 80, altezza: 70 }` a
`{ larghezza: 80, altezza: 71 }`.

Run: `npx vitest run src/services/schemaImpianto/__tests__/bancoSimboli.test.ts`
Expected: il primo test resta verde (è deterministico per costruzione), ma il banco usato
dai task seguenti deve accorgersene. Verifica a mano che `catena(scheda)` cambi:

```bash
npx tsx -e "import('./src/services/schemaImpianto/symbols').then(m => console.log(m.DIMENSIONI_NODO.tanica))"
```

Poi ripristina **dalla copia**, mai con `git checkout`:

```bash
cp /tmp/symbols.bak src/services/schemaImpianto/symbols/index.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/services/schemaImpianto/__tests__/bancoSimboli.test.ts
git commit -m "test(schema): il banco del Blocco 3 misura la catena intera, e discrimina"
```

---

### Task 3: I tre rombi si distinguono davvero, e la valvola di scarico ha due misure

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` — `simboloRombo` (righe ~292-339),
  `valvolaScarico` (righe ~171-186)
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`

**Interfaces:**
- Consumes: lo strumento del Task 1, il banco del Task 2
- Produces: `valvolaScarico(x: number, y: number, misura: 'serbatoio' | 'apparecchio'): string`
  — terzo parametro **obbligatorio**, così ogni chiamante è costretto a dichiarare quale
  delle due misure vuole invece di ereditarne una per distrazione

Il segno interno è ciò che distingue i tre rombi, e oggi li rende quasi uguali. Dai blocchi
del committente:

| rombo | segno interno |
|---|---|
| essiccatore | **due** tratti orizzontali, uno sopra e uno sotto la sigla |
| filtro | **linea verticale tratteggiata** dall'alto, più un tratto orizzontale in basso |
| separatore | **rettangolo verticale interno**, e **nessuna valvola a farfalla** sotto: solo un tratto che scende |

- [ ] **Step 1: Misurare i tre rombi sui tracciati veri**

Run: `python scripts/blocchi-cad.py --misure` e
`python scripts/blocchi-cad.py --ritagli <cartella>`

Apri `cad-essiccatore.png`, `cad-filtro.png`, `cad-separatore.png`. Ricava, in frazione del
lato del rombo: a che quota stanno i due tratti dell'essiccatore, dove comincia e finisce la
verticale tratteggiata del filtro, larghezza e altezza del rettangolo del separatore, e le
due misure della valvola di scarico (quella sotto il serbatoio e quella sotto i rombi).
Annota i numeri nel messaggio di commit: sono la motivazione delle costanti che scriverai.

- [ ] **Step 2: Scrivere i test che descrivono i tre segni**

I test stanno sulla porta esterna (`definizioneDi(nodo).disegna(nodo)`), non su
`simboloRombo`, che è interna.

```typescript
describe('i tre rombi si distinguono per il segno interno', () => {
  const rombo = (tipo: 'essiccatore' | 'filtro' | 'separatore') =>
    definizioneDi({ tipo } as SchemaNodo).disegna(
      { id: 'X1', tipo, etichetta: '', gruppo: 'ALTRO', valvoleSicurezza: [], origine: 'scheda' } as SchemaNodo
    )

  it("l'essiccatore ha due tratti orizzontali, non uno", () => {
    const orizzontali = [...rombo('essiccatore').matchAll(/M (\d+(?:\.\d+)?) (\d+(?:\.\d+)?) L (\d+(?:\.\d+)?) \2\b/g)]
    expect(orizzontali).toHaveLength(2)
  })

  it('il filtro ha una verticale tratteggiata', () => {
    expect(rombo('filtro')).toMatch(/stroke-dasharray="[^"]+"/)
  })

  it('il separatore ha un rettangolo interno e nessuna valvola a farfalla', () => {
    const svg = rombo('separatore')
    expect(svg).toContain('<rect')
    // La farfalla della valvola di scarico è due triangoli che si toccano sulla punta:
    // la sua firma è lo stelo orizzontale accanto al vertice. Vedi `valvolaScarico`.
    expect(svg).not.toContain(FIRMA_VALVOLA_SCARICO)
  })
})
```

Sostituisci `FIRMA_VALVOLA_SCARICO` con una sottostringa costante di ciò che
`valvolaScarico` emette davvero — leggila dalla funzione, non indovinarla.

- [ ] **Step 3: Eseguire i test e vederli fallire**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts -t 'segno interno'`
Expected: FAIL — l'essiccatore ha un tratto solo, il filtro ha una verticale continua, il
separatore ha la valvola.

- [ ] **Step 4: Riscrivere `simboloRombo` con i tre segni e le due valvole**

`simboloRombo` prende un nuovo parametro `segno: 'due-tratti' | 'verticale-tratteggiata' |
'rettangolo'` al posto di `'verticale' | 'orizzontale'`, e `conScarico` diventa
`scarico: 'apparecchio' | 'nessuno'`. `simboloSeparatore` passa `'nessuno'` e disegna al
suo posto il tratto che scende. `valvolaScarico` riceve la misura dal chiamante:
`simboloSerbatoio` passa `'serbatoio'`, i rombi passano `'apparecchio'`.

Le costanti geometriche vengono dai numeri dello Step 1. Ogni costante porta in commento la
misura da cui nasce — non «per pareggiare il disegno», ma la frazione letta sul blocco.

- [ ] **Step 5: Eseguire i test e vederli passare**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts`
Expected: PASS, compresi i test preesistenti sui rombi. Se qualcuno di quelli cade,
**leggilo**: se asseriva il tratto unico, era la descrizione del difetto e va riscritto; se
asseriva altro, hai rotto qualcosa.

- [ ] **Step 6: Guardare i riferimenti SVG che cadono**

Run: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts`
Expected: i tre test di riferimento (`svgRiferimentoSenzaTesti`, `ConTee`, `ConMuro`)
falliscono. Leggi la differenza: deve toccare **soltanto** i tratti interni dei rombi e la
valvola di scarico. Se tocca posizioni di nodi o percorsi di tubi, fermati — significa che
il ridisegno ha cambiato un ingombro senza che tu lo volessi.

Rigenera le tre fixture solo dopo aver letto la differenza, e nel commit scrivi cosa
cambiava.

- [ ] **Step 7: Confronto affiancato col CAD**

Genera i ritagli e gli SVG (Task 1) e affiancali. I tre rombi devono somigliare ai blocchi.
Questo passaggio si chiude col giudizio del committente, non col tuo.

- [ ] **Step 8: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts \
        src/services/schemaImpianto/__tests__/simboli.test.ts \
        src/services/schemaImpianto/__tests__/fixtures/
git commit -m "feat(schema): i tre rombi si distinguono per il segno interno, come nel CAD"
```

---

### Task 4: Compressore, serbatoi, tanica e pacco bombole tornano in proporzione

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` — `DIMENSIONI` (righe ~37-47),
  `simboloCompressore` (~207-245), `simboloSerbatoio` (~248-284), `simboloTanica`,
  `simboloPaccoBombole`
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`

**Interfaces:**
- Consumes: le misure del Task 1, il banco del Task 2
- Produces: `DIMENSIONI` con un ingombro **proprio** per `serbatoio:ORIZZONTALE`, distinto
  da quello verticale

I rapporti da rispettare, presa a 1 la larghezza del rombo (già misurati, vedi la spec):

| blocco | CAD | oggi |
|---|---|---|
| compressore | 1,17 × 1,17 | 1,45 × 1,36 |
| serbatoio verticale | 0,94 × 2,77 | 1,36 × 2,36 |
| serbatoio orizzontale | 2,82 × 1,31 | 1,36 × 2,36 |
| tanica | 0,78 × 0,39 | 0,73 × 0,64 |
| pacco bombole | 1,17 × 1,17 | 1,09 × 0,91 |

Avvertenza: per serbatoi e rombi il rettangolo misurato **comprende** la valvola di
sicurezza sopra e lo scarico sotto. Rimisura il solo corpo isolando i suoi tracciati prima
di fissare le costanti.

- [ ] **Step 1: Scrivere i test sulle proporzioni**

```typescript
describe('le proporzioni seguono i blocchi CAD', () => {
  const lato = (chiave: string, orientamento?: string) =>
    definizioneDi({ tipo: chiave, orientamento } as SchemaNodo).dimensioni
  const rombo = lato('essiccatore').larghezza

  it('il compressore è quadrato e largo 1,17 rombi', () => {
    const { larghezza, altezza } = lato('compressore')
    expect(larghezza / rombo).toBeCloseTo(1.17, 1)
    expect(larghezza).toBe(altezza)
  })

  it('il serbatoio orizzontale ha un ingombro suo, largo circa il doppio dell alto', () => {
    const o = lato('serbatoio', 'ORIZZONTALE')
    const v = lato('serbatoio', 'VERTICALE')
    expect(o).not.toEqual(v)
    expect(o.larghezza / o.altezza).toBeCloseTo(2.82 / 1.31, 1)
  })

  it('la tanica è larga il doppio dell altezza', () => {
    const { larghezza, altezza } = lato('tanica')
    expect(larghezza / altezza).toBeCloseTo(2, 1)
  })

  it('il pacco bombole è quadrato', () => {
    const { larghezza, altezza } = lato('pacco_bombole')
    expect(larghezza).toBe(altezza)
  })
})
```

- [ ] **Step 2: Eseguire e vedere fallire**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts -t 'proporzioni'`
Expected: FAIL su tutti e quattro.

- [ ] **Step 3: Dare al serbatoio orizzontale un ingombro proprio**

`DIMENSIONI` è un `Record<SchemaNodoTipo, …>` e non può portare due misure per il
serbatoio: la variante orizzontale va dichiarata nel registro, sulla chiave
`serbatoio:ORIZZONTALE`, che già esiste come `ChiaveSimbolo` separata. Sposta lì l'ingombro
allungato e lascia a `DIMENSIONI.serbatoio` quello verticale. `simboloSerbatoio` legge le
proprie misure da `definizioneDi(nodo).dimensioni` invece che da `DIMENSIONI.serbatoio`,
altrimenti continuerebbe a disegnare dentro il riquadro sbagliato.

- [ ] **Step 4: Portare in proporzione le altre tre sagome**

Compressore: quadrato, e il cerchio con **due corde oblique** (oggi ne ha una sola, e
passante per il centro). La sigla resta dentro, in alto a sinistra: quella parte era
già giusta. Tanica: rettangolo 2:1. Pacco bombole: quadrato, con passo e colli delle
bombole presi dal ritaglio `cad-pacco-bombole.png`.

- [ ] **Step 5: Eseguire i test**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts`
Expected: PASS.

- [ ] **Step 6: Leggere i riferimenti SVG e il banco**

Run: `npx vitest run src/services/schemaImpianto/`
Expected: i riferimenti SVG cadono di nuovo, e stavolta **le posizioni dei nodi e i percorsi
dei tubi cambiano davvero** — gli ingombri sono cambiati, quindi il layout è cambiato. È
l'effetto atteso, ed è esattamente ciò che il banco del Task 2 deve vedere: se il banco
restasse identico, sarebbe montato nel posto sbagliato.

Rigenera le fixture dopo aver letto la differenza.

- [ ] **Step 7: Confronto affiancato, e giudizio del committente**

- [ ] **Step 8: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts \
        src/services/schemaImpianto/__tests__/ \
        src/services/schemaImpianto/__tests__/fixtures/
git commit -m "feat(schema): proporzioni dei simboli dai blocchi CAD, ingombro proprio per il serbatoio orizzontale"
```

---

### Task 5: I tre strati della libreria, dati puri

**Files:**
- Create: `src/services/schemaImpianto/libreria.ts`
- Create: `src/services/schemaImpianto/__tests__/libreria.test.ts`
- Modify: `src/services/schemaImpianto/types.ts`

**Interfaces:**
- Consumes: `ChiaveSimbolo`, `SchemaAncora` da `types.ts`
- Produces:
  - `interface TaraturaSimbolo { dx: number; dy: number; sx: number; sy: number; ancore: SchemaAncora[] }`
  - `type Tarature = Partial<Record<ChiaveSimbolo, TaraturaSimbolo>>`
  - `function risolviLibreria(permanenti: Tarature, diPratica: Tarature): Tarature`
  - `function taraturaDi(libreria: Tarature, chiave: ChiaveSimbolo): TaraturaSimbolo | undefined`
  - `const TARATURA_NEUTRA: TaraturaSimbolo` (traslazione nulla, scala 1, ancore vuote)

Uno strato **sostituisce** il precedente per intero, non si fonde per campi: traslazione,
scala e ancore sono interdipendenti — spostare la sagoma senza spostare le ancore cambia il
significato di entrambe — e una fusione per campi produrrebbe stati che nessuno ha mai visto
sullo schermo. «Torna a default» **cancella** la voce, non ne scrive una uguale al codice.

- [ ] **Step 1: Scrivere i test della risoluzione**

```typescript
import { describe, it, expect } from 'vitest'
import { risolviLibreria, taraturaDi } from '../libreria'

const permanente = { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [{ id: 'sx', x: 0, y: 130, accetta: ['aria'] as const }] }
const diPratica = { dx: -3, dy: 0, sx: 1.07, sy: 1, ancore: [{ id: 'sx', x: 30, y: 130, accetta: ['aria'] as const }] }

describe('risoluzione dei tre strati', () => {
  it('senza tarature non risolve nulla: il default di fabbrica resta intatto', () => {
    expect(taraturaDi(risolviLibreria({}, {}), 'compressore')).toBeUndefined()
  })

  it('la taratura permanente vale quando la pratica non ne ha una sua', () => {
    expect(taraturaDi(risolviLibreria({ compressore: permanente }, {}), 'compressore')).toEqual(permanente)
  })

  it('la taratura di pratica vince su quella permanente', () => {
    const risolta = risolviLibreria({ compressore: permanente }, { compressore: diPratica })
    expect(taraturaDi(risolta, 'compressore')).toEqual(diPratica)
  })

  it('sostituisce per intero invece di fondere campo per campo', () => {
    // diPratica non dichiara ancore diverse per numero, ma le sue coordinate sono le
    // sole che devono sopravvivere: se qualcuno fondesse i campi, qui tornerebbe
    // l'ancora a x=0 della permanente insieme alla traslazione della pratica — uno stato
    // che nessuno ha mai visto sullo schermo.
    const risolta = risolviLibreria({ compressore: permanente }, { compressore: diPratica })
    expect(taraturaDi(risolta, 'compressore')!.ancore[0].x).toBe(30)
  })

  it('un simbolo tarato non tocca gli altri', () => {
    const risolta = risolviLibreria({ compressore: permanente }, {})
    expect(taraturaDi(risolta, 'tanica')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Eseguire e vedere fallire**

Run: `npx vitest run src/services/schemaImpianto/__tests__/libreria.test.ts`
Expected: FAIL — il modulo non esiste.

- [ ] **Step 3: Scrivere `libreria.ts`**

```typescript
/**
 * I tre strati della libreria dei simboli e la loro risoluzione.
 *
 * default di fabbrica (REGISTRO_SIMBOLI) → taratura permanente (tabella) → taratura di
 * questa pratica (dentro il layout salvato). L'ultimo che parla vince, e vince PER INTERO:
 * traslazione, scala e ancore sono interdipendenti, e fonderle per campi produrrebbe
 * stati mai visti sullo schermo.
 *
 * Dati puri, nessun accesso alla rete e nessuno stato di modulo: la libreria risolta viene
 * passata come parametro esplicito alle porte del registro. Un registro globale mutabile
 * renderebbe il disegno dipendente da quale pratica è stata aperta per ultima.
 */
import type { ChiaveSimbolo, SchemaAncora } from './types'

export interface TaraturaSimbolo {
  /** Traslazione della sagoma dentro il sistema del nodo. Le ANCORE non la subiscono. */
  dx: number
  dy: number
  /** Scala della sagoma. Le scritte si contro-scalano, vedi `simboloTrasformato`. */
  sx: number
  sy: number
  /** Ancore in coordinate finali, già sui multipli di PASSO_GRIGLIA. */
  ancore: SchemaAncora[]
}

export type Tarature = Partial<Record<ChiaveSimbolo, TaraturaSimbolo>>

export const TARATURA_NEUTRA: TaraturaSimbolo = { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [] }

export function risolviLibreria(permanenti: Tarature, diPratica: Tarature): Tarature {
  return { ...permanenti, ...diPratica }
}

export function taraturaDi(libreria: Tarature, chiave: ChiaveSimbolo): TaraturaSimbolo | undefined {
  return libreria[chiave]
}
```

- [ ] **Step 4: Eseguire i test**

Run: `npx vitest run src/services/schemaImpianto/__tests__/libreria.test.ts`
Expected: 5 PASS.

- [ ] **Step 5: Vederli cadere per mutazione**

```bash
cp src/services/schemaImpianto/libreria.ts /tmp/libreria.bak
```

Cambia `risolviLibreria` in una fusione per campi:
`{ ...permanenti, ...diPratica, ...(Object.fromEntries(Object.entries(diPratica).map(([k, v]) => [k, { ...permanenti[k], ...v, ancore: permanenti[k]?.ancore ?? v.ancore }]))) }`

Run: `npx vitest run src/services/schemaImpianto/__tests__/libreria.test.ts`
Expected: FAIL sul test «sostituisce per intero». Se resta verde, il test non discrimina e
va riscritto.

```bash
cp /tmp/libreria.bak src/services/schemaImpianto/libreria.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/libreria.ts src/services/schemaImpianto/__tests__/libreria.test.ts
git commit -m "feat(schema): i tre strati della libreria dei simboli, dati puri"
```

---

### Task 6: La trasformazione della sagoma e l'ingombro derivato

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts`
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`

**Interfaces:**
- Consumes: `TaraturaSimbolo`, `TARATURA_NEUTRA` (Task 5)
- Produces:
  - `function simboloTrasformato(svg: string, t: TaraturaSimbolo): string`
  - `function inviluppo(dimensioni: {larghezza: number; altezza: number}, t: TaraturaSimbolo, ancore: SchemaAncora[]): {larghezza: number; altezza: number}`
    — **non** riceve l'SVG: non lo parsa, e il registro dichiara già l'ingombro della sagoma
    non trasformata

Il meccanismo portante del blocco: **le ancore non si scalano**. La sagoma vive in
coordinate sue e viene traslata e scalata; le ancore si dichiarano già nel sistema finale,
sui multipli di 10. Il committente sposta il blocco finché il punto che gli interessa
arriva sotto il pallino, che sta fermo.

- [ ] **Step 1: Scrivere i test della trasformazione**

```typescript
describe('la trasformazione della sagoma', () => {
  const t = { dx: -3, dy: 0, sx: 1.07, sy: 1, ancore: [] }

  it('avvolge la sagoma in un g con translate e scale', () => {
    expect(simboloTrasformato('<circle cx="10" cy="10" r="5" />', t))
      .toBe('<g transform="translate(-3 0) scale(1.07 1)"><circle cx="10" cy="10" r="5" /></g>')
  })

  it('la taratura neutra non aggiunge nulla', () => {
    // Senza questo, ogni simbolo non tarato guadagnerebbe un <g> inutile e TUTTI i
    // riferimenti SVG cambierebbero senza che sia cambiato niente.
    expect(simboloTrasformato('<circle />', TARATURA_NEUTRA)).toBe('<circle />')
  })

  it('contro-scala le scritte, che altrimenti si stirerebbero', () => {
    const svg = simboloTrasformato('<text x="10" y="10">S1</text>', { ...t, sx: 2, sy: 1 })
    // La scritta porta una scala inversa a quella del gruppo: 1/2 in orizzontale.
    expect(svg).toMatch(/<text[^>]*transform="[^"]*scale\(0\.5 1\)/)
  })
})

describe("l'ingombro è l'inviluppo di sagoma trasformata e ancore", () => {
  it('cresce se un ancora sta fuori dal disegno', () => {
    const ancore = [{ id: 'alto', x: 75, y: -20, accetta: ['valvola_sicurezza'] as const }]
    const misure = inviluppo({ larghezza: 150, altezza: 260 }, TARATURA_NEUTRA, ancore)
    expect(misure.altezza).toBeGreaterThan(260)
  })

  it('segue la scala della sagoma', () => {
    const misure = inviluppo({ larghezza: 100, altezza: 100 }, { ...TARATURA_NEUTRA, sx: 2, sy: 1 }, [])
    expect(misure.larghezza).toBe(200)
  })
})
```

- [ ] **Step 2: Eseguire e vedere fallire**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts -t 'trasformazione'`
Expected: FAIL — le funzioni non esistono.

- [ ] **Step 3: Implementare le due funzioni**

`simboloTrasformato` restituisce la stringa **invariata** quando la taratura è neutra: è ciò
che tiene fermi tutti i riferimenti SVG dei simboli non tarati. La contro-scala delle
scritte si applica a ogni `<text>` del frammento.

`inviluppo` prende `dimensioni` dal registro, le moltiplica per la scala, le trasla, e
allarga il rettangolo risultante fino a contenere ogni ancora. Non riceve l'SVG e non lo
parsa: sarebbe fragile e non serve — il registro **dichiara** già l'ingombro della sagoma
non trasformata.

- [ ] **Step 4: Eseguire i test**

Run: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificare che nessun riferimento SVG si muova**

Run: `npx vitest run src/services/schemaImpianto/`
Expected: **tutto verde, riferimenti compresi.** Nessuno usa ancora la trasformazione:
se un riferimento cade qui, `simboloTrasformato` sta emettendo un `<g>` anche a taratura
neutra.

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts src/services/schemaImpianto/__tests__/simboli.test.ts
git commit -m "feat(schema): la sagoma si trasforma, l'ingombro diventa l'inviluppo"
```

---

### Task 7: Le sei porte del registro ricevono la libreria

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (`definizioneDi`, `ancoreDi`,
  `ancoraDi`, `latoImposto`, `presaDi`, `dimensioniDi`)
- Modify: `layout.ts`, `agganci.ts`, `allineamento.ts`, `renderSvg.ts`, `tratti.ts`,
  `persistenza.ts`, `conversioneFlow.ts`, `SchemaEditor.tsx`, `SchemaNodeSymbol.tsx`,
  `useInserimentoTee.ts`, `pdfCompose/raster.ts`
- Test: i test esistenti di quei moduli

**Interfaces:**
- Consumes: `Tarature` (Task 5)
- Produces: le sei porte con un parametro finale `libreria: Tarature = {}`. Il valore
  predefinito **vuoto** è deliberato: rende il diff attuabile a pezzi e conserva il
  comportamento di oggi finché qualcuno non passa davvero una libreria.

È il diff più ampio del blocco: dodici file di produzione. Il rischio è che un chiamante
resti indietro passando la libreria sbagliata — e TypeScript non lo direbbe, perché il tipo
è lo stesso.

- [ ] **Step 1: Scrivere il test che inchioda il passaggio dalla porta esterna**

Il test sta su `renderSvg` e `layoutSchema`, non sulle sei porte: è nel passaggio fra la
funzione interna e la porta vera che i nomi divergono, ed è esattamente così che il difetto
peggiore del D4 è passato inosservato per dieci revisioni.

```typescript
it('una taratura passata a renderSvg arriva fino al disegno', () => {
  const tarata: Tarature = {
    tanica: { dx: 0, dy: 0, sx: 2, sy: 1, ancore: [{ id: 'alto-in', x: 80, y: 0, accetta: ['condensa'] }] },
  }
  const layout = layoutSchema(buildSchemaModel(schedaConTanica), tarata)
  expect(renderSvg(layout, tarata)).not.toBe(renderSvg(layoutSchema(buildSchemaModel(schedaConTanica))))
})
```

- [ ] **Step 2: Eseguire e vedere fallire**

Expected: FAIL — le firme non accettano ancora il parametro.

- [ ] **Step 3: Aggiungere il parametro alle sei porte**

In ognuna: se esiste una taratura per la chiave del nodo, `ancoreDi` restituisce le ancore
della taratura invece di quelle del registro; `dimensioniDi` restituisce l'inviluppo;
`definizioneDi(...).disegna` viene avvolto da `simboloTrasformato`.

- [ ] **Step 4: Propagare a valle, un file per volta**

Ogni chiamante riceve la libreria da chi lo chiama, fino alle due sorgenti: l'editor
(`SchemaEditor.tsx`) e la generazione del documento (`raster.ts`). **La libreria risolta si
costruisce in un punto solo per ciascuna delle due catene** — non una `risolviLibreria` per
file.

Dopo ogni file: `npx tsc --noEmit`.

- [ ] **Step 5: Eseguire tutta la suite**

Run: `npx vitest run && npx tsc --noEmit`
Expected: tutto verde, riferimenti SVG compresi — nessuno passa ancora una libreria non
vuota in produzione.

- [ ] **Step 6: Commit**

```bash
git add -A src/
git commit -m "refactor(schema): le porte del registro ricevono la libreria come parametro"
```

---

### Task 8: Le ancore di fabbrica sulla griglia

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (`REGISTRO_SIMBOLI`)
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts`

**Interfaces:**
- Consumes: le sagome dei Task 3 e 4
- Produces: un registro le cui ancore cadono **tutte** sui multipli di `PASSO_GRIGLIA`

Sul serbatoio verticale, le **cinque** ancore indicate dal committente: quattro sui fianchi,
alle due quote dove le calotte incontrano il cilindro (sinistra e destra, alto e basso), più
una in basso al centro sulla valvola di scarico. Oggi ce ne sono quattro, in posti diversi.

- [ ] **Step 1: Scrivere il test che vale per tutto il registro**

```typescript
it('ogni ancora di ogni simbolo cade sulla griglia', () => {
  const fuori: string[] = []
  for (const [chiave, def] of Object.entries(REGISTRO_SIMBOLI)) {
    for (const a of def.ancore) {
      if (a.x % PASSO_GRIGLIA !== 0 || a.y % PASSO_GRIGLIA !== 0) {
        fuori.push(`${chiave}/${a.id} (${a.x}, ${a.y})`)
      }
    }
  }
  expect(fuori).toEqual([])
})

it('il serbatoio verticale ha le cinque ancore chieste dal committente', () => {
  const ancore = REGISTRO_SIMBOLI['serbatoio:VERTICALE'].ancore
  expect(ancore).toHaveLength(5)
  expect(ancore.filter((a) => a.accetta.includes('aria'))).toHaveLength(4)
  expect(ancore.filter((a) => a.accetta.includes('condensa'))).toHaveLength(1)
})
```

- [ ] **Step 2: Eseguire e vedere fallire**

Expected: FAIL, con l'elenco delle ancore fuori griglia — fra cui `serbatoio:VERTICALE/sx
(33, 150)` e `alto-in (75, 40)`.

- [ ] **Step 3: Portare le ancore sulla griglia**

Dove un'ancora deve stare su un punto notevole della sagoma, **è la sagoma che si adatta**:
se le calotte sono semicerchi, basta una larghezza multipla di 20 perché le quote dei fianchi
cadano sulla griglia da sole. Cambia le costanti del Task 4 di quel poco che serve, e
rimisura il rapporto: deve restare entro il decimo dei valori CAD.

- [ ] **Step 4: Eseguire e leggere le cadute**

Run: `npx vitest run src/services/schemaImpianto/`
Expected: i test delle ancore passano; i riferimenti SVG cadono perché i capi dei tubi si
spostano. Leggi la differenza: deve toccare i capi degli archi e le posizioni dei nodi, non
i testi della lista apparecchiature.

- [ ] **Step 5: Verificare che `agganciaQuota` sia diventata inutile**

Run: `npx vitest run src/services/schemaImpianto/__tests__/griglia.test.ts`

`agganciaQuota` esiste solo perché le ancore non cadevano sulla griglia, e il suo commento
dice che il giorno in cui ci cadranno diventerà indistinguibile da `allineaAllaGriglia`.
**Non toglierla in questo task**: verifica soltanto se i suoi test continuano a
discriminare, e annota l'esito nel commit. La rimozione è materia di un blocco futuro,
quando anche le tarature del committente saranno assestate.

- [ ] **Step 6: Commit**

```bash
git add src/services/schemaImpianto/
git commit -m "feat(schema): le ancore di fabbrica cadono tutte sulla griglia"
```

---

### Task 9: La tabella delle tarature permanenti

**Files:**
- Create: `supabase/migrations/<timestamp>_schema_simboli.sql`
- Create: `src/services/schemaImpianto/tarature.ts`
- Test: `src/services/schemaImpianto/__tests__/tarature.test.ts`

**Interfaces:**
- Consumes: `Tarature`, `TaraturaSimbolo` (Task 5)
- Produces:
  - `async function leggiTaraturePermanenti(): Promise<Tarature>`
  - `async function scriviTaraturaPermanente(chiave: ChiaveSimbolo, t: TaraturaSimbolo | null): Promise<void>` — `null` cancella la riga, cioè «torna a default»
  - `function taratureDaRighe(righe: {chiave: string; taratura: unknown}[]): Tarature` — pura, ed è qui che stanno i test

- [ ] **Step 1: Scrivere la migrazione**

```sql
-- Taratura permanente dei simboli dello schema d'impianto: una riga per chiave simbolo.
-- Il default di fabbrica resta nel codice (REGISTRO_SIMBOLI): l'assenza di riga significa
-- «non tarato», ed è ciò a cui torna il pulsante «torna a default».
create table if not exists public.schema_simboli (
  chiave text primary key,
  taratura jsonb not null,
  aggiornato_da uuid references public.users(id),
  aggiornato_il timestamptz not null default now()
);

alter table public.schema_simboli enable row level security;

-- Lettura a chiunque sia autenticato: il disegno serve a tutti.
create policy schema_simboli_lettura on public.schema_simboli
  for select to authenticated using (true);

-- Scrittura al solo amministratore: una taratura permanente tocca OGNI pratica,
-- comprese quelle già consegnate.
create policy schema_simboli_scrittura on public.schema_simboli
  for all to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'))
  with check (exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'));
```

- [ ] **Step 2: Verificare la forma delle policy esistenti prima di applicare**

Lo schema di produzione **diverge** dalle migrazioni nel repo: prima di applicare, controlla
come sono scritte le policy `admin` su una tabella vicina.

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select tablename, policyname, qual from pg_policies where schemaname = '"'"'public'"'"' and tablename in ('"'"'equipment_catalog'"'"','"'"'dm329_technical_data'"'"')"}'
```

Se il ruolo si legge in un altro modo (claim JWT invece della tabella `users`), **adegua la
migrazione a ciò che la produzione fa davvero**, non al file nel repo.

- [ ] **Step 3: Applicare la migrazione in produzione**

Con la Management API via `curl` (mai `urllib`, bloccato da Cloudflare). Poi verifica che
la tabella esista e che le policy siano due.

- [ ] **Step 4: Scrivere il test della funzione pura**

```typescript
it('scarta le righe il cui corpo non è una taratura', () => {
  // La colonna è JSONB: nessun vincolo di forma la protegge. Una riga scritta a mano o
  // rimasta da una versione precedente non deve far cadere l'editor.
  const risolte = taratureDaRighe([
    { chiave: 'compressore', taratura: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [] } },
    { chiave: 'tanica', taratura: { sx: 'due' } },
    { chiave: 'ignoto:XYZ', taratura: { dx: 0, dy: 0, sx: 1, sy: 1, ancore: [] } },
  ])
  expect(Object.keys(risolte)).toEqual(['compressore'])
})
```

- [ ] **Step 5: Implementare, eseguire, vedere passare**

Run: `npx vitest run src/services/schemaImpianto/__tests__/tarature.test.ts`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/ src/services/schemaImpianto/tarature.ts src/services/schemaImpianto/__tests__/tarature.test.ts
git commit -m "feat(schema): la tabella delle tarature permanenti, scrittura al solo admin"
```

---

### Task 10: La taratura di pratica nel layout salvato, e il riattacco delle ancore sparite

**Files:**
- Modify: `src/services/schemaImpianto/persistenza.ts`
- Test: `src/services/schemaImpianto/__tests__/persistenza.test.ts`

**Interfaces:**
- Consumes: `Tarature` (Task 5)
- Produces: `LayoutSalvato.simboli?: Tarature`; `riconcilia` che riattacca gli archi
  orfani

`VERSIONE` resta **1**: la taratura è un campo opzionale in più, non un cambio di formato —
la stessa ragione già decisa per `muroX`.

Il committente ha scelto che le pratiche salvate **si ridisegnino** con la libreria nuova.
Ma togliendo un'ancora, un layout salvato può citarne una che non esiste più: gli id delle
ancore entrano negli archi salvati. Il tubo si riattacca all'**ancora compatibile più
vicina** — compatibile secondo `accetta` — invece di sparire.

- [ ] **Step 1: Scrivere i test, sulla porta che la produzione usa**

I test stanno su `layoutIniziale`, non su `riconcilia`: è la sola strada che la produzione
percorre, ed è nel passaggio fra le due che il difetto peggiore del D4 si era nascosto.

Nota sui nomi: un capo di arco è `{ nodo, ancora }` (`SchemaCapo`), quindi si legge
`arco.da.ancora` e `arco.a.ancora`. E `layoutIniziale(salvato, modello)` restituisce un
`EsitoRiconciliazione`, non il layout: il layout è `.layout`.

```typescript
it('un arco che cita un ancora sparita si riattacca alla compatibile più vicina', () => {
  const salvato = { ...layoutConArcoSu('sx'), simboli: { tanica: taraturaSenzaAncora('sx') } }
  const { layout } = layoutIniziale(salvato, modelloDiRiferimento)
  const arco = layout.archi[0]
  expect(arco.da.ancora).not.toBe('sx')
  expect(arco.da.ancora).toBeTruthy()   // non sparisce
})

it("non si riattacca a un ancora che accetta un altro fluido", () => {
  // Un tubo d'aria non deve finire sull ancora della condensa solo perché è la più vicina.
  const salvato = { ...layoutConArcoAria('sx'), simboli: { tanica: soloAncoraCondensa() } }
  const { layout } = layoutIniziale(salvato, modelloDiRiferimento)
  // Nessuna ancora compatibile: l'arco resta senza capo risolvibile e la riconciliazione
  // lo tratta come già fa oggi coi riferimenti che non risolvono — verifica quale sia quel
  // comportamento leggendo `riconcilia` prima di fissare l'attesa qui.
  expect(arcoRisolto(layout, 'A1')).toBe(false)
})

it('la taratura di pratica sopravvive al salvataggio e alla rilettura', () => {
  const t = { dx: -3, dy: 0, sx: 1.07, sy: 1, ancore: [{ id: 'sx', x: 30, y: 130, accetta: ['aria'] }] }
  const riletto = deserializzaLayout(serializzaLayout({ ...layoutMinimo, simboli: { tanica: t } }))
  expect(riletto.simboli?.tanica).toEqual(t)
})

it('la versione non si alza: un layout salvato prima resta leggibile', () => {
  expect(serializzaLayout(layoutMinimo).versione).toBe(1)
})
```

- [ ] **Step 2: Eseguire e vedere fallire**

- [ ] **Step 3: Implementare**

`serializzaLayout` scrive `simboli` solo se c'è (come già fa con `muroX`).
`deserializzaLayout` lo rilegge. `riconcilia` riattacca gli archi orfani.

- [ ] **Step 4: Eseguire, e vederli cadere per mutazione**

Togli il filtro su `accetta` nel riattacco: il secondo test deve cadere. Ripristina **dalla
copia**.

- [ ] **Step 5: Commit**

```bash
git add src/services/schemaImpianto/persistenza.ts src/services/schemaImpianto/__tests__/persistenza.test.ts
git commit -m "feat(schema): la taratura di pratica si salva, e gli archi orfani si riattaccano"
```

---

### Task 11: `useTaratura` — i gesti, senza react-flow

**Files:**
- Create: `src/components/schemaImpianto/useTaratura.ts`
- Create: `src/components/schemaImpianto/__tests__/useTaratura.test.ts`

**Interfaces:**
- Consumes: `TaraturaSimbolo`, `TARATURA_NEUTRA` (Task 5), `allineaAllaGriglia`
  (`griglia.ts`)
- Produces:
  - `function spostaAncora(t: TaraturaSimbolo, id: string, x: number, y: number): TaraturaSimbolo` — aggancia **sempre** alla griglia
  - `function aggiungiAncora(t: TaraturaSimbolo, accetta: SchemaTipoAggancio[], x: number, y: number): TaraturaSimbolo`
  - `function togliAncora(t: TaraturaSimbolo, id: string): TaraturaSimbolo`
  - `function trasla(t: TaraturaSimbolo, dx: number, dy: number): TaraturaSimbolo` — **libera**, non agganciata
  - `function deforma(t: TaraturaSimbolo, sx: number, sy: number): TaraturaSimbolo` — libera
  - `useTaratura(iniziale)` con la propria cronologia

La regola che tiene insieme il gesto: **le ancore si muovono solo sulla griglia, la sagoma
si muove libera.** Prima si avvicina il blocco traslando, poi si deforma dello stretto
necessario.

- [ ] **Step 1: Scrivere i test dei gesti**

```typescript
describe('i gesti della taratura', () => {
  it("l ancora si posa sempre sulla griglia, anche a metà passo", () => {
    const t = spostaAncora(conAncora('sx', 0, 130), 'sx', 33, 147)
    expect(t.ancore[0]).toMatchObject({ x: 30, y: 150 })
  })

  it('la sagoma si trasla libera, senza agganciarsi', () => {
    expect(trasla(TARATURA_NEUTRA, -3, 0)).toMatchObject({ dx: -3, dy: 0 })
  })

  it('la deformazione non tocca le ancore', () => {
    // È il cuore del meccanismo: se la scala muovesse anche le ancore, il gesto di
    // avvicinare il blocco al pallino non servirebbe a niente.
    const t = deforma(conAncora('sx', 30, 130), 1.07, 1)
    expect(t.ancore[0]).toMatchObject({ x: 30, y: 130 })
  })

  it("l ancora nuova nasce sulla griglia e con un id che non collide", () => {
    const t = aggiungiAncora(conAncora('sx', 30, 130), ['aria'], 117, 130)
    expect(t.ancore).toHaveLength(2)
    expect(t.ancore[1].x).toBe(120)
    expect(t.ancore[1].id).not.toBe('sx')
  })

  it("togliere un ancora lascia le altre dove sono", () => {
    const t = togliAncora(conDueAncore(), 'sx')
    expect(t.ancore.map((a) => a.id)).toEqual(['dx'])
  })
})
```

- [ ] **Step 2: Eseguire e vedere fallire**

- [ ] **Step 3: Implementare le funzioni pure e l'hook**

Gli id delle ancore nuove devono essere **stabili e parlanti**: entrano negli archi salvati,
e cambiarli invalida i layout esistenti. Genera `sx-2`, `dx-2`, … a partire dal lato più
vicino, non `ancora-<numero casuale>`.

- [ ] **Step 4: Eseguire, e vedere cadere per mutazione**

Fai agganciare alla griglia anche `trasla`: il secondo test deve cadere. Ripristina dalla
copia.

- [ ] **Step 5: Commit**

```bash
git add src/components/schemaImpianto/useTaratura.ts src/components/schemaImpianto/__tests__/useTaratura.test.ts
git commit -m "feat(schema): i gesti della taratura, ancore sulla griglia e sagoma libera"
```

---

### Task 12: Il modo taratura sulla tela, e il dialogo a tre vie

**Files:**
- Create: `src/components/schemaImpianto/BarraTaratura.tsx`
- Modify: `src/components/schemaImpianto/SchemaEditor.tsx`, `SchemaNodeSymbol.tsx`

**Interfaces:**
- Consumes: `useTaratura` (Task 11), `scriviTaraturaPermanente` (Task 9)
- Produces: nessuna API nuova per altri task

Niente test di interfaccia (`CLAUDE.md`): la logica provabile sta già in `useTaratura`.

- [ ] **Step 1: L'interruttore e lo stato del modo**

Un pulsante in barra passa dal disegnare l'impianto al tarare il simbolo selezionato.
Attivo solo con **un** nodo selezionato: tarare senza sapere quale simbolo non vuol dire
nulla. In modo taratura, i comandi che agiscono sull'impianto (aggiungi nodo, elimina,
allinea) si spengono — non convivono con la taratura, e lasciarli accesi inviterebbe a
cancellare un'apparecchiatura credendo di togliere un'ancora.

- [ ] **Step 2: I pallini trascinabili e le maniglie**

I pallini si muovono solo sulla griglia (`spostaAncora` ci pensa già). Le maniglie ai bordi
traslano e deformano. **`browser_drag` non è affidabile su react-flow**: quando proverai in
pagina, usa una sequenza di mosse a più passi.

- [ ] **Step 3: Aggiunta, rimozione e tipo dell'ancora**

Un doppio clic sulla sagoma aggiunge un'ancora nel punto agganciato alla griglia; il Canc,
in modo taratura, toglie quella selezionata; un gruppo di tre interruttori dichiara cosa
accetta (aria, condensa, valvola di sicurezza). Almeno un'ancora deve restare: una senza
alcun tipo accettato non serve, e un simbolo senza ancore non si può più collegare.

- [ ] **Step 4: Il dialogo a tre vie all'uscita**

Le tre vie chieste dal committente: **torna a default** (cancella la taratura di questa
pratica e, se l'utente è amministratore e la chiede, anche quella permanente), **rendi
permanenti** (scrive in tabella; visibile **solo all'amministratore**), **usa solo questa
volta** (resta nel layout della pratica).

Non esiste uscita implicita: chiudere il modo taratura passa sempre di qui. Escape annulla
la taratura in corso, com'è già la via d'uscita sicura dall'editor.

- [ ] **Step 5: Verifica in pagina**

Dev server sulla **5176**. Verifica che giri **dal worktree giusto**: risali al processo
proprietario della porta, non fidarti del `--port` nella riga di comando.

```powershell
Get-NetTCPConnection -LocalPort 5176 -State Listen | Select-Object OwningProcess
Get-CimInstance Win32_Process -Filter "ProcessId = <pid>" | Select-Object CommandLine
```

Apri sempre con un `browser_navigate` esplicito. I dialoghi si impilano: identificali per
titolo, mai col primo `querySelector`, e **mai `.first()` su un selettore largo**.

- [ ] **Step 6: Commit**

```bash
git add src/components/schemaImpianto/
git commit -m "feat(schema): il modo taratura sulla tela, col dialogo a tre vie"
```

---

### Task 13: I segni che non hanno ancore

**Files:**
- Modify: `src/services/schemaImpianto/symbols/index.ts` (`valvolaIntercettazione`,
  `riduttorePressione`, `simboloMuro` in `renderSvg.ts`, la freccia di flusso, i tratteggi)

**Interfaces:**
- Consumes: i ritagli del Task 1 (`cad-riduttore.png`, `cad-valvole.png`, `cad-muro.png`,
  `cad-freccia.png`, `cad-tubazioni.png`, `cad-linea-condense.png`)
- Produces: nessuna API nuova

Entrano nella fedeltà al CAD ma **non** nel modo taratura: non avendo ancore, non c'è nulla
da tarare.

- [ ] **Step 1: Misurare i sei segni sui ritagli**

- [ ] **Step 2: Scrivere i test sulle proporzioni che contano**

Per ciascuno, il rapporto fra le sue misure e la lunghezza del tratto su cui si posa. Il
riduttore misura `9.0 x 5.6` nel CAD (rapporto 1,60), la freccia `5.6 x 3.7` (1,50).

- [ ] **Step 3: Ridisegnare, eseguire, leggere i riferimenti che cadono**

Il tratteggio delle condense ha **una sola fonte** (`TRATTEGGIO_CONDENSE`), sistemata nel
D4: se lo cambi, cambia in entrambi i posti da sé. Non reintrodurre una seconda costante.

- [ ] **Step 4: Confronto affiancato e commit**

```bash
git add src/services/schemaImpianto/
git commit -m "feat(schema): valvole, riduttore, freccia e muro fedeli ai blocchi"
```

---

### Task 14: La prova su una pratica vera

**Files:** nessuno — è una verifica

- [ ] **Step 1: Aprire le due pratiche che hanno un layout salvato**

ORVED (`a8bbdbe1-f7ad-40d9-86a0-9483b5dcc7f4`) e LOWA R&D
(`c6f56ca5-d57b-408c-a4e5-69a207812b0d`) sono gli unici due layout salvati in produzione, e
quindi l'unico caso reale di riapertura con simboli cambiati. Verifica che si riaprano coi
simboli nuovi, che le apparecchiature siano dove erano e che nessun tubo sia rimasto senza
capo.

- [ ] **Step 2: Tarare un simbolo, salvare, riaprire**

Aggiungi un'ancora a un serbatoio, scegli «usa solo questa volta», salva, esci, riapri.
La taratura deve tornare. È il gesto che nel D4 aveva scoperto il difetto peggiore del
blocco — il muro che non tornava mai — e vale la pena rifarlo qui.

- [ ] **Step 3: Rendere permanente da amministratore, e verificare che un'altra pratica la erediti**

- [ ] **Step 4: Verificare che un utente non amministratore non veda «rendi permanenti»**

- [ ] **Step 5: Generare il `.docx` e confrontarlo con la tela**

Il documento e la tela devono mostrare gli stessi simboli: passano dalla stessa libreria
risolta, ma è il tipo di cosa che si verifica guardando, non deducendo.

- [ ] **Step 6: Suite intera e `tsc`**

Run: `npx vitest run && npx tsc --noEmit`

---

## Domande aperte, che questo piano non chiude

Il committente ha chiesto di sistemarle **dopo** il Blocco 3, in un blocco a sé:

- Un'apparecchiatura trascinata sopra quota zero resta tagliata nel `.docx`.
- Ctrl+Z dopo un Canc su un nodo con tubazioni riporta il nodo ma non le tubazioni.
- Un TEE innestato su un tubo fuori griglia si stacca alla prima spinta del mouse
  (**potrebbe chiudersi da sé col Task 8**: verificalo prima di aprire un lavoro).
- Un TEE su una linea condense produce archi condensa su ancore che accettano solo aria.
- Le due metà di un tubo spezzato nascono con gomiti espliciti.
- Spazi multipli collassati nelle annotazioni; «Rigenera da capo» butta via le annotazioni.
- `customers.descrizione_attivita` di LOWA R&D contiene «prova attività ATECOOO».
- «Genera comunque .docx» scrive nel catalogo condiviso.

## Decisioni del committente, da non ridiscutere

- **Le pratiche salvate si ridisegnano** con la libreria nuova. Scartato il congelamento per
  pratica: un documento già consegnato, se rigenerato, esce diverso, ed è un prezzo accettato.
- **Una taratura vale per tutti i simboli di quel tipo**, non per la singola apparecchiatura.
- **Solo l'amministratore rende permanente** una taratura.
- **Le ancore non si scalano**: è ciò che rende sensato traslare e deformare la sagoma.
- **Niente import automatico dei tracciati**: i simboli sono composizioni che cambiano col
  dato, e un path importato perderebbe le parti che si accendono e si spengono.
- **Nel file CAD non esistono punti di attacco**: la posizione delle ancore può venire solo
  dalle mani del committente.
