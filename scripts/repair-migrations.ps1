# Script PowerShell per repair migration con retry e timeout
# Esegue i comandi repair uno alla volta con gestione errori

$migrations = @(
    "20251105000003",
    "20251105000004",
    "20251112000001",
    "20251118000000"
)

Write-Host "🔧 Repair Migration - Approccio Sequenziale" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Gray
Write-Host ""

foreach ($migration in $migrations) {
    Write-Host "📝 Registrando migration $migration..." -ForegroundColor Yellow

    # Esegui il comando con timeout di 60 secondi
    $job = Start-Job -ScriptBlock {
        param($ver)
        Set-Location $using:PWD
        supabase migration repair --status applied $ver 2>&1
    } -ArgumentList $migration

    # Aspetta max 60 secondi
    $completed = Wait-Job $job -Timeout 60

    if ($completed) {
        $output = Receive-Job $job
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Migration registrata correttamente" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Errore durante la registrazione:" -ForegroundColor Red
            Write-Host "   $output" -ForegroundColor Red
        }
    } else {
        Write-Host "   ⏱️ Timeout (60s) - Comando bloccato" -ForegroundColor Yellow
        Stop-Job $job
    }

    Remove-Job $job -Force
    Write-Host ""
}

Write-Host "============================================================" -ForegroundColor Gray
Write-Host "✅ Processo completato" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Verifica risultato con: supabase migration list" -ForegroundColor Cyan
