# check-secrets.ps1
# Varre o repo por padrões suspeitos de secrets (private key, seed phrase, base58 longo).
# Exit 1 se encontrar qualquer suspeita. Arquivos *.example são permitidos.

$ErrorActionPreference = "Continue"

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Write-Host "Varrendo: $repoRoot" -ForegroundColor Cyan

$excludeDirs = @("node_modules", ".git", "dist", ".next", "out", "coverage")

# Padrões suspeitos
$patterns = @(
  @{ Name = "private key literal"; Regex = "PRIVATE KEY|private_key\s*=|BEGIN [A-Z ]*PRIVATE KEY" },
  @{ Name = "seed phrase";        Regex = "seed phrase|mnemonic|secret recovery phrase" },
  @{ Name = "base58 longo (possivel key/secret)"; Regex = "\b[1-9A-HJ-NP-Za-km-z]{64,88}\b" }
)

# Arquivos isentos de padroes de FRASE (politicas/documentacao mencionam os termos).
# A varredura de base58 continua ativa neles.
$phraseExempt = @("check-secrets.ps1")

# package-lock.json contem hashes integrity (falsos positivos de base58) — nao e portador de secrets.
$skipFiles = @("package-lock.json")

# Arquivos permitidos a mencionar os padrões (templates/docs)
$allowExtensions = @(".example", ".sample", ".template")
function Test-Allowed([string]$path) {
  foreach ($ext in $allowExtensions) { if ($path.EndsWith($ext)) { return $true } }
  return $false
}

# Extensões que vale a pena varrer
$textExtensions = @(
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".jsonc",
  ".py", ".md", ".yml", ".yaml", ".toml", ".ini", ".cfg",
  ".env", ".txt", ".sql", ".prisma", ".ps1", ".sh"
)

$findings = New-Object System.Collections.Generic.List[object]

Get-ChildItem -Path $repoRoot -Recurse -File | Where-Object {
  $rel = $_.FullName.Substring($repoRoot.Length).TrimStart('\', '/')
  $skip = $false
  foreach ($d in $excludeDirs) {
    if ($rel -match "(^|[\\/])$([regex]::Escape($d))([\\/]|$)") { $skip = $true; break }
  }
  if ($skip) { return $false }
  if (Test-Allowed $_.Name) { return $false }
  if ($_.Name -in $skipFiles) { return $false }
  # .env real é varrido (nunca deve ser commitado); .env.example é permitido
  $ext = if ($_.Extension) { $_.Extension.ToLower() } else { "" }
  if ($_.Name -like ".env*" -and $_.Name -ne ".env.example") { return $true }
  return $textExtensions -contains $ext
} | ForEach-Object {
  $file = $_
  $rel = $file.FullName.Substring($repoRoot.Length).TrimStart('\', '/')
  $lineNumber = 0
  foreach ($line in (Get-Content -LiteralPath $file.FullName -ErrorAction SilentlyContinue)) {
    $lineNumber++
    $isPhraseExempt = ($file.Name -in $phraseExempt) -or ($file.Extension -eq ".md")
    foreach ($p in $patterns) {
      if ($isPhraseExempt -and $p.Name -ne "base58 longo (possivel key/secret)") { continue }
      if ($line -match $p.Regex) {
        # Ignorar linhas que são claramente comentários de política/documentação
        if ($line -match "never|proibido|forbidden|NUNCA|poli(cy|tica)|exemplo sem valor") { continue }
        $findings.Add([pscustomobject]@{
          File    = $rel
          Line    = $lineNumber
          Pattern = $p.Name
          Excerpt = $line.Trim().Substring(0, [Math]::Min(80, $line.Trim().Length))
        })
      }
    }
  }
}

Write-Host ""
if ($findings.Count -gt 0) {
  Write-Host "[FALHA] Encontradas $($findings.Count) ocorrência(s) suspeita(s):" -ForegroundColor Red
  $findings | ForEach-Object {
    Write-Host ("  {0}:{1}  [{2}]  {3}" -f $_.File, $_.Line, $_.Pattern, $_.Excerpt)
  }
  Write-Host "`nAção: remova o conteúdo real, mova para o ambiente/secret manager e, se já foi commitado, revogue/rotacione." -ForegroundColor Red
  exit 1
}

Write-Host "[OK] Nenhum padrão suspeito encontrado." -ForegroundColor Green
exit 0
