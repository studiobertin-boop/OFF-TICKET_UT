import { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  useTheme,
} from '@mui/material';
import { Layout } from '@/components/common/Layout';
import { useThemeMode } from '@/theme';
import { getStatusHex } from '@/theme/statusColors';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

// Analytics hooks
import {
  useGeneralOverview,
  useGeneralByStatus,
  useGeneralByType,
  useGeneralByRequester,
  useGeneralTrend,
  useGeneralCompletionTimeTrend,
  useDM329Overview,
  useDM329ByStatus,
  useDM329Trend,
  useDM329CompletionTimeTrend,
  useDM329TransitionTimes,
} from '@/hooks/useAnalytics';
import { useRecentActivity } from '@/hooks/useActivity';

// Components
import { StatusTiles } from '@/components/dashboard/StatusTiles';
import { RequestsByStatusChart } from '@/components/dashboard/RequestsByStatusChart';
import { RequestsByTypeChart } from '@/components/dashboard/RequestsByTypeChart';
import { RequestsByTecnicoChart } from '@/components/dashboard/RequestsByTecnicoChart';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { AvgTimeChart } from '@/components/dashboard/AvgTimeChart';
import { DM329TransitionChart } from '@/components/dashboard/DM329TransitionChart';
import { GeneralDashboardFilters } from '@/components/dashboard/GeneralDashboardFilters';
import { DM329DashboardFilters } from '@/components/dashboard/DM329DashboardFilters';
import { RecentActivityFeed } from '@/components/dashboard/RecentActivityFeed';

import type { GeneralAnalyticsFilters, DM329AnalyticsFilters } from '@/services/api/analytics';

