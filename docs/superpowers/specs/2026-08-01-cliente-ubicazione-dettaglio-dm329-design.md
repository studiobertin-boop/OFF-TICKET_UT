# Dati cliente e ubicazione impianto nel dettaglio pratica DM329

Data: 2026-08-01
Stato: approvato, da implementare

## Obiettivo

Nella pagina di dettaglio di una pratica DM329, mostrare in modo ordinato i dati
anagrafici del cliente e l'ubicazione dell'impianto, e renderli modificabili da
lì tramite una matita, scrivendo sulla tabella `customers` per il cliente e su
`requests` per l'ubicazione.

## Stato attuale

`RequestDetail.tsx` mostra un blocco "Informazioni Cliente" in sola lettura
(Cliente, Sede Legale, Telefono, PEC, Descrizione Attività) più un campo "Sede
Impianto". `denominazione_sala` si modifica dentro la matita di "Dettagli
Richiesta". L'indirizzo impianto non è modificabile da nessuna sezione visibile
come tale, ma lo è di fatto da "Modifica codice pratica".

L'indirizzo impianto è memorizzato in tre posti:

| dove | pratiche valorizzate | consumatori |
|---|---|---|
| `requests.indirizzo_impianto` | 41 | `RelazioneDataDialog`, `CodicePraticaDialog` |
| `dm329_technical_data.indirizzo_impianto` | 15 | `technicalDataApi.updateAddress` (mai chiamato) |
| `equipment_data.dati_impianto.sede_impianto` | 8 | `RequestDetail`, `CIVAApparecchioColumn` |

Conseguenza: sia il campo "Sede Impianto" del dettaglio sia l'indirizzo stampato
sulle schede CIVA leggono la sorgente meno popolata, e restano vuoti sulla
maggior parte delle pratiche pur essendo il dato presente su `requests`.

Numeri di riferimento (produzione, 2026-08-01): 358 pratiche DM329, di cui 2
senza `customer_id`; 11.685 clienti, di cui 17 con `descrizione_attivita`
valorizzata.

## Design

### Layout

Nel dettaglio pratica DM329, al posto dell'attuale blocco "Informazioni
Cliente", due riquadri distinti, ognuno con la propria matita in alto a destra:

- **Cliente** — Identificativo · Ragione sociale | Sede legale | Telefono | PEC |
  Descrizione attività
- **Ubicazione impianto** — Indirizzo impianto | Denominazione sala

Le pratiche non-DM329 restano invariate: blocco cliente in sola lettura, senza
matita.

Due rimozioni conseguenti:

- `denominazione_sala` esce dalla matita di "Dettagli Richiesta", dove oggi si
  modifica. Averla in due form che scrivono lo stesso campo è una fonte di
  conflitti. In "Dettagli Richiesta" restano No CIVA, Off/Cac, Stato Fattura.
- Il campo "Sede Impianto" sparisce, sostituito da "Indirizzo impianto" nel
  nuovo riquadro.

### Componenti

`RequestDetail.tsx` supera già le 1000 righe: i due riquadri sono componenti a
sé in `src/components/requests/`, e la pagina si limita a montarli.

- **`CustomerInfoSection`** — vista in lettura dei campi cliente + matita.
  Riceve `info: ClientInfo` (i valori da mostrare, già risolti da `RequestDetail`
  con la catena di fallback esistente: relazione `customer` → cliente legacy →
  ricerca per nome → `custom_fields`), `customer: Customer | null` (il record
  anagrafico vero, `null` sulle pratiche importate senza cliente a DB),
  `canEdit: boolean`, `onSaved: () => void`.
  La vista in lettura si basa su `info` e funziona sempre; la matita è attiva
  solo quando `customer` non è `null`, perché senza `id` non c'è nulla da
  aggiornare.
- **`PlantLocationSection`** — vista in lettura di indirizzo impianto e
  denominazione sala + matita. Riceve `request`, `customer`, `canEdit`,
  `onSaved`.
- **`CustomerEditDialog`** — dialog di modifica anagrafica. Monta
  `CustomerFormFields` con `showAllFields={true}`, valida con
  `updateCustomerSchema`, salva con `customersApi.update(customer.id, …)`.

### Modifica dell'ubicazione: riuso di CodicePraticaDialog

La matita di "Ubicazione impianto" riapre `CodicePraticaDialog` in modalità
modifica. Non si costruisce un secondo editor: `denominazione_sala` e
`indirizzo_impianto` sono legati a `sala_lettera`, `progressivo` e `anno`, che
insieme compongono il codice pratica. Un editor che tocchi solo due dei sei
campi lascerebbe il codice pratica disallineato dalla sala.

