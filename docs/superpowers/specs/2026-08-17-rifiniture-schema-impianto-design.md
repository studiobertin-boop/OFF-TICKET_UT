# Rifiniture dell'editor dello schema d'impianto — specifica

**Data:** 17-08-2026
**Origine:** cinque richieste del committente dopo aver provato in produzione il Blocco 3
(simboli ridisegnati sui blocchi CAD e libreria tarabile, in produzione dal 17-08-2026 col merge
`21c0c80`).

Una sesta richiesta — far spezzare la tubazione a valvole e riduttori — è **fuori da questo
giro**: il committente l'ha chiesta «solo se non comporta un lavoro troppo grande», e la stima
va fatta prima, separatamente. Non compare in questa specifica.

## Perché adesso

Tutte e cinque nascono dalla stessa prova in pagina: il disegno funziona, ma alcuni segni non
dicono quel che il committente vuole che dicano. Sono correzioni di linguaggio grafico, non di
meccanismo — nessuna tocca il modello dei dati, e ognuna si vede a occhio nella tela dell'editor
e nel `.docx` generato.

## R1 — Le frecce di direzione diventano un oggetto da posare a mano

**Oggi:** ogni tubazione porta in coda una punta di freccia disegnata d'ufficio, con l'attributo
`marker-end="url(#freccia)"` sul tracciato. Non si può togliere, non si può spostare, e ce n'è
esattamente una per tratto — dove il tratto arriva, non dove il verso del flusso sarebbe utile
leggerlo.

**Voluto:** nessuna freccia automatica. Un componente nuovo, che si aggiunge da un pulsante di
barra come «+ Valvola» e «+ Riduttore», si aggancia al tratto selezionato, scorre lungo di esso
trascinandolo e **si orienta secondo la direzione del tratto nel punto in cui sta**. Dimensione:
**il 70% di quella attuale**.

**Conseguenze accettate:**
- I layout già salvati contengono archi senza segni-freccia: dopo questa modifica i loro disegni
  non avranno più le punte finché qualcuno non le posa a mano. È l'effetto voluto, ma va detto al
  committente.
- La freccia in cima al codolo del terminale «Alle utenze» è un'altra cosa (fa parte di
  `simboloUtenze`, ed è un triangolo pieno, non un marker) e **resta**.
- La legenda elenca i segni realmente presenti nel disegno: si aggiorna da sé, ma va verificata.

**Vincolo tecnico noto:** i segni di oggi si disegnano sapendo solo se il tratto è orizzontale o
verticale (`puntoSuTratto` restituisce `orizzontale: boolean`). Una freccia ha bisogno del
**verso**, non solo della giacitura, e i tratti possono essere diagonali. La geometria va estesa
per riportare la direzione.

## R2 — La scritta del terminale utenze va sopra la freccia, centrata

**Oggi:** la scritta sta a destra del codolo, allineata a sinistra, su una riga sola
(«Utenze aria»).

**Voluto:** **sopra** la punta di freccia, **centrata** rispetto a essa e con giustificazione
centrata, su **due righe**: «Utenze» sopra, «aria» sotto.

**Come si ottiene l'a capo:** mettendolo nell'etichetta — il testo di default diventa
`Utenze\naria`, e l'utente resta libero di cambiarlo dal dialogo. **Non** con una regola
automatica che spezza sull'ultima parola: sarebbe una regola diversa, più fragile, e imporrebbe
l'a capo anche a etichette che non lo vogliono. **Da confermare col committente alla prima prova
in pagina.**

**Vincolo tecnico noto:** l'ingombro del terminale **cresce col testo** (`riquadroDi` ha un ramo
apposta, e l'ancora `in` segue l'altezza vera). Portando la scritta da una riga a due e da destra
a sopra, quel calcolo va rifatto: la larghezza non dipende più dal rientro a destra, e l'altezza
deve comprendere le righe che ora stanno **sopra** la punta, non sotto. Sbagliarlo taglia il nodo
nel documento.

**Sui layout già salvati:** l'etichetta del terminale è l'unico testo di origine `scheda` che
l'utente può cambiare, e la riconciliazione tiene quella salvata. Le tre pratiche con layout
salvato conserveranno quindi «Utenze aria» su una riga, e la nuova disposizione centrata si
applicherà a quella riga sola.

## R3 — I nuovi oggetti compaiono troppo lontano

**Oggi:** ciò che si aggiunge a mano nasce **sotto tutto il disegno**
(`piedeDelDisegno(...) + 40`, ascissa fissa 40): con uno schema alto bisogna inseguirlo scorrendo.

**Voluto:** **appena sopra il bordo sinistro dell'oggetto più a sinistra** — di solito il
compressore — così lo si trova subito.

**Perimetro:** vale per tutto ciò che si aggiunge a mano — le apparecchiature della palette, le
annotazioni libere e il muro.

## R4 — Il pallino del TEE al 50%

`DIAMETRO_GIUNZIONE` passa da **10** a **5**.

Il committente dice esplicitamente che **i punti di ancoraggio vanno bene come sono** e non vanno
toccati: cambia solo il raggio del cerchio disegnato.

**Da non rimettere in discussione:** la punta di freccia sopra il pallino porta l'informazione del
verso del flusso (deciso col committente il 15-08-2026) e resta. Va però verificato che a
diametro dimezzato **resti leggibile**.

## R5 — L'ondulazione dei flessibili, più dolce

Le onde del tubo flessibile sono **troppo fitte**: il committente vuole un tratto più dolce.

**Attenzione a una contraddizione nelle sue parole:** ha chiesto «un periodo metà dell'attuale»,
ma dimezzare il periodo **raddoppia** il numero di ondulazioni e le rende più fitte — l'opposto di
ciò che descrive. **Vince l'intento**: si raddoppia il periodo (`PASSO_ONDA` da 5 a 10), cioè metà
delle onde sulla stessa lunghezza. **Da verificare con lui alla prima prova, mostrandogli il
risultato.**

**Vincolo geometrico da rispettare:** i capi di ogni semiperiodo stanno sull'asse perché il
flessibile deve entrare **dritto** nel raccordo, come nei blocchi CAD; l'ultimo semiperiodo ha
ampiezza nulla per la stessa ragione. Un flessibile talmente corto da avere un solo semiperiodo
diventa perciò rettilineo, e **raddoppiando il passo questo caso diventa più frequente**: i tratti
brevi vanno guardati prima di dire che è fatto.

## Cosa NON cambia

- Il modello dei dati del layout salvato: nessuna migrazione, nessuna conversione.
- Le ancore, in nessuna delle cinque.
- Il modo taratura e la libreria a tre strati.
- La freccia del terminale utenze.

## Come si verifica

Ognuna delle cinque si vede sul disegno renderizzato. I tre riferimenti SVG committati
(`src/services/schemaImpianto/__tests__/fixtures/svgRiferimento*.ts`) **cadranno tutti**: R1, R2,
R4 e R5 cambiano il tracciato. Un riferimento non si aggiorna per far tornare verde un test —
prima si legge la differenza, si verifica che sia quella attesa e nient'altro, e il commit dice
cosa cambiava.
