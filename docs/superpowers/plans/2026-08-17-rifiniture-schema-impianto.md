# Rifiniture dell'editor dello schema d'impianto — piano di attuazione

> **Per chi esegue:** SOTTO-SKILL RICHIESTA: `superpowers:subagent-driven-development` (consigliata)
> oppure `superpowers:executing-plans`, un task alla volta. I passi usano caselle (`- [ ]`).

**Obiettivo:** applicare le cinque rifiniture che il committente ha chiesto il 17-08-2026 dopo aver
provato in produzione il Blocco 3 — frecce di direzione da posare a mano, scritta del terminale
utenze sopra la freccia, oggetti nuovi vicino al disegno, pallino del TEE dimezzato, ondulazione
dei flessibili più dolce.

**Impostazione:** nessuna tocca il modello dei dati né le ancore. Quattro sono cambi di geometria
in `symbols/index.ts` e `tratti.ts`; una sola (R1) aggiunge un tipo di segno e attraversa entrambe
le catene di disegno — quella dell'editor (`SchemaEdgeTubazione.tsx`) e quella del documento
(`renderSvg.ts`). L'ordine dei task va dal cambiamento più isolato al più esteso, così ogni
aggiornamento dei riferimenti SVG resta leggibile nel proprio commit.

**Tecnologie:** TypeScript, React 18, `@xyflow/react`, Vitest. SVG scritto a mano come stringhe.

**Specifica:** `docs/superpowers/specs/2026-08-17-rifiniture-schema-impianto-design.md`

## Vincoli globali

- **Tre comandi prima di chiudere qualunque task**, tutti dal worktree:
  `npx vitest run`, `npx tsc --noEmit`,
  `npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0`.
  Il lint deve fermarsi ai **tre warning preesistenti** (react-refresh su `SchemaEditor.tsx` e
  `SchemaNodeSymbol.tsx`, exhaustive-deps su `TestiLiberi.tsx`): non sono nostri, non si toccano.
  Zero errori.
- **Niente `prettier --write`**: il `.prettierrc` non corrisponde allo stile del codice.
- **Ogni test nuovo va visto cadere per mutazione**, e va messo sulla porta più esterna che la
  produzione usa (`renderSvg`, `simboloDi`, `ondula`), mai su una funzione interna. Le mutazioni si
  ripristinano **da una copia** (`cp` prima, `cp` indietro), **mai con `git checkout`**.
- **I commenti si accorciano invece di precisarli**: un commento che non nomina un file, un indice
  o una misura non può puntare a quello sbagliato. Attenzione ai rimandi incrociati — correggerne
  uno può renderne falso un altro.
- **Nessun test di interfaccia** per i componenti (`CLAUDE.md`): la logica provabile sta negli hook
  e nei servizi.
- **I riferimenti SVG non si aggiornano per far tornare verde un test.** Prima si legge la
  differenza, si verifica che sia quella attesa **e nient'altro**, e il commit dice cosa cambiava.
  La ricetta per rigenerarli è in fondo, in appendice.
- **Nessuna migrazione di dati**, in nessun task. I layout salvati si leggono come sono.

## Struttura dei file

| File | Responsabilità | Task |
|---|---|---|
| `src/services/schemaImpianto/symbols/index.ts` | geometria di tutti i simboli | 1, 4, 5 |
| `src/services/schemaImpianto/tratti.ts` | tracciati e geometria lungo la polilinea | 2, 3 |
| `src/services/schemaImpianto/renderSvg.ts` | disegno del documento, legenda, `<defs>` | 4, 5 |
| `src/services/schemaImpianto/types.ts` | tipi del layout, `SchemaSegnoTuboTipo` | 4 |
| `src/services/schemaImpianto/buildSchemaModel.ts` | etichetta di default del terminale | 5 |
| `src/components/schemaImpianto/SchemaEdgeTubazione.tsx` | disegno dei segni sulla tela | 4 |
| `src/components/schemaImpianto/SchemaEditor.tsx` | barra strumenti, posa dei nuovi oggetti | 4, 6 |
| `__tests__/fixtures/svgRiferimento*.ts` | tre riferimenti SVG committati | 1, 2, 4, 5 |

---

### Task 1: Il pallino del TEE al 50%

**File:**
- Modifica: `src/services/schemaImpianto/symbols/index.ts:755` (`DIAMETRO_GIUNZIONE`) e il commento
  a `:144`
- Test: `src/services/schemaImpianto/__tests__/simboli.test.ts:461-469`
- Riferimento: `src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts`

**Interfacce:**
- Consuma: niente dai task precedenti.
- Produce: `DIAMETRO_GIUNZIONE = 5` (invariata la firma). Nessun altro task ne dipende.

**Cosa NON si tocca:** le ancore della giunzione (il committente lo ha detto esplicitamente) e la
punta di freccia sopra il pallino, che porta il verso del flusso — decisa col committente il
15-08-2026.

- [ ] **Passo 1: sostituire il test tautologico con uno che legge il disegno**

Il test di oggi contiene `expect(DIAMETRO_GIUNZIONE).toBe(10)` accanto a
`expect(raggio).toBe(DIAMETRO_GIUNZIONE / 2)`: la seconda riga confronta due costanti fra loro e
non discrimina nulla, la prima è l'unica che lega il valore. Sostituire l'intero `it` con:

```ts
  it('il pallino ha raggio 2,5 e sta dentro il riquadro, con le ancore nel centro', () => {
    // Letto dal disegno reso, non dalla costante: `expect(raggio).toBe(DIAMETRO_GIUNZIONE / 2)`
    // confrontava la costante con se stessa e sarebbe rimasto verde a qualunque valore.
    // Il vincolo vecchio — raggio uguale a metà larghezza, per toccare le ancore sui bordi — non
    // esiste più: le ancore stanno nel CENTRO del pallino, quindi non c'è buco a nessun raggio,
    // ed è precisamente ciò che permette al pallino di rimpicciolire.
    const raggio = Number(/r="([\d.]+)"/.exec(simboloGiunzione(nodo))![1])
    expect(raggio).toBe(2.5)
    expect(raggio).toBeLessThan(REGISTRO_SIMBOLI.giunzione.dimensioni.larghezza / 2)
  })
```

- [ ] **Passo 2: vederlo cadere**

Comando: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts -t "il pallino ha raggio"`
Atteso: FALLISCE, `expected 5 to be 2.5`.

- [ ] **Passo 3: dimezzare la costante e accorciare il commento che la cita**

In `symbols/index.ts:755`:

```ts
export const DIAMETRO_GIUNZIONE = 5
```

Il commento a `:144` dice oggi «(`DIAMETRO_GIUNZIONE`, 10), la sola cosa che deve contenere»: la
cifra ripetuta nel testo è esattamente il genere di dettaglio che invecchia. Toglierla:

```ts
  // (`DIAMETRO_GIUNZIONE`), la sola cosa che deve contenere.
