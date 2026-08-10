# Come modificare il template della relazione tecnica DM329

Questa cartella contiene le relazioni storiche e i documenti di esempio. Il template vero e
proprio sta invece in `public/templates/relazione-dm329.docx`, ed è quello che l'app usa per
generare le relazioni.

Il template è un `.docx` pieno di segnaposto: al posto della ragione sociale c'è
`{premessa.ragioneSociale}`, e ogni tabella ha **una riga sola** avvolta in un loop, che
viene ripetuta alla generazione. Formattare un file così è scomodo, perché non si vede il
documento vero ma il suo scheletro: la tabella degli esiti ha 2 righe nel template e 21 nel
documento generato.

Perciò non si formatta il template. Si formatta un documento **reso**, e uno script fa il
percorso inverso.

## La procedura

> **Tutti i comandi si lanciano dalla radice del progetto**, cioè da `OFF-TICKET_UT`, non da
> questa cartella. È lì che stanno `scripts/` e `node_modules/`. Se il terminale ti dice
> `Cannot find module …\DOCUMENTAZIONE\relazione\scripts\…`, sei nella cartella sbagliata:
>
> ```bash
> cd "C:\Users\FrancescoBertin\Desktop\CLAUDE CODE\OFF-TICKET_UT"
> ```

### 1. Genera un esempio da formattare

```bash
npx tsx scripts/generate-relazione-sample.ts DOCUMENTAZIONE/relazione/esempio.docx DOCUMENTAZIONE/relazione/schema.png
```

L'immagine non è facoltativa: senza schema il paragrafo di §2.3 non compare affatto nel
documento reso, e non ci sarebbe nulla da sostituire con il tag dell'immagine. Va bene un
PNG qualsiasi — nel template torna a essere un segnaposto. In questa cartella ce n'è già
uno, `schema.png`.

### 2. Formattalo in Word

Centrature, margini, interruzioni di pagina, font, larghezze delle colonne, bordi. Si lavora
sul documento vero, con i dati sotto gli occhi.

### 3. Ricava il template

```bash
python scripts/tag-relazione-template.py DOCUMENTAZIONE/relazione/esempio.docx
```

Riscrive `public/templates/relazione-dm329.docx`: rimette i tag al posto dei valori,
ricollassa le righe ripetute nel loop, ricrea i rami condizionali che un documento reso non
contiene, e toglie dal pacchetto l'immagine di esempio. Ogni sostituzione dichiara cosa si
aspetta di trovare e **si ferma** se non lo trova: meglio interrompersi che produrre in
silenzio un template mutilo.

### 4. Verifica e committa

```bash
npx tsx scripts/generate-relazione-sample.ts DOCUMENTAZIONE/relazione/verifica.docx DOCUMENTAZIONE/relazione/schema.png
npx vitest run
```

`verifica.docx` dev'essere identico a quello che hai formattato.

## Cosa si può cambiare in Word, e cosa no

| | |
|---|---|
| **Formattazione** | Liberamente: è lo scopo di questo flusso. |
| **Testo dei capoversi fissi** | Sì, con le eccezioni qui sotto. |
| **Sezioni, colonne, tabelle nuove** | No: cambia anche il modello dati, serve toccare il motore. |

L'elenco di §2.1 e quello degli allegati in §8 possono essere paragrafi con un trattino
scritto a mano oppure un elenco puntato di Word: lo script li riconosce da ciò che li
racchiude, non dalla forma delle voci.

Il segnaposto giallo `[descrivere le motivazioni della revisione]` in §1 non è più da
compilare in Word: il motivo si scrive nel form «Dati per la relazione tecnica» e lo script
lo sostituisce con un tag. Nel documento di esempio resta lì perché serve da aggancio, ma
nelle relazioni generate non compare mai — e senza motivo scritto sparisce l'intero
capoverso.

L'evidenziazione gialla della frase «priva di sostanze nocive» in §3 la mette lo script,
non il documento: è la marcatura con cui il sistema segnala al lettore che lì c'è una
valutazione da fare. Toglierla in Word non ha effetto.

Nemmeno l'a capo dell'indirizzo di copertina è una scelta tipografica: la località va a
capo perché il motore la manda a capo. Unire le due righe in Word non ha effetto, e la
copertina generata tornerà su due righe.

Fra il capoverso di §2.3 e lo schema si possono lasciare righe vuote: lo script cerca
l'immagine scavalcandole.

Il testo di questi punti viene **riscritto** dallo script, quindi modificarlo in Word non
serve — sta nello script o nel motore:

- il capoverso di apertura della premessa («La presente relazione tecnica si riferisce…»);
- le voci dell'elenco sezioni in §2.1 e dell'elenco allegati in §8;
- il contenuto delle celle delle tabelle generate;
- la variante «tubazioni oltre soglia» di §5.4, che nel documento reso non compare mai
  quando le tubazioni sono escluse e viene ricreata da `tag-relazione-template.py`.

## Le frasi che fanno da aggancio

Lo script si orienta cercando queste frasi, e le intestazioni delle tabelle. Se ne riscrivi
l'**inizio**, non le trova più e si ferma: non è un danno, ma va aggiornato l'aggancio
corrispondente nello script.

```
ESEMPIO S.P.A.                       Lo schema seguente rappresenta…
Sito produttivo in                   Quest’ultima risulta priva…
La presente relazione tecnica…       Tutte le tubazioni…
L’attuale revisione…                 Le attrezzature rientranti nel campo…
Ove previsto…                        Attestazioni…
L’impianto in oggetto è finalizzato… L’impianto è protetto contro i rischi…
```

Dentro il capoverso della revisione ce ne sono altri due: il motivo si riconosce da
«conseguente a:» che lo apre e da «. Vengono verificati» che lo chiude. Non lo si cerca
per la forma — nel documento formattato a mano lì c'è un segnaposto, in uno reso c'è il
motivo vero, e sono testi diversi.

Gli ultimi due delimitano l'elenco delle sezioni di §2.1: quell'elenco si riconosce da ciò
che lo racchiude, non dalla forma delle sue voci.

Gli agganci sono per testo e non per posizione, quindi il documento può guadagnare o perdere
paragrafi senza conseguenze. Erano posizionali fino ad agosto 2026, e questo aveva rotto il
giro: unendo via e località di copertina in un solo paragrafo, ogni conteggio successivo
slittava di uno e lo script non riusciva più a leggere un documento uscito dal template che
lui stesso aveva prodotto.

## Se intervieni direttamente sul template

Passando dalla procedura qui sopra non serve saperlo, se ne occupa lo script. Ma se un
giorno si preferisse modificare `relazione-dm329.docx` a mano, ci sono tre regole da non
violare:

1. **I tag di loop e di sezione vanno in un paragrafo tutto loro.** `{#lista}` e `{/lista}`
   scritti nella stessa riga del contenuto ripetono il testo senza andare a capo. Fa
   eccezione il loop di riga delle tabelle, dove `{#lista}` sta nella prima cella e
   `{/lista}` nell'ultima della riga modello.
2. **Nessun `vMerge` nella riga modello** delle tabelle: le fusioni le calcola il render.
3. Il tag immagine `{%schemaImpianto}` deve stare da solo nel suo paragrafo.

## Dove trovare l'elenco dei tag

`src/services/relazione/TEMPLATE_TAGS.md` elenca sezione per sezione tutti i segnaposto che
il template può contenere, con le note su cosa è statico e cosa generato.
