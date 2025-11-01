# Setup Ambiente di Sviluppo

## Prerequisiti
- Node.js 20+ (LTS)
- npm 10+
- Git
- Account GitHub
- Account Supabase (gratuito)
- Account Vercel (gratuito)
- Account Resend (gratuito, opzionale per email)

## 1. Clone Repository
```bash
git clone https://github.com/your-org/ticketing-ufficio-tecnico.git
cd ticketing-ufficio-tecnico
npm install
```

## 2. Setup Supabase

### 2.1 Crea Progetto Supabase
1. Vai su https://supabase.com/dashboard
2. Crea nuovo progetto: `ticketing-ufficio-tecnico`
3. Regione: Europe (per GDPR compliance)
4. Annota: `Project URL` e `anon public key`

### 2.2 Configura Database
```bash
# Installa Supabase CLI
npm install -g supabase

# Login
supabase login

# Link progetto locale
supabase link --project-ref YOUR_PROJECT_REF

# Esegui migrations
supabase db push
```

### 2.3 Crea Storage Bucket
1. Dashboard Supabase → Storage
2. Crea bucket `attachments`
3. Imposta policy pubblica per lettura, RLS per scrittura

### 2.4 Configura Auth
1. Dashboard → Authentication → Providers
2. Abilita Email/Password
3. Disabilita "Confirm email" per testing (riabilita in production)

## 3. Setup Resend (Email)

### 3.1 Crea Account
1. Vai su https://resend.com/signup
2. Verifica email
3. Dashboard → API Keys → Create API Key
4. Annota: `API Key`

### 3.2 Configura Dominio (opzionale)
Per production:
1. Dashboard → Domains → Add Domain
2. Configura DNS records (MX, TXT)
3. Verifica dominio

Per development: usa sandbox domain incluso

## 4. Variabili Ambiente

### 4.1 File `.env.local` (git-ignored)
Crea file nella root del progetto:

```env
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Resend (per Edge Functions)
RESEND_API_KEY=re_xxxxxxxxxx

# Environment
VITE_ENV=development
```

### 4.2 Vercel Environment Variables
Dashboard Vercel → Project → Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `RESEND_API_KEY` (secret)

## 5. Seed Database Iniziale

### 5.1 Crea Admin User
```sql
-- Esegui in Supabase SQL Editor
INSERT INTO auth.users (email, encrypted_password)
VALUES ('admin@tuazienda.com', crypt('password_temp', gen_salt('bf')));

INSERT INTO public.users (id, email, role, full_name)
SELECT id, email, 'admin', 'Amministratore Sistema'
FROM auth.users WHERE email = 'admin@tuazienda.com';
```

### 5.2 Crea Tipologie Richiesta Esempio
```sql
INSERT INTO public.request_types (name, description, fields_schema, is_active)
VALUES 
(
  'Disegno Tecnico',
  'Richiesta elaborazione disegni tecnici',
  '[
    {"name":"tipo_disegno","type":"select","label":"Tipo Disegno","required":true,"options":["Planimetria","Sezione","Prospetto"]},
    {"name":"scala","type":"select","label":"Scala","required":true,"options":["1:50","1:100","1:200"]},
    {"name":"urgente","type":"boolean","label":"Urgente","required":false},
    {"name":"note","type":"textarea","label":"Note Aggiuntive","required":false}
  ]'::jsonb,
  true
),
(
  'Analisi Consumi',
  'Richiesta analisi consumi energetici',
  '[
    {"name":"periodo","type":"select","label":"Periodo Analisi","required":true,"options":["Mensile","Trimestrale","Annuale"]},
    {"name":"tipo_energia","type":"multiselect","label":"Tipo Energia","required":true,"options":["Elettrica","Gas","Termica"]},
    {"name":"edificio","type":"text","label":"Edificio","required":true}
  ]'::jsonb,
  true
);
```

## 6. Avvio Sviluppo Locale

```bash
# Terminal 1 - Frontend
npm run dev
# Apri http://localhost:5173

# Terminal 2 - Supabase Local (opzionale)
supabase start
# Servizi locali su http://localhost:54321
```

## 7. Deploy Vercel

### 7.1 Prima Configurazione
```bash
# Installa Vercel CLI
npm install -g vercel

# Login
vercel login

# Link progetto
vercel link

# Deploy
vercel --prod
```

### 7.2 GitHub Integration (consigliato)
1. Dashboard Vercel → Add New Project
2. Import da GitHub repository
3. Configura Environment Variables
4. Deploy automatico: push su `main` → production

## 8. Supabase Edge Functions Deploy

```bash
# Deploy singola function
supabase functions deploy send-email

# Deploy tutte
supabase functions deploy

# Set secrets
supabase secrets set RESEND_API_KEY=re_xxxxx
```

## 9. VS Code Setup (consigliato)

### 9.1 Extensions
- ESLint
- Prettier - Code formatter
- TypeScript and JavaScript Language Features
- Error Lens
- Supabase Snippets (opzionale)

### 9.2 Settings (`.vscode/settings.json`)
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## 10. Troubleshooting Comuni

### Build Vite Fallisce
```bash
rm -rf node_modules package-lock.json
npm install
```

### Supabase Connection Error
- Verifica `.env.local` corretto
- Controlla Project URL include `https://`
- RLS policies configurate correttamente

### TypeScript Errors
```bash
# Rigenera types Supabase
supabase gen types typescript --local > src/types/supabase.ts
```

### Edge Functions Non Deployano
```bash
# Verifica login
supabase status

# Re-link progetto
supabase link --project-ref YOUR_REF
```

## 11. Comandi Utili

```bash
# Sviluppo
npm run dev              # Avvia dev server
npm run build            # Build production
npm run preview          # Preview build locale
npm run lint             # Controllo ESLint
npm run format           # Format con Prettier
npm test                 # Esegui test Vitest
npm run test:watch       # Test in watch mode

# Supabase
supabase db reset        # Reset DB locale
supabase db diff         # Genera migration da modifiche
supabase gen types       # Genera TypeScript types

# Vercel
vercel dev               # Dev server con env Vercel
vercel --prod            # Deploy production
vercel logs              # Visualizza logs production
```

## 12. Checklist Pre-Production

- [ ] Environment variables configurate su Vercel
- [ ] RLS policies testate per tutti i ruoli
- [ ] Storage bucket policies configurate
- [ ] Resend dominio verificato
- [ ] Email "Confirm email" riabilitata su Supabase Auth
- [ ] Backup database configurato
- [ ] Custom domain configurato (opzionale)
- [ ] SSL verificato
- [ ] Test smoke su tutti flussi principali
- [ ] README.md aggiornato con info progetto

## Supporto
- Supabase Docs: https://supabase.com/docs
- Vite Docs: https://vitejs.dev/guide/
- Vercel Docs: https://vercel.com/docs
- Material UI: https://mui.com/material-ui/getting-started/