```

Aggiornare anche il commento sopra `DIAMETRO_GIUNZIONE`, se nomina il valore vecchio, con la stessa
regola: si accorcia, non si riscrive la cifra.

- [ ] **Passo 4: verificare che passi, e guardare cos'altro è caduto**

Comando: `npx vitest run src/services/schemaImpianto`
Atteso: il test del pallino PASSA; cade il riferimento `SVG_RIFERIMENTO_CON_TEE` (è l'unico dei tre
che contiene una giunzione). Se cadesse anche uno degli altri due, **fermarsi**: vuol dire che il
pallino compare dove non ci si aspettava, e va capito prima di aggiornare qualcosa.

- [ ] **Passo 5: aggiornare il riferimento con il TEE**

Rigenerarlo con la ricetta in appendice. Nel diff deve cambiare **solo** l'attributo `r` dei
`<circle>` della giunzione, da `5` a `2.5`. Nessuna coordinata, nessun `viewBox`, nessuna riga di
tabella: le ancore non si sono mosse. Se cambia altro, fermarsi e capire.

Aggiungere in coda al commento di testa della fixture:

```
 * Generato di nuovo il 17-08-2026 (rifinitura R4): il pallino della giunzione dimezza il raggio
 * (2,5 anziché 5) su richiesta del committente. Le ancore restano dove sono, quindi nessuna
 * coordinata di nodo o di tubo si sposta.
```

- [ ] **Passo 6: i tre comandi**

```bash
npx vitest run
npx tsc --noEmit
npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
```

- [ ] **Passo 7: commit**

```bash
git add src/services/schemaImpianto/symbols/index.ts \
        src/services/schemaImpianto/__tests__/simboli.test.ts \
        src/services/schemaImpianto/__tests__/fixtures/svgRiferimentoConTee.ts
git commit -m "feat(schema): il pallino del TEE dimezza il raggio"
```

- [ ] **Passo 8: guardarlo in pagina prima di dire che è fatto**

Il committente chiede che la punta di freccia sopra il pallino **resti leggibile** a diametro
dimezzato. Aprire l'editor su una pratica con un TEE (vedi «Provare in pagina» in appendice) e
guardarlo. Se la punta sovrasta il pallino al punto da nasconderlo, **non correggere di iniziativa**:
riferire al committente con l'immagine.

---

### Task 2: L'ondulazione dei flessibili, più dolce

**File:**
- Modifica: `src/services/schemaImpianto/tratti.ts:17` (`PASSO_ONDA`) e i commenti di `ondula`
- Test: `src/services/schemaImpianto/__tests__/tratti.test.ts`
- Riferimenti: tutti e tre, se contengono un flessibile (la mandata del compressore lo è)

**Interfacce:**
- Consuma: niente.
- Produce: `PASSO_ONDA = 10`. Il Task 4 rimuove il `marker-end` che uno dei commenti di `ondula`
  cita: i due task si incrociano **nei commenti**, non nel codice.

**L'intento vince sulla formula.** Il committente ha chiesto «un periodo metà dell'attuale», ma
dimezzare il periodo raddoppia le ondulazioni e le infittisce — l'opposto di ciò che descrive
(«troppo fitte», «più dolce»). Si **raddoppia** il passo: metà delle onde sulla stessa lunghezza.

- [ ] **Passo 1: legare il valore a un test che non sia parametrico**

I test di oggi scrivono `50 / PASSO_ONDA` e `PASSO_ONDA * semiperiodi`: restano verdi a qualunque
valore della costante. Ne serve **uno** che fissi la misura. In `tratti.test.ts`, dentro il
`describe` di `ondula`, accanto al test «mette un'onda ogni PASSO_ONDA unità», aggiungere:

```ts
  it('un flessibile di 50 unità porta cinque semiperiodi, non dieci', () => {
    // Misura letterale di proposito: gli altri test di questo describe sono parametrici su
    // PASSO_ONDA e resterebbero verdi a qualunque passo. Il committente ha chiesto onde più
    // larghe (17-08-2026): questa è la riga che se ne accorge se qualcuno le infittisce di nuovo.
    expect(arriviQ(ondula([{ x: 0, y: 0 }, { x: 50, y: 0 }]))).toHaveLength(5)
  })
```

- [ ] **Passo 2: vederlo cadere**

Comando: `npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts -t "cinque semiperiodi"`
Atteso: FALLISCE, lunghezza 10 invece di 5.

- [ ] **Passo 3: raddoppiare il passo**

In `tratti.ts:17`:

```ts
export const PASSO_ONDA = 10
```

`AMPIEZZA_ONDA` resta **5**: il committente ha parlato di onde fitte, non di onde alte. Come effetto
collaterale gradito, passo e ampiezza smettono di coincidere — il commento a `tratti.test.ts:155`
avvertiva che con due valori uguali nessuna misura poteva distinguerli. Aggiornarlo: ora si
distinguono, e la ragione per cui il test li misura separatamente resta valida.

- [ ] **Passo 4: verificare, e guardare i tratti brevi**

Comando: `npx vitest run src/services/schemaImpianto`

Atteso: il test nuovo PASSA. Cadono i riferimenti SVG che contengono un flessibile.

**Guardare inoltre il caso limite**, che questo cambiamento rende più frequente: un flessibile con
un solo semiperiodo diventa **rettilineo** (l'ultimo semiperiodo ha ampiezza nulla per far entrare
il tubo dritto nel raccordo). Con passo 10, ogni flessibile sotto le ~15 unità sparisce come onda.
Verificare che il test «un tratto cortissimo non produce zero semiperiodi» (`tratti.test.ts:115`)
copra ancora il suo caso — la soglia di cui parla il suo commento (2,5 unità) ora è 5 — e
**correggere quel commento**, non solo il test.

- [ ] **Passo 5: aggiornare i riferimenti caduti**

Ricetta in appendice. Nel diff devono cambiare **solo** i `d="M ... Q ..."` dei tratti flessibili,
con **metà** dei comandi `Q` di prima. Nessuna coordinata di nodo, nessun `viewBox`: la polilinea
sottostante non cambia, cambia come la si ondula. Il campione «Tubazione flessibile» della legenda
(`campioneTubazione`) cambia anch'esso, ed è corretto che cambi.

Annotare in coda al commento di testa di ogni fixture toccata:

```
 * Generato di nuovo il 17-08-2026 (rifinitura R5): il passo dell'onda del flessibile passa da 5 a
 * 10 — metà delle ondulazioni sulla stessa lunghezza, su richiesta del committente. Cambia solo il
 * tracciato dei tratti flessibili (disegno e campione di legenda); nessuna posizione si sposta.
```

- [ ] **Passo 6: i tre comandi** (come nel Task 1)

- [ ] **Passo 7: commit**

```bash
git add src/services/schemaImpianto/tratti.ts \
        src/services/schemaImpianto/__tests__/tratti.test.ts \
        src/services/schemaImpianto/__tests__/fixtures/
