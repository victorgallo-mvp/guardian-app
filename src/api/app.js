/**
 * Configuração do app Express: middlewares globais, rotas e tratamento
 * de erros centralizado.
 *
 * Não inicia o servidor nem conecta ao banco — isso é responsabilidade
 * do entry point (`index.js`), o que mantém este módulo fácil de testar.
 */
import express from "express";
import webhookRotas from "./rotas/webhook.rotas.js";
import adminRotas from "./rotas/admin.rotas.js";
import { tratadorErros } from "./middlewares/tratador-erros.middleware.js";

const app = express();

app.use(express.json({ limit: "5mb" }));

app.get("/", (req, res) => {
  res.json({ status: "ok", servico: "guardiao-wpp" });
});

app.use("/webhook", webhookRotas);
app.use("/admin", adminRotas);

app.use((req, res) => {
  res.status(404).json({ erro: "Rota não encontrada" });
});

app.use(tratadorErros);

export default app;
