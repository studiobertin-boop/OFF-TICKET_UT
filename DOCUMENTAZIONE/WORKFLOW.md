# Workflow Sviluppo e Deployment

## 1. Branching Strategy - GitHub Flow

### Branch Principale
- `main` → ambiente production (protetto)

### Branch Sviluppo
- `feature/nome-funzionalita` → nuove feature
- `fix/descrizione-bug` → correzioni bug
- `refactor/componente` → refactoring
- `docs/sezione` → documentazione

### Naming Convention
```bash
# Feature
git checkout -b feature/dynamic-form-builder
git checkout -b feature/email-notifications

# Fix
git checkout -b fix/status-validation
git checkout -b fix/mobile-layout

# Refactor
git checkout -b refactor/dashboard-charts

# Docs
git checkout -b docs/api-documentation
```

## 2. Workflow Feature Completa

### 2.1 Creazione Branch
```bash
git checkout main
git pull origin main
git checkout -b feature/nome-feature
```

### 2.2 Sviluppo Locale
```bash
# Avvia dev server
npm run dev

# Sviluppo iterativo
# - Modifica codice
# - Test manuale browser
# - Hot reload automatico

# Commit frequenti
git add .
git commit -m "feat: implementa componente X"
```

### 2.3 Test Pre-Push
```bash
# Lint
npm run lint

# Format
npm run format

# Test unitari (se presenti)
npm test

# Build locale
npm run build
npm run preview
```

### 2.4 Push e Preview
```bash
git push origin feature/nome-feature
```

Vercel crea automaticamente:
- **Preview URL**: `https://ticketing-xxx-git-feature-nome.vercel.app`
- Notifica GitHub con link preview
- Environment: isolato, usa production database

### 2.5 Testing Preview
- [ ] Test funzionalità su preview URL
- [ ] Verifica responsive mobile
- [ ] Test cross-browser (Chrome, Safari, Firefox)
- [ ] Controllo console errors
- [ ] Test flussi utente end-to-end

### 2.6 Pull Request (feature rilevanti)

**Quando usare PR:**
- Nuove feature significative
- Modifiche architetturali
- Refactoring ampi
- Breaking changes

**Quando NO:**
- Fix typo
- Aggiornamento dipendenze
- Piccoli aggiustamenti styling

**Template PR:**
```markdown
## Descrizione
[Cosa fa questa modifica e perché]

## Tipo Modifica
- [ ] Feature
- [ ] Bug Fix
- [ ] Refactoring
- [ ] Documentazione

## Testing Completato
- [ ] Test locale
- [ ] Verificato su preview URL
- [ ] Test mobile
- [ ] Nessun breaking change
- [ ] Test Vitest passati (se applicabile)

## Screenshot
[Allega immagini se modifica UI]

## Note Aggiuntive
[Eventuali note per reviewer o considerazioni future]
```

### 2.7 Merge e Deploy Production
```bash
# Dopo verifica preview, merge su main
git checkout main
git pull origin main
git merge feature/nome-feature
git push origin main

# Vercel deploy automatico su production
# Monitoring: https://vercel.com/dashboard/deployments
```

### 2.8 Cleanup Branch
```bash
# Locale
git branch -d feature/nome-feature

# Remoto
git push origin --delete feature/nome-feature
```

## 3. Hotfix Urgenti

Per bug critici in production:

```bash
# Opzione A: Branch rapido
git checkout main
git checkout -b fix/critical-bug
# ... fix
git push origin fix/critical-bug
# Merge immediato senza PR estesa

# Opzione B: Push diretto (solo emergenze)
git checkout main
# ... fix
git add .
git commit -m "fix: risolve bug critico X"
git push origin main
```

**Criteri hotfix:**
- Bug impedisce utilizzo app
- Errore espone dati sensibili
- Crash completo applicazione

## 4. Conventional Commits

### Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: nuova funzionalità
- `fix`: correzione bug
- `docs`: documentazione
- `style`: formattazione, no logic change
- `refactor`: refactoring codice
- `test`: aggiunta/modifica test
- `chore`: task manutenzione (deps, config)

