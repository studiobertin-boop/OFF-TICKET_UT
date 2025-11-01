# Implementazione 10 Nuovi Tipi Richiesta Compressori

## Data Implementazione
2025-11-01

## Obiettivo
Aggiungere 10 nuovi tipi di richiesta per gestione impianti compressori con form dinamici, campi personalizzati e validazioni specifiche.

---

## Modifiche Implementate

### 1. Estensione Tipi TypeScript

**File:** `src/types/index.ts`

Esteso `FieldSchema` con nuovi tipi e proprietà:
- **Nuovi tipi campo:**
  - `number` - Input numerico con validazione range
  - `datetime-local` - Selezione data + ora
  - `repeatable_group` - Gruppo di campi ripetibili (per compressori)

- **Nuove proprietà:**
  - `min`, `max`, `step` - Per campi number/date
  - `maxLength` - Per campi text/textarea
  - `placeholder` - Placeholder per tutti i campi
  - `accept` - Formati accettati per file
  - `maxFiles`, `maxFileSize` - Limiti upload file
  - `groupFields`, `minItems`, `maxItems` - Per repeatable_group

---

### 2. Aggiornamento Rendering Form

**File:** `src/components/requests/DynamicFormField.tsx`

Aggiunti nuovi case per:
- **Campo `number`:** Input numerico con min/max/step
- **Campo `datetime-local`:** Selezione data e ora HTML5
- **Campo `repeatable_group`:** Renderizza componente `CompressorFields`
- **Estensione campi esistenti:** Applicati placeholder, maxLength, accept ai campi text/textarea/file

---

### 3. Nuovo Componente CompressorFields

**File:** `src/components/requests/CompressorFields.tsx`

Componente per gestione campi compressori ripetibili:
- Supporta da 0 a 4 compressori
- Ogni compressore ha 7 campi:
  1. Marca (text, max 100 char)
  2. Modello (text, max 100 char)
  3. Anno (number, 1980-2100)
  4. Ore di Lavoro (number, 0-150000)
  5. Tipo (select: VITE, CENTRIFUGO, SCROLL, PISTONI, VSD, ALTRO)
  6. Pressione Lavoro (number, 0-50 bar, step 0.1)
  7. Potenza kW (number, 5-500 kW)
- Bottoni "Aggiungi Compressore" / "Rimuovi Compressore"
- Layout responsive con Material-UI Grid

---

### 4. Estensione Validazione Zod

**File:** `src/utils/formSchema.ts`

**Aggiunte:**
1. **Validazione campo `number`:**
   - Type checking con messaggio di errore custom
   - Validazione min/max con messaggi descrittivi

2. **Validazione campo `datetime-local`:**
   - Stringa obbligatoria/opzionale come per `date`

3. **Nuova funzione `generateZodSchemaWithValidations`:**
   - **Obbligatorietà alternativa:** Per form `DISEGNO_SALA_SCHEMA` e `DISEGNO_SALA_LAYOUT`
     - Almeno uno tra `file_attachment` e `lista_apparecchi` deve essere compilato
   - **Validazioni cross-field:**
     - `data_fine >= data_inizio`
     - `rilevate_perdite_a >= rilevate_perdite_da`

4. **Aggiornamento `getDefaultValues`:**
   - Default per `number`: min value o 0
   - Default per `datetime-local`: stringa vuota
   - Default per `repeatable_group`: array vuoto

---

### 5. Migration Database

**File:** `supabase/migrations/20251101223812_add_compressor_request_types.sql`

Inseriti 10 nuovi `request_types`:

| # | Nome | Codice (interno) | Campi Obbligatori | Note Speciali |
|---|------|------------------|-------------------|---------------|
| 1 | DISEGNO - SALA COMPRESSORI – SCHEMA DI FLUSSO | DISEGNO_SALA_SCHEMA | cliente, file_attachment OR lista_apparecchi | Validazione alternativa |
| 2 | DISEGNO - SALA COMPRESSORI – LAYOUT | DISEGNO_SALA_LAYOUT | cliente, file_attachment OR lista_apparecchi | Validazione alternativa |
| 3 | DISEGNO - DISTRIBUZIONE – LAYOUT | DISEGNO_DISTRIBUZIONE_LAYOUT | cliente | - |
| 4 | ANALISI – DS500 CONSUMI | ANALISI_DS500_CONSUMI | cliente, lista_apparecchi, data_inizio | Include sezione compressori |
| 5 | ANALISI – DS500 – SOLO GRAFICI | ANALISI_DS500_GRAFICI | cliente, data_inizio | - |
| 6 | ANALISI – DS500 – OCV | ANALISI_DS500_OCV | cliente, data_inizio | - |
| 7 | ANALISI – RICERCA PERDITE | ANALISI_RICERCA_PERDITE | cliente, data_inizio | - |
| 8 | ANALISI – COMPARATIVA | ANALISI_COMPARATIVA | cliente | - |
| 9 | DI.CO. | DICO | cliente | - |
| 10 | RICHIESTA LIBERA | RICHIESTA_LIBERA | cliente | - |

