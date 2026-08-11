# Stato colorato dei documenti DM329 e riordino dei pulsanti

Data: 2026-08-11
Stato: approvato (design)

## Obiettivo

Oggi in "Scheda dati" i pulsanti VISUALIZZA DATI CIVA, GENERA RELAZIONE, GENERA DICHIARAZIONI hanno
sempre lo stesso aspetto, generato o no: chi riapre una pratica non sa a colpo d'occhio se la
documentazione DM329 è già pronta. Il fascicolo per apparecchiatura, che pure esiste da apparecchiatura
ad apparecchiatura, non ha alcun segnale nella tabella che dica quali codici lo richiedono.

L'obiettivo è dare un colore allo stato — verde quando un documento è già stato prodotto e salvato —
e organizzare i pulsanti in modo che l'aggiunta non affolli la barra. È stato esplorato anche lo
spostamento dei tre pulsanti sul dettaglio pratica: **scartato**, vedi «Alternative scartate».

## Cosa NON cambia

- I pulsanti del dettaglio pratica (SCHEDA DATI, SEGNA URGENTE, BLOCCA, ATTRIBUISCI, NASCONDI,
  ELIMINA) restano dove sono oggi, con lo stesso ordine.
- I pulsanti della scheda dati (Salva bozza, Assegna scheda, Visualizza dati CIVA, Genera relazione,
  Genera dichiarazioni) restano nell'intestazione della scheda dati, stesso ordine di oggi.

## Cosa cambia

### 1. "Scheda dati" e stato di compilazione — gruppo unito

Nel dettaglio pratica, il pulsante "Scheda dati" e l'indicatore di stato (`SchedaStatoToggle`,
oggi due elementi separati e slegati) si fondono in un **gruppo con bordo condiviso** (stile
`ButtonGroup`): un'unica sagoma con due zone cliccabili distinte, separate da una linea sottile
interna — a sinistra il pulsante che naviga alla scheda, a destra il segno di stato che apre lo
stesso menu di oggi (forza/ripristina lo stato di compilazione). Nessun cambiamento di
comportamento, solo di cornice: due componenti React distinti, un solo contenitore visivo.

### 2. Genera relazione / Genera dichiarazioni — colore di stato

I due pulsanti diventano **verdi (`filled`, `color="success"`)** quando il documento corrispondente
esiste già, salvato, per quella pratica; restano nell'aspetto di oggi (`outlined`, `color="primary"`)
quando non è stato ancora generato. Un pulsante verde scarica/apre subito la versione salvata; la
rigenerazione resta disponibile (icona `↻` accanto, non sostituisce il pulsante principale) — non si
perde mai la scorciatoia "un clic = ultima versione pronta".

**Dichiarazioni** ha già la persistenza necessaria: `dichiarazioni_documenti` (tipo `'finale'`),
costruita nel worktree `dichiarazioni-dm329` (non ancora unito a `main`). Il pulsante legge
l'esistenza di quella riga per `request_id`.

**Relazione** non ha oggi alcuna persistenza: si genera lato client e si scarica al volo, senza mai
toccare il server. Per renderla verde va aggiunta, replicando **esattamente** lo schema già usato dal
fascicolo apparecchiatura (vedi `[[fascicolo-apparecchiatura-stato]]` in memoria):

| Elemento | Fascicolo (esistente) | Relazione (da aggiungere) |
|---|---|---|
| Tabella indice | `fascicolo_documenti` (per apparecchiatura, colonna `codice`) | `relazione_documenti` (per pratica intera, senza `codice`: un solo file) |
| Riga di scadenza | `fascicolo_scadenze` (chiave `request_id, codice`) | `relazione_scadenze` (chiave `request_id`) |
| Bucket privato | `fascicoli` | `relazioni` |
| Percorso storage | `{request_id}/{codice}/{timestamp}_{nome}` | `{request_id}/{timestamp}_{nome}` |
| Funzione di accesso | `can_access_fascicolo(request_id)` | la stessa, riusata — non duplicata |
| Regola di scadenza | `src/services/fascicolo/scadenza.ts` (30gg dopo `7-CHIUSA`/`ARCHIVIATA NON FINITA`, 180gg senza movimento, preavviso 7gg) | la stessa regola, stessi numeri — modulo puro condiviso o gemello nella stessa cartella `relazione/` |
| Edge Function notturna | `pulisci-fascicoli-scaduti` (cron 03:00) | `pulisci-relazioni-scadute` (stesso schema `x-cron-key`/`CRON_SECRET`, orario cron distinto es. 03:05, per non accavallare le due passate) |
| Preavviso | Notifica in-app `admin` + `userdm329` | Stessa tabella `notifications`, `type` dedicato |

