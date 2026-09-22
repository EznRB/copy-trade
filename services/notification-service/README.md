# notification-service

- **Responsabilidade:** enviar notificações operacionais (Telegram) de sinais, trades e alertas.
- **Entradas:** eventos de signal-engine, execution-engine e risk-engine.
- **Saídas:** mensagens para canais configurados; nunca contém secrets.
- **Dependências:** `@ct/types`, `@ct/config`, `@ct/logging`.
