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
$backupPath = "$runner.bak"
$commandRunner = Join-Path $runnerDirectory "run-tvpi-command.ps1"
$source = Get-Content -LiteralPath $runner -Raw -ErrorAction Stop
$managed = $source.Contains("# TVPI managed logging v2")

function Remove-LogRedirection {
    param([string]$Content)

    $updated = [regex]::Replace(
        $Content,
        '(?m)[ \t]+\*>>[ \t]+(?:"[^"\r\n]*"|''[^''\r\n]*''|[^\s\r\n]+)[ \t]*$',
        ''
    )
    $updated = [regex]::Replace(
        $updated,
        '(?m)[ \t]+>>[ \t]+(?:"[^"\r\n]*"|''[^''\r\n]*''|[^\s\r\n]+)[ \t]*$',
        ''
    )
    return [regex]::Replace($updated, '(?m)[ \t]+2>&1[ \t]*$', '')
}

if (-not $managed) {
    if (Test-Path -LiteralPath $logPath -PathType Leaf) {
        $legacyPath = "$logPath.legacy-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Move-Item -LiteralPath $logPath -Destination $legacyPath -ErrorAction Stop
        Write-Host "Archived mixed-encoding log as '$legacyPath'."
    }

    if (-not (Test-Path -LiteralPath $backupPath)) {
        Copy-Item -LiteralPath $runner -Destination $backupPath -ErrorAction Stop
    }

    $commandSource = Remove-LogRedirection $source
    Set-Content -LiteralPath $commandRunner -Value $commandSource -Encoding UTF8 -NoNewline
} elseif (-not (Test-Path -LiteralPath $commandRunner -PathType Leaf)) {
    if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
        throw "Original runner backup was not found at '$backupPath'."
    }
    $commandSource = Get-Content -LiteralPath $backupPath -Raw -ErrorAction Stop
    $commandSource = Remove-LogRedirection $commandSource
    Set-Content -LiteralPath $commandRunner -Value $commandSource -Encoding UTF8 -NoNewline
}

$maxLogBytes = $MaxLogSizeMB * 1MB
$escapedCommandRunner = $commandRunner.Replace("'", "''")
$template = @'
# TVPI managed logging v2
$logPath = Join-Path $PSScriptRoot "push.log"
$commandRunner = '__COMMAND_RUNNER__'
$maxLogBytes = __MAX_LOG_BYTES__
$logBackups = __LOG_BACKUPS__
$utf8 = [System.Text.UTF8Encoding]::new($false)
$env:PYTHONUNBUFFERED = "1"

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
$powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
& $powerShell `
    -NoLogo `
    -NoProfile `
    -NonInteractive `
    -ExecutionPolicy Bypass `
    -File $commandRunner 2>&1 | ForEach-Object {
        Write-LogLine ([string]$_)
    }
$exitCode = $LASTEXITCODE
Write-LogLine "exit=$exitCode"
exit $exitCode
'@

$updated = $template.Replace("__COMMAND_RUNNER__", $escapedCommandRunner)
$updated = $updated.Replace("__MAX_LOG_BYTES__", [string]$maxLogBytes)
$updated = $updated.Replace("__LOG_BACKUPS__", [string]$LogBackups)
Set-Content -LiteralPath $runner -Value $updated -Encoding UTF8 -NoNewline

Write-Host "Updated '$runner': UTF-8 timestamps and $MaxLogSizeMB MB rotation enabled."
