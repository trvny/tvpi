[CmdletBinding()]
param(
    [string]$TaskName = "TVPI residential push",
    [ValidateRange(5, 1440)]
    [int]$IntervalMinutes = 12
)

$ErrorActionPreference = "Stop"

if ($PSVersionTable.PSEdition -ne "Desktop") {
    throw "Run this installer with Windows PowerShell 5.1 (powershell.exe)."
}

$sourceDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$exeSource = Join-Path $sourceDirectory "tvpi-residential-push.exe"
$configureSource = Join-Path $sourceDirectory "configure_windows_task.ps1"

foreach ($required in @($exeSource, $configureSource)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Missing release file: $required"
    }
}

$installDirectory = Join-Path $env:LOCALAPPDATA "tvpi\residential-push"
New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null

$exePath = Join-Path $installDirectory "tvpi-residential-push.exe"
$configurePath = Join-Path $installDirectory "configure_windows_task.ps1"
$credentialPath = Join-Path $installDirectory "push-token.clixml"
$runnerPath = Join-Path $installDirectory "run-tvpi.ps1"
$launcherPath = Join-Path $installDirectory "run-tvpi-hidden.exe"

Copy-Item -LiteralPath $exeSource -Destination $exePath -Force
Copy-Item -LiteralPath $configureSource -Destination $configurePath -Force

Write-Host "TVPI residential push installer"
Write-Host "The push token is encrypted for this Windows user with DPAPI."
$secureToken = Read-Host "TVPI push token" -AsSecureString
$credential = New-Object System.Management.Automation.PSCredential("tvpi", $secureToken)
if ([string]::IsNullOrWhiteSpace($credential.GetNetworkCredential().Password)) {
    throw "Push token cannot be empty."
}
$credential | Export-Clixml -LiteralPath $credentialPath -Force

$runnerContent = @'
$ErrorActionPreference = "Stop"
$baseDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$credential = Import-Clixml -LiteralPath (Join-Path $baseDirectory "push-token.clixml")
$env:TVPI_PUSH_TOKEN = $credential.GetNetworkCredential().Password
$env:TVPI_STATE_FILE = Join-Path $baseDirectory "state.json"
$logPath = Join-Path $baseDirectory "last-run.log"
$exePath = Join-Path $baseDirectory "tvpi-residential-push.exe"

try {
    & $exePath *> $logPath
    exit $LASTEXITCODE
} finally {
    Remove-Item Env:\TVPI_PUSH_TOKEN -ErrorAction SilentlyContinue
}
'@
Set-Content -LiteralPath $runnerPath -Value $runnerContent -Encoding UTF8

& $configurePath `
    -TaskName $TaskName `
    -RunnerPath $runnerPath `
    -LauncherPath $launcherPath `
    -IntervalMinutes $IntervalMinutes

Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop

Write-Host ""
Write-Host "Installed in: $installDirectory"
Write-Host "Scheduled every $IntervalMinutes minutes and started once now."
Write-Host "Last run log: $(Join-Path $installDirectory 'last-run.log')"
Write-Host ""
Read-Host "Press Enter to close" | Out-Null
