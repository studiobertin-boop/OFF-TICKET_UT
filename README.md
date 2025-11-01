# Sistema Ticketing Ufficio Tecnico

Sistema di gestione richieste lavoro per ufficio tecnico con form dinamici configurabili, workflow stati, notifiche real-time e dashboard analytics.

## 🎯 Caratteristiche Principali

- **Form Dinamici Configurabili**: admin può creare/modificare tipologie richiesta senza toccare codice
- **Workflow Stati**: gestione ciclo vita richiesta con validazione transizioni basata su ruolo
- **Notifiche Real-time**: aggiornamenti in-app via WebSocket + notifiche email
- **Dashboard Analytics**: metriche aggregate con grafici interattivi e filtri avanzati
- **Gestione Allegati**: upload multiplo file con preview integrato (max 10MB/file)
- **Multi-ruolo**: Admin, Tecnico, Utente con permessi granulari
- **Mobile-first**: interfaccia responsive ottimizzata per tablet e smartphone

## 🏗️ Architettura

### Stack Tecnologico

**Frontend**
- React 18 + TypeScript
- Material UI 6 (tema dark)
- Vite (build tool)
- React Router 6
- React Hook Form + Zod
- TanStack Query
- MUI X Charts

**Backend**
- Supabase (PostgreSQL + Realtime + Storage + Auth)
- Edge Functions (Deno)
- Resend (email notifications)

**DevOps**
- Git + GitHub
- Vercel (hosting + CI/CD)
- ESLint + Prettier
- Vitest (testing)

### Architettura Applicativa

```
┌─────────────────────────────────────────────┐
│           Frontend (React + TS)             │
│  ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │Dashboard │ │ Requests │ │   Admin    │  │
│  └────┬─────┘ └─────┬────┘ └──────┬─────┘  │
│       └──────────────┴─────────────┘        │
│              Supabase Client                │
└───────────────────┬─────────────────────────┘
                    │ HTTPS + WebSocket
┌───────────────────┴─────────────────────────┐
│              Supabase Platform              │
│  ┌──────────┐ ┌─────────┐ ┌──────────────┐ │
│  │PostgreSQL│ │ Realtime│ │Edge Functions│ │
│  │   +RLS   │ │(notify) │ │   (email)    │ │
│  └──────────┘ └─────────┘ └──────────────┘ │
│  ┌──────────┐ ┌─────────┐                  │
│  │  Storage │ │   Auth  │                  │
│  │  (files) │ │(email/pw)│                  │
│  └──────────┘ └─────────┘                  │
└─────────────────────────────────────────────┘
                    │
┌───────────────────┴─────────────────────────┐
│          Resend (Email Delivery)            │
└─────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisiti
- Node.js 20+
- Account Supabase (gratuito)
- Account Vercel (gratuito)
- Account Resend (opzionale, per email)

### Installazione

```bash
# Clone repository
git clone https://github.com/your-org/ticketing-ufficio-tecnico.git
cd ticketing-ufficio-tecnico

# Installa dipendenze
npm install

# Configura environment
cp .env.example .env.local
# Modifica .env.local con le tue credenziali

# Avvia sviluppo
npm run dev
```

**Per setup completo vedere [SETUP.md](./SETUP.md)**

## 📚 Documentazione

- **[CLAUDE.md](./CLAUDE.md)** - Istruzioni per Claude Code (AI-assisted development)
- **[SETUP.md](./SETUP.md)** - Setup ambiente sviluppo completo
- **[WORKFLOW.md](./WORKFLOW.md)** - Processo sviluppo e deployment
- **[VERSION_NOTES.md](./VERSION_NOTES.md)** - Changelog e roadmap

## 👥 Ruoli Utente

### Admin
- Gestione completa utenti e tipologie richiesta
- Accesso dashboard globale
- Cambio stato libero (inclusi SOSPESA, ABORTITA)
- Export dati

### Tecnico
- Visualizza richieste assegnate
- Cambia stato secondo workflow
- Richiede info integrative
- Dashboard personale

### Utente
- Crea nuove richieste
- Visualizza proprie richieste
- Upload allegati
- Risponde a richieste info

## 🔄 Workflow Stati Richiesta

```
┌────────┐
│ APERTA │ (creazione richiesta)
└───┬────┘
    │
    ▼
┌──────────┐
│ASSEGNATA │ (assegnazione a tecnico)
└────┬─────┘
     │
     ▼
┌───────────────┐     ┌────────────────┐
│IN_LAVORAZIONE │────▶│INFO_NECESSARIE │ (richiesta chiarimenti)
└───────┬───────┘     └────────┬───────┘
        │                      │
        │                      ▼
        │              ┌────────────────┐
        │              │INFO_TRASMESSE  │ (utente risponde)
        │              └────────┬───────┘
        │◀─────────────────────┘
        │
        ▼
┌────────────┐
│ COMPLETATA │
└────────────┘

