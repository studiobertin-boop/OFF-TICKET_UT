# Script per fix autenticazione Supabase
Write-Host "🔐 Fix Autenticazione Supabase" -ForegroundColor Cyan
Write-Host ""

# 1. Logout completo
Write-Host "1. Logout da Supabase..." -ForegroundColor Yellow
supabase logout 2>&1 | Out-Null

# 2. Re-login
Write-Host "2. Re-login (si aprirà il browser)..." -ForegroundColor Yellow
Write-Host ""
supabase login

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Login completato" -ForegroundColor Green
    Write-Host ""

    # 3. Verifica progetti
    Write-Host "3. Verifica accesso progetti..." -ForegroundColor Yellow
    supabase projects list

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Autenticazione OK!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Ora riprova il comando che si bloccava" -ForegroundColor Cyan
    }
} else {
    Write-Host ""
    Write-Host "❌ Errore durante login" -ForegroundColor Red
}
