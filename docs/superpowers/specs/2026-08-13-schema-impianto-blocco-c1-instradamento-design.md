# Schema d'impianto — Blocco C1: un solo instradamento per editor e documento

Data: 13-08-2026. Ramo `worktree-schema-impianto-dm329`, base `db8f07d` (Blocco B chiuso, 876 test verdi).

## Il problema, come lo ha visto il committente

Provando l'editor sulla pratica vera, il committente ha trovato due cose che sono lo stesso difetto:

> «la linea flessibile che parte dai compressori non è trascinabile come le altre. Inoltre in
> anteprima è visualizzata correttamente mentre in editor non ha i gomiti»

> «il percorso delle tubazioni appare diverso in anteprima e in editor»

La causa è nota e già registrata come debito tecnico alla chiusura del Blocco B. L'unificazione
dell'instradamento fatta lì (Task 8/9) vale **solo per gli archi che portano gomiti imposti a mano**
(`punti.length > 0`). Per ogni altro arco — cioè ogni arco appena generato da `buildSchemaModel` — le
due parti disegnano cose diverse:

| | editor (`SchemaEdgeTubazione.tsx:263`) | documento (`renderSvg.ts`) |
|---|---|---|
| flessibile compressore→serbatoio | angolo singolo (`raccordoOrtogonale`) | montante fino al collettore, orizzontale, discesa: **quattro punti** (`renderMandataCompressore`) |
| mandata di linea | angolo singolo | spezzata a metà strada (`renderMandataLinea`) |
| linea condense | angolo singolo | corsia comune sopra il pozzo (`renderLineaCondense`) |

Il trascinamento del tratto sul flessibile è spento di proposito
(`pointerEvents: stile === 'flessibile' ? 'none' : 'all'`, `SchemaEdgeTubazione.tsx:302`): la linea
visibile del flessibile è l'onda, non la polilinea dritta, e finché la dritta non coincide con la
rotta vera, un'area di presa sagomata su di essa sposterebbe il tubo altrove da dove l'utente lo
vede. È la stessa causa: sparisce quando sparisce la divergenza.

## Cosa deve cambiare, dal punto di vista di chi usa l'editor

- L'editor disegna i tubi **con la stessa forma che avranno nel documento**, anche quando non ci sono
  gomiti messi a mano: montante e collettore per la mandata dai compressori, spezzata a metà per le
  mandate di linea, corsia comune per le condense.
- **La flessibile si trascina nel tratto**, come tutte le altre tubazioni. Il trascinamento dei suoi
  gomiti resta com'è.
- Resta vero che, appena si impone un gomito a mano, quel tubo esce dalla rotta automatica e segue i
  gomiti — da entrambe le parti, come già oggi.
- **Effetto collaterale accettato e dichiarato:** la quota del collettore e quella della corsia
  condense si ricavano dalle posizioni di *tutti* i nodi. Spostando un serbatoio, quelle quote
  cambiano e le linee che le usano si riassestano mentre si trascina. È il prezzo della coerenza:
  congelare le quote nell'editor rimetterebbe in piedi la divergenza che questo blocco chiude.

## Architettura

### Una sola funzione decide la forma di un tubo

Le tre rotte native migrano da `renderSvg.ts` a `tratti.ts`, come funzioni pure, sullo stesso modello
di `polilineaConGomiti` e `ondula`:

- `rottaFlessibile(pDa, pA, yCollettore)` — montante, collettore, discesa (con `AVVICINAMENTO`, che si
  sposta qui perché è geometria del tratto, non del render).
- `rottaLinea(pDa, pA)` — spezzata a metà strada.
- `rottaCondensa(pDa, pA, yCorsia)` — corsia comune.

Sopra di esse, un ingresso unico — `instrada(stile, pDa, pA, gomiti, quote)` — che sceglie la rotta
per stile e resta su `polilineaConGomiti` quando l'arco porta gomiti a mano. Da quel momento
**esiste un solo posto che sa dare forma a un tubo**: `renderSvg.ts` lo chiama per il documento,
`SchemaEdgeTubazione.tsx` per la tela. Le due parti non possono più allontanarsi per omissione, ed è
per omissione che si sono allontanate finora.

`renderSvg.ts` conserva le sue tre `renderMandata*`: restano responsabili del **tratto disegnato**
(onda, tratteggio, freccia di verso, soppressione della freccia sul terminale utenze) e delegano a
`instrada` la sola scelta dei punti. Non è un rimescolamento di responsabilità: la forma è di
`tratti.ts`, la resa grafica è di `renderSvg.ts`.

### Le quote diventano un dato che l'editor calcola e passa

`quotaCollettore` e `quotaCorsiaCondense` si spostano da `renderSvg.ts` a `layout.ts`, dove già
vivono `pozzoCondense`, `corpoNodo` e `dimensioniLayout` da cui dipendono, e diventano esportate.

