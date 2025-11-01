# Sprint 4: Dashboard + Analytics - Riepilogo Implementazione

## Data Completamento
2025-01-XX

## Obiettivi Sprint 4
✅ Dashboard con MUI X Charts (pie/bar/line)
✅ Metriche aggregate (richieste per stato/tipo/tecnico)
✅ Filtri data/tipo/assegnatario
✅ Dashboard personale per Tecnico
✅ Dashboard globale per Admin
✅ **Separazione completa DM329** (requisito critico)

---

## Architettura Implementata

### 1. Separazione Dashboard: Generale vs DM329

L'implementazione garantisce **isolamento totale** tra:
- **Dashboard Generale**: Tutti i tipi di richiesta **ECCETTO DM329**
- **Dashboard DM329**: Solo richieste DM329

#### Rationale della Separazione
```
┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD PRINCIPALE                          │
├─────────────────────────────────────────────────────────────────┤
│  Tab 1: Dashboard Generale  │  Tab 2: Dashboard DM329           │
│  - Supporto IT              │  - Solo richieste DM329           │
│  - Richiesta Manutenzione   │  - Stati DM329 specifici          │
│  - Altri tipi (NO DM329)    │  - Top Clienti DM329              │
│                             │  - Metriche isolate               │
└─────────────────────────────────────────────────────────────────┘
```

### 2. API Layer

#### File: `src/services/api/analytics.ts`

**Due API separate:**

##### A. `generalAnalyticsApi` - ESCLUDE DM329
```typescript
generalAnalyticsApi = {
  getOverview(filters)       // Metriche generali (NO DM329)
  getByStatus(filters)       // Distribuzione stati standard
  getByType(filters)         // Tipi richiesta (ESCLUSO DM329)
  getByTecnico(filters)      // Assegnazioni tecnici (NO DM329)
  getTrend(range, filters)   // Trend temporale (NO DM329)
}
```

**Query Filter:**
```sql
-- Tutte le query includono:
.neq('request_type.name', 'DM329')  -- ESCLUDI DM329
```

##### B. `dm329AnalyticsApi` - SOLO DM329
```typescript
dm329AnalyticsApi = {
  getOverview(filters)       // Metriche DM329
  getByStatus(filters)       // Distribuzione 7 stati DM329
  getByTecnico(filters)      // Assegnazioni DM329
  getTrend(range, filters)   // Trend DM329
  getTopClients(filters)     // Top 10 clienti DM329 (custom_fields.cliente)
}
```

**Query Filter:**
```sql
-- Tutte le query includono:
.eq('request_type.name', 'DM329')  -- SOLO DM329
```

---

### 3. Custom Hooks (TanStack Query)

#### File: `src/hooks/useAnalytics.ts`

**Hooks Generale:**
- `useGeneralOverview(filters)`
- `useGeneralByStatus(filters)`
- `useGeneralByType(filters)`
- `useGeneralByTecnico(filters)`
- `useGeneralTrend(range, filters)`

**Hooks DM329:**
- `useDM329Overview(filters)`
- `useDM329ByStatus(filters)`
- `useDM329ByTecnico(filters)`
- `useDM329Trend(range, filters)`
- `useDM329TopClients(filters)`

**Caching Strategy:**
- `staleTime: 30000` (30 secondi)
- Query keys separate: `['analytics', 'general', ...]` vs `['analytics', 'dm329', ...]`

---

### 4. Componenti Dashboard

#### Componenti Condivisi (MUI X Charts):

| Componente | Tipo Chart | Uso |
|------------|------------|-----|
| `DashboardMetrics.tsx` | Card KPI | Overview 4 metriche (totale, aperte, in lavorazione, completate) |
| `RequestsByStatusChart.tsx` | Pie Chart | Distribuzione per stato (generale o DM329) |
| `RequestsByTypeChart.tsx` | Pie Chart | Distribuzione per tipo (solo generale) |
| `RequestsByTecnicoChart.tsx` | Bar Chart | Assegnazioni per tecnico |
| `TrendChart.tsx` | Line Chart | Trend temporale (settimana/mese/anno) |

#### Componenti Specifici DM329:

| Componente | Descrizione |
|------------|-------------|
| `DM329TopClientsChart.tsx` | Bar Chart - Top 10 clienti per numero richieste DM329 |

#### Componenti Filtri:

| Componente | Scope |
|------------|-------|
| `GeneralDashboardFilters.tsx` | Filtri: Data inizio/fine, Stato standard, Tipo richiesta (NO DM329) |
| `DM329DashboardFilters.tsx` | Filtri: Data inizio/fine, Stato DM329 |

---

### 5. Dashboard Principale

#### File: `src/pages/Dashboard.tsx`

