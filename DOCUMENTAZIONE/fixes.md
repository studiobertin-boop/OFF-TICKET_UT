# ISTRUZIONI
DOPO CHE HAI APPLICATO IL FIX E LO ABBIAMO BATTEZZATO COME RISOLTO E MANDATO IN PRODUZIONE ELIMINALO DA QUESTO FILE ED AGGIORNA LA TABELLA CHE TROVI ALLA FINE DI QUESTO FILE. MAX 2 RIGHE DI DESCRIZIONE.

# ELENCO FIXES DA APPLICARE

_Nessun fix in attesa._

** ELENCO FIXES APPLICATI **

| DATA | DESCRIZIONE |
| --- | --- |
| 2026-08-16 | Scheda dati: dopo il riconoscimento da targhetta i dati vengono ricondotti al catalogo — apparecchiatura trovata con certezza, popup di scelta fra i candidati col confronto dei valori, oppure compilazione dai dati letti. Prima ogni apparecchiatura risultava nuova: la ricerca fuzzy nel database era rotta da sempre e falliva in silenzio. |
| 2026-08-10 | Scheda dati: la scelta su un valore scostato dal catalogo (solo per questa volta / aggiorna / default) si chiede una volta sola. Prima tornava passando all'apparecchiatura successiva, perché confermare non toglieva lo scostamento. |
| 2026-08-10 | Scheda dati: il diametro delle valvole di sicurezza non entra più nel contatore di completezza, essendo opzionale. Resta pieno a catalogo, dove distingue le varianti della stessa valvola. |
| 2026-08-10 | Form genera relazione: lo schema d'impianto si può trascinare sull'area del §2.3, oltre che sceglierlo da file. Stessi controlli di formato e dimensione del pulsante. |
| 2026-08-11 | Scheda dati: la domanda sul valore scostato dal catalogo arriva appena si finisce di scrivere quel campo — anche fra due colonne della stessa riga — e ora compare anche dalla finestra dei dettagli, dove prima non si vedeva mai. |
| 2026-08-11 | Scheda dati: svuotare un campo numerico lo lascia vuoto. Cancellando l'ultima cifra tornava il valore di partenza, e per cambiarlo bisognava digitare il nuovo prima di togliere il vecchio. |
| 2026-08-11 | Scheda dati: passando all'apparecchiatura successiva la finestra dei dettagli mostra la sua, non quella lasciata. I campi restavano precompilati e alla prima modifica quei dati ci finivano davvero; anche i contatori seguono la riga giusta. |
| 2026-08-11 | Elenco pratiche DM329: nuova icona di compilazione della scheda dati (vuota, percentuale a due cifre, completa), ordinabile e filtrabile. Lo stato si può imporre a mano dal dettaglio pratica, accanto al pulsante «Scheda dati», e riportare all'automatico. |
| 2026-08-12 | Relazione/dichiarazioni: generavano dai dati letti al caricamento della pagina, non da quelli appena salvati — una modifica alla scheda non compariva nel documento senza prima ricaricare la pagina. |
| 2026-08-12 | Genera relazione: pulsante verde "scarica" e icona "rigenera" (poco visibile) uniti in un solo pulsante con menu Scarica / Rigenera. |
| 2026-08-13 | Dichiarazioni: la dichiarazione su carta intestata non elenca più gli apparecchi marcati «già denunciato». Riguarda ciò che si sta denunciando adesso, non ciò che INAIL ha già a matricola. |
| 2026-08-13 | Catalogo e scheda dati: sulle valvole di sicurezza il diametro distingue le varianti insieme alla Ptar. Si sceglie da elenco e la scelta autocompila i dati della variante; le grafie a catalogo («3/8», «3/8''») sono state normalizzate. |
| 2026-08-13 | Scheda dati: il riconoscimento automatico legge anche i PDF (certificati, fascicoli di più pagine). Prima la rotellina girava e non succedeva niente, perché la risposta del modello non era leggibile; ora l'eventuale errore si vede anche in pagina. |
| 2026-08-13 | Scheda dati: i collegamenti fra apparecchiature seguono l'albero — un solo gancio per riga, nessun montante che scende senza essere ripreso, e il ramo verso le collegate parte dalla riga che le porta. |
| 2026-08-13 | Dettaglio pratica: sotto lo stepper un nastro mostra i periodi in cui la pratica è rimasta ferma (ambra, a righe se il blocco è ancora aperto) e il momento in cui è ripartita (verde), con motivi e date al passaggio del mouse. Finisce sotto il pallino dello stato raggiunto. |
| 2026-08-13 | Fatturazione: nuovo campo «X Fattura» (1-10, solo admin) nel box Proprietà delle pratiche DM329 e delle richieste generali. Il report di fatturazione elenca le sole pratiche ancora da fatturare, ordinate per tipo (non-DM329, DM329-OFF, DM329-CAC), con export Excel e Word. |
| 2026-08-13 | Scheda dati: si salva da sola pochi secondi dopo l'ultima modifica, e subito se si lascia la pagina prima — il pulsante «Salva bozza» non c'è più e non si perde nulla. Scelti marca e modello con una sola variante a catalogo, PS e capacità si compilano da sé. |
| 2026-08-14 | Dettaglio pratica: fascicoli, relazione, dichiarazioni e documentazione completa diventano quattro pillole accanto a quella della compilazione, nella barra del titolo che resta agganciata allo scorrimento. Prima stavano nell'intestazione della tabella e sparivano appena si scendeva a compilare. |
| 2026-08-14 | Dettaglio pratica: i documenti salvati si scaricano da un collegamento firmato. Il .docx della relazione restava fermo sulla «Verifica della sicurezza» del browser e non arrivava mai; i download della documentazione completa partono distanziati. |
| 2026-08-14 | Genera relazione: la finestra dei dati occupa poco più di metà spazio di prima, senza togliere un campo. Le select che raccolgono una sigla o due non prendono più una riga intera, la prosa procedurale sta dietro una ⓘ e le segnalazioni del preflight prendono una riga ciascuna, col totale in fondo accanto al pulsante. |
| 2026-08-14 | Codice pratica: il motivo della revisione si scrive qui, sotto progressivo e anno, invece che nel form «Dati per la relazione tecnica» — è un dato della pratica, non della scheda. Si propone da sé finché non lo si scrive a mano, resta leggibile nella finestra Dati relazione, e se manca su una revisione il preflight lo segnala. |
| 2026-08-15 | Genera relazione: lo schema d'impianto non va più disegnato in AutoCAD e caricato come immagine. Si genera da ciò che è già in scheda — apparecchiature, collegamenti, disoleatori, raccolta condense, ubicazione dei serbatoi — e si rifinisce in un editor dentro l'applicazione; il caricamento del disegno resta per i casi che il generatore non copre. |
| 2026-08-15 | Schema d'impianto: nell'editor le apparecchiature si spostano agganciandosi a una griglia, si allineano e si distribuiscono, i tratti delle tubazioni si trascinano dove servono e si possono aggiungere scritte libere sul disegno. Ctrl+Z annulla l'ultima modifica, il tasto Canc toglie ciò che è selezionato. |
| 2026-08-15 | Schema d'impianto: valvole e riduttori si mettono sulla tubazione selezionata con «+ Valvola» e «+ Riduttore»; un TEE trascinato sopra un tubo lo spezza in due tratti che gli si innestano. |
| 2026-08-15 | Schema d'impianto: la finestra dell'editor si ridimensiona e va a tutto schermo, col divisorio trascinabile fra la tela e l'anteprima del documento. La misura scelta si ritrova alla riapertura, su quel computer. La tela è un foglio bianco, come il documento che verrà consegnato. |
| 2026-08-16 | Schema d'impianto: il muro fra sala compressori e linea di distribuzione non si disegna più da sé, e le pratiche salvate prima si riaprono senza. Si aggiunge col pulsante «Muro», si trascina in orizzontale e si toglie col Canc; l'altezza continua ad adattarsi da sé al disegno. |
| 2026-08-16 | Schema d'impianto: la linea si interrompe dentro le valvole e i riduttori, invece di attraversarli. |
| 2026-08-16 | Schema d'impianto: il tasto Canc cancella anche le scritte libere, che prima si potevano togliere solo aprendo il loro dialogo con un doppio clic. |
