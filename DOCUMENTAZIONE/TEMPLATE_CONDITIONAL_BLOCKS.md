# Blocchi Condizionali nei Template - Guida Utente

## Introduzione

I **blocchi condizionali** permettono di creare paragrafi dinamici nei template che si adattano automaticamente ai dati della pratica. Ad esempio:
- "il compressore" vs "i compressori" (in base al numero)
- "Il serbatoio richiede verifica" vs "Il serbatoio è escluso da verifica" (in base al calcolo PS×V)
- Mostrare/nascondere interi paragrafi in base a configurazione impianto

## Quando Usare Blocchi Condizionali

✅ **USA blocchi condizionali quando:**
- Il testo deve cambiare in base al numero di apparecchiature (singolare/plurale)
- Devi mostrare informazioni diverse in base a valori soglia (es: PS×V > 8000)
- Vuoi mostrare/nascondere paragrafi interi in base a flag booleani
- Serve gestire casi "nessuno/uno/molti" per apparecchiature

❌ **NON usare blocchi condizionali per:**
- Semplici placeholder (usa `{{nome_campo}}`)
- Cicli su liste (usa `{{#each lista}}...{{/each}}`)
- Formattazione testo (usa toolbar WYSIWYG)

## Come Creare un Blocco Condizionale

### Passo 1: Aprire il Wizard

1. Nel Template Editor, clicca sul pulsante **"Blocco Condizionale"** nella toolbar
2. Si aprirà un wizard in 3 step

### Passo 2: Configurazione Blocco

**ID Blocco:** Identificatore univoco (es: `compressori_intro`, `serbatoi_verifica`)

**Condizione Visibilità (opzionale):** Se vuoi che l'intero blocco appaia solo se una condizione è vera:
- Campo: `compressori.length`
- Operatore: `maggiore di`
- Valore: `0`
- → Il blocco appare solo se ci sono compressori

### Passo 3: Aggiungere Varianti

Ogni blocco deve avere almeno **2 varianti** (solitamente):

#### Esempio: Compressori Singolare/Plurale

**Variante 1 - Singolare:**
- Etichetta: `Singolare`
- Testo: `Il compressore {{compressori[0].marca}} {{compressori[0].modello}} produce {{compressori[0].volume_aria_prodotto}} l/min di aria compressa.`
- Condizione:
  - Campo: `compressori.length`
  - Operatore: `uguale a`
  - Valore: `1`

**Variante 2 - Plurale:**
- Etichetta: `Plurale`
- Testo: `I compressori installati producono complessivamente {{sum compressori 'volume_aria_prodotto'}} l/min di aria compressa.`
- Condizione:
  - Campo: `compressori.length`
  - Operatore: `maggiore di`
  - Valore: `1`

**Variante 3 - Nessuno (default):**
- Etichetta: `Nessuno`
- Testo: `Non sono presenti compressori nell'impianto.`
- Condizione: *vuota*
- ✅ Marca come **default**

### Passo 4: Riepilogo e Salvataggio

Rivedi le impostazioni e clicca **"Salva Blocco"**. Il blocco verrà inserito nel template come:

```
[[CONDITIONAL:compressori_intro]]
```

## Operatori Disponibili

| Operatore | Descrizione | Esempio |
|-----------|-------------|---------|
| `uguale a` | Campo === valore | `compressori.length = 1` |
| `diverso da` | Campo !== valore | `tipo_impianto ≠ "mobile"` |
| `maggiore di` | Campo > valore | `ps_x_volume > 8000` |
| `maggiore o uguale a` | Campo >= valore | `volume >= 25` |
| `minore di` | Campo < valore | `anno < 2010` |
| `minore o uguale a` | Campo <= valore | `pressione_max <= 13` |
| `contiene` | Array/stringa include valore | `aria_aspirata contiene "Esterno"` |
| `è vuoto` | Campo null/undefined/[] | `essiccatori è vuoto` |
| `non è vuoto` | Campo has value | `valvole_sicurezza non è vuoto` |

## Esempi Pratici

### Esempio 1: Serbatoi con Verifica

**Caso d'uso:** Testo diverso per serbatoi soggetti/esclusi da verifica

**Blocco ID:** `serbatoi_verifica_status`

**Varianti:**

1. **Tutti Soggetti:**
   - Condizione: `serbatoi[0].ps_x_volume > 8000` (assumendo tutti simili)
   - Testo: `Tutti i serbatoi sono soggetti a verifica periodica ai sensi del D.M. 329/2004 in quanto PS×V > 8000.`

2. **Tutti Esclusi:**
   - Condizione: `serbatoi[0].ps_x_volume <= 8000`
   - Testo: `I serbatoi non sono soggetti a verifica periodica in quanto PS×V ≤ 8000.`

3. **Misto (default):**
   - Nessuna condizione
   - Testo: `Alcuni serbatoi sono soggetti a verifica mentre altri sono esclusi, come dettagliato nella tabella di caratterizzazione.`

### Esempio 2: Locale Dedicato

**Caso d'uso:** Paragrafo appare solo se locale è dedicato

**Blocco ID:** `locale_dedicato_descrizione`

