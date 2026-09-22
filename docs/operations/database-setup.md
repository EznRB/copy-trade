# Setup do Banco de Dados (PostgreSQL nativo no Windows)

> O projeto usa PostgreSQL local via Prisma. Docker NÃO é usado no dev local (virtualização desligada). Supabase permanece opção futura documentada.

## Opção recomendada — PostgreSQL instalador oficial

1. Baixar o instalador em https://www.postgresql.org/download/windows/ (documentação oficial; versão 16+ recomendada).
2. Instalar com senha do usuário `postgres` (use a do `.env` — `postgres` no exemplo).
3. Criar o banco:

```powershell
psql -U postgres -c "CREATE DATABASE copytrade;"
```

4. Aplicar migrations e gerar o client:

```powershell
npm run prisma:migrate
```

## Verificar

```powershell
psql -U postgres -c "SELECT 1;" copytrade
```

## Alternativas

- **Postgres portable / binaries zip:** para ambientes sem direito de instalação.
- **Supabase (futuro):** se adotado, registrar limites oficiais (storage, conexões, compute) em `docs/architecture/decision-log.md` como novo ADR antes da migração.

## Boas práticas

- Backups lógicos periódicos (`pg_dump`); retenção de dados em camadas RAW → NORMALIZED → FEATURES → AGGREGATES (§63 do documento fonte).