**Liste Dropdown Statiche:**
- **Tecnici:** BOSCHIERO A., FARALLI R., FURLAN D., ALTRO
- **Commerciali:** VEDELAGO H., VEDELAGO M., SACCO D., ZONTA A., BELLINA M., ALTRO
- **Strumenti:** DS500 #1, DS500 #2, LD500, ALTRO

**Campi Comuni:**
- `cliente` (autocomplete da tabella `customers`)
- `stabilimento_sala` (text, facoltativo)
- `file_attachment` (file upload, max 5 file da 10MB, formati: PDF, DWG, DXF, JPG, PNG, XLSX, DOCX)
- `commerciale_riferimento` (select)
- `note` (textarea, max 5000 char)

---

## Passaggi per Completare l'Implementazione

### Passo 1: Applicare Migration al Database

**Opzione A - Via Supabase CLI (Consigliato):**
```bash
# Login a Supabase (se non già fatto)
npx supabase login

# Link al progetto
npx supabase link --project-ref uphftgpwisdiubuhohnc

# Applicare migration
npx supabase db push
```

**Opzione B - Via Supabase Dashboard:**
1. Andare su https://uphftgpwisdiubuhohnc.supabase.co/project/uphftgpwisdiubuhohnc/editor
2. Aprire SQL Editor
3. Copiare il contenuto di `supabase/migrations/20251101223812_add_compressor_request_types.sql`
4. Eseguire la query

**Opzione C - Via File SQL Diretto:**
```bash
# Se hai accesso diretto al database
psql -h db.uphftgpwisdiubuhohnc.supabase.co -U postgres -d postgres -f supabase/migrations/20251101223812_add_compressor_request_types.sql
```

---

### Passo 2: Aggiornare Utilizzo Schema Zod nei Form

**File da modificare:** `src/pages/requests/NewRequest.tsx` (o dove viene generato lo schema Zod)

**Modificare da:**
```typescript
const schema = generateZodSchema(requestType.fields_schema)
```

**A:**
```typescript
const schema = generateZodSchemaWithValidations(
  requestType.fields_schema,
  requestType.name
)
```

Questo abiliterà le validazioni custom per:
- Obbligatorietà alternativa (DISEGNO_SALA_SCHEMA, DISEGNO_SALA_LAYOUT)
- Validazioni cross-field date (data_fine >= data_inizio, ecc.)

---

### Passo 3: Gestione Salvataggio Compressori

**File da verificare/modificare:** `src/pages/requests/NewRequest.tsx`

Quando si salvano i dati del form, i campi compressori (compressore_1_marca, compressore_1_modello, ecc.) devono essere raccolti e salvati in un array strutturato in `custom_fields.compressori`:

```typescript
// Esempio di processamento dati prima del salvataggio
const processCompressorFields = (formData: any) => {
  const compressori = []

  for (let i = 1; i <= 4; i++) {
    const prefix = `compressore_${i}`

    // Se almeno un campo del compressore è compilato, raccoglielo
    if (formData[`${prefix}_marca`] || formData[`${prefix}_modello`]) {
      compressori.push({
        numero: i,
        marca: formData[`${prefix}_marca`] || '',
        modello: formData[`${prefix}_modello`] || '',
        anno: formData[`${prefix}_anno`] || null,
        ore_lavoro: formData[`${prefix}_ore_lavoro`] || null,
        tipo: formData[`${prefix}_tipo`] || '',
        pressione_lavoro: formData[`${prefix}_pressione_lavoro`] || null,
        potenza_kw: formData[`${prefix}_potenza_kw`] || null,
      })

      // Rimuovi campi flat dal custom_fields
      delete formData[`${prefix}_marca`]
      delete formData[`${prefix}_modello`]
      delete formData[`${prefix}_anno`]
      delete formData[`${prefix}_ore_lavoro`]
      delete formData[`${prefix}_tipo`]
      delete formData[`${prefix}_pressione_lavoro`]
      delete formData[`${prefix}_potenza_kw`]
    }
  }

  if (compressori.length > 0) {
    formData.compressori = compressori
  }

  return formData
}
```

---

### Passo 4: Testing

**Checklist di test:**

- [ ] **Creazione richieste:**
  - [ ] DISEGNO - SALA COMPRESSORI – SCHEMA DI FLUSSO
    - [ ] Validazione alternativa: solo file_attachment
    - [ ] Validazione alternativa: solo lista_apparecchi
    - [ ] Validazione alternativa: entrambi compilati
    - [ ] Errore se nessuno dei due compilato
  - [ ] DISEGNO - SALA COMPRESSORI – LAYOUT (stesse validazioni)
  - [ ] ANALISI – DS500 CONSUMI
    - [ ] Aggiunta 1 compressore
    - [ ] Aggiunta 4 compressori
    - [ ] Rimozione compressore
    - [ ] Validazione campi compressore
  - [ ] Altri 7 tipi richiesta (form base)

