#requires -Version 5.1
<#
  Visitor IDOR Test (v1.1) — راستی‌آزمایی عملیاتی فیکس فاز ۵-۱
  اثبات: سفارشِ ثبت‌شده توسط «ویزیتور ۱» نباید در لیست «ویزیتور ۲» دیده شود.
  پیش‌نیاز: سرور در حالت توسعه اجرا شده باشد (npm run start:dev)
  اگر با npm run db:seed ویزیتورها را ساخته باشید، نقش VISITOR خودکار تشخیص داده
  می‌شود و فازِ دستی (تغییر نقش در Studio) کاملاً حذف می‌شود.
#>
param(
  [string]$BaseUrl    = 'http://localhost:3000',
  [string]$Phone1     = '09123456701',
  [string]$Phone2     = '09123456702',
  [string]$CustomerId = '',
  [string]$ProductId  = ''
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$script:report = New-Object System.Collections.Generic.List[string]

function Log([string]$s) { $script:report.Add($s); Write-Host $s }

function Invoke-Api {
  param([string]$Method, [string]$Path, [string]$Token, $Body)
  $headers = @{}
  if ($Token) { $headers['Authorization'] = "Bearer $Token" }
  $p = @{
    UseBasicParsing = $true
    Method  = $Method
    Uri     = ($BaseUrl.TrimEnd('/') + $Path)
    Headers = $headers
  }
  if ($null -ne $Body) {
    $p['ContentType'] = 'application/json; charset=utf-8'
    $p['Body'] = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Depth 8))
  }
  try {
    return Invoke-RestMethod @p
  } catch {
    $detail = ''
    try { $detail = $_.ErrorDetails.Message } catch {}
    throw ("API {0} {1} -> {2} {3}" -f $Method, $Path, $_.Exception.Message, $detail)
  }
}

function Get-AuthToken([string]$phone) {
  $r = Invoke-Api -Method Post -Path '/auth/request-otp' -Body @{ phone = $phone }
  if (-not $r.testCode) {
    throw "for $phone field testCode missing => server is NOT in dev mode (stop and run: npm run start:dev)"
  }
  $v = Invoke-Api -Method Post -Path '/auth/verify-otp' -Body @{ phone = $phone; code = ([string]$r.testCode) }
  if (-not $v.accessToken) { throw "accessToken was not issued for $phone" }
  return $v.accessToken
}

function Get-Items($resp) {
  if ($null -eq $resp) { return @() }
  foreach ($prop in @('items','data','orders','results')) {
    if ($resp.PSObject.Properties[$prop]) { return @($resp.$prop) }
  }
  if ($resp -is [System.Array]) { return @($resp) }
  return @()
}

function Test-Visibility([string]$Label, [string]$Token1, [string]$Token2, [string]$OrderId) {
  $l1 = Get-Items (Invoke-Api -Method Get -Path '/admin/visitor-sales/orders?page=1&pageSize=50' -Token $Token1)
  $l2 = Get-Items (Invoke-Api -Method Get -Path '/admin/visitor-sales/orders?page=1&pageSize=50' -Token $Token2)
  $seen1 = [bool]($l1 | Where-Object { $_.id -eq $OrderId })
  $seen2 = [bool]($l2 | Where-Object { $_.id -eq $OrderId })
  Log ("  [{0}] orders visible to visitor1={1} | visitor2={2}" -f $Label, $l1.Count, $l2.Count)
  Log ("  [{0}] test order visible in visitor1 list: {1}" -f $Label, $seen1)
  Log ("  [{0}] test order visible in visitor2 list: {1}   <=== security point" -f $Label, $seen2)
  if ($seen2)        { Log ("  [{0}] *** FAIL *** cross-user data exposure still exists!" -f $Label); return $false }
  if (-not $seen1)   { Log ("  [{0}] WARN: order not visible to its owner either — needs manual check" -f $Label); return $null }
  Log ("  [{0}] *** PASS *** isolation works" -f $Label)
  return $true
}

Log "=== Visitor IDOR Test v1.1 (Phase 5-1) ==="
Log ("BaseUrl = " + $BaseUrl)
Log ""

