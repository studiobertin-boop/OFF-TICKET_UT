# ISTRUZIONI PER SVILUPPO FORM "SCHEDA DATI"

## OBIETTIVO
Sviluppare un form dinamico per la raccolta dati di sale compressori, denominato "SCHEDA DATI". Il form deve permettere l'inserimento, la modifica e il salvataggio di informazioni relative a diverse tipologie di apparecchiature presenti in una sala compressori.

---

## REQUISITI FUNZIONALI GENERALI

### Modalità di compilazione
- Tutti i campi sono modificabili
- Alcuni campi possono essere pre-compilati con suggerimenti dal database
- **Alcuni campi possono essere compilati tramite riconoscimento ottico (OCR) delle foto delle targhette degli apparecchi**
- Il form deve supportare il salvataggio incrementale (compilazione in più fasi)
- Il salvataggio definitivo avviene solo quando l'utente conferma la completezza dei dati

### Validazione
- I campi obbligatori devono essere validati prima del salvataggio definitivo
- Devono essere evidenziati eventuali campi obbligatori mancanti
- Il salvataggio parziale (bozza) non richiede validazione completa

---

## STRUTTURA DEL FORM

Il form è organizzato in sezioni. Ogni sezione, tranne le sezioni 1 e 2, può contenere apparecchiature ripetibili secondo regole specifiche.

### SEZIONE 1: DATI GENERALI

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| DATA SOPRALLUOGO | Data | Sì | Formato gg/mm/aaaa |
| NOME TECNICO | Testo | Sì | |
| CLIENTE | Testo | Sì | Suggerimento da DB |
| NOTE GENERALI | Testo multiriga | No | |

---

### SEZIONE 2: DATI IMPIANTO

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| INDIRIZZO IMPIANTO | Testo | Sì | |
| DENOMINAZIONE SALA | Testo | No | |
| LOCALE DEDICATO | Sì/No | No | Opzioni: Sì, No |
| LOCALE CONDIVISO CON | Testo | No | |
| ARIA ASPIRATA DAI COMPRESSORI | Scelta multipla | No | Opzioni: Pulita, Vapori, Acidi, Polveri, Umidità, Altro |
| RACCOLTA CONDENSE | Scelta multipla | Sì | Opzioni: Nessuna, separatore, tanica, altro |
| ACCESSO AL LOCALE VIETATO | Sì/No | No | Opzioni: Sì, No |
| LONTANO DA FONTI DI CALORE | Sì/No | No | Opzioni: Sì, No |
| FONTI DI CALORE VICINE | Testo | No | |
| DIAMETRI COLLEGAMENTI IN SALA | Numero/Testo | No | |
| DIAMETRI LINEE DI DISTRIBUZIONE | Numero/Testo | No | |

---

### SEZIONE 3: SERBATOI

**Codifica:** S1, S2, S3, S4, S5, S6, S7  
**Numero apparecchi:** da 1 a 7  
**Ripetibilità:** Ogni serbatoio ha il proprio set di campi

#### Campi per ogni serbatoio

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| MARCA | Testo | No | Suggerimento da DB, compilabile da OCR |
| MODELLO | Testo | No | Suggerimento da DB, compilabile da OCR |
| VOLUME (litri) | Numero intero | No | Range: min 50, max 5000 |
| N° DI FABBRICA | Testo | No | Compilabile da OCR |
| ANNO | Numero intero | No | Range: min 1980, max 2100 |
| FINITURA INTERNA | Scelta multipla | No | |
| ANCORATO A TERRA | Sì/No | No | |
| SCARICO | Scelta multipla | No | |
| NOTE | Testo multiriga | No | |

#### Valvola di sicurezza (obbligatoria per ogni serbatoio)

**Codifica:** S1.1, S2.1, S3.1, S4.1, S5.1, S6.1, S7.1  
**Regola:** Ogni serbatoio DEVE avere una valvola di sicurezza associata

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| MARCA | Testo | No | Compilabile da OCR |
| MODELLO | Testo | No | Compilabile da OCR |
| N° fabbrica | Testo | No | Compilabile da OCR |
| Diametro e Pressione | Testo | No | Compilabile da OCR |

#### Manometro

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| fondo scala (BAR) | Numero 1 decimale | No | Range: min 10, max 30 |
| segno rosso (BAR) | Numero 1 decimale | No | Range: min 10, max 30 |

---

### SEZIONE 4: COMPRESSORI