- [ ] **Validazioni campi:**
  - [ ] Campo number: min/max range
  - [ ] Campo datetime-local: formato corretto
  - [ ] Campo file: formati accettati, dimensione max
  - [ ] Campo textarea: maxLength
  - [ ] Cross-field: data_fine >= data_inizio
  - [ ] Cross-field: rilevate_perdite_a >= rilevate_perdite_da

- [ ] **Salvataggio dati:**
  - [ ] Cliente autocomplete salvato correttamente (customer_id + custom_fields.cliente)
  - [ ] Compressori salvati come array in custom_fields.compressori
  - [ ] File upload funzionante (Supabase Storage)
  - [ ] Note e campi facoltativi salvati

- [ ] **Visualizzazione richieste:**
  - [ ] Dettaglio richiesta mostra tutti i campi
  - [ ] Compressori visualizzati correttamente
  - [ ] File attachments scaricabili

---

## Struttura Dati Output

### Esempio Request ANALISI_DS500_CONSUMI con Compressori

```json
{
  "id": "uuid-richiesta",
  "request_type_id": "uuid-request-type",
  "title": "Analisi DS500 - Cliente XYZ",
  "status": "APERTA",
  "customer_id": "uuid-cliente",
  "created_by": "uuid-utente",
  "custom_fields": {
    "cliente": {
      "id": "uuid-cliente",
      "ragione_sociale": "Nome Azienda SRL"
    },
    "stabilimento_sala": "Stabilimento Padova - Sala 2",
    "lista_apparecchi": "Compressore principale\nEssiccatore\nSerbatoio",
    "tecnico_collegamento": "BOSCHIERO A.",
    "tecnico_scollegamento": "FARALLI R.",
    "commerciale_riferimento": "VEDELAGO H.",
    "posizione_sensori": "Sensore 1: uscita compressore\nSensore 2: ingresso serbatoio",
    "data_inizio": "2025-11-15",
    "strumento": "DS500 #1",
    "rilevate_perdite_da": "2025-11-15T08:00",
    "rilevate_perdite_a": "2025-11-15T18:00",
    "note": "Cliente richiede analisi urgente",
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
      },
      {
        "numero": 2,
        "marca": "Kaeser",
        "modello": "BSD 50",
        "anno": 2015,
        "ore_lavoro": 38000,
        "tipo": "VITE",
        "pressione_lavoro": 8.0,
        "potenza_kw": 50
      }
    ]
  },
  "created_at": "2025-11-01T22:30:00Z",
  "updated_at": "2025-11-01T22:30:00Z"
}
```

---

## Note Tecniche

### Limitazioni Attuali
1. **Campo `repeatable_group`:** Implementato solo per compressori, non è generico
2. **File upload:** Gestisce max 5 file, ma il componente attuale potrebbe necessitare di aggiornamento per upload multipli
3. **Validazione file size:** Implementata lato client, ma richiede anche validazione server-side

### Miglioramenti Futuri Consigliati
1. **Componente generico per repeatable_group:** Renderizzare dinamicamente qualsiasi tipo di gruppo ripetibile basato su `groupFields`
2. **Drag-and-drop file upload:** Migliorare UX upload con libreria come `react-dropzone`
3. **Preview allegati:** Mostrare preview PDF/immagini inline nel form
4. **Validazione server-side:** Edge Function per validare file size, MIME type, e validazioni business logic
5. **Auto-save bozze:** Salvare automaticamente form in bozza ogni 30 secondi

---

## File Modificati

1. ✅ `src/types/index.ts`
2. ✅ `src/components/requests/DynamicFormField.tsx`
3. ✅ `src/components/requests/CompressorFields.tsx` (nuovo)
4. ✅ `src/utils/formSchema.ts`
5. ✅ `supabase/migrations/20251101223812_add_compressor_request_types.sql` (nuovo)
6. ⚠️ `src/pages/requests/NewRequest.tsx` (da aggiornare - vedi Passo 2 e 3)

---

## Supporto e Troubleshooting

### Problema: Migration fallisce
**Causa:** Conflitto con dati esistenti o vincoli foreign key
**Soluzione:** Verificare che la tabella `customers` esista e contenga dati

### Problema: Validazione alternativa non funziona
**Causa:** Schema Zod non aggiornato con `generateZodSchemaWithValidations`
**Soluzione:** Verificare Passo 2

### Problema: Compressori non salvati correttamente
**Causa:** Dati non processati prima del salvataggio
**Soluzione:** Implementare logica Passo 3

### Problema: Campo datetime-local non mostra il picker
**Causa:** Browser non supporta input type="datetime-local" (Safari vecchio)
**Soluzione:** Usare libreria come `@mui/x-date-pickers` con `DateTimePicker`

---

**Implementazione completata da:** Claude Code
**Data:** 2025-11-01 22:40
