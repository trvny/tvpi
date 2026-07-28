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

    $hasTrailingNewline = $Content -match '\r?\n$'
    $lines = @($Content -split '\r?\n')
    if ($hasTrailingNewline -and $lines.Count -gt 0 -and $lines[-1] -eq "") {
        $lines = @($lines[0..($lines.Count - 2)])
    }

    $redirect = '[ \t]+(?:\*>>|>>)[ \t]+(?:"[^"\r\n]*"|''[^''\r\n]*''|[^\s\r\n]+)[ \t]*$'
    $redirectOnly = '^[ \t]*(?:\*>>|>>)[ \t]+(?:"[^"\r\n]*"|''[^''\r\n]*''|[^\s\r\n]+)[ \t]*$'
    $errorRedirect = '[ \t]+2>&1[ \t]*$'
    $errorRedirectOnly = '^[ \t]*2>&1[ \t]*$'
    $output = [System.Collections.Generic.List[string]]::new()
    $index = 0

    while ($index -lt $lines.Count) {
        $blockEnd = $index
        while (
            $blockEnd -lt $lines.Count - 1 -and
            $lines[$blockEnd].TrimEnd().EndsWith('`')
        ) {
            $blockEnd++
        }

        $block = @($lines[$index..$blockEnd])
        if ($block -match 'residential_push\.py') {
            $cleaned = [System.Collections.Generic.List[string]]::new()
            foreach ($line in $block) {
                $updated = [regex]::Replace($line, $redirect, "")
                $updated = [regex]::Replace($updated, $redirectOnly, "")
                $updated = [regex]::Replace($updated, $errorRedirect, "")
                $updated = [regex]::Replace($updated, $errorRedirectOnly, "")
                if (-not [string]::IsNullOrWhiteSpace($updated)) {
                    $cleaned.Add($updated)
                }
            }
            if ($cleaned.Count -gt 0) {
                $last = $cleaned.Count - 1
                $cleaned[$last] = [regex]::Replace(
                    $cleaned[$last],
                    '[ \t]*`[ \t]*$',
                    ""
                )
            }
            foreach ($line in $cleaned) {
                $output.Add($line)
            }
        } else {
            foreach ($line in $block) {
                $output.Add($line)
            }
        }
        $index = $blockEnd + 1
    }

    $updatedContent = $output -join "`r`n"
    if ($hasTrailingNewline) {
        $updatedContent += "`r`n"
    }
    return $updatedContent
}

function Test-ChildBoundaries {
    param([string]$Content)

    $tokens = $null
    $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseInput(
        $Content,
        [ref]$tokens,
        [ref]$parseErrors
    ) | Out-Null
    $characters = $Content.ToCharArray()
    foreach ($token in $tokens) {
        if ($token.Kind -ne [System.Management.Automation.Language.TokenKind]::Comment) {
            continue
        }
        for (
            $offset = $token.Extent.StartOffset
            $offset -lt $token.Extent.EndOffset
            $offset++
        ) {
            if ($characters[$offset] -notin "`r", "`n") {
                $characters[$offset] = ' '
            }
        }
    }
    $code = -join $characters

    $writer = '(?:Write-[A-Za-z]+|Add-Content|Set-Content|Out-File|Tee-Object|AppendAllText)'
    $startPattern = "(?im)^(?=[^\r\n]*$writer)[^\r\n]*\bstart\b[^\r\n]*$"
    $exitPattern = "(?im)^(?=[^\r\n]*$writer)[^\r\n]*exit\s*=[^\r\n]*$"
    return (
        [regex]::IsMatch($code, $startPattern) -and
        [regex]::IsMatch($code, $exitPattern)
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

$childSource = Get-Content -LiteralPath $commandRunner -Raw -ErrorAction Stop
$writeBoundaries = -not (Test-ChildBoundaries $childSource)
$boundaryLiteral = if ($writeBoundaries) { '$true' } else { '$false' }
$maxLogBytes = $MaxLogSizeMB * 1MB
$escapedCommandRunner = $commandRunner.Replace("'", "''")
$template = @'
# TVPI managed logging v2
$logPath = Join-Path $PSScriptRoot "push.log"
$commandRunner = '__COMMAND_RUNNER__'
$writeBoundaries = __WRITE_BOUNDARIES__
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
if ($writeBoundaries) {
    Write-LogLine "start"
}
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
if ($writeBoundaries) {
    Write-LogLine "exit=$exitCode"
}
exit $exitCode
'@

$updated = $template.Replace("__COMMAND_RUNNER__", $escapedCommandRunner)
$updated = $updated.Replace("__WRITE_BOUNDARIES__", $boundaryLiteral)
$updated = $updated.Replace("__MAX_LOG_BYTES__", [string]$maxLogBytes)
$updated = $updated.Replace("__LOG_BACKUPS__", [string]$LogBackups)
Set-Content -LiteralPath $runner -Value $updated -Encoding UTF8 -NoNewline

Write-Host "Updated '$runner': UTF-8 timestamps and $MaxLogSizeMB MB rotation enabled."
