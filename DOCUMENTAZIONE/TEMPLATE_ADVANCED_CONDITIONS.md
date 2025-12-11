# Condizioni Avanzate con AND/OR - Guida Completa

## Introduzione

Il **Visual Condition Builder** permette di creare condizioni complesse combinando più criteri con operatori logici **AND** e **OR**, il tutto tramite un'interfaccia visuale senza scrivere codice.

## Interfaccia Visual Condition Builder

### Anatomia del Builder

```
┌─────────────────────────────────────────────┐
│ Condizione Principale                       │
│ ┌─────────┬──────────┬─────────┐           │
│ │ Campo   │ Operatore│ Valore  │           │
│ └─────────┴──────────┴─────────┘           │
│                                             │
│ Operatore Logico: [AND (E)] [OR (O)]       │
│                                             │
│ ┌─ Condizioni Aggiuntive ────────────────┐ │
│ │ [AND] Condizione 2                      │ │
│ │ [AND] Condizione 3                      │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [Aggiungi Altra Condizione] [Applica]      │
└─────────────────────────────────────────────┘
```

### Workflow

1. **Crea condizione principale** - La prima condizione è sempre obbligatoria
2. **Aggiungi condizioni aggiuntive** - Clicca "+ Aggiungi Altra Condizione"
3. **Scegli operatore logico** - Toggle AND/OR per combinare le condizioni
4. **Preview in tempo reale** - Vedi la condizione in formato leggibile
5. **Applica** - Salva la condizione configurata

## Operatori Logici

### AND (E) - Tutte le condizioni devono essere vere

**Uso:** Quando vuoi che **tutte** le condizioni siano soddisfatte contemporaneamente.

**Esempio logico:**
```
serbatoi.length > 0 AND ps_x_volume > 8000
→ TRUE solo se ci sono serbatoi E il PS×V è maggiore di 8000
```

### OR (O) - Almeno una condizione deve essere vera

**Uso:** Quando vuoi che **almeno una** delle condizioni sia soddisfatta.

**Esempio logico:**
```
compressori.length = 0 OR essiccatori.length = 0
→ TRUE se non ci sono compressori OPPURE non ci sono essiccatori (o entrambi)
```

## Esempi Pratici

### Esempio 1: Serbatoi Soggetti a Verifica (AND)

**Caso d'uso:** Mostrare testo solo per serbatoi che richiedono verifica periodica

**Blocco:** `serbatoi_verifica_obbligatoria`

**Condizione Visibilità Blocco:**
```
Condizione Principale:
- Campo: serbatoi.length
- Operatore: maggiore di
- Valore: 0

Operatore Logico: AND

Condizione 2:
- Campo: serbatoi[0].ps_x_volume
- Operatore: maggiore di
- Valore: 8000
```

**Logica:** Il blocco appare solo se:
- Ci sono serbatoi (length > 0) **E**
- Il primo serbatoio ha PS×V > 8000

**Testo Variante:**
```
I serbatoi installati sono soggetti a verifica periodica ai sensi del D.M. 329/2004
in quanto PS×V > 8000 bar·litri. Le verifiche vengono eseguite dall'INAIL secondo
le scadenze previste dalla normativa.
```

---

### Esempio 2: Locale Dedicato o Separato (OR)

**Caso d'uso:** Paragrafo sulla sicurezza dell'installazione se locale dedicato O accesso vietato

**Blocco:** `sicurezza_locale_installazione`

**Condizione Visibilità Blocco:**
```
Condizione Principale:
- Campo: dati_impianto.locale_dedicato
- Operatore: uguale a
- Valore: true

Operatore Logico: OR

Condizione 2:
- Campo: dati_impianto.accesso_locale_vietato
- Operatore: uguale a
- Valore: true
```

**Logica:** Il blocco appare se:
- Locale è dedicato **OPPURE**
- Accesso è vietato a non autorizzati

**Testo Variante:**
```
L'impianto rispetta i requisiti di sicurezza per l'installazione: il locale è dedicato
esclusivamente all'impianto di aria compressa e/o l'accesso è vietato al personale non
autorizzato mediante apposita segnaletica e chiusura a chiave.
```

---

### Esempio 3: Impianto Complesso (AND Multiplo)

**Caso d'uso:** Descrizione solo per impianti con compressori, serbatoi E essiccatori

**Blocco:** `descrizione_impianto_completo`

**Condizione Visibilità Blocco:**
```
Condizione Principale:
- Campo: compressori.length
- Operatore: maggiore di
- Valore: 0

Operatore Logico: AND

Condizione 2:
- Campo: serbatoi.length
- Operatore: maggiore di
- Valore: 0

Condizione 3:
- Campo: essiccatori.length
- Operatore: maggiore di
- Valore: 0
```

**Logica:** Blocco appare solo se ci sono:
- Compressori **E**
- Serbatoi **E**
- Essiccatori

