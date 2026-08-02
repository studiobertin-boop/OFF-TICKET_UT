# Una pressione sola per i compressori a catalogo

Data: 2026-08-03
Stato: approvato, da implementare

## Obiettivo

Il catalogo apparecchiature mostra due pressioni per ogni compressore. Deve
mostrarne una sola — la massima di targa — accoppiata alla portata. In più,
quando si aggiunge a catalogo una variante di un modello che già esiste ad altre
pressioni, il pulsante `+` deve prima avvisare di quali varianti ci sono già.

## Stato attuale

Ogni riga di compressore porta due dati di pressione:

| chiave `specs` | KAESER ASK 27 | ruolo oggi |
|---|---|---|
| `pressione_esercizio` | 7,5 / 10 / 13 | chiave di variante (indice unico) |
| `pressione_max` | 8 / 11 / 15 | pressione dichiarata dalla scheda dati |

La portata (`fad`) è agganciata alla coppia: 2600 / 2180 / 1700 l/min.

Entrambe compaiono nella pagina Apparecchiature, sia nella tabella sia nel form
di modifica, perché tutte e due sono definite in
`CANONICAL_SPECS.Compressori` ([specsNormalization.ts:91-126](../../../src/services/equipmentAudit/specsNormalization.ts))
e sia `EquipmentCatalogTable` sia `EquipmentSpecsFields` si generano da lì.

Numeri di produzione (2026-08-02): 635 righe attive di compressori, 473 con
`pressione_esercizio`, 628 con `pressione_max`, 273 in cui i due valori
differiscono. 325 modelli distinti, di cui 160 con 2 o 3 varianti.

### Le due pressioni sono dati veri, non doppioni

Verificato su 24 brochure KAESER, dal 2000 al 2026, italiano e tedesco.
L'intestazione della tabella «Specifica tecnica» non cambia mai:

> Modello | **Pressione di lavoro** [bar] | Portata volumetrica *(unità completa
> alla pressione di lavoro)* [m³/min] | **Max. pressione di lavoro** [bar] | …

In tedesco: *Betriebsüberdruck* / *Liefermenge Gesamtanlage bei
Betriebsüberdruck* / *max. Überdruck*.

Confronto brochure ↔ catalogo, corrispondenza esatta su tutte le coppie:

| Modello | pressione di lavoro → portata (brochure) | `pressione_esercizio` → `fad` | max. (brochure) | `pressione_max` |
|---|---|---|---|---|
| SK 22 | 7,5 → 2,00 / 10 → 1,68 / 13 → 1,32 m³/min | 7,5 → 2000 / 10 → 1680 / 13 → 1320 | 8 / 11 / 15 | 8 / 11 / 15 |
| SK 25 | 7,5 → 2,50 / 10 → 2,11 / 13 → 1,72 | idem ×1000 | 8 / 11 / 15 | 8 / 11 / 15 |
| ASK 28 | 7,5 → 2,86 / 10 → 2,40 / 13 → 1,93 | idem ×1000 | 8 / 11 / 15 | 8 / 11 / 15 |
| ASK 34 | 7,5 → 3,51 / 10 → 3,00 / 13 → 2,50 | idem ×1000 | 8 / 11 / 15 | 8 / 11 / 15 |
| ASK 40 | 7,5 → 4,06 / 10 → 3,52 / 13 → 2,94 | idem ×1000 | 8 / 11 / 15 | 8 / 11 / 15 |

L'import ha letto correttamente e i nomi dei due campi ricalcano le intestazioni
del costruttore. Non c'è nessun dato da correggere.

Le marche si comportano in due modi: KAESER distingue le due pressioni (271
righe su 392), CECCATO no — i due valori coincidono, oppure è valorizzata solo
`pressione_max` (185 righe, nessuna divergenza). Le altre 13 marche sono 58
righe, quasi tutte con la sola `pressione_max`.

## Decisioni

### Cosa dichiara la relazione

La colonna pressione della tabella «caratteristiche apparecchiature» continua a
portare la **massima di targa** ([caratteristiche.ts:65](../../../src/services/relazione/engine/caratteristiche.ts)):
per un SK 22 versione 10 bar si dichiara 11, che è il numero sulla targa e nella
denuncia. Nessuna modifica al motore della relazione.

### Nessun meccanismo di soglia

Era stato ipotizzato di far scrivere nella colonna PS la pressione di lavoro
della rete (es. 8 bar) e di dedurne la variante per soglia (la più piccola ≥ 8,
cioè quella da 10). **Non si fa**, per due ragioni:

1. Una colonna sola non può reggere le due letture. Su un SK 22, con PS a
   catalogo {8, 11, 15} e pressioni di lavoro {7,5, 10, 13}, il valore `8` è
   insieme la PS della variante da 7,5 e una pressione di rete che punta alla
   variante da 10. Le due letture danno portate diverse (2000 vs 1680) e nessuna
   regola di precedenza può indovinare quale intendeva chi scrive.
