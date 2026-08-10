# Composizione fascicolo apparecchiatura

Data: 2026-08-10
Stato: approvato (design)

## Obiettivo

Il corredo documentale di un'apparecchiatura — certificati CE, manuali d'uso, foto delle targhette —
arriva sparso su più file, PDF e immagini. Oggi il fascicolo si ricompone a mano: si aprono i
documenti uno per uno, si incollano nell'ordine prescritto, si ridimensiona quel che sta storto e si
controlla il peso. L'ordine però è sempre lo stesso ed è verificabile.

Il tecnico deve poter trascinare i documenti nella finestra dell'apparecchiatura e ottenere un unico
PDF A4, ordinato, sotto i 4,95 MB, con un nome che segue la codifica delle pratiche.

## Ordine del fascicolo

Rispetto all'apparecchiatura di cui si è aperta la finestra:

| # | Ruolo |
|---|---|
| 1 | Certificato CE dell'apparecchiatura |
| 2 | Istruzioni d'uso e manutenzione dell'apparecchiatura |
| 3 | Certificato CE della valvola di sicurezza |
| 4 | Istruzioni d'uso e manutenzione della valvola di sicurezza |
| 5 | Foto della targhetta dell'apparecchiatura |
| 6 | Certificato CE dell'apparecchiatura principale |
| 7 | Foto della targhetta dell'apparecchiatura principale |

Esempio, fascicolo di un disoleatore: certificato del disoleatore, istruzioni del disoleatore,
certificato della valvola, istruzioni della valvola, foto della targhetta del disoleatore,
certificato del compressore che lo contiene, foto della targhetta del compressore.

**Non tutti i documenti ci sono sempre.** I ruoli mancanti si saltano senza lasciare posto vuoto: il
fascicolo si compone con quello che c'è, nell'ordine indicato.

Con più valvole (`valvole_aggiuntive`) i posti 3 e 4 si ripetono per ciascuna, in ordine di codice.

L'apparecchiatura principale è già nel modello dati (`equipmentConfig.ts`, campo `childKind`):
disoleatore → compressore, scambiatore → essiccatore, recipiente filtro → filtro. Serbatoi,
compressori, essiccatori, filtri e separatori non ne hanno: per loro i posti 6 e 7 restano vuoti.

Le valvole non hanno un fascicolo proprio — il loro certificato entra in quello del recipiente che
le porta — quindi nella loro finestra la sezione non compare.

## Decisioni

| Aspetto | Scelta | Perché |
|---|---|---|
| Persistenza | Nessuna: i file vivono nella sessione di pagina | Il fascicolo è un prodotto da consegnare, non un archivio da tenere. Niente Storage, niente migrations, niente RLS da mantenere. |
| Ambito del caricamento | In **una** finestra si trascinano **tutti** i documenti, anche quelli delle valvole e dell'apparecchiatura principale | Conseguenza della scelta precedente: senza persistenza non si possono pescare i documenti caricati altrove. |
| Riconoscimento | AI su Anthropic, con revisione umana | Un fascicolo è un atto: la classificazione automatica si mostra e si corregge prima di generare, non dopo. |
| File misti (certificato + istruzioni) | Inseriti una volta soli, alla posizione del primo ruolo che coprono | L'ordine finale resta quello richiesto senza duplicare pagine. Individuare il punto di taglio fra certificato e istruzioni sarebbe la parte più fragile dell'intera funzione. |
| Formato | Tutto A4 verticale; ogni pagina o immagine più larga che alta viene ruotata di 90° | Richiesta esplicita: massimo sfruttamento del foglio. |
| Peso | Limite 4,95 MB; si comprimono prima le foto, poi se serve anche certificati e manuali | Le foto sono la parte pesante e quella che tollera meglio il degrado; il testo dei certificati si tocca solo per necessità. |
| Destinazione | Solo download | |

## Nome del file

`CODICE PRATICA PRIMA PARTE`-`CODICE APPARECCHIATURA`_CERTIFICATI_MANUALI_FOTO_`CODICE PRATICA SECONDA PARTE`

Esempio: pratica `602A_01-2026`, apparecchiatura `E1` → `602A-E1_CERTIFICATI_MANUALI_FOTO_01-2026.pdf`

È lo stesso schema di `nomeFileRelazione` in `src/utils/practiceCode.ts`, che spezza già il codice
pratica sull'underscore. Come la relazione, le pratiche senza codice — dati vecchi — ripiegano su un
nome basato sulla ragione sociale, per non produrre file chiamati tutti `-E1_CERTIFICATI_....pdf`.

## Architettura

Quattro unità, di cui tre pure e verificabili senza browser.

### Estrazione delle prove — `src/services/fascicolo/estrazione.ts`

Da ogni file ricava il minimo che serve a riconoscerlo, non il file intero:

- **PDF**: testo delle prime pagine col text layer di `pdfjs-dist` (worker già configurato in
  `src/utils/pdfToImage.ts`), più il numero di pagine. Se il testo è vuoto — scansione — si
  rasterizza la prima pagina riusando `convertPDFPageToImage`.
