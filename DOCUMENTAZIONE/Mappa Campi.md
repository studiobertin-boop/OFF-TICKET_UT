# SPECIFICHE TECNICHE FORM - SISTEMA RICHIESTE COMPRESSORI

## INDICE
1. [Panoramica](#panoramica)
2. [Tipologie di Richiesta](#tipologie-di-richiesta)
3. [Campi e Controlli](#campi-e-controlli)
4. [Liste Dropdown](#liste-dropdown)
5. [Regole di Validazione](#regole-di-validazione)
6. [Matrice di Mappatura](#matrice-di-mappatura)

---

## PANORAMICA

Sistema di gestione richieste per impianti di compressione aria con 10 tipologie di form differenziati.

### Convenzioni Obbligatorietà
- **OBBLIGATORIO** = campo richiesto, blocca invio se mancante
- **OBBLIGATORIO_ALTERNATIVO** = almeno uno dei campi marcati così deve essere compilato
- **FACOLTATIVO** = campo presente ma non bloccante
- **NON_PRESENTE** = campo non visualizzato nel form

---

## TIPOLOGIE DI RICHIESTA

### 1. DISEGNO - SALA COMPRESSORI – SCHEMA DI FLUSSO
**Codice:** `DISEGNO_SALA_SCHEMA`  
**Descrizione:** Richiesta elaborazione schema di flusso per sala compressori

### 2. DISEGNO - SALA COMPRESSORI – LAYOUT
**Codice:** `DISEGNO_SALA_LAYOUT`  
**Descrizione:** Richiesta elaborazione layout sala compressori

### 3. DISEGNO - DISTRIBUZIONE – LAYOUT
**Codice:** `DISEGNO_DISTRIBUZIONE_LAYOUT`  
**Descrizione:** Richiesta elaborazione layout rete di distribuzione

### 4. ANALISI – DS500 CONSUMI
**Codice:** `ANALISI_DS500_CONSUMI`  
**Descrizione:** Analisi consumi con strumento DS500 (include dettagli compressori)

### 5. ANALISI – DS500 – SOLO GRAFICI
**Codice:** `ANALISI_DS500_GRAFICI`  
**Descrizione:** Analisi DS500 limitata alla produzione grafici

### 6. ANALISI – DS500 – OCV
**Codice:** `ANALISI_DS500_OCV`  
**Descrizione:** Analisi DS500 per Open Circuit Voltage

### 7. ANALISI – RICERCA PERDITE
**Codice:** `ANALISI_RICERCA_PERDITE`  
**Descrizione:** Analisi per individuazione perdite nell'impianto

### 8. ANALISI – COMPARATIVA
**Codice:** `ANALISI_COMPARATIVA`  
**Descrizione:** Analisi comparativa tra diverse configurazioni

### 9. DI.CO.
**Codice:** `DICO`  
**Descrizione:** Dichiarazione di conformità

### 10. RICHIESTA LIBERA
**Codice:** `RICHIESTA_LIBERA`  
**Descrizione:** Richiesta generica non classificata

---

## CAMPI E CONTROLLI

### CAMPO: CLIENTE
- **ID campo:** `cliente`
- **Tipo controllo:** `select (dropdown)`
- **Lista dati:** `#1 - lista_clienti`
- **Fonte dati:** Tabella clienti (database)
- **Placeholder:** "Seleziona cliente..."

### CAMPO: STABILIMENTO/SALA
- **ID campo:** `stabilimento_sala`
- **Tipo controllo:** `text`
- **Max lunghezza:** 200 caratteri
- **Placeholder:** "Es: Stabilimento Padova - Sala 2"

### CAMPO: FILE ATTACHMENT
- **ID campo:** `file_attachment`
- **Tipo controllo:** `file upload`
- **Formati accettati:** PDF, DWG, DXF, JPG, PNG, XLSX, DOCX
- **Dimensione max:** 10 MB per file
- **Numero max file:** 5

### CAMPO: LISTA APPARECCHI
- **ID campo:** `lista_apparecchi`
- **Tipo controllo:** `textarea`
- **Righe visibili:** 5
- **Max lunghezza:** 2000 caratteri
- **Placeholder:** "Elencare gli apparecchi interessati (uno per riga)"

### CAMPO: TECNICO COLLEGAMENTO
- **ID campo:** `tecnico_collegamento`
- **Tipo controllo:** `select (dropdown)`
- **Lista dati:** `#2 - lista_tecnici`
- **Placeholder:** "Seleziona tecnico..."

### CAMPO: TECNICO SCOLLEGAMENTO
- **ID campo:** `tecnico_scollegamento`
- **Tipo controllo:** `select (dropdown)`
- **Lista dati:** `#2 - lista_tecnici`
- **Placeholder:** "Seleziona tecnico..."

### CAMPO: COMMERCIALE DI RIFERIMENTO
- **ID campo:** `commerciale_riferimento`
- **Tipo controllo:** `select (dropdown)`
- **Lista dati:** `#3 - lista_commerciali`
- **Placeholder:** "Seleziona commerciale..."

### CAMPO: POSIZIONE SENSORI
- **ID campo:** `posizione_sensori`
- **Tipo controllo:** `textarea`
- **Righe visibili:** 4
- **Max lunghezza:** 1000 caratteri
- **Placeholder:** "Descrivere la posizione dei sensori installati"

### CAMPO: DATA INIZIO
- **ID campo:** `data_inizio`
- **Tipo controllo:** `date`
- **Formato:** `DD-MM-YYYY`
- **Validazione:** Data >= oggi

### CAMPO: DATA FINE
- **ID campo:** `data_fine`
- **Tipo controllo:** `date`
- **Formato:** `DD-MM-YYYY`
- **Validazione:** Data >= data_inizio (se presente)

### CAMPO: STRUMENTO
- **ID campo:** `strumento`
- **Tipo controllo:** `select (dropdown)`
- **Lista dati:** `#4 - lista_strumenti`
- **Placeholder:** "Seleziona strumento..."

### CAMPO: RILEVATE PERDITE DA
- **ID campo:** `rilevate_perdite_da`
- **Tipo controllo:** `datetime-local`
- **Formato:** `DD-MM-YYYY HH:mm`

### CAMPO: RILEVATE PERDITE A
- **ID campo:** `rilevate_perdite_a`
- **Tipo controllo:** `datetime-local`
- **Formato:** `DD-MM-YYYY HH:mm`
- **Validazione:** Data >= rilevate_perdite_da

### CAMPO: NOTE
- **ID campo:** `note`
- **Tipo controllo:** `textarea`
- **Righe visibili:** 6
- **Max lunghezza:** 5000 caratteri
- **Placeholder:** "Note aggiuntive..."

---

## SEZIONE COMPRESSORI (Ripetibile 1-4 volte)

### STRUTTURA DATI COMPRESSORE
Ogni compressore ha 7 campi. La struttura è ripetibile per COMPRESSORE_1, COMPRESSORE_2, COMPRESSORE_3, COMPRESSORE_4.

### CAMPO: MARCA
- **ID campo:** `compressore_{n}_marca` (dove n = 1,2,3,4)
- **Tipo controllo:** `text`
- **Max lunghezza:** 100 caratteri
- **Placeholder:** "Es: Atlas Copco"

### CAMPO: MODELLO
- **ID campo:** `compressore_{n}_modello`
- **Tipo controllo:** `text`
- **Max lunghezza:** 100 caratteri
- **Placeholder:** "Es: GA 75 VSD+"

### CAMPO: ANNO
- **ID campo:** `compressore_{n}_anno`
- **Tipo controllo:** `number`
- **Min:** 1980
- **Max:** 2100
- **Step:** 1
- **Placeholder:** "Es: 2018"

### CAMPO: ORE DI LAVORO
- **ID campo:** `compressore_{n}_ore_lavoro`
- **Tipo controllo:** `number`
- **Min:** 0
- **Max:** 150000
- **Step:** 1
- **Unità misura:** ore
- **Placeholder:** "Es: 25000"

### CAMPO: TIPO
- **ID campo:** `compressore_{n}_tipo`
- **Tipo controllo:** `select (dropdown)`
- **Opzioni:**
  - `VITE` - A vite
  - `CENTRIFUGO` - Centrifugo
  - `SCROLL` - Scroll
  - `PISTONI` - A pistoni
  - `VSD` - Velocità variabile (VSD)
  - `ALTRO` - Altro
- **Placeholder:** "Seleziona tipo..."

### CAMPO: PRESSIONE LAVORO
- **ID campo:** `compressore_{n}_pressione_lavoro`
- **Tipo controllo:** `number`
- **Min:** 0
- **Max:** 50
- **Step:** 0.1
- **Unità misura:** bar
- **Placeholder:** "Es: 7.5"

### CAMPO: POTENZA (KW)
- **ID campo:** `compressore_{n}_potenza_kw`
- **Tipo controllo:** `number`
- **Min:** 5
- **Max:** 500
- **Step:** 1
- **Unità misura:** kW
- **Placeholder:** "Es: 75"

---

## LISTE DROPDOWN

### LISTA #1: CLIENTI
**ID lista:** `lista_clienti`  
**Fonte:** Database tabella `clienti`  
**Campi da estrarre:** `id`, `ragione_sociale`  
**Ordinamento:** Alfabetico per `ragione_sociale`  
**Opzione aggiuntiva:** Nessuna

### LISTA #2: TECNICI
**ID lista:** `lista_tecnici`  
**Tipo:** Statica  
**Valori:**
```json
[
  { "value": "BOSCHIERO_A", "label": "BOSCHIERO A." },
  { "value": "FARALLI_R", "label": "FARALLI R." },
  { "value": "FURLAN_D", "label": "FURLAN D." },
  { "value": "ALTRO", "label": "ALTRO" }
]
```

### LISTA #3: COMMERCIALI
**ID lista:** `lista_commerciali`  
**Tipo:** Statica  
**Valori:**
```json
[
  { "value": "VEDELAGO_H", "label": "VEDELAGO H." },
  { "value": "VEDELAGO_M", "label": "VEDELAGO M." },
  { "value": "SACCO_D", "label": "SACCO D." },
  { "value": "ZONTA_A", "label": "ZONTA A." },
  { "value": "BELLINA_M", "label": "BELLINA M." },
  { "value": "ALTRO", "label": "ALTRO" }
]
```

### LISTA #4: STRUMENTI
**ID lista:** `lista_strumenti`  
**Tipo:** Statica  
**Valori:**
```json
[
  { "value": "DS500_1", "label": "DS500 #1" },
  { "value": "DS500_2", "label": "DS500 #2" },
  { "value": "LD500", "label": "LD500" },
  { "value": "ALTRO", "label": "ALTRO" }
]
```

---

## REGOLE DI VALIDAZIONE

### VALIDAZIONE CLIENT-SIDE
1. **Campi obbligatori:** Bloccare invio se mancanti
2. **Range numerici:** Impedire inserimento valori fuori range
3. **Date:** Data fine >= Data inizio
4. **File:** Controllare formato e dimensione prima dell'upload
5. **Lunghezza testo:** Limitare caratteri in tempo reale con contatore

### VALIDAZIONE SERVER-SIDE
1. **Sanitizzazione input:** Tutti i campi di testo
2. **Verifica MIME type:** File caricati
3. **Controllo esistenza:** ID cliente da dropdown
4. **Validazione incrociata:** Date e dipendenze logiche
5. **Controllo obbligatorietà alternativa:** FILE_ATTACHMENT o LISTA_APPARECCHI

### REGOLA SPECIALE: OBBLIGATORIETÀ ALTERNATIVA
Nei form `DISEGNO_SALA_SCHEMA` e `DISEGNO_SALA_LAYOUT`:
- Se `file_attachment` è vuoto, allora `lista_apparecchi` è OBBLIGATORIO
- Se `lista_apparecchi` è vuoto, allora `file_attachment` è OBBLIGATORIO
- Almeno uno dei due deve essere compilato

---

## MATRICE DI MAPPATURA

### Legenda Stato Campi
- `OBBLIGATORIO` ✓ = Campo obbligatorio
- `OBBLIGATORIO_ALTERNATIVO` ◐ = Obbligatorio in alternativa
- `FACOLTATIVO` ○ = Campo facoltativo
- `NON_PRESENTE` − = Campo non presente

---

### FORM: DISEGNO_SALA_SCHEMA

| Campo | Stato | Note |
|-------|-------|------|
| cliente | OBBLIGATORIO ✓ | |
| stabilimento_sala | FACOLTATIVO ○ | |
| file_attachment | OBBLIGATORIO_ALTERNATIVO ◐ | Con lista_apparecchi |
| lista_apparecchi | OBBLIGATORIO_ALTERNATIVO ◐ | Con file_attachment |
| tecnico_collegamento | NON_PRESENTE − | |
| tecnico_scollegamento | NON_PRESENTE − | |
| commerciale_riferimento | FACOLTATIVO ○ | |
| posizione_sensori | NON_PRESENTE − | |
| data_inizio | NON_PRESENTE − | |
| data_fine | NON_PRESENTE − | |
| strumento | NON_PRESENTE − | |
| rilevate_perdite_da | NON_PRESENTE − | |
| rilevate_perdite_a | NON_PRESENTE − | |
| note | FACOLTATIVO ○ | |
| compressore_1_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_2_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_3_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_4_* | NON_PRESENTE − | Tutti i campi compressore |

---

### FORM: DISEGNO_SALA_LAYOUT

| Campo | Stato | Note |
|-------|-------|------|
| cliente | OBBLIGATORIO ✓ | |
| stabilimento_sala | FACOLTATIVO ○ | |
| file_attachment | OBBLIGATORIO_ALTERNATIVO ◐ | Con lista_apparecchi |
| lista_apparecchi | OBBLIGATORIO_ALTERNATIVO ◐ | Con file_attachment |
| tecnico_collegamento | NON_PRESENTE − | |
| tecnico_scollegamento | NON_PRESENTE − | |
| commerciale_riferimento | FACOLTATIVO ○ | |
| posizione_sensori | NON_PRESENTE − | |
| data_inizio | NON_PRESENTE − | |
| data_fine | NON_PRESENTE − | |
| strumento | NON_PRESENTE − | |
| rilevate_perdite_da | NON_PRESENTE − | |
| rilevate_perdite_a | NON_PRESENTE − | |
| note | FACOLTATIVO ○ | |
| compressore_1_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_2_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_3_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_4_* | NON_PRESENTE − | Tutti i campi compressore |

---

### FORM: DISEGNO_DISTRIBUZIONE_LAYOUT

| Campo | Stato | Note |
|-------|-------|------|
| cliente | OBBLIGATORIO ✓ | |
| stabilimento_sala | FACOLTATIVO ○ | |
| file_attachment | FACOLTATIVO ○ | |
| lista_apparecchi | NON_PRESENTE − | |
| tecnico_collegamento | NON_PRESENTE − | |
| tecnico_scollegamento | NON_PRESENTE − | |
| commerciale_riferimento | FACOLTATIVO ○ | |
| posizione_sensori | NON_PRESENTE − | |
| data_inizio | NON_PRESENTE − | |
| data_fine | NON_PRESENTE − | |
| strumento | NON_PRESENTE − | |
| rilevate_perdite_da | NON_PRESENTE − | |
| rilevate_perdite_a | NON_PRESENTE − | |
| note | FACOLTATIVO ○ | |
| compressore_1_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_2_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_3_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_4_* | NON_PRESENTE − | Tutti i campi compressore |

---

### FORM: ANALISI_DS500_CONSUMI

| Campo | Stato | Note |
|-------|-------|------|
| cliente | OBBLIGATORIO ✓ | |
| stabilimento_sala | FACOLTATIVO ○ | |
| file_attachment | FACOLTATIVO ○ | |
| lista_apparecchi | OBBLIGATORIO ✓ | |
| tecnico_collegamento | FACOLTATIVO ○ | |
| tecnico_scollegamento | FACOLTATIVO ○ | |
| commerciale_riferimento | FACOLTATIVO ○ | |
| posizione_sensori | FACOLTATIVO ○ | |
| data_inizio | OBBLIGATORIO ✓ | |
| data_fine | NON_PRESENTE − | |
| strumento | FACOLTATIVO ○ | |
| rilevate_perdite_da | FACOLTATIVO ○ | |
| rilevate_perdite_a | FACOLTATIVO ○ | |
| note | FACOLTATIVO ○ | |
| compressore_1_marca | FACOLTATIVO ○ | |
| compressore_1_modello | FACOLTATIVO ○ | |
| compressore_1_anno | FACOLTATIVO ○ | |
| compressore_1_ore_lavoro | FACOLTATIVO ○ | |
| compressore_1_tipo | FACOLTATIVO ○ | |
| compressore_1_pressione_lavoro | FACOLTATIVO ○ | |
| compressore_1_potenza_kw | FACOLTATIVO ○ | |
| compressore_2_marca | FACOLTATIVO ○ | |
| compressore_2_modello | FACOLTATIVO ○ | |
| compressore_2_anno | FACOLTATIVO ○ | |
| compressore_2_ore_lavoro | FACOLTATIVO ○ | |
| compressore_2_tipo | FACOLTATIVO ○ | |
| compressore_2_pressione_lavoro | FACOLTATIVO ○ | |
| compressore_2_potenza_kw | FACOLTATIVO ○ | |
| compressore_3_marca | FACOLTATIVO ○ | |
| compressore_3_modello | FACOLTATIVO ○ | |
| compressore_3_anno | FACOLTATIVO ○ | |
| compressore_3_ore_lavoro | FACOLTATIVO ○ | |
| compressore_3_tipo | FACOLTATIVO ○ | |
| compressore_3_pressione_lavoro | FACOLTATIVO ○ | |
| compressore_3_potenza_kw | FACOLTATIVO ○ | |
| compressore_4_marca | FACOLTATIVO ○ | |
| compressore_4_modello | FACOLTATIVO ○ | |
| compressore_4_anno | FACOLTATIVO ○ | |
| compressore_4_ore_lavoro | FACOLTATIVO ○ | |
| compressore_4_tipo | FACOLTATIVO ○ | |
| compressore_4_pressione_lavoro | FACOLTATIVO ○ | |
| compressore_4_potenza_kw | FACOLTATIVO ○ | |

---

### FORM: ANALISI_DS500_GRAFICI

| Campo | Stato | Note |
|-------|-------|------|
| cliente | OBBLIGATORIO ✓ | |
| stabilimento_sala | FACOLTATIVO ○ | |
| file_attachment | FACOLTATIVO ○ | |
| lista_apparecchi | FACOLTATIVO ○ | |
| tecnico_collegamento | FACOLTATIVO ○ | |
| tecnico_scollegamento | FACOLTATIVO ○ | |
| commerciale_riferimento | FACOLTATIVO ○ | |
| posizione_sensori | NON_PRESENTE − | |
| data_inizio | OBBLIGATORIO ✓ | |
| data_fine | NON_PRESENTE − | |
| strumento | FACOLTATIVO ○ | |
| rilevate_perdite_da | FACOLTATIVO ○ | |
| rilevate_perdite_a | FACOLTATIVO ○ | |
| note | FACOLTATIVO ○ | |
| compressore_1_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_2_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_3_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_4_* | NON_PRESENTE − | Tutti i campi compressore |

---

### FORM: ANALISI_DS500_OCV

| Campo | Stato | Note |
|-------|-------|------|
| cliente | OBBLIGATORIO ✓ | |
| stabilimento_sala | FACOLTATIVO ○ | |
| file_attachment | FACOLTATIVO ○ | |
| lista_apparecchi | FACOLTATIVO ○ | |
| tecnico_collegamento | FACOLTATIVO ○ | |
| tecnico_scollegamento | FACOLTATIVO ○ | |
| commerciale_riferimento | FACOLTATIVO ○ | |
| posizione_sensori | NON_PRESENTE − | |
| data_inizio | OBBLIGATORIO ✓ | |
| data_fine | NON_PRESENTE − | |
| strumento | FACOLTATIVO ○ | |
| rilevate_perdite_da | NON_PRESENTE − | |
| rilevate_perdite_a | NON_PRESENTE − | |
| note | FACOLTATIVO ○ | |
| compressore_1_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_2_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_3_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_4_* | NON_PRESENTE − | Tutti i campi compressore |

---

### FORM: ANALISI_RICERCA_PERDITE

| Campo | Stato | Note |
|-------|-------|------|
| cliente | OBBLIGATORIO ✓ | |
| stabilimento_sala | FACOLTATIVO ○ | |
| file_attachment | FACOLTATIVO ○ | |
| lista_apparecchi | FACOLTATIVO ○ | |
| tecnico_collegamento | NON_PRESENTE − | |
| tecnico_scollegamento | NON_PRESENTE − | |
| commerciale_riferimento | FACOLTATIVO ○ | |
| posizione_sensori | NON_PRESENTE − | |
| data_inizio | OBBLIGATORIO ✓ | |
| data_fine | NON_PRESENTE − | |
| strumento | FACOLTATIVO ○ | |
| rilevate_perdite_da | NON_PRESENTE − | |
| rilevate_perdite_a | NON_PRESENTE − | |
| note | FACOLTATIVO ○ | |
| compressore_1_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_2_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_3_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_4_* | NON_PRESENTE − | Tutti i campi compressore |

---

### FORM: ANALISI_COMPARATIVA

| Campo | Stato | Note |
|-------|-------|------|
| cliente | OBBLIGATORIO ✓ | |
| stabilimento_sala | FACOLTATIVO ○ | |
| file_attachment | FACOLTATIVO ○ | |
| lista_apparecchi | NON_PRESENTE − | |
| tecnico_collegamento | NON_PRESENTE − | |
| tecnico_scollegamento | NON_PRESENTE − | |
| commerciale_riferimento | FACOLTATIVO ○ | |
| posizione_sensori | NON_PRESENTE − | |
| data_inizio | NON_PRESENTE − | |
| data_fine | NON_PRESENTE − | |
| strumento | NON_PRESENTE − | |
| rilevate_perdite_da | NON_PRESENTE − | |
| rilevate_perdite_a | NON_PRESENTE − | |
| note | FACOLTATIVO ○ | |
| compressore_1_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_2_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_3_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_4_* | NON_PRESENTE − | Tutti i campi compressore |

---

### FORM: DICO

| Campo | Stato | Note |
|-------|-------|------|
| cliente | OBBLIGATORIO ✓ | |
| stabilimento_sala | FACOLTATIVO ○ | |
| file_attachment | FACOLTATIVO ○ | |
| lista_apparecchi | NON_PRESENTE − | |
| tecnico_collegamento | NON_PRESENTE − | |
| tecnico_scollegamento | NON_PRESENTE − | |
| commerciale_riferimento | FACOLTATIVO ○ | |
| posizione_sensori | NON_PRESENTE − | |
| data_inizio | NON_PRESENTE − | |
| data_fine | NON_PRESENTE − | |
| strumento | NON_PRESENTE − | |
| rilevate_perdite_da | NON_PRESENTE − | |
| rilevate_perdite_a | NON_PRESENTE − | |
| note | FACOLTATIVO ○ | |
| compressore_1_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_2_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_3_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_4_* | NON_PRESENTE − | Tutti i campi compressore |

---

### FORM: RICHIESTA_LIBERA

| Campo | Stato | Note |
|-------|-------|------|
| cliente | OBBLIGATORIO ✓ | |
| stabilimento_sala | FACOLTATIVO ○ | |
| file_attachment | FACOLTATIVO ○ | |
| lista_apparecchi | NON_PRESENTE − | |
| tecnico_collegamento | NON_PRESENTE − | |
| tecnico_scollegamento | NON_PRESENTE − | |
| commerciale_riferimento | FACOLTATIVO ○ | |
| posizione_sensori | NON_PRESENTE − | |
| data_inizio | NON_PRESENTE − | |
| data_fine | NON_PRESENTE − | |
| strumento | NON_PRESENTE − | |
| rilevate_perdite_da | NON_PRESENTE − | |
| rilevate_perdite_a | NON_PRESENTE − | |
| note | FACOLTATIVO ○ | |
| compressore_1_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_2_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_3_* | NON_PRESENTE − | Tutti i campi compressore |
| compressore_4_* | NON_PRESENTE − | Tutti i campi compressore |

---

## NOTE IMPLEMENTATIVE

### Gestione Dinamica Form
1. Caricare configurazione form da JSON/database
2. Renderizzare solo i campi con stato diverso da `NON_PRESENTE`
3. Applicare validazione obbligatorietà in base allo stato
4. Mostrare/nascondere sezioni compressori dinamicamente

### UX Consigliate
1. **Indicatori visivi:** Asterisco rosso per campi obbligatori
2. **Feedback real-time:** Validazione durante digitazione
3. **Messaggi di errore:** Chiari e posizionati vicino al campo
4. **Progress indicator:** Per form multi-step
5. **Auto-save:** Salvataggio automatico in bozza ogni 30 secondi

### Struttura Dati Output
```json
{
  "tipo_richiesta": "ANALISI_DS500_CONSUMI",
  "data_creazione": "2025-11-01T14:30:00Z",
  "cliente_id": 123,
  "stabilimento_sala": "Stabilimento Padova - Sala 2",
  "file_attachment": ["file1.pdf", "file2.dwg"],
  "lista_apparecchi": "Compressore Atlas Copco GA75\nEssiccatore XYZ",
  "tecnico_collegamento": "BOSCHIERO_A",
  "commerciale_riferimento": "VEDELAGO_H",
  "data_inizio": "2025-11-15",
  "strumento": "DS500_1",
  "note": "Analisi urgente richiesta dal cliente",
  "compressori": [
    {
      "numero": 1,
      "marca": "Atlas Copco",
      "modello": "GA 75 VSD+",
      "anno": 2018,
      "ore_lavoro": 25000,
      "tipo": "VSD",
      "pressione_lavoro": 7.5,
      "potenza_kw": 75
    }
  ]
}
```

---

**VERSIONE DOCUMENTO:** 1.0  
**DATA CREAZIONE:** 2025-11-01  
**ULTIMA MODIFICA:** 2025-11-01
