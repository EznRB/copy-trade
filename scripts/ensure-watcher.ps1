# ensure-watcher.ps1 — inicia o watcher SOMENTE se nao estiver rodando (anti-duplicata).
$running = Get-CimInstance Win32_Process -Filter "Name='cmd.exe'" |
    Where-Object { $_.CommandLine -match 'start-watcher\.cmd' }
$runningPs = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.CommandLine -match 'review-loop\.ps1' -and $_.CommandLine -notmatch 'ensure-watcher' }

if ($running -or $runningPs) {
    Write-Host 'Watcher JA esta rodando. Nada a fazer.'
    exit 0
}
$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine = 'cmd /c "C:\Users\enzo\Desktop\copytrade 2\scripts\start-watcher.cmd"'
}
if ($result.ReturnValue -eq 0) {
    Write-Host "Watcher iniciado (PID $($result.ProcessId))."
} else {
    Write-Host "FALHA ao iniciar watcher (codigo $($result.ReturnValue))."
    exit 1
}
