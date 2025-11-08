# Test Edge Function con curl
# NOTA: Devi essere loggato e avere un token valido

Write-Host "=== Test Edge Function test-notification-email ===" -ForegroundColor Cyan

# Chiedi il token all'utente
Write-Host "`nPer ottenere il token:" -ForegroundColor Yellow
Write-Host "1. Apri l'app in browser (https://off-ticket-ut.vercel.app)" -ForegroundColor Yellow
Write-Host "2. Fai login come admin" -ForegroundColor Yellow
Write-Host "3. Apri DevTools (F12) > Application > Local Storage" -ForegroundColor Yellow
Write-Host "4. Cerca 'sb-uphftgpwisdiubuhohnc-auth-token'" -ForegroundColor Yellow
Write-Host "5. Copia il valore di 'access_token'`n" -ForegroundColor Yellow

$token = Read-Host "Incolla qui il token"

if (-not $token) {
    Write-Host "❌ Token non fornito" -ForegroundColor Red
    exit 1
}

Write-Host "`nToken ricevuto: $($token.Substring(0, [Math]::Min(20, $token.Length)))..." -ForegroundColor Green

$url = "https://uphftgpwisdiubuhohnc.supabase.co/functions/v1/test-notification-email"
$anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwaGZ0Z3B3aXNkaXVidWhvaG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5MjYyMzQsImV4cCI6MjA0NjUwMjIzNH0.Nt3n1axV5TaDPSXrzaO0PLd78pJ-T2CdhTIKJdmhEPY"

Write-Host "`nChiamata a: $url" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $url `
        -Method POST `
        -Headers @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $token"
            "apikey" = $anonKey
        } `
        -UseBasicParsing

    Write-Host "`n=== Response ===" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Body:" -ForegroundColor Green
    Write-Host $response.Content -ForegroundColor White

} catch {
    Write-Host "`n=== Error ===" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red

    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body = $reader.ReadToEnd()
        Write-Host "Body: $body" -ForegroundColor Red
    }
}

Write-Host "`n=== Controlla ora i log su Supabase ===" -ForegroundColor Cyan
Write-Host "Dashboard > Functions > test-notification-email > Logs" -ForegroundColor Yellow
