param(
    [int[]]$RunSequences = @(1, 2, 3)
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$harnessPath = Join-Path $scriptDir "task005_b7_harness.ps1"

if (-not (Test-Path -LiteralPath $harnessPath)) {
    throw "B7 runner blocked: harness not found at $harnessPath"
}

$overallFailed = $false

foreach ($sequence in $RunSequences) {
    if ($sequence -notin @(1, 2, 3)) {
        throw "B7 runner blocked: invalid RUN_SEQUENCE $sequence"
    }

    $logPath = Join-Path $scriptDir ("task005_b7_evidence_run{0}.log" -f $sequence)
    if (Test-Path -LiteralPath $logPath) {
        Remove-Item -LiteralPath $logPath -Force
    }

    $sanitizedCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File pruebas/task005_b7_harness.ps1 -runSequence $sequence"

    $processInfo = New-Object System.Diagnostics.ProcessStartInfo
    $processInfo.FileName = "powershell.exe"
    $processInfo.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$harnessPath`" -runSequence $sequence"
    $processInfo.UseShellExecute = $false
    $processInfo.RedirectStandardOutput = $true
    $processInfo.RedirectStandardError = $true
    $processInfo.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $processInfo
    [void]$process.Start()
    $standardOutput = $process.StandardOutput.ReadToEnd()
    $standardError = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    $realExitCode = $process.ExitCode

    $logLines = New-Object System.Collections.Generic.List[string]
    $logLines.Add("SANITIZED_COMMAND: $sanitizedCommand")
    if (-not [string]::IsNullOrWhiteSpace($standardOutput)) {
        $logLines.Add($standardOutput.TrimEnd())
    }
    if (-not [string]::IsNullOrWhiteSpace($standardError)) {
        $logLines.Add("STDERR_BEGIN")
        $logLines.Add($standardError.TrimEnd())
        $logLines.Add("STDERR_END")
    }
    $logLines.Add(("POWERSHELL_REAL_EXIT_CODE: {0}" -f $realExitCode))
    Set-Content -LiteralPath $logPath -Value $logLines -Encoding utf8

    $logText = Get-Content -Raw -LiteralPath $logPath
    $internalMatches = [regex]::Matches($logText, "HARNESS_GLOBAL_EXIT_CODE:\s*(\d+)")
    $externalMatches = [regex]::Matches($logText, "POWERSHELL_REAL_EXIT_CODE:\s*(\d+)")

    if ($internalMatches.Count -ne 1 -or $externalMatches.Count -ne 1) {
        Write-Error "RUN_SEQUENCE $sequence failed: missing or duplicated exit code evidence."
        $overallFailed = $true
        break
    }

    $internalExitCode = [int]$internalMatches[0].Groups[1].Value
    $externalExitCode = [int]$externalMatches[0].Groups[1].Value

    if ($internalExitCode -ne $externalExitCode -or $internalExitCode -ne 0 -or $externalExitCode -ne 0) {
        Write-Error "RUN_SEQUENCE $sequence failed: internal=$internalExitCode external=$externalExitCode."
        $overallFailed = $true
        break
    }

    if ($logText -notmatch "CLEANUP_STATUS:\s*SUCCESS") {
        Write-Error "RUN_SEQUENCE $sequence failed: cleanup success not recorded."
        $overallFailed = $true
        break
    }

    Add-Content -LiteralPath $logPath -Value "BLOCK_EXIT_CODE: 0" -Encoding utf8
}

if ($overallFailed) {
    exit 1
}

exit 0
