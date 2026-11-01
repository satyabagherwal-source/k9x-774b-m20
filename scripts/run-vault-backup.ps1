# AI-Builder-Brain — Windows Daily Vault Backup Wrapper
param(
    [switch]$SkipRemote,
    [switch]$DryRun
)

$argsList = @("04_WORKFLOWS/factory-engine/vault-backup-engine.mjs")

if ($SkipRemote) { $argsList += "--skip-remote" }
if ($DryRun) { $argsList += "--dry-run" }

Write-Host "Running AI-Builder-Brain Daily Vault Backup..." -ForegroundColor Cyan
Set-Location "C:\AI-Builder-Brain"

$logDir = "C:\AI-Builder-Brain\.project-brain\backups"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
$logFile = Join-Path $logDir "daily-backup.log"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"======================================================================" | Out-File -FilePath $logFile -Append -Encoding utf8
"[$timestamp] Windows Scheduled Task execution started" | Out-File -FilePath $logFile -Append -Encoding utf8
"[$timestamp] Command: node $argsList" | Out-File -FilePath $logFile -Append -Encoding utf8

# Execute node process and capture output to logfile and console
$proc = Start-Process -FilePath "node" -ArgumentList $argsList -WorkingDirectory "C:\AI-Builder-Brain" -NoNewWindow -Wait -PassThru -RedirectStandardOutput "$logDir\task-stdout.tmp" -RedirectStandardError "$logDir\task-stderr.tmp"

if (Test-Path "$logDir\task-stdout.tmp") {
    Get-Content "$logDir\task-stdout.tmp" | Out-File -FilePath $logFile -Append -Encoding utf8
    Get-Content "$logDir\task-stdout.tmp"
    Remove-Item "$logDir\task-stdout.tmp" -Force -ErrorAction SilentlyContinue
}
if (Test-Path "$logDir\task-stderr.tmp") {
    Get-Content "$logDir\task-stderr.tmp" | Out-File -FilePath $logFile -Append -Encoding utf8
    Get-Content "$logDir\task-stderr.tmp"
    Remove-Item "$logDir\task-stderr.tmp" -Force -ErrorAction SilentlyContinue
}

$endTimestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$endTimestamp] Execution completed with Exit Code: $($proc.ExitCode)" | Out-File -FilePath $logFile -Append -Encoding utf8

exit $proc.ExitCode