2. Il dato di targa è sempre disponibile nella pratica reale, quindi la seconda
   porta d'ingresso non serve. La max di targa identifica la variante da sola.

Di conseguenza non si aggiunge nessun campo alla scheda dati e i dati di
pressione restano quelli che sono: nessuna migrazione di merito.

### `pressione_esercizio` resta nei dati, esce dall'interfaccia

Non si cancella. È la chiave che distingue le varianti nell'indice unico:

```
equipment_catalog_unique_compressori
  ON (tipo_apparecchiatura, marca, modello,
      COALESCE(specs->>'pressione_esercizio', specs->>'pressione_max'))
  WHERE tipo_apparecchiatura = 'Compressori' AND is_active
```

Riadattare l'indice sulla sola `pressione_max` romperebbe **ASD 50 SFC** e
**ASD 50 T SFC**, che hanno due varianti distinte con la stessa massima:

| variante | `pressione_esercizio` | `pressione_max` | `fad` |
|---|---|---|---|
| a | 10 | 13 | 4580 |
| b | 13 | 13 | 3820 |

Non è una scoria d'import: il dato è confermato su due brochure indipendenti
(serie ASD 2018 e P-651-2-IT-16-25 del 2025). Sotto un indice sulla sola massima
le due righe collidono, e `getVarianti` — che deduplica per valore — ne
scarterebbe una in silenzio.

Tenendola come discriminante invisibile non si perde nulla e non compare più
nell'interfaccia.

## Design

### 1. Flag `isInternal` sul contratto canonico

`CanonicalSpecDef` prende un campo nuovo:

```ts
/**
 * Il dato serve al funzionamento — distinguere le varianti, reggere l'indice
 * unico — ma non si mostra e non si modifica: l'interfaccia del catalogo lo
 * salta. Resta nel contratto perché `variantSpecKey` lo legge da qui.
 */
isInternal?: boolean
```

Si applica a `pressione_esercizio` in `CANONICAL_SPECS.Compressori`.

Chi deve saltare le definizioni interne:

- `EquipmentCatalogTable` — le chip dei dati tecnici in tabella
- `EquipmentSpecsFields` — i campi del form di creazione/modifica

Chi deve continuare a vederle, invariato:

- `variantSpecKey` / `variantSpecKeys` / `readVariantValue` — la chiave di variante
- `normalizeSpecs` / `readSpec` — lettura e normalizzazione
- `missingCanonicalSpecs` — completezza (`pressione_esercizio` non è `required`,
  quindi non cambia nulla di fatto)

### 2. Il menu a tendina della colonna PS mostra la portata

`PressioneCatalogCell` oggi rende ogni opzione come `{valore} bar`. Diventa
`{valore} bar · {fad} l/min`, leggendo la portata dalla riga di catalogo già in
mano (`VarianteCatalogo.item`), senza chiamate di rete aggiuntive.

Serve a distinguere le varianti quando la pressione da sola non basta a
riconoscere la macchina — e sui due modelli ASD 50 SFC è l'unica cosa che le
distingue nel menu.

La pressione di lavoro non si mostra: sarebbe rimettere in scena il secondo
numero che questa specifica toglie.

Il valore selezionato resta la massima di targa, come oggi.

### 3. Avviso prima di aggiungere una variante

In `EquipmentAutocomplete`, il pulsante `+` compare in due casi distinti
([EquipmentAutocomplete.tsx:168-198](../../../src/components/technicalSheet/EquipmentAutocomplete.tsx)):

- **modello del tutto assente** a catalogo → nessun avviso, si apre il dialog
  come oggi
- **modello presente ma non a questa pressione** → prima una conferma

Testo della conferma:

> **Variante nuova di un modello già a catalogo**
>
> A catalogo **KAESER SK 22** esiste già in 3 varianti: **8, 11 e 15 bar**.
> Stai per aggiungerne una a **9 bar**.
>
> [Annulla] [Aggiungi comunque]

Le pressioni elencate sono quelle che le righe dichiarano alla scheda
(`readSheetPressure`), ordinate crescenti, cioè esattamente i valori del menu a
tendina della colonna PS. Il numero di varianti è il conteggio di quelle righe.

Su «Annulla» non succede nulla e il `+` resta dov'è. Su «Aggiungi comunque» si
apre `AddEquipmentDialog` come oggi.

L'effetto che governa `showAddButton` interroga già `findVariants`: le righe
vanno tenute in stato invece di essere scartate, così la conferma non rifà la
query e non può mostrare un elenco diverso da quello su cui il pulsante è
comparso.

Non si usa `window.confirm`, per la stessa ragione già documentata in
`UnifiedEquipmentTable`: basta che l'utente spunti una volta «impedisci a questa
pagina di creare altre finestre di dialogo» perché il browser risponda `false` a
ogni conferma successiva senza mostrarla.

### 4. Ripulitura dei valori in virgola mobile

Sei righe attive portano valori con code di arrotondamento, residuo di
conversioni m³/h → l/min all'import:

