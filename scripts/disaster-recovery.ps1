# AI-Builder-Brain — Windows PowerShell Disaster Recovery Wrapper
param(
    [switch]$RestoreToOriginal,
    [switch]$ConfirmDestructiveOverwrite,
    [switch]$DryRun,
    [string]$TargetDir = "",
    [string]$SnapshotDir = ""
)

$argsList = @("scripts/disaster-recovery.mjs")

if ($RestoreToOriginal) { $argsList += "--restore-to-original" }
if ($ConfirmDestructiveOverwrite) { $argsList += "--confirm-destructive-overwrite" }
if ($DryRun) { $argsList += "--dry-run" }
if ($TargetDir) { $argsList += "--target-dir"; $argsList += $TargetDir }
if ($SnapshotDir) { $argsList += "--snapshot-dir"; $argsList += $SnapshotDir }

Write-Host "Executing Disaster Recovery Runner..." -ForegroundColor Cyan
node $argsList
exit $LASTEXITCODE

