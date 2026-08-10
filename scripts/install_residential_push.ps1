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
$runnerPath = Join-Path $installDirectory "run-tvpi.ps1"
$launcherPath = Join-Path $installDirectory "run-tvpi-hidden.exe"
$oldCredentialPath = Join-Path $installDirectory "push-token.clixml"

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask -and $existingTask.State -eq "Running") {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 250
        $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        if ($existingTask.State -ne "Running") {
            break
        }
    }
}

Copy-Item -LiteralPath $exeSource -Destination $exePath -Force
Copy-Item -LiteralPath $configureSource -Destination $configurePath -Force
Remove-Item -LiteralPath $oldCredentialPath -Force -ErrorAction SilentlyContinue

$runnerContent = @'
$ErrorActionPreference = "Stop"
$baseDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$env:TVPI_STATE_FILE = Join-Path $baseDirectory "state.json"
$logPath = Join-Path $baseDirectory "last-run.log"
$exePath = Join-Path $baseDirectory "tvpi-residential-push.exe"
$exitCode = 1
$previousPreference = $ErrorActionPreference

try {
    $ErrorActionPreference = "Continue"
    $LASTEXITCODE = $null
    & $exePath *> $logPath
    if ($null -ne $LASTEXITCODE) {
        $exitCode = $LASTEXITCODE
    }
} finally {
    $ErrorActionPreference = $previousPreference
}
exit $exitCode
'@
Set-Content -LiteralPath $runnerPath -Value $runnerContent -Encoding UTF8

& $configurePath `
    -TaskName $TaskName `
    -RunnerPath $runnerPath `
    -LauncherPath $launcherPath `
    -IntervalMinutes $IntervalMinutes

Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop

Write-Host ""
Write-Host "TVPI residential volunteer installed in: $installDirectory"
Write-Host "No TVPI token is required. Scheduled every $IntervalMinutes minutes and started once now."
Write-Host "Last run log: $(Join-Path $installDirectory 'last-run.log')"
Write-Host ""
Read-Host "Press Enter to close" | Out-Null
