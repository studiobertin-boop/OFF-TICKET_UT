# Tag del template Word — Relazione Tecnica DM329

Il template `.docx` è "muto": contiene **solo** i tag qui elencati. Tutte le decisioni
(alternative, singolare/plurale, calcoli) sono già risolte nel `RelazioneModel`.
I tag corrispondono all'output di `buildTemplateData(model)` in `renderRelazione.ts`.

Sintassi docxtemplater: `{campo}` sostituzione · `{#lista}…{/lista}` loop/condizione ·
i `\n` diventano a capo (opzione `linebreaks: true`).

## Copertina / intestazione
- `{premessa.ragioneSociale}`
- `{premessa.sedeLegale}` — "via n° civico, cap comune (provincia)"
- `{premessa.sitoProduttivo}`
- `{dataSopralluogo}`, `{nomeTecnico}`

## Premessa
- `{premessa.descrizioneAttivita}`, `{premessa.ubicazione}`
- Revisione (condizionale): `{#premessa.haRevisione}… {premessa.motivoRevisione} …{/premessa.haRevisione}`
- Spessimetrica (condizionale): `{#premessa.haSpessimetrica}…{/premessa.haSpessimetrica}`

## Descrizione generale
- Elenco sezioni: `{#descrizioneGenerale.sezioni}{voce}{/descrizioneGenerale.sezioni}`
- `{descrizioneGenerale.fraseArea}`
- Locale dedicato (condizionale): `{#descrizioneGenerale.haLocaleDedicato}{descrizioneGenerale.paragrafoLocaleDedicato}{/descrizioneGenerale.haLocaleDedicato}`

## Tabella caratteristiche (riga = un apparecchio)
`{#caratteristiche}` … `{/caratteristiche}` con colonne:
`{pos}` `{descrizione}` `{costruttore}` `{modello}` `{capacita}` `{pressione}` `{temperatura}` `{categoria}` `{anno}` `{nFabbrica}`

## Tabella procedura DM329
`{#procedura}` … `{/procedura}` con:
`{pos}` `{descrizione}` `{costruttore}` `{modello}` `{nFabbrica}` `{dichiarazioneMark}` `{verificaMark}`
(i `*Mark` valgono "✓" oppure "").

## Classificazione (testo già risolto, può contenere a capo/elenco)
- `{classificazione.compressori.testo}`
- `{classificazione.essiccatori.testo}`
- `{classificazione.serbatoi.testo}`

## Tabelle valvole
Portata: `{#valvole.portata}` … `{/valvole.portata}` con
`{posValvola}` `{nFabbricaValvola}` `{portataMax}` `{portataScaricata}` `{adeguatoMark}`
e connesse: `{#connesse}{pos} - {descrizione} {costruttore} {modello}{/connesse}`

Pressione: `{#valvole.pressione}` … `{/valvole.pressione}` con
`{posValvola}` `{nFabbricaValvola}` `{psRecipiente}` `{pressioneTaratura}` `{adeguatoMark}`
e connesse: `{#connesse}{pos} - {descrizione} {costruttore} {modello}{/connesse}`

## Verifiche periodiche
Tabella **statica**: va scritta direttamente nel template (nessun tag).

## Allegati
`{#allegati}{voce}{/allegati}`

## Schema impianto
Lasciare il testo letterale **SCHEMA** come segnaposto (inserimento manuale del disegno).