git commit -m "feat(schema): onde del flessibile più larghe, metà per la stessa lunghezza"
```

- [ ] **Passo 8: mostrarlo al committente**

C'è una **contraddizione dichiarata** fra le sue parole e il suo intento (vedi la specifica). Prima
di considerare chiusa la rifinitura, mostrargli il flessibile in pagina e farsi dire se è questo che
voleva. Se voleva davvero il doppio delle onde, si torna a `PASSO_ONDA = 2.5` — ma va detto da lui.

---

### Task 3: La direzione del tratto, non solo la sua giacitura

**File:**
- Modifica: `src/services/schemaImpianto/tratti.ts:233-256` (`puntoSuTratto`)
- Test: `src/services/schemaImpianto/__tests__/tratti.test.ts`

**Interfacce:**
- Consuma: niente.
- Produce: `puntoSuTratto(punti, t)` restituisce
  `{ punto: Punto; orizzontale: boolean; direzione: Punto }`, dove `direzione` è il **versore** del
  segmento su cui cade `t` (lunghezza 1), orientato **nel verso di percorrenza della polilinea**.
  I due campi esistenti non cambiano né significato né tipo. Lo usano il Task 4
  (`renderSvg.ts`, `SchemaEdgeTubazione.tsx`) e nessun altro.

Questo task non cambia niente di visibile: prepara il terreno a R1. Una freccia ha bisogno del
**verso**, che `orizzontale: boolean` non porta — e i tratti possono essere diagonali, dove
`orizzontale` è `false` e «verticale» sarebbe una bugia.

- [ ] **Passo 1: il test**

In `tratti.test.ts`, nel `describe` di `puntoSuTratto`:

```ts
  it('riporta il versore del tratto, col verso di percorrenza', () => {
    const orizzontale = puntoSuTratto([{ x: 0, y: 0 }, { x: 100, y: 0 }], 0.5)
    expect(orizzontale.direzione).toEqual({ x: 1, y: 0 })

    // Stessa giacitura, percorsa al contrario: `orizzontale` non distingue i due casi, la
    // direzione sì — ed è la differenza fra una freccia che indica il flusso e una che lo nega.
    const alContrario = puntoSuTratto([{ x: 100, y: 0 }, { x: 0, y: 0 }], 0.5)
    expect(alContrario.orizzontale).toBe(true)
    expect(alContrario.direzione).toEqual({ x: -1, y: 0 })

    // Su una diagonale il versore è normalizzato: chi disegna moltiplica per la propria misura.
    const diagonale = puntoSuTratto([{ x: 0, y: 0 }, { x: 30, y: 40 }], 0.5)
    expect(diagonale.direzione.x).toBeCloseTo(0.6)
    expect(diagonale.direzione.y).toBeCloseTo(0.8)
  })

  it('su una polilinea prende il versore del segmento su cui cade t, non del primo', () => {
    // Due segmenti di uguale lunghezza: t=0.75 cade in mezzo al secondo, che scende.
    const punti = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]
    expect(puntoSuTratto(punti, 0.75).direzione).toEqual({ x: 0, y: 1 })
  })
```

- [ ] **Passo 2: vederlo cadere**

Comando: `npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts -t "versore"`
Atteso: FALLISCE, `direzione` è `undefined`.

- [ ] **Passo 3: l'implementazione**

In `puntoSuTratto`, i tre `return` devono portare anche la direzione. Per i due casi degeneri
(nessun punto, un punto solo) non esiste un tratto: la direzione è `{ x: 1, y: 0 }`, la stessa
convenzione con cui quei rami già dichiarano `orizzontale: true`.

```ts
export function puntoSuTratto(
  punti: Punto[],
  t: number
): { punto: Punto; orizzontale: boolean; direzione: Punto } {
  // Senza un tratto vero non c'è una direzione da riportare: `{1,0}` è la stessa convenzione con
  // cui questi due rami dichiarano già `orizzontale: true`.
  if (punti.length === 0) return { punto: { x: 0, y: 0 }, orizzontale: true, direzione: { x: 1, y: 0 } }
  if (punti.length === 1) return { punto: punti[0], orizzontale: true, direzione: { x: 1, y: 0 } }

  const lunghezze = punti.slice(1).map((p, i) => Math.hypot(p.x - punti[i].x, p.y - punti[i].y))
  const totale = lunghezze.reduce((s, l) => s + l, 0)
  const target = Math.max(0, Math.min(1, t)) * totale

  let percorsa = 0
  for (let i = 0; i < lunghezze.length; i++) {
    const l = lunghezze[i]
    if (percorsa + l >= target || i === lunghezze.length - 1) {
      const frazioneLocale = l === 0 ? 0 : (target - percorsa) / l
      const a = punti[i]
      const b = punti[i + 1]
      return {
        punto: { x: a.x + (b.x - a.x) * frazioneLocale, y: a.y + (b.y - a.y) * frazioneLocale },
        orizzontale: a.y === b.y,
        // Versore del segmento su cui `t` cade, nel verso in cui la polilinea lo percorre: è
        // quello che orienta la freccia di direzione. Segmento di lunghezza nulla (gomito posato
        // sull'ancora): niente da normalizzare, si tiene la convenzione dei rami degeneri sopra.
        direzione: l === 0 ? { x: 1, y: 0 } : { x: (b.x - a.x) / l, y: (b.y - a.y) / l },
      }
    }
    percorsa += l
  }
  return { punto: punti[punti.length - 1], orizzontale: true, direzione: { x: 1, y: 0 } }
}
```

- [ ] **Passo 4: verificare, e vederlo cadere per mutazione**

```bash
npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts
```
Atteso: PASSA, e nient'altro cade (i chiamatori leggono per destrutturazione, un campo in più non
li disturba).

Poi la mutazione, **da copia**:

```bash
cp src/services/schemaImpianto/tratti.ts /tmp/tratti.bak
# togliere la divisione per `l` nella direzione (versore non normalizzato)
npx vitest run src/services/schemaImpianto/__tests__/tratti.test.ts -t "versore"   # deve FALLIRE
cp /tmp/tratti.bak src/services/schemaImpianto/tratti.ts
```

- [ ] **Passo 5: i tre comandi** (come nel Task 1)

- [ ] **Passo 6: commit**

```bash
git add src/services/schemaImpianto/tratti.ts src/services/schemaImpianto/__tests__/tratti.test.ts
git commit -m "feat(schema): puntoSuTratto riporta anche il versore del tratto"
```

---

### Task 4: Le frecce di direzione diventano un oggetto da posare a mano

**File:**
- Modifica: `src/services/schemaImpianto/types.ts:143` (`SchemaSegnoTuboTipo`)
- Modifica: `src/services/schemaImpianto/symbols/index.ts` (nuova `frecciaDirezione`)
- Modifica: `src/services/schemaImpianto/renderSvg.ts:91,113,135` (via il `marker-end`
  automatico), `:183` (dispatch dei segni), `:244-268` (legenda), `:373` (i `<defs>`)
- Modifica: `src/components/schemaImpianto/SchemaEdgeTubazione.tsx:236-330,445-455`
- Modifica: `src/components/schemaImpianto/SchemaEditor.tsx:1240-1254` (pulsante in barra)
- Test: `renderSvg.test.ts`, `simboli.test.ts`
- Riferimenti: tutti e tre

**Interfacce:**
- Consuma: `puntoSuTratto(...).direzione` (Task 3).
- Produce:
  - `SchemaSegnoTuboTipo = 'valvola_intercettazione' | 'riduttore_pressione' | 'freccia_direzione'`
  - `frecciaDirezione(x: number, y: number, direzione: { x: number; y: number }): string` in
    `symbols/index.ts` — triangolo pieno **centrato** su `(x, y)`, orientato lungo `direzione`.

**Il più esteso dei cinque task.** Attraversa entrambe le catene di disegno. Nessuna migrazione: i
layout salvati contengono archi senza segni-freccia e resteranno senza punte finché qualcuno non ne
posa — è l'effetto voluto, ma **va detto al committente**.

**La freccia in cima al codolo del terminale utenze non c'entra e resta**: è un triangolo dentro
`simboloUtenze`, non un marker.

- [ ] **Passo 1: la misura, calcolata una volta sola**

La freccia di oggi è un `<marker>` con `markerWidth="9" markerHeight="6"` su `viewBox="0 0 15 10"`.
`markerUnits` non è dichiarato, quindi vale il default `strokeWidth`: con `stroke-width="2"` il
triangolo reso misura **18 × 12** unità utente. Il committente la vuole **al 70%**: **12,6 × 8,4**.

Queste due cifre vanno nel codice come costanti derivate, non come numeri magici:

```ts
/**
 * Freccia di direzione posata a mano sulla tubazione. Misura: il 70% della punta che fino al
 * 17-08-2026 ogni tratto portava in coda come `marker-end` — quel marker rendeva 18×12 unità
 * (9×6 moltiplicati per `stroke-width`, essendo `markerUnits` al suo default `strokeWidth`), e il
 * committente l'ha chiesta più piccola di un terzo abbondante.
 */
