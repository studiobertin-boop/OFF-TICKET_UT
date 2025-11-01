# Schema Database - Tabella Users

## Struttura Aggiornata

### Tabella: `users`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'utente',
  full_name TEXT NOT NULL,
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,  -- ⭐ NUOVO
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- ⭐ AGGIUNTO A TYPES
);
```

### Enum: `user_role`

```sql
CREATE TYPE user_role AS ENUM (
  'admin',
  'tecnico',
  'utente',
  'userdm329'  -- ⭐ NUOVO
);
```

### Indici

```sql
-- Indici esistenti
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);

-- Nuovo indice
CREATE INDEX idx_users_is_suspended ON users(is_suspended);  -- ⭐ NUOVO
```

### Funzioni Helper

```sql
-- Funzione esistente
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ⭐ NUOVA FUNZIONE
CREATE OR REPLACE FUNCTION is_user_suspended(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(is_suspended, FALSE) FROM users WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;
```

## Row Level Security Policies

### Policies per Tabella `users`

#### SELECT Policies
```sql
-- Admin: può vedere tutti gli utenti
CREATE POLICY "Admin can view all users"
  ON users FOR SELECT
  USING (get_user_role() = 'admin');

-- Tecnici: possono vedere tutti gli utenti (per assegnazioni)
CREATE POLICY "Tecnici can view users"
  ON users FOR SELECT
  USING (get_user_role() IN ('tecnico', 'admin'));

-- Utenti: possono vedere solo il proprio profilo
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);
```

#### INSERT Policies
```sql
-- Solo Admin può creare utenti
CREATE POLICY "Admin can insert users"
  ON users FOR INSERT
  WITH CHECK (get_user_role() = 'admin');
```

#### UPDATE Policies
```sql
-- Admin può aggiornare tutti gli utenti
CREATE POLICY "Admin can update all users"
  ON users FOR UPDATE
  USING (get_user_role() = 'admin');

-- Utenti possono aggiornare il proprio profilo (tranne il ruolo)
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND
    (SELECT role FROM users WHERE id = auth.uid()) = role -- Ruolo NON modificabile
  );
```

#### DELETE Policies
```sql
-- Solo Admin può eliminare utenti
CREATE POLICY "Admin can delete users"
  ON users FOR DELETE
  USING (get_user_role() = 'admin');
```

### ⭐ NUOVE Policies per Tabella `requests` (Ruolo userdm329)

```sql
-- userdm329 può vedere solo richieste DM329
CREATE POLICY "userdm329 can view DM329 requests"
  ON requests FOR SELECT
  USING (
    get_user_role() = 'userdm329' AND
    request_type_id IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  );

-- userdm329 può modificare solo richieste DM329
CREATE POLICY "userdm329 can update DM329 requests"
  ON requests FOR UPDATE
  USING (
    get_user_role() = 'userdm329' AND
    request_type_id IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  )
  WITH CHECK (
    get_user_role() = 'userdm329' AND
    request_type_id IN (
      SELECT id FROM request_types WHERE name = 'DM329'
    )
  );
```

## Trigger

### Auto-creazione Profilo Utente

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, full_name, is_suspended)
  VALUES (
    NEW.id,
    NEW.email,
    'utente',
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    FALSE  -- ⭐ Default non sospeso
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
```

## Diagramma Relazioni

```
┌─────────────────────────────────┐
│        auth.users (Supabase)    │
├─────────────────────────────────┤
│ id                    UUID PK   │
│ email                 TEXT      │
│ encrypted_password    TEXT      │
│ ...                              │
└─────────────────────────────────┘
              │ ON DELETE CASCADE
              ▼
┌─────────────────────────────────┐
│        public.users             │
├─────────────────────────────────┤
│ id                    UUID PK   │ ← FK auth.users(id)
│ email                 TEXT      │
│ role                  user_role │ ← admin/tecnico/utente/userdm329
│ full_name             TEXT      │
│ is_suspended          BOOLEAN   │ ⭐ NUOVO
│ created_at            TIMESTAMPTZ│
│ updated_at            TIMESTAMPTZ│ ⭐ TRACCIATO
└─────────────────────────────────┘
              │
              ├─── created_by ────┐
              │                    │
              └─── assigned_to ───┤
                                   ▼
              ┌─────────────────────────────────┐
              │        requests                 │
              ├─────────────────────────────────┤
              │ id                    UUID PK   │
              │ request_type_id       UUID FK   │
              │ created_by            UUID FK   │ → users.id
              │ assigned_to           UUID FK   │ → users.id
              │ title                 TEXT      │
              │ status                TEXT      │
              │ custom_fields         JSONB     │
              │ ...                              │
              └─────────────────────────────────┘
```

