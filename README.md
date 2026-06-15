# Guardião WPP

Agente de IA que monitora grupos de WhatsApp (via Evolution API) e notifica
responsáveis humanos quando algo exige atenção — cliente irritado, pedido de
humano, risco de cancelamento, menção a processo, oportunidade comercial
quente, inatividade preocupante, etc.

## Como funciona

1. A Evolution API envia cada mensagem de grupo via webhook
   (`messages.upsert`) para `POST /webhook`.
2. O **filtro de allowlist** descarta mensagens de grupos não cadastrados ou
   inativos (`src/core/filtros/grupo-permitido.filtro.js`).
3. O **filtro de validade** descarta mensagens do próprio bot, de membros
   ignorados, e mídias sem texto/legenda (`src/core/filtros/mensagem-valida.filtro.js`).
4. A mensagem é persistida e passa pela **triagem rápida** (Claude Haiku) —
   uma classificação binária "precisa de atenção?" de baixo custo
   (`src/core/ia/triagem.servico.js`).
5. Se a triagem indicar atenção, entra a **análise profunda** (Claude
   Sonnet), que classifica o gatilho, a severidade, e monta uma explicação
   contextualizada (`src/core/ia/analise.servico.js`).
6. O **classificador** decide se o resultado é forte o suficiente pra gerar
   notificação, considerando o nível de sensibilidade do grupo/cliente
   (`src/core/gatilhos/classificador.js`).
7. O **throttling** evita notificações duplicadas, respeita snooze de grupo e
   janelas de horário/dia preferidas do responsável — com bypass pra
   severidade `critico` (`src/core/notificacao/throttling.js`).
8. A notificação é enviada por DM no WhatsApp via Evolution API
   (`src/core/notificacao/enviador.servico.js`).
9. O responsável pode responder a notificação com 👍 / 👎 / "pausar" / texto
   livre — o **feedback loop** registra isso e ajusta o comportamento do
   grupo (`src/core/feedback/`).

Dois jobs periódicos (`src/jobs/`) complementam o webhook:

- **Verificação de inatividade** (a cada 30min): reavalia mensagens que
  precisavam de atenção mas ficaram sem análise/resposta há tempo.
- **Relatório diário** (18:00): envia um resumo do dia pros responsáveis que
  optaram por recebê-lo.

## Arquitetura de pastas

```
src/
  api/            Express: app, rotas, middlewares, webhook
  config/         Carregamento/validação de env + cliente.yaml
  core/
    contexto/     Janela rolante de mensagens + memória/estatísticas do grupo
    feedback/     Interpretação e processamento de feedback dos responsáveis
    filtros/      Allowlist de grupos + validade de mensagens
    gatilhos/     Catálogo de gatilhos + classificador de resultados da IA
    ia/           Clientes/serviços de triagem (Haiku) e análise (Sonnet)
    notificacao/  Construção de mensagens, throttling, envio
    pipeline-mensagem.servico.js   Orquestração compartilhada (webhook + jobs)
  dominio/        Modelos Mongoose (Cliente, Grupo, Responsavel, Mensagem, Analise, Notificacao, Feedback)
  infra/          Mongo, logger (Winston), cliente HTTP da Evolution API
  jobs/           Jobs periódicos (node-cron)
  shared/         Utilitários e erros compartilhados
prompts/          Templates dos prompts de triagem e análise (Markdown)
scripts/          CLIs de cadastro e teste manual
tests/            Testes Vitest
```

## Configuração

1. Copie `.env.exemplo` para `.env` e preencha os valores (Mongo, Anthropic,
   Evolution API, `ADMIN_TOKEN`, `WEBHOOK_URL_BASE`, etc).
2. Ajuste `src/config/cliente.yaml` se necessário — esses valores servem como
   fallback enquanto não houver um documento `Cliente` correspondente no
   Mongo (`identificador` deve ser igual a `CLIENT_ID`).
3. Instale as dependências:

   ```bash
   npm install
   ```

## Rodando

```bash
npm start        # produção
npm run dev      # com --watch
npm test         # suíte de testes (Vitest)
```

O servidor expõe:

- `GET /` — health check
- `POST /webhook` — recebe eventos da Evolution API
- `GET /admin/status` — visão geral (grupos, gasto diário de IA), protegida
  por `Authorization: Bearer <ADMIN_TOKEN>`

## Cadastro inicial

```bash
npm run cadastrar-responsavel   # cadastra quem recebe notificações
npm run cadastrar-grupo         # cadastra um grupo monitorado e seus responsáveis
```

## Testes manuais

```bash
npm run testar-deteccao -- <idWhatsappGrupo> "texto da mensagem"   # roda triagem+análise sem persistir nada
npm run simulador -- <idWhatsappGrupo> "texto da mensagem" "Nome"  # roda o pipeline completo (persiste e pode notificar)
```

## Próximos passos

Veja [PROXIMOS-PASSOS.md](./PROXIMOS-PASSOS.md) pra colocar isso no ar.