export const Dashboard = () => {
  const { user } = useAuth();
  const { mode } = useThemeMode();
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Tab iniziale: ?tab=dm329 / ?tab=generale hanno precedenza,
  // altrimenti userdm329 parte dal tab DM329 (tab 1), gli altri dal generale (tab 0)
  const tabParam = searchParams.get('tab');
  const initialTab =
    tabParam === 'dm329' ? 1 : tabParam === 'generale' ? 0 : user?.role === 'userdm329' ? 1 : 0;
  const [activeTab, setActiveTab] = useState(initialTab);

  // Naviga alla lista richieste già filtrata per lo stato cliccato
  const goToRequestsList = (listTab: 'generale' | 'dm329', stato?: string) => {
    const params = new URLSearchParams({ listTab, view: 'table' });
    if (stato) params.set('stato', stato);
    navigate(`/requests?${params.toString()}`);
  };
  const [trendRange, setTrendRange] = useState<'week' | 'month' | 'year'>('month');

  // Filtri
  const [generalFilters, setGeneralFilters] = useState<GeneralAnalyticsFilters>({});
  const [dm329Filters, setDM329Filters] = useState<DM329AnalyticsFilters>({});

  // Redirect utente non autorizzato (solo admin, tecnici e userdm329 possono accedere)
  if (user?.role === 'utente') {
    return <Navigate to="/requests" replace />;
  }

  // userdm329 può vedere solo il tab DM329, admin e tecnici vedono tutto
  const canViewGeneralDashboard = user?.role !== 'userdm329';

  // Filtro per tecnico (vede solo assegnate + create)
  const userFilters =
    user?.role === 'tecnico'
      ? { ...generalFilters, userId: user.id }
      : generalFilters;

  const dm329UserFilters =
    user?.role === 'tecnico'
      ? { ...dm329Filters, userId: user.id }
      : dm329Filters;

  // ========== QUERIES GENERALE ==========
  const generalOverview = useGeneralOverview(userFilters);
  const generalByStatus = useGeneralByStatus(userFilters);
  const generalByType = useGeneralByType(userFilters);
  const generalByRequester = useGeneralByRequester(userFilters);
  const generalTrend = useGeneralTrend(trendRange, userFilters);
  const generalCompletionTimeTrend = useGeneralCompletionTimeTrend(trendRange, userFilters);

  // ========== QUERIES DM329 ==========
  const dm329Overview = useDM329Overview(dm329UserFilters);
  const dm329ByStatus = useDM329ByStatus(dm329UserFilters);
  const dm329Trend = useDM329Trend(trendRange, dm329UserFilters);
  const dm329CompletionTimeTrend = useDM329CompletionTimeTrend(trendRange, dm329UserFilters);
  const dm329TransitionTimes = useDM329TransitionTimes(dm329UserFilters);

  // ========== RECENT ACTIVITY ==========
  const generalActivity = useRecentActivity(undefined, 20);
  const dm329Activity = useRecentActivity('DM329', 20);

  return (
    <Layout>
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Benvenuto, {user?.full_name}! (
          {user?.role === 'admin' ? 'Amministratore' :
           user?.role === 'userdm329' ? 'Utente DM329' :
           'Tecnico'})
        </Typography>

        {user?.role === 'tecnico' && (
          <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
            Stai visualizzando solo le richieste assegnate a te o create da te.
          </Alert>
        )}

        {user?.role === 'userdm329' && (
          <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
            Stai visualizzando tutte le richieste DM329.
          </Alert>
        )}

        {/* Tabs: Generale vs DM329 */}
        {canViewGeneralDashboard && (
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 3 }}>
            <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
              <Tab label="Dashboard Generale" />
              <Tab label="Dashboard DM329" />
            </Tabs>
          </Box>
        )}

        {!canViewGeneralDashboard && (
          <Box sx={{ mt: 3 }}>
            <Alert severity="info">
              Stai visualizzando la Dashboard DM329
            </Alert>
          </Box>
        )}

        {/* ========== TAB 0: DASHBOARD GENERALE ========== */}
        {activeTab === 0 && canViewGeneralDashboard && (
          <Box sx={{ mt: 3 }}>
            {/* Tiles Stati */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Richieste per Stato
              </Typography>
              <StatusTiles
                tiles={[
                  {
                    label: 'Aperte',
                    count: generalOverview.data?.openRequests || 0,
                    color: getStatusHex('APERTA', mode),
                    onClick: () => goToRequestsList('generale', 'APERTA'),
                  },
                  {
                    label: 'In Lavorazione',
                    count: generalOverview.data?.inProgressRequests || 0,
                    color: getStatusHex('IN_LAVORAZIONE', mode),
                    onClick: () => goToRequestsList('generale', 'IN_LAVORAZIONE'),
                  },
                  {
                    label: 'Completate',
                    count: generalOverview.data?.completedRequests || 0,
                    color: getStatusHex('COMPLETATA', mode),
                    onClick: () => goToRequestsList('generale', 'COMPLETATA'),
                  },
                  {
                    label: 'Bloccate',
                    count: generalOverview.data?.blockedRequests || 0,
                    color: getStatusHex('BLOCCATA', mode),
                    onClick: () => goToRequestsList('generale', 'BLOCCATA'),
                  },
                  {
                    label: 'Attive',
                    count: generalOverview.data?.activeRequests || 0,
                    color: theme.palette.primary.main,
                    onClick: () => goToRequestsList('generale'),
                  },
                ]}
                isLoading={generalOverview.isLoading}
              />
            </Box>

            {/* Filtri */}
            <GeneralDashboardFilters onFilterChange={setGeneralFilters} />

            {/* Charts */}
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {/* Row 1: Grafici a torta distribuzione */}
              <Grid item xs={12} md={6}>
                <RequestsByTypeChart
                  data={generalByType.data}
                  isLoading={generalByType.isLoading}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <RequestsByStatusChart
                  data={generalByStatus.data}
                  isLoading={generalByStatus.isLoading}
                  title="Richieste per Stato"
                />
              </Grid>

              {/* Row 2: Grafico richiedenti + Attività recenti */}
              <Grid item xs={12} md={6}>
                <RequestsByTecnicoChart
                  data={generalByRequester.data}
                  isLoading={generalByRequester.isLoading}
                  title="Richieste per Richiedente"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <RecentActivityFeed
                  data={generalActivity.data}
                  isLoading={generalActivity.isLoading}
                  title="Ultime Attività"
                />
              </Grid>

              {/* Row 3: Grafici trend temporali */}
              <Grid item xs={12} md={6}>
                <Box>
                  <FormControl size="small" sx={{ mb: 2, minWidth: 150 }}>
                    <InputLabel>Periodo</InputLabel>
                    <Select
                      value={trendRange}
                      label="Periodo"
                      onChange={e => setTrendRange(e.target.value as any)}
                    >
                      <MenuItem value="day">Giorno</MenuItem>
                      <MenuItem value="week">Settimana</MenuItem>
                      <MenuItem value="month">Mese</MenuItem>
                      <MenuItem value="year">Anno</MenuItem>
                    </Select>
                  </FormControl>
                  <TrendChart
                    data={generalTrend.data}
                    isLoading={generalTrend.isLoading}
                    title="Storico Nuove Richieste"
                    range={trendRange}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box>
                  <FormControl size="small" sx={{ mb: 2, minWidth: 150 }}>
                    <InputLabel>Periodo</InputLabel>
                    <Select
                      value={trendRange}
                      label="Periodo"
                      onChange={e => setTrendRange(e.target.value as any)}
                    >
                      <MenuItem value="day">Giorno</MenuItem>
                      <MenuItem value="week">Settimana</MenuItem>
                      <MenuItem value="month">Mese</MenuItem>
                      <MenuItem value="year">Anno</MenuItem>
                    </Select>
                  </FormControl>
                  <AvgTimeChart
                    data={generalCompletionTimeTrend.data}
                    isLoading={generalCompletionTimeTrend.isLoading}
                    title="Tempo Medio Completamento (al netto blocchi)"
                    range={trendRange}
                  />
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* ========== TAB 1: DASHBOARD DM329 ========== */}
        {activeTab === 1 && (
          <Box sx={{ mt: 3 }}>
            <Alert severity="info" sx={{ mb: 3 }}>
              <strong>Dashboard DM329</strong> - Visualizzazione separata per richieste DM329
            </Alert>

            {/* Tiles Stati DM329 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                Richieste DM329 per Stato
              </Typography>
              <StatusTiles
                tiles={[
                  {
                    label: '1 - Incarico Ricevuto',
                    count: dm329Overview.data?.status1 || 0,
                    color: getStatusHex('1-INCARICO_RICEVUTO', mode),
                    onClick: () => goToRequestsList('dm329', '1-INCARICO_RICEVUTO'),
                  },
                  {
                    label: '2 - Scheda Dati Pronta',
                    count: dm329Overview.data?.status2 || 0,
                    color: getStatusHex('2-SCHEDA_DATI_PRONTA', mode),
                    onClick: () => goToRequestsList('dm329', '2-SCHEDA_DATI_PRONTA'),
                  },
                  {
                    label: '3 - Mail Cliente Inviata',
                    count: dm329Overview.data?.status3 || 0,
                    color: getStatusHex('3-MAIL_CLIENTE_INVIATA', mode),
                    onClick: () => goToRequestsList('dm329', '3-MAIL_CLIENTE_INVIATA'),
                  },
                  {
                    label: '4 - Documenti Pronti',
                    count: dm329Overview.data?.status4 || 0,
                    color: getStatusHex('4-DOCUMENTI_PRONTI', mode),
                    onClick: () => goToRequestsList('dm329', '4-DOCUMENTI_PRONTI'),
                  },
                  {
                    label: '5 - Attesa Firma',
                    count: dm329Overview.data?.status5 || 0,
                    color: getStatusHex('5-ATTESA_FIRMA', mode),
                    onClick: () => goToRequestsList('dm329', '5-ATTESA_FIRMA'),
                  },
                  {
                    label: '6 - Pronta per CIVA',
                    count: dm329Overview.data?.status6 || 0,
                    color: getStatusHex('6-PRONTA_PER_CIVA', mode),
                    onClick: () => goToRequestsList('dm329', '6-PRONTA_PER_CIVA'),
                  },
                  {
                    label: '7 - Chiusa',
                    count: dm329Overview.data?.status7 || 0,
                    color: getStatusHex('7-CHIUSA', mode),
                    onClick: () => goToRequestsList('dm329', '7-CHIUSA'),
                  },
                  {
                    label: 'Archiviata Non Finita',
                    count: dm329Overview.data?.statusArchived || 0,
                    color: getStatusHex('ARCHIVIATA NON FINITA', mode),
                    onClick: () => goToRequestsList('dm329', 'ARCHIVIATA NON FINITA'),
                  },
                  {
                    label: 'Totali Attive',
                    count: dm329Overview.data?.totalActive || 0,
                    color: theme.palette.primary.main,
                    onClick: () => goToRequestsList('dm329'),
                  },
                ]}
                isLoading={dm329Overview.isLoading}
              />
            </Box>

            {/* Filtri DM329 */}
            <DM329DashboardFilters onFilterChange={setDM329Filters} />

            {/* Charts DM329 */}
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {/* Row 1: Distribuzione stati + Storico richieste */}
              <Grid item xs={12} md={6}>
                <RequestsByStatusChart
                  data={dm329ByStatus.data}
                  isLoading={dm329ByStatus.isLoading}
                  title="Distribuzione Stati DM329"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Box>
                  <FormControl size="small" sx={{ mb: 2, minWidth: 150 }}>
                    <InputLabel>Periodo</InputLabel>
                    <Select
                      value={trendRange}
                      label="Periodo"
                      onChange={e => setTrendRange(e.target.value as any)}
                    >
                      <MenuItem value="day">Giorno</MenuItem>
                      <MenuItem value="week">Settimana</MenuItem>
                      <MenuItem value="month">Mese</MenuItem>
                      <MenuItem value="year">Anno</MenuItem>
                    </Select>
                  </FormControl>
                  <TrendChart
                    data={dm329Trend.data}
                    isLoading={dm329Trend.isLoading}
                    title="Storico Richieste DM329"
                    range={trendRange}
                  />
                </Box>
              </Grid>

              {/* Row 2: Tempo medio completamento + Attività recenti */}
              <Grid item xs={12} md={6}>
                <Box>
                  <FormControl size="small" sx={{ mb: 2, minWidth: 150 }}>
                    <InputLabel>Periodo</InputLabel>
                    <Select
                      value={trendRange}
                      label="Periodo"
                      onChange={e => setTrendRange(e.target.value as any)}
                    >
                      <MenuItem value="day">Giorno</MenuItem>
                      <MenuItem value="week">Settimana</MenuItem>
                      <MenuItem value="month">Mese</MenuItem>
                      <MenuItem value="year">Anno</MenuItem>
                    </Select>
                  </FormControl>
                  <AvgTimeChart
                    data={dm329CompletionTimeTrend.data}
                    isLoading={dm329CompletionTimeTrend.isLoading}
                    title="Tempo Medio Apertura-Chiusura"
                    range={trendRange}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <RecentActivityFeed
                  data={dm329Activity.data}
                  isLoading={dm329Activity.isLoading}
                  title="Ultime Attività DM329"
                />
              </Grid>

              {/* Row 3: Tempi transizioni (full width) */}
              <Grid item xs={12}>
                <DM329TransitionChart
                  data={dm329TransitionTimes.data}
                  isLoading={dm329TransitionTimes.isLoading}
                  title="Tempi Medi Transizioni tra Stati"
                />
              </Grid>
            </Grid>
          </Box>
        )}
      </Box>
    </Layout>
  );
};
