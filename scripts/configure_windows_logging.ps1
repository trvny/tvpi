[CmdletBinding()]
param(
    [string]$RunnerPath = "C:\tvpi\run-tvpi.ps1",
    [ValidateRange(1, 1024)]
    [int]$MaxLogSizeMB = 1,
    [ValidateRange(1, 20)]
    [int]$LogBackups = 3
)

$resolvedRunner = Resolve-Path -LiteralPath $RunnerPath -ErrorAction Stop
$runner = $resolvedRunner.Path
$runnerDirectory = Split-Path -Parent $runner
$logPath = Join-Path $runnerDirectory "push.log"
$source = Get-Content -LiteralPath $runner -Raw -ErrorAction Stop
$managed = $source.Contains("# TVPI managed logging v1")

$environmentMatches = [regex]::Matches(
    $source,
    '(?m)^[ \t]*\$env:[A-Za-z_][A-Za-z0-9_]*[ \t]*=.*$'
)
$environmentLines = @($environmentMatches | ForEach-Object { $_.Value.Trim() })
if (-not ($environmentLines -match '^\$env:TVPI_PUSH_TOKEN\s*=')) {
    throw "TVPI_PUSH_TOKEN assignment was not found in '$runner'."
}

$commandMatch = [regex]::Match(
    $source,
    '(?m)^[ \t]*&[ \t]+.*residential_push\.py.*$'
)
if (-not $commandMatch.Success) {
    throw "residential_push.py invocation was not found in '$runner'."
}

$commandLine = $commandMatch.Value.Trim()
$commandLine = [regex]::Replace($commandLine, '\s+\*>>.*$', '')
$commandLine = [regex]::Replace($commandLine, '\s+2>&1.*$', '')

if (-not $managed -and (Test-Path -LiteralPath $logPath -PathType Leaf)) {
    $legacyPath = "$logPath.legacy-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Move-Item -LiteralPath $logPath -Destination $legacyPath -ErrorAction Stop
    Write-Host "Archived mixed-encoding log as '$legacyPath'."
}

$environmentBlock = $environmentLines -join "`r`n"
$maxLogBytes = $MaxLogSizeMB * 1MB
$template = @'
# TVPI managed logging v1
__ENVIRONMENT__

$logPath = Join-Path $PSScriptRoot "push.log"
$maxLogBytes = __MAX_LOG_BYTES__
$logBackups = __LOG_BACKUPS__
$utf8 = [System.Text.UTF8Encoding]::new($false)

function Rotate-Log {
    if (-not (Test-Path -LiteralPath $logPath -PathType Leaf)) {
        return
    }
    if ((Get-Item -LiteralPath $logPath).Length -lt $maxLogBytes) {
        return
    }

    for ($index = $logBackups; $index -ge 1; $index--) {
        $sourcePath = if ($index -eq 1) {
            $logPath
        } else {
            "$logPath.$($index - 1)"
        }
        $destinationPath = "$logPath.$index"
        if (Test-Path -LiteralPath $destinationPath) {
            Remove-Item -LiteralPath $destinationPath -Force
        }
        if (Test-Path -LiteralPath $sourcePath) {
            Move-Item -LiteralPath $sourcePath -Destination $destinationPath
        }
    }
}

function Write-LogLine {
    param([AllowEmptyString()][string]$Message)

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $Message$([Environment]::NewLine)"
    [System.IO.File]::AppendAllText($logPath, $line, $utf8)
}

Rotate-Log
Write-LogLine "start"
__COMMAND__ 2>&1 | ForEach-Object {
    Write-LogLine ([string]$_)
}
$exitCode = $LASTEXITCODE
Write-LogLine "exit=$exitCode"
exit $exitCode
'@

$updated = $template.Replace("__ENVIRONMENT__", $environmentBlock)
$updated = $updated.Replace("__MAX_LOG_BYTES__", [string]$maxLogBytes)
$updated = $updated.Replace("__LOG_BACKUPS__", [string]$LogBackups)
$updated = $updated.Replace("__COMMAND__", $commandLine)

$backupPath = "$runner.bak"
if (-not (Test-Path -LiteralPath $backupPath)) {
    Copy-Item -LiteralPath $runner -Destination $backupPath -ErrorAction Stop
}
Set-Content -LiteralPath $runner -Value $updated -Encoding UTF8 -NoNewline

Write-Host "Updated '$runner': UTF-8 timestamps and $MaxLogSizeMB MB rotation enabled."
