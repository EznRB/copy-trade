#!/usr/bin/env node
/**
 * split-adrs.mjs — one-shot: divide decision-log.md em arquivos ADR-NNN.md
 * individuais (docs/architecture/adr/) + regenera decision-log.md como indice.
 * Renumeracao deterministica de duplicatas: 011/012/013/014 (2a ocorrencia)
 * -> 021/022/023/024, com nota de renumeracao preservada no arquivo.
 * Uso: node scripts/split-adrs.mjs --write   (sem --write = dry-run)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'docs/architecture/decision-log.md');
const ADR_DIR = join(ROOT, 'docs/architecture/adr');
const WRITE = process.argv.includes('--write');

const text = readFileSync(SRC, 'utf8');
const headMatch = text.match(/^([\s\S]*?)(?=^## ADR-)/m);
const header = headMatch ? headMatch[1] : '';

const re = /^## ADR-(\d+) *[-—] *(.*)$/gm;
const matches = [...text.matchAll(re)];
const blocks = [];
for (let i = 0; i < matches.length; i++) {
  const start = matches[i].index;
  const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
  blocks.push({
    origNum: matches[i][1],
    title: matches[i][2].trim(),
    body: text.slice(start, end).trim(),
  });
}

// Renumeracao de duplicatas (ordem do documento vence: segunda ocorrencia sobe)
const seen = new Set();
let nextFree = 21;
const renames = [];
for (const b of blocks) {
  if (seen.has(b.origNum)) {
    while (seen.has(String(nextFree).padStart(3, '0'))) nextFree++;
    b.newNum = String(nextFree).padStart(3, '0');
    renames.push(`${b.origNum}->${b.newNum} (${b.title})`);
    b.body = b.body.replace(
      /^## ADR-\d+/,
      `## ADR-${b.newNum}`,
    );
    b.body += `\n- **Nota de renumeracao:** ex-ADR-${b.origNum} (numero duplicado; renumerado no split de 2026-09-24).`;
  } else {
    b.newNum = b.origNum;
  }
  seen.add(b.newNum);
  seen.add(b.origNum);
}

const slug = (t) =>
  t.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

if (!WRITE) {
  console.log('DRY-RUN. Blocos:', blocks.length);
  console.log('Renomes:', renames);
  blocks.forEach((b) => console.log(`adr/ADR-${b.newNum}-${slug(b.title)}.md`));
  process.exit(0);
}

mkdirSync(ADR_DIR, { recursive: true });
for (const b of blocks) {
  writeFileSync(join(ADR_DIR, `ADR-${b.newNum}-${slug(b.title)}.md`), b.body + '\n', 'utf8');
}

// Indice ordenado por numero
const sorted = [...blocks].sort((a, b) => a.newNum.localeCompare(b.newNum));
const rows = sorted
  .map((b) => `| [ADR-${b.newNum}](adr/ADR-${b.newNum}-${slug(b.title)}.md) | ${b.title} |`)
  .join('\n');

const index = `# Decision Log — Índice de ADRs

> **Estrutura:** um arquivo por decisão em \`adr/\`. Este índice é somente leitura de navegação.
> Novo ADR = novo arquivo \`adr/ADR-0NN-<slug>.md\` com número sequencial único + linha neste índice.
> **Regra anti-alucinação (AGENTS.md §8.3):** citar ADR por número; nunca párafrasear decisão de memória.
> Renumerados no split (2026-09-24): ex-011→021 (WSS Helius), ex-012→022 (env sem strict), ex-013→023 (fixture F1), ex-014→024 (retenção/single-instance).

| ADR | Título |
|---|---|
${rows}
`;

writeFileSync(SRC, index, 'utf8');
console.log(`OK: ${blocks.length} ADRs escritos em adr/, índice regenerado.`);
console.log('Renomes:', renames);
