# Tag del template Word — Relazione Tecnica DM329

Il template `public/templates/relazione-dm329.docx` è "muto": contiene **solo** i tag qui
elencati. Tutte le decisioni (esiti, singolare/plurale, calcoli, riferimenti normativi)
sono già risolte nel `RelazioneModel`.

I tag corrispondono all'output di `buildTemplateData(model)` in `renderRelazione.ts`.

Sintassi docxtemplater: `{campo}` sostituzione · `{#lista}…{/lista}` loop/condizione ·
`{^flag}…{/flag}` sezione inversa · `{%tag}` immagine · i `\n` diventano a capo
(`linebreaks: true`).

## Come si modifica il template

Il template è un `.docx` pieno di segnaposto: al posto della ragione sociale c'è
`{premessa.ragioneSociale}`, e ogni tabella ha **una riga sola** avvolta in un loop, che
viene ripetuta alla generazione. Formattare un file così è scomodo, perché non si vede il
documento vero ma il suo scheletro: la tabella degli esiti ha 2 righe nel template e 21 nel
documento generato.

Perciò non si formatta il template. Si formatta un documento **reso**, e uno script fa il
percorso inverso.

### La procedura

**1. Genera un esempio da formattare**

```bash
npx tsx scripts/generate-relazione-sample.ts esempio.docx schema.png
```

L'immagine non è facoltativa: senza schema il paragrafo di §2.3 non compare affatto nel
documento reso, e non ci sarebbe nulla da sostituire con `{%schemaImpianto}`. Va bene un
PNG qualsiasi — nel template torna a essere un segnaposto.

**2. Formattalo in Word**

Centrature, margini, interruzioni di pagina, font, larghezze delle colonne, bordi. Si
lavora sul documento vero, con i dati sotto gli occhi.

**3. Ricava il template**

```bash
python scripts/tag-relazione-template.py esempio.docx
```

Riscrive `public/templates/relazione-dm329.docx`: rimette i tag al posto dei valori,
ricollassa le righe ripetute nel loop, ricrea i rami condizionali che un documento reso non
contiene, e toglie dal pacchetto l'immagine di esempio. Ogni sostituzione dichiara cosa si
aspetta di trovare e **si ferma** se non lo trova: meglio interrompersi che produrre in
silenzio un template mutilo.

**4. Verifica e committa**

```bash
npx tsx scripts/generate-relazione-sample.ts verifica.docx schema.png
npx vitest run
```

`verifica.docx` dev'essere identico a quello che hai formattato.

### Cosa si può cambiare in Word, e cosa no

| | |
|---|---|
| **Formattazione** | Liberamente: è lo scopo di questo flusso. |
| **Testo dei capoversi fissi** | Sì, con le eccezioni qui sotto. |
| **Sezioni, colonne, tabelle nuove** | No: cambia anche il modello dati, serve toccare il motore. |

Il testo di questi punti viene **riscritto** dallo script, quindi modificarlo in Word non
serve — sta nello script o nel motore:

- il capoverso di apertura della premessa («La presente relazione tecnica si riferisce…»);
- le voci dell'elenco sezioni in §2.1 e dell'elenco allegati in §8;
- il contenuto delle celle delle tabelle generate;
- la variante «tubazioni oltre soglia» di §5.4, che nel documento reso non compare mai
  quando le tubazioni sono escluse e viene ricreata da `tag-relazione-template.py`.

### Le frasi che fanno da aggancio

Lo script si orienta cercando queste frasi, e le intestazioni delle tabelle. Se ne riscrivi
l'**inizio**, non le trova più e si ferma: non è un danno, ma va aggiornato l'aggancio
corrispondente nello script.

```
ESEMPIO S.P.A.                     Lo schema seguente rappresenta…
Sito produttivo in                 Quest’ultima risulta priva…
La presente relazione tecnica…     Tutte le tubazioni…
L’attuale revisione…               Le attrezzature rientranti nel campo…
Ove previsto…                      Attestazioni…
L’impianto in oggetto è finalizzato…
```

