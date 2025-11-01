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
} from '@mui/material';
import { Layout } from '@/components/common/Layout';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

// Analytics hooks
import {
  useGeneralOverview,
  useGeneralByStatus,
  useGeneralByType,
  useGeneralByTecnico,
  useGeneralTrend,
  useDM329Overview,
  useDM329ByStatus,
  useDM329ByTecnico,
  useDM329Trend,
  useDM329TopClients,
} from '@/hooks/useAnalytics';

// Components
import { DashboardMetrics } from '@/components/dashboard/DashboardMetrics';
import { RequestsByStatusChart } from '@/components/dashboard/RequestsByStatusChart';
import { RequestsByTypeChart } from '@/components/dashboard/RequestsByTypeChart';
import { RequestsByTecnicoChart } from '@/components/dashboard/RequestsByTecnicoChart';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { DM329TopClientsChart } from '@/components/dashboard/DM329TopClientsChart';
import { GeneralDashboardFilters } from '@/components/dashboard/GeneralDashboardFilters';
import { DM329DashboardFilters } from '@/components/dashboard/DM329DashboardFilters';

import type { GeneralAnalyticsFilters, DM329AnalyticsFilters } from '@/services/api/analytics';

export const Dashboard = () => {
  const { user } = useAuth();
  // Se è userdm329, parte dal tab DM329 (tab 1), altrimenti dal tab generale (tab 0)
  const [activeTab, setActiveTab] = useState(user?.role === 'userdm329' ? 1 : 0);
  const [trendRange, setTrendRange] = useState<'week' | 'month' | 'year'>('month');

  // Filtri
  const [generalFilters, setGeneralFilters] = useState<GeneralAnalyticsFilters>({});
  const [dm329Filters, setDM329Filters] = useState<DM329AnalyticsFilters>({});

  // Redirect utente non autorizzato (solo admin e tecnici per dashboard generale)
  if (user?.role === 'utente') {
    return <Navigate to="/requests" replace />;
  }

  // Se è userdm329, forza il tab DM329 e nascondi il tab generale
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
  const generalByTecnico = useGeneralByTecnico(userFilters);
  const generalTrend = useGeneralTrend(trendRange, userFilters);

  // ========== QUERIES DM329 ==========
  const dm329Overview = useDM329Overview(dm329UserFilters);
  const dm329ByStatus = useDM329ByStatus(dm329UserFilters);
  const dm329ByTecnico = useDM329ByTecnico(dm329UserFilters);
  const dm329Trend = useDM329Trend(trendRange, dm329UserFilters);
  const dm329TopClients = useDM329TopClients(dm329UserFilters);

  return (
    <Layout>
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard Analytics
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Benvenuto, {user?.full_name}! ({user?.role === 'admin' ? 'Amministratore' : 'Tecnico'})
        </Typography>

        {user?.role === 'tecnico' && (
          <Alert severity="info" sx={{ mt: 2, mb: 3 }}>
            Stai visualizzando solo le richieste assegnate a te o create da te.
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
            {/* Filtri */}
            <GeneralDashboardFilters onFilterChange={setGeneralFilters} />

            {/* Metriche Overview */}
            <Box sx={{ mt: 3 }}>
              <DashboardMetrics
                metrics={generalOverview.data}
                isLoading={generalOverview.isLoading}
              />
            </Box>

            {/* Charts */}
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <RequestsByStatusChart
                  data={generalByStatus.data}
                  isLoading={generalByStatus.isLoading}
                  title="Richieste Generali per Stato"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <RequestsByTypeChart
                  data={generalByType.data}
                  isLoading={generalByType.isLoading}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <RequestsByTecnicoChart
                  data={generalByTecnico.data}
                  isLoading={generalByTecnico.isLoading}
                  title="Richieste Generali per Tecnico"
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
                      <MenuItem value="week">Settimana</MenuItem>
                      <MenuItem value="month">Mese</MenuItem>
                      <MenuItem value="year">Anno</MenuItem>
                    </Select>
                  </FormControl>
                  <TrendChart
                    data={generalTrend.data}
                    isLoading={generalTrend.isLoading}
                    title="Trend Richieste Generali"
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
            <Alert severity="warning" sx={{ mb: 3 }}>
              <strong>Dashboard DM329</strong> - Visualizzazione separata per richieste DM329
            </Alert>

            {/* Filtri DM329 */}
            <DM329DashboardFilters onFilterChange={setDM329Filters} />

            {/* Metriche Overview DM329 */}
            <Box sx={{ mt: 3 }}>
              <DashboardMetrics
                metrics={dm329Overview.data}
                isLoading={dm329Overview.isLoading}
              />
            </Box>

            {/* Charts DM329 */}
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <RequestsByStatusChart
                  data={dm329ByStatus.data}
                  isLoading={dm329ByStatus.isLoading}
                  title="Distribuzione Stati DM329"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <DM329TopClientsChart
                  data={dm329TopClients.data}
                  isLoading={dm329TopClients.isLoading}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <RequestsByTecnicoChart
                  data={dm329ByTecnico.data}
                  isLoading={dm329ByTecnico.isLoading}
                  title="Richieste DM329 per Tecnico"
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
                      <MenuItem value="week">Settimana</MenuItem>
                      <MenuItem value="month">Mese</MenuItem>
                      <MenuItem value="year">Anno</MenuItem>
                    </Select>
                  </FormControl>
                  <TrendChart
                    data={dm329Trend.data}
                    isLoading={dm329Trend.isLoading}
                    title="Trend Richieste DM329"
                    range={trendRange}
                  />
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}
      </Box>
    </Layout>
  );
};
