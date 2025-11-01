# Version Notes e Changelog

## Formato
Questo file segue [Semantic Versioning](https://semver.org/) (MAJOR.MINOR.PATCH)

- **MAJOR**: breaking changes che richiedono modifiche da parte utenti
- **MINOR**: nuove funzionalità backwards compatible
- **PATCH**: bug fixes e miglioramenti minori

## [Unreleased]

### Added
- Setup iniziale progetto
- Framework operativo completo
- Documentazione CLAUDE.md, SETUP.md, WORKFLOW.md

---

## [0.1.0] - YYYY-MM-DD - Initial Setup

### Added
- Struttura repository base
- Configurazione Vite + React + TypeScript
- Material UI setup con tema dark
- Supabase client configurazione
- Schema database iniziale
- Autenticazione base
- Seed dati esempio

### Infrastructure
- GitHub repository
- Vercel deployment pipeline
- Supabase progetto production
- Environment variables configurate

---

## Template Release Notes

### Esempio Feature Release
```markdown
## [1.0.0] - 2025-02-15 - First Production Release

### Added
- Form dinamici configurabili per tipologie richiesta
- Dashboard analytics con grafici MUI X Charts
- Sistema notifiche in-app con Supabase Realtime
- Sistema notifiche email con Resend
- Gestione allegati con drag&drop
- Workflow stati richiesta completo
- Permessi basati su ruolo (Admin/Tecnico/Utente)
- Interfaccia responsive mobile-first

### Security
- Row Level Security policies implementate
- Validazione input frontend e backend
- Rate limiting Edge Functions

### Performance
- Query database ottimizzate con indici
- TanStack Query caching implementato
- Lazy loading pagine
- Immagini ottimizzate

### Documentation
- README completo con istruzioni uso
- Guide utente per ciascun ruolo
- Documentazione API interna
```

### Esempio Bug Fix Release
```markdown
## [1.0.1] - 2025-02-20 - Bug Fixes

### Fixed
- Corregge validazione campi obbligatori form dinamici
- Risolve race condition in notifiche real-time
- Fix layout mobile dashboard su iPhone
- Corregge upload allegati > 5MB

### Changed
- Migliora messaggio errore validazione transizioni stato
- Ottimizza query dashboard analytics (-30% tempo caricamento)
```

### Esempio Breaking Change Release
```markdown
## [2.0.0] - 2025-03-01 - Major Update

### Breaking Changes
- **Database schema**: campo `status` cambiato da VARCHAR a ENUM
  - **Migration required**: eseguire `supabase db push`
  - **Impatto**: necessario aggiornare codice custom che referenzia stati
- **API**: endpoint `/api/requests` richiede ora header `X-Request-Version: 2`
  - **Impatto**: aggiornare client API esterni

### Migration Guide
1. Backup database: `supabase db dump > backup.sql`
2. Esegui migration: `supabase db push`
3. Verifica dati: query test su tabella requests
4. Aggiorna client API con nuovo header

### Added
- Multi-workspace support
- Advanced filtering dashboard
- Export richieste in Excel/PDF

### Deprecated
- `status_legacy` field (rimosso in v3.0.0)
- Old notification format (support fino v2.5.0)
```

---

## Linee Guida Aggiornamento

### Quando Incrementare Versione

**MAJOR (x.0.0)**
- Breaking changes schema database
- Rimozione API/features deprecate
- Cambio flusso autenticazione
- Modifiche che richiedono azione utente

**MINOR (0.x.0)**
- Nuove feature complete
- Nuove tipologie richiesta default
- Miglioramenti UX significativi
- Nuove integrazioni

**PATCH (0.0.x)**
- Bug fixes
- Typo corrections
- Miglioramenti performance minori
- Aggiornamenti dipendenze sicurezza

### Processo Aggiornamento

1. **Sviluppo feature**
   - Sviluppa su branch feature
   - Test completo su preview
   
2. **Pre-release**
   - Merge su main
   - Aggiorna VERSION_NOTES.md sezione [Unreleased]
   - Test smoke production
   
3. **Release**
   - Sposta contenuto [Unreleased] a nuova versione
   - Update `package.json` version
   - Crea Git tag: `git tag v1.2.0`
   - Push tag: `git push origin v1.2.0`
   
4. **Post-release**
   - Annuncio utenti (se necessario)
   - Monitora logs errori 48h
   - Documenta issues noti

### Comunicazione Utenti

**MAJOR releases**: 
- Email a tutti utenti 7 giorni prima
- In-app banner con countdown
- Guida migrazione dettagliata

**MINOR releases**:
- In-app notification nuove features
- Changelog accessibile da UI

**PATCH releases**:
- Changelog tecnico (non comunicato attivamente)

---

## Known Issues

### Current
- Nessun issue noto

### Resolved
- [v0.1.0] Placeholder per issues risolte

---

## Deprecation Notices

### Future Removals
- Nessuna deprecation pianificata

### Deprecated Features
- Nessuna feature deprecata

---

## Statistiche Progetto

### Metriche Development
- **Commit totali**: aggiornare ad ogni major release
- **Contributors**: 1 (iniziale)
- **Issues closed**: aggiornare periodicamente
- **Test coverage**: target 40% (critical paths)

### Metriche Production
- **Uptime**: target 99.5%
- **Response time**: target < 200ms (p95)
- **Active users**: monitorare mensilmente

---

## Roadmap (opzionale)

### v1.1.0 (Q2 2025)
- [ ] Integrazione calendario eventi
- [ ] API REST pubblica per integrazioni
- [ ] Mobile app PWA

### v1.2.0 (Q3 2025)
- [ ] Advanced reporting
- [ ] Dashboard personalizzabile
- [ ] Automazioni workflow

### v2.0.0 (Q4 2025)
- [ ] Multi-tenant support
- [ ] Advanced analytics con ML
- [ ] Plugin system

---

## Maintenance Log

### YYYY-MM-DD - Manutenzione Programmata
- **Durata**: 2 ore
- **Impatto**: nessun downtime
- **Attività**: 
  - Database backup
  - Aggiornamento dipendenze sicurezza
  - Ottimizzazione indici database
- **Esito**: completato con successo

---

## Note per Sviluppatori

### Come Aggiornare Questo File
1. Lavora sempre su sezione [Unreleased]
2. Categorizza modifiche: Added, Changed, Fixed, Security, Breaking Changes
3. Sii specifico: "Fix validazione email" non "Fix bug"
4. Includi issue reference: "Fix #123: ..."
5. Al release, sposta [Unreleased] → nuova versione datata

### Riferimenti
- Conventional Commits: https://www.conventionalcommits.org/
- Keep a Changelog: https://keepachangelog.com/
- Semantic Versioning: https://semver.org/