const FRECCIA = { lunghezza: 12.6, altezza: 8.4 }
```

- [ ] **Passo 2: il test del simbolo, prima del simbolo**

In `simboli.test.ts`, un `describe` nuovo:

```ts
describe('frecciaDirezione', () => {
  it('punta nel verso della direzione, centrata sul punto', () => {
    const svg = frecciaDirezione(100, 50, { x: 1, y: 0 })
    const punti = [...svg.matchAll(/([\d.-]+) ([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])])
    // Tre vertici: la punta avanti al centro, i due capi della base indietro e scostati.
    expect(punti).toHaveLength(3)
    expect(punti[0]).toEqual([106.3, 50])
    expect(punti.slice(1)).toEqual([
      [93.7, 45.8],
      [93.7, 54.2],
    ])
  })

  it('gira col tratto: su un montante che scende la punta guarda in giù', () => {
    const svg = frecciaDirezione(100, 50, { x: 0, y: 1 })
    const [puntaX, puntaY] = /M ([\d.-]+) ([\d.-]+)/.exec(svg)!.slice(1).map(Number)
    expect(puntaX).toBe(100)
    expect(puntaY).toBe(56.3)
  })

  it('è piena, come la punta che sostituisce', () => {
    expect(frecciaDirezione(0, 0, { x: 1, y: 0 })).toContain('fill="#000"')
  })
})
```

Aggiungere `frecciaDirezione` all'`import` in testa al file di test.

- [ ] **Passo 3: vederlo cadere**

Comando: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts -t "frecciaDirezione"`
Atteso: FALLISCE alla compilazione — `frecciaDirezione` non esiste.

- [ ] **Passo 4: il simbolo**

In `symbols/index.ts`, accanto a `riduttorePressione`:

```ts
/**
 * Freccia di direzione posata a mano sulla tubazione: triangolo pieno centrato sul punto, con la
 * punta nel verso in cui il tratto è percorso. Prende la direzione e non un orientamento
 * ('orizzontale' | 'verticale') come gli altri due segni, perché una freccia deve distinguere i
 * due versi della stessa giacitura — e i tratti possono essere diagonali.
 *
 * Non copre il tubo con un rettangolo bianco come fanno valvola e riduttore: la freccia sta SOPRA
 * la linea, non la interrompe.
 */
export function frecciaDirezione(x: number, y: number, direzione: { x: number; y: number }): string {
  const lunghezza = Math.hypot(direzione.x, direzione.y) || 1
  const ux = direzione.x / lunghezza
  const uy = direzione.y / lunghezza
  const px = -uy
  const py = ux
  const semiL = FRECCIA.lunghezza / 2
  const semiH = FRECCIA.altezza / 2
  const punta = { x: x + ux * semiL, y: y + uy * semiL }
  const baseA = { x: x - ux * semiL + px * semiH, y: y - uy * semiL + py * semiH }
  const baseB = { x: x - ux * semiL - px * semiH, y: y - uy * semiL - py * semiH }
  return `<path d="M ${arrotonda(punta.x)} ${arrotonda(punta.y)} L ${arrotonda(baseA.x)} ${arrotonda(baseA.y)} L ${arrotonda(baseB.x)} ${arrotonda(baseB.y)} Z" fill="#000" />`
}
```

Verificare che `arrotonda` sia già importata/definita in `symbols/index.ts`; se non lo è, usare la
stessa funzione che gli altri simboli del file usano per le cifre (non introdurne una seconda).

Se i vertici attesi nel test non coincidono al centesimo per via dell'arrotondamento, **correggere
il test sui valori veri letti dal disegno** — non allargare la tolleranza a caso, e non cambiare la
geometria per far tornare un numero.

- [ ] **Passo 5: il tipo e il dispatch nel documento**

In `types.ts:143`:

```ts
export type SchemaSegnoTuboTipo = 'valvola_intercettazione' | 'riduttore_pressione' | 'freccia_direzione'
```

In `renderSvg.ts`, il ciclo dei segni (oggi `:181-185`) diventa:

```ts
    for (const segno of arco.segni ?? []) {
      const { punto, orizzontale, direzione } = puntoSuTratto(reso.punti, segno.t)
      if (segno.tipo === 'freccia_direzione') {
        parti.push(frecciaDirezione(punto.x, punto.y, direzione))
        continue
      }
      const disegnaSegno = segno.tipo === 'riduttore_pressione' ? riduttorePressione : valvolaIntercettazione
      parti.push(disegnaSegno(punto.x, punto.y, orizzontale ? 'orizzontale' : 'verticale'))
    }
```

- [ ] **Passo 6: il test che toglie le punte d'ufficio**

In `renderSvg.test.ts`, il test «la tubazione che arriva al terminale non porta una seconda punta di
freccia, le altre sì» (`:173`) afferma l'esatto contrario di ciò che vogliamo ora. Va **riscritto**,
non cancellato:

```ts
  it('nessuna tubazione porta più una punta di freccia d’ufficio', () => {
    // Rovesciato il 17-08-2026 (rifinitura R1): fino a quel giorno ogni tratto portava
    // `marker-end="url(#freccia)"` e questo test verificava che il solo tratto verso il terminale
    // ne fosse esente. Ora le frecce si posano a mano, quindi non ne deve comparire nessuna da sé.
    const svg = renderSvg(svgMinimo())
    expect(svg).not.toContain('marker-end')
    expect(svg).not.toContain('url(#freccia)')
    expect(svg).not.toContain('<marker')
  })

  it('disegna una freccia dove il segno è posato, orientata come il tratto', () => {
    const layout = svgMinimo()
    const arco = layout.archi[0]
    arco.segni = [{ id: 'F1', tipo: 'freccia_direzione', t: 0.5 }]
    const svg = renderSvg(layout)
    // Un triangolo pieno in più rispetto allo stesso layout senza il segno: si conta la
    // differenza, non un letterale, perché il disegno porta già altri triangoli (la punta del
    // codolo utenze, le farfalle delle valvole).
    const senza = (renderSvg(svgMinimo()).match(/fill="#000"/g) ?? []).length
    const con = (svg.match(/fill="#000"/g) ?? []).length
    expect(con).toBe(senza + 1)
  })
```

Adattare la costruzione del layout alla forma vera di `svgMinimo()` nel file di test (se restituisce
un oggetto congelato o riusato, farne una copia prima di aggiungere il segno).

- [ ] **Passo 7: vederli cadere, poi togliere l'automatismo**

Comando: `npx vitest run src/services/schemaImpianto/__tests__/renderSvg.test.ts -t "punta di freccia"`
Atteso: FALLISCE.