**Condizione Visibilità Blocco:**
- Campo: `dati_impianto.locale_dedicato`
- Operatore: `uguale a`
- Valore: `true`

**Variante Unica:**
- Etichetta: `Descrizione`
- Testo: `L'impianto è installato in locale dedicato, separato da altri ambienti, con accesso vietato a personale non autorizzato. L'aria aspirata proviene dall'esterno dell'edificio e le condense sono raccolte mediante disoleatori.`
- Condizione: *nessuna* (sempre mostrata se blocco visibile)

### Esempio 3: Valvole di Sicurezza

**Caso d'uso:** Singolare/plurale con dettaglio taratura

**Blocco ID:** `valvole_sicurezza_intro`

**Varianti:**

1. **Singolare:**
   - Condizione: `valvole_sicurezza.length = 1`
   - Testo: `È presente una valvola di sicurezza tarata a {{valvole_sicurezza[0].pressione_taratura}} bar, proteggente il {{valvole_sicurezza[0].apparecchiatura_protetta}}.`

2. **Plurale:**
   - Condizione: `valvole_sicurezza.length > 1`
   - Testo: `Sono presenti {{valvole_sicurezza.length}} valvole di sicurezza, come dettagliato nella tabella seguente.`

3. **Nessuna:**
   - Nessuna condizione (default)
   - Testo: `Non sono presenti valvole di sicurezza nell'impianto.`

## Path dei Campi Comuni

### Dati Generali
- `cliente.ragione_sociale`
- `data_sopralluogo`
- `nome_tecnico`

### Contatori Apparecchiature
- `serbatoi.length` (numero serbatoi)
- `compressori.length`
- `disoleatori.length`
- `essiccatori.length`
- `valvole_sicurezza.length`

### Flag Booleani
- `dati_impianto.locale_dedicato` (true/false)
- `dati_impianto.accesso_locale_vietato`
- `dati_impianto.lontano_materiale_infiammabile`
- `flags.verifiche_spessimetriche`
- `flags.revisione_dichiarata`

### Valori Apparecchiature (primo elemento)
- `serbatoi[0].volume` (litri)
- `serbatoi[0].ps_pressione_max` (bar)
- `serbatoi[0].ps_x_volume` (calcolato)
- `compressori[0].volume_aria_prodotto` (l/min)
- `compressori[0].pressione_max` (bar)

## Tips & Best Practices

### 1. **Ordine Varianti Importante**
Il sistema valuta le varianti nell'ordine in cui sono inserite. La prima variante con condizione soddisfatta viene usata.

```
✅ CORRETTO:
1. Variante "Zero" → condizione: length = 0
2. Variante "Uno" → condizione: length = 1
3. Variante "Molti" → condizione: length > 1
4. Variante "Default" → nessuna condizione

❌ ERRATO:
1. Variante "Default" → nessuna condizione (prende sempre questa!)
2. Variante "Uno" → condizione: length = 1 (mai raggiunta)
```

### 2. **Sempre una Variante Default**
Marca sempre l'ultima variante come **default** (senza condizione) per evitare blocchi vuoti se nessuna condizione match.

### 3. **Usa Placeholder nelle Varianti**
Le varianti possono contenere placeholder Handlebars normali:

```
Il compressore {{compressori[0].marca}} è del tipo {{compressori[0].tipo_giri}}.
```

### 4. **Combina con Helper**
Puoi usare helper Handlebars nelle condizioni:

```handlebars
{{#if (requiresVerifica serbatoi[0].ps_pressione_max serbatoi[0].volume)}}
  Variante "Soggetto a Verifica"
{{/if}}
```

### 5. **Test con Live Preview**
Usa la **Live Preview** per vedere immediatamente l'effetto delle condizioni con i dati di esempio.

## Troubleshooting

### "Nessuna variante valida per blocco X"
**Causa:** Nessuna condizione è soddisfatta e non c'è variante default.
**Soluzione:** Aggiungi una variante senza condizione e marcala come default.

### "Il blocco non appare"
**Causa:** La condizione di visibilità del blocco è falsa.
**Soluzione:** Verifica la condizione con i dati reali. Rimuovi la condizione se vuoi che il blocco appaia sempre.

### "Viene sempre mostrata la stessa variante"
**Causa:** La prima variante con condizione troppo generica cattura tutti i casi.
**Soluzione:** Riordina le varianti o rendi le condizioni più specifiche.

### "Campo non trovato"
**Causa:** Path del campo errato (es: `compressore.length` invece di `compressori.length`)
**Soluzione:** Verifica il path nella sezione "Path dei Campi Comuni" o usa autocomplete.

## Limiti Attuali

- ❌ **Condizioni annidate (AND/OR):** Non ancora supportate (pianificate per futuro)
- ❌ **Regex/pattern matching:** Solo operatori semplici
- ❌ **Calcoli complessi:** Usa helper Handlebars custom invece

## Roadmap Future

- [ ] Supporto AND/OR per condizioni multiple
- [ ] Condition templates riutilizzabili
- [ ] Wizard visuale per path campi (tree picker)
- [ ] Test condizioni con dati reali direttamente nell'editor
- [ ] Import/export blocchi tra template

---

**Domande?** Consulta la documentazione completa o contatta l'amministratore di sistema.
