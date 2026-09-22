# dev-setup.ps1
# Setup do ambiente de dev local (NATIVO — sem Docker, virtualização desligada).
# Verifica Node >= 20, verifica conexão com Postgres local, roda npm install + prisma generate.

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Write-Fail($msg) { Write-Host "[FALHA] $msg" -ForegroundColor Red }
function Write-Ok($msg)   { Write-Host "[OK] $msg" -ForegroundColor Green }

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Write-Host "Repo: $repoRoot"

# 1) Node >= 20
Write-Step "Verificando Node.js (>= 20)"
try {
  $nodeVersionRaw = (& node --version) 2>$null
  if (-not $nodeVersionRaw) { throw "node não respondeu" }
  $major = [int]($nodeVersionRaw.TrimStart('v').Split('.')[0])
  if ($major -lt 20) {
    Write-Fail "Node $nodeVersionRaw encontrado, mas o projeto exige >= 20. Instale Node 20 LTS."
    exit 1
  }
  Write-Ok "Node $nodeVersionRaw"
} catch {
  Write-Fail "Node.js não encontrado. Instale Node 20 LTS (https://nodejs.org/) e rode de novo."
  exit 1
}

# 2) Postgres (nativo)
Write-Step "Verificando conexão com Postgres local"
$pgOk = $false
$pgIsReady = Get-Command pg_isready -ErrorAction SilentlyContinue
if ($pgIsReady) {
  & pg_isready -h localhost -p 5432 | Out-Null
  if ($LASTEXITCODE -eq 0) { $pgOk = $true }
} else {
  Write-Host "pg_isready não encontrado no PATH; tentando conexão TCP em localhost:5432..."
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", 5432, $null, $null)
    if ($iar.AsyncWaitHandle.WaitOne(2000) -and $client.Connected) { $pgOk = $true }
    $client.Close()
  } catch { $pgOk = $false }
}
if (-not $pgOk) {
  Write-Fail "Postgres não respondeu em localhost:5432."
  Write-Host "Instale Postgres nativo (sem Docker) e garanta que está rodando antes de continuar."
  exit 1
}
Write-Ok "Postgres respondeu"

# 3) npm install
Write-Step "npm install"
Push-Location $repoRoot
try {
  npm install
  if ($LASTEXITCODE -ne 0) { Write-Fail "npm install falhou (exit $LASTEXITCODE)"; exit 1 }
  Write-Ok "Dependências instaladas"

  # 4) prisma generate
  Write-Step "prisma generate"
  npm run prisma:generate
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "prisma generate falhou (exit $LASTEXITCODE). Verifique se packages/database já existe."
    exit 1
  }
  Write-Ok "Prisma Client gerado"
} finally {
  Pop-Location
}

Write-Host "`n[SETUP COMPLETO] Ambiente de dev nativo pronto. Próximo: verificar .env e rodar npm run typecheck." -ForegroundColor Green
exit 0