**Codifica:** C1, C2, C3, C4, C5  
**Numero apparecchi:** da 1 a 5  
**Ripetibilità:** Ogni compressore ha il proprio set di campi

#### Campi per ogni compressore

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| MARCA | Testo | No | Suggerimento da DB, compilabile da OCR |
| MODELLO | Testo | No | Suggerimento da DB, compilabile da OCR |
| N° DI FABBRICA | Testo | No | Compilabile da OCR |
| MATERIALE N° | Testo | No | Compilabile da OCR |
| ANNO | Numero intero | No | Range: min 1980, max 2100 |
| PRESSIONE MAX (bar) | Numero 1 decimale | No | Range: min 10, max 30 |
| NOTE | Testo multiriga | No | |

#### Relazioni
- Ogni compressore può avere un disoleatore associato (opzionale)
- Relazione: Compressore Cn ↔ Disoleatore Cn.1

---

### SEZIONE 5: DISOLEATORI

**Codifica:** C1.1, C2.1, C3.1, C4.1, C5.1  
**Numero apparecchi:** da 0 a 5  
**Ripetibilità:** Ogni disoleatore ha il proprio set di campi  
**Dipendenza:** Un disoleatore non può esistere senza un compressore associato

#### Campi per ogni disoleatore

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| MARCA | Testo | No | Suggerimento da DB, compilabile da OCR |
| MODELLO | Testo | No | Suggerimento da DB, compilabile da OCR |
| N° DI FABBRICA | Testo | No | Compilabile da OCR |
| VOLUME (litri) | Numero intero | No | Range: min 50, max 5000 |
| PRESSIONE MAX (bar) | Numero 1 decimale | No | Range: min 10, max 30 |
| NOTE | Testo multiriga | No | |

#### Valvola di sicurezza (obbligatoria per ogni disoleatore)

**Codifica:** C1.2, C2.2, C3.2, C4.2, C5.2  
**Regola:** Ogni disoleatore DEVE avere una valvola di sicurezza associata  
**Relazione:** Disoleatore Cn.1 ↔ Valvola Cn.2

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| MARCA | Testo | No | Compilabile da OCR |
| MODELLO | Testo | No | Compilabile da OCR |
| N° fabbrica | Testo | No | Compilabile da OCR |
| Diametro e Pressione | Testo | No | Compilabile da OCR |

---

### SEZIONE 6: ESSICCATORI

**Codifica:** E1, E2, E3, E4  
**Numero apparecchi:** da 1 a 4  
**Ripetibilità:** Ogni essiccatore ha il proprio set di campi

#### Campi per ogni essiccatore

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| MARCA | Testo | No | Suggerimento da DB, compilabile da OCR |
| MODELLO | Testo | No | Suggerimento da DB, compilabile da OCR |
| N° DI FABBRICA | Testo | No | Compilabile da OCR |
| ANNO | Numero intero | No | Range: min 1980, max 2100 |
| PRESSIONE MAX (bar) | Numero 1 decimale | No | Range: min 10, max 30 |

#### Relazioni
- Ogni essiccatore può avere uno scambiatore associato (opzionale)
- Relazione: Essiccatore En ↔ Scambiatore En.1

---

### SEZIONE 7: SCAMBIATORI

**Codifica:** E1.1, E2.1, E3.1, E4.1  
**Numero apparecchi:** da 0 a 4  
**Ripetibilità:** Ogni scambiatore ha il proprio set di campi  
**Dipendenza:** Uno scambiatore non può esistere senza un essiccatore associato

#### Campi per ogni scambiatore

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| MARCA | Testo | No | Suggerimento da DB, compilabile da OCR |
| MODELLO | Testo | No | Suggerimento da DB, compilabile da OCR |
| N° DI FABBRICA | Testo | No | Compilabile da OCR |
| ANNO | Numero intero | No | Range: min 1980, max 2100 |
| PRESSIONE MAX (bar) | Numero 1 decimale | No | Range: min 10, max 30 |
| VOLUME (litri) | Numero intero | No | Range: min 50, max 5000 |

#### Relazioni
- Uno scambiatore può essere associato a un essiccatore (opzionale)
- Uno scambiatore non può esistere senza un essiccatore associato

---

### SEZIONE 8: FILTRI

**Codifica:** F1, F2, F3, F4, F5, F6, F7, F8  
**Numero apparecchi:** da 1 a 8  
**Ripetibilità:** Ogni filtro ha il proprio set di campi

