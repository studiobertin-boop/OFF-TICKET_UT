# Script per verificare DNS di officomp.it

Write-Host "`n=== Verifica DNS officomp.it ===" -ForegroundColor Cyan

Write-Host "`n1. Record SPF (TXT):" -ForegroundColor Yellow
nslookup -type=TXT officomp.it | Select-String -Pattern "spf"

Write-Host "`n2. Record MX (Mail Exchange):" -ForegroundColor Yellow
nslookup -type=MX officomp.it

Write-Host "`n3. Record DMARC:" -ForegroundColor Yellow
nslookup -type=TXT _dmarc.officomp.it

Write-Host "`n4. Record DKIM Resend (se già configurati):" -ForegroundColor Yellow
Write-Host "   Checking resend._domainkey..." -ForegroundColor Gray
nslookup -type=CNAME resend._domainkey.officomp.it 2>$null

Write-Host "`n5. Nameservers:" -ForegroundColor Yellow
nslookup -type=NS officomp.it

Write-Host "`n=== Fine Verifica ===" -ForegroundColor Cyan
Write-Host "`nCopia questi risultati per capire la configurazione attuale.`n" -ForegroundColor Green
