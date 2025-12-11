# Placeholder Reference - Template DM329

## Introduzione

Questo documento contiene l'elenco completo di tutti i **placeholder** disponibili per i template di relazioni tecniche DM329. Ogni placeholder è un campo dati che verrà sostituito automaticamente con le informazioni reali della pratica durante la generazione del documento.

## Come Usare i Placeholder

### Sintassi Base

```handlebars
{{nome_campo}}
```

**Esempio:**
```handlebars
Il cliente {{cliente.ragione_sociale}} ha sede in {{cliente.sede_legale.citta}}.
```

**Output:**
```
Il cliente ACME S.p.A. ha sede in Milano.
```

### Placeholder con Array

Per accedere a elementi di array, usa la notazione con indice `[0]`:

```handlebars
{{compressori[0].marca}} {{compressori[0].modello}}
```

**Output:**
```
Kaeser ASD 37
```

### Contare Elementi

Usa `.length` per ottenere il numero di elementi:

```handlebars
L'impianto dispone di {{serbatoi.length}} serbatoi.
```

**Output:**
```
L'impianto dispone di 2 serbatoi.
```

---

## 📂 Categorie Placeholder

- [🏢 Cliente](#-cliente)
- [📍 Sito Impianto](#-sito-impianto)
- [📅 Dati Generali](#-dati-generali)
- [🏭 Dati Impianto](#-dati-impianto)
- [🛢️ Serbatoi](#️-serbatoi)
- [⚙️ Compressori](#️-compressori)
- [🔧 Disoleatori](#-disoleatori)
- [❄️ Essiccatori](#️-essiccatori)
- [🌡️ Scambiatori](#️-scambiatori)
- [🔲 Filtri](#-filtri)
- [📦 Recipienti Filtro](#-recipienti-filtro)
- [💧 Separatori](#-separatori)
- [🔒 Valvole di Sicurezza](#-valvole-di-sicurezza)
- [🔗 Collegamenti](#-collegamenti)
- [📊 Spessimetrica](#-spessimetrica)
- [🚩 Flags](#-flags)
- [📋 Apparecchiature Aggregate](#-apparecchiature-aggregate)

---

## 🏢 Cliente

Dati anagrafici del cliente.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `cliente.ragione_sociale` | string | Ragione sociale azienda | `ACME S.p.A.` |
| `cliente.sede_legale.via` | string | Via sede legale | `Via Roma` |
| `cliente.sede_legale.civico` | string | Numero civico | `10` |
| `cliente.sede_legale.cap` | string | CAP | `20100` |
| `cliente.sede_legale.citta` | string | Città | `Milano` |
| `cliente.sede_legale.provincia` | string | Sigla provincia | `MI` |

**Esempio d'uso:**
```handlebars
Il sottoscritto {{nome_tecnico}}, su incarico di {{cliente.ragione_sociale}},
con sede legale in {{cliente.sede_legale.via}}, {{cliente.sede_legale.civico}},
{{cliente.sede_legale.cap}} {{cliente.sede_legale.citta}} ({{cliente.sede_legale.provincia}}),
ha eseguito sopralluogo tecnico presso l'impianto.
```

---

## 📍 Sito Impianto

Indirizzo del sito dove è installato l'impianto (può essere diverso dalla sede legale).

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `sito_impianto.via` | string | Via impianto | `Via delle Industrie` |
| `sito_impianto.civico` | string | Numero civico | `25` |
| `sito_impianto.cap` | string | CAP | `20020` |
| `sito_impianto.citta` | string | Città | `Arese` |
| `sito_impianto.provincia` | string | Sigla provincia | `MI` |

**Esempio d'uso:**
```handlebars
L'impianto è installato presso {{sito_impianto.via}}, {{sito_impianto.civico}},
{{sito_impianto.cap}} {{sito_impianto.citta}} ({{sito_impianto.provincia}}).
```

---

## 📅 Dati Generali

Informazioni generali sul sopralluogo e l'azienda.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `data_sopralluogo` | string (date) | Data sopralluogo | `2024-12-01` |
| `nome_tecnico` | string | Nome tecnico incaricato | `Ing. Mario Rossi` |
| `descrizione_attivita` | string | Attività aziendale (ATECO) | `Fabbricazione di prodotti in plastica` |

**Esempio d'uso:**
```handlebars
In data {{formatDate data_sopralluogo}}, il sottoscritto {{nome_tecnico}}
ha eseguito sopralluogo tecnico presso l'azienda che svolge attività di
{{descrizione_attivita}}.
```

**Nota:** Usa l'helper `{{formatDate data_sopralluogo}}` per formattare la data in formato italiano.

---

## 🏭 Dati Impianto

Caratteristiche generali dell'installazione dell'impianto aria compressa.

| Placeholder | Tipo | Descrizione | Valori |
|-------------|------|-------------|--------|
| `dati_impianto.locale_dedicato` | boolean | Locale dedicato ai compressori | `true` / `false` |
| `dati_impianto.accesso_locale_vietato` | boolean | Accesso vietato ai non addetti | `true` / `false` |
| `dati_impianto.aria_aspirata` | array | Origine aria aspirata | `['Esterno', 'Interno']` |
| `dati_impianto.raccolta_condense` | array | Sistema raccolta condense | `['Disoleatori', 'Separatori']` |
| `dati_impianto.lontano_materiale_infiammabile` | boolean | Distanza materiale infiammabile | `true` / `false` |

**Esempio d'uso:**
```handlebars
{{#if dati_impianto.locale_dedicato}}
L'impianto è installato in locale dedicato, separato da altri ambienti.
{{/if}}

{{#if dati_impianto.accesso_locale_vietato}}
L'accesso al locale è vietato al personale non autorizzato mediante apposita
segnaletica e chiusura a chiave.
{{/if}}

L'aria aspirata proviene da: {{join dati_impianto.aria_aspirata ', '}}.
Le condense sono raccolte mediante: {{join dati_impianto.raccolta_condense ', '}}.
```

---

## 🛢️ Serbatoi

Array di serbatoi aria compressa. Accedi agli elementi con `serbatoi[0]`, `serbatoi[1]`, ecc.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `serbatoi.length` | number | Numero totale serbatoi | `2` |
| `serbatoi[N].codice` | string | Codice identificativo | `S1` |
| `serbatoi[N].marca` | string | Marca costruttore | `Atlas Copco` |
| `serbatoi[N].modello` | string | Modello | `LV 500` |
| `serbatoi[N].volume` | number | Volume in litri | `500` |
| `serbatoi[N].ps_pressione_max` | number | PS in bar | `13` |
| `serbatoi[N].ps_x_volume` | number | PS × V (calcolato) | `6500` |
| `serbatoi[N].ts_temperatura` | number | TS in °C | `80` |
| `serbatoi[N].categoria_ped` | string | Categoria PED | `II`, `III`, `IV` |
| `serbatoi[N].anno` | number | Anno fabbricazione | `2015` |
| `serbatoi[N].numero_fabbrica` | string | Numero fabbrica | `12345/2015` |
| `serbatoi[N].scarico` | string | Tipo scarico | `AUTOMATICO`, `MANUALE` |
| `serbatoi[N].finitura_interna` | string | Finitura | `ZINCATO`, `VERNICIATO` |
| `serbatoi[N].ancorato_terra` | boolean | Ancorato a terra | `true` / `false` |

**Esempio d'uso (singolo):**
```handlebars
{{#if (eq serbatoi.length 1)}}
È presente un serbatoio {{serbatoi[0].marca}} {{serbatoi[0].modello}}, anno {{serbatoi[0].anno}},
con capacità di {{serbatoi[0].volume}} litri e pressione massima di {{serbatoi[0].ps_pressione_max}} bar.
Il valore PS × V è di {{serbatoi[0].ps_x_volume}} bar·litri, pertanto
{{#if (requiresVerifica serbatoi[0].ps_pressione_max serbatoi[0].volume)}}
  è soggetto a verifica periodica INAIL.
{{else}}
  non è soggetto a verifica periodica.
{{/if}}
{{/if}}
```

**Esempio d'uso (multipli):**
```handlebars
{{#if (gt serbatoi.length 1)}}
Sono presenti {{serbatoi.length}} serbatoi:
{{#each serbatoi}}
- {{codice}}: {{marca}} {{modello}}, {{volume}}L, {{ps_pressione_max}} bar, categoria {{categoria_ped}}
{{/each}}
{{/if}}
```

---

## ⚙️ Compressori

Array di compressori installati.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `compressori.length` | number | Numero totale compressori | `1` |
| `compressori[N].codice` | string | Codice identificativo | `C1` |
| `compressori[N].marca` | string | Marca | `Kaeser` |
| `compressori[N].modello` | string | Modello | `ASD 37` |
| `compressori[N].volume_aria_prodotto` | number | FAD in l/min | `3700` |
| `compressori[N].pressione_max` | number | Pressione bar | `13` |
| `compressori[N].anno` | number | Anno | `2018` |
| `compressori[N].numero_fabbrica` | string | Nr. fabbrica | `A12345` |
| `compressori[N].tipo_giri` | string | Tipo regolazione | `fissi`, `variabili (inverter)` |

**Esempio d'uso:**
```handlebars
{{#if (eq compressori.length 1)}}
Il compressore {{compressori[0].marca}} {{compressori[0].modello}}, anno {{compressori[0].anno}},
produce {{compressori[0].volume_aria_prodotto}} l/min di aria compressa a {{compressori[0].pressione_max}} bar.
{{#if (contains compressori[0].tipo_giri 'inverter')}}
Il compressore è dotato di sistema di regolazione a giri variabili (inverter), che garantisce
significativi risparmi energetici adattando la produzione al reale fabbisogno.
{{/if}}
{{else}}
Sono installati {{compressori.length}} compressori con produzione complessiva di
{{sum compressori 'volume_aria_prodotto'}} l/min.
{{/if}}
```

---

## 🔧 Disoleatori

Array di disoleatori associati ai compressori.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `disoleatori.length` | number | Numero disoleatori | `1` |
| `disoleatori[N].codice` | string | Codice | `C1.1` |
| `disoleatori[N].compressore_associato` | string | Compressore collegato | `C1` |
| `disoleatori[N].marca` | string | Marca | `Kaeser` |
| `disoleatori[N].modello` | string | Modello | `OSD 35` |
| `disoleatori[N].volume` | number | Volume litri | `35` |
| `disoleatori[N].ps_pressione_max` | number | PS bar | `16` |
| `disoleatori[N].categoria_ped` | string | Categoria PED | `I`, `II` |

**Esempio d'uso:**
```handlebars
{{#if (gt disoleatori.length 0)}}
{{#if (eq disoleatori.length 1)}}
È presente un disoleatore {{disoleatori[0].marca}} {{disoleatori[0].modello}},
volume {{disoleatori[0].volume}} litri, associato al compressore {{disoleatori[0].compressore_associato}}.
{{else}}
Sono presenti {{disoleatori.length}} disoleatori per la raccolta delle condense.
{{/if}}
{{/if}}
```

---

## ❄️ Essiccatori

Array di essiccatori per il trattamento dell'aria compressa.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `essiccatori.length` | number | Numero essiccatori | `0` |
| `essiccatori[N].codice` | string | Codice | `E1` |
| `essiccatori[N].marca` | string | Marca | `Pneumatech` |
| `essiccatori[N].modello` | string | Modello | `PD 100` |
| `essiccatori[N].volume_aria_trattata` | number | Q l/min | `1000` |
| `essiccatori[N].ps_pressione_max` | number | PS bar | `16` |
| `essiccatori[N].anno` | number | Anno | `2019` |

**Esempio d'uso:**
```handlebars
{{#if (gt essiccatori.length 0)}}
Per il controllo dell'umidità è installato un sistema di essiccazione composto da
{{#if (eq essiccatori.length 1)}}
essiccatore {{essiccatori[0].marca}} {{essiccatori[0].modello}}, in grado di trattare
{{essiccatori[0].volume_aria_trattata}} l/min di aria compressa.
{{else}}
{{essiccatori.length}} essiccatori.
{{/if}}
{{else}}
Non sono presenti essiccatori. Il controllo dell'umidità è affidato ad altri sistemi di trattamento.
{{/if}}
```

---

## 🌡️ Scambiatori

Array di scambiatori termici associati agli essiccatori.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `scambiatori.length` | number | Numero scambiatori | `0` |
| `scambiatori[N].codice` | string | Codice | `E1.1` |
| `scambiatori[N].essiccatore_associato` | string | Essiccatore collegato | `E1` |
| `scambiatori[N].volume` | number | Volume litri | `30` |
| `scambiatori[N].ps_pressione_max` | number | PS bar | `16` |

---

## 🔲 Filtri

Array di filtri aria.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `filtri.length` | number | Numero filtri | `0` |
| `filtri[N].codice` | string | Codice | `F1` |
| `filtri[N].marca` | string | Marca | `Parker` |
| `filtri[N].modello` | string | Modello | `HF 20` |
| `filtri[N].anno` | number | Anno | `2020` |

**Esempio d'uso:**
```handlebars
{{#if (gt filtri.length 0)}}
Il sistema dispone di {{filtri.length}} filtro{{#if (gt filtri.length 1)}}i{{/if}}
per il trattamento dell'aria compressa.
{{/if}}
```

---

## 📦 Recipienti Filtro

Array di recipienti associati ai filtri.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `recipienti_filtro.length` | number | Numero recipienti | `0` |
| `recipienti_filtro[N].codice` | string | Codice | `F1.1` |
| `recipienti_filtro[N].filtro_associato` | string | Filtro collegato | `F1` |
| `recipienti_filtro[N].volume` | number | Volume litri | `20` |
| `recipienti_filtro[N].ps_pressione_max` | number | PS bar | `16` |

---

## 💧 Separatori

Array di separatori per la raccolta condense.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `separatori.length` | number | Numero separatori | `0` |
| `separatori[N].codice` | string | Codice | `SEP1` |
| `separatori[N].marca` | string | Marca | `Bekomat` |
| `separatori[N].modello` | string | Modello | `12` |
| `separatori[N].anno` | number | Anno | `2020` |

---

## 🔒 Valvole di Sicurezza

Array di valvole di sicurezza installate.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `valvole_sicurezza.length` | number | Numero valvole | `1` |
| `valvole_sicurezza[N].codice` | string | Codice | `S1` |
| `valvole_sicurezza[N].numero_fabbrica` | string | Nr. fabbrica | `VS-123` |
| `valvole_sicurezza[N].pressione_taratura` | number | Ptar bar | `13` |
| `valvole_sicurezza[N].volume_aria_scaricato` | number | Qmax l/min | `5000` |
| `valvole_sicurezza[N].portata_max_elaborabile` | number | kg/h | `300` |
| `valvole_sicurezza[N].portata_scaricata` | number | kg/h | `250` |
| `valvole_sicurezza[N].apparecchiatura_protetta` | string | Recipiente protetto | `Serbatoio S1` |
| `valvole_sicurezza[N].ps_recipiente` | number | PS recipiente bar | `13` |

**Esempio d'uso:**
```handlebars
{{#if (gt valvole_sicurezza.length 0)}}
{{#if (eq valvole_sicurezza.length 1)}}
È installata una valvola di sicurezza tarata a {{valvole_sicurezza[0].pressione_taratura}} bar,
proteggente il {{valvole_sicurezza[0].apparecchiatura_protetta}}.
{{else}}
Sono installate {{valvole_sicurezza.length}} valvole di sicurezza.
{{/if}}
{{/if}}
```

---

## 🔗 Collegamenti

Mappatura dei collegamenti tra compressori e serbatoi.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `collegamenti_compressori_serbatoi` | object | Mappa compressore → serbatoi | `{ 'C1': ['S1', 'S2'] }` |

**Esempio d'uso:**
```handlebars
Il compressore C1 è collegato ai serbatoi: {{join collegamenti_compressori_serbatoi.C1 ', '}}.
```

---

## 📊 Spessimetrica

Array di codici apparecchiature sottoposte a verifica ultrasonica spessimetrica.

| Placeholder | Tipo | Descrizione | Esempio |
|-------------|------|-------------|---------|
| `spessimetrica` | array | Codici apparecchiature | `['S1', 'C1.1']` |
| `spessimetrica.length` | number | Numero apparecchiature | `2` |

**Esempio d'uso:**
```handlebars
{{#if (gt spessimetrica.length 0)}}
Le seguenti apparecchiature sono sottoposte a verifica ultrasonica spessimetrica:
{{join spessimetrica ', '}}.
{{/if}}
```

---

## 🚩 Flags

Flags booleani per sezioni condizionali del documento.

| Placeholder | Tipo | Descrizione |
|-------------|------|-------------|
| `flags.locale_dedicato` | boolean | Locale dedicato presente |
| `flags.accesso_vietato` | boolean | Accesso vietato configurato |
| `flags.verifiche_spessimetriche` | boolean | Verifiche spessimetriche richieste |
| `flags.revisione_dichiarata` | boolean | Revisione dichiarazione messa in servizio |

**Esempio d'uso:**
```handlebars
{{#if flags.revisione_dichiarata}}
Il presente documento costituisce revisione della dichiarazione di messa in servizio...
{{/if}}
```

---

## 📋 Apparecchiature Aggregate

Lista unificata di tutte le apparecchiature (serbatoi, compressori, disoleatori, ecc.) per tabelle riepilogative.

| Placeholder | Tipo | Descrizione |
|-------------|------|-------------|
| `apparecchiature.length` | number | Numero totale apparecchiature |
| `apparecchiature[N].codice` | string | Codice univoco |
| `apparecchiature[N].tipo` | string | `serbatoio`, `compressore`, `disoleatore`, ecc. |
| `apparecchiature[N].descrizione` | string | Descrizione completa |
| `apparecchiature[N].marca_modello` | string | Marca e modello |
| `apparecchiature[N].capacita` | string | Volume/Portata |
| `apparecchiature[N].pressione` | string | PS in bar |
| `apparecchiature[N].temperatura` | string | TS in °C |
| `apparecchiature[N].categoria` | string | Categoria PED |
| `apparecchiature[N].anno` | string | Anno fabbricazione |
| `apparecchiature[N].numero_fabbrica` | string | Numero fabbrica |
| `apparecchiature[N].richiede_verifica` | boolean | Se soggetto a verifica |

**Esempio d'uso (tabella riepilogativa):**
```handlebars
{{#each apparecchiature}}
| {{codice}} | {{tipo}} | {{marca_modello}} | {{capacita}} | {{categoria}} |
{{/each}}
```

---

## 🔧 Helper Disponibili

Oltre ai placeholder, puoi usare questi **helper** per logica e formattazione:

### Comparazioni
- `{{#if (eq a b)}}` - uguale
- `{{#if (gt a b)}}` - maggiore
- `{{#if (gte a b)}}` - maggiore o uguale
- `{{#if (lt a b)}}` - minore
- `{{#if (lte a b)}}` - minore o uguale

### Logica
- `{{#if (and a b)}}` - AND logico
- `{{#if (or a b)}}` - OR logico
- `{{#if (not a)}}` - NOT logico

### Calcoli
- `{{psXvolume ps volume}}` - Calcola PS × V
- `{{requiresVerifica ps volume}}` - Verifica se PS×V > 8000
- `{{sum array 'field'}}` - Somma campo in array

### Formattazione
- `{{formatDate date}}` - Formatta data in italiano
- `{{formatIndirizzo indirizzo}}` - Formatta indirizzo completo
- `{{join array ', '}}` - Unisce array con separatore

### Classificazione
- `{{tipoVerifica ps volume}}` - Restituisce tipo verifica (INAIL, Dichiarazione)
- `{{categoriaPed ps volume}}` - Calcola categoria PED

### Speciali
- `{{pageBreak}}` - Inserisce interruzione di pagina

**Esempio combinato:**
```handlebars
{{#each serbatoi}}
Il serbatoio {{codice}} ha PS×V = {{psXvolume ps_pressione_max volume}} bar·litri.
{{#if (requiresVerifica ps_pressione_max volume)}}
  Verifica richiesta: {{tipoVerifica ps_pressione_max volume}}
{{else}}
  Non soggetto a verifica periodica.
{{/if}}
{{/each}}
```

---

## 📊 Inserimento Tabelle

Le tabelle vengono inserite direttamente come HTML nell'editor e supportano sia contenuto statico che dinamico tramite Handlebars.

### Tabelle Statiche

Usa il pulsante **"Inserisci Tabella"** nell'editor per creare tabelle visivamente. Il dialog genera automaticamente HTML che sarà convertito in tabella DOCX durante l'esportazione.

Le celle supportano formattazione completa (grassetto, corsivo, colori, ecc.) tramite l'editor WYSIWYG.

### Tabelle Dinamiche con Handlebars

Per creare tabelle che popolano automaticamente i dati, puoi inserire direttamente HTML con placeholder Handlebars:

**Esempio - Tabella Serbatoi:**
```handlebars
<table>
  <thead>
    <tr>
      <th>Codice</th>
      <th>Marca</th>
      <th>Volume (L)</th>
      <th>PS (bar)</th>
      <th>Categoria PED</th>
    </tr>
  </thead>
  <tbody>
    {{#each serbatoi}}
    <tr>
      <td>{{this.codice}}</td>
      <td><strong>{{this.marca}}</strong> {{this.modello}}</td>
      <td>{{this.volume}}</td>
      <td>{{this.ps_pressione_max}}</td>
      <td>{{this.categoria_ped}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
```

**Esempio - Tabella Condizionale:**
```handlebars
{{#if (gt compressori.length 0)}}
<table>
  <thead>
    <tr>
      <th>Codice</th>
      <th>Marca/Modello</th>
      <th>Produzione (l/min)</th>
      <th>Pressione (bar)</th>
    </tr>
  </thead>
  <tbody>
    {{#each compressori}}
    <tr>
      <td>{{this.codice}}</td>
      <td>{{this.marca}} {{this.modello}}</td>
      <td>{{this.volume_aria_prodotto}}</td>
      <td>{{this.pressione_max}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
{{else}}
<p>Non sono presenti compressori.</p>
{{/if}}
```

### Formattazione Celle

Le celle supportano formattazione HTML standard:
- **Grassetto**: `<strong>testo</strong>` oppure `<b>testo</b>`
- **Corsivo**: `<em>testo</em>` oppure `<i>testo</i>`
- **Sottolineato**: `<u>testo</u>`
- **Colore**: `<span style="color: #FF0000">testo rosso</span>`

**Esempio con formattazione:**
```handlebars
<table>
  <tbody>
    {{#each valvole_sicurezza}}
    <tr>
      <td><strong>{{this.codice}}</strong></td>
      <td>{{#if (gte this.pressione_taratura 15)}}<span style="color: #FF0000">{{this.pressione_taratura}} bar</span>{{else}}{{this.pressione_taratura}} bar{{/if}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
```

---

## 💡 Tips & Best Practices

### 1. Controlla Sempre l'Esistenza con `.length`

Prima di accedere a `[0]`, verifica che l'array non sia vuoto:

```handlebars
{{#if (gt serbatoi.length 0)}}
  Il primo serbatoio è {{serbatoi[0].marca}}.
{{else}}
  Non sono presenti serbatoi.
{{/if}}
```

### 2. Usa Helper per Calcoli

Non fare calcoli manuali, usa gli helper:

```handlebars
❌ Sbagliato: PS×V = {{serbatoi[0].ps_pressione_max}} × {{serbatoi[0].volume}}
✅ Corretto: PS×V = {{psXvolume serbatoi[0].ps_pressione_max serbatoi[0].volume}} bar·litri
```

### 3. Gestisci Singolare/Plurale

Usa condizioni per gestire correttamente singolare e plurale:

```handlebars
{{#if (eq compressori.length 1)}}
  Il compressore produce...
{{else}}
  I {{compressori.length}} compressori producono...
{{/if}}
```

### 4. Formatta Date e Indirizzi

Usa helper di formattazione per output professionale:

```handlebars
✅ Data: {{formatDate data_sopralluogo}}
✅ Indirizzo: {{formatIndirizzo cliente.sede_legale}}
```

### 5. Usa Blocchi Condizionali per Sezioni Complesse

Per testi che cambiano in base a condizioni multiple, usa il Visual Condition Builder invece di `{{#if}}` annidati.

---

## 📖 Vedere Anche

- [Guida Blocchi Condizionali](TEMPLATE_CONDITIONAL_BLOCKS.md) - Come creare testi dinamici
- [Condizioni Avanzate AND/OR](TEMPLATE_ADVANCED_CONDITIONS.md) - Logica complessa
- [Helper Handlebars](../src/utils/templateHelpers.ts) - Codice sorgente helper

---

**Ultima revisione:** Dicembre 2024
**Versione:** 1.0
