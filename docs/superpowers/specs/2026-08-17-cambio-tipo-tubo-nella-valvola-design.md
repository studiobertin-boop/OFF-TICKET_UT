# Il tipo di tubazione cambia dove sta la valvola — specifica

**Data:** 17-08-2026
**Nasce da:** `2026-08-17-valvole-che-spezzano-il-tubo-stima.md`, la stima della sesta richiesta del
committente. La richiesta letterale — valvole e riduttori che diventano nodi e spezzano l'arco in
due — è stata misurata in due blocchi pieni e scartata. Questa è la strada che il committente ha
indicato leggendo la stima, ed è più economica **e** migliore: un gesto solo, e il confine non può
disallinearsi dalla valvola perché è la valvola.

## Il problema

Il committente vuole disegnare il tratto a monte di una valvola come flessibile e quello a valle
come rigido. Oggi non può: lo stile — rigida, flessibile, condense — è una proprietà dell'**arco
intero**, e valvola e riduttore sono *segni* che scorrono su quell'unico arco.

## L'idea

Non spezzare niente. **Il segno dichiara il tipo di tubo che comincia da lui.** Il confine coincide
col segno per costruzione: si sposta quando lo si trascina, sparisce quando lo si toglie, e non
esiste alcuno stato in cui i due possano trovarsi in disaccordo.

## Il modello

`SchemaSegnoTubo` (`types.ts`) guadagna un campo:

```ts
/** Tipo di tubazione che comincia da questo segno e vale fino al segno successivo, o fino al
 *  capo dell'arco. Assente: il tubo non cambia tipo qui. */
stileAValle?: SchemaArcoStile
```

- `SchemaArco.stile` resta, e diventa il tipo del **primo** troncone: dal capo `da` fino al primo
  segno che dichiara un cambio.
- N segni con `stileAValle` danno **N+1 tronconi**, senza casi speciali: due valvole sullo stesso
  tubo funzionano come una.
- Solo **valvola di intercettazione e riduttore di pressione** possono dichiararlo. La freccia di
  direzione no: indica il verso del flusso, non un componente della linea (deciso col committente).
- Il campo è **opzionale**, quindi non alza `VERSIONE` in `persistenza.ts` — è la stessa scelta già
  fatta per `testi`, `muroX` e la taratura di pratica. **Nessuna conversione dei layout salvati**, e
  nessun rischio sulle due pratiche che ne hanno uno (ORVED, LOWA R&D).

## Il disegno

Serve una funzione sola, nuova, che tutti e due i disegni chiamano:

```ts
/** I tronconi in cui i segni con `stileAValle` dividono la polilinea, ciascuno col proprio tipo. */
function tronconi(
  polilinea: Punto[],
  stileArco: SchemaArcoStile,
  segni: SchemaSegnoTubo[]
): { punti: Punto[]; stile: SchemaArcoStile }[]
```

Senza cambi restituisce **un** troncone con la polilinea intera: il caso di oggi, bit per bit.

Due precisazioni che evitano altrettante ambiguità:

- I confini si ricavano **ordinando i segni per `t`**, non per ordine di creazione. Trascinare una
  valvola oltre un'altra riordina i tronconi da sé, che è l'unico comportamento che non lascia
  stati impossibili.
- Due tronconi consecutivi dello **stesso tipo si fondono** in uno solo. Capita quando si sceglie
  per il tratto a valle il tipo che aveva già: senza la fusione resterebbero due tracciati identici
  attaccati, invisibili a occhio ma non nel markup e nei riferimenti.

La logica di taglio esiste già dentro `spezzaArco` (`inserimentoTee.ts`): la quota di ogni vertice
lungo la polilinea, il filtro dei vertici interni, il punto esatto al taglio. Va **estratta**, non
riscritta — è collaudata da agosto e ha già affrontato i casi degeneri (polilinea di lunghezza
nulla, taglio sopra un vertice).

**Nel documento** (`renderSvg.ts`): oggi la resa è scelta per funzione — `renderMandataCompressore`
ondula, `renderMandataLinea` traccia continuo, `renderLineaCondense` tratteggia. Le tre calcolano la
stessa polilinea con `instrada` e si distinguono solo nell'ultima riga. Diventano: una polilinea, i
suoi tronconi, un `<path>` per troncone col tratto del suo tipo.

