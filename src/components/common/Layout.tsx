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
  Description as TemplateIcon,
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Logo height={40} onClick={() => navigate('/')} />
          <Typography
            variant="h6"
            component="div"
            sx={{ cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            Sistema Ticketing UT
          </Typography>

          <Box sx={{ flexGrow: 1, display: 'flex', gap: 2, ml: 4 }}>
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
            {user?.role === 'admin' && (
              <>
                <Button
                  color="inherit"
                  startIcon={<SettingsIcon />}
                  onClick={handleAdminMenuOpen}
                >
                  Admin
                </Button>
                <Menu
                  anchorEl={adminMenuAnchor}
                  open={Boolean(adminMenuAnchor)}
                  onClose={handleAdminMenuClose}
                >
                  <MenuItem onClick={() => handleAdminNavigate('/admin/request-types')}>
                    <ListItemIcon>
                      <CategoryIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Tipi Richieste</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => handleAdminNavigate('/admin/users')}>
                    <ListItemIcon>
                      <PeopleIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Gestione Utenti</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => handleAdminNavigate('/admin/customers')}>
                    <ListItemIcon>
                      <BusinessIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Gestione Clienti</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => handleAdminNavigate('/admin/manufacturers')}>
                    <ListItemIcon>
                      <FactoryIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Gestione Costruttori</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => handleAdminNavigate('/admin/installers')}>
                    <ListItemIcon>
                      <BuildIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Gestione Installatori</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => handleAdminNavigate('/templates')}>
                    <ListItemIcon>
                      <TemplateIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Template Documenti</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={() => handleAdminNavigate('/admin/deletion-archives')}>
                    <ListItemIcon>
                      <ArchiveIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Archivio Eliminazioni</ListItemText>
                  </MenuItem>
                </Menu>
              </>
            )}
          </Box>

          <IconButton sx={{ mr: 1 }} onClick={toggleTheme} color="inherit">
            {mode === 'dark' ? <LightIcon /> : <DarkIcon />}
          </IconButton>

          {user && (
            <IconButton
              sx={{ mr: 1 }}
              onClick={() => setNotificationDrawerOpen(true)}
              color="inherit"
            >
              <Badge badgeContent={unreadCount} color="error">
                <NotificationsIcon />
              </Badge>
            </IconButton>
          )}

          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">
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