## Matrice Permessi per Ruolo

### Tabella `users`

| Operazione | admin | tecnico | utente | userdm329 |
|-----------|-------|---------|--------|-----------|
| SELECT *  | ✅    | ✅      | ❌     | ❌        |
| SELECT own| ✅    | ✅      | ✅     | ✅        |
| INSERT    | ✅    | ❌      | ❌     | ❌        |
| UPDATE *  | ✅    | ❌      | ❌     | ❌        |
| UPDATE own| ✅    | ✅      | ✅ *   | ✅ *      |
| DELETE    | ✅    | ❌      | ❌     | ❌        |

\* = Escluso campo `role`

### Tabella `requests`

| Operazione       | admin | tecnico | utente | userdm329 |
|-----------------|-------|---------|--------|-----------|
| SELECT *        | ✅    | ✅      | ❌     | ❌        |
| SELECT DM329    | ✅    | ✅      | ❌     | ✅        |
| SELECT assigned | ✅    | ✅      | ✅     | ❌        |
| INSERT          | ✅    | ✅      | ✅     | ❌        |
| UPDATE *        | ✅    | ❌      | ❌     | ❌        |
| UPDATE assigned | ✅    | ✅      | ❌     | ❌        |
| UPDATE DM329    | ✅    | ✅      | ❌     | ✅        |
| UPDATE (INFO)   | ✅    | ✅      | ✅ **  | ✅ **     |
| DELETE          | ✅    | ❌      | ❌     | ❌        |

\*\* = Solo campo `notes` e allegati quando `status = 'INFO_NECESSARIE'`

## Query Utili per Testing

### Verificare Enum user_role
```sql
SELECT enum_range(NULL::user_role);
-- Risultato atteso: {admin,tecnico,utente,userdm329}
```

### Verificare Struttura Tabella users
```sql
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
```

### Verificare Policies Attive
```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('users', 'requests')
ORDER BY tablename, cmd, policyname;
```

### Verificare Utenti Sospesi
```sql
SELECT
  id,
  email,
  role,
  full_name,
  is_suspended,
  created_at
FROM users
WHERE is_suspended = true;
```

### Testare Funzione is_user_suspended
```sql
SELECT
  id,
  email,
  is_suspended,
  is_user_suspended(id) as suspended_check
FROM users;
```

### Contare Utenti per Ruolo
```sql
SELECT
  role,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_suspended = true) as suspended,
  COUNT(*) FILTER (WHERE is_suspended = false) as active
FROM users
GROUP BY role
ORDER BY role;
```

## Note di Migrazione

### Compatibilità Retroattiva
- ✅ La colonna `is_suspended` ha default `FALSE`, quindi utenti esistenti rimangono attivi
- ✅ Il nuovo ruolo `userdm329` non impatta gli utenti esistenti
- ✅ Le policies esistenti continuano a funzionare
- ✅ Nessuna modifica breaking alle API esistenti

### Dipendenze
- Richiede tipo `DM329` in tabella `request_types`
- Admin API Supabase deve essere abilitata
- Service Role Key deve essere configurata

### Rollback Considerations
⚠️ **ATTENZIONE:** I valori ENUM non possono essere facilmente rimossi in PostgreSQL. Se è necessario fare rollback del ruolo `userdm329`:

1. Prima aggiornare tutti gli utenti con quel ruolo a un altro ruolo
2. Poi procedere con la rimozione del valore dall'enum (richiede ALTER TYPE complesso)

Alternativa più sicura: Disabilitare le policies invece di rimuovere l'enum.
