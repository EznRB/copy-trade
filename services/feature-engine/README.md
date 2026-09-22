# feature-engine

- **Responsabilidade:** computar features (incl. Copyability Score) a partir dos dados de wallets e tokens.
- **Entradas:** classificações de wallet-monitor e token-monitor; dados históricos.
- **Saídas:** vetores de features versionados (`feature_schema_version`) para signal-engine.
- **Dependências:** `@ct/types`, `@ct/config`, `@ct/logging`.
