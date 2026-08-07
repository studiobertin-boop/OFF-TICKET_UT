import { ReactNode } from 'react'
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Container,
  ListItemIcon,
  ListItemText,
  Badge,
} from '@mui/material'
import {
  Brightness4 as DarkIcon,
  Brightness7 as LightIcon,
  AccountCircle,
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon,
  Settings as SettingsIcon,
  Category as CategoryIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Factory as FactoryIcon,
  Build as BuildIcon,
  Archive as ArchiveIcon,
  Notifications as NotificationsIcon,
  Receipt as ReceiptIcon,
  PrecisionManufacturing as PrecisionManufacturingIcon,
} from '@mui/icons-material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useThemeMode } from '@/theme'
import { useAuth } from '@/hooks/useAuth'
import { useNotifications } from '@/hooks/useNotifications'
import { Logo } from './Logo'
import NotificationDrawer from './NotificationDrawer'

interface LayoutProps {
  children: ReactNode
}

export const Layout = ({ children }: LayoutProps) => {
  const { mode, toggleTheme } = useThemeMode()
  const { user, signOut } = useAuth()
  const { unreadCount } = useNotifications()
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [adminMenuAnchor, setAdminMenuAnchor] = useState<null | HTMLElement>(null)
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false)

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleAdminMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAdminMenuAnchor(event.currentTarget)
  }

  const handleAdminMenuClose = () => {
    setAdminMenuAnchor(null)
  }

  const handleAdminNavigate = (path: string) => {
    navigate(path)
    handleAdminMenuClose()
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
    handleClose()
  }

  /**
   * Voci del menu di gestione, filtrate per ruolo.
   *
   * Il catalogo apparecchiature è l'unica voce aperta anche a userdm329, che è
   * chi lo usa quotidianamente compilando le schede dati. Per questo il pulsante
   * cambia etichetta: a un non-amministratore «Admin» prometterebbe altro.
   */
  const vociGestione = [
    { path: '/admin/request-types', etichetta: 'Tipi Richieste', icona: <CategoryIcon fontSize="small" />, ruoli: ['admin'] },
    { path: '/admin/users', etichetta: 'Gestione Utenti', icona: <PeopleIcon fontSize="small" />, ruoli: ['admin'] },
    { path: '/admin/customers', etichetta: 'Gestione Clienti', icona: <BusinessIcon fontSize="small" />, ruoli: ['admin'] },
    { path: '/admin/manufacturers', etichetta: 'Gestione Costruttori', icona: <FactoryIcon fontSize="small" />, ruoli: ['admin'] },
    { path: '/admin/installers', etichetta: 'Gestione Installatori', icona: <BuildIcon fontSize="small" />, ruoli: ['admin'] },
    { path: '/admin/equipment-catalog', etichetta: 'Gestisci Apparecchiature', icona: <PrecisionManufacturingIcon fontSize="small" />, ruoli: ['admin', 'userdm329'] },
    { path: '/admin/deletion-archives', etichetta: 'Archivio Eliminazioni', icona: <ArchiveIcon fontSize="small" />, ruoli: ['admin'] },
    { path: '/reports/billing', etichetta: 'Report Fatturazione', icona: <ReceiptIcon fontSize="small" />, ruoli: ['admin'] },
  ].filter(voce => user?.role && voce.ruoli.includes(user.role))

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        {/* La barra portava sette elementi a larghezza fissa in un flex che non poteva
            restringersi: sotto i 768px sfondava in orizzontale su tutta l'applicazione.
            Ora va a capo invece di traboccare, e i due pezzi ridondanti — il nome
            dell'applicazione, che il logo dice già, e il nome dell'utente, che resta
            nel menu del suo avatar — si ritirano prima di arrivarci. Sopra i 900px
            non cambia nulla. */}
        <Toolbar sx={{ flexWrap: 'wrap', rowGap: 1, columnGap: 1 }}>
          <Logo height={40} onClick={() => navigate('/')} />
          <Typography
            variant="h6"
            component="div"
            noWrap
            sx={{ cursor: 'pointer', display: { xs: 'none', md: 'block' } }}
            onClick={() => navigate('/')}
          >
            Sistema Ticketing UT
          </Typography>

          <Box sx={{ flexGrow: 1, display: 'flex', flexWrap: 'wrap', gap: 1, ml: { xs: 0, md: 4 }, minWidth: 0 }}>
            <Button
              color="inherit"
              startIcon={<AssignmentIcon />}
              onClick={() => navigate('/requests')}
            >
              Richieste
            </Button>
            {/* Dashboard per admin, tecnico e userdm329 */}
            {(user?.role === 'admin' || user?.role === 'tecnico' || user?.role === 'userdm329') && (
              <Button
                color="inherit"
                startIcon={<DashboardIcon />}
                onClick={() => navigate('/dashboard')}
              >
                Dashboard
              </Button>
            )}
            {vociGestione.length > 0 && (
              <>
                <Button
                  color="inherit"
                  startIcon={<SettingsIcon />}
                  onClick={handleAdminMenuOpen}
                >
                  {user?.role === 'admin' ? 'Admin' : 'Gestione'}
                </Button>
                <Menu
                  anchorEl={adminMenuAnchor}
                  open={Boolean(adminMenuAnchor)}
                  onClose={handleAdminMenuClose}
                >
                  {vociGestione.map(voce => (
                    <MenuItem key={voce.path} onClick={() => handleAdminNavigate(voce.path)}>
                      <ListItemIcon>{voce.icona}</ListItemIcon>
                      <ListItemText>{voce.etichetta}</ListItemText>
                    </MenuItem>
                  ))}
                </Menu>
              </>
            )}
          </Box>

          <IconButton onClick={toggleTheme} color="inherit">
            {mode === 'dark' ? <LightIcon /> : <DarkIcon />}
          </IconButton>

          {user && (
            <IconButton
              onClick={() => setNotificationDrawerOpen(true)}
              color="inherit"
            >
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          )}

          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Typography variant="body2" noWrap sx={{ display: { xs: 'none', md: 'block' } }}>
                {user.full_name} ({user.role})
              </Typography>
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                <AccountCircle />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem
                  onClick={() => {
                    navigate('/notification-settings')
                    handleClose()
                  }}
                >
                  <ListItemIcon>
                    <NotificationsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Impostazioni Notifiche</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          flex: 1,
          py: 4,
          px: {
            xs: 1,    // 8px mobile
            sm: 2,    // 16px tablet small
            md: 3,    // 24px tablet/desktop
            lg: 3,    // 24px desktop
            xl: 3,    // 24px large desktop
          },
          maxWidth: '2560px',
          mx: 'auto',
          width: '100%',
        }}
      >
        {children}
      </Box>

      <Box
        component="footer"
        sx={{
          py: 2,
          px: 2,
          mt: 'auto',
          backgroundColor: theme => theme.palette.background.paper,
        }}
      >
        <Container maxWidth="sm">
          <Typography variant="body2" color="text.secondary" align="center">
            Sistema Ticketing Ufficio Tecnico © {new Date().getFullYear()}
          </Typography>
        </Container>
      </Box>

      <NotificationDrawer
        open={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
      />
    </Box>
  )
}
