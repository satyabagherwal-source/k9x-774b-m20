# AI-Builder-Brain -- Windows Task Scheduler Registration for Daily Vault Backup
# Scheduled at 02:00 AM Daily with StartWhenAvailable for missed runs
param(
    [switch]$Unregister,
    [switch]$Status
)

$TaskName = "AI-Builder-Brain-Daily-Vault-Backup"
$ScriptPath = "C:\AI-Builder-Brain\scripts\run-vault-backup.ps1"

if ($Status) {
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($task) {
        $info = Get-ScheduledTaskInfo -TaskName $TaskName
        Write-Host "[STATUS] Task Name: $($task.TaskName)" -ForegroundColor Green
        Write-Host "   State:       $($task.State)"
        Write-Host "   Last Run:    $($info.LastRunTime)"
        Write-Host "   Last Result: $($info.LastTaskResult)"
        Write-Host "   Next Run:    $($info.NextRunTime)"
    } else {
        Write-Host "[INFO] Task '$TaskName' is not registered." -ForegroundColor Yellow
    }
    exit 0
}

if ($Unregister) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "[UNREGISTERED] Removed task: $TaskName" -ForegroundColor Yellow
    exit 0
}

Write-Host "Registering Daily Vault Backup in Windows Task Scheduler..." -ForegroundColor Cyan

$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -NonInteractive -WindowStyle Hidden -File `"$ScriptPath`"" -WorkingDirectory "C:\AI-Builder-Brain"

$Trigger = New-ScheduledTaskTrigger -Daily -At "02:00AM"

$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

try {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Force | Out-Null
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "[SUCCESS] Registered Scheduled Task: $TaskName" -ForegroundColor Green
    Write-Host "   Schedule: Daily at 02:00 AM" -ForegroundColor Gray
    Write-Host "   Missed runs policy: StartWhenAvailable (Enabled)" -ForegroundColor Gray
    Write-Host "   Next Scheduled Run: $($info.NextRunTime)" -ForegroundColor Gray
} catch {
    Write-Host "[ERROR] Failed to register Scheduled Task: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