**Testo Variante:**
```
L'impianto è costituito da un sistema completo di produzione e trattamento aria compressa,
comprendente gruppo compressore, accumulo aria in serbatoio e sistema di essiccazione per
il controllo dell'umidità. Tale configurazione garantisce aria compressa di qualità per le
utenze industriali.
```

---

### Esempio 4: Apparecchiature Assenti (OR Multiplo)

**Caso d'uso:** Warning se mancano apparecchiature critiche

**Blocco:** `warning_apparecchiature_mancanti`

**Condizione Visibilità Blocco:**
```
Condizione Principale:
- Campo: valvole_sicurezza.length
- Operatore: uguale a
- Valore: 0

Operatore Logico: OR

Condizione 2:
- Campo: disoleatori.length
- Operatore: uguale a
- Valore: 0

Condizione 3:
- Campo: filtri.length
- Operatore: uguale a
- Valore: 0
```

**Logica:** Warning appare se manca **almeno una** delle seguenti:
- Valvole di sicurezza **O**
- Disoleatori **O**
- Filtri

**Testo Variante:**
```
⚠️ ATTENZIONE: L'impianto presenta carenze in termini di apparecchiature di sicurezza e/o
trattamento. Si raccomanda l'installazione delle apparecchiature mancanti per garantire il
corretto funzionamento e la sicurezza dell'impianto.
```

---

### Esempio 5: Revisione Complessa (AND con Soglie)

**Caso d'uso:** Testo specifico per revisione con condizioni multiple

**Blocco:** `revisione_speciale`

**Condizione Visibilità Blocco:**
```
Condizione Principale:
- Campo: flags.revisione_dichiarata
- Operatore: uguale a
- Valore: true

Operatore Logico: AND

Condizione 2:
- Campo: serbatoi[0].anno
- Operatore: minore di
- Valore: 2010

Condizione 3:
- Campo: serbatoi[0].volume
- Operatore: maggiore o uguale a
- Valore: 500
```

**Logica:** Blocco per revisioni con:
- Flag revisione dichiarata **E**
- Serbatoio ante-2010 **E**
- Volume ≥ 500 litri

**Testo Variante:**
```
La presente relazione costituisce revisione della dichiarazione di messa in servizio per
apparecchiature datate (ante 2010) con capacità significativa (≥ 500 litri). Data l'anzianità
dell'impianto, si raccomanda particolare attenzione alle verifiche spessimetriche e alle
condizioni di manutenzione.
```

---

### Esempio 6: Testo Dinamico Compressori (Varianti con AND/OR)

**Caso d'uso:** Testo diverso per compressori a giri fissi vs variabili con alta produzione

**Blocco:** `descrizione_compressori_avanzata`

**Variante 1 - "Alta Produzione Inverter":**

**Condizione:**
```
Condizione Principale:
- Campo: compressori[0].tipo_giri
- Operatore: contiene
- Valore: inverter

Operatore Logico: AND

Condizione 2:
- Campo: compressori[0].volume_aria_prodotto
- Operatore: maggiore di
- Valore: 5000
```

**Testo:**
```
Il compressore {{compressori[0].marca}} {{compressori[0].modello}} è dotato di inverter per
la regolazione continua della velocità, con produzione di {{compressori[0].volume_aria_prodotto}}
l/min. Questa tecnologia garantisce significativi risparmi energetici adattando la produzione
al reale fabbisogno.
```

**Variante 2 - "Standard":**

**Condizione:** *(nessuna - default)*

**Testo:**
```
Il compressore {{compressori[0].marca}} {{compressori[0].modello}} produce
{{compressori[0].volume_aria_prodotto}} l/min di aria compressa.
```

---

## Strategie di Design

### Quando Usare AND

✅ **Requisiti multipli obbligatori**
- "Mostra solo se locale_dedicato = true E accesso_vietato = true"
- Tutte le condizioni devono essere soddisfatte

✅ **Soglie combinate**
- "Volume > 25 E Pressione > 12"
- "Anno < 2010 E ps_x_volume > 8000"

✅ **Verifiche di completezza**
- "compressori.length > 0 E serbatoi.length > 0 E valvole_sicurezza.length > 0"

### Quando Usare OR

✅ **Alternative valide**
- "Locale dedicato O accesso vietato" (almeno uno dei due va bene)
- "tipo = 'A' O tipo = 'B' O tipo = 'C'"

✅ **Warning/Alert**
- "Mostra warning se manca A O manca B O manca C"

✅ **Casi speciali**
- "Applica regola speciale se condizione_1 O condizione_2"

### Combinare AND e OR

⚠️ **IMPORTANTE:** Attualmente il sistema supporta UN solo operatore logico per blocco.

**Supportato:**
```
A AND B AND C
A OR B OR C
```

**Non ancora supportato:**
```
(A AND B) OR (C AND D)
A AND (B OR C)
```