Gli agganci sono per testo e non per posizione, quindi il documento può guadagnare o
perdere paragrafi senza conseguenze. Erano posizionali fino ad agosto 2026, e questo aveva
rotto il giro: unendo via e località di copertina in un solo paragrafo, ogni conteggio
successivo slittava di uno e lo script non riusciva più a leggere un documento uscito dal
template che lui stesso aveva prodotto.

### Regole da non violare quando si modifica il template in Word

1. **I tag di loop e di sezione vanno in un paragrafo tutto loro.** `{#lista}` e `{/lista}`
   scritti nella stessa riga del contenuto ripetono il testo senza andare a capo. Fa
   eccezione il loop di riga delle tabelle, dove `{#lista}` sta nella prima cella e
   `{/lista}` nell'ultima della riga modello.
2. **Nessun `vMerge` nella riga modello** delle tabelle: le fusioni le calcola il render.
3. Il tag immagine `{%schemaImpianto}` deve stare da solo nel suo paragrafo.

Valgono solo se si interviene direttamente sul template, saltando la procedura qui sopra.
Passando dallo script se ne occupa lui.

## Verifica dopo ogni modifica

```
npx vitest run                                   # fra cui il template reale
npx tsx scripts/generate-relazione-sample.ts verifica.docx [schema.png]
```

`templateIntegration.test.ts` verifica che il template renderizzi senza lasciare tag non
sostituiti, che l'XML risultante sia **ben formato** (un prefisso di namespace non
dichiarato rende il file illeggibile a Word) e che le fusioni di §5.2 siano presenti.

## Copertina
- `{premessa.ragioneSociale}`
- `{premessa.sedeLegaleCopertina}`, `{premessa.sitoProduttivoCopertina}` — indirizzo con la
  località a capo; il sito produttivo dichiarato a mano è testo libero e resta su una riga.
- Tabella revisioni (DATA / REV / OGGETTO): **statica e vuota**, la compila il redattore.
- Blocco firme: statico.
- Data del sopralluogo e nome del tecnico **non compaiono più**: rimossi dal documento e
  dal modello.

## §1 Premessa
- `{premessa.ragioneSociale}`, `{premessa.sedeLegale}` (una riga),
  `{premessa.descrizioneAttivita}`, `{premessa.ubicazione}`
- Revisione: `{#premessa.haRevisione}…{/premessa.haRevisione}`. Il motivo **non** è
  generato: resta un segnaposto giallo che il redattore compila in Word.
- Spessimetriche: `{#premessa.haSpessimetrica}…{/premessa.haSpessimetrica}`

## §2 Descrizione dell'impianto
- 2.1 elenco sezioni: `{#descrizioneGenerale.sezioni}` / `–\t{voce}` / `{/…}`
- 2.2 condizioni: `{#condizioniInstallazione}{requisito}` `{esito}` `{note}{/…}`
- 2.3 schema: `{%schemaImpianto}` — immagine scelta al momento della generazione, non
  persistita. Larghezza fissa e altezza proporzionale (`dimensioniSchema`).

## §3 Fluidi di processo
- `{#fluidi.righe}{circuito}` `{fluido}` `{gruppo}` `{provenienza}` `{qualita}{/fluidi.righe}`
- La frase «priva di sostanze nocive» esiste in **due varianti**:
  `{#fluidi.evidenziaNocive}` con evidenziatore giallo e `{^fluidi.evidenziaNocive}` piana.
  Ne compare una sola. L'automatismo segnala, non riscrive: la valutazione resta al redattore.

## §4 Caratterizzazione
`{#caratteristiche}` … `{/caratteristiche}` con
`{pos}` `{descrizione}` `{costruttore}` `{modello}` `{capacita}` `{pressione}`
`{temperatura}` `{categoria}` `{anno}` `{nFabbrica}`

