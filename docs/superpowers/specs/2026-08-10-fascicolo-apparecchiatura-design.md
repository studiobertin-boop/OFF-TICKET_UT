# Composizione fascicolo apparecchiatura

Data: 2026-08-10
Stato: approvato (design)
Rettificato il 2026-08-11: i documenti si conservano. Vedi «Persistenza e ciclo di vita».

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
| Persistenza | I file di partenza e il fascicolo generato restano salvati e agganciati all'apparecchiatura, con scadenza automatica | Chi riapre la pratica ritrova il corredo invece di ricostruirlo. La scadenza tiene il conto: vedi «Persistenza e ciclo di vita». |
| Ambito del caricamento | In **una** finestra si trascinano **tutti** i documenti, anche quelli delle valvole e dell'apparecchiatura principale | Il fascicolo è dell'apparecchiatura, e il certificato di una valvola non ha vita propria: si carica dove verrà usato. Resta una scelta anche ora che i documenti sono salvati e in teoria pescabili altrove. |
| Riconoscimento | AI su Anthropic, con revisione umana | Un fascicolo è un atto: la classificazione automatica si mostra e si corregge prima di generare, non dopo. |
| File misti (certificato + istruzioni) | Inseriti una volta soli, alla posizione del primo ruolo che coprono | L'ordine finale resta quello richiesto senza duplicare pagine. Individuare il punto di taglio fra certificato e istruzioni sarebbe la parte più fragile dell'intera funzione. |
| Formato | Tutto A4 verticale; ogni pagina o immagine più larga che alta viene ruotata di 90° | Richiesta esplicita: massimo sfruttamento del foglio. |
| Peso | Limite 4,95 MB; si comprimono prima le foto, poi se serve anche certificati e manuali | Le foto sono la parte pesante e quella che tollera meglio il degrado; il testo dei certificati si tocca solo per necessità. |
| Destinazione | Scaricato al momento della generazione e conservato accanto ai sorgenti | Il download resta il gesto principale; la copia salvata serve a chi riapre la pratica e non ha più il file sul proprio computer. |

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
sopravvivono alla chiusura della finestra e alla navigazione fra apparecchiature. Dall'11-08-2026
sopravvivono anche al ricaricamento della pagina: l'elenco arriva dal database e lo stato locale
serve solo a ciò che è in corso. Vedi «Persistenza e ciclo di vita».

**Dati da far scendere**: `DettaglioRiga` prende un campo `fascicolo` con codice pratica e contesto
dell'apparecchiatura. Il contesto si costruisce in `UnifiedEquipmentTable`, dove i legami
padre-figlio sono già risolti. Il codice pratica non arriva ancora al form: va passato da
`TechnicalDetails`, che lo calcola già con `codiceForRequest`, attraverso `TechnicalSheetForm` fino
alla tabella.

## Persistenza e ciclo di vita

Aggiunta dell'11-08-2026, che rovescia la scelta originaria «nessuna persistenza».

I documenti caricati e il fascicolo generato restano salvati e agganciati alla singola
apparecchiatura. Non per sempre: un archivio che cresce e non si svuota diventa un costo e un
rischio, quindi ogni fascicolo ha una data di scadenza calcolata dallo stato della pratica.

### Dove vivono

**Bucket `fascicoli`**, privato, distinto da `attachments`. I due hanno regole di visibilità
diverse — la scheda tecnica conosce `userdm329` e la condivisione, gli allegati di pratica no — e
tenerli separati evita policy di Storage che devono dedurre i permessi dal prefisso del percorso.
Percorso dell'oggetto: `{request_id}/{codice}/{timestamp}_{nome}`.

**`fascicolo_documenti`** — una riga per file, sorgenti e fascicolo generato insieme:

| Colonna | Note |
|---|---|
| `request_id` | FK a `requests`, `on delete cascade` |
| `codice` | codice dell'apparecchiatura (`C1.1`): è il legame, vedi sotto |
| `tipo` | `sorgente` \| `fascicolo` |
| `ruoli text[]`, `valvola` | esito della classificazione; array vuoto = non riconosciuto |
| `confidenza`, `motivazione`, `origine` | ciò che `DocumentoFascicolo` teneva in memoria |
| `file_name`, `file_path`, `file_size`, `mime_type` | |
| `uploaded_by`, `created_at` | |

È `DocumentoFascicolo` meno il `File`, più il percorso nello Storage. Indice su
`(request_id, codice)`.