Per casi complessi, crea **blocchi separati** con condizioni più semplici.

---

## Tips Avanzati

### 1. Ordine di Valutazione

Le condizioni vengono valutate nell'ordine:
1. Condizione principale
2. Condizione 2 (combinata con operatore logico)
3. Condizione 3 (combinata con operatore logico)
4. ...

**Con AND:** Se una condizione è FALSE, la valutazione si interrompe (short-circuit).
**Con OR:** Se una condizione è TRUE, la valutazione si interrompe.

### 2. Performance

**Ordina le condizioni per probabilità:**
- **AND:** Metti le condizioni più restrittive (meno probabili di essere TRUE) per prime
- **OR:** Metti le condizioni più comuni (più probabili di essere TRUE) per prime

**Esempio AND ottimizzato:**
```
❌ Lento:
  flags.revisione_dichiarata = true (raro, 5%)
  AND serbatoi.length > 0 (comune, 95%)

✅ Veloce:
  serbatoi.length > 0 (comune, 95%)
  AND flags.revisione_dichiarata = true (raro, 5%)
```

### 3. Debugging Condizioni

Usa la **preview in tempo reale** nel builder per verificare la condizione:

```
Anteprima Condizione:
serbatoi.length > 0
  AND
serbatoi[0].ps_x_volume > 8000
  AND
flags.verifiche_spessimetriche = true
```

Se la preview è corretta, la condizione funzionerà nel template.

### 4. Gestione Campi Null/Undefined

**isEmpty / isNotEmpty** gestiscono automaticamente:
- `null`
- `undefined`
- `""` (stringa vuota)
- `[]` (array vuoto)

**Esempio sicuro:**
```
Condizione: essiccatori.length
Operatore: isNotEmpty

→ TRUE se array esiste e ha elementi
→ FALSE se null, undefined, o []
```

### 5. Campi Array

Per array di apparecchiature, accedi al primo elemento con `[0]`:

```
serbatoi[0].volume
compressori[0].marca
valvole_sicurezza[0].pressione_taratura
```

**Nota:** Se il blocco dipende da un elemento array, aggiungi sempre una condizione di safety:

```
Condizione Principale:
  serbatoi.length > 0    ← Safety check

AND Condizione 2:
  serbatoi[0].volume > 25  ← Accesso sicuro
```

---

## Esempi di Condizioni per Copy-Paste

### Serbatoi con PS×V alto

```yaml
campo: serbatoi.length
operatore: maggiore di
valore: 0
AND
campo: serbatoi[0].ps_x_volume
operatore: maggiore di
valore: 8000
```

### Compressori multipli con alta produzione

```yaml
campo: compressori.length
operatore: maggiore di
valore: 1
AND
campo: compressori[0].volume_aria_prodotto
operatore: maggiore o uguale a
valore: 3000
```

### Impianto vecchio o grande

```yaml
campo: serbatoi[0].anno
operatore: minore di
valore: 2010
OR
campo: serbatoi[0].volume
operatore: maggiore o uguale a
valore: 1000
```

### Warning apparecchiature mancanti

```yaml
campo: valvole_sicurezza
operatore: è vuoto
OR
campo: disoleatori
operatore: è vuoto
OR
campo: filtri
operatore: è vuoto
```

### Locale sicuro

```yaml
campo: dati_impianto.locale_dedicato
operatore: uguale a
valore: true
AND
campo: dati_impianto.accesso_locale_vietato
operatore: uguale a
valore: true
AND
campo: dati_impianto.lontano_materiale_infiammabile
operatore: uguale a
valore: true
```

---

## Troubleshooting

### "La condizione non si attiva"

1. **Verifica i valori:** I dati reali corrispondono ai valori nella condizione?
2. **Controlla l'operatore:** Stai usando `uguale a` quando serve `maggiore di`?
3. **Tipo di dato:** Confronti numero con stringa? (es: `1` vs `"1"`)

### "Con AND nessuna variante viene selezionata"

Controlla che **tutte** le condizioni siano soddisfatte. Anche una sola FALSE rende tutto FALSE.

**Debug:** Rimuovi temporaneamente tutte le condizioni tranne una, testa, poi aggiungi le altre una alla volta.

### "Con OR viene sempre selezionata la stessa variante"

Ordine varianti importante! La prima con condizione TRUE vince. Riordina le varianti mettendo quelle più specifiche per prime.

---

## Roadmap Future

- [ ] Supporto parentesi: `(A AND B) OR (C AND D)`
- [ ] NOT operator: `NOT (A OR B)`
- [ ] Condizioni tra campi: `serbatoi[0].volume > serbatoi[1].volume`
- [ ] Template riutilizzabili di condizioni comuni
- [ ] Test condizioni con dati reali nell'editor

---

**Hai domande su condizioni specifiche?** Consulta la [Guida Base](TEMPLATE_CONDITIONAL_BLOCKS.md) o contatta l'amministratore.
