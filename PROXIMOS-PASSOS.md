# Próximos passos

Checklist pra colocar o Guardião WPP no ar com a "Agência Cobaia"
(`CLIENT_ID=agencia-cobaia`).

## 1. Banco de dados

- [ ] Criar um cluster MongoDB (ex: MongoDB Atlas, free tier serve pra começar).
- [ ] Copiar a connection string pra `MONGO_URI` no `.env`.

## 2. Anthropic

- [ ] Gerar uma API key em https://console.anthropic.com e colocar em
      `ANTHROPIC_API_KEY`.
- [ ] Confirmar `MODELO_TRIAGEM=claude-haiku-4-5` e
      `MODELO_ANALISE=claude-sonnet-4-5` no `.env` (já são o padrão).
- [ ] Definir `LIMITE_CUSTO_DIARIO_USD` com um valor confortável pra fase de
      testes (ex: `1.00` ou `2.00`) — o sistema para de chamar a IA quando o
      gasto do dia atinge esse limite.

## 3. Evolution API

- [ ] Ter uma instância da Evolution API rodando, com uma sessão de WhatsApp
      conectada (o número que vai ficar nos grupos monitorados).
- [ ] Preencher `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e
      `EVOLUTION_INSTANCE_NAME` no `.env`.

## 4. Deploy

- [ ] Fazer deploy do projeto (ex: Railway — `npm start` como comando de
      start, todas as variáveis do `.env.exemplo` configuradas no painel).
- [ ] Definir `WEBHOOK_URL_BASE` com a URL pública gerada pelo deploy (ex:
      `https://guardiao-wpp.up.railway.app`).
- [ ] Gerar um `ADMIN_TOKEN` forte (ex: `openssl rand -hex 32`) e configurar
      no `.env`/painel de deploy.

## 5. Configurar o webhook na Evolution API

- [ ] Na instância da Evolution API, configurar o webhook pra apontar para
      `<WEBHOOK_URL_BASE>/webhook`, habilitando o evento `messages.upsert`.

## 6. Cadastro inicial

- [ ] Rodar `npm run cadastrar-responsavel` pra cadastrar o(s)
      responsável(eis) que vão receber as notificações (número de WhatsApp
      no formato só dígitos, com DDI).
- [ ] Rodar `npm run cadastrar-grupo` pra cada grupo a ser monitorado —
      escolher o tipo certo (`atendimento`, `interno`, `fornecedor`,
      `vendas`, `outro`), associar o(s) responsável(eis) cadastrados, e
      revisar os gatilhos aplicáveis sugeridos.
- [ ] Pra obter o `idWhatsappGrupo` (JID terminando em `@g.us`) de um grupo,
      consultar a Evolution API (ex: endpoint de listagem de grupos da
      instância) com o número/nome do grupo.

## 7. Validação ponta a ponta

- [ ] Com o servidor no ar, mandar uma mensagem de teste num grupo cadastrado
      simulando um gatilho óbvio (ex: "isso é um absurdo, vou processar a
      empresa") e confirmar que o responsável recebe a notificação por DM.
- [ ] Responder a notificação com 👍, 👎 e "pausar" e confirmar que o
      feedback é registrado (`Feedback` no Mongo) e que "pausar" coloca o
      grupo em snooze.
- [ ] Checar `GET /admin/status` (com `Authorization: Bearer <ADMIN_TOKEN>`)
      pra acompanhar gasto diário e estatísticas dos grupos.

## 8. Acompanhamento contínuo

- [ ] Observar os logs (Winston) pros primeiros dias, especialmente
      `IA classificou gatilho não aplicável ao tipo de grupo` e erros de
      integração com a Evolution API.
- [ ] Ajustar `nivelSensibilidadePadrao` (em `cliente.yaml` ou, futuramente,
      no documento `Cliente`) e `nivelSensibilidade` por grupo conforme o
      volume de notificações for muito alto ou muito baixo.
- [ ] Revisar `gatilhosAtivos` por grupo caso algum gatilho gere ruído
      recorrente (ex: falsos positivos confirmados várias vezes pelo
      responsável).

## Limitações conhecidas / ideias futuras

- O documento `Cliente` (multi-tenant) ainda não tem script de cadastro —
  hoje o sistema roda inteiramente com base em `CLIENT_ID` +
  `src/config/cliente.yaml` como fallback. Pra multi-tenant completo, criar
  um script `cadastrar-cliente.js` e popular `evolutionInstance` por cliente.
- `npm audit` reporta vulnerabilidades em dependências transitivas — vale
  revisar com `npm audit` antes de ir pra produção.