#### Campi per ogni filtro

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| MARCA | Testo | No | Suggerimento da DB, compilabile da OCR |
| MODELLO | Testo | No | Suggerimento da DB, compilabile da OCR |
| N° DI FABBRICA | Testo | No | Compilabile da OCR |
| ANNO | Numero intero | No | Range: min 1980, max 2100 |

---

### SEZIONE 9: SEPARATORI

**Codifica:** SEP1, SEP2, SEP3  
**Numero apparecchi:** da 1 a 3  
**Ripetibilità:** Ogni separatore ha il proprio set di campi

#### Campi per ogni separatore

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| MARCA | Testo | No | Suggerimento da DB, compilabile da OCR |
| MODELLO | Testo | No | Suggerimento da DB, compilabile da OCR |

---

### SEZIONE 10: ALTRI APPARECCHI

| Campo | Tipo | Obbligatorio | Note |
|-------|------|--------------|------|
| Descrizione altri apparecchi | Testo multiriga | No | Campo libero per inserire informazioni su eventuali altre apparecchiature presenti |

---

## LOGICA DI FUNZIONAMENTO

### Gestione apparecchiature ripetibili

1. **Aggiunta dinamica**: L'utente deve poter aggiungere apparecchiature fino al numero massimo consentito per ogni tipologia
2. **Rimozione**: L'utente deve poter rimuovere apparecchiature (con controllo delle dipendenze)
3. **Numerazione automatica**: La codifica deve essere assegnata automaticamente in modo progressivo

### Validazione dipendenze

Prima del salvataggio definitivo, il sistema deve verificare:

- Ogni disoleatore ha un compressore associato
- Ogni disoleatore ha la propria valvola di sicurezza
- Ogni serbatoio ha la propria valvola di sicurezza
- Ogni scambiatore ha un essiccatore associato

### Compilazione da OCR

I seguenti campi possono essere compilati tramite riconoscimento ottico delle targhette degli apparecchi:

**Per tutti gli apparecchi:**
- MARCA
- MODELLO
- N° DI FABBRICA / Matricola
- MATERIALE N° (solo compressori)
- ANNO
- PRESSIONE MAX

**Per valvole di sicurezza:**
- MARCA
- MODELLO
- ANNO
- N° fabbrica
- Diametro
- PRESSIONE DI TARATURA

L'utente deve poter:
- Caricare foto delle targhette
- Avviare il processo OCR
- Rivedere e correggere i dati riconosciuti prima di confermarli
- Modificare manualmente i dati in qualsiasi momento

### Suggerimenti da database

I seguenti campi devono mostrare suggerimenti dal database durante la digitazione:

- CLIENTE
- MARCA (per tutti gli apparecchi)
- MODELLO (per tutti gli apparecchi)

L'utente può scegliere un valore suggerito o inserire un nuovo valore.

### Salvataggio

**Salvataggio parziale (bozza)**
- Possibile in qualsiasi momento
- Non richiede campi obbligatori compilati
- Non richiede validazione completa delle dipendenze
- Deve salvare lo stato corrente del form

**Salvataggio definitivo**
- Richiede tutti i campi obbligatori compilati
- Richiede validazione completa delle dipendenze
- Richiede conferma esplicita dall'utente
- Dopo il salvataggio definitivo, il form può essere riaperto per modifiche

---

## CONSIDERAZIONI TECNICHE

### Interfaccia utente

- Organizzare il form in sezioni collassabili per migliorare la navigabilità
- Evidenziare chiaramente i campi obbligatori (es. con asterisco)
- Mostrare indicatori di completamento per ogni sezione
- Fornire feedback visivo immediato in caso di errori di validazione
- Integrare funzionalità di caricamento foto per OCR con preview delle immagini
- Mostrare progress bar durante elaborazione OCR

### Gestione stato

- Implementare autosalvataggio periodico per evitare perdita di dati
- Mantenere traccia delle modifiche non salvate
- Gestire correttamente lo stato delle apparecchiature dipendenti (disoleatori, valvole, scambiatori)
- Cachare i risultati OCR per evitare rielaborazioni

### Performance

- Ottimizzare il caricamento dei suggerimenti dal database (debouncing, caching)
- Gestire in modo efficiente form con molte apparecchiature ripetute
- Processare OCR in modo asincrono senza bloccare l'interfaccia
- Comprimere le immagini delle targhette prima dell'upload se necessario (dimensione massima 700kb)

---

## FORMATO DATI

### Struttura JSON suggerita per il salvataggio

