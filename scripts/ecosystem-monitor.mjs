#!/usr/bin/env node
/**
 * ecosystem-monitor.mjs — camada 2 do monitoramento do ecossistema (ADR-020).
 *
 * Roda semanalmente via .github/workflows/ecosystem-monitor.yml.
 * Consulta a última release de cada repo core e compara com o estado
 * persistido em .github/ecosystem-monitor-state.json. Se houver novidades,
 * abre uma Issue categorizada (Breaking / Relevante / Depois / Ignorar).
 *
 * Determinístico: nenhum LLM na coleta. A triagem por IA ocorre DEPOIS,
 * quando a issue é despachada para um chat do pipeline.
 *
 * Env: GITHUB_TOKEN (fornecido pelo Actions).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = join(ROOT, '.github', 'ecosystem-monitor-state.json');

/** Repos core monitorados — alinhado ao baseline do ADR-020. */
const REPOS = [
  // protocolo / execução
  { repo: 'pump-fun/pump-public-docs', tier: 'core' },
  { repo: 'pump-fun/pump-fun-skills', tier: 'core' },
  { repo: 'anza-xyz/kit', tier: 'core' },
  { repo: 'solana-foundation/solana-improvement-documents', tier: 'core' },
  { repo: 'rpcpool/yellowstone-grpc', tier: 'core' },
  { repo: 'rpcpool/yellowstone-vixen', tier: 'core' },
  { repo: 'rpcpool/yellowstone-jet', tier: 'core' },
  { repo: 'helius-labs/helius-sdk', tier: 'core' },
  { repo: 'helius-labs/laserstream-sdk', tier: 'core' },
  { repo: 'helius-labs/core-ai', tier: 'core' },
  { repo: 'jito-labs/jito-docs', tier: 'core' },
  { repo: 'jito-labs/shredstream-proxy', tier: 'core' },
  { repo: 'jito-labs/searcher-examples', tier: 'periferico' },
  { repo: 'codama-idl/codama', tier: 'periferico' },
  { repo: 'solana-foundation/surfpool', tier: 'periferico' },
  { repo: 'chainstacklabs/pumpfun-bonkfun-bot', tier: 'periferico' },
  { repo: 'solanatracker/data-api-sdk', tier: 'periferico' },
];

/** Pacotes npm core (releases via registry). */
const NPM_PACKAGES = ['@pump-fun/pump-sdk', '@solana/kit', 'helius-sdk', '@triton-one/yellowstone-grpc'];

const BREAKING_RE = /breaking|migrate|migration|incompatible|removed|deprecat|\bv?\d+\.0\.0\b/i;

const headers = {
  'User-Agent': 'copytrade-ecosystem-monitor',
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
};

async function latestRelease(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers });
  if (res.status === 404) {
    // Sem releases formais (ex.: pump-public-docs): rastrear o último commit da default branch.
    const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (!repoRes.ok) return null;
    const repoData = await repoRes.json();
    const branch = repoData.default_branch ?? 'main';
    const commitRes = await fetch(`https://api.github.com/repos/${repo}/commits/${branch}`, { headers });
    if (!commitRes.ok) return null;
    const c = await commitRes.json();
    return {
      tag: c.sha.slice(0, 10),
      name: `commit ${c.sha.slice(0, 7)}: ${(c.commit?.message ?? '').split('\n')[0].slice(0, 120)}`,
      body: '',
      url: c.html_url,
      publishedAt: c.commit?.committer?.date ?? '',
    };
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status} para ${repo}`);
  const data = await res.json();
  return { tag: data.tag_name, name: data.name ?? data.tag_name, body: (data.body ?? '').slice(0, 2000), url: data.html_url, publishedAt: data.published_at };
}

async function latestNpmVersion(pkg) {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`, { headers: { 'User-Agent': 'copytrade-ecosystem-monitor' } });
  if (!res.ok) return null;
  const data = await res.json();
  return { tag: data.version, name: `${pkg}@${data.version}`, body: '', url: `https://www.npmjs.com/package/${pkg}`, publishedAt: '' };
}

function categorize(item) {
  if (BREAKING_RE.test(`${item.name}\n${item.body}`)) return 'BREAKING';
  return item.tier === 'core' ? 'RELEVANTE' : 'DEPOIS';
}

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

const state = loadState();
const news = [];

for (const { repo, tier } of REPOS) {
  const key = `gh:${repo}`;
  const latest = await latestRelease(repo);
  if (latest && state[key] !== latest.tag) {
    news.push({ source: repo, ...latest, tier });
    state[key] = latest.tag;
  }
}

for (const pkg of NPM_PACKAGES) {
  const key = `npm:${pkg}`;
  const latest = await latestNpmVersion(pkg);
  if (latest && state[key] !== latest.tag) {
    news.push({ source: pkg, ...latest, tier: 'core' });
    state[key] = latest.tag;
  }
}

writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');

if (news.length === 0) {
  console.log('Nenhuma novidade no ecossistema monitorado. Sem issue criada.');
  process.exit(0);
}

const groups = { BREAKING: [], RELEVANTE: [], DEPOIS: [] };
for (const item of news) groups[categorize(item)].push(item);

const fmt = (items) =>
  items
    .map((i) => `- **${i.source}** → [${i.name}](${i.url})${i.publishedAt ? ` (${i.publishedAt.slice(0, 10)})` : ''}`)
    .join('\n');

const issueBody = `## Monitor semanal do ecossistema — ${new Date().toISOString().slice(0, 10)}

Gerado automaticamente por \`ecosystem-monitor.yml\`. Triagem por chat (LLM) acontece sob demanda — esta issue é só a coleta determinística.

### 🔴 BREAKING (revisar imediatamente — pode afetar parser/execução)
${groups.BREAKING.length ? fmt(groups.BREAKING) : '_nenhum_'}

### 🟡 RELEVANTE (avaliar na próxima sprint; candidato a ADR)
${groups.RELEVANTE.length ? fmt(groups.RELEVANTE) : '_nenhum_'}

### ⚪ INTERESSANTE PARA DEPOIS
${groups.DEPOIS.length ? fmt(groups.DEPOIS) : '_nenhum_'}

---
Regra de estabilidade (AGENTS.md §8.2): nenhuma novidade aqui muda o baseline sem ADR + testes.
`;

// Cria a issue via API (Actions token tem permissão issues:write)
const createRes = await fetch(
  `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues`,
  {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `[ecosystem] Novidades semana ${new Date().toISOString().slice(0, 10)}`,
      body: issueBody,
      labels: ['ecosystem-monitor'],
    }),
  },
);

if (!createRes.ok) {
  console.error('Falha ao criar issue:', createRes.status, await createRes.text());
  process.exit(1);
}

const issue = await createRes.json();
console.log(`Issue criada: ${issue.html_url} (${news.length} novidades)`);