Poi, in `renderSvg.ts`, togliere il `marker-end` dai tre punti che lo aggiungono:
- `:91` (flessibile) — via l'attributo dalla stringa;
- `:113` — via la variabile `freccia` e il suo uso; il parametro `frecciaFinale` di
  `renderMandataLinea` **non serve più**: toglierlo dalla firma e dalla chiamata a `:168-178`
  (`a.tipo !== 'utenze'`), o resta un argomento che non fa niente;
- `:135` (condensa) — via l'attributo.

E togliere il `<marker id="freccia">` dai `<defs>` a `:373`. Se i `<defs>` restano vuoti, togliere
anche l'elemento: un `<defs></defs>` vuoto in ogni documento è rumore che il prossimo lettore dovrà
spiegarsi.

**Attenzione ai commenti che citano quel marker:**
- `renderSvg.ts:155-157` spiega perché il tratto verso il terminale non porta la freccia: non ha più
  oggetto, va tolto.
- `tratti.ts:145` (in testa a `ondula`) motiva l'ampiezza nulla dell'ultimo semiperiodo con
  l'orientamento di `marker-end`. Quel comportamento **resta** — l'altra ragione, i blocchi CAD dove
  il flessibile entra dritto nel raccordo, è ancora buona — ma la motivazione principale è decaduta.
  Riscrivere il paragrafo tenendo la ragione CAD e togliendo quella del marker. È il rimando
  incrociato di cui parlano i vincoli globali: correggere `renderSvg.ts` senza correggere questo
  lascia in casa un commento falso.
- Stessa verifica su `tratti.test.ts:37-38,129,171`, che citano `marker-end` nei propri commenti.

- [ ] **Passo 8: la legenda**

In `righeLegenda` (`renderSvg.ts:244`), aggiungere la voce, subito dopo il riduttore:

```ts
  if (segni.some((s) => s.tipo === 'freccia_direzione')) {
    righe.push({ sinistra: { simbolo: frecciaDirezione(0, 0, { x: 1, y: 0 }) }, descrizione: 'Direzione del flusso' })
  }
```

Con un test in `renderSvg.test.ts`:

```ts
  it('la legenda nomina la direzione del flusso solo se una freccia è posata', () => {
    expect(righeLegenda(svgMinimo()).map((r) => r.descrizione)).not.toContain('Direzione del flusso')
    const conFreccia = svgMinimo()
    conFreccia.archi[0].segni = [{ id: 'F1', tipo: 'freccia_direzione', t: 0.5 }]
    expect(righeLegenda(conFreccia).map((r) => r.descrizione)).toContain('Direzione del flusso')
  })
```

- [ ] **Passo 9: la tela dell'editor**

In `SchemaEdgeTubazione.tsx`:

- `SchemaSegnoProps` prende un campo in più: `direzione: Punto`.
- Nel corpo di `SchemaSegno`, sostituire il dispatch di `:301` e l'uso di `:326`:

```ts
  const markup =
    tipo === 'freccia_direzione'
      ? frecciaDirezione(0, 0, direzione)
      : (tipo === 'riduttore_pressione' ? riduttorePressione : valvolaIntercettazione)(0, 0, orientamento)
```

e passare `markup` a `dangerouslySetInnerHTML`. Il simbolo si disegna in `(0,0)` e il contenitore lo
trasla: il `<div>` è largo 40×40 con `translate(-50%,-50%)`, e la freccia (12,6×8,4) ci sta dentro
anche ruotata.

- Al punto di costruzione (`:445-455`), leggere e passare la direzione:

```ts
          const { punto, orizzontale, direzione } = puntoSuTratto(polilinea, segno.t)
```

```tsx
              orientamento={orizzontale ? 'orizzontale' : 'verticale'}
              direzione={direzione}
```

Importare `frecciaDirezione` accanto a `riduttorePressione` e `valvolaIntercettazione`.

- [ ] **Passo 10: il pulsante in barra**

In `SchemaEditor.tsx`, dopo «+ Riduttore» (`:1249-1254`), lo stesso schema:

```tsx
        <Button
          size="small"
          onClick={() => selezione.edges[0] && aggiungiSegno(selezione.edges[0].id, 'freccia_direzione')}
          disabled={selezione.edges.length !== 1 || modoTaratura}
        >
          + Freccia
        </Button>
```

- [ ] **Passo 11: i tre comandi, e i riferimenti**

```bash
npx vitest run
npx tsc --noEmit
npx eslint src/components/schemaImpianto src/services/schemaImpianto --max-warnings 0
```

Cadranno tutti e tre i riferimenti. Nel diff deve sparire `marker-end="url(#freccia)"` da ogni
`<path>` di tubazione e sparire il `<marker>` dai `<defs>`. **Nient'altro**: nessuna coordinata,
nessuna riga di tabella, nessuna voce di legenda in più (i layout di riferimento non portano segni
freccia). Se compare altro, fermarsi.

Annotare in coda a ogni fixture:

```
 * Generato di nuovo il 17-08-2026 (rifinitura R1): le tubazioni non portano più la punta di
 * freccia d'ufficio — spariscono `marker-end="url(#freccia)"` da ogni tratto e il `<marker>` dai
 * `<defs>`. Le frecce ora si posano a mano dall'editor, e questi layout non ne hanno.
```

- [ ] **Passo 12: commit**

```bash
git add src/services/schemaImpianto src/components/schemaImpianto
git commit -m "feat(schema): la freccia di direzione si posa a mano sulla tubazione"
```

- [ ] **Passo 13: provarlo in pagina**

Nel Blocco 3 i difetti peggiori li ha trovati la prova in pagina, non i test. Qui va verificato:
selezionare un tratto, premere «+ Freccia», **trascinarla** lungo il tubo (deve restare sul tratto e
girare ai gomiti), toglierla col doppio clic, annullare con Ctrl+Z. Poi guardare l'anteprima del
documento: la freccia deve comparirci con la stessa forma.

---

### Task 5: La scritta del terminale utenze sopra la freccia, centrata

**File:**
- Modifica: `src/services/schemaImpianto/symbols/index.ts:779-799` (`UTENZE`), `:812-835`
  (`simboloUtenze`), `:1104-1118` (ramo utenze di `riquadroDi`)
- Modifica: `src/services/schemaImpianto/buildSchemaModel.ts:261` (etichetta di default)
- Test: `simboli.test.ts`, `renderSvg.test.ts`
- Riferimenti: quelli che contengono il terminale

**Interfacce:**
- Consuma: niente dai task precedenti.
- Produce: nessuna firma nuova. `UTENZE` perde `rientroScritta` e `margineDestro` (la scritta non
  sta più a destra) e guadagna `margineSopra`.

**Il punto delicato è l'ingombro.** Il riquadro del terminale cresce col testo, e l'ancora `in`
segue l'altezza vera (`ancoreDi`). Oggi le righe scendono **sotto** la punta; da domani stanno
**sopra**. Sbagliare questo calcolo taglia il nodo nel `.docx` — è già successo su questo simbolo.

**Convenzione da tenere ferma:** il simbolo si disegna in coordinate locali con l'origine in alto a
sinistra e l'ancora `in` in basso (`y = altezza`). Se le righe stanno sopra la punta, la punta si
abbassa di quanto serve a farcele stare, e **l'altezza totale cresce**: non si disegna a ordinate
negative, o il nodo esce dal proprio riquadro e l'editor lo taglia.