**`fascicolo_scadenze`** — chiave `(request_id, codice)`, `request_id` con FK a `requests` e
`on delete cascade` come sopra, più `purgato_il` e `n_file`. È la riga
unica «fascicolo scaduto il …» che resta dopo la cancellazione: una per apparecchiatura, non una
per file. Si elimina al primo nuovo caricamento, così la nota sparisce quando smette di essere
vera.

### Il legame con l'apparecchiatura

Le apparecchiature non hanno identità nel database: vivono dentro
`dm329_technical_data.equipment_data` e si identificano col solo codice. Il codice **non** si
rinumera — `normalizeSchedaCodes` non lo ricava mai dall'indice, ed eliminando `S2` da
`S1`/`S2`/`S3` l'ex `S3` resta `S3` — ma il numero liberato **si riassegna**: un serbatoio nuovo
torna a chiamarsi `S2` ed erediterebbe ciò che era agganciato al vecchio. È lo stesso rischio già
annotato in `pruneAdditionalInfo`.

Il legame resta quindi il codice, difeso in due punti:

1. **Alla fonte.** Eliminare una riga della scheda cancella subito i suoi documenti, dove
   `UnifiedEquipmentTable` chiama già `pruneSchedaRefs`. Un codice riassegnato nasce pulito.
2. **Come rete.** La passata giornaliera rimuove i documenti il cui codice non esiste più nella
   scheda, per ciò che sfugge all'interfaccia: import Excel, retro-coding, modifiche fatte da
   un'altra sessione.

Il prezzo, accettato: eliminare una riga per sbaglio butta anche i suoi documenti. L'alternativa —
dare un'identità stabile a ogni riga di `equipment_data` — costerebbe una migrazione delle schede
esistenti e toccherebbe normalizzazione dei codici, importazione Excel e retro-coding: lavoro
tutto fuori dal fascicolo.

### Quando scadono

```
cancellazione = min(
  stato ∈ {7-CHIUSA, ARCHIVIATA NON FINITA} ? ultimo_cambio_stato + 30 giorni : ∞,
  max(ultimo_cambio_stato, updated_at) + 180 giorni
)
```

`ultimo_cambio_stato` viene da `request_history`, alimentata dal trigger
`after_request_insert_create_history`; per le pratiche senza righe di storia si ripiega su
`created_at`. Quando lo stato attuale è chiuso o archiviato l'ultimo cambio è per definizione il
passaggio in quello stato: i 30 giorni si contano da lì. Il `min` è ciò che rende i 180 giorni un
tetto vero: una pratica chiusa scade a 30 giorni anche se la si continua a ritoccare.

Gli stati che avviano il conto dei 30 giorni sono solo quelli del vocabolario DM329. `COMPLETATA`
resta fuori: al 2026-08-11 nessuna delle 39 pratiche che lo portano ha una scheda tecnica, quindi
non può ospitare un fascicolo.

Attenzione alla stringa esatta: `ARCHIVIATA NON FINITA` ha spazi, non trattini bassi.

La regola sta in `src/services/fascicolo/scadenza.ts`, funzione pura, e serve due padroni:
l'interfaccia che mostra la data e la Edge Function che cancella. Il progetto non condivide oggi
codice fra `src/` e `supabase/functions/`: il modulo nasce senza dipendenze e la Edge Function lo
importa per percorso relativo. Se il deploy non lo digerisce, si copia in
`supabase/functions/_shared/` con un test che verifica che le due copie coincidano.

### La passata giornaliera

`pg_cron` — non installato, ma disponibile in versione 1.6.4 — chiama ogni giorno via `pg_net` la
Edge Function `pulisci-fascicoli-scaduti`, che con la service role fa tre cose:

1. **Preavvisa** a 7 giorni dalla scadenza, con una notifica in-app di tipo
   `fascicolo_in_scadenza` al tecnico assegnato e agli admin, nella tabella `notifications` già
   esistente. La ripetizione si evita cercando se una notifica dello stesso tipo per quella
   pratica esiste già negli ultimi 7 giorni.
2. **Cancella** ciò che è scaduto: prima gli oggetti dallo Storage tramite l'API — non le righe di
   `storage.objects`, che lascerebbero i byte nel backend —, poi le righe di
   `fascicolo_documenti`, poi scrive `fascicolo_scadenze`. Si cancella tutto: sorgenti e fascicolo
   generato.
3. **Rimuove gli orfani**, i documenti il cui codice non è più nella scheda.

