# Retro-coding codici pratica DM329 — Design

**Data:** 2026-07-06
**Stato:** approvato (design), da implementare
**Autore:** Studio Bertin + Claude

## Contesto e problema

Il codice pratica DM329 è stato introdotto il 2026-07-05 (migration
`20260705100000_dm329_practice_code.sql`). Compone il codice
`CODICECLIENTE[LETTERASALA]_PROGRESSIVO-ANNO` a partire dai campi su `requests`:
`sala_lettera`, `progressivo`, `anno`, `denominazione_sala`, `indirizzo_impianto`,
`pratica_padre_id`.

Questi campi sono popolati **solo in fase di creazione**, dal form
`NewRequest` tramite `DM329PraticaSection` / `DM329IntegrazioneSection`. Non esiste
alcun percorso in-app per assegnarli **dopo** la creazione: in `RequestDetail` e
`DM329TableView` il codice è solo visualizzato (read-only, via `codiceForRequest`).

Di conseguenza tutte le pratiche create **prima** del 2026-07-05 non hanno il codice e
non possono ottenerlo. Verifica sullo stato di produzione (2026-07-06):

- **342** pratiche DM329 totali (335 DM329 + 7 Integrazioni), **0** con
  `sala_lettera`/`progressivo`/`anno` valorizzati → codice vuoto per tutte.
- 338 hanno già il codice cliente (prefisso pronto); 4 casi limite (2 senza cliente,
  2 con cliente senza codice cliente).

## Obiettivo

Assegnare manualmente — ma nel rispetto di tutti i vincoli — i campi del codice
pratica alle pratiche esistenti che ne hanno bisogno, con uno strumento ibrido:
pre-compilazione automatica di una proposta + revisione manuale + import validato +
pannello in-app per rifiniture e casi futuri.

## Scope

**In scope (125 pratiche attive):**

| Insieme | Totali | Codificabili subito |
|---|--:|--:|
| DM329 primarie (stati 1→6) | 119 | 116 |
| DM329-Integrazioni (stati 1, 4) | 6 | 6 |
| **Totale** | **125** | **122** |

**Fuori scope (segnalate, non toccate):**

- **216** pratiche in stato terminale — `7-CHIUSA` (207+1) e `ARCHIVIATA NON FINITA`
  (9). Escluse su richiesta per limitare il volume.
- **3** casi limite tra le attive: 2 DM329 senza `customer_id`, 1 DM329 con cliente
  privo di codice cliente. Isolati in un elenco a parte; ripresi in un secondo momento
  tramite il pannello in-app (fase E).

## Vincoli del dominio (da rispettare)

Formato codice: `CODICECLIENTE[LETTERASALA]_PROGRESSIVO-ANNO` (es. `527A_00-2026`).
La lettera sala si **omette a video** quando il cliente ha una sola sala, ma va
comunque scritta in DB.

- **Prefisso cliente** = `customers.identificativo` (obbligatorio; se assente la
  pratica non è codificabile → rinviata).
- **`sala_lettera`** `char(1)`, `^[A-Z]$`. Una lettera distinta per ogni sala fisica
  dello stesso cliente.
- **`progressivo`** `smallint` 0–99: `00` = pratica iniziale, `01`/`02`… =
  aggiornamenti successivi della **stessa** sala.
- **`anno`** `smallint` 2000–2100.
- **Unicità DB**: indice parziale `ux_requests_codice_pratica
  (customer_id, sala_lettera, progressivo) WHERE pratica_padre_id IS NULL AND
  sala_lettera IS NOT NULL`. I progressivi devono essere univoci per cliente+sala.
- **Integrazioni**: `pratica_padre_id` → una pratica primaria dello **stesso cliente**;
  ereditano `sala_lettera`/`progressivo`/`anno` dal padre; escluse dall'unicità.

Il nodo del retro-coding è **semantico** (decidere sale-diverse vs aggiornamenti +
anno), non tecnico: per questo la decisione finale resta manuale.

## Architettura della soluzione (ibrida, 3 fasi + pannello)

### Fase B — Script di pre-compilazione (proposta)

Script Node/TS in `scripts/` che interroga la produzione (Management API, token
`SUPABASE_ACCESS_TOKEN`, ref `uphftgpwisdiubuhohnc`) ed esporta le 122 pratiche
codificabili in un file Excel (`DOCUMENTAZIONE/RETRO_CODICI_PRATICA_DM329.xlsx`),
raggruppate per cliente, con proposta best-effort:

- **Sala**: raggruppa per `customer_id` + indirizzo impianto ricavato dai
  `custom_fields` storici (fallback: titolo). Ogni indirizzo distinto = una sala →
  lettera `A`, `B`, `C`… nell'ordine di prima comparsa (per `created_at`).
