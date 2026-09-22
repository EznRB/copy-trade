# merge-sprint.ps1 — Gate mecânico de merge de sprint (MSG 2 do guia do dono)
# Uso: powershell -File scripts/merge-sprint.ps1 -Branch sprint/f1-postgres-live [-Push]
#
# Regras (AGENTS.md 7.1 + docs/operations/chat-prompts.md):
# - TODO commit da branch precisa de docs/reviews/<full-sha>.md com veredito APROVADO.
# - Se qualquer commit nao tiver review ou estiver REJEITADO: sai com erro, sem merge.
# - Roda gates (lint/typecheck/test) no merge resultante antes de considerar sucesso.
# - Push so com -Push explicito.

param(
    [Parameter(Mandatory = $true)][string]$Branch,
    [switch]$Push
)

$ErrorActionPreference = 'Continue'
$fail = $false

if (-not $Branch.StartsWith('sprint/')) {
    Write-Error "Branch invalida: '$Branch'. So se mergeia sprint/*."
    exit 2
}

git rev-parse --verify $Branch 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error "Branch '$Branch' nao existe."; exit 2 }

git fetch --all --quiet 2>$null

# Commits da branch que ainda nao estao no master
$commits = git log --format="%H" master..$Branch
if (-not $commits) { Write-Output "Nada a mergear: '$Branch' ja esta contida em master."; exit 0 }

Write-Output "== Verificando reviews de $($commits.Count) commit(s) em $Branch =="
foreach ($sha in $commits) {
    $review = "docs/reviews/$sha.md"
    if (-not (Test-Path $review)) {
        Write-Output "  [FALTA REVIEW] $($sha.Substring(0,8))"
        $fail = $true
        continue
    }
    $content = Get-Content $review -Raw
    if ($content -match 'APROVADO') {
        Write-Output "  [APROVADO] $($sha.Substring(0,8))"
    } else {
        Write-Output "  [REJEITADO/INDEFINIDO] $($sha.Substring(0,8)) -> ver $review"
        $fail = $true
    }
}

if ($fail) {
    Write-Error "`nMERGE ABORTADO: ha commits sem veredito APROVADO. Corrigir via DEV (ou review-fix/*) antes de mergear."
    exit 1
}

# Working tree limpo?
$dirty = git status --porcelain
if ($dirty) { Write-Error "Working tree sujo. Commit/stash antes de mergear.`n$dirty"; exit 1 }

Write-Output "`n== Mergeando $Branch em master (no-ff) =="
git checkout master --quiet
git merge --no-ff $Branch -m "merge: $Branch (todos os commits aprovados em docs/reviews/)"
if ($LASTEXITCODE -ne 0) { Write-Error "Merge falhou (conflito?). Resolva manualmente ou chame o CEREBRO."; exit 1 }

Write-Output "`n== Rodando gates no merge =="
npm run lint; if ($LASTEXITCODE -ne 0) { $fail = $true }
npm run typecheck; if ($LASTEXITCODE -ne 0) { $fail = $true }
npm test; if ($LASTEXITCODE -ne 0) { $fail = $true }

if ($fail) {
    Write-Error "`nGates FALHARAM apos merge. Reverta: git checkout master; git reset --hard <sha-anterior>."
    exit 1
}

Write-Output "`MERGE OK: $Branch integrada ao master com todos os commits aprovados e gates verdes."

if ($Push) {
    git push origin master
    if ($LASTEXITCODE -eq 0) { Write-Output "Push para origin/master concluido." } else { Write-Error "Push falhou."; exit 1 }
}
