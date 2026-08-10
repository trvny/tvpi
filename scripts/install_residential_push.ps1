[CmdletBinding()]
param(
    [string]$TaskName = "TVPI residential push",
    [ValidateRange(5, 1440)]
    [int]$IntervalMinutes = 12
)

$ErrorActionPreference = "Stop"
$volunteerUserName = "tvpi-volunteer-v1"

function Get-VolunteerId([string]$Token) {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $tokenBytes = [System.Text.Encoding]::UTF8.GetBytes($Token)
        return ($sha256.ComputeHash($tokenBytes) | ForEach-Object {
            $_.ToString("x2")
        }) -join ""
    } finally {
        $sha256.Dispose()
    }
}

function New-VolunteerCredential {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    } finally {
        $rng.Dispose()
    }
    $token = "v1_" + [Convert]::ToBase64String($bytes)
    $secureToken = ConvertTo-SecureString $token -AsPlainText -Force
    return New-Object System.Management.Automation.PSCredential($volunteerUserName, $secureToken)
}

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
$volunteerIdPath = Join-Path $installDirectory "volunteer-id.txt"
$runnerPath = Join-Path $installDirectory "run-tvpi.ps1"
$launcherPath = Join-Path $installDirectory "run-tvpi-hidden.exe"

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

$credential = $null
if (Test-Path -LiteralPath $credentialPath -PathType Leaf) {
    try {
        $credential = Import-Clixml -LiteralPath $credentialPath
        if (-not ($credential -is [System.Management.Automation.PSCredential])) {
            throw "Stored credential has an unexpected type."
        }
        if ($credential.UserName -eq $volunteerUserName) {
            $savedToken = $credential.GetNetworkCredential().Password
            if (-not $savedToken.StartsWith("v1_", [System.StringComparison]::Ordinal)) {
                throw "Stored volunteer credential has an invalid format."
            }
            $savedToken = $null
        }
    } catch {
        $backupPath = "$credentialPath.invalid.$(Get-Date -Format 'yyyyMMddHHmmss')"
        Move-Item -LiteralPath $credentialPath -Destination $backupPath -Force
        Write-Warning "Existing credential could not be used and was preserved at: $backupPath"
        $credential = $null
    }
}

if (-not $credential) {
    $credential = New-VolunteerCredential
    $credential | Export-Clixml -LiteralPath $credentialPath -Force
}

$volunteerId = $null
$clipboardCopied = $false
if ($credential.UserName -eq $volunteerUserName) {
    $token = $credential.GetNetworkCredential().Password
    $volunteerId = Get-VolunteerId $token
    $token = $null
    Set-Content -LiteralPath $volunteerIdPath -Value $volunteerId -Encoding ASCII
    try {
        Set-Clipboard -Value $volunteerId
        $clipboardCopied = $true
    } catch {
        # Clipboard is optional; the ID is also saved to volunteer-id.txt.
    }
}

$runnerContent = @'
$ErrorActionPreference = "Stop"
$baseDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$credential = Import-Clixml -LiteralPath (Join-Path $baseDirectory "push-token.clixml")
$env:TVPI_PUSH_TOKEN = $credential.GetNetworkCredential().Password
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
    Remove-Item Env:\TVPI_PUSH_TOKEN -ErrorAction SilentlyContinue
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
Write-Host "Installed in: $installDirectory"
Write-Host "Scheduled every $IntervalMinutes minutes and started once now."
if ($volunteerId) {
    Write-Host ""
    if ($clipboardCopied) {
        Write-Host "Volunteer ID (copied to clipboard):"
    } else {
        Write-Host "Volunteer ID:"
    }
    Write-Host $volunteerId
    Write-Host "Send this ID for one-time approval. The private credential never leaves this PC."
    Write-Host "Volunteer ID file: $volunteerIdPath"
}
Write-Host "Last run log: $(Join-Path $installDirectory 'last-run.log')"
Write-Host ""
Read-Host "Press Enter to close" | Out-Null
