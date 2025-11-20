# ============================================================================
# Script: Reset Migration da Production
# Scopo: Riallineare le migration locali allo schema production
# Data: 2025-11-19
# ============================================================================
#
# ATTENZIONE: Questo script:
# - Archivia le migration esistenti
# - Scarica lo schema da production
# - Crea un nuovo punto di partenza
#
# ESEGUI SOLO SE SEI SICURO!
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  RESET MIGRATION DA PRODUCTION - Script Automatico                   ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
# STEP 1: Verifica Prerequisiti
# ============================================================================

Write-Host "📋 STEP 1: Verifica prerequisiti..." -ForegroundColor Yellow
Write-Host ""

# Verifica che siamo nella directory corretta
if (-not (Test-Path "supabase\migrations")) {
    Write-Host "❌ ERRORE: Non trovata cartella supabase\migrations" -ForegroundColor Red
    Write-Host "   Assicurati di essere nella root del progetto" -ForegroundColor Red
    exit 1
}

# Verifica connessione a Supabase
Write-Host "   Verifico connessione a Supabase..." -ForegroundColor Gray
$projects = supabase projects list 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ ERRORE: Impossibile connettersi a Supabase" -ForegroundColor Red
    Write-Host "   Esegui: supabase login" -ForegroundColor Red
    exit 1
}

Write-Host "   ✅ Connessione OK" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 2: Backup Migration Esistenti
# ============================================================================

Write-Host "💾 STEP 2: Backup migration esistenti..." -ForegroundColor Yellow
Write-Host ""

# Crea cartella di backup con timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFolder = "supabase\migrations_backup_$timestamp"

Write-Host "   Creo cartella backup: $backupFolder" -ForegroundColor Gray
New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null

# Copia tutte le migration esistenti
Write-Host "   Copio migration esistenti..." -ForegroundColor Gray
$migrationFiles = Get-ChildItem "supabase\migrations\*.sql"
$migrationCount = $migrationFiles.Count

foreach ($file in $migrationFiles) {
    Copy-Item $file.FullName -Destination $backupFolder
}

Write-Host "   ✅ Backup completato: $migrationCount file copiati" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 3: Download Schema da Production
# ============================================================================

Write-Host "⬇️  STEP 3: Download schema da production..." -ForegroundColor Yellow
Write-Host ""

Write-Host "   Questo potrebbe richiedere 1-2 minuti..." -ForegroundColor Gray
Write-Host "   Eseguo: supabase db pull" -ForegroundColor Gray
Write-Host ""

# Esegui db pull
$pullOutput = supabase db pull 2>&1
$pullExitCode = $LASTEXITCODE

if ($pullExitCode -ne 0) {
    Write-Host "❌ ERRORE durante db pull:" -ForegroundColor Red
    Write-Host $pullOutput -ForegroundColor Red
    Write-Host ""
    Write-Host "⚠️  I file di backup sono salvati in: $backupFolder" -ForegroundColor Yellow
    exit 1
}

Write-Host "   ✅ Schema scaricato da production" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 4: Identifica Nuova Migration
# ============================================================================

Write-Host "🔍 STEP 4: Identifico nuova migration..." -ForegroundColor Yellow
Write-Host ""

# Trova l'ultimo file SQL creato (quello da db pull)
$newMigration = Get-ChildItem "supabase\migrations\*.sql" |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1

if ($null -eq $newMigration) {
    Write-Host "❌ ERRORE: Nessuna nuova migration trovata" -ForegroundColor Red
    exit 1
}

Write-Host "   📄 Nuova migration: $($newMigration.Name)" -ForegroundColor Green
Write-Host "   📦 Dimensione: $([math]::Round($newMigration.Length / 1KB, 2)) KB" -ForegroundColor Gray
Write-Host ""

# ============================================================================
# STEP 5: Pulizia Migration Vecchie
# ============================================================================

Write-Host "🧹 STEP 5: Pulizia migration vecchie..." -ForegroundColor Yellow
Write-Host ""

