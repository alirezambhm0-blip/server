# sync-audit.ps1 — ممیزی فقط‌خواندنی: مقایسه فایل‌های محلی با نسخه تأییدشده
# هیچ فایلی را تغییر نمی‌دهد، حذف نمی‌کند، ایجاد نمی‌کند؛ فقط گزارش می‌سازد.
param([string]$Root = (Get-Location).Path)

$Root = $Root.TrimEnd('\','"')
$manifestPath = Join-Path $Root 'verified-manifest.txt'
if (!(Test-Path $manifestPath)) {
  Write-Host "ERROR: verified-manifest.txt not found next to this script ($Root)"
  exit 1
}

$rawExts = @('.png','.jpg','.jpeg','.gif','.webp','.bmp','.ico','.ttf','.otf','.woff','.woff2','.pdf','.mp3','.mp4','.wav','.zip')

function Get-NormHash([string]$Path) {
  $ext = [System.IO.Path]::GetExtension($Path).ToLower()
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($rawExts -notcontains $ext) {
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    $text = $text.TrimStart([char]0xFEFF)
    $text = ($text -replace "`r`n","`n") -replace "`r","`n"
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  return [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLower()
}

$expected = @{}
Get-Content $manifestPath | ForEach-Object {
  if ($_ -and -not $_.StartsWith('#')) {
    $parts = $_.Split('|')
    if ($parts.Count -eq 2) { $expected[$parts[0]] = $parts[1] }
  }
}

$differ  = New-Object System.Collections.Generic.List[string]
$missing = New-Object System.Collections.Generic.List[string]
$matchCount = 0

foreach ($rel in $expected.Keys) {
  $localPath = Join-Path $Root ($rel -replace '/', '\')
  if (!(Test-Path -LiteralPath $localPath)) { $missing.Add($rel); continue }
  if ((Get-NormHash $localPath) -ieq $expected[$rel]) { $matchCount++ } else { $differ.Add($rel) }
}

# فایل‌های اضافه محلی (در اسکوپ منیفست) که در نسخه تأییدشده نیستند — فقط گزارش می‌شوند، دست نمی‌خورند
$scanRoots = @('wholesale-api\src','wholesale-api\prisma','wholesale-api\scripts','wholesale-api\public',
               'wholesale-mobile\app','wholesale-mobile\src','wholesale-mobile\scripts')
$extra = New-Object System.Collections.Generic.List[string]
foreach ($sr in $scanRoots) {
  $dir = Join-Path $Root $sr
  if (Test-Path -LiteralPath $dir) {
    Get-ChildItem -Path $dir -Recurse -File | ForEach-Object {
      $rel = ($_.FullName.Substring($Root.Length + 1)) -replace '\\','/'
      if (-not $expected.ContainsKey($rel)) { $extra.Add($rel) }
    }
  }
}

$report = New-Object System.Collections.Generic.List[string]
$report.Add("=== SYNC AUDIT REPORT ===")
$report.Add("Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$report.Add("Root: $Root")
$report.Add("")
$report.Add("MATCH (identical to verified): $matchCount")
$report.Add("DIFFER (local != verified):    $($differ.Count)")
$report.Add("MISSING (in verified, absent locally): $($missing.Count)")
$report.Add("EXTRA (local only, untouched): $($extra.Count)")
$report.Add("")
if ($differ.Count -gt 0)  { $report.Add("--- DIFFER ---");  $differ  | Sort-Object | ForEach-Object { $report.Add($_) }; $report.Add("") }
if ($missing.Count -gt 0) { $report.Add("--- MISSING ---"); $missing | Sort-Object | ForEach-Object { $report.Add($_) }; $report.Add("") }
if ($extra.Count -gt 0)   { $report.Add("--- EXTRA ---");   $extra   | Sort-Object | ForEach-Object { $report.Add($_) }; $report.Add("") }
$report.Add("(read-only audit; no files were modified)")

$reportPath = Join-Path $Root 'sync-audit-report.txt'
$report | Out-File -FilePath $reportPath -Encoding utf8

Write-Host ""
Write-Host "MATCH   : $matchCount"
Write-Host "DIFFER  : $($differ.Count)"
Write-Host "MISSING : $($missing.Count)"
Write-Host "EXTRA   : $($extra.Count)"
Write-Host ""
Write-Host "Report written to: $reportPath"
Write-Host "Please send this report file content back (or just these 4 numbers + DIFFER/MISSING lists)."