- [ ] **Passo 1: i test, sulla porta esterna**

In `simboli.test.ts`, nel `describe` del terminale:

```ts
  it('mette la scritta sopra la punta, centrata sul codolo', () => {
    const nodo = { ...nodoUtenze, etichetta: 'Utenze\naria' }
    const svg = simboloUtenze(nodo)
    const testo = /<text[^>]*text-anchor="middle"[^>]*>/.exec(svg)
    expect(testo).not.toBeNull()

    const tspan = [...svg.matchAll(/<tspan x="([\d.]+)" y="([\d.]+)">([^<]*)<\/tspan>/g)]
    expect(tspan.map((m) => m[3])).toEqual(['Utenze', 'aria'])
    // Incolonnate sull'ascissa del codolo, non rientrate a destra.
    expect(tspan.map((m) => Number(m[1]))).toEqual([UTENZE_X, UTENZE_X])

    // Sopra la punta: l'ultima riga finisce prima della quota della punta.
    const puntaY = Number(/M [\d.]+ ([\d.]+) L/.exec(svg)![1])
    expect(Number(tspan[1][2])).toBeLessThan(puntaY)
  })

  it('l’ingombro comprende le righe che stanno sopra la punta', () => {
    const unaRiga = dimensioniDi({ ...nodoUtenze, etichetta: 'Utenze' })
    const dueRighe = dimensioniDi({ ...nodoUtenze, etichetta: 'Utenze\naria' })
    // Due righe occupano più in alto, quindi il riquadro è più alto: se non lo fosse, la riga in
    // cima uscirebbe dal nodo e il documento la taglierebbe.
    expect(dueRighe.altezza).toBeGreaterThan(unaRiga.altezza)
    // La larghezza non dipende più dal rientro a destra: una riga lunga allarga da entrambi i lati
    // del codolo, non solo a destra.
    expect(dimensioniDi({ ...nodoUtenze, etichetta: 'Utenze del reparto verniciatura' }).larghezza)
      .toBeGreaterThan(dueRighe.larghezza)
  })
```

`UTENZE_X` non è esportata oggi: leggere l'ascissa dal codolo reso
(`/M ([\d.]+) [\d.]+ L/`) invece di importare la costante, così il test non si lega a un dettaglio
interno. Adattare i nomi (`nodoUtenze`) a quelli già in uso nel file.

- [ ] **Passo 2: vederli cadere**

Comando: `npx vitest run src/services/schemaImpianto/__tests__/simboli.test.ts -t "sopra la punta"`
Atteso: FALLISCE — oggi il testo è `text-anchor="start"` e sta a destra.

- [ ] **Passo 3: il disegno**

**Come `testoMultiRiga` posa le righe** (verificato leggendo la funzione, non assunto): l'attributo
è `dominant-baseline="central"`, quindi la `y` passata è il **centro verticale** della prima riga,
non la sua base; ogni riga successiva scende di `dimensione * INTERLINEA_TESTO`, con
`INTERLINEA_TESTO = 1.25`. Con corpo 18, il passo fra righe è 22,5 e una riga occupa 18 in verticale.

In `UTENZE`, aggiungere tre voci e **tenere** `margineDestro` (serve ancora alla larghezza):

```ts
  /** Aria fra il bordo alto del riquadro e la cima della prima riga della scritta. */
  margineSopra: 10,
  /** Aria fra il fondo dell'ultima riga e il vertice della punta. */
  ariaSottoLaScritta: 6,
  /**
   * Lunghezza del codolo tratteggiato, dalla base della punta all'ancora `in`. Era implicita nella
   * differenza fra l'altezza del registro e la quota fissa della punta; da quando la punta si
   * abbassa col numero di righe serve esplicita, o l'ingombro e il disegno la calcolerebbero in
   * due modi diversi.
   */
  lunghezzaCodolo: 94,
```

`rientroScritta` non serve più: toglierlo, e verificare col compilatore che nessuno lo legga.

In `simboloUtenze`, la punta si abbassa di quanto serve alle righe, e la scritta si centra
sull'ascissa del codolo:

```ts
/**
 * Altezza occupata dalla scritta del terminale, dal bordo alto della prima riga al bordo basso
 * dell'ultima. Una sola definizione, letta sia da chi disegna (`simboloUtenze`) sia da chi misura
 * l'ingombro (`riquadroDi`): sono i due punti che su questo simbolo hanno già divergito.
 */
function altezzaScrittaUtenze(etichetta: string): number {
  const righe = etichetta.split('\n')
  return (righe.length - 1) * UTENZE.dimensioneScritta * INTERLINEA_TESTO + UTENZE.dimensioneScritta
}

/** Quota del vertice della punta, che scende col numero di righe posate sopra di essa. */
function quotaPuntaUtenze(etichetta: string): number {
  return UTENZE.margineSopra + altezzaScrittaUtenze(etichetta) + UTENZE.ariaSottoLaScritta
}

export function simboloUtenze(nodo: SchemaNodo): string {
  const { altezza } = dimensioniDi(nodo)
  const x = UTENZE.x
  // La scritta sta SOPRA la punta (richiesta del committente, 17-08-2026), centrata sul codolo:
  // la punta si abbassa di quanto occupano le righe, invece di restare a quota fissa con la
  // scritta di fianco. Le ordinate restano tutte positive: il simbolo sta dentro il proprio
  // riquadro, che `riquadroDi` fa crescere di conseguenza.
  const yPunta = quotaPuntaUtenze(nodo.etichetta)
  // `dominant-baseline="central"`: la y è il centro della prima riga, non la sua base.
  const yPrimaRiga = UTENZE.margineSopra + UTENZE.dimensioneScritta / 2
  return [
    `<path d="M ${x} ${altezza} L ${x} ${yPunta + 12}" fill="none" stroke="#000" stroke-width="${TRATTO}" stroke-dasharray="10 7" />`,
    `<path d="M ${x - 6} ${yPunta + 13} L ${x} ${yPunta} L ${x + 6} ${yPunta + 13} Z" fill="#000" />`,
    testoMultiRiga(x, yPrimaRiga, nodo.etichetta, UTENZE.dimensioneScritta, 'middle'),
  ].join('')
}
```

- [ ] **Passo 4: l'ingombro**

Nel ramo utenze di `riquadroDi` (`:1104-1118`), la larghezza non dipende più dal rientro a destra e
l'altezza comprende le righe sopra la punta. **Entrambe le quote si ricavano dalle stesse due
funzioni che disegnano** (`altezzaScrittaUtenze`, `quotaPuntaUtenze`), non da una seconda formula:
è esattamente la duplicazione che su questo simbolo ha già fatto divergere disegno e ingombro.

```ts
  const righe = nodo.etichetta.split('\n')
  const piuLunga = Math.max(...righe.map((r) => r.length))
  const scritta = piuLunga * UTENZE.dimensioneScritta * UTENZE.larghezzaCarattere
  // La scritta è centrata sul codolo: sporge di metà da entrambi i lati, non tutta a destra. Il
  // riquadro parte da x=0, quindi è la metà destra a decidere la larghezza necessaria.
  const larghezzaNecessaria = UTENZE.x + scritta / 2 + UTENZE.margineDestro
  // Dal vertice della punta all'ancora `in`, passando per la base della punta: le stesse quote che
  // `simboloUtenze` disegna.
  const altezzaNecessaria = quotaPuntaUtenze(nodo.etichetta) + 12 + UTENZE.lunghezzaCodolo
  return {
    x: 0,
    y: 0,
    larghezza: Math.max(dimensioni.larghezza, Math.ceil(larghezzaNecessaria)),
    altezza: Math.max(dimensioni.altezza, Math.ceil(altezzaNecessaria)),
  }
```

