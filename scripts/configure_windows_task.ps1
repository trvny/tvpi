[CmdletBinding()]
param(
    [string]$TaskName = "TVPI residential push",
    [string]$RunnerPath = "C:\tvpi\run-tvpi.ps1",
    [string]$LauncherPath = ""
)

$resolvedRunner = Resolve-Path -LiteralPath $RunnerPath -ErrorAction Stop
$runnerDirectory = Split-Path -Parent $resolvedRunner.Path
if ([string]::IsNullOrWhiteSpace($LauncherPath)) {
    $LauncherPath = Join-Path $runnerDirectory "run-tvpi-hidden.vbs"
}
$resolvedLauncher = [System.IO.Path]::GetFullPath($LauncherPath)
$launcherDirectory = Split-Path -Parent $resolvedLauncher
if (-not (Test-Path -LiteralPath $launcherDirectory -PathType Container)) {
    throw "Launcher directory does not exist: $launcherDirectory"
}

$powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$powerShellArguments = @(
    "-NoLogo"
    "-NoProfile"
    "-NonInteractive"
    "-ExecutionPolicy Bypass"
    "-File `"$($resolvedRunner.Path)`""
) -join " "
$command = "`"$powerShell`" $powerShellArguments"
$escapedCommand = $command.Replace('"', '""')
$launcher = @(
    "Option Explicit"
    "Dim shell, exitCode"
    "Set shell = CreateObject(`"WScript.Shell`")"
    "exitCode = shell.Run(`"$escapedCommand`", 0, True)"
    "WScript.Quit exitCode"
) -join "`r`n"
Set-Content -LiteralPath $resolvedLauncher -Value $launcher -Encoding Unicode -NoNewline

$wscript = "$env:SystemRoot\System32\wscript.exe"
$arguments = "//B //NoLogo `"$resolvedLauncher`""
$action = New-ScheduledTaskAction -Execute $wscript -Argument $arguments
$settings = New-ScheduledTaskSettingsSet `
    -Hidden `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 1 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Set-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Settings $settings `
    -ErrorAction Stop | Out-Null

Write-Host "Updated '$TaskName': wscript launcher enabled at '$resolvedLauncher'."