- **Immagini**: una miniatura, non l'originale a piena risoluzione.

### Classificazione — `src/services/fascicolo/classifica.ts` + Edge Function

Nuova Edge Function `classifica-documenti-fascicolo`, modellata su `analyze-equipment-nameplate` per
CORS, gestione errori e forma della risposta, ma rivolta all'**API Anthropic** con il secret
`ANTHROPIC_API_KEY`. Modello di partenza: Haiku 4.5 — una classificazione a sette categorie non
chiede di più.

Oltre alle prove le si passa il **contesto della scheda**: marca, modello, anno e numero di fabbrica
dell'apparecchiatura, delle sue valvole e dell'apparecchiatura principale. È ciò che distingue il
certificato del serbatoio da quello della sua valvola quando entrambi dicono «dichiarazione di
conformità CE»: i dati di targa combaciano con uno solo dei due.

Risposta per file: ruoli coperti (possono essere due, per i file misti), confidenza, e una riga di
motivazione da mostrare in interfaccia.

**Fallback senza AI.** Se la chiamata fallisce o il credito è esaurito, si classifica da nome file e
parole chiave (`dichiarazione`/`conformit`/`CE`, `manuale`/`istruzioni`/`uso e manutenzione`,
`targhet`/`foto`), segnalando che è una supposizione. La funzione resta usabile: si corregge a mano e
si genera lo stesso.

### Ordinamento — `src/services/fascicolo/ordina.ts`

Funzione pura: da documenti classificati alla sequenza finale. Salta i ruoli mancanti, colloca il
file misto una volta sola al primo posto che gli compete, ripete i posti 3-4 per ogni valvola,
esclude i non riconosciuti. È il cuore della regola, e la parte che i test devono coprire.

### Composizione e compressione — `src/services/fascicolo/componiPdf.ts`

Serve `pdf-lib`, nuova dipendenza: `jspdf`, già in progetto, non sa unire PDF esistenti
conservandone il testo, e rasterizzare tutto darebbe file enormi e sfocati.

Ogni pagina sorgente viene incorporata (`embedPage` per i PDF, `embedJpg`/`embedPng` per le
immagini) e disegnata dentro una pagina A4 nuova, scalata per riempirla; se è più larga che alta,
ruotata di 90°. Le pagine PDF vettoriali restano vettoriali: nitide e leggere.

La compressione è iterativa e si ferma appena si scende sotto 4,95 MB:

1. Solo foto e immagini: 150 → 120 → 100 dpi, qualità JPEG a scendere.
2. Anche le pagine dei certificati e dei manuali, rasterizzate e ricompresse, dalle più pesanti.
3. Degrado progressivo finché il file rientra, con avviso su quali documenti hanno perso di più.

## Interfaccia

`FascicoloSection`, nel piede della finestra dei dettagli dell'apparecchiatura
(`EquipmentDetailDialog`), sotto i campi:

- area di trascinamento con selezione file alternativa (`image/*`, `.pdf`), sul modello di
  `PhotoUploadSection`;
- elenco dei file caricati: nome, peso, e il ruolo assegnato come menu correggibile. I file non
  riconosciuti sono evidenziati e restano fuori dal fascicolo finché non si assegna loro un ruolo;
- pulsante **Genera fascicolo**, con lo stato di avanzamento (analisi → composizione →
  compressione) e gli avvisi finali su peso e documenti mancanti.

**Stato**: sollevato in `UnifiedEquipmentTable` e indicizzato per codice riga, così i file
sopravvivono alla chiusura della finestra e alla navigazione fra apparecchiature. Si perdono al
ricaricamento della pagina — conseguenza voluta della scelta «solo in memoria» — e la sezione lo
dichiara.

**Dati da far scendere**: `DettaglioRiga` prende un campo `fascicolo` con codice pratica e contesto
dell'apparecchiatura. Il contesto si costruisce in `UnifiedEquipmentTable`, dove i legami
padre-figlio sono già risolti. Il codice pratica non arriva ancora al form: va passato da
`TechnicalDetails`, che lo calcola già con `codiceForRequest`, attraverso `TechnicalSheetForm` fino
alla tabella.

## Fuori scope

- Archiviazione dei documenti sorgente e rigenerazione del fascicolo a distanza di tempo.
- Split per pagine dei file che contengono più documenti.
- Fascicolo di più apparecchiature in un colpo solo, o dell'intera pratica.
- Migrazione dell'OCR targhette da OpenAI ad Anthropic: `analyze-equipment-nameplate` resta com'è.

## Prerequisiti operativi

- Credito Anthropic su `console.anthropic.com` e secret `ANTHROPIC_API_KEY` sul progetto Supabase
  (oggi sono configurati solo `OPENAI_API_KEY` e `RESEND_API_KEY`).
- Deploy della Edge Function via CLI Supabase o Management API.
