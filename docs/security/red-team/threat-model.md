# Threat Model — Copytrade Engine

> Documento vivo, mantido pelo agente red-team. Atualizar a cada sprint.
> Convenção epistemológica: `FACT` | `HYPOTHESIS` | `ASSUMPTION` (§5 AGENTS.md).

Última revisão: 2026-09-21 (criação).

## 1. Ativos protegidos

| Ativo                                  | Impacto se comprometido           | Criticidade |
| -------------------------------------- | --------------------------------- | ----------- |
| Capability de enviar transações (futuro F9+) | Perda total de capital            | CRITICAL    |
| Guards: Risk Engine, kill switch, dupla trava LIVE | Perda de capital, trade não autorizado | CRITICAL |
| Banco PostgreSQL (posições, sinais, scores) | Decisões corrompidas, perda de estado | HIGH     |
| Ingestão (eventos on-chain, webhooks)  | Sinais falsos → trades errados    | HIGH        |
| Config/env (RPC keys, DATABASE_URL, Telegram token) | Abuso de quota, acesso ao DB | HIGH        |
| Integridade dos scores (wallet/token/copyability) | Manipulação de decisões | HIGH   |
| Alertas Telegram                        | Cegueira operacional, phishing    | MEDIUM      |

## 2. Superfícies de ataque

| Superfície | Vetores principais |
| ---------- | ------------------ |
| Parsers de eventos on-chain / metadata de token | Payload malformado, strings gigantes, números extremos, unicode hostil, encoding |
| Webhook receivers (Helius etc.) | Payload forjado, replay, ausência de verificação de assinatura (verificar FATO) |
| Endpoints HTTP internos (se houver) | Auth ausente, injection, DoS |
| Prisma / raw queries | SQL injection, filtros dinâmicos sem validação |
| Shell comandos (scripts, providers) | Command injection via dados de token |
| Alertas Telegram | Template injection (Markdown/HTML) via símbolo/nome de token |
| Supply chain | Dependência maliciosa, lockfile poisoning, postinstall scripts |
| Risk Engine / guards | Race condition, bypass por ordem de validação, estado inconsistente |
| Dedup (`signature+instruction_index+wallet`) | Replay, colisão, chave incompleta |

## 3. Trust boundaries

1. **Rede externa (RPC/webhook) → ingestion**: dados hostis por padrão; validar tudo com zod antes de persistir/despachar.
2. **Ingestion → strategy**: eventos já normalizados; strategy não deve re-confiar cegamente em campos livres.
3. **Strategy → Risk Engine**: Risk Engine valida independentemente; nunca assume que o sinal já foi saneado.
4. **Risk Engine → execution**: execution recebe ordem aprovada; não confia em re-cálculo externo.
5. **Env/config → processos**: secrets somente via env; nunca em logs (verificar redaction).

## 4. Suposições a validar em sprints

- [ ] (HYPOTHESIS) Webhooks verificam assinatura do provedor — confirmar com código.
- [ ] (HYPOTHESIS) Não há raw queries sem parâmetros (`$queryRawUnsafe`) — confirmar.
- [ ] (HYPOTHESIS) Kill switch não pode ser contornado por race com sinal em voo — confirmar com fault injection.
- [ ] (HYPOTHESIS) Logger faz redaction de campos sensíveis — confirmar.
- [ ] (HYPOTHESIS) Nenhuma rota HTTP está exposta sem auth em modo dev — confirmar.

## 5. Fora de escopo (nunca atacar)

Mainnet real com capital, infra de terceiros (Helius/RPC) além de leitura normal, sistemas fora desta máquina de dev.