| marca | modello | chiave | valore | atteso |
|---|---|---|---|---|
| KAESER | ASK 40 | `fad` | 4059.9999999999995 | 4060 |
| KAESER | ASK 40 T | `fad` | 4059.9999999999995 | 4060 |
| WORTHINGTON | Rollair 1000 B | `fad` | 996.0000000000001 | 996 |
| WORTHINGTON | Rollair 2000 A | `fad` | 2027.9999999999998 | 2028 |
| WORTHINGTON | RLR 2500 BE7 | `fad` | 2583.3333333333335 | 2583.33 |
| WORTHINGTON | Rollair RLR 750 B | `fad` | 691.6666666666666 | 691.67 |

Migration di sola normalizzazione, sull'intero catalogo attivo: arrotondamento a
2 decimali dei soli valori di `specs` che sono numeri JSON con più di 5 cifre
decimali. I valori testuali non si toccano — gli intervalli di temperatura
(«-10 ÷ +200») devono restare tali. Due delle sei righe sono conversioni
periodiche genuine (÷60) e restano con i decimali; le altre quattro tornano
intere.

## Difetto adiacente emerso in revisione

Su ASD 50 SFC e ASD 50 T SFC una delle due varianti **non è oggi raggiungibile
dalla scheda dati**, e la specifica sopra non basta a sistemarla.

`getVarianti` deduplica le righe indicizzandole per `readSheetPressure`, cioè
per la massima di targa ([equipmentCatalog.ts:161-186](../../../src/services/api/equipmentCatalog.ts)).
Su questi due modelli entrambe le varianti dichiarano 13 bar, quindi finiscono
sulla stessa chiave e una viene scartata. Conseguenze:

- il menu a tendina della colonna PS elenca `8,5` e `13`, non tre voci;
- chi scrive 13 ottiene la portata della riga sopravvissuta — 4580 o 3820 a
  seconda dell'ordine con cui il database restituisce le righe, che non è
  garantito — e quel numero finisce in una relazione firmata senza alcun
  segnale che ne esistesse un altro.

La deduplica non è di per sé sbagliata: esiste per collassare le righe
quasi-duplicate (stesso modello e stessa pressione, una con
`pressione_esercizio` valorizzata e una senza), che a catalogo ci sono davvero.
Sbagliata è la chiave su cui deduplica. L'indice unico a database distingue le
righe per `COALESCE(pressione_esercizio, pressione_max)`; `getVarianti` usa
invece la sola `pressione_max`, ed è più grossolana dell'indice.

**Rimedio.** Allineare la deduplica all'indice: raggruppare per
`readVariantValue` invece che per `readSheetPressure`. Le righe quasi-duplicate
continuano a collassare (hanno lo stesso valore di variante), le due varianti
ASD tornano distinte. `VarianteCatalogo` acquisisce un campo per il valore di
variante, restando `value` la pressione dichiarata.

Ne discende che due opzioni del menu possono portare lo stesso `value`. Il
`PressioneCatalogCell` deve quindi passare da opzioni numeriche a opzioni
oggetto, e distinguerle a video con la portata — che è già ciò che il punto 2 del
design introduce:

```
8,5 bar · 5270 l/min
13 bar · 4580 l/min
13 bar · 3820 l/min
```

Selezionandone una si scrive 13 nella colonna PS e si applicano gli `specs`
della riga scelta. La digitazione libera di un valore resta possibile: quando
corrisponde a più varianti si applica la prima e nessuna scelta è implicita
oltre a quella — caso che riguarda 2 modelli su 325.

## Cosa non cambia

- Il motore della relazione e cosa dichiara.
- La scheda dati: nessun campo nuovo, nessuna colonna nuova.
- L'indice unico a database e la chiave di variante.
- I dati di pressione: nessuna cancellazione, nessuna migrazione di merito.
- Il comportamento del `+` quando il modello manca del tutto.

## Test

Vitest, secondo la convenzione del progetto (logica, non UI):

- `isInternal` non altera `variantSpecKey`, `readVariantValue`,
  `readSheetPressure`, `normalizeSpecs`, `missingCanonicalSpecs` sui compressori.
- Il filtro applicato dall'interfaccia esclude `pressione_esercizio` dai
  compressori e non toglie nulla agli altri tipi.
- `getVarianti` su ASD 50 SFC restituisce tre varianti, due delle quali a 13 bar
  con portate 4580 e 3820. È il test che oggi fallisce e che il rimedio del
  difetto adiacente deve far passare.
- `getVarianti` continua a collassare le righe quasi-duplicate: stesso modello,
  stessa pressione, una con `pressione_esercizio` valorizzata e una senza →
  una sola variante, quella con più dati tecnici completi.
- La formattazione dell'opzione del menu a tendina con e senza `fad`.
- La composizione del testo dell'avviso: elenco ordinato, conteggio, singolare
  e plurale, e il caso «modello assente» che non deve produrre avviso.
