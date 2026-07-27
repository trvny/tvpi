[CmdletBinding()]
param(
    [string]$TaskName = "TVPI residential push",
    [string]$RunnerPath = "C:\tvpi\run-tvpi.ps1"
)

$resolvedRunner = Resolve-Path -LiteralPath $RunnerPath -ErrorAction Stop
$powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$arguments = @(
    "-NoLogo"
    "-NoProfile"
    "-NonInteractive"
    "-WindowStyle Hidden"
    "-ExecutionPolicy Bypass"
    "-File `"$($resolvedRunner.Path)`""
) -join " "

$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments
$settings = New-ScheduledTaskSettingsSet `
    -Hidden `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

Set-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Settings $settings `
    -ErrorAction Stop | Out-Null

Write-Host "Updated '$TaskName': hidden window and overlapping runs disabled."
