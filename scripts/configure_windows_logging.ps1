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
$commandRunner = [System.IO.Path]::GetFullPath(
    (Join-Path $runnerDirectory "run-tvpi-command.ps1")
)
if ([System.StringComparer]::OrdinalIgnoreCase.Equals($runner, $commandRunner)) {
    throw "Runner path must differ from '$commandRunner'."
}
$source = Get-Content -LiteralPath $runner -Raw -ErrorAction Stop
$managedV2 = $source.Contains("# TVPI managed logging v2")
$managedV1 = $source.Contains("# TVPI managed logging v1")

function Remove-LogRedirection {
    param([string]$Content)

    $commandPrefix = '(?im)^(?<command>[^\r\n]*residential_push\.py[^\r\n]*?)'
    $target = '(?:"[^"\r\n]*"|''[^''\r\n]*''|[^\s\r\n]+)'
    $updated = [regex]::Replace(
        $Content,
        "$commandPrefix[ \t]+\*>>[ \t]+$target[ \t]*(?<ending>\r?)$",
        '${command}${ending}'
    )
    $updated = [regex]::Replace(
        $updated,
        "$commandPrefix[ \t]+>>[ \t]+$target[ \t]*(?<ending>\r?)$",
        '${command}${ending}'
    )
    return [regex]::Replace(
        $updated,
        "$commandPrefix[ \t]+2>&1[ \t]*(?<ending>\r?)$",
        '${command}${ending}'
    )
}

if (-not $managedV2) {
    if (Test-Path -LiteralPath $logPath -PathType Leaf) {
        $legacyPath = "$logPath.legacy-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Move-Item -LiteralPath $logPath -Destination $legacyPath -ErrorAction Stop
        Write-Host "Archived mixed-encoding log as '$legacyPath'."
    }

    if (-not (Test-Path -LiteralPath $backupPath)) {
        Copy-Item -LiteralPath $runner -Destination $backupPath -ErrorAction Stop
    }

    $commandSource = if ($managedV1) {
        Get-Content -LiteralPath $backupPath -Raw -ErrorAction Stop
    } else {
        $source
    }
    $commandSource = Remove-LogRedirection $commandSource
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

function Test-BoundaryLine {
    param([string]$Message)

    return $Message.Trim() -match '^(?:\[[^\]]+\]\s*)?(?:start|exit=-?\d+)$'
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
        $message = [string]$_
        if (-not (Test-BoundaryLine $message)) {
            Write-LogLine $message
        }
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
