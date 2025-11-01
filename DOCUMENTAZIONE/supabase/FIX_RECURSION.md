# FIX: Ricorsione Infinita nelle RLS Policies

## PROBLEMA IDENTIFICATO

L'errore "infinite recursion detected in policy for relation 'requests'" è causato da:

### 1. Policy Problematica (Linea 144 di rls_policies.sql)

```sql
CREATE POLICY "Utente can update own requests"
  ON requests FOR UPDATE
  WITH CHECK (
    created_by = auth.uid() AND
    assigned_to = (SELECT assigned_to FROM requests WHERE id = requests.id)
    -- ^^^^ RICORSIONE INFINITA ^^^^
  );
```

**Spiegazione:**
- Quando un UPDATE viene eseguito sulla tabella `requests`, PostgreSQL valuta TUTTE le policy
- La policy "Utente can update own requests" fa un `SELECT` dalla stessa tabella `requests`
- Questo `SELECT` ri-triggera le policy sulla tabella `requests`, creando un loop infinito

### 2. Funzione get_user_role() Non Ottimizzata

```sql
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;
```

**Problemi:**
- Viene chiamata da OGNI policy (20+ volte per singola query)
- Senza `STABLE`, PostgreSQL ri-esegue la query ogni volta
- Non utilizza caching

## SOLUZIONE IMPLEMENTATA

### File: `migrations/20250101000002_fix_rls_recursion.sql`

**Modifiche applicate:**

1. **Ottimizzazione get_user_role()**: Aggiunto `STABLE` per caching nella transazione
2. **Rimozione ricorsione**: Eliminato il SELECT ricorsivo dalla policy UPDATE
3. **Trigger di validazione**: Creato trigger `validate_utente_update()` che impedisce agli utenti di modificare `assigned_to`

### Come Applicare la Fix

#### Opzione A: Dashboard Supabase (Raccomandato)

1. Vai su: https://supabase.com/dashboard/project/uphftgpwisdiubuhohnc/editor
2. Apri il SQL Editor
3. Copia e incolla il contenuto di `migrations/20250101000002_fix_rls_recursion.sql`
4. Clicca "Run" per eseguire

#### Opzione B: Supabase CLI

```bash
# Assicurati di essere nella root del progetto
cd "C:\Users\User14\OneDrive - Studio Bertin\STUDIOBERTIN\SVILUPPO\OFF-TICKET_UT"

# Applica la migration
supabase db push
```

## VERIFICA DEL FIX

Dopo aver applicato la migration, testa:

### 1. Test Cambio Stato (Admin)

```sql
-- Questo dovrebbe funzionare senza errori
SELECT * FROM validate_status_transition(
  'request-id-here'::uuid,
  'IN_LAVORAZIONE',
  'admin',
  NULL
);
```

### 2. Test Cambio Stato via Applicazione

1. Login come admin@studiobertin.it
2. Apri una richiesta in stato "APERTA"
3. Clicca "Metti in Lavorazione"
4. Verifica che NON appaia l'errore "infinite recursion"

### 3. Test Protezione assigned_to (Utente)

```sql
-- Login come utente (non admin)
-- Prova a cambiare assigned_to di una tua richiesta
-- Dovrebbe fallire con: "Gli utenti non possono modificare il tecnico assegnato"
```

## DETTAGLI TECNICI

### Perché STABLE risolve il problema di performance?

```sql
-- PRIMA (senza STABLE): eseguito 20+ volte per query
get_user_role()

-- DOPO (con STABLE): eseguito 1 volta, poi cachato
get_user_role() STABLE
```

PostgreSQL garantisce che una funzione `STABLE`:
- Ritorna lo stesso risultato per gli stessi parametri nella stessa transazione
- Può essere cachata e non ri-eseguita

### Perché il Trigger invece della Policy?

Le policy RLS **non possono** accedere ai valori `OLD` dei record.
L'unica alternativa era:
1. SELECT ricorsivo (causa infinite loop)
2. Trigger BEFORE UPDATE (soluzione adottata)

Il trigger:
- Ha accesso a `OLD` e `NEW`
- Non causa ricorsione
- Esegue PRIMA dell'UPDATE, quindi può bloccarlo
- Usa `SECURITY DEFINER` per bypassare RLS durante il check

## PREVENZIONE FUTURA

### Best Practices per RLS Policies

1. **Mai fare SELECT sulla stessa tabella nelle policy UPDATE**
   - Usa trigger per validazioni complesse
   - Usa `SECURITY DEFINER` functions quando necessario

2. **Usa sempre STABLE/IMMUTABLE per helper functions**
   ```sql
   CREATE FUNCTION helper() RETURNS type
   LANGUAGE sql STABLE SECURITY DEFINER;
   ```

3. **Test delle policy in isolamento**
   ```sql
   -- Test singola policy
   SET ROLE authenticated;
   SET request.jwt.claim.sub = 'user-id-here';
   -- Esegui query
   ```

4. **Monitora le performance**
   ```sql
   EXPLAIN ANALYZE 
   SELECT * FROM requests WHERE id = 'xxx';
   ```

## ROLLBACK (se necessario)

Se la fix causa problemi, puoi ripristinare la policy originale:

```sql
-- Drop trigger e function
DROP TRIGGER IF EXISTS validate_utente_request_update ON requests;
DROP FUNCTION IF EXISTS validate_utente_update();

-- Ricrea policy originale (con ricorsione)
DROP POLICY IF EXISTS "Utente can update own requests" ON requests;
CREATE POLICY "Utente can update own requests"
  ON requests FOR UPDATE
  USING (
    get_user_role() = 'utente' AND
    created_by = auth.uid()
  )
  WITH CHECK (
    created_by = auth.uid() AND
    assigned_to = (SELECT assigned_to FROM requests WHERE id = requests.id)
  );
```

**ATTENZIONE**: Il rollback ripristina il bug di ricorsione infinita!

## RIFERIMENTI

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Function Volatility Categories](https://www.postgresql.org/docs/current/xfunc-volatility.html)

