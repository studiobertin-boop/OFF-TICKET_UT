# Tag del template Word — Relazione Tecnica DM329

Il template `public/templates/relazione-dm329.docx` è "muto": contiene **solo** i tag qui
elencati. Tutte le decisioni (esiti, singolare/plurale, calcoli, riferimenti normativi)
sono già risolte nel `RelazioneModel`.

I tag corrispondono all'output di `buildTemplateData(model)` in `renderRelazione.ts`.

Sintassi docxtemplater: `{campo}` sostituzione · `{#lista}…{/lista}` loop/condizione ·
`{^flag}…{/flag}` sezione inversa · `{%tag}` immagine · i `\n` diventano a capo
(`linebreaks: true`).

## Come si modifica il template

Non si formatta il template: si formatta un documento generato e uno script fa il percorso
inverso. La procedura completa — comandi, cosa si può cambiare in Word e cosa no, le frasi
che fanno da aggancio — sta in
[`DOCUMENTAZIONE/relazione/COME-MODIFICARE-IL-TEMPLATE.md`](../../../DOCUMENTAZIONE/relazione/COME-MODIFICARE-IL-TEMPLATE.md),
accanto ai documenti di esempio su cui si lavora.

In breve:

```bash
npx tsx scripts/generate-relazione-sample.ts esempio.docx schema.png   # 1. genera
#                                                                        2. formatta in Word
python scripts/tag-relazione-template.py esempio.docx                  # 3. ricava il template
```

Questo file resta l'elenco dei tag: cosa il template può contenere, non come lo si modifica.

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
- Tabella revisioni (DATA / REV / OGGETTO), nel piè di pagina: l'ultima riga è generata —
  `{premessa.dataEmissione}` (scelta nel form, resa in gg/mm/aaaa), `{premessa.numeroRevisione}`
  dal codice pratica e `{premessa.notaRevisione}`. Le righe superiori restano vuote: le
  compila il redattore a ogni revisione.
- Blocco firme: statico.
- Data del sopralluogo e nome del tecnico **non compaiono più**: rimossi dal documento e
  dal modello.

## §1 Premessa
- `{premessa.ragioneSociale}`, `{premessa.sedeLegale}` (una riga),
  `{premessa.descrizioneAttivita}`, `{premessa.ubicazione}`
- Revisione: `{#premessa.haRevisione}…{/premessa.haRevisione}`, col motivo in
  `{premessa.motivoRevisione}`. Il motivo lo scrive il tecnico nel form «Dati per la
  relazione tecnica»: resta una valutazione sua, ma non è più un segnaposto da compilare in
  Word. La sezione è vera solo se il progressivo supera lo zero **e** il motivo è scritto:
  senza, il capoverso non compare.
- Spessimetriche: `{#premessa.haSpessimetrica}…{/premessa.haSpessimetrica}`

## §2 Descrizione dell'impianto
- 2.1 elenco sezioni: `{#descrizioneGenerale.sezioni}` / `–\t{voce}` / `{/…}`
- 2.2 condizioni: `{#condizioniInstallazione}{requisito}` `{esito}{/…}` — due colonne.
  L'eventuale precisazione (le fonti di calore vicine) si accoda all'esito col trattino.
- 2.3 schema: `{%schemaImpianto}` — immagine scelta al momento della generazione, non
  persistita. Larghezza fissa e altezza proporzionale (`dimensioniSchema`).

## §3 Fluidi di processo
- `{#fluidi.righe}{circuito}` `{fluido}` `{gruppo}` `{provenienza}{/fluidi.righe}`
- La qualità dell'aria aspirata **non ha più una colonna**: resta dichiarata in scheda e la
  segnala l'evidenziazione qui sotto.
- La frase «priva di sostanze nocive» esiste in **due varianti**:
  `{#fluidi.evidenziaNocive}` con evidenziatore giallo e `{^fluidi.evidenziaNocive}` piana.
  Ne compare una sola. L'automatismo segnala, non riscrive: la valutazione resta al redattore.

## §4 Caratterizzazione
`{#caratteristiche}` … `{/caratteristiche}` con
`{pos}` `{descrizione}` `{costruttore}` `{modello}` `{capacita}` `{pressione}`
`{temperatura}` `{categoria}` `{anno}` `{nFabbrica}`

`{modello}` arriva già etichettato («Modello: CSD 90 SFC»): nella cella il costruttore sta
sulla prima riga e il modello sulla seconda, e senza etichetta le due si leggerebbero come
un'unica denominazione. L'etichetta la mette il motore e non il template perché di
un'attrezzatura senza modello a catalogo la riga sparisce del tutto. Vale anche per §5.2,
non per le apparecchiature connesse di §6.

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