```json
{
  "id_scheda": "uuid",
  "data_creazione": "timestamp",
  "data_ultima_modifica": "timestamp",
  "stato": "bozza|completa",
  "dati_generali": {
    "data_sopralluogo": "string (gg/mm/aaaa)",
    "nome_tecnico": "string",
    "cliente": "string",
    "note_generali": "string"
  },
  "dati_impianto": {
    "indirizzo_impianto": "string",
    "denominazione_sala": "string",
    "locale_dedicato": "boolean",
    "locale_condiviso_con": "string",
    "aria_aspirata": ["string"],
    "raccolta_condense": ["string"],
    "accesso_locale_vietato": "boolean",
    "lontano_fonti_calore": "boolean",
    "fonti_calore_vicine": "string",
    "diametri_collegamenti_sala": "string",
    "diametri_linee_distribuzione": "string"
  },
  "serbatoi": [
    {
      "codice": "S1",
      "marca": "string",
      "modello": "string",
      "volume": number,
      "n_fabbrica": "string",
      "anno": number,
      "finitura_interna": ["string"],
      "ancorato_terra": "boolean",
      "scarico": ["string"],
      "note": "string",
      "valvola_sicurezza": {
        "codice": "S1.1",
        "marca": "string",
        "modello": "string",
        "n_fabbrica": "string",
        "diametro_pressione": "string"
      },
      "manometro": {
        "fondo_scala": number,
        "segno_rosso": number
      },
      "foto_targhetta": "string (base64 o URL)"
    }
  ],
  "compressori": [
    {
      "codice": "C1",
      "marca": "string",
      "modello": "string",
      "n_fabbrica": "string",
      "materiale_n": "string",
      "anno": number,
      "pressione_max": number,
      "note": "string",
      "ha_disoleatore": boolean,
      "foto_targhetta": "string (base64 o URL)"
    }
  ],
  "disoleatori": [
    {
      "codice": "C1.1",
      "compressore_associato": "C1",
      "marca": "string",
      "modello": "string",
      "n_fabbrica": "string",
      "volume": number,
      "pressione_max": number,
      "note": "string",
      "valvola_sicurezza": {
        "codice": "C1.2",
        "marca": "string",
        "modello": "string",
        "n_fabbrica": "string",
        "diametro_pressione": "string"
      },
      "foto_targhetta": "string (base64 o URL)"
    }
  ],
  "essiccatori": [
    {
      "codice": "E1",
      "marca": "string",
      "modello": "string",
      "n_fabbrica": "string",
      "anno": number,
      "pressione_max": number,
      "ha_scambiatore": boolean,
      "foto_targhetta": "string (base64 o URL)"
    }
  ],
  "scambiatori": [
    {
      "codice": "E1.1",
      "essiccatore_associato": "E1",
      "marca": "string",
      "modello": "string",
      "n_fabbrica": "string",
      "anno": number,
      "pressione_max": number,
      "volume": number,
      "foto_targhetta": "string (base64 o URL)"
    }
  ],
  "filtri": [
    {
      "codice": "F1",
      "marca": "string",
      "modello": "string",
      "n_fabbrica": "string",
      "anno": number,
      "foto_targhetta": "string (base64 o URL)"
    }
  ],
  "separatori": [
    {
      "codice": "SEP1",
      "essiccatore_associato": "E1",
      "marca": "string",
      "modello": "string",
      "foto_targhetta": "string (base64 o URL)"
    }
  ],
  "altri_apparecchi": "string (multiriga)"
}
```

---

## PRIORITÀ DI SVILUPPO

1. Implementare la struttura base del form con tutte le sezioni
2. Implementare la logica di aggiunta/rimozione dinamica delle apparecchiature
3. Implementare la validazione dei campi obbligatori
4. Implementare la gestione delle dipendenze tra apparecchiature
5. Implementare i suggerimenti da database
6. Implementare il salvataggio parziale e definitivo
7. Implementare la funzionalità OCR per targhette
8. Implementare autosalvataggio e gestione stato
9. Ottimizzare UX e performance

---

## NOTE FINALI

- Tutti i numeri decimali devono utilizzare la virgola come separatore decimale (formato italiano)
- Le date devono essere in formato gg/mm/aaaa
- Prestare particolare attenzione alla gestione delle relazioni tra apparecchiature per evitare inconsistenze nei dati
- Prevedere messaggi di conferma prima di eliminare apparecchiature con dipendenze
- La funzionalità OCR deve essere integrabile con VISIO GPT 4o
- Prevedere fallback manuale in caso di errori OCR