### Esempi
```bash
git commit -m "feat(requests): aggiungi form dinamico con validazione Zod"
git commit -m "fix(auth): correggi redirect dopo login"
git commit -m "refactor(dashboard): estrai ChartCard component"
git commit -m "docs: aggiorna README con istruzioni deploy"
git commit -m "style(forms): migliora spacing form mobile"
git commit -m "test(workflow): aggiungi test validazione transizioni"
git commit -m "chore(deps): aggiorna Material UI a v6.1.0"
```

### Commit Body (opzionale)
```bash
git commit -m "feat(notifications): implementa sistema notifiche real-time

- Supabase Realtime subscriptions
- Badge contatore in AppBar
- Drawer notifiche con mark as read
- Auto-refresh ogni 30s fallback"
```

## 5. Database Migrations

### 5.1 Creazione Migration
```bash
# Modifica schema DB via Supabase Dashboard
# Genera migration dalle modifiche
supabase db diff -f nome_migration

# File creato in /supabase/migrations/
# Es: 20250130120000_nome_migration.sql
```

### 5.2 Test Migration Locale
```bash
# Reset DB locale
supabase db reset

# Verifica applicazione migrations
supabase db push
```

### 5.3 Deploy Migration Production
```bash
# Push migrations su Supabase production
supabase db push --project-ref YOUR_PROJECT_REF

# Verifica applicazione corretta
# Dashboard → Database → Migrations
```

### Best Practices Migrations
- **Sempre backwards compatible** quando possibile
- **Non eliminare colonne** direttamente (deprecate prima)
- **Test rollback** su staging
- **Backup DB** prima di migrations rischiose

## 6. Gestione Environment Variables

### 6.1 Development (locale)
```bash
# .env.local (git-ignored)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 6.2 Production (Vercel)
Dashboard Vercel → Settings → Environment Variables:
- Production, Preview, Development scopes separati
- Secrets non loggati
- Sync automatico dopo modifica

### 6.3 Aggiunta Nuova Variabile
1. Aggiungi in `.env.local`
2. Aggiungi in Vercel Dashboard
3. Redeploy: `vercel --prod`
4. Documenta in SETUP.md se necessaria per altri dev

## 7. Rollback Strategy

### 7.1 Rollback Deployment Vercel
```bash
# Via Dashboard
Vercel → Deployments → [deployment precedente] → Promote to Production

# Via CLI
vercel rollback
```

### 7.2 Rollback Database
```bash
# Restore da backup Supabase
# Dashboard → Database → Backups → Restore

# O rollback migration specifica
supabase db reset --version YYYYMMDDHHMMSS
```

### 7.3 Rollback Git
```bash
# Revert commit specifico
git revert <commit-hash>
git push origin main

# Reset hard (ATTENZIONE: perde history)
git reset --hard <commit-hash>
git push origin main --force
```

## 8. Monitoring e Debugging

### 8.1 Vercel Logs
```bash
# Realtime logs
vercel logs --follow

# Logs deployment specifico
vercel logs [deployment-url]
```

### 8.2 Supabase Logs
Dashboard → Logs Explorer:
- Database queries
- Edge Functions invocations
- Auth events

### 8.3 Browser DevTools
- Console: errori JavaScript
- Network: API calls, timing
- React DevTools: component tree, props

### 8.4 Error Tracking (opzionale)
Integra Sentry per tracking errori production:
```bash
npm install @sentry/react
```

## 9. Versioning e Changelog

### 9.1 Semantic Versioning
Format: `MAJOR.MINOR.PATCH`

- `MAJOR`: breaking changes
- `MINOR`: nuove feature backwards compatible
- `PATCH`: bug fixes

### 9.2 Aggiornamento Versione
```bash
# In package.json
"version": "1.2.0"

# Commit
git commit -m "chore: bump version to 1.2.0"
git tag v1.2.0
git push origin v1.2.0
```

### 9.3 Changelog in VERSION_NOTES.md
```markdown
## [1.2.0] - 2025-01-30

### Added
- Form builder dinamico per tipologie richiesta
- Dashboard analytics con filtri avanzati
- Sistema notifiche email via Resend

### Changed
- Migliora responsive layout mobile
- Ottimizza query dashboard (50% faster)

### Fixed
- Corregge validazione campi obbligatori
- Risolve race condition notifiche real-time