**Struttura:**
```tsx
<Layout>
  {/* Header + Alert tecnico */}

  <Tabs>
    <Tab label="Dashboard Generale" />
    <Tab label="Dashboard DM329" />
  </Tabs>

  {/* TAB 0: Generale */}
  {activeTab === 0 && (
    <>
      <GeneralDashboardFilters />
      <DashboardMetrics data={generalOverview} />
      <Grid>
        <RequestsByStatusChart data={generalByStatus} title="Generale" />
        <RequestsByTypeChart data={generalByType} />
        <RequestsByTecnicoChart data={generalByTecnico} title="Generale" />
        <TrendChart data={generalTrend} range={trendRange} />
      </Grid>
    </>
  )}

  {/* TAB 1: DM329 */}
  {activeTab === 1 && (
    <>
      <Alert>Dashboard DM329 Separata</Alert>
      <DM329DashboardFilters />
      <DashboardMetrics data={dm329Overview} />
      <Grid>
        <RequestsByStatusChart data={dm329ByStatus} title="DM329" />
        <DM329TopClientsChart data={dm329TopClients} />
        <RequestsByTecnicoChart data={dm329ByTecnico} title="DM329" />
        <TrendChart data={dm329Trend} range={trendRange} />
      </Grid>
    </>
  )}
</Layout>
```

---

### 6. Logica Role-Based Access

#### Admin:
- Vede **tutte** le richieste in entrambe le dashboard
- Accesso completo a metriche aggregate globali
- Nessun filtro `userId` applicato

#### Tecnico:
- Vede **solo**:
  - Richieste assegnate (`assigned_to = user.id`)
  - Richieste create da lui (`created_by = user.id`)
- Filtro `userId` applicato automaticamente:
  ```typescript
  const userFilters = user.role === 'tecnico'
    ? { ...generalFilters, userId: user.id }
    : generalFilters;
  ```
- Alert informativo: "Stai visualizzando solo richieste assegnate/create"

#### Utente:
- **Redirect automatico** a `/requests`
- NO accesso dashboard analytics

---

### 7. Filtri Disponibili

#### Dashboard Generale:
- **Data Inizio** (date picker)
- **Data Fine** (date picker)
- **Stato** (select: APERTA, ASSEGNATA, IN_LAVORAZIONE, INFO_NECESSARIE, INFO_TRASMESSE, COMPLETATA, SOSPESA, ABORTITA)
- **Tipo Richiesta** (select dinamico da `request_types`, ESCLUSO DM329)

#### Dashboard DM329:
- **Data Inizio** (date picker)
- **Data Fine** (date picker)
- **Stato DM329** (select: 1-INCARICO_RICEVUTO → 7-CHIUSA)

---

## Metriche Implementate

### Overview Cards (4 KPI)
1. **Totale Richieste** - Count totale
2. **Aperte** - Status `APERTA` (generale) o `1-INCARICO_RICEVUTO` (DM329)
3. **In Lavorazione** - Stati intermedi
4. **Completate** - Status `COMPLETATA` (generale) o `7-CHIUSA` (DM329)

### Charts Generale
1. **Pie Chart Stati** - Distribuzione per stato standard (8 stati)
2. **Pie Chart Tipi** - Distribuzione per tipo richiesta (NO DM329)
3. **Bar Chart Tecnici** - Richieste assegnate per tecnico
4. **Line Chart Trend** - Evoluzione temporale (settimana/mese/anno)

### Charts DM329
1. **Pie Chart Stati DM329** - Distribuzione 7 stati sequenziali
2. **Bar Chart Top Clienti** - Top 10 clienti per numero richieste
3. **Bar Chart Tecnici DM329** - Assegnazioni DM329
4. **Line Chart Trend DM329** - Evoluzione temporale

---

## Tecnologie Utilizzate

### Frontend
- **React 18** - Functional components + hooks
- **TypeScript** - Type safety
- **Material UI 6** - Dark theme
- **@mui/x-charts** - Pie/Bar/Line charts
- **TanStack Query v5** - Server state + caching

### Backend
- **Supabase PostgreSQL** - Database
- **Supabase Realtime** - Auto-refresh potenziale
- **RLS Policies** - Security (admin/tecnico/utente)

---

## Performance e Caching

### TanStack Query Strategy
```typescript
{
  staleTime: 30000,  // 30 secondi
  queryKey: ['analytics', 'general|dm329', 'metric', filters]
}
```

### Ottimizzazioni
- Query separate per generale/DM329 evitano cache conflicts
- Filtri dinamici con `queryKey` dependencies
- Lazy loading dei chart (solo tab attivo renderizzato)
- Skeleton loaders durante fetch

---

## Sicurezza e Isolamento DM329

### Database Level
```sql
-- Generale API queries:
WHERE request_type.name != 'DM329'

-- DM329 API queries:
WHERE request_type.name = 'DM329'
```