Stati Admin: SOSPESA, ABORTITA (accessibili da qualsiasi stato)
```

## 🛠️ Comandi Principali

```bash
# Sviluppo
npm run dev              # Avvia dev server (http://localhost:5173)
npm run build            # Build production
npm run preview          # Preview build locale

# Quality
npm run lint             # ESLint check
npm run format           # Prettier format
npm test                 # Esegui test Vitest
npm run test:watch       # Test in watch mode

# Supabase
supabase db push         # Applica migrations
supabase gen types       # Genera TypeScript types
supabase db reset        # Reset database locale

# Deployment
vercel --prod            # Deploy production manuale
vercel logs              # Visualizza logs production
```

## 📊 Database Schema

### Tabelle Principali

**users**
- Estende `auth.users` con ruolo e dati profilo
- Ruoli: admin, tecnico, utente

**request_types**
- Definizioni tipologie richiesta configurabili
- Schema campi dinamico in JSONB

**requests**
- Richieste ticket con campi comuni + custom_fields JSONB
- Stati workflow + timestamp eventi
- Foreign key a request_type, assigned_to, created_by

**request_history**
- Audit trail completo modifiche e transizioni stato

**attachments**
- Metadati file allegati (storage in Supabase Storage)

**notifications**
- Notifiche in-app per utenti

### Sicurezza (RLS)
- Row Level Security abilitato su tutte tabelle
- Policies basate su ruolo utente
- Validazione transizioni stato in PostgreSQL functions

## 🎨 UI/UX Features

- **Tema Dark**: Material UI tema scuro di default
- **Responsive**: layout adattivo mobile/tablet/desktop
- **Loading States**: skeleton screens per caricamenti
- **Error Handling**: toast notifications e error boundaries
- **Accessibility**: semantic HTML, ARIA labels, keyboard navigation
- **PWA Ready**: installabile come app (opzionale)

## 🔐 Sicurezza

- Autenticazione Supabase (email/password)
- Row Level Security (RLS) policies
- Validazione input frontend (Zod) + backend (PostgreSQL)
- Rate limiting Edge Functions
- HTTPS/SSL via Vercel
- Secrets management (environment variables)

## 📈 Performance

- TanStack Query caching e invalidation
- Lazy loading pagine React
- Database indexes ottimizzati
- Edge CDN Vercel
- Image optimization (quando applicabile)

## 🧪 Testing

### Coverage Target
- Workflow logic: 100%
- Form validations: 100%
- Dashboard calculations: 80%
- UI components: 0% (testing manuale)

### Test Suite
```bash
npm test                    # Esegui tutti test
npm test -- --coverage      # Con coverage report
npm test workflow           # Test specifici
```

## 🤝 Sviluppo Assistito con Claude Code

Questo progetto è ottimizzato per sviluppo assistito da AI:

1. **Leggi [CLAUDE.md](./CLAUDE.md)** - Contiene tutto il context necessario
2. **Usa pattern prompting** - Esempi in CLAUDE.md
3. **Segui convenzioni** - TypeScript strict, Conventional Commits
4. **Test critici** - Workflow, validazioni, calcoli

Esempio prompt:
```
Crea RequestStatusBadge component. Props: status (enum). 
Usa MUI Chip con colori: APERTA=info, IN_LAVORAZIONE=warning, 
COMPLETATA=success, ABORTITA=error. TypeScript + responsive.
```

## 📦 Deployment

### Automatic (consigliato)
- Push su `main` → deploy automatico Vercel production
- Push su feature branch → preview deployment automatico

### Manual
```bash
vercel --prod
```

### Environments
- **Development**: localhost:5173
- **Preview**: `*.vercel.app` (per ogni PR/branch)
- **Production**: custom domain o `ticketing-prod.vercel.app`

## 🐛 Troubleshooting

### Build Fails
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Database Connection Issues
- Verifica `.env.local` contiene credentials corrette
- Check RLS policies non bloccano query
- Verifica Supabase project attivo

### Realtime Not Working
- Abilita Realtime su tabella (Dashboard → Replication)
- Verifica subscription code corretto
- Check RLS non blocca subscription

**Per troubleshooting completo vedere [WORKFLOW.md § 14](./WORKFLOW.md#14-troubleshooting-comuni)**

## 📄 Licenza

[Specifica licenza - es. MIT, Proprietary, etc.]

## 👤 Autore

[Nome sviluppatore/organizzazione]

## 🙏 Riconoscimenti

- [Supabase](https://supabase.com) - Backend platform
- [Material UI](https://mui.com) - Component library
- [Vercel](https://vercel.com) - Hosting & deployment
- [Claude Code](https://www.anthropic.com) - AI-assisted development

## 📞 Supporto

- **Issues**: [GitHub Issues](https://github.com/your-org/ticketing-ufficio-tecnico/issues)
- **Documentazione**: [Wiki](https://github.com/your-org/ticketing-ufficio-tecnico/wiki) (opzionale)
- **Email**: support@tuazienda.com (se applicabile)

---

**Versione**: 0.1.0  
**Ultimo aggiornamento**: YYYY-MM-DD  
**Status**: In Development