**Verifica obbligatoria prima di proseguire:** con l'etichetta di default a due righe, l'altezza
calcolata qui e la quota `altezza` che `simboloUtenze` usa per il capo del codolo devono coincidere
— se il codolo finisse oltre il riquadro, l'ancora `in` (che segue `dimensioniDi`) cadrebbe dove il
tubo non arriva. Il test del passo 1 sull'ingombro non se ne accorge da solo: leggere il disegno
reso e confrontare la `y` finale del codolo con `dimensioniDi(nodo).altezza`.

- [ ] **Passo 5: l'etichetta di default a due righe**

In `buildSchemaModel.ts:261`:

```ts
    etichetta: 'Utenze\naria',
```

Con un test in `buildSchemaModel`, o dove i test di quel file già guardano il terminale:

```ts
  it('il terminale nasce con la scritta su due righe', () => {
    const nodo = costruisciModello(schedaMinima()).nodi.find((n) => n.tipo === 'utenze')!
    expect(nodo.etichetta).toBe('Utenze\naria')
  })
```

Adattare i nomi alle funzioni vere del file.

**Da dire al committente:** le tre pratiche con un layout salvato (ORVED, LOWA R&D e la terza)
conservano l'etichetta salvata — la riconciliazione tiene quella dell'utente — quindi lì resterà
«Utenze aria» su una riga, centrata sopra la freccia ma non spezzata.

- [ ] **Passo 6: i tre comandi, e i riferimenti**

Cadranno i riferimenti che contengono il terminale. Nel diff devono cambiare: la `y` della punta e
del codolo, il `<text>` (da `start` a `middle`, ascissa e ordinate nuove), e — se l'ingombro cresce
— il `viewBox` e le quote che ne dipendono. **Guardare che le coordinate degli altri nodi non si
spostino** se non per l'allargamento della tela: se si sposta un compressore, qualcosa è andato
storto nell'ingombro.

- [ ] **Passo 7: commit**

```bash
git add src/services/schemaImpianto src/components/schemaImpianto
git commit -m "feat(schema): la scritta del terminale utenze sta sopra la freccia, centrata"
```

- [ ] **Passo 8: provarlo in pagina, e chiedere conferma**

Aprire l'editor, **allungare l'etichetta** dal dialogo del terminale (una riga lunga, poi tre righe)
e verificare che il nodo non venga tagliato né nella tela né nell'anteprima del documento. Poi
chiedere al committente la conferma sull'**a capo nell'etichetta** (vedi la specifica): se si
aspetta che qualunque etichetta vada a capo da sé, è una regola diversa e va discussa.

---

### Task 6: I nuovi oggetti nascono vicino al disegno

**File:**
- Modifica: `src/components/schemaImpianto/SchemaEditor.tsx:256-263` (`piedeDelDisegno` e chi lo usa),
  `:604`, `:1178`, e il punto in cui nasce il muro
