# Script di Sincronizzazione Clienti

## sync-customers-from-excel.ts

Script per sincronizzare i clienti da file Excel MAGO al database Supabase.

### Prerequisiti

1. **File Excel:** Assicurati che il file `DOCUMENTAZIONE/ClientiDaMAGO.xlsx` esista e contenga le colonne:
   - `CustSupp` - ID cliente MAGO (external_id)
   - `CompanyName` - Ragione sociale
   - `Address` - Via e numero civico
   - `ZIPCode` - Codice postale (CAP)
   - `City` - Città
   - `County` - Codice provincia (es. MI, TO, RM)

2. **Variabili d'ambiente:** Crea un file `.env` nella root del progetto con:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Migration database:** Applica la migration per i campi indirizzo:
   ```bash
   supabase db push
   ```

### Utilizzo

#### Modalità Dry-Run (consigliata per il primo test)
```bash
npm run sync-customers:dry-run
```

Esegue lo script SENZA modificare il database. Mostra solo cosa verrebbe fatto.

#### Modalità Normale
```bash
npm run sync-customers
```

Applica le modifiche al database.

#### Modalità Verbose
```bash
npm run sync-customers:verbose
```

Mostra più dettagli durante l'esecuzione.

### Logica di Sincronizzazione

1. **Clienti con external_id:**
   - Se esiste nel DB → aggiorna SOLO i campi vuoti (merge intelligente)
   - Se non esiste → inserisce nuovo cliente

2. **Clienti senza external_id (solo nome):**
   - Se trova match esatto al 100% nel DB → merge automatico
   - Se trova match simile (>80%) → warning + inserisce come nuovo
   - Se non trova match → inserisce nuovo cliente

3. **Clienti rimossi da Excel:**
   - Rimangono attivi nel database (non vengono disattivati)

### Output

Lo script produce un riepilogo con:
- Righe totali processate
- Clienti inseriti
- Clienti aggiornati
- Clienti mergati
- Warning (clienti simili che richiedono attenzione manuale)
- Errori

### Troubleshooting

**Errore: "Variabili ambiente non configurate"**
- Assicurati di avere il file `.env` con le variabili corrette

**Errore: "File non trovato"**
- Verifica che `DOCUMENTAZIONE/ClientiDaMAGO.xlsx` esista

**Errore: "permission denied" su campi address**
- Esegui la migration: `supabase db push`

**Warning: "Cliente simile trovato"**
- Verifica manualmente i clienti segnalati
- Valuta se sono duplicati o clienti legittimamente distinti
- Se sono duplicati, usa la funzione di merge nell'interfaccia admin

### Nota Importante

⚠️ Lo script usa la **service role key** che bypassa le RLS policies. Assicurati di:
- NON committare mai il file `.env` nel repository
- Eseguire sempre un dry-run prima della sincronizzazione reale
- Fare un backup del database prima di sincronizzazioni massive
