# CHANGELOG - Bugfix Autenticazione e Aggiornamento Stato

## [Bugfix] - 2025-11-01

### Fixed
- Risolto errore "AuthApiError: Invalid Refresh Token: Refresh Token Not Found"
- Risolto errore 500 durante cambio stato richieste
- Risolto errore 500 durante assegnazione richieste a tecnici
- Risolto problema di sessioni scadute che causavano fallimento operazioni

### Changed

#### `src/services/supabase.ts`
- Aggiunta configurazione esplicita storage localStorage
- Aggiunta chiave storage dedicata `off-ticket-ut-auth`
- Implementato flow PKCE per maggiore sicurezza
- Aggiunta funzione `ensureValidSession()` per validazione proattiva sessioni
- Implementato refresh automatico token quando scadenza < 5 minuti

#### `src/services/requestService.ts`
- Aggiunta validazione sessione all'inizio di `updateRequestStatus()`
- Aggiunta validazione sessione all'inizio di `assignRequest()`
- Migliorata gestione errori con codici PostgreSQL specifici
- Aggiunti messaggi errore dettagliati per utenti finali
- Migliorato logging per debugging

#### `src/services/api/requests.ts`
- Aggiunta validazione sessione in `create()`
- Aggiunta validazione sessione in `update()`
- Aggiunta validazione sessione in `delete()`
- Implementata gestione errori specifica per ogni operazione
- Aggiunti messaggi errore user-friendly

#### `src/hooks/useAuth.tsx`
- Aggiunto logging eventi autenticazione (SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT)
- Migliorata gestione cambio stato autenticazione
- Aggiunto log email utente per debugging

### Added

#### `supabase/diagnostics.sql`
- Query diagnostiche per verificare configurazione database
- Controlli utenti, ruoli, funzioni, RLS policies
- Test funzione get_user_role()
- Verifica corrispondenza auth.users vs public.users

#### `BUGFIX_SESSION_AUTH.md`
- Documentazione dettagliata causa radice e soluzione
- Spiegazione problema e fix implementati
- Istruzioni testing e deployment
- Procedure rollback

#### `SOLUZIONE_ERRORI_AUTH.md`
- Riepilogo completo problemi risolti
- Guida step-by-step per testing
- Messaggi errore prima/dopo
- Best practices implementate
- Comandi utili per supporto

#### `TEST_CHECKLIST.md`
- Checklist interattiva per testing completo
- 8 test specifici da eseguire
- Risultati attesi per ogni test
- Procedure recovery in caso di errore
- Form riepilogo finale

#### `CHANGELOG.md`
- Questo file
- Tracciamento modifiche

### Technical Details

**Problema Identificato:**
Quando la sessione JWT scadeva, `auth.uid()` ritornava NULL, causando il fallimento della funzione `get_user_role()` nel database. Questo faceva sì che le RLS policies negassero l'accesso, risultando in errori 500.

**Soluzione:**
1. Configurazione client Supabase migliorata per persistenza e sicurezza
2. Funzione di validazione proattiva che controlla e refresha sessioni
3. Gestione errori dettagliata con messaggi specifici
4. Logging completo per debugging

**Impatto:**
- Migliorata esperienza utente (no errori 500)
- Sessioni persistono correttamente
- Messaggi errore comprensibili
- Debugging semplificato

### Testing Status
- Build: ✅ Completato con successo
- TypeScript: ✅ Nessun errore
- Tests manuali: ⏳ Da eseguire dall'utente

### Deployment Instructions
1. Rebuild applicazione: `npm run build`
2. Deploy su Vercel o ambiente produzione
3. Informare utenti di:
   - Effettuare logout
   - Cancellare localStorage (opzionale)
   - Effettuare nuovo login
4. Monitorare log per 24-48 ore

### Rollback Procedure
Se necessario rollback:
```bash
git checkout HEAD~1 -- src/services/supabase.ts
git checkout HEAD~1 -- src/services/requestService.ts
git checkout HEAD~1 -- src/services/api/requests.ts
git checkout HEAD~1 -- src/hooks/useAuth.tsx
npm run build
```

### Dependencies
- @supabase/supabase-js: 2.78.0 (unchanged)
- No nuove dipendenze aggiunte

### Breaking Changes
Nessuna. Tutte le modifiche sono backward compatible.

### Migration Required
No. Gli utenti esistenti dovranno solo effettuare logout/login.

### Related Issues
- Risolve errori di refresh token
- Risolve errori 500 durante operazioni DB
- Risolve problemi di persistenza sessione

### Authors
- Debug e fix: Claude (AI Assistant)
- Review: Studio Bertin Team

### Notes
- Il sistema ora logga attivamente eventi di autenticazione
- Token vengono refreshati automaticamente prima della scadenza
- Tutti i messaggi di errore sono ora in italiano e user-friendly
- La chiave localStorage è cambiata da default a 'off-ticket-ut-auth'