Alla generazione: si scarica subito il file (comportamento invariato) e **poi** lo si carica sul
bucket, sovrascrivendo l'eventuale relazione precedente salvata — stesso ordine "genera e mostra
prima, salva dopo" già scelto per il fascicolo, per non lasciare mai la pratica senza una relazione
salvata in caso di errore a metà.

### 3. Pillole fascicolo per apparecchiatura

Sopra la tabella "Apparecchiature", nella barra che oggi ospita "Riconosci automaticamente" e "Nuova
apparecchiatura", compare una pillola per ogni codice apparecchiatura che:

1. ha un esito che comporta adempimento — `comportaAdempimento(esito)` di `dm329Classification.ts`
   restituisce `DICHIARAZIONE` o `VERIFICA` (stesso predicato già usato da relazione e CIVA, **riusato
   identico**, non ricalcolato altrove);
2. **e** non è marcata `gia_denunciato` sulla riga dell'apparecchiatura.

La pillola è azzurra/outline (fascicolo da produrre) o verde piena (`fasc.tipo === 'fascicolo'` già
presente in `fascicolo_documenti` per quel `request_id`+`codice`). Il clic apre lo stesso popup di
dettaglio fascicolo che oggi vive nel drawer della riga in tabella (`EquipmentDetailDialog` →
`FascicoloSection`), qui raggiungibile anche da questa scorciatoia in alto.

**Spazio in barra:** per non affollarla, "Riconosci automaticamente" e "Nuova apparecchiatura" si
riducono allo stesso trattamento icona-con-etichetta-a-comparsa già usato da `AzioneIcona` altrove
(oggi sono un outlined e un contained a testo pieno). Ordine da sinistra a destra: contatore
completezza → pillole fascicolo → i due comandi di riga, così i due gruppi restano leggibili anche
compattati.

### 4. "Scarica documentazione completa"

Sesto pulsante nell'intestazione della scheda dati, a destra di "Genera dichiarazioni". Semitrasparente
e non cliccabile finché non sono pronti **tutti** i seguenti:

- relazione salvata (`relazione_documenti` per la pratica);
- dichiarazioni salvate (`dichiarazioni_documenti` tipo `'finale'` per la pratica);
- un fascicolo per **ciascun** codice che soddisfa i due criteri del punto 3 (nessuno esentato per
  strada: se un codice compare come pillola azzurra, il pulsante resta disabilitato).

Sotto il pulsante, un testo minore elenca cosa manca ("Mancano: dichiarazioni, fascicoli di S1,
C2.1"), aggiornato via via che i documenti vengono prodotti. Quando tutto è pronto il pulsante
diventa verde pieno e il clic scarica in un unico pacchetto Relazione + Dichiarazioni + tutti i
fascicoli (nome file sullo schema di `nomeFileRelazione`/`practiceCode.ts`, coerente con gli altri
due documenti).

## Alternative scartate

**Spostare CIVA/Relazione/Dichiarazioni sul dettaglio pratica.** Prima ipotesi esplorata con tre
mockup (barra unica raggruppata, primarie+menu "Altre azioni", sezione documenti separata): in tutti
e tre i casi il dettaglio pratica avrebbe accumulato pulsanti che oggi non gli appartengono, senza un
guadagno chiaro rispetto a lasciarli nella scheda dati — dove il colore di stato basta a farli notare
senza cambiare pagina. Scartata dall'utente dopo aver visto i mockup.

## Dipendenze da chiarire prima dell'implementazione

- **`dichiarazioni-dm329` non è ancora unito a `main`.** Il colore verde di "Genera dichiarazioni" e
  il conteggio di "Scarica documentazione completa" presuppongono che `dichiarazioni_documenti`
  esista in produzione. Se il merge non è già avvenuto quando si esegue il piano, va deciso l'ordine:
  prima merge/pubblicazione di quel lavoro, poi questo — non il contrario.
- La cancellazione automatica della relazione ricalca quella del fascicolo/dichiarazioni: stesso
  effetto collaterale, cioè che un utente può trovare "Genera relazione" tornato blu (non più verde)
  su una pratica vecchia, senza che nessuno l'abbia toccata. È lo stesso comportamento già accettato
  per fascicolo e dichiarazioni, non una novità introdotta qui.

## Fuori scope

- Non si tocca il flusso di generazione di relazione/dichiarazioni/fascicolo in sé, solo dove/come si
  vede il loro stato.
- Non si introduce un vero file .zip lato server per "Scarica documentazione completa": l'esatto
  meccanismo di impacchettamento (zip client-side con una libreria già in progetto, o tre download
  sequenziali) è una decisione di implementazione, non di design — la si prende in fase di piano.