L'editor le ricalcola dalle posizioni correnti: `flowALayout(nodes, edges)`
(`conversioneFlow.ts:43`) ricostruisce già un `SchemaLayout` completo dai nodi react-flow, quindi le
stesse due funzioni servono i due lati senza logica duplicata. `SchemaEditor.tsx` le calcola una
volta per aggiornamento dei nodi e le infila nei dati di ogni arco; `SchemaEdgeTubazione.tsx` le
legge da `data` insieme a stile e gomiti. L'arco non calcola quote per conto suo: sono proprietà del
disegno intero, e ricavarle dentro ogni tubo significherebbe dare a ogni tubo una vista sul layout
globale che oggi non ha e non deve avere.

### Il trascinamento del tratto si riapre sul flessibile

Cade `pointerEvents: 'none'` per lo stile flessibile: l'area invisibile di presa segue la polilinea
dritta, che da qui in avanti è la stessa che l'onda decora e che il documento disegnerà. Il commento
che oggi motiva l'esclusione va riscritto per dire perché l'esclusione non serve più — nel Blocco B
quei commenti sono stati corretti proprio perché affermavano il falso, e vanno tenuti onesti.

## Test

Il difetto ricorrente di questo modulo sono i test che non discriminano: verdi tanto sul
comportamento giusto quanto su quello sbagliato. Qui il rischio è concreto, perché test separati
sulle singole rotte passerebbero identici prima e dopo l'unificazione (le rotte esistono già, solo
nel posto sbagliato).

**Il test cardine è l'accordo fra le due parti**: preso un layout, la lista di punti che il documento
disegna per un arco e quella che la tela disegna per lo stesso arco devono coincidere — per i tre
stili, con e senza gomiti a mano. Oggi fallisce sui casi senza gomiti, ed è la definizione stessa del
difetto: è il test che va visto rosso per primo, con la prova su file.

Attorno a quello:

- le tre rotte in `tratti.ts` producono gli stessi punti che le `renderMandata*` producevano prima
  della migrazione (verifica di relocazione, non di comportamento nuovo);
- le due quote esportate da `layout.ts` restituiscono, sullo stesso layout, i valori che
  `renderSvg.ts` calcolava internamente;
- il flessibile risponde al trascinamento del tratto (oggi non risponde: `pointerEvents: 'none'`).

Le verifiche in pagina le fa il controller sulla pratica `c6f56ca5-d57b-408c-a4e5-69a207812b0d`, con
il giro già collaudato nei blocchi precedenti, senza mai premere «Genera comunque .docx». La prova
finale la fa il committente.

## Perimetro

**Dentro:** le tre rotte condivise, le due quote esportate e calcolate anche dall'editor, il
trascinamento del tratto sul flessibile, i commenti che descrivono l'instradamento.

**Fuori (vanno nel Blocco C2, già deciso col committente il 13-08-2026):**

- **TEE come punto di giunzione neutro.** Il simbolo perde i tre monconi e diventa un pallino pieno,
  con quattro ancore (sinistra, destra, alto, basso) sempre disponibili: nessuna rotazione da
  modellare, perché tutte le direzioni esistono contemporaneamente, e la forma a T la disegnano le
  tubazioni che ci arrivano. Le ancore `sx`/`dx`/`basso` conservano i loro identificativi, quindi i
  TEE già salvati continuano a funzionare. Ingombro e diametro del pallino vanno scelti perché i
  tubi non lascino buchi visibili attorno al punto.
- **Etichetta delle utenze su più righe** e **campi di testo liberi sulla tela**, nella forma
  essenziale: si creano, si scrivono su più righe, si trascinano, si cancellano; stesso carattere e
  stessa dimensione della scritta «Utenze aria», nessuna cornice, nessuna scelta di corpo. Si salvano
  con lo schema e sopravvivono alla riconciliazione con la scheda dati; non entrano nell'elenco
  apparecchiature né in legenda. Le due richieste condividono la funzione di disegno del testo
  multi-riga, quindi vanno fatte insieme e in quest'ordine.

**Fuori, e non per questo blocco né per il C2:** rifinire i simboli esistenti. Il committente
fornirà i suoi blocchi CAD e verranno importati con un'interfaccia dedicata.

**Nessun merge e nessun push su `main`** finché il committente non lo dice.

## Rischi

- **Le quote che si muovono durante il trascinamento** possono risultare fastidiose all'uso. È il
  comportamento corretto, ma è la cosa più visibile del blocco: va mostrata al committente nella
  prova in pagina, non spiegata a parole.
- **La migrazione delle rotte tocca il render del documento**, cioè il prodotto finito. Ogni rotta
  spostata va verificata identica prima di poterle cambiare padrone: se la relocazione sbaglia, il
  danno non è nell'editor ma nei .docx.
- **`instrada` è un punto di passaggio obbligato**: un errore lì si vede ovunque. In compenso è
  proprio questo che rende il difetto non più ripetibile a metà.