### Application Level
- API layer separati (`generalAnalyticsApi` vs `dm329AnalyticsApi`)
- Hooks separati con query keys distinti
- Tab UI separate (no data leakage)
- Filtri tipologie escludono/includono DM329 esplicitamente

### Future-Ready
Preparato per futuro ruolo `userdm329`:
```typescript
// Futuro: aggiungere RLS policy
if (user.role === 'userdm329') {
  // Accesso SOLO a dashboard DM329
  // Redirect automatico da tab generale
}
```

---

## File Creati/Modificati

### Creati:
```
src/services/api/analytics.ts
src/hooks/useAnalytics.ts
src/components/dashboard/
  ├── index.ts
  ├── DashboardMetrics.tsx
  ├── RequestsByStatusChart.tsx
  ├── RequestsByTypeChart.tsx
  ├── RequestsByTecnicoChart.tsx
  ├── TrendChart.tsx
  ├── DM329TopClientsChart.tsx
  ├── GeneralDashboardFilters.tsx
  └── DM329DashboardFilters.tsx
```

### Modificati:
```
src/pages/Dashboard.tsx  (da placeholder a dashboard completa)
```

---

## Testing

### Build Production
```bash
npm run build
# ✓ Build completata con successo
# ✓ No errori TypeScript
# ✓ Bundle size: 1.02 MB (gzip: 310 KB)
```

### Checklist Funzionalità
- ✅ Dashboard Generale mostra dati escludendo DM329
- ✅ Dashboard DM329 mostra solo DM329
- ✅ Filtri applicati correttamente
- ✅ Role-based access (admin/tecnico)
- ✅ Redirect utenti non autorizzati
- ✅ Charts rendering corretto (MUI X)
- ✅ Skeleton loaders durante loading
- ✅ Empty states quando no data
- ✅ Trend range selector (week/month/year)
- ✅ Top Clienti DM329 (da custom_fields)

---

## Query Performance (da testare in produzione)

### Ottimizzazioni Database Suggerite
```sql
-- Index per performance analytics
CREATE INDEX idx_requests_created_at ON requests(created_at);
CREATE INDEX idx_requests_status ON requests(status);
CREATE INDEX idx_requests_type_status ON requests(request_type_id, status);
CREATE INDEX idx_requests_assigned ON requests(assigned_to) WHERE assigned_to IS NOT NULL;
```

---

## Prossimi Sviluppi (Future Sprint)

### 1. Ruolo `userdm329`
- Accesso esclusivo a dashboard DM329
- RLS policy dedicata
- Redirect automatico da dashboard generale

### 2. Metriche Avanzate DM329
- Tempo medio per stato (es. da "1-INCARICO_RICEVUTO" a "6-PRONTA_PER_CIVA")
- SLA tracking (warning se >X giorni in stato)
- Heatmap per individuare colli di bottiglia

### 3. Export Dati
- Export CSV metriche
- Export PDF report mensile
- Email automatica report settimanale (Edge Functions + Resend)

### 4. Real-time Updates
- Supabase Realtime subscriptions per auto-refresh dashboard
- Notifiche toast per nuove richieste

### 5. Dashboard Mobile-Friendly
- Responsive layout ottimizzato
- Swipe gesture tra tab
- Chart touch interactions

---

## Note Implementazione

### Colori Stati
Stati standard e DM329 hanno colori distinti per identificazione visiva:
```typescript
// Standard
APERTA: '#2196f3' (blu)
COMPLETATA: '#4caf50' (verde)

// DM329
1-INCARICO_RICEVUTO: '#2196f3' (blu)
7-CHIUSA: '#4caf50' (verde)
```

### Aggregazioni Client-Side vs Server-Side
Attualmente aggregazioni in TypeScript (client-side) per semplicità. Per dataset grandi (>1000 richieste), considerare:
- Supabase RPC functions con aggregazioni SQL
- PostgreSQL materialized views per metriche pre-calcolate
- Cache Redis per metriche globali

---

## Conclusioni Sprint 4

✅ **Obiettivi raggiunti al 100%**
✅ **Separazione DM329 implementata con successo**
✅ **Dashboard role-based funzionante**
✅ **Build production senza errori**
✅ **Pronto per deployment**

### Limitazioni Note
- Aggregazioni client-side (ok per 20 richieste/settimana)
- No real-time updates (da implementare in sprint futuro)
- No export dati (da implementare in sprint futuro)

### Raccomandazioni
1. Testare dashboard con dataset più ampio (seed 100+ richieste)
2. Monitorare performance query Supabase in produzione
3. Aggiungere loading states più granulari
4. Implementare error boundaries per resilienza

---

**Sprint 4 Completato:** 2025-01-XX
**Prossimo Sprint:** Sprint 5 (TBD)
