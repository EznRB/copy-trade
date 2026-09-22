// check-secrets.mjs
// Varredura de padrões suspeitos de secrets (private key, seed phrase, base58 longo).
// Cross-platform (Windows/Linux CI). Exit 1 se encontrar qualquer suspeita.
// Substitui o antigo check-secrets.ps1 (que não rodava no CI Ubuntu).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
console.log(`Varrendo: ${repoRoot}`);

const excludeDirs = new Set(["node_modules", ".git", "dist", ".next", "out", "coverage"]);
const skipFiles = new Set(["package-lock.json"]);
const allowExtensions = [".example", ".sample", ".template"];
const textExtensions = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".jsonc",
  ".py", ".md", ".yml", ".yaml", ".toml", ".ini", ".cfg",
  ".env", ".txt", ".sql", ".prisma", ".ps1", ".sh",
]);

const patterns = [
  { name: "private key literal", regex: /PRIVATE KEY|private[_ -]?key\s*[:=]|BEGIN [A-Z ]*PRIVATE KEY/i },
  { name: "seed phrase", regex: /seed phrase|mnemonic|secret recovery phrase/i },
  { name: "base58 longo (possivel key/secret)", regex: /\b[1-9A-HJ-NP-Za-km-z]{64,88}\b/ },
];

// Arquivos isentos de padrões de FRASE (políticas/documentação mencionam os termos).
// A varredura de base58 continua ativa neles.
const phraseExemptFiles = new Set(["check-secrets.mjs"]);

const policyComment = /never|proibido|forbidden|NUNCA|poli(cy|tica)|exemplo sem valor/;

const findings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (excludeDirs.has(entry)) continue;
    const stats = statSync(full);
    if (stats.isDirectory()) { walk(full); continue; }

    if (allowExtensions.some((e) => entry.endsWith(e))) continue;
    if (skipFiles.has(entry)) continue;
    const ext = extname(entry).toLowerCase();
    const isEnv = entry.startsWith(".env") && entry !== ".env.example";
    if (!isEnv && !textExtensions.has(ext)) continue;

    const lines = readFileSync(full, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("#") || trimmed.startsWith("//")) return;
      const phraseExempt = phraseExemptFiles.has(entry) || ext === ".md";
      for (const p of patterns) {
        if (phraseExempt && p.name !== "base58 longo (possivel key/secret)") continue;
        if (!p.regex.test(line)) continue;
        if (policyComment.test(line)) continue;
        findings.push({
          file: relative(repoRoot, full),
          line: i + 1,
          pattern: p.name,
          excerpt: trimmed.slice(0, 80),
        });
      }
    });
  }
}

walk(repoRoot);

console.log("");
if (findings.length > 0) {
  console.error(`[FALHA] Encontradas ${findings.length} ocorrência(s) suspeita(s):`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  [${f.pattern}]  ${f.excerpt}`);
  console.error("\nAção: remova o conteúdo real, mova para o ambiente/secret manager e, se já foi commitado, revogue/rotacione.");
  process.exit(1);
}

console.log("[OK] Nenhum padrão suspeito encontrado.");