Tutto resta dentro Supabase: nessun servizio nuovo da ospitare, nessun segreto in un terzo posto,
e lo storico dei run è interrogabile in SQL.

### Permessi

Le policy di `fascicolo_documenti` e `fascicolo_scadenze` ricalcano quelle di
`dm329_technical_data`: in lettura il predicato della sua `SELECT` — admin, `userdm329`, tecnico
assegnato, accesso condiviso — e in scrittura quello della sua `UPDATE`. Chi vede la scheda vede il
fascicolo; chi può modificarla può gestirne i file.

Le policy di Storage sul bucket hanno bisogno di un aiuto, perché il `request_id` è il primo
segmento del percorso: una funzione `can_access_fascicolo(request_id uuid)` condivisa fra le tre
policy di Storage e le due tabelle, invece del predicato ripetuto in cinque posti.

### Tetto di peso

50 MB di documenti per apparecchiatura, verificati prima del caricamento. Sette documenti fra
certificati, manuali e foto ci stanno ampiamente: il limite scatta dove il tecnico sta lavorando,
quindi il messaggio è chiaro e non dipende da cosa hanno caricato le altre apparecchiature della
stessa pratica.

### Conseguenze sull'interfaccia

`DocumentoFascicolo` porta oggi un `File` vivo. Col salvataggio il documento arriva dal database e
il `File` c'è solo per ciò che si è appena trascinato: il tipo prende `filePath` e la sorgente si
risolve con un `apriDocumento(doc)` che restituisce il file in memoria o scarica il blob.
`componiPdf` non cambia, continua a ricevere byte. Il ciclo di un caricamento diventa: carica nello
Storage, inserisci la riga, classifica, aggiorna i ruoli — con TanStack Query, come il resto del
progetto.

**Si classificano solo i file nuovi.** Oggi ogni aggiunta fa rianalizzare l'insieme, perché il
riconoscimento è comparativo. Con i documenti salvati questo diventa dannoso: cancellerebbe le
correzioni manuali già registrate, oltre a dover riscaricare tutto e ripagare l'analisi. Ai file
nuovi si passa come contesto i ruoli già coperti dai documenti salvati e i loro nomi: il confronto
resta dove serve, e ciò che il tecnico ha corretto a mano non si tocca più.

La sezione perde la riga «I file restano solo per questa sessione» e guadagna la data di
cancellazione prevista, che si fa insistente sotto i 7 giorni; il fascicolo generato come voce
propria, scaricabile; il contatore dei 50 MB quando ci si avvicina; e, a file scaduti, la riga
unica «fascicolo scaduto il … — N file» con l'area di trascinamento comunque attiva. Se una pratica
chiusa torna in lavorazione, è esattamente ciò che il tecnico trova: la nota che spiega il vuoto e
il trascinamento pronto.

### Test

`scadenza.ts` è calcolo puro e va coperto come `ordina.ts`: pratica chiusa da 29, 30 e 31 giorni;
archiviata non finita; pratica viva ferma da 179, 180 e 181 giorni; chiusa e poi ritoccata, dove
vince il minimo e quindi i 30 giorni; riaperta, che torna sotto i soli 180; soglia del preavviso a
7 giorni; pratica senza righe in `request_history`, che ripiega su `created_at`.

Il resto — caricamento, cancellazione, job periodico — non è calcolo puro e si verifica in
produzione, come la Edge Function di classificazione.

## Fuori scope

- Split per pagine dei file che contengono più documenti.
- Fascicolo di più apparecchiature in un colpo solo, o dell'intera pratica.
- Migrazione dell'OCR targhette da OpenAI ad Anthropic: `analyze-equipment-nameplate` resta com'è.
- Riuso dei documenti fra apparecchiature: ora che sono salvati si potrebbe pescare il certificato
  di una valvola già caricato altrove, ma il caricamento resta per apparecchiatura.
- Identità stabile alle righe di `equipment_data`: il legame resta il codice, difeso come sopra.
- Ripristino di ciò che è scaduto: la cancellazione è definitiva, non c'è cestino.

## Prerequisiti operativi

- Credito Anthropic su `console.anthropic.com` e secret `ANTHROPIC_API_KEY` sul progetto Supabase
  (oggi sono configurati solo `OPENAI_API_KEY` e `RESEND_API_KEY`).
- Deploy delle Edge Function via CLI Supabase o Management API.
- Installazione di `pg_cron` sul progetto Supabase e configurazione del job giornaliero.