### Breaking Changes
- Nessuno
```

## 10. Code Review Checklist (Self-Review)

Prima di merge su main:

### Funzionalità
- [ ] Feature funziona come previsto
- [ ] Edge cases gestiti
- [ ] Error handling implementato
- [ ] Loading states presenti

### Codice
- [ ] Nessun console.log/debugger
- [ ] Nessun codice commentato
- [ ] Naming chiaro e consistente
- [ ] No hardcoded values (usa constants)

### Performance
- [ ] Nessun re-render inutile
- [ ] Query ottimizzate
- [ ] Immagini ottimizzate
- [ ] Bundle size accettabile

### Sicurezza
- [ ] Input sanitizzati
- [ ] RLS policies verificate
- [ ] Nessun secret in codice
- [ ] Auth validata su tutte route

### UX
- [ ] Responsive mobile
- [ ] Accessibilità (tab navigation, screen reader)
- [ ] Feedback utente su azioni
- [ ] Messaggi errore chiari

### Documentazione
- [ ] Commenti per logica complessa
- [ ] README aggiornato se necessario
- [ ] CHANGELOG aggiornato

## 11. Best Practices Generali

### Performance
- Usa `React.memo()` solo se profiling dimostra necessità
- Lazy load pagine: `const Dashboard = lazy(() => import('./Dashboard'))`
- Ottimizza query Supabase: select solo colonne necessarie
- Cache TanStack Query: `staleTime`, `cacheTime` appropriati

### Sicurezza
- **Mai** esporre secret keys in frontend
- Valida input sia frontend che backend
- Sanitizza output per prevenire XSS
- RLS policies sempre abilitate

### UX
- Loading skeleton per dati asincroni
- Toast notifications per feedback azioni
- Conferma dialogs per azioni distruttive
- Breadcrumb navigation per orientamento

### Accessibilità
- Semantic HTML (`<button>`, `<nav>`, `<main>`)
- ARIA labels dove necessario
- Contrasto colori sufficiente (WCAG AA)
- Keyboard navigation funzionante

## 12. Risoluzione Conflitti

### Merge Conflicts
```bash
# Durante merge/rebase
git checkout main
git pull origin main
git checkout feature/mia-feature
git rebase main

# Risolvi conflitti manualmente
# VS Code: Accept Current/Incoming/Both

git add .
git rebase --continue
git push origin feature/mia-feature --force-with-lease
```

### Database Conflicts
- Coordinamento pre-migration su schema
- Migrations numerate sequenzialmente
- Test su branch dedicato prima merge

## 13. Maintenance Tasks

### Weekly
- [ ] Review Vercel deployments status
- [ ] Check Supabase database size
- [ ] Verifica logs errori

### Monthly
- [ ] Aggiorna dipendenze npm: `npm outdated`
- [ ] Review RLS policies performance
- [ ] Cleanup storage bucket files obsoleti
- [ ] Backup manuale database importante

### Quarterly
- [ ] Audit sicurezza dipendenze: `npm audit`
- [ ] Review performance dashboard (Core Web Vitals)
- [ ] Aggiorna documentazione con lessons learned
- [ ] Valuta upgrade major version dipendenze

## 14. Troubleshooting Comuni

### Vercel Build Fails
```bash
# Check build logs
vercel logs [deployment-url]

# Test build locale
npm run build

# Spesso: TypeScript errors, missing env vars
```

### Supabase RLS Blocks Query
```sql
-- Temporaneamente disabilita RLS per debug
ALTER TABLE requests DISABLE ROW LEVEL SECURITY;

-- Query test
SELECT * FROM requests WHERE id = 'xxx';

-- Riabilita
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
```

### Realtime Not Working
- Verifica Realtime abilitato su tabella (Dashboard → Replication)
- Check subscription code: `supabase.channel().on()`
- Verifica RLS policies non bloccano subscription

### Edge Functions Timeout
- Max 30s execution time Supabase Edge Functions
- Sposta logica pesante in Database Functions
- Async operations con queue se necessario

## 15. Risorse e Supporto

### Documentazione
- Progetto: `README.md`, `SETUP.md`, `CLAUDE.md`
- Stack: Link sezione Riferimenti CLAUDE.md

### Community
- Supabase Discord: https://discord.supabase.com
- React Community: https://react.dev/community

### Internal
- Issue Tracker: GitHub Issues
- Knowledge Base: Wiki progetto (opzionale)
- Team Chat: Slack/Discord interno (se team)
