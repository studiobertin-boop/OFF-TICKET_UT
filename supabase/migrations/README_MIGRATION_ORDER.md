# Ordine di Esecuzione Migration

## ⚠️ IMPORTANTE

Le migration per il ruolo `userdm329` **DEVONO** essere eseguite in **due step separati** a causa delle limitazioni di PostgreSQL con gli ENUM.

## Sequenza Corretta

### 1️⃣ Prima Migration
**File:** `20250101000003_add_userdm329_role.sql`

**Cosa fa:** Aggiunge il valore `'userdm329'` all'enum `user_role`

**Come eseguire:**
```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'userdm329';
```

✅ Eseguire e **attendere il commit** (10-20 secondi)

---

### 2️⃣ Seconda Migration
**File:** `20250101000004_add_suspension_and_policies.sql`

**Cosa fa:**
- Aggiunge campo `is_suspended` alla tabella `users`
- Crea policies RLS per il ruolo `userdm329`
- Crea funzione helper `is_user_suspended()`

**Come eseguire:**
- Aprire una **NUOVA query/sessione**
- Copiare e incollare **tutto** il contenuto del file
- Eseguire

---

## Perché Due Step?

PostgreSQL **NON permette** di usare un nuovo valore ENUM nella stessa transazione in cui viene creato.

Errore che otterresti se esegui tutto insieme:
```
ERROR: 55P04: unsafe use of new value "userdm329" of enum type user_role
HINT: New enum values must be committed before they can be used.
```

## Guida Completa

Vedi: `DOCUMENTAZIONE/MIGRATION_GUIDE.md` per:
- Procedura dettagliata passo-passo
- Troubleshooting errori comuni
- Piano di rollback
- Script di verifica

## Ordine Completo Tutte le Migration

1. `20250101000000_initial_schema.sql` - Schema iniziale
2. `20250101000001_rls_policies.sql` - RLS policies base
3. `20250101000002_fix_rls_recursion.sql` - Fix recursione RLS
4. `20250101000003_add_userdm329_role.sql` - ⭐ ENUM userdm329 (PRIMO)
5. `20250101000004_add_suspension_and_policies.sql` - ⭐ Campo e policies (SECONDO)

## Test Rapido Post-Migration

```sql
-- Verificare enum
SELECT enum_range(NULL::user_role);
-- Risultato: {admin,tecnico,utente,userdm329}

-- Verificare campo
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'is_suspended';
-- Risultato: is_suspended

-- Verificare policies
SELECT policyname FROM pg_policies
WHERE tablename = 'requests' AND policyname LIKE '%userdm329%';
-- Risultato: 2 righe (view e update)
```