**Sulla tela** (`SchemaEdgeTubazione.tsx:380`): un punto solo,
`stile === 'flessibile' ? ondula(polilinea) : percorso(polilinea)`, che passa da un `<path>` a uno
per troncone.

**La legenda** (`righeLegenda`, `renderSvg.ts`) oggi legge `layout.archi.map(a => a.stile)`: deve
leggere anche gli `stileAValle` dei segni, o un disegno con un solo tubo rigido e un troncone
flessibile mostrerebbe una legenda che smentisce il disegno.

## Il gesto

**Clic su una valvola o su un riduttore** apre un menu con:

```
Verso C1     →  Rigida · Flessibile · Condense
Verso S1     →  Rigida · Flessibile · Condense
Togli
```

- I due nomi sono le **etichette vere dei nodi ai capi dell'arco** (`da` e `a`). Il terminale utenze
  ha un'etichetta su due righe: nel menu va su una riga sola.
- «Verso il capo di partenza» scrive sullo **stile dell'arco** se il segno è il primo, o sullo
  `stileAValle` del **segno precedente** se ce n'è un altro prima. Da fuori è sempre «questo tratto
  qui».
- «Verso il capo di arrivo» scrive sullo `stileAValle` di **questo** segno.
- **`Togli` sostituisce il doppio clic**, che sparisce: con un menu sul clic singolo i due gesti si
  ostacolano.
- In **modo taratura** il menu non si apre, come già non si trascina (`bloccato`,
  `SchemaEdgeTubazione.tsx`).
- Ogni voce è **un gesto di cronologia**: Ctrl+Z riporta il tipo di prima.

## Conseguenze decise

- **Togliere la valvola** toglie il suo confine: i due tronconi si rifondono, e il tubo prende il
  tipo del troncone che precedeva.
- **Trascinare la valvola** sposta il confine con lei. È il motivo di tutta questa strada.
- **Il menu offre tutti e tre i tipi** anche in mezzo a un tubo d'aria. La scelta è di chi disegna,
  e non tocca gli attacchi: `capoValido` e `connessioneAmmessa` guardano le ancore ai capi, che
  restano quelle dell'arco.
- **La rotta non cambia.** Il percorso lo decide `instrada` dallo stile dell'**arco** (il flessibile
  scende al collettore, la condensa corre sulla propria corsia, la linea va dritta). Con due tipi
  sullo stesso arco la strada percorsa è una sola: cambia il tratto disegnato, non il tragitto.
  Per il caso del committente — flessibile fino alla valvola, poi rigido sullo stesso percorso — è
  quel che serve.

## Cosa NON cambia

Nodi, ancore, disegno automatico (`layoutSchema`), riconciliazione con la scheda (`persistenza.ts`),
il `.docx`, il modo taratura, la freccia di direzione. Nessuna migrazione di dati.

## Come si verifica

- **`tronconi`**: senza cambi, un troncone identico alla polilinea data; con un cambio a metà, due
  tronconi che si toccano nel punto della valvola e coprono insieme tutta la polilinea; con due
  cambi, tre tronconi nell'ordine giusto. Un segno con `t` fuori dai vertici e uno esattamente
  sopra un vertice.
- **Documento**: un arco flessibile con una valvola che dichiara `standard` a valle produce un tubo
  ondulato e uno continuo; la legenda nomina entrambi i tipi.
- **Tela**: la stessa divisione, provata sulla funzione e non sul componente (`CLAUDE.md`: nessun
  test di interfaccia).
- **Compatibilità**: un layout salvato senza il campo nuovo disegna **esattamente** come prima, e i
  tre riferimenti SVG committati (`__tests__/fixtures/svgRiferimento*.ts`) **non cambiano di un
  carattere**. Se cambiano, qualcosa è stato toccato che non doveva.
- **In pagina**: posare una valvola su una mandata flessibile, dirle rigido verso il serbatoio,
  vedere il tubo cambiare a metà; trascinarla e vedere il confine seguirla; toglierla e vedere il
  tubo tornare intero; Ctrl+Z dopo ognuna delle tre.

## Il costo

Tre task. Il confronto che vale: la stessa richiesta fatta alla lettera — valvole come nodi — è
stata misurata in due blocchi pieni, perché il TEE (identica trasformazione, fatta una volta) costò
15 commit più una coda con un piano suo, e le valvole sono seminate d'ufficio su ogni mandata mentre
il TEE lo posa sempre l'utente.