## §5 Classificazione e adempimenti
- 5.1 criteri: tabella **statica** (soglie V, PS, PS×V e relativi riferimenti normativi).
- 5.2 esiti: `{#esiti}` … `{/esiti}` con
  `{pos}` `{apparecchiatura}` `{costruttore}` `{modello}` `{volume}` `{ps}` `{psPerV}`
  `{categoria}` `{adempimento}` `{statoInail}` `{verificaIntegritaMark}`

  Il riferimento normativo per riga **non** è più stampato: lo porta la tabella dei criteri
  di §5.1. `EsitoRow.riferimento` resta nel modello, disponibile se la colonna tornasse.

  ⚠️ **Le colonne «Stato INAIL» e «Verifica Integrità» vengono fuse verticalmente per
  gruppo** di apparecchiature (capogruppo + dipendenti + valvole) da `fusioneCelle.ts`,
  come post-elaborazione dell'XML renderizzato: `vMerge` sta in `w:tcPr` e il loop di
  docxtemplater duplica le proprietà di cella identiche, quindi non è esprimibile con un
  tag. La tabella si individua dall'intestazione **«Adempimento DM 329/2004»** e le colonne
  dalle intestazioni **«Stato INAIL»** e **«Verifica Integrità»**, confrontate ignorando
  gli spazi — così un'intestazione mandata a capo in Word continua a corrispondere.

  Rinominare quelle tre intestazioni disattiva la fusione (per scelta: un documento senza
  celle unite resta corretto, uno con XML rotto no). Il test la presidia: si è verificato
  che fallisca davvero cambiando l'ancoraggio.
- 5.3 protezioni: due tabelle, `{#protezioni.serbatoi}` e `{#protezioni.altre}`, con
  `{pos}` `{scaricoCondensa}` `{finituraInterna}` `{ancoraggio}` `{manometro}`
  e valvole annidate su paragrafi propri: `{#valvole}` / `{pos} · n.f. {nFabbrica}` / `{/valvole}`

  Niente colonna «Apparecchiatura» (la posizione basta) e niente pressione di taratura:
  la riporta §6.2, dove è confrontata con la PS del recipiente.
- 5.4 note: prosa invariante + tubazioni condizionali
  `{#tubazioni.escluse}` (DN ≤ 80) / `{^tubazioni.escluse}` (con `{tubazioni.dnMassimo}`,
  evidenziata: segnala l'obbligo di denuncia).

## §6 Valvole di sicurezza
- Portata: `{#valvole.portata}` … `{/valvole.portata}` con
  `{posValvola}` `{nFabbricaValvola}` `{portataMaxTesto}` `{portataScaricata}` `{adeguatoMark}`
  e connesse su paragrafi propri:
  `{#connesse}` / `Pos. {pos} – {descrizione} · {costruttore} {modello}` / `{/connesse}`

  `{portataMaxTesto}` è il totale quando concorre un solo compressore, la somma scomposta
  («8000 + 4920 = 12920») quando ne concorrono più d'uno.
- Pressione: `{#valvole.pressione}` … `{/valvole.pressione}` con
  `{posValvola}` `{nFabbricaValvola}` `{psRecipiente}` `{pressioneTaratura}` `{adeguatoMark}`
  e le stesse `{#connesse}`

## §7 Riqualificazione periodica
- 7.1 estratto Allegato B (solo recipienti a pressione): tabella **statica**.
- 7.2 scadenze: `{#riqualificazione}{pos}` `{apparecchiatura}` `{categoria}`
  `{verificaFunzionamento}` `{verificaIntegrita}{/riqualificazione}`

## §8 Allegati
`{#allegati}` / `{voce}` / `{/allegati}`

## Mark booleani

I flag del modello non arrivano al template come booleani: `buildTemplateData` li
converte in testo, così il template non contiene condizioni.

| Modello | Tag | Valori |
|---|---|---|
| `esiti[].verificaIntegrita` | `{verificaIntegritaMark}` | `✓` · vuoto |
| `valvole.portata[].adeguato` | `{adeguatoMark}` | `✓` · `n.a.` (nessun compressore collegato) · `n.d.` (dati mancanti) · vuoto (verifica non superata) |
| `valvole.pressione[].adeguato` | `{adeguatoMark}` | `✓` · `n.d.` · vuoto |
