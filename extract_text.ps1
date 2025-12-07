[xml]$xml = Get-Content 'c:\Users\User14\OneDrive - Studio Bertin\STUDIOBERTIN\SVILUPPO\OFF-TICKET_UT\template_dump.txt'
$nsManager = New-Object System.Xml.XmlNamespaceManager($xml.NameTable)
$nsManager.AddNamespace("w", "http://schemas.openxmlformats.org/wordprocessingml/2006/main")
$outputPath = 'c:\Users\User14\OneDrive - Studio Bertin\STUDIOBERTIN\SVILUPPO\OFF-TICKET_UT\clean_template_text.txt'
$output = @()

foreach ($p in $xml.SelectNodes("//w:p", $nsManager)) {
    $text = ""
    foreach ($t in $p.SelectNodes(".//w:t", $nsManager)) {
        $text += $t.InnerText
    }
    if ($text.Trim().Length -gt 0) {
        $output += $text
    }
}

$output | Out-File $outputPath -Encoding UTF8
