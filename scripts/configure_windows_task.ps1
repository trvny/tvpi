[CmdletBinding()]
param(
    [string]$TaskName = "TVPI residential push",
    [string]$RunnerPath = "C:\tvpi\run-tvpi.ps1",
    [string]$LauncherPath = "",
    [ValidateRange(5, 1440)]
    [int]$IntervalMinutes = 12
)

$resolvedRunner = Resolve-Path -LiteralPath $RunnerPath -ErrorAction Stop
$runnerDirectory = Split-Path -Parent $resolvedRunner.Path
if ($PSVersionTable.PSEdition -ne "Desktop") {
    throw "Run this helper with Windows PowerShell 5.1 (powershell.exe)."
}

$launcherSource = @'
using System;
using System.Diagnostics;
using System.IO;
using System.Text;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length != 1 || string.IsNullOrWhiteSpace(args[0]))
        {
            return 64;
        }

        string runner = Path.GetFullPath(args[0]);
        string runnerDirectory = Path.GetDirectoryName(runner);
        string powerShell = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.System),
            @"WindowsPowerShell\v1.0\powershell.exe"
        );

        try
        {
            ProcessStartInfo startInfo = new ProcessStartInfo
            {
                FileName = powerShell,
                Arguments = "-NoLogo -NoProfile -NonInteractive "
                    + "-ExecutionPolicy Bypass -File \"" + runner + "\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                WorkingDirectory = runnerDirectory
            };

            using (Process process = Process.Start(startInfo))
            {
                if (process == null)
                {
                    return 1;
                }
                process.WaitForExit();
                return process.ExitCode;
            }
        }
        catch (Exception exception)
        {
            try
            {
                string errorLog = Path.Combine(
                    runnerDirectory ?? ".",
                    "run-tvpi-launcher-error.log"
                );
                File.AppendAllText(
                    errorLog,
                    DateTime.Now.ToString("s") + " " + exception + Environment.NewLine,
                    Encoding.UTF8
                );
            }
            catch
            {
            }
            return 1;
        }
    }
}
'@

$sha256 = [System.Security.Cryptography.SHA256]::Create()
try {
    $sourceBytes = [System.Text.Encoding]::UTF8.GetBytes($launcherSource)
    $launcherHash = ($sha256.ComputeHash($sourceBytes) | ForEach-Object {
        $_.ToString("x2")
    }) -join ""
} finally {
    $sha256.Dispose()
}
$launcherTag = $launcherHash.Substring(0, 12)

if ([string]::IsNullOrWhiteSpace($LauncherPath)) {
    $LauncherPath = Join-Path $runnerDirectory "run-tvpi-hidden.exe"
}
$launcherBase = [System.IO.Path]::GetFullPath($LauncherPath)
$launcherDirectory = Split-Path -Parent $launcherBase
if (-not (Test-Path -LiteralPath $launcherDirectory -PathType Container)) {
    throw "Launcher directory does not exist: $launcherDirectory"
}
if ([System.IO.Path]::GetExtension($launcherBase) -ine ".exe") {
    throw "Launcher path must use the .exe extension: $launcherBase"
}
$launcherName = [System.IO.Path]::GetFileNameWithoutExtension($launcherBase)
$resolvedLauncher = Join-Path $launcherDirectory "$launcherName-$launcherTag.exe"

if (-not (Test-Path -LiteralPath $resolvedLauncher -PathType Leaf)) {
    $temporaryLauncher = "$resolvedLauncher.$([guid]::NewGuid().ToString('N')).tmp.exe"
    try {
        Add-Type `
            -TypeDefinition $launcherSource `
            -Language CSharp `
            -OutputAssembly $temporaryLauncher `
            -OutputType WindowsApplication `
            -ErrorAction Stop
        Move-Item `
            -LiteralPath $temporaryLauncher `
            -Destination $resolvedLauncher `
            -ErrorAction Stop
    } finally {
        if (Test-Path -LiteralPath $temporaryLauncher) {
            Remove-Item -LiteralPath $temporaryLauncher -Force -ErrorAction SilentlyContinue
        }
    }
}

$arguments = "`"$($resolvedRunner.Path)`""
$action = New-ScheduledTaskAction `
    -Execute $resolvedLauncher `
    -Argument $arguments `
    -WorkingDirectory $runnerDirectory
$trigger = New-ScheduledTaskTrigger `
    -Once `
    -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes $IntervalMinutes) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet `
    -Hidden `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 1 `
    -RestartInterval (New-TimeSpan -Minutes 1)

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existing) {
    Set-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -ErrorAction Stop | Out-Null
    $verb = "Updated"
} else {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $action `
        -Trigger $trigger `
        -Settings $settings `
        -Description "Refresh TVPI stream manifests from a residential connection." `
        -ErrorAction Stop | Out-Null
    $verb = "Created"
}

Write-Host "$verb '$TaskName': every $IntervalMinutes minutes via '$resolvedLauncher'."
