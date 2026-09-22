@echo off
REM ============================================================
REM  start-watcher.cmd — supervisor do review-loop.ps1
REM  Garante que o watcher de revisao autonoma esteja SEMPRE vivo.
REM  Se o processo cair (erro, falta de memoria, etc.), reinicia
REM  apos 10s. Rode UMA vez (duplo clique ou terminal). Sobrevive
REM  ao fechamento da janela se iniciado via script externo.
REM
REM  Para PARAR: feche esta janela e mate o powershell filho:
REM    powershell -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | ? {$_.CommandLine -match 'copytrade 2.*review-loop'} | %% { Stop-Process -Id $_.ProcessId }"
REM ============================================================
title CopyTrade Review Watcher (supervisor)
echo [%date% %time%] Supervisor do watcher iniciado. Log: docs\reviews\watcher.log
:loop
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0review-loop.ps1"
echo [%date% %time%] Watcher encerrou (codigo %errorlevel%). Reiniciando em 10s...
timeout /t 10 /nobreak >nul
goto loop
