/**
 * Setup global dos testes: preenche `process.env` com valores dummy pra
 * que `src/config/index.js` consiga validar/carregar sem precisar de um
 * `.env` real (a suíte de testes não conecta a serviços externos).
 */
process.env.MONGO_URI ??= "mongodb://localhost:27017/guardiao-wpp-test";
process.env.ANTHROPIC_API_KEY ??= "sk-ant-test";
process.env.EVOLUTION_API_URL ??= "http://localhost:0";
process.env.EVOLUTION_API_KEY ??= "test";
process.env.EVOLUTION_INSTANCE_NAME ??= "test";
process.env.CLIENT_ID ??= "agencia-cobaia";
process.env.ADMIN_TOKEN ??= "token-de-teste-1234";
process.env.WEBHOOK_URL_BASE ??= "http://localhost:3000";
process.env.NODE_ENV ??= "test";
