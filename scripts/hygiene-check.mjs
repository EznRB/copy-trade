#!/usr/bin/env node
/**
 * hygiene-check.mjs — limpeza mensal determinística do repositório.
 * Filosofia: REPORTA, nunca deleta. A deleção exige decisão humana/ADR.
 *
 * Checagens:
 *  1. Referências "ADR-0NN" em código/docs que não existem em docs/architecture/adr/
 *  2. Links markdown internos quebrados em docs/
 *  3. Arquivos de código-fonte sem modificação há >90 dias (heurística de estagnação)
 *  4. Dependências npm desatualizadas (npm outdated --json)
 *
 * Saída: relatório em stdout (o workflow posta como issue).
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const issues = [];

// ---------- 1. Referências ADR-NNN inexistentes ----------
const adrDir = join(ROOT, 'docs/architecture/adr');
const adrNums = new Set(
  existsSync(adrDir)
    ? readdirSync(adrDir).map((f) => f.match(/^ADR-(\d+)/)?.[1]).filter(Boolean)
    : [],
);

function* walk(dir, exts) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'dist', '.serena', 'poc'].includes(e.name)) continue;
      yield* walk(p, exts);
    } else if (exts.some((x) => e.name.endsWith(x))) yield p;
  }
}

const srcDirs = ['packages', 'services', 'apps', 'docs', 'scripts'];
for (const d of srcDirs) {
  for (const f of walk(join(ROOT, d), ['.ts', '.md', '.mjs', '.ps1'])) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/ADR-(\d{3})/g)) {
      if (!adrNums.has(m[1])) {
        issues.push(`**ADR inexistente** \`ADR-${m[1]}\` referenciado em \`${f.slice(ROOT.length + 1)}\``);
        break; // 1 por arquivo basta
      }
    }
  }
}

// ---------- 2. Links markdown internos quebrados em docs/ ----------
for (const f of walk(join(ROOT, 'docs'), ['.md'])) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\]\(([^)http][^)]*)\)/g)) {
    const target = m[1].split('#')[0];
    if (!target) continue;
    const abs = join(dirname(f), target);
    if (!existsSync(abs)) {
      issues.push(`**Link quebrado** em \`${f.slice(ROOT.length + 1)}\` → \`${target}\``);
    }
  }
}

// ---------- 3. Código-fonte estagnado (>90 dias sem toque) ----------
const NINETY_DAYS = 90 * 24 * 3600 * 1000;
const now = Date.now();
for (const d of ['packages', 'services']) {
  for (const f of walk(join(ROOT, d), ['.ts'])) {
    if (f.endsWith('.test.ts') || f.endsWith('.d.ts')) continue;
    const age = now - statSync(f).mtimeMs;
    if (age > NINETY_DAYS) {
      issues.push(`**Estagnado >90d:** \`${f.slice(ROOT.length + 1)}\` (avaliar: ainda usado? candidato a remoção/refactor)`);
    }
  }
}

// ---------- 4. Deps desatualizadas ----------
try {
  const out = execSync('npm outdated --json', { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  const data = JSON.parse(out || '{}');
  const n = Object.keys(data).length;
  if (n > 0) issues.push(`**${n} dependência(s) desatualizada(s)** (ver \`npm outdated\`; majors passam por ADR, §8.2)`);
} catch {
  /* npm outdated retorna exit!=0 quando há outdated — o JSON vem no stdout do erro, ignorado aqui propositalmente */
}

// ---------- relatório ----------
console.log(`# Relatório de higiene — ${new Date().toISOString().slice(0, 10)}\n`);
if (issues.length === 0) {
  console.log('✅ Nenhum problema encontrado. Repositório limpo.');
} else {
  console.log(`Encontrados **${issues.length}** itens (report-only; deleção exige decisão humana):\n`);
  for (const i of issues) console.log(`- ${i}`);
}
