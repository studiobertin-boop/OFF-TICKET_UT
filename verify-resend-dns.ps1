# Verifica configurazione DNS per Resend

Write-Host "`n=== Verifica DNS Resend per officomp.it ===" -ForegroundColor Cyan

Write-Host "`n1. Verifica SPF (deve includere Resend):" -ForegroundColor Yellow
$spf = nslookup -type=TXT officomp.it 2>$null | Select-String -Pattern "spf"
Write-Host $spf -ForegroundColor White

if ($spf -match "_spf.resend.com") {
    Write-Host "   ✅ SPF configurato correttamente!" -ForegroundColor Green
} else {
    Write-Host "   ❌ SPF NON contiene _spf.resend.com" -ForegroundColor Red
}

Write-Host "`n2. Verifica DKIM 1:" -ForegroundColor Yellow
$dkim1 = nslookup -type=CNAME resend._domainkey.officomp.it 2>$null | Select-String -Pattern "canonical"
if ($dkim1) {
    Write-Host $dkim1 -ForegroundColor White
    Write-Host "   ✅ DKIM 1 configurato!" -ForegroundColor Green
} else {
    Write-Host "   ❌ DKIM 1 NON trovato" -ForegroundColor Red
}

Write-Host "`n3. Verifica DKIM 2:" -ForegroundColor Yellow
$dkim2 = nslookup -type=CNAME resend2._domainkey.officomp.it 2>$null | Select-String -Pattern "canonical"
if ($dkim2) {
    Write-Host $dkim2 -ForegroundColor White
    Write-Host "   ✅ DKIM 2 configurato!" -ForegroundColor Green
} else {
    Write-Host "   ❌ DKIM 2 NON trovato" -ForegroundColor Red
}

Write-Host "`n4. Verifica DKIM 3:" -ForegroundColor Yellow
$dkim3 = nslookup -type=CNAME resend3._domainkey.officomp.it 2>$null | Select-String -Pattern "canonical"
if ($dkim3) {
    Write-Host $dkim3 -ForegroundColor White
    Write-Host "   ✅ DKIM 3 configurato!" -ForegroundColor Green
} else {
    Write-Host "   ❌ DKIM 3 NON trovato" -ForegroundColor Red
}

Write-Host "`n5. Verifica DMARC:" -ForegroundColor Yellow
$dmarc = nslookup -type=TXT _dmarc.officomp.it 2>$null | Select-String -Pattern "DMARC"
if ($dmarc) {
    Write-Host $dmarc -ForegroundColor White
    Write-Host "   ✅ DMARC configurato!" -ForegroundColor Green
} else {
    Write-Host "   ❌ DMARC NON trovato" -ForegroundColor Red
}

Write-Host "`n=== Fine Verifica ===" -ForegroundColor Cyan
Write-Host "`nSe vedi ✅ per tutti i record, puoi procedere alla verifica su Resend!`n" -ForegroundColor Green
