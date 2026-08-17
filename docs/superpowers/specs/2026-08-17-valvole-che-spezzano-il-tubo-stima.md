# Valvole e riduttori che spezzano la tubazione — stima

**Data:** 17-08-2026
**Richiesta del committente:** poter disegnare il tratto a monte di una valvola come flessibile e
quello a valle come rigido. Posta «solo se non comporta un lavoro troppo grande», quindi la prima
cosa da fare è misurarla, non farla.

**Esito in una riga:** fatta alla lettera è **più grande del TEE**, che occupò un blocco intero più
una coda con un piano suo. Ma esiste una strada che dà lo stesso risultato per chi disegna a **un
quinto circa** del costo, e non tocca né i layout già salvati né il disegno automatico.

## Perché oggi non si può

Valvola e riduttore non sono oggetti: sono **segni** che scorrono su un unico arco, individuati da
una posizione `t` lungo la polilinea (`SchemaSegnoTubo`, `types.ts`). Lo stile — rigida, flessibile,
condense — è una proprietà dell'**arco intero**. Un arco solo, uno stile solo: da qui il limite.

La linea *si interrompe già* dentro la valvola (un rettangolo bianco la copre, dal Blocco D4), ma è
solo grafica: sotto, il tubo è uno.

## Il metro di misura: cosa costò il TEE

Il TEE è esattamente questa trasformazione, fatta una volta: un segno diventato nodo con più
attacchi, che spezza l'arco in due archi distinti. Misurato sulla storia del repo:

| | |
|---|---|
| Blocco D3, il TEE | 7 task, piano di 1763 righe, **15 commit**, 16 file toccati, ~1200 righe in `src` |
| La coda: «l'imbocco del TEE» | un **piano supplementare** tutto suo, più i fix che ne seguirono |
| Fix sparsi successivi | l'ancora che segue l'asse del tratto tagliato, `trascinaTratto` con i lati imposti, il Canc che cancellava l'apparecchiatura invece dell'ancora, il modo taratura da spegnere sulla giunzione |

Il TEE, insomma, non è finito col suo blocco: è tornato tre volte.

## Perché per le valvole costa di più, non di meno

Cinque differenze, tutte a sfavore:

1. **Il TEE lo posa l'utente, le valvole nascono da sole.** `buildSchemaModel` semina una valvola di
   intercettazione su **ogni** mandata e su ogni tratto di linea. Diventando nodi, il disegno
   automatico dovrebbe crearne tre o sei per impianto e **posizionarle lungo il tubo** — una logica
   che non esiste: `layoutSchema` dispone apparecchiature in righe, non oggetti su una linea.
2. **La giunzione non compare né in `layout.ts` né in `persistenza.ts`.** Verificato: zero
   occorrenze. Il TEE ha potuto ignorare layout automatico e riconciliazione perché nasce dal mouse
   con la sua posizione già data. Le valvole finirebbero in entrambi.
3. **I layout già salvati** (ORVED e LOWA R&D oggi, tutti quelli futuri) contengono i segni nella
   forma vecchia. O si converte al caricamento, o si legge in due forme per sempre. Il formato ha
   un numero di versione, ma alzarlo **butta via il layout salvato**: la conversione va scritta a
   mano, e provata su quelle pratiche vere.
4. **Il problema dell'imbocco si moltiplica.** Ogni nodo sul tubo impone un lato a entrambi i capi
   che tocca; è il problema che sul TEE ha richiesto il piano supplementare, e lì di nodi ce n'era
   uno solo, messo a mano.
5. **Coda lunga di dettagli:** le valvole non devono comparire nella lista apparecchiature (oggi
   sono segni, quindi il problema non esiste); la legenda le elenca leggendo i segni; il modo
   taratura le troverebbe come simboli nuovi e tarabili; il Canc, l'annulla e il trascinamento
   vanno rifatti per la forma nuova.

**Stima, nelle stesse unità del TEE: due blocchi pieni** — uno per il modello e il disegno, uno per
editor, riconciliazione e migrazione — con una coda probabile, perché è quello che è successo col
TEE avendo un decimo dei casi da coprire.

## La strada corta: il punto di taglio

Il committente vuole **due tratti con stili diversi**. Non ha chiesto che sia la valvola a produrli:
la valvola è il posto dove, nel suo disegno, il tipo di tubo cambia.

Si può quindi dare direttamente quello che serve: **spezzare un tubo in due dove si vuole**, e dare
a ciascuna metà lo stile che si vuole.

Tutto il necessario esiste già:

- **`spezzaArco`** (`inserimentoTee.ts`) taglia una polilinea in due metà, conserva i gomiti fatti a
  mano e ridistribuisce i segni fra le due. Non è legato al TEE se non dal nome del file: prende
  polilinea, segni e punto, e restituisce le due metà. È collaudato da agosto.
- **I pulsanti «Rigida», «Flessibile», «Condense»** sono già in barra e cambiano lo stile dell'arco
  selezionato. Spezzato il tubo, i due tronconi sono archi normali: si selezionano e si cambiano.
- **Il salvataggio non cambia forma**: due archi al posto di uno sono già rappresentabili oggi.

Resta da fare: un comando «Spezza qui» sul tratto selezionato, il punto di giunzione fra le due metà
(un raccordo senza simbolo, o il pallino piccolo che il TEE già disegna), e il fatto che le due metà
restino attaccate quando si trascina un'apparecchiatura.

**Stima: un blocco piccolo, tre o quattro task.** Niente migrazione dei salvati, niente modifiche al
disegno automatico, nessun nuovo simbolo.

**Il prezzo:** due gesti invece di uno. Per avere «monte flessibile, valle rigido» si spezza il tubo
e poi si posa la valvola dove serve, invece di ottenerlo posando la sola valvola.

## Terza via, per completezza

Lasciare un arco solo e dargli **più tratti con stili diversi** (una lista di cambi di stile lungo
la polilinea). Nessun nodo nuovo, nessuna migrazione, ma tocca il cuore del disegno — `renderSvg`
dovrebbe spezzare la polilinea in pezzi e disegnarli con stili diversi — e va inventata l'interfaccia
per dire «da qui in poi flessibile». **Un blocco medio**, e introduce un concetto nuovo nel modello
che oggi non c'è. Non la consiglio: costa più della strada corta e dà lo stesso risultato.

## Cosa consiglio

**La strada corta.** Dà al committente ciò che ha chiesto — due tratti di tipo diverso attorno a una
valvola — a un costo che sta dentro la sua condizione («solo se non è un lavoro troppo grande»),
mentre la richiesta letterale non ci sta.

Se però vuole proprio che sia la valvola a spezzare il tubo, e non un comando a parte, allora è un
lavoro da due blocchi con la sua specifica: non una rifinitura da infilare in un giro.

## Cosa NON dice questa stima

Non ho scritto una riga di codice per misurarla: è una lettura del codice e della storia del repo.
Il numero su cui sono più sicuro è quello del TEE, perché è già successo. Quello della strada corta
è il meno verificato: se il raccordo fra due metà si rivelasse tanto delicato quanto l'imbocco del
TEE, cresce.
