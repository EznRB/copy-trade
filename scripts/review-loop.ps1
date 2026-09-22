<#
.SYNOPSIS
  Watcher autonomo de revisao de codigo (pipeline code-reviewer).

.DESCRIPTION
  Loop que monitora commits novos em branches de producao (sprint/*, feat/*, task/*),
  roda os gates (lint/typecheck/test), invoca o agente code-reviewer via `opencode run`
  headless, grava o veredito em docs/reviews/<sha>.md e commita os artefatos de review.

  Politica de rejeicao (definida neste chat): review REJEITADO dispara tentativa de
  correcao automatica em branch review-fix/<branch>, NUNCA direto na branch do produtor.

.CONTROLE DE ESTADO
  docs/reviews/state.json no branch master rastreia SHAs ja processados (dedup).
  Idempotente: mesmo SHA nunca e processado duas vezes.

.PARAMETERS
  -IntervalSeconds : intervalo do loop (default 60)
  -BranchPatterns  : branches monitoradas (default sprint/*, feat/*, task/*)
  -AutoFix         : tentar corrigir reviews rejeitados (default $true)
  -Once            : executa uma passada e sai (util para teste)
#>
param(
    [int]$IntervalSeconds = 60,
    [string[]]$BranchPatterns = @('sprint/*', 'feat/*', 'task/*'),
    [bool]$AutoFix = $true,
    [switch]$Once
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $RepoRoot

$ReviewsDir   = Join-Path $RepoRoot 'docs\reviews'
$StateFile    = Join-Path $ReviewsDir 'state.json'
$LogFile      = Join-Path $ReviewsDir 'watcher.log'
$ExcludeSha72 = 'review-marker' # placeholder

function Write-WatchLog([string]$msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
    Add-Content -Path $LogFile -Value $line
    Write-Host $line
}

function Get-State {
    if (Test-Path $StateFile) {
        return (Get-Content $StateFile -Raw | ConvertFrom-Json)
    }
    return [pscustomobject]@{ reviewed = @(); rejected = @() }
}

function Save-State($state) {
    if (-not (Test-Path $ReviewsDir)) { New-Item -ItemType Directory -Path $ReviewsDir -Force | Out-Null }
    $state | ConvertTo-Json -Depth 4 | Set-Content -Path $StateFile -Encoding UTF8
}

function Get-CandidateCommits {
    $branches = @()
    foreach ($pat in $BranchPatterns) {
        $branches += git branch --list $pat --format '%(refname:short)'
    }
    $branches = $branches | Where-Object { $_ } | Sort-Object -Unique
    $commits = @()
    foreach ($b in $branches) {
        # commits da branch que nao estao em master, do mais antigo ao mais novo
        $shas = git log master..$b --format='%H' --reverse
        foreach ($sha in $shas) {
            if ($sha) { $commits += [pscustomobject]@{ Sha = $sha; Branch = $b } }
        }
    }
    return $commits
}

function Invoke-Native([string]$cmd) {
    # executa comando nativo sem que stderr vire excecao (PS 5.1 + EAP=Stop)
    cmd /c "$cmd >NUL 2>&1"
    return $LASTEXITCODE
}

function Invoke-Gates {
    Write-WatchLog 'Gates: lint'
    $lint = Invoke-Native 'npm run lint --silent'
    Write-WatchLog 'Gates: typecheck'
    $tc = Invoke-Native 'npm run typecheck --silent'
    Write-WatchLog 'Gates: test'
    $tst = Invoke-Native 'npm test --silent'
    return [pscustomobject]@{
        Lint = $lint; Typecheck = $tc; Test = $tst
        Ok = ($lint -eq 0 -and $tc -eq 0 -and $tst -eq 0)
    }
}

function Invoke-CodeReview([string]$sha, [string]$branch) {
    $prompt = @"
Voce e o code-reviewer deste repositorio (leia .agents/code-reviewer.md e AGENTS.md).
Revise ADVERSARIALMENTE o commit ${sha} (branch $branch). Rode: git show $sha.
Criterios: bugs, erros, incompatibilidades, violacoes das regras do AGENTS.md, testes faltantes.
NAO modifique codigo nesta etapa. NAO faca commit.
Termine sua resposta com UMA das linhas exatas:
VERDICT: APROVADO
VERDICT: REJEITADO
Seguida de lista de achados (cada um com severidade CRITICAL/HIGH/MEDIUM/LOW).
"@
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'  # stderr do CLI nao vira excecao
    try {
        $out = opencode run --agent code-reviewer $prompt 2>&1 | Out-String
    } finally {
        $ErrorActionPreference = $prev
    }
    return $out
}

function Invoke-AutoFix([string]$sha, [string]$branch, [string]$reviewFile) {
    $fixBranch = "review-fix/$($branch -replace '/','-')"
    git branch -f $fixBranch $sha | Out-Null
    $prompt = "Corrija, SOMENTE neste diretorio de trabalho, os achados do review do commit $sha (anexados em arquivo). Regras: correcao MINIMA; nao altere logica de testes; rode npm run lint, npm run typecheck, npm test; ao terminar com gates passando, faca UM commit com mensagem 'fix(review): corrige achados de $sha'. NUNCA altere TRADING_MODE, LIVE_TRADING_ENABLED ou constantes MAX_*. NAO edite arquivos fora deste diretorio."
    $wt = Join-Path $RepoRoot ".review-wt"
    if (Test-Path $wt) { git worktree remove $wt --force 2>$null }
    git worktree add $wt $fixBranch 2>$null | Out-Null
    Push-Location $wt
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        npm install --silent 2>&1 | Out-Null
        $out = opencode run $prompt -f $reviewFile 2>&1 | Out-String
    } finally {
        $ErrorActionPreference = $prev
        Pop-Location
    }
    # limpeza do worktree temporario (branch review-fix/* permanece)
    git worktree remove $wt --force 2>$null
    git worktree prune
    return $out
}

function Register-Review([string]$sha, [string]$branch, [string]$reviewOut, $gates, [string]$verdict) {
    $file = Join-Path $ReviewsDir "$sha.md"
    $content = @"
# Review $sha

- Branch: $branch
- Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
- Gates: lint=$($gates.Lint) typecheck=$($gates.Typecheck) test=$($gates.Test) (0 = ok)
- Veredito: **$verdict**

## Saida do code-reviewer

$reviewOut
"@
    Set-Content -Path $file -Value $content -Encoding UTF8
    cmd /c "git add `"docs/reviews/$sha.md`" `"docs/reviews/state.json`" 2>NUL"
    cmd /c "git commit -m `"review($branch): $verdict $sha`" 2>NUL" | Out-Null
    Write-WatchLog "Review registrado: $sha -> $verdict"
}

Write-WatchLog "Watcher iniciado. Padroes: $($BranchPatterns -join ', ') | intervalo ${IntervalSeconds}s | autofix=$AutoFix"

do {
    try {
        $state = Get-State
        $known = @($state.reviewed) + @($state.rejected)
        $candidates = Get-CandidateCommits
        foreach ($c in $candidates) {
            if ($known -contains $c.Sha) { continue }
            Write-WatchLog "Novo commit detectado: $($c.Sha) em $($c.Branch)"
            $gates = Invoke-Gates
            $reviewOut = Invoke-CodeReview -sha $c.Sha -branch $c.Branch
            $verdict = if ($reviewOut -match 'VERDICT:\s*REJEITADO') { 'REJEITADO' } else { 'APROVADO' }
            if (-not $gates.Ok -and $verdict -eq 'APROVADO') { $verdict = 'REJEITADO (gates falharam)' }
            if ($verdict -match 'REJEITADO') {
                if ($AutoFix) {
                    Write-WatchLog "Tentando auto-fix de $($c.Sha)..."
                    $reviewFile = Join-Path $env:TEMP "review-$($c.Sha).md"
                    # remove ANSI escapes antes de anexar
                    ($reviewOut -replace "`e\[[0-9;]*m", '') | Set-Content -Path $reviewFile -Encoding UTF8
                    $fixOut = Invoke-AutoFix -sha $c.Sha -branch $c.Branch -reviewFile $reviewFile
                    $reviewOut += "`n`n## Tentativa de auto-fix (branch review-fix/$($c.Branch -replace '/','-'))`n`n$fixOut"
                }
                $state.rejected += $c.Sha
            } else {
                $state.reviewed += $c.Sha
            }
            Save-State $state
            Register-Review -sha $c.Sha -branch $c.Branch -reviewOut $reviewOut -gates $gates -verdict $verdict
        }
    } catch {
        Write-WatchLog "ERRO no loop: $($_.Exception.Message)"
    }
    if ($Once) { break }
    Start-Sleep -Seconds $IntervalSeconds
} while ($true)