- Test: `src/components/schemaImpianto/__tests__/` (il file degli hook dell'editor)

**Interfacce:**
- Consuma: niente.
- Produce: una funzione nuova, **esportata** da `SchemaEditor.tsx` per poterla provare, che
  sostituisce `piedeDelDisegno` nei due punti di posa:
  `export function sopraIlBordoSinistro(nodes: Node[], testi: SchemaTestoLibero[]): { x: number; y: number }`
  (esportare una funzione da un file di componenti fa scattare il warning `react-refresh` che
  `SchemaEditor.tsx` **ha già**: non ne aggiunge uno nuovo, il conteggio del lint resta a tre.)

**Oggi** un oggetto nuovo nasce sotto tutto il disegno, ad ascissa fissa 40: con uno schema alto
bisogna inseguirlo scorrendo. **Il committente lo vuole appena sopra il bordo sinistro dell'oggetto
più a sinistra** — di solito il compressore.

Vale per **tutto ciò che si aggiunge a mano**: apparecchiature della palette, annotazioni, muro.

- [ ] **Passo 1: il test**

`piedeDelDisegno` non è esportata. Esportare la funzione nuova (`sopraIlBordoSinistro`) e provarla
direttamente: è geometria pura, e la porta esterna qui è lei — il componente non si prova
(`CLAUDE.md`).

```ts
describe('sopraIlBordoSinistro', () => {
  it('incolonna il nuovo oggetto sul bordo sinistro del più a sinistra, appena sopra di lui', () => {
    const nodes = [nodoFinto('C1', { x: 200, y: 300 }), nodoFinto('S1', { x: 500, y: 300 })]
    const posizione = sopraIlBordoSinistro(nodes, [])
    expect(posizione.x).toBe(200)
    expect(posizione.y).toBeLessThan(300)
  })

  it('tiene conto delle annotazioni, che possono stare più a sinistra di ogni apparecchiatura', () => {
    const nodes = [nodoFinto('C1', { x: 200, y: 300 })]
    const testi = [{ id: 'T1', x: 80, y: 250, contenuto: 'Nota' }]
    expect(sopraIlBordoSinistro(nodes, testi).x).toBe(80)
  })

  it('su una tela vuota non produce coordinate negative', () => {
    const posizione = sopraIlBordoSinistro([], [])
    expect(posizione.x).toBeGreaterThanOrEqual(0)
    expect(posizione.y).toBeGreaterThanOrEqual(0)
  })
})
```

`nodoFinto` esiste già in qualche test degli hook dell'editor: riusarlo, non scriverne un secondo.

- [ ] **Passo 2: vederlo cadere**

Comando: `npx vitest run src/components/schemaImpianto -t "sopraIlBordoSinistro"`
Atteso: FALLISCE — la funzione non esiste.

- [ ] **Passo 3: l'implementazione**

Accanto a `piedeDelDisegno` in `SchemaEditor.tsx`:

```ts
/**
 * Dove far comparire ciò che si aggiunge a mano: incolonnato sul bordo sinistro dell'oggetto più a
 * sinistra e appena sopra la cima del disegno. Prima cadeva sotto tutto (`piedeDelDisegno + 40`),
 * e su uno schema alto bisognava inseguirlo scorrendo — il committente lo ha chiesto vicino al
 * compressore, che è quasi sempre l'oggetto più a sinistra (17-08-2026).
 *
 * Le annotazioni contano quanto le apparecchiature: una nota posata a sinistra di tutto sposta il
 * bordo, ed è dove l'utente sta già guardando.
 */
function sopraIlBordoSinistro(nodes: Node[], testi: SchemaTestoLibero[]): { x: number; y: number } {
  // Di un'annotazione bastano le sue coordinate: `x`/`y` SONO il suo capo alto-sinistro
  // (`ingombroTesto` in layout.ts calcola gli altri due lati, `destra` e `basso`, e qui non
  // servono). Dei nodi vale lo stesso: `position` è l'angolo alto-sinistro.
  const ascisse = [...nodes.map((n) => n.position.x), ...testi.map((t) => t.x)]
  const cime = [...nodes.map((n) => n.position.y), ...testi.map((t) => t.y)]
  if (ascisse.length === 0) return { x: 40, y: 40 }
  // Sopra la cima del disegno, mai oltre il bordo della tela.
  const y = Math.max(0, allineaAllaGriglia(Math.min(...cime) - STACCO_NUOVO_OGGETTO))
  return { x: allineaAllaGriglia(Math.min(...ascisse)), y }
}

/**
 * Aria fra la cima del disegno e ciò che si posa sopra di essa: quanto basta perché
 * l'apparecchiatura più alta della palette non si sovrapponga a ciò che c'era già.
 */
const STACCO_NUOVO_OGGETTO = 160
```

Lo stacco va **guardato in pagina**, non dedotto: dev'essere almeno l'altezza dell'oggetto più alto
che la palette può posare (i riquadri stanno sui 120-140 unità dopo l'arrotondamento del Blocco 3).
Se 160 lascia troppo vuoto o troppo poco, correggerlo e dire nel commento la ragione, non la cifra.

`libreria`/`Tarature` non serve a questa funzione: legge solo posizioni, non ingombri. Non
aggiungerlo «per simmetria» con `piedeDelDisegno`, che invece misura le altezze e ne ha bisogno.

- [ ] **Passo 4: usarla nei tre punti di posa**

- `:604` (`aggiungiNodo`): sostituire il calcolo della posizione e **aggiornare il commento**, che
  oggi spiega la scelta vecchia («Sotto tutto il resto: un punto fisso finirebbe sopra
  un'apparecchiatura già disegnata»);
- `:1178` (`aggiungiTesto`);
- **il muro: non toccarlo, e dire perché.** Nasce a `:1326` con
  `aggiungiMuro((s) => ascissaProposta(nodiDi(s), libreriaEffettiva))`, e di suo ha **la sola
  ascissa** — l'altezza si ricava dall'inviluppo (deciso nel Blocco D4). Portarlo sul bordo sinistro
  del disegno lo farebbe nascere **sopra il compressore**, cioè peggio di dove nasce ora: fra i due
  gruppi, che è già dentro la vista. Il committente ha elencato il muro insieme agli altri, ma la
  sua richiesta («lo trovo subito») è già soddisfatta. **Lasciare `ascissaProposta` e dirglielo**,
  invece di applicare la regola alla lettera contro il suo scopo. Se poi lui insiste, si sposta.

`piedeDelDisegno` **resta**: se dopo questi tre punti non la usa più nessuno, il compilatore lo
dice — allora si toglie, insieme al suo commento, nello stesso commit.

- [ ] **Passo 5: i tre comandi**

Nessun riferimento SVG dovrebbe cadere: questi punti riguardano la posa nell'editor, non il disegno
di un layout dato. Se ne cade uno, capire perché prima di aggiornarlo.

- [ ] **Passo 6: commit**

```bash
git add src/components/schemaImpianto
git commit -m "feat(schema): ciò che si aggiunge a mano nasce accanto al disegno, non sotto"
```

- [ ] **Passo 7: provarlo in pagina**

Aggiungere dalla palette un'apparecchiatura, poi un'annotazione, poi il muro, su uno schema alto:
tutti e tre devono comparire **senza scorrere**, e nessuno deve nascere sopra un oggetto esistente.

---

## Quando i sei task sono chiusi

1. **I tre comandi** un'ultima volta, dal worktree.
2. **La prova in pagina completa**: aprire una pratica vera, posare una freccia, allungare
   l'etichetta del terminale, aggiungere un oggetto, guardare un flessibile corto e uno lungo,
   generare l'anteprima del documento.
3. **Mostrare al committente** le due cose che dipendono da lui: l'ondulazione (R5, contraddizione
   dichiarata) e l'a capo dell'etichetta (R2, assunzione).
4. **Dirgli le due conseguenze**: i disegni delle pratiche salvate perdono le punte di freccia
   finché non se ne posano a mano; le pratiche con layout salvato tengono l'etichetta a una riga.
5. `git fetch`, **simulare il merge con `git merge-tree`** (il diff da solo inganna, e su questo
   repo ha già ingannato), poi chiedere il **via esplicito** prima del push: su `main` il deploy
   parte da solo.
6. A deploy verificato, `DOCUMENTAZIONE/fixes.md`: massimo due righe per voce, cosa cambia per chi
   usa l'applicazione e — se è un difetto — cosa succedeva prima. Niente nomi di funzione, niente
   numeri di commit.

## Appendice A — Rigenerare un riferimento SVG

I tre riferimenti sono liste di stringhe, un elemento top-level per riga, unite con `join('')`. Per
rigenerarne uno, aggiungere **temporaneamente** in `renderSvg.test.ts` un test che lo scrive, poi
**cancellarlo**:

```ts
import { writeFileSync } from 'node:fs'

// TEMPORANEO — cancellare prima del commit
it('rigenera il riferimento', () => {
  const svg = renderSvg(layoutConTesti([]))   // o layoutConTee(), o layoutConMuro()
  const righe: string[] = []
  let profondita = 0
  let corrente = ''
  for (const pezzo of svg.split(/(?=<)/g)) {
    corrente += pezzo
    if (pezzo.startsWith('</')) profondita--
    else if (!pezzo.includes('/>') && /^<[a-z]/.test(pezzo)) profondita++
    if (profondita === 0) {
      righe.push(corrente)
      corrente = ''
    }
  }
  writeFileSync('rigenerato.txt', righe.map((r) => '  `' + r.replace(/`/g, '\\`') + '`,').join('\n'))
})
```

Poi:
1. **Leggere il diff** fra il file rigenerato e la fixture attuale, riga per riga.
2. Verificare che ogni differenza sia una di quelle che il task dichiara — e che **non ce ne siano
   altre**.
3. Incollare le righe nuove nella fixture, aggiungere in coda al commento di testa il paragrafo
   «Generato di nuovo…» con data, rifinitura e cosa cambia.
4. Cancellare il test temporaneo e il file `rigenerato.txt`.

Se il conteggio delle righe cambia molto più di quanto il task prevede, **fermarsi**: quasi sempre
vuol dire che è cambiato qualcosa che non si voleva cambiare.

## Appendice B — Provare in pagina

- Dev server sulla **5176**. **Verificare che giri dal worktree giusto** risalendo al processo
  proprietario della porta (`Get-NetTCPConnection -LocalPort 5176 -State Listen`, poi il
  `CommandLine` del processo): è già successo di trovare quella porta servita dal worktree di un
  blocco precedente, e le prove sarebbero passate mostrando il codice sbagliato. **Non fidarsi del
  `--port`.**
- Un dev server avviato in background da un comando che poi si chiude **muore con lui**.
- Aprire sempre con un `browser_navigate` esplicito. `browser_drag` non è affidabile su react-flow:
  usare mosse a più passi. Le coordinate della tela non sono quelle dello schermo. I dialoghi si
  impilano: identificarli per titolo, **mai `.first()` su un selettore largo**. Escape chiude
  l'editor **scartando** le modifiche.
- Le pratiche con un layout salvato sono due: ORVED (`a8bbdbe1-f7ad-40d9-86a0-9483b5dcc7f4`) e
  LOWA R&D (`c6f56ca5-d57b-408c-a4e5-69a207812b0d`). Tutto ciò che si scrive provando va ripulito, e
  **l'assenza va riverificata con una query diretta** (credenziali in `.env.local`, `curl`, mai
  stampare le chiavi).