try {
  Log "[1/6] login/create two test users (fully automatic, dev-mode OTP)..."
  $t1 = Get-AuthToken $Phone1
  Log ("      visitor1 OK  (" + $Phone1 + ")")
  $t2 = Get-AuthToken $Phone2
  Log ("      visitor2 OK  (" + $Phone2 + ")")

  Log "[2/6] reading profile (role + approved customer)..."
  $me1 = $null
  try { $me1 = Invoke-Api -Method Get -Path '/auth/me' -Token $t1 } catch { Log ("      getMe failed: " + $_.Exception.Message) }
  $role1 = 'unknown'
  if ($me1 -and $me1.role) { $role1 = [string]$me1.role }
  Log ("      visitor1 role = " + $role1)

  if (-not $CustomerId) {
    if ($me1 -and $me1.customer -and ($me1.customer.status -eq 'APPROVED')) {
      $CustomerId = [string]$me1.customer.id
      Log "      own approved customer found: $CustomerId"
    } else {
      Log "      ACTION NEEDED: Prisma Studio (npm run db:studio -> http://localhost:5555)"
      Log "      -> table 'Customer' -> a row with status = APPROVED"
      Log "         (or set any row's status to APPROVED and press 'Save 1 change')"
      $CustomerId = Read-Host '      paste that Customer id here'
    }
  }
  Log ("      CustomerId = " + $CustomerId)

  Log "[3/6] finding an active product with stock..."
  if (-not $ProductId) {
    try {
      $pl = Get-Items (Invoke-Api -Method Get -Path '/products?page=1&pageSize=1' -Token $t1)
      if ($pl.Count -gt 0 -and $pl[0].id) { $ProductId = [string]$pl[0].id }
    } catch { Log ("      products list skipped: " + $_.Exception.Message) }
  }
  if (-not $ProductId) {
    Log "      ACTION NEEDED: Prisma Studio -> table 'Product' -> a row with isActive=true and stock>0"
    $ProductId = Read-Host '      paste that Product id here'
  }
  Log ("      ProductId = " + $ProductId)

  Log "[4/6] visitor1 places a tagged test order..."
  $order = Invoke-Api -Method Post -Path '/visitor/orders' -Token $t1 -Body @{
    customerId  = $CustomerId
    items       = @(@{ productId = $ProductId; quantity = 1 })
    visitorNote = 'IDOR-TEST'
  }
  $OrderId = $order.id
  if (-not $OrderId -and $order.order) { $OrderId = $order.order.id }
  if (-not $OrderId) { throw ('order id missing in response: ' + ($order | ConvertTo-Json -Depth 6 -Compress)) }
  Log ("      test order created: " + $OrderId)

  Log ("[5/6] visibility check (visitor1 role = " + $role1 + "):")
  $rA = Test-Visibility -Label $role1 -Token1 $t1 -Token2 $t2 -OrderId $OrderId
  $rB = $null

  if ($role1 -eq 'VISITOR') {
    Log ""
    Log "[6/6] role is already VISITOR (env seed) — manual Phase B not needed. Done."
    $rB = $true
  } else {
    Log ""
    Log "[6/6] Phase B (optional) — same check with real VISITOR role:"
    Log "      Easiest: set VISITOR1_PHONE/VISITOR2_PHONE in .env and run  npm run db:seed  (then re-run this test)"
    Log "      Or manually: Prisma Studio -> table 'User' -> set role=VISITOR for both phones -> Save"
    $ans = Read-Host '      done? type  y  to run Phase B, or press Enter to skip'
    if ($ans -eq 'y') { $rB = Test-Visibility -Label 'VISITOR' -Token1 $t1 -Token2 $t2 -OrderId $OrderId }
  }

  Log ""
  Log "================= FINAL VERDICT ================="
  $failed = ($rA -eq $false) -or ($rB -eq $false)
  $passed = ($rA -eq $true) -and ($rB -ne $false)
  if ($failed)     { Log "*** FAIL *** the IDOR fix is NOT effective — send this report file back" }
  elseif ($passed) { Log "*** PASS *** the Phase 5-1 IDOR fix works correctly in practice" }
  else             { Log "*** INCONCLUSIVE *** see WARN lines above — send this report file back" }
}
catch {
  Log ""
  Log ("ERROR: " + $_.Exception.Message)
  Log "Hints: 429 => wait 60s and re-run | 403/Forbidden => follow the ACTION NEEDED steps in Studio"
  Log "        connection refused => start the backend first (npm run start:dev)"
}
finally {
  $path = Join-Path $PSScriptRoot 'idor-test-report.txt'
  ($script:report -join "`r`n") | Out-File -FilePath $path -Encoding utf8
  Write-Host ""
  Write-Host ("Report written to: " + $path)
  Write-Host "Please send the FINAL VERDICT line (or this file) back."
}
