# =====================================================
# Setup Email Notification Secrets - Supabase
# =====================================================
# Questo script configura tutti i secrets necessari
# per il sistema di notifiche email
# =====================================================

Write-Host "🔐 Configurazione Secrets Supabase per Email Notifications" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# Check if supabase CLI is installed
$supabaseCmd = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabaseCmd) {
    Write-Host "❌ Errore: Supabase CLI non installato" -ForegroundColor Red
    Write-Host "   Installa con: npm install -g supabase" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Supabase CLI trovato" -ForegroundColor Green
Write-Host ""

# Check if logged in
$null = supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Non sei autenticato con Supabase" -ForegroundColor Red
    Write-Host "   Esegui: supabase login" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Autenticato con Supabase" -ForegroundColor Green
Write-Host ""

# Set secrets
Write-Host "📧 Configurazione secrets..." -ForegroundColor Cyan
Write-Host ""

Write-Host "1/3 Impostazione RESEND_API_KEY..." -ForegroundColor Yellow
supabase secrets set RESEND_API_KEY=re_gmvhhY1N_3muRNSkMKLKZwfYJ9egpKfas
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ RESEND_API_KEY configurato" -ForegroundColor Green
} else {
    Write-Host "   ❌ Errore configurazione RESEND_API_KEY" -ForegroundColor Red
    exit 1
}

Write-Host "2/3 Impostazione EMAIL_FROM..." -ForegroundColor Yellow
supabase secrets set EMAIL_FROM=notifiche@officomp.it
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ EMAIL_FROM configurato" -ForegroundColor Green
} else {
    Write-Host "   ❌ Errore configurazione EMAIL_FROM" -ForegroundColor Red
    exit 1
}

Write-Host "3/3 Impostazione APP_URL..." -ForegroundColor Yellow
supabase secrets set APP_URL=https://off-ticket-ut.vercel.app
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ APP_URL configurato" -ForegroundColor Green
} else {
    Write-Host "   ❌ Errore configurazione APP_URL" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "✅ Tutti i secrets sono stati configurati con successo!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Prossimi passi:" -ForegroundColor Cyan
Write-Host "   1. Deploy Edge Functions:" -ForegroundColor Yellow
Write-Host "      supabase functions deploy send-notification-email"
Write-Host "      supabase functions deploy test-notification-email"
Write-Host ""
Write-Host "   2. Applica migration database:" -ForegroundColor Yellow
Write-Host "      supabase db push"
Write-Host "      (oppure copia manualmente da SQL Editor)"
Write-Host ""
Write-Host "   3. Configura database settings (esegui nel SQL Editor):" -ForegroundColor Yellow
Write-Host "      ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';"
Write-Host "      ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'YOUR_ANON_KEY';"
Write-Host ""
Write-Host "   4. Testa invio email (come admin):" -ForegroundColor Yellow
Write-Host "      Invoke-WebRequest -Uri 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/test-notification-email' \"
Write-Host "        -Method POST -Headers @{'Authorization'='Bearer YOUR_JWT_TOKEN'}"
Write-Host ""
Write-Host "📖 Documentazione completa: DOCUMENTAZIONE\EMAIL_NOTIFICATIONS_SETUP.md" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
