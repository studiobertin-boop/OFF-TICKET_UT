# Tag del template Word — Relazione Tecnica DM329

Il template `public/templates/relazione-dm329.docx` è "muto": contiene **solo** i tag qui
elencati. Tutte le decisioni (esiti, singolare/plurale, calcoli, riferimenti normativi)
sono già risolte nel `RelazioneModel`.

I tag corrispondono all'output di `buildTemplateData(model)` in `renderRelazione.ts`.

Sintassi docxtemplater: `{campo}` sostituzione · `{#lista}…{/lista}` loop/condizione ·
`{^flag}…{/flag}` sezione inversa · `{%tag}` immagine · i `\n` diventano a capo
(`linebreaks: true`).

## Chi possiede il template

**Il `.docx` è la sorgente di verità.** Si modifica in Word, come qualunque documento.
Fino alla Fase 5 era generato da uno script Python; quello script è stato ritirato, perché
rigenerare distruggeva ogni volta la formattazione.

`scripts/tag-relazione-template.py` è lo strumento con cui il template è stato ricavato
**una volta** dal documento formattato dal redattore
(`DOCUMENTAZIONE/relazione/ESEMPIO_nuova_struttura_revFB.docx`): sostituisce i valori con i
tag, collassa le righe ripetute in loop e ricrea i rami condizionali che un documento reso
non contiene. Serve se un domani si preferisce riformattare un documento di esempio invece
di intervenire sul template. **Non è parte della build** e non va eseguito per abitudine:
rilanciarlo sovrascrive il template con quanto ricavato dal documento di esempio.

### Regole da non violare quando si modifica il template in Word

1. **I tag di loop e di sezione vanno in un paragrafo tutto loro.** `{#lista}` e `{/lista}`
   scritti nella stessa riga del contenuto ripetono il testo senza andare a capo. Fa
   eccezione il loop di riga delle tabelle, dove `{#lista}` sta nella prima cella e
   `{/lista}` nell'ultima della riga modello.
2. **Nessun `vMerge` nella riga modello** delle tabelle: le fusioni le calcola il render.
3. Il tag immagine `{%schemaImpianto}` deve stare da solo nel suo paragrafo.

## Verifica dopo ogni modifica

```
npx vitest run                                   # 177 test, fra cui il template reale
npx tsx scripts/generate-relazione-sample.ts DOCUMENTAZIONE/relazione/ESEMPIO_nuova_struttura.docx [schema.png]
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