Unico adattamento: il titolo del dialog quando viene aperto da questo punto
("Modifica ubicazione impianto" invece di "Modifica codice pratica").

### Permessi

Entrambe le matite usano la regola già in uso per il codice pratica:

```
isDM329 && !!customerRecord && (role === 'admin' || role === 'userdm329')
```

Sulle 2 pratiche senza anagrafica la matita cliente è disabilitata, con tooltip
che spiega il motivo.

### Avviso di propagazione

`CustomerEditDialog` mostra un avviso fisso: «Le modifiche valgono per tutte le
pratiche di questo cliente». Modificare l'anagrafica non è un'operazione locale
alla pratica e l'utente deve saperlo prima di salvare.

L'alert esistente «Alcuni dati anagrafici sono incompleti → Completa dati»
resta: è un percorso diverso, guidato sui soli campi mancanti.

### Salvataggio

1. Il dialog salva (`customersApi.update` o `useUpdateRequest`).
2. Al successo chiama `onSaved`, che nel dettaglio pratica è `refetch()`.
3. Il riquadro si riallinea dai dati rifetchati; nessuno stato locale duplicato.

Gli errori si mostrano dentro il dialog, che resta aperto coi valori inseriti.

## Sorgente unica dell'indirizzo impianto

`requests.indirizzo_impianto` diventa la sorgente unica. In lettura, finché la
pulizia non è completata, si passa da una funzione di risoluzione con fallback
sui due campi legacy.

`src/utils/indirizzoImpianto.ts`:

```ts
risolviIndirizzoImpianto(request, equipmentData?): string
```

Ordine: `requests.indirizzo_impianto` → `dm329_technical_data.indirizzo_impianto`
→ `equipment_data.dati_impianto.sede_impianto` → stringa vuota.

La usano il riquadro Ubicazione e `CIVAApparecchioColumn`. Dopo il passo 3 della
pulizia si riduce a un accesso diretto.

## Pulizia in tre passi

Verifica sui dati di produzione: dei 23 record legacy con indirizzo, 8 hanno
`requests.indirizzo_impianto` vuoto, i restanti 15 contengono una stringa
identica a quella già su `requests`. **Zero conflitti.**

**Passo 1 — migration dati.** Riempi `requests.indirizzo_impianto` dai record
legacy dove è vuoto, prendendo `dm329_technical_data.indirizzo_impianto` e in
subordine `equipment_data->'dati_impianto'->>'sede_impianto'`. 8 righe attese.

**Passo 2 — codice.** `CIVAApparecchioColumn` legge dalla funzione di
risoluzione invece che da `impianto.sede_impianto`; via l'effetto `sedeImpianto`
da `RequestDetail`; via `technicalDataApi.updateAddress` (già codice morto) e il
campo di tipo `indirizzo_impianto_formatted`.

Passi 1 e 2 vanno insieme alla feature.

**Passo 3 — migration schema, commit separato dopo verifica in produzione.**
`DROP COLUMN dm329_technical_data.indirizzo_impianto` e
`indirizzo_impianto_formatted`; rimozione delle chiavi `sede_impianto` e
`sede_imp_uguale_legale` dal JSONB `dati_impianto` e dai tipi
`SchedaDatiCompleta`; semplificazione di `risolviIndirizzoImpianto`.

È l'unico passo irreversibile e nessuno se ne accorge finché non gira: resta
staccato, da eseguire quando le pagine sono state viste funzionare.

## Verifica

Convenzione del progetto: Vitest su logica e validazioni, niente test UI.

**Vitest** — `risolviIndirizzoImpianto` è l'unica unità di logica vera:
valorizzato su `requests`; vuoto con fallback sulla colonna legacy; vuoto con
fallback sul JSONB; tutti vuoti.

**Migration** — conteggio delle righe con `indirizzo_impianto` non nullo prima e
dopo l'esecuzione: atteso 41 → 49. Esecuzione via Management API secondo
CLAUDE.md.

**UI** — verifica manuale nel browser sulla pratica `fed244ee-26e6-4d32-8c01-45abd393879d`
(cliente "002 test"): apertura della matita cliente, modifica della descrizione
attività, salvataggio, e rilettura del valore su `customers` via API REST prima
di dichiarare che funziona. Stessa cosa per l'ubicazione, verificando che il
codice pratica resti coerente.

## Fuori ambito

- Estrazione dell'attività dalla visura camerale (rimandata esplicitamente).
- Matita cliente sulle pratiche non-DM329.
- Rimozione del dialog "Completa dati cliente".
