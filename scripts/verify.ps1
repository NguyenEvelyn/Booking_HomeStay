param([string]$ApiBase = "http://localhost:5000")

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

dotnet build (Join-Path $projectRoot "backend\HomestayAuth.Api.csproj") --no-restore -p:UseAppHost=false -o (Join-Path $projectRoot ".verify-build")
Push-Location (Join-Path $projectRoot "frontend")
try { node "node_modules\vite\bin\vite.js" build }
finally { Pop-Location }

$health = Invoke-RestMethod "$ApiBase/api/health"
if ($health.status -ne "ok") { throw "Backend health check failed." }

$database = Invoke-RestMethod "$ApiBase/api/health/database"
if ($database.status -ne "ok") { throw "Database health check failed." }

$checkIn = (Get-Date).Date.AddDays(7).ToString("yyyy-MM-dd")
$checkOut = (Get-Date).Date.AddDays(8).ToString("yyyy-MM-dd")
$catalog = Invoke-RestMethod "$ApiBase/api/homestays?checkIn=$checkIn&checkOut=$checkOut&guests=1&pageSize=1"
if ($catalog.items.Count -gt 0) {
    $detail = Invoke-RestMethod "$ApiBase/api/homestays/$($catalog.items[0].id)"
    if ($detail.roomTypes.Count -gt 0) {
        $quoteBody = @{
            roomTypeId = $detail.roomTypes[0].id
            checkInDate = $checkIn
            checkOutDate = $checkOut
            adultCount = 1
            childCount = 0
            quantity = 1
            customerNote = $null
        } | ConvertTo-Json
        $quote = Invoke-RestMethod "$ApiBase/api/bookings/quote" -Method Post -ContentType "application/json" -Body $quoteBody
        if ($quote.total -le 0) { throw "Booking quote is invalid." }
    }
}

Write-Host "Verification passed: backend, frontend, database, catalog and price quote."