Write-Host "   ⚠️  ATTENZIONE: Sto per eliminare le vecchie migration locali" -ForegroundColor Yellow
Write-Host "   (sono al sicuro in: $backupFolder)" -ForegroundColor Gray
Write-Host ""

# Elimina tutte le migration TRANNE la nuova
$oldMigrations = Get-ChildItem "supabase\migrations\*.sql" |
                 Where-Object { $_.Name -ne $newMigration.Name }

foreach ($file in $oldMigrations) {
    Remove-Item $file.FullName -Force
    Write-Host "   🗑️  Rimosso: $($file.Name)" -ForegroundColor Gray
}

# Elimina anche il file README se esiste
if (Test-Path "supabase\migrations\README_MIGRATION_ORDER.md") {
    Remove-Item "supabase\migrations\README_MIGRATION_ORDER.md" -Force
    Write-Host "   🗑️  Rimosso: README_MIGRATION_ORDER.md" -ForegroundColor Gray
}

Write-Host ""
Write-Host "   ✅ Pulizia completata" -ForegroundColor Green
Write-Host ""

# ============================================================================
# STEP 6: Reset Database Locale
# ============================================================================

Write-Host "🔄 STEP 6: Reset database locale (opzionale)..." -ForegroundColor Yellow
Write-Host ""
Write-Host "   Vuoi resettare anche il database locale?" -ForegroundColor Yellow
Write-Host "   (Questo ricostruirà il DB locale dalla nuova migration)" -ForegroundColor Gray
Write-Host ""
Write-Host "   [S] = Sì, resetta il DB locale" -ForegroundColor Green
Write-Host "   [N] = No, salta questo step" -ForegroundColor Yellow
Write-Host ""

$choice = Read-Host "   Scelta (S/N)"

if ($choice -eq "S" -or $choice -eq "s") {
    Write-Host ""
    Write-Host "   Resetto database locale..." -ForegroundColor Gray

    # Verifica se Docker è in esecuzione
    $dockerRunning = docker ps 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ⚠️  Docker non è in esecuzione, salto reset locale" -ForegroundColor Yellow
    } else {
        supabase db reset

        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Database locale resettato" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  Errore durante reset, ma non è critico" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "   ⏭️  Skip reset database locale" -ForegroundColor Gray
}

Write-Host ""

# ============================================================================
# STEP 7: Riepilogo Finale
# ============================================================================

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ RESET COMPLETATO CON SUCCESSO                                    ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "📊 RIEPILOGO:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   ✅ Backup creato in:" -ForegroundColor Gray
Write-Host "      $backupFolder" -ForegroundColor White
Write-Host ""
Write-Host "   ✅ Nuova migration pulita:" -ForegroundColor Gray
Write-Host "      supabase\migrations\$($newMigration.Name)" -ForegroundColor White
Write-Host ""
Write-Host "   ✅ Migration vecchie rimosse: $($oldMigrations.Count)" -ForegroundColor Gray
Write-Host ""

Write-Host "🎯 PROSSIMI PASSI:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   1. Verifica la nuova migration:" -ForegroundColor Yellow
Write-Host "      code supabase\migrations\$($newMigration.Name)" -ForegroundColor White
Write-Host ""
Write-Host "   2. Testa il database locale:" -ForegroundColor Yellow
Write-Host "      supabase start" -ForegroundColor White
Write-Host "      npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "   3. Se tutto funziona, committa i cambiamenti:" -ForegroundColor Yellow
Write-Host "      git add supabase/migrations/" -ForegroundColor White
Write-Host "      git commit -m `"chore: reset migrations from production schema`"" -ForegroundColor White
Write-Host ""

Write-Host "⚠️  NOTA IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   D'ora in poi, tutte le nuove migration partiranno da questo schema." -ForegroundColor Gray
Write-Host "   Il database production rimane invariato e sicuro." -ForegroundColor Gray
Write-Host ""