- **Progressivo**: entro ogni sala, ordina per `created_at` → `00`, `01`, `02`…
- **Anno**: anno di `created_at` (o campo data se disponibile nei `custom_fields`).

Colonne del foglio:
`request_id | cliente | codice_cliente | titolo | indirizzo | created_at | stato |`
`prop_sala_lettera | prop_denominazione_sala | prop_progressivo | prop_anno |`
`pratica_padre (id/codice, solo integrazioni) | note_override`

La proposta è un punto di partenza modificabile, non una decisione automatica.

### Fase C — Revisione manuale (Excel)

L'utente rivede e corregge lettere/progressivi/anni/denominazioni. Il foglio riporta
in testa le regole di validazione. Qui si decide "sale diverse vs aggiornamenti".

### Fase D — Import validato

Script `scripts/import-retro-codici-dm329.ts` che:

1. Legge l'Excel rivisto.
2. **Valida** ogni riga contro tutti i vincoli: formato lettera, `progressivo` 0–99,
   `anno` 2000–2100, unicità `(customer_id, sala_lettera, progressivo)` tra primarie,
   integrazione con `pratica_padre_id` valido e dello stesso cliente.
3. Gira in **dry-run** di default: stampa un report (righe valide / errori / conflitti)
   senza scrivere. Con flag `--apply` esegue gli `UPDATE` in transazione.
4. Intercetta violazioni di unicità (Postgres `23505`) e le elenca con il progressivo
   libero suggerito (`get_next_progressivo`).

### Fase E — Pannello in-app "Assegna codice pratica"

Sul dettaglio (`RequestDetail`) di una pratica DM329 **priva di codice**, visibile ad
admin/userdm329, un pannello che **riusa la stessa logica del form di creazione**:

- Per le primarie: `DM329PraticaSection` in modalità edit (scelta sala esistente/nuova,
  `get_next_progressivo` automatico, anteprima codice, validazione identica).
- Per le integrazioni: `DM329IntegrazioneSection` (scelta pratica padre).
- Salva via `UPDATE` su `requests`.

Serve per rifiniture, pratiche nuove, i 3 casi limite e le eventuali chiuse recuperate
in futuro. È l'unico percorso che rende il codice **assegnabile dopo la creazione** in
modo permanente e riutilizzabile.

**Modifiche di supporto richieste:**

- Estendere `UpdateRequestInput` e `requestsApi.update` con i campi codice pratica
  (`sala_lettera`, `progressivo`, `anno`, `denominazione_sala`, `indirizzo_impianto`,
  `impianto_uguale_sede_legale`, `pratica_padre_id`).
- Verificare/adeguare la RLS di `UPDATE` su `requests` per admin/userdm329 sui nuovi
  campi.
- Refactor minimo di `DM329PraticaSection`/`DM329IntegrazioneSection` per accettare
  valori iniziali (edit) oltre al caso creazione, senza duplicare la logica.

## Caso aperto — integrazioni senza padre attivo

Le 6 integrazioni attive devono agganciarsi a una primaria dello stesso cliente. Se
l'unica primaria candidata è una pratica **chiusa** (esclusa dallo scope), l'integrazione
resterebbe senza padre. Verifica caso per caso in fase B; opzioni:

- codificare in eccezione la sola primaria-padre chiusa, **oppure**
- rinviare quella singola integrazione.

Decisione da prendere sui dati reali quando emergono.

## Sicurezza dei dati

- Ogni scrittura in produzione passa dal dry-run prima dell'`--apply`.
- Backup mirato di `requests` (colonne codice pratica + id) prima dell'import di massa.
- Nessuna modifica alle pratiche fuori scope (chiuse/archiviate/casi limite).

## Criteri di successo

- Le 122 pratiche attive codificabili hanno un codice pratica valido e coerente con le
  scelte manuali dell'utente.
- Nessuna violazione dell'indice di unicità; nessuna integrazione con padre incoerente.
- Il pannello in-app consente di assegnare/correggere il codice su qualsiasi pratica
  priva di codice, riusando la logica di creazione.
- Le pratiche fuori scope restano invariate.

## Testing

- **Fase B/D (script):** unit test sulla logica di raggruppamento sala/progressivo e
  sulla validazione dei vincoli (Vitest). Dry-run su dati reali come verifica manuale.
- **Fase E (pannello):** validazione della composizione codice (già coperta da
  `practiceCode`), verifica manuale del salvataggio e della non-regressione del form di
  creazione (logica condivisa).

## Ordine di esecuzione consigliato

B → C → D (primo giro sull'Excel, dà valore subito) → E (pannello, sblocca casi futuri
e rifiniture). Il caso aperto integrazioni si chiude durante B.
