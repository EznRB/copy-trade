<#
.SYNOPSIS
  Cria um worktree + branch de sprint para um chat produtor de codigo.

.DESCRIPTION
  Convenção do pipeline multi-chat: cada chat produtor trabalha em
  ../copytrade-wt-<nome> na branch sprint/<nome>. Ao final de cada task,
  o produtor commita na branch. O watcher (scripts/review-loop.ps1) detecta
  e revisa automaticamente.

.EXAMPLE
  .\scripts\start-sprint-worktree.ps1 -Name wallet-score
#>
param(
    [Parameter(Mandatory = $true)][string]$Name
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RepoRoot

$branch = "sprint/$Name"
$wtPath = Join-Path (Split-Path $RepoRoot -Parent) "copytrade-wt-$Name"

if (git branch --list $branch) {
    Write-Host "Branch $branch ja existe."
} else {
    git branch $branch master
}
if (Test-Path $wtPath) {
    Write-Host "Worktree $wtPath ja existe."
} else {
    git worktree add $wtPath $branch
}
Write-Host ""
Write-Host "Pronto. Instrua o chat produtor a trabalhar em: $wtPath"
Write-Host "Branch: $branch  |  Commits nessa branch serao revisados automaticamente."
