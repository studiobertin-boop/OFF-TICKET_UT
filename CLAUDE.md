# Sistema Ticketing Ufficio Tecnico

## CONTESTO
Web app gestione richieste ufficio tecnico. Ticketing con form dinamici configurabili, workflow stati, notifiche real-time, dashboard analytics. 20 utenti, 20 ticket/settimana.

## STACK
**Frontend:** Vite + React 18 + TypeScript + Material UI 6 (dark) + React Router 6 + React Hook Form + Zod + TanStack Query + MUI X Charts
**Backend:** Supabase (PostgreSQL + Realtime + Storage + Auth + Edge Functions) + Resend
**DevOps:** Git/GitHub + Vercel + ESLint + Prettier + Vitest

## ARCHITETTURA DATABASE

### Tabelle
```
users(id, email, role ENUM[admin,tecnico,utente], full_name)
request_types(id, name, fields_schema JSONB, is_active)
  fields_schema: [{name, type, label, required, options}]
  type: text|textarea|boolean|select|multiselect|file
requests(id, request_type_id, title, status, assigned_to, created_by, 
         custom_fields JSONB, created_at, updated_at)
  status: APERTA|ASSEGNATA|IN_LAVORAZIONE|INFO_NECESSARIE|INFO_TRASMESSE|COMPLETATA|SOSPESA|ABORTITA
request_history(id, request_id, status_from, status_to, changed_by, created_at)
attachments(id, request_id, file_name, file_path, file_size)
notifications(id, user_id, request_id, type, message, read)
```

### RLS
- Admin: accesso totale
- Tecnico: read/update richieste assegnate
- Utente: read/write solo proprie richieste

### Functions
`validate_status_transition(request_id, new_status, user_role) → {valid, message}`

## WORKFLOW STATI

### Standard (Utente/Tecnico)
```
APERTA → ASSEGNATA → IN_LAVORAZIONE ↔ INFO_NECESSARIE ↔ INFO_TRASMESSE → COMPLETATA
```

### Admin
Accesso libero a tutti stati inclusi SOSPESA, ABORTITA

## RUOLI PERMESSI
**Admin:** CRUD completo, cambio stato libero, dashboard globale
**Tecnico:** richieste assegnate, transizioni workflow, dashboard personale  
**Utente:** crea richieste, visualizza proprie, upload allegati

## STRUTTURA REPOSITORY
```
/src
  /components/{common,requests,dashboard}
  /pages/{Dashboard,Requests,Admin,Login}
  /hooks  /services  /types  /utils  /theme
/supabase
  /functions  /migrations  /seed
/tests
```

## FUNZIONALITÀ CORE
- **Form dinamici:** rendering condizionale da fields_schema, validazione Zod generata
- **Notifiche:** in-app via Realtime subscriptions, email via Edge Functions + Resend
- **Dashboard:** charts MUI X (pie/bar/line), metriche aggregate, filtri date/tipo/tecnico
- **Allegati:** drag-drop, Supabase Storage, max 10MB, preview PDF/immagini

## CONVENZIONI
**TypeScript:** strict=false, interfaces per props, Zod per runtime validation
**React:** functional components, error boundaries, loading states, TanStack Query per server state
**Git:** Conventional Commits, PR per feature, push diretto per hotfix
**Test:** Vitest per workflow logic, validations, calculations (no UI test)

## RIFERIMENTI
Dettagli setup: SETUP.md
Processo sviluppo: WORKFLOW.md
Docs: supabase.com/docs | mui.com | tanstack.com/query
